import { renderSvg, SpecError } from "../src/index.js";
import { svgToPngBlob } from "../src/export.js";
import { specFile, t } from "./i18n/index.js";
import { $, bindAiSpec, bindLang, bindSeed, download, fileBase, showStatus, store, toast } from "./common.js";
import { LOGO } from "./logo.js";

// 以模組位置解析路徑, 網站放在任何子路徑 (例如 github.io/<repo>/) 都能找到範例與 AI 規格
const EXAMPLES_DIR = new URL("../examples/", import.meta.url);
const editor = $("#editor");
const workspace = $(".workspace");

const MAX_ITEMS = 100;
const TITLE_MAX = 40;
// items: [{ id, title, json, updatedAt }]。json 存編輯區原文, 有錯也照存, 重新整理才不會丟失
const state = { seed: 0, scale: 1, current: null, items: [], currentId: "" };

const BLANK = {
  version: 1,
  name: "my_sticker",
  canvas: { w: 256, h: 256, scale: 4, foot: 20, baseY: 224 },
  shapes: [
    { t: "ell", cx: 0, cy: 0, rx: 20, ry: 20, fill: "#ff8a2a" },
    { t: "dot", x: -7, y: -7, r: 3, fill: "#fff3e0", sw: 0 },
  ],
};

// ---------- JSON 整理: 短的物件與座標陣列保持一行, 長的才換行 ----------
const inline = (x) =>
  Array.isArray(x) ? `[${x.map(inline).join(", ")}]`
  : x && typeof x === "object" ? `{ ${Object.entries(x).map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(", ")} }`
  : JSON.stringify(x);

function pretty(v, ind = "") {
  if (!v || typeof v !== "object") return JSON.stringify(v);
  const one = inline(v);
  if (one.length + ind.length <= 96 || (Array.isArray(v) && v.every((x) => !x || typeof x !== "object"))) return one;
  const next = ind + "  ";
  const items = Array.isArray(v)
    ? v.map((x) => next + pretty(x, next))
    : Object.entries(v).map(([k, x]) => `${next}${JSON.stringify(k)}: ${pretty(x, next)}`);
  return Array.isArray(v) ? `[\n${items.join(",\n")}\n${ind}]` : `{\n${items.join(",\n")}\n${ind}}`;
}

// ---------- 渲染 ----------
const countShapes = (list) => list.reduce((n, s) => n + 1 + (Array.isArray(s.children) ? countShapes(s.children) : 0), 0);
const currentItem = () => state.items.find((x) => x.id === state.currentId);

const showErrors = (errors) => showStatus($("#status"), "", errors);
const setStatus = (text) => showStatus($("#status"), text);

function updateScaleLabels() {
  if (!state.current) return;
  for (const span of document.querySelectorAll("#scaleSeg span[data-scale]")) {
    const s = Number(span.dataset.scale);
    span.innerHTML = `${s}×<small>${state.current.width * s}px</small>`;
  }
}

function render() {
  const item = currentItem();
  if (!item) {
    state.current = null;
    $("#preview").replaceChildren();
    setStatus(t("items.empty"));
    return;
  }
  let spec;
  try {
    spec = JSON.parse(editor.value);
  } catch (e) {
    showErrors([t("error.json", { msg: e.message })]);
    return;
  }
  try {
    state.current = renderSvg(spec, { seed: state.seed, id: "pv-" });
  } catch (e) {
    if (!(e instanceof SpecError)) throw e;
    showErrors(e.errors);
    return;
  }
  $("#preview").innerHTML = state.current.svg;
  updateScaleLabels();
  setStatus(t("status.ok", { w: spec.canvas.w, h: spec.canvas.h, n: countShapes(spec.shapes) }));
  updateThumb(item);
}

// ---------- 圖片列表 ----------
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function persist() {
  if (store.set("studio.items", JSON.stringify(state.items))) return true;
  toast(t("toast.saveFailed"));
  return false;
}

