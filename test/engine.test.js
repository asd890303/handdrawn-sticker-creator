import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderSvg, SHAPE_TYPES, SpecError, validateSpec } from "../src/index.js";

const read = async (f) => JSON.parse(await readFile(new URL(`../examples/${f}`, import.meta.url), "utf8"));
const load = (n) => read(`${n}.json`);

test("範例清單裡的每個規格都能通過驗證並產出 SVG", async () => {
  const list = await read("index.json");
  assert.ok(list.length >= 4);
  for (const { file } of list) {
    const spec = await read(file);
    assert.deepEqual(validateSpec(spec), [], file);
    const { svg, width, height } = renderSvg(spec);
    assert.match(svg, /^<svg [^>]*width="256" height="256"/);
    assert.equal(`${width}x${height}`, "256x256");
    assert.ok(svg.includes('id="rim"') && svg.includes('id="shade"'));
    // 輸出要能乾淨去背: 預設沒有陰影疊層, 也沒有腳底光暈
    assert.ok(!svg.includes('mask="url(#shade)"'), "預設不該畫下半部陰影");
    assert.ok(!/<ellipse[^>]*opacity/.test(svg) && !svg.includes('id="glow"'), "不該畫腳底光暈");
  }
});

test("同一個 seed 輸出相同, 不同 seed 輸出不同", async () => {
  const spec = await load("truck");
  assert.equal(renderSvg(spec, { seed: 1 }).svg, renderSvg(spec, { seed: 1 }).svg);
  assert.notEqual(renderSvg(spec, { seed: 1 }).svg, renderSvg(spec, { seed: 2 }).svg);
});

test("repeat 內的陣列依序號取值", async () => {
  const base = await load("apple");
  const spec = { ...base, shapes: [{ t: "repeat", n: 3, dx: 10, children: [{ t: "dot", x: 0, y: 0, r: 2, fill: ["#111111", "#222222", "#333333"] }] }] };
  const { svg } = renderSvg(spec);
  for (const c of ["#111111", "#222222", "#333333"]) assert.ok(svg.includes(`fill="${c}"`));
});

test("id 前綴會套用到所有濾鏡參照", async () => {
  const { svg } = renderSvg(await load("fridge"), { id: "a1-" });
  assert.ok(svg.includes('id="a1-rim"') && svg.includes("url(#a1-rim)"));
  assert.doesNotMatch(svg, /url\(#rim\)/);
});

test("非法顏色、未知圖形、未定義調色盤都會被擋下", async () => {
  const base = await load("apple");
  const bad = (shape) => validateSpec({ ...base, shapes: [shape] });
  assert.ok(bad({ t: "dot", x: 0, y: 0, r: 1, fill: '"/><script>' }).length);
  assert.ok(bad({ t: "script", src: "x" }).length);
  assert.ok(bad({ t: "dot", x: 0, y: 0, r: 1, fill: "$nope" }).length);
  assert.ok(bad({ t: "dot", x: 0, y: 0, r: 1, fill: ["#fff"] }).length, "repeat 以外不可用陣列");
  assert.ok(bad({ t: "word", text: "xyz", x: 0, y: 0 }).length, "不支援的字母");
  assert.throws(() => renderSvg({ ...base, shapes: [{ t: "dot" }] }), SpecError);
});

test("名稱不可帶標籤字元, 圖形與迴圈數量有上限", async () => {
  const base = await load("apple");
  assert.ok(validateSpec({ ...base, name: '"><svg onload=x>' }).length);
  const big = { t: "repeat", n: 200, children: [{ t: "repeat", n: 200, children: [{ t: "dot", x: 0, y: 0, r: 1, fill: "#fff" }] }] };
  assert.throws(() => renderSvg({ ...base, shapes: [big, big] }), SpecError);
});

test("輸出的 SVG 不含 script 或事件屬性", async () => {
  for (const n of ["apple", "truck", "fridge", "truck_driver"]) {
    assert.doesNotMatch(renderSvg(await load(n)).svg, /<script|\son\w+=/i);
  }
});

for (const file of ["ai-prompt.md", "ai-prompt.en.md"]) test(`給 AI 的規格文件 ${file}: 範例 JSON 都合法, 每種圖形都有說明`, async () => {
  const doc = (await readFile(new URL(`../docs/${file}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const blocks = [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
  const full = blocks.filter((b) => b.trimStart().startsWith('{\n  "version"'));
  assert.ok(full.length >= 2, "至少要有兩份完整範例");
  for (const b of full) assert.deepEqual(validateSpec(JSON.parse(b)), [], b.slice(0, 60));
  // word 只支援少數字母, 文件刻意不教 AI 使用
  for (const t of SHAPE_TYPES.filter((t) => t !== "word")) assert.ok(doc.includes(`### \`${t}\``), `文件缺少 ${t}`);
  // 單行圖形範例要能放進 shapes 通過驗證; 含 "..." 的是示意寫法, 略過。範例用到的 $名稱 補進調色盤
  const base = JSON.parse(full[0]);
  for (const b of blocks.filter((b) => b.trimStart().startsWith('{ "t"') && !b.includes("..."))) {
    const shape = JSON.parse(b);
    const palette = { ...base.palette };
    for (const [, n] of b.matchAll(/"\$(\w+)"/g)) palette[n] ??= "#000000";
    const wrapped = shape.t === "repeat" ? shape : { t: "group", children: [shape] };
    assert.deepEqual(validateSpec({ ...base, palette, shapes: [wrapped] }), [], b);
  }
});

test("介面語系: 各語系 key 一致, 介面用到的 key 都有翻譯", async () => {
  const { default: zh } = await import("../web/i18n/zh-TW.js");
  const { default: en } = await import("../web/i18n/en.js");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort(), "en 與 zh-TW 的 key 不一致");
  const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  const js = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
  const used = new Set([
    ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(";").map((p) => p.split(":")[1].trim())),
    ...[...js.matchAll(/\bt\("([^"]+)"/g)].map((m) => m[1]),
  ]);
  const list = JSON.parse(await readFile(new URL("../examples/index.json", import.meta.url), "utf8"));
  for (const ex of list) used.add(`example.${ex.id}`);
  for (const key of used) assert.ok(key in zh, `zh-TW 缺少 ${key}`);
});

test("skills/handdrawn-sticker-creator/SKILL.md 與 docs/ai-prompt.md 同步 (不同步請執行 npm run skill)", async () => {
  const { readFile } = await import("node:fs/promises");
  const { buildSkill, SKILL_PATH } = await import("../scripts/sync-skill.mjs");
  assert.equal((await readFile(SKILL_PATH, "utf8")).replace(/\r\n/g, "\n"), await buildSkill());
});
