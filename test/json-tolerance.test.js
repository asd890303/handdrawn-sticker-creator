// AI 回覆的 JSON 常見小毛病的容錯 (extract.js), 以及貼紙的陣列簡寫 (shorthand.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { expandSpec, extractJson, parseLoose, renderSvg, repairJson, validateSpec } from "../src/index.js";

const read = async (f) => JSON.parse(await readFile(new URL(`../${f}`, import.meta.url), "utf8"));
const fixed = (text) => JSON.parse(repairJson(text).text);

test("合法的 JSON 原樣不動 (不修、不回報)", () => {
  const text = '{ "a": [1, 2, {"b": "x y"}], "c": "it\'s", "d": true, "e": null }';
  assert.deepEqual(repairJson(text).fixes, repairJson(text).fixes);
  const r = parseLoose(text);
  assert.deepEqual(r.fixes, []);
  assert.equal(r.text, text);
});

test("彎引號 / 全形引號 → 半形雙引號 (錯誤訊息 position 1 的常見原因)", () => {
  const text = "{“version”: 1, “name”: “x”}";
  assert.throws(() => JSON.parse(text), /position 1/);
  assert.deepEqual(fixed(text), { version: 1, name: "x" });
  assert.deepEqual(repairJson(text).fixes, ["彎引號 / 全形引號"]);
  assert.deepEqual(fixed("{＂a＂: ＂b＂}"), { a: "b" });
  assert.deepEqual(fixed("{„a“: „b“}"), { a: "b" });
});

test("單引號、沒加引號的欄位名稱、註解、結尾多餘逗號", () => {
  assert.deepEqual(fixed("{'a': 'b', 'c': [1, 2]}"), { a: "b", c: [1, 2] });
  assert.deepEqual(fixed("{version: 1, name: \"x\", ok: true, none: null}"), { version: 1, name: "x", ok: true, none: null });
  assert.deepEqual(fixed('{\n  // 角色\n  "a": 1, /* 說明 */ "b": 2\n}'), { a: 1, b: 2 });
  assert.deepEqual(fixed('{"a": [1, 2, ], "b": {"c": 1,},}'), { a: [1, 2], b: { c: 1 } });
  assert.deepEqual(repairJson("{'a': 1,}").fixes.sort(), ["單引號", "結尾多餘的逗號"].sort());
});

test("全形逗號與冒號、不可見字元、特殊空白", () => {
  assert.deepEqual(fixed('{"a"：1，"b"：2}'), { a: 1, b: 2 });
  assert.deepEqual(fixed('﻿{"a":​1}'), { a: 1 });
  assert.deepEqual(fixed('{"a": 1,　"b": 2}'), { a: 1, b: 2 });
});

test("字串內容不會被誤改: 註解符號、逗號、冒號、跳脫、內含的雙引號", () => {
  assert.deepEqual(fixed("{'url': 'a//b', 'x': 'p, q: r', 'e': 'it\\'s'}"), { url: "a//b", x: "p, q: r", e: "it's" });
  assert.deepEqual(fixed("{'a': 'say \"hi\"'}"), { a: 'say "hi"' });
  assert.deepEqual(fixed('{“a”: "line\\nbreak"}'), { a: "line\nbreak" });
});

test("修不好就丟出原本的錯誤", () => {
  assert.throws(() => parseLoose("{壞掉"), SyntaxError);
  assert.throws(() => parseLoose('{"a": }'), /JSON/);
  assert.throws(() => parseLoose("{'a': 'b"), SyntaxError);
});

test("貼上 AI 回覆: 去掉程式碼框與前後說明, 修好小毛病", () => {
  const json = '{"version":1,"name":"x","parts":{}}';
  assert.deepEqual(extractJson(json), { json, removed: 0, fixes: [] });
  assert.deepEqual(extractJson(`  ${json}\n`), { json, removed: 0, fixes: [] });
  const fenced = "這是你要的角色：\n```json\n" + json + "\n```\n還要調整的話跟我說！";
  const r = extractJson(fenced);
  assert.equal(r.json, json);
  assert.equal(r.removed, fenced.trim().length - json.length);
  assert.deepEqual(r.fixes, []);
  assert.equal(extractJson("好的，" + json + " 以上").json, json);
  assert.equal(extractJson("```\n" + json + "\n```").json, json);
  assert.equal(extractJson("```JSON\r\n" + json + "\r\n```").json, json);
  assert.equal(extractJson('說明 {"a": {"b": 1}} 結尾').json, '{"a": {"b": 1}}');
  // 程式碼框裡又有彎引號
  const both = extractJson("```json\n{“version”: 1, “name”: “x”,}\n```");
  assert.deepEqual(JSON.parse(both.json), { version: 1, name: "x" });
  assert.ok(both.removed > 0 && both.fixes.length === 2);
});

