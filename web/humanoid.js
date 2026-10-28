import { renderAll, renderFrame, renderSvg, HumanError, ACTIONS, FPS, SHEET } from "../src/index.js";
import { svgsToSheetBlob } from "../src/export.js";
import { locale, t } from "./i18n/index.js";
import { $, bindAiSpec, bindLang, bindSeed, download, fileBase, showStatus, store, toast } from "./common.js";
import { LOGO } from "./logo.js";

const EXAMPLES = new URL("../examples/", import.meta.url);
const state = { seed: 0, scale: 1, action: "walk", view: "front", frames: null, spec: null, tick: 0 };
const editor = $("#hEditor");
const setStatus = (text, errors) => showStatus($("#hStatus"), text, errors);

// 向左 = 向右翻轉 (圖集只有 正面 / 背面 / 向右)
const realView = () => (state.view === "left" ? "side" : state.view);

function render() {
  let spec;
  try { spec = JSON.parse(editor.value); } catch (e) { setStatus("", [t("error.json", { msg: e.message })]); return; }
  try { state.frames = renderAll(spec, { seed: state.seed, id: "h-" }); } catch (e) {
    if (!(e instanceof HumanError)) throw e;
    setStatus("", e.errors);
    return;
  }
  state.spec = spec;
  setStatus(t("human.ok", { n: state.frames.length }));
  $("#sheet").innerHTML = state.frames.map((f) => `<span>${f.svg}</span>`).join("");
  if (!store.set("studio.human", editor.value)) toast(t("toast.saveFailed"));
  drawAnim();
}

// 動畫區的大圖另外用 "a-" 前綴畫一次, 不和下面圖集的濾鏡 id 衝突
function drawAnim() {
  if (!state.spec) return;
  $("#anim").classList.toggle("left", state.view === "left");
  $("#anim").innerHTML = renderFrame(state.spec, realView(), state.action, state.tick % ACTIONS[state.action], { seed: state.seed, id: "a-" }).svg;
}
let timer;
function loop() {
  clearTimeout(timer);
  timer = setTimeout(() => { state.tick++; drawAnim(); loop(); }, 1000 / FPS[state.action]);
}

for (const name of ["action", "view"]) {
  for (const input of document.querySelectorAll(`input[name="${name}"]`)) {
    input.addEventListener("change", () => { state[name] = input.value; state.tick = 0; drawAnim(); loop(); });
  }
}
for (const input of document.querySelectorAll('input[name="hscale"]')) input.addEventListener("change", () => { state.scale = Number(input.value); });
bindSeed({ input: $("#hSeed"), down: $("#hSeedDown"), up: $("#hSeedUp"), dice: $("#hDice") }, () => state.seed, (v) => { state.seed = v; render(); });

let renderTimer;
editor.addEventListener("input", () => { clearTimeout(renderTimer); renderTimer = setTimeout(render, 150); });

const baseName = () => { try { return fileBase(JSON.parse(editor.value).name, "humanoid"); } catch { return "humanoid"; } };

$("#hExport").addEventListener("click", async () => {
  if (!state.frames) return;
  const blob = await svgsToSheetBlob(state.frames.map((f) => f.svg), SHEET.cell, SHEET.cols, state.scale);
  const file = `${baseName()}.png`;
  download(blob, file);
  toast(t("toast.downloadedPng", { file, px: SHEET.size * state.scale }));
});
$("#hSaveJson").addEventListener("click", () => {
  const file = `${baseName()}.json`;
  download(new Blob([editor.value], { type: "application/json" }), file);
  toast(t("toast.downloaded", { file }));
});

// 資料儲存: 重設會清掉這個網站存的全部項目 (含貼紙頁), 重新載入後回到第一次開啟的狀態
$("#hReset").addEventListener("click", () => {
  if (!confirm(t("human.confirmReset"))) return;
  store.clear();
  location.reload();
});

// 範例
const presets = await (await fetch(new URL("humanoid/index.json", EXAMPLES))).json();
const presetSel = $("#preset");
for (const p of presets) presetSel.add(new Option(p.title, p.file));
presetSel.addEventListener("change", async () => {
  editor.value = await (await fetch(new URL(presetSel.value, EXAMPLES))).text();
  render();
});

// AI 規格視窗
const aiSpec = bindAiSpec(
  { open: $("#aiSpecBtn"), dialog: $("#aiSpec"), text: $("#aiSpecText"), copy: $("#aiSpecCopy"), link: $("#aiSpecDownload") },
  () => (locale() === "en" ? "humanoid-prompt.en.md" : "humanoid-prompt.md"),
);

bindLang($("#lang"), () => { aiSpec.refresh(); render(); });
$("#logo").innerHTML = renderSvg(LOGO, { id: "logo-" }).svg;

editor.value = store.get("studio.human") ?? (await (await fetch(new URL(presets[0].file, EXAMPLES))).text());
render();
loop();
