// 人形 JSON 的省字寫法 (省略 back、預設值、陣列簡寫) 必須和完整寫法畫出完全相同的結果; 貼上時去掉 AI 回覆的多餘文字
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SIZE_HINT, extractJson, humanWarnings, renderAll, validateHuman } from "../src/index.js";

const read = async (f) => JSON.parse(await readFile(new URL(`../${f}`, import.meta.url), "utf8"));
const clone = (x) => JSON.parse(JSON.stringify(x));
const svgs = (spec) => renderAll(spec, { seed: 3 }).map((f) => f.svg);

// 把精簡寫法展開成完整寫法 (測試用, 刻意和引擎分開寫, 確認兩邊一致)
function expandFull(spec) {
  const full = clone(spec);
  const NAMES = { poly: ["fill", "pts", "w"], ell: ["fill", "cx", "cy", "rx", "ry", "w"], line: ["pts", "w", "col"], dot: ["fill", "x", "y", "r"] };
  const one = (s) => {
    if (!Array.isArray(s)) return s;
    const o = { t: s[0] };
    NAMES[s[0]].forEach((k, i) => { if (s[i + 1] !== undefined) o[k] = s[i + 1]; });
    if (o.t === "poly") o.box = false;
    if (o.t === "dot") o.sw = 0;
    if (o.t === "line") o.amp = 0.6;
    return o;
  };
  for (const p of Object.values(full.parts)) for (const v of Object.keys(p)) p[v] = p[v].map(one);
  for (const part of ["leg", "arm", "torso"]) full.parts[part].back = clone(full.parts[part].front);
  return full;
}

test("範例用精簡寫法: 省略 back、用陣列簡寫, 結果和完整寫法逐格相同", async () => {
  for (const name of ["blue_worker", "pink_sales", "orange_courier", "white_chef"]) {
    const compact = await read(`examples/humanoid/${name}.json`);
    for (const part of ["leg", "arm", "torso"]) assert.equal(compact.parts[part].back, undefined, `${name}.${part}.back 應該省略`);
    assert.ok(Array.isArray(compact.parts.leg.front[0]), "範例使用陣列簡寫");
    assert.deepEqual(svgs(compact), svgs(expandFull(compact)), name);
    assert.deepEqual(humanWarnings(compact), [], name);
  }
});

test("省略 back = 沿用 front; 明確寫出相同的 back 結果一樣, 但會提醒可以省略", async () => {
  const compact = await read("examples/humanoid/blue_worker.json");
  const explicit = clone(compact);
  for (const part of ["leg", "arm", "torso"]) explicit.parts[part].back = clone(explicit.parts[part].front);
  assert.deepEqual(svgs(explicit), svgs(compact));
  assert.deepEqual(humanWarnings(explicit).map((w) => w.split(" ")[0]), ["parts.leg.back", "parts.arm.back", "parts.torso.back"]);
  // 背面跟正面不同時要自己寫, 也不會被提醒
  const different = clone(compact);
  different.parts.torso.back = [["poly", "$pants", [[-9, -25], [9, -25], [15, 15], [-15, 15]]]];
  assert.notDeepEqual(svgs(different).slice(6, 12), svgs(compact).slice(6, 12));
  assert.ok(!humanWarnings(different).some((w) => w.startsWith("parts.torso.back")));
});

test("頭的 back 一定要寫 (背面沒有臉)", async () => {
  const spec = clone(await read("examples/humanoid/blue_worker.json"));
  delete spec.parts.head.back;
  const errs = validateHuman(spec);
  assert.ok(errs.some((e) => e.startsWith("parts.head.back:") && e.includes("背面沒有臉")), errs.join("\n"));
});

test("預設值可以被覆寫: 明確寫 box: true / sw / amp 時照寫的畫", async () => {
  const spec = clone(await read("examples/humanoid/blue_worker.json"));
  const base = svgs(spec)[0];
  spec.parts.torso.front[0] = { t: "poly", pts: spec.parts.torso.front[0][2], fill: "$top", box: true };
  assert.notEqual(svgs(spec)[0], base, "box: true 會改變輪廓");
  const spec2 = clone(await read("examples/humanoid/blue_worker.json"));
  spec2.parts.head.front[5] = { t: "dot", x: -6, y: -40.5, r: 2.2, fill: "#111", sw: 1.6 };
  assert.notEqual(svgs(spec2)[0], base, "sw 預設 0, 寫 1.6 會多出外框");
});