test("貼上的內容找不到 JSON 物件時回傳 null (交給編輯區照一般方式處理)", () => {
  assert.equal(extractJson("只有一些文字"), null);
  assert.equal(extractJson(""), null);
  assert.equal(extractJson("```json\n{壞掉\n```"), null);
  assert.equal(extractJson("[1, 2, 3]"), null, "只接受物件");
});

// ---------- 貼紙的陣列簡寫 ----------
const sticker = (shapes) => ({ version: 1, name: "t", canvas: { w: 64, h: 64, scale: 1 }, palette: { a: "#f00" }, shapes });

test("貼紙簡寫: 展開後和物件寫法畫出完全相同的圖", () => {
  const full = [
    { t: "rect", x0: -5, y0: -5, x1: 5, y1: 5, fill: "$a", w: 2 },
    { t: "poly", pts: [[0, -8], [8, 6], [-8, 6]], fill: "#0f0", w: 2.4, box: false },
    { t: "ell", cx: 1, cy: 2, rx: 3, ry: 4, fill: "#00f" },
    { t: "line", pts: [[-9, 0], [9, 0]], w: 2, col: "#111", amp: 0.1 },
    { t: "tube", pts: [[0, 0], [5, 5]], w: 3, col: "#7fd8ff" },
    { t: "dot", x: 2, y: 2, r: 2, fill: "#fff", sw: 0 },
  ];
  const short = [
    ["rect", "$a", -5, -5, 5, 5, 2],
    ["poly", "#0f0", [[0, -8], [8, 6], [-8, 6]], 2.4, false],
    ["ell", "#00f", 1, 2, 3, 4],
    ["line", [[-9, 0], [9, 0]], 2, "#111", 0.1],
    ["tube", [[0, 0], [5, 5]], 3, "#7fd8ff"],
    ["dot", "#fff", 2, 2, 2, 0],
  ];
  assert.deepEqual(validateSpec(sticker(short)), []);
  assert.deepEqual(expandSpec(sticker(short)).shapes, full.map((s) => ({ ...s })));
  assert.equal(renderSvg(sticker(short)).svg, renderSvg(sticker(full)).svg);
  // 兩種寫法可以混用, group / repeat 的 children 也能用簡寫
  const mixed = [full[0], ["dot", "#fff", 0, 0, 1], { t: "repeat", n: 2, dx: 5, children: [["dot", ["#f00", "#00f"], 0, 0, 1]] }];
  assert.deepEqual(validateSpec(sticker(mixed)), []);
});

test("貼紙簡寫寫錯: 指出路徑與正確格式, 後面圖形的索引不位移", () => {
  const errs = validateSpec(sticker([["dot", "#fff"], { t: "dot", x: 0, y: 0, r: 1, fill: "$nope" }, ["star", 1], ["rect", "#fff", 1, 2, 3, 4, 5, 6]]));
  assert.ok(errs.some((e) => e.startsWith("shapes[0]:") && e.includes('["dot", fill, x, y, r, sw?]')), errs.join("\n"));
  assert.ok(errs.some((e) => e.startsWith("shapes[1].fill:")), "第 1 個圖形的錯誤路徑沒有位移");
  assert.ok(errs.some((e) => e.startsWith("shapes[2]:") && e.includes("rect / poly / ell / line / tube / dot")));
  assert.ok(errs.some((e) => e.startsWith("shapes[3]:") && e.includes('["rect", fill, x0, y0, x1, y1, w?]')));
});

test("貼紙範例檔 (物件寫法) 不受簡寫影響", async () => {
  for (const f of ["apple", "truck", "kitten"]) {
    const spec = await read(`examples/${f}.json`);
    assert.deepEqual(validateSpec(spec), [], f);
    assert.equal(renderSvg(spec).svg, renderSvg(expandSpec(spec)).svg, f);
  }
});