function thumbSvg(item) {
  try {
    return renderSvg(JSON.parse(item.json), { id: `th-${item.id}-` }).svg;
  } catch {
    return "";
  }
}

function updateThumb(item) {
  const el = document.querySelector(`.card[data-id="${CSS.escape(item.id)}"] .thumb`);
  if (el) el.innerHTML = thumbSvg(item);
}

function iconButton(cls, text, label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `icon-btn ${cls}`;
  b.textContent = text;
  b.setAttribute("aria-label", label);
  b.addEventListener("click", onClick);
  return b;
}

function renderList() {
  const ul = $("#items");
  ul.replaceChildren();
  for (const item of state.items) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.dataset.id = item.id;
    card.setAttribute("aria-current", String(item.id === state.currentId));
    const thumb = document.createElement("span");
    thumb.className = "thumb";
    thumb.innerHTML = thumbSvg(item);
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = item.title;
    card.append(thumb, label);
    card.addEventListener("click", () => select(item.id));
    card.addEventListener("dblclick", () => startRename(item.id));

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(
      iconButton("rename", "✎", t("items.rename", { name: item.title }), () => startRename(item.id)),
      iconButton("delete", "×", t("items.delete", { name: item.title }), () => removeItem(item.id)),
    );
    const li = document.createElement("li");
    li.className = "item";
    li.append(card, actions);
    ul.append(li);
  }
  $("#count").textContent = `${state.items.length}/${MAX_ITEMS}`;
  $("#addItem").disabled = state.items.length >= MAX_ITEMS;
  $("#itemsEmpty").hidden = state.items.length > 0;
  editor.disabled = !currentItem();
}

function markCurrent() {
  for (const c of document.querySelectorAll(".card")) c.setAttribute("aria-current", String(c.dataset.id === state.currentId));
  editor.disabled = !currentItem();
}

function select(id) {
  flushSave();
  state.currentId = id;
  store.set("studio.current", id);
  const item = currentItem();
  editor.value = item ? item.json : "";
  markCurrent();
  render();
}

// 改名時把卡片按鈕整個換成「縮圖 + 輸入框」, 輸入框不能放在 <button> 裡面
function startRename(id) {
  const item = state.items.find((x) => x.id === id);
  const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (!item || !card) return;
  const input = document.createElement("input");
  input.className = "rename-input";
  input.value = item.title;
  input.maxLength = TITLE_MAX;
  input.setAttribute("aria-label", t("items.rename", { name: item.title }));
  const box = document.createElement("div");
  box.className = "card renaming";
  box.dataset.id = id;
  box.append(card.querySelector(".thumb"), input);
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const v = input.value.trim().slice(0, TITLE_MAX);
    if (save && v && v !== item.title) {
      item.title = v;
      item.updatedAt = Date.now();
      persist();
    }
    renderList();
  };
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
  card.replaceWith(box);
  input.focus();
  input.select();
}

function removeItem(id) {
  const idx = state.items.findIndex((x) => x.id === id);
  if (idx < 0 || !confirm(t("confirm.delete", { name: state.items[idx].title }))) return;
  state.items.splice(idx, 1);
  persist();
  if (id === state.currentId) {
    const next = state.items[idx] ?? state.items[idx - 1];
    state.currentId = next ? next.id : "";
  }
  renderList();
  select(state.currentId);
}

function addItem() {
  if (state.items.length >= MAX_ITEMS) {
    toast(t("items.full", { max: MAX_ITEMS }));
    return;
  }
  const item = { id: newId(), title: t("items.untitled", { n: state.items.length + 1 }), json: pretty(BLANK), updatedAt: Date.now() };
  state.items.push(item);
  persist();
  renderList();
  select(item.id);
  document.querySelector(`.card[data-id="${CSS.escape(item.id)}"]`)?.scrollIntoView({ block: "nearest" });
  startRename(item.id);
}
$("#addItem").addEventListener("click", addItem);