test("簡寫寫錯會指出路徑與正確格式, 其他圖形的索引不位移", async () => {
  const spec = clone(await read("examples/humanoid/blue_worker.json"));
  spec.parts.leg.front[1] = ["poly", "$shoe"];
  spec.parts.arm.front[0] = ["star", "$top", [[0, 0]]];
  spec.parts.torso.front[0] = ["dot", "$top", 1, 2, 3, 4, 5];
  spec.parts.head.front[2] = ["ell", "$skin", 1, 2];
  spec.parts.head.front[3] = ["dot", "$nope", 0, 0, 1];   // 簡寫本身正確, 但顏色名稱不存在: 路徑仍然對得上
  const errs = validateHuman(spec);
  assert.ok(errs.some((e) => e.startsWith("parts.leg.front[1]:") && e.includes('["poly", fill, pts, w?]')), errs.join("\n"));
  assert.ok(errs.some((e) => e.startsWith("parts.arm.front[0]:") && e.includes("poly / ell / line / dot")));
  assert.ok(errs.some((e) => e.startsWith("parts.torso.front[0]:") && e.includes('["dot", fill, x, y, r]')));
  assert.ok(errs.some((e) => e.startsWith("parts.head.front[2]:") && e.includes('["ell"')));
  assert.ok(errs.some((e) => e.startsWith("parts.head.front[3].fill:")));
});

test("group / repeat 的 children 也能用簡寫與預設值", async () => {
  const spec = clone(await read("examples/humanoid/blue_worker.json"));
  spec.parts.head.front.push({ t: "group", transform: { tx: 1 }, children: [["dot", "#111", 0, -45, 1], { t: "repeat", n: 2, dx: 3, children: [["dot", "#111", 0, -48, 1]] }] });
  assert.deepEqual(validateHuman(spec), []);
  spec.parts.head.front.at(-1).children[0] = ["dot", "#111"];
  assert.ok(validateHuman(spec).some((e) => e.startsWith(`parts.head.front[${spec.parts.head.front.length - 1}].children[0]:`)));
});

test("精簡寫法的範例壓縮後在 3000 字元以內; 太長會提醒 (不擋下)", async () => {
  for (const name of ["blue_worker", "pink_sales", "orange_courier", "white_chef"]) {
    const n = JSON.stringify(await read(`examples/humanoid/${name}.json`)).length;
    assert.ok(n <= 3000, `${name} 壓縮後 ${n} 字元`);
  }
  const spec = clone(await read("examples/humanoid/blue_worker.json"));
  spec.parts.head.front.push(...Array.from({ length: 300 }, (_, i) => ["dot", "#111", i % 50, -50, 1]));
  assert.ok(JSON.stringify(spec).length > SIZE_HINT);
  assert.deepEqual(validateHuman(spec), [], "太長只是提醒, 仍然能畫");
  assert.ok(humanWarnings(spec).some((w) => w.startsWith("JSON 偏長")));
});

test("貼上 AI 回覆: 去掉程式碼框與前後說明, 只留 JSON", () => {
  const json = '{"version":1,"name":"x","parts":{}}';
  assert.deepEqual(extractJson(json), { json, removed: 0 });
  assert.deepEqual(extractJson(`  ${json}\n`), { json, removed: 3 });
  const fenced = "這是你要的角色：\n```json\n" + json + "\n```\n還要調整的話跟我說！";
  const r = extractJson(fenced);
  assert.equal(r.json, json);
  assert.equal(r.removed, fenced.length - json.length);
  assert.equal(extractJson("好的，" + json + " 以上").json, json);
  assert.equal(extractJson("```\n" + json + "\n```").json, json);
  assert.equal(extractJson("```JSON\r\n" + json + "\r\n```").json, json);
  assert.equal(extractJson('說明 {"a": {"b": 1}} 結尾').json, '{"a": {"b": 1}}');
});

test("貼上的內容找不到合法 JSON 時回傳 null (交給編輯區照一般方式處理)", () => {
  assert.equal(extractJson("只有一些文字"), null);
  assert.equal(extractJson('{"a": 1,}'), null);
  assert.equal(extractJson(""), null);
  assert.equal(extractJson("```json\n{壞掉\n```"), null);
});
