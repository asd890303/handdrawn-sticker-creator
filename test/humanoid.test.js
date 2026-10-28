import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ACTIONS, FRAMES, HumanError, PARTS, SHEET, renderAll, renderFrame, renderSheet, validateHuman } from "../src/index.js";

const read = async (f) => JSON.parse(await readFile(new URL(`../examples/${f}`, import.meta.url), "utf8"));
const clone = (x) => JSON.parse(JSON.stringify(x));

test("人形範例都通過驗證, 並畫出 18 格 (正面 / 背面 / 側面各走路 6 格)", async () => {
  const list = await read("humanoid/index.json");
  assert.ok(list.length >= 4);
  for (const { file } of list) {
    const spec = await read(file);
    assert.deepEqual(validateHuman(spec), [], file);
    const all = renderAll(spec);
    assert.equal(all.length, 18);
    assert.equal(all.length, SHEET.cols * SHEET.rows);
    for (const view of ["front", "back", "side"]) assert.equal(all.filter((f) => f.view === view).length, ACTIONS.walk, view);
    for (const f of all) assert.match(f.svg, new RegExp(`^<svg [^>]*width="${SHEET.cell}" height="${SHEET.cell}"`));
  }
  assert.deepEqual(Object.keys(ACTIONS), ["walk"], "只有走路 (沒有受傷 / 衝刺)");
  assert.equal(FRAMES.length, 18);
  assert.equal(SHEET.cell * SHEET.cols, SHEET.width);
  assert.equal(SHEET.cell * SHEET.rows, SHEET.height);
  // 圖集順序: 正面 0-5 / 背面 6-11 / 側面 12-17
  assert.deepEqual([FRAMES[0], FRAMES[6], FRAMES[12], FRAMES[17]].map((f) => [f.view, f.i]), [["front", 0], ["back", 0], ["side", 0], ["side", 5]]);
});

test("圖集 SVG: 768×384, 內含 18 個格子, 濾鏡 id 不重複", async () => {
  const sheet = renderSheet(await read("humanoid/blue_worker.json"), { id: "t-" });
  assert.match(sheet.svg, /^<svg [^>]*width="768" height="384"/);
  assert.equal((sheet.svg.match(/<svg /g) ?? []).length, 19);
  const ids = [...sheet.svg.matchAll(/<filter id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(sheet.svg.includes('x="640" y="256"'), "最後一格在右下角");
  assert.equal([sheet.width, sheet.height].join("x"), "768x384");
});

test("每個角色的形狀由 JSON 決定: 改部位圖形, 輸出就不同; 改顏色也會不同", async () => {
  const spec = await read("humanoid/blue_worker.json");
  const a = renderFrame(spec, "front", 0).svg;
  const wide = clone(spec);
  wide.parts.torso.front[0][2] = wide.parts.torso.front[0][2].map(([x, y]) => [x * 1.3, y]);
  assert.notEqual(renderFrame(wide, "front", 0).svg, a);
  assert.equal(renderFrame(wide, "side", 0).svg, renderFrame(spec, "side", 0).svg, "只改正面的身體, 側面不變");
  assert.notEqual(renderFrame({ ...spec, palette: { ...spec.palette, top: "#ff0000" } }, "front", 0).svg, a);
});

test("走路的各格姿勢不同 (腿與手臂會動)", async () => {
  const spec = await read("humanoid/blue_worker.json");
  // 正面 / 背面只有 3 種姿勢 (雙腳著地、左腳抬、右腳抬), 6 格中有重複; 側面 6 格各不相同
  const distinct = (view) => new Set([0, 1, 2, 3, 4, 5].map((i) => renderFrame(spec, view, i).svg)).size;
  assert.equal(distinct("front"), 3);
  assert.equal(distinct("back"), 3);
  assert.equal(distinct("side"), 6);
});

test("同角色同 seed 輸出相同, 換 seed 或換名字會變", async () => {
  const spec = await read("humanoid/blue_worker.json");
  const a = renderFrame(spec, "front", 2, { seed: 1 }).svg;
  assert.equal(renderFrame(spec, "front", 2, { seed: 1 }).svg, a);
  assert.notEqual(renderFrame(spec, "front", 2, { seed: 2 }).svg, a);
  assert.notEqual(renderFrame({ ...spec, name: "other" }, "front", 2, { seed: 1 }).svg, a);
});

test("shade 選項: 預設有陰影層, false 時沒有; 只能是布林", async () => {
  const spec = await read("humanoid/blue_worker.json");
  assert.ok(renderFrame(spec, "front", 0).svg.includes('mask="url(#shade)"'));
  assert.ok(!renderFrame({ ...spec, shade: false }, "front", 0).svg.includes('mask="url(#shade)"'));
  assert.ok(validateHuman({ ...spec, shade: "yes" }).some((e) => e.startsWith("shade:")));
});

test("輸出乾淨去背: 沒有光暈、沒有腳底半透明色塊、沒有 script", async () => {
  const svg = renderSheet(await read("humanoid/pink_sales.json")).svg;
  assert.ok(!svg.includes('id="glow"') && !/<ellipse[^>]*opacity/.test(svg));
  assert.ok(!svg.includes("<script"));
});

test("驗證: 缺部位 / 缺視角 / 未知欄位 / 圖形錯誤都會指出路徑", async () => {
  const spec = await read("humanoid/blue_worker.json");
  assert.deepEqual(validateHuman(spec), []);
  const err = (mutate) => { const s = clone(spec); mutate(s); return validateHuman(s); };
  assert.ok(err((s) => delete s.parts.leg).some((e) => e.startsWith("parts.leg:")));
  assert.ok(err((s) => delete s.parts.arm.side).some((e) => e.startsWith("parts.arm.side:")));
  assert.ok(err((s) => { s.parts.torso.back = []; }).some((e) => e.startsWith("parts.torso.back:")));
  assert.ok(err((s) => { s.parts.hat = {}; }).some((e) => e.startsWith("parts.hat:")));
  assert.ok(err((s) => { s.parts.head.hurt = { front: s.parts.head.front }; }).some((e) => e.startsWith("parts.head.hurt:")), "已移除受傷, hurt 算未知欄位");
  assert.ok(err((s) => { s.hat = 1; }).some((e) => e.startsWith("hat:")));
  assert.ok(err((s) => { s.parts.leg.front[0][1] = "$nope"; }).some((e) => e.startsWith("parts.leg.front[0].fill:")));
  assert.ok(err((s) => { s.parts.head.side[0] = { t: "constructor" }; }).some((e) => e.startsWith("parts.head.side[0]")));
  assert.ok(err((s) => { s.palette.skin = "red"; }).some((e) => e.startsWith("palette.skin")));
  assert.ok(validateHuman({ version: 2, name: "<b>" }).length >= 2);
  assert.throws(() => renderAll({ version: 1, name: "x", parts: {} }), HumanError);
  assert.deepEqual(PARTS, ["leg", "arm", "torso", "head"]);
});

test("部位圖形沿用貼紙的上限與安全規則 (超大座標被擋)", async () => {
  const spec = await read("humanoid/blue_worker.json");
  spec.parts.leg.front[0][2][1] = [2e7, 0];
  assert.ok(validateHuman(spec).some((e) => e.startsWith("parts.leg.front[0].pts[1]")));
});