// 編輯即存: 內容即時寫進目前圖片, 寫入 localStorage 延遲 300ms 合併
let saveTimer;
let renderTimer;
function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  persist();
}
editor.addEventListener("input", () => {
  const item = currentItem();
  if (!item) return;
  item.json = editor.value;
  item.updatedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 150);
});
window.addEventListener("pagehide", flushSave);

// 第一次開啟 (從未存過列表) 放入範例; 使用者把列表刪空之後不會再補回
async function loadItems() {
  const raw = store.get("studio.items");
  if (raw !== null) {
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) {
        return v.filter((x) => x && typeof x.id === "string" && /^[\w-]+$/.test(x.id) && typeof x.title === "string" && typeof x.json === "string").slice(0, MAX_ITEMS);
      }
    } catch { /* 存檔損毀時當作空列表 */ }
    return [];
  }
  const list = await (await fetch(new URL("index.json", EXAMPLES_DIR))).json();
  const items = [];
  for (const ex of list) {
    const json = await (await fetch(new URL(ex.file, EXAMPLES_DIR))).text();
    items.push({ id: newId(), title: t(`example.${ex.id}`), json, updatedAt: Date.now() });
  }
  state.items = items;
  persist();
  return items;
}

// ---------- 編輯工具 ----------
$("#format").addEventListener("click", () => {
  try {
    editor.value = pretty(JSON.parse(editor.value));
    editor.dispatchEvent(new Event("input"));
  } catch (e) {
    showErrors([t("error.jsonFormat", { msg: e.message })]);
  }
});

$("#saveJson").addEventListener("click", () => {
  const item = currentItem();
  if (!item) return;
  const file = `${fileBase(item.title)}.json`;
  download(new Blob([editor.value], { type: "application/json" }), file);
  toast(t("toast.downloaded", { file }));
});

// ---------- 預覽與輸出控制 ----------
for (const input of document.querySelectorAll('input[name="bg"]')) {
  input.addEventListener("change", () => { $("#stage").className = `stage bg-${input.value}`; store.set("studio.bg", input.value); });
}
for (const input of document.querySelectorAll('input[name="scale"]')) {
  input.addEventListener("change", () => { state.scale = Number(input.value); });
}

bindSeed({ input: $("#seed"), down: $("#seedDown"), up: $("#seedUp"), dice: $("#dice") }, () => state.seed, (v) => { state.seed = v; render(); });

async function exportPng() {
  const item = currentItem();
  if (!state.current || !item) return;
  const blob = await svgToPngBlob(state.current.svg, state.current.width, state.current.height, state.scale);
  const file = `${fileBase(item.title)}.png`;
  download(blob, file);
  toast(t("toast.downloadedPng", { file, px: state.current.width * state.scale }));
}
$("#export").addEventListener("click", exportPng);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    exportPng();
  }
});

$("#copy").addEventListener("click", async () => {
  if (!state.current) return;
  try {
    await navigator.clipboard.writeText(state.current.svg);
    toast(t("toast.svgCopied"));
  } catch {
    toast(t("toast.clipboardDenied"));
  }
});

// ---------- AI 規格視窗 ----------
const aiSpec = bindAiSpec(
  { open: $("#aiSpecBtn"), dialog: $("#aiSpec"), text: $("#aiSpecText"), copy: $("#aiSpecCopy"), link: $("#aiSpecDownload"), note: $("#aiSpecNote") },
  specFile,
);

