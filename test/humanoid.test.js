import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ACTIONS, FRAMES, HumanError, SHEET, renderAll, renderFrame, validateHuman } from "../src/index.js";

const read = async (f) => JSON.parse(await readFile(new URL(`../examples/${f}`, import.meta.url), "utf8"));

test("人形範例都通過驗證, 並畫出 36 格 (走路 18 / 受傷 6 / 衝刺 12)", async () => {
  const list = await read("humanoid/index.json");
  assert.ok(list.length >= 4);
  for (const { file } of list) {
    const spec = await read(file);
    assert.deepEqual(validateHuman(spec), [], file);
    const all = renderAll(spec);
    assert.equal(all.length, SHEET.cols * SHEET.cols);
    for (const [action, n] of Object.entries(ACTIONS)) assert.equal(all.filter((f) => f.action === action).length, n * 3, action);
    for (const f of all) assert.match(f.svg, new RegExp(`^<svg [^>]*width="${SHEET.cell}" height="${SHEET.cell}"`));
  }
  assert.equal(FRAMES.length, 36);
  assert.equal(SHEET.cell * SHEET.cols, SHEET.size);
  // 圖集順序: 走路 0-17 / 受傷 18-23 / 衝刺 24-35, 動作內依 正面 / 背面 / 側面
  assert.deepEqual([FRAMES[0], FRAMES[6], FRAMES[12], FRAMES[18], FRAMES[24]].map((f) => [f.action, f.view]), [["walk", "front"], ["walk", "back"], ["walk", "side"], ["hurt", "front"], ["dash", "front"]]);
});

test("同角色同 seed 輸出相同, 換 seed 或換名字會變", async () => {
  const spec = await read("humanoid/blue_worker.json");
  const a = renderFrame(spec, "front", "walk", 2, { seed: 1 }).svg;
  assert.equal(renderFrame(spec, "front", "walk", 2, { seed: 1 }).svg, a);
  assert.notEqual(renderFrame(spec, "front", "walk", 2, { seed: 2 }).svg, a);
  assert.notEqual(renderFrame({ ...spec, name: "other" }, "front", "walk", 2, { seed: 1 }).svg, a);
});

test("輸出乾淨去背: 沒有光暈、沒有腳底半透明色塊", async () => {
  const svg = renderFrame(await read("humanoid/pink_sales.json"), "side", "dash", 1).svg;
  assert.ok(!svg.includes('id="glow"') && !/<ellipse[^>]*opacity/.test(svg));
  assert.ok(!svg.includes("<script"));
});

test("錯誤欄位會被擋下並指出欄位", () => {
  const ok = { version: 1, name: "x" };
  assert.deepEqual(validateHuman(ok), []);
  assert.ok(validateHuman({ ...ok, top: "red" }).some((e) => e.startsWith("top:")));
  assert.ok(validateHuman({ ...ok, hairStyle: "afro" }).some((e) => e.startsWith("hairStyle:")));
  assert.ok(validateHuman({ ...ok, hat: "cap" }).some((e) => e.startsWith("hat:")));
  assert.ok(validateHuman({ version: 2, name: "<b>" }).length >= 2);
  assert.throws(() => renderAll({ ...ok, top: "url(javascript:1)" }), HumanError);
});

test("shade 選項: 預設有陰影層, false 時沒有; 只能是布林", async () => {
  const spec = await read("humanoid/blue_worker.json");
  assert.ok(renderFrame(spec, "front", "walk", 0).svg.includes("mask=\"url(#shade)\""));
  assert.ok(!renderFrame({ ...spec, shade: false }, "front", "walk", 0).svg.includes("mask=\"url(#shade)\""));
  assert.ok(validateHuman({ ...spec, shade: "yes" }).some((e) => e.startsWith("shade:")));
});

test("同一個視角的每一格用同一組抖動 (不會閃)", async () => {
  // 走路相位 0 與相位 3 的姿勢相同方向相反, 但抖動種子一樣: 只要 shape 數量一致, 路徑指令數就一致
  const spec = await read("humanoid/blue_worker.json");
  const cmds = (svg) => (svg.match(/ C/g) ?? []).length;
  const a = renderFrame(spec, "front", "walk", 0).svg, b = renderFrame(spec, "front", "walk", 3).svg;
  assert.equal(cmds(a), cmds(b));
});

test("三種髮型都能畫", async () => {
  const spec = await read("humanoid/blue_worker.json");
  for (const hairStyle of ["short", "swoop", "none"]) {
    for (const f of renderAll({ ...spec, hairStyle })) assert.ok(f.svg.length > 200);
  }
});