// ---------- 版面: 拖曳分隔線, 窄螢幕分頁 ----------
const splitter = $("#splitter");
function setSplit(ratio) {
  const r = Math.min(0.75, Math.max(0.25, ratio));
  workspace.style.setProperty("--editor", `${(r / (1 - r)).toFixed(3)}fr`);
  splitter.setAttribute("aria-valuenow", String(Math.round(r * 100)));
  store.set("studio.split", String(r));
  return r;
}
let split = setSplit(Number(store.get("studio.split")) || 0.5);
splitter.setAttribute("aria-valuemin", "25");
splitter.setAttribute("aria-valuemax", "75");
splitter.addEventListener("pointerdown", (e) => {
  splitter.setPointerCapture(e.pointerId);
  splitter.classList.add("dragging");
});
splitter.addEventListener("pointermove", (e) => {
  if (!splitter.hasPointerCapture(e.pointerId)) return;
  const left = $(".editor-pane").getBoundingClientRect().left;
  const right = workspace.getBoundingClientRect().right;
  split = setSplit((e.clientX - left) / (right - left));
});
splitter.addEventListener("pointerup", () => splitter.classList.remove("dragging"));
splitter.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") split = setSplit(split - 0.05);
  if (e.key === "ArrowRight") split = setSplit(split + 0.05);
});

for (const tab of document.querySelectorAll(".tabs button")) {
  tab.addEventListener("click", () => {
    workspace.dataset.view = tab.dataset.view;
    for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-pressed", String(b === tab));
  });
}

// 圖片列表寬度可拖曳; 窄於 COMPACT_BELOW 時只顯示縮圖
const gallerySplitter = $("#gallerySplitter");
const GALLERY_MIN = 96;
const GALLERY_MAX = 360;
const COMPACT_BELOW = 150;
function setGalleryWidth(px) {
  const w = Math.round(Math.min(GALLERY_MAX, Math.max(GALLERY_MIN, px)));
  workspace.style.setProperty("--gallery-w", `${w}px`);
  workspace.dataset.collapsed = String(w < COMPACT_BELOW);
  gallerySplitter.setAttribute("aria-valuenow", String(w));
  store.set("studio.galleryW", String(w));
  return w;
}
let galleryW = setGalleryWidth(Number(store.get("studio.galleryW")) || 176);
gallerySplitter.setAttribute("aria-valuemin", String(GALLERY_MIN));
gallerySplitter.setAttribute("aria-valuemax", String(GALLERY_MAX));
gallerySplitter.addEventListener("pointerdown", (e) => {
  gallerySplitter.setPointerCapture(e.pointerId);
  gallerySplitter.classList.add("dragging");
});
gallerySplitter.addEventListener("pointermove", (e) => {
  if (!gallerySplitter.hasPointerCapture(e.pointerId)) return;
  galleryW = setGalleryWidth(e.clientX - workspace.getBoundingClientRect().left);
});
gallerySplitter.addEventListener("pointerup", () => gallerySplitter.classList.remove("dragging"));
gallerySplitter.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") galleryW = setGalleryWidth(galleryW - 20);
  if (e.key === "ArrowRight") galleryW = setGalleryWidth(galleryW + 20);
});

$("#helpBtn").addEventListener("click", () => $("#help").showModal());

// ---------- 資料儲存聲明: 第一次造訪顯示, 按「知道了」後不再出現 ----------
const notice = $("#notice");
notice.hidden = store.get("studio.notice") === "1";
$("#noticeOk").addEventListener("click", () => {
  store.set("studio.notice", "1");
  notice.hidden = true;
});
for (const btn of document.querySelectorAll(".js-clear-storage")) {
  btn.addEventListener("click", () => {
    const n = state.items.length;
    if (n && !confirm(t("confirm.clear", { n }))) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    store.clear();
    // 重新載入後回到第一次開啟的狀態 (重新放入範例)
    location.reload();
  });
}

// ---------- 語系 ----------
bindLang($("#lang"), () => { aiSpec.refresh(); renderList(); render(); });
$("#logo").innerHTML = renderSvg(LOGO, { id: "logo-" }).svg;

const savedBg = store.get("studio.bg");
if (savedBg) {
  const input = document.querySelector(`input[name="bg"][value="${CSS.escape(savedBg)}"]`);
  if (input) { input.checked = true; $("#stage").className = `stage bg-${savedBg}`; }
}

state.items = await loadItems();
const lastId = store.get("studio.current");
state.currentId = state.items.some((x) => x.id === lastId) ? lastId : (state.items[0]?.id ?? "");
renderList();
select(state.currentId);
