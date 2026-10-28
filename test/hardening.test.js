// 安全與一致性檢查: 超大座標、原型鏈名稱、壞掉的欄位型別、本機伺服器路徑穿越、人形文件與 skill 同步、介面 key。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { renderSvg, SpecError, validateHuman, validateSpec } from "../src/index.js";

const base = { version: 1, name: "t", canvas: { w: 64, h: 64 } };
const spec = (shapes, extra = {}) => ({ ...base, shapes, ...extra });
const read = (f) => readFile(new URL(`../${f}`, import.meta.url), "utf8");

test("座標與長度有上限, 超長的線不會讓繪圖卡住", () => {
  const huge = spec([{ t: "line", pts: [[0, 0], [2e7, 0]] }]);
  assert.ok(validateSpec(huge).some((e) => e.includes("pts[1]")));
  assert.ok(validateSpec(spec([{ t: "rect", x0: 0, y0: 0, x1: 1e9, y1: 5, fill: "#fff" }])).length > 0);
  assert.ok(validateSpec(spec([{ t: "group", transform: { tx: 1e9 }, children: [] }])).length > 0);
  assert.deepEqual(validateSpec(spec([{ t: "line", pts: [[0, 0], [9000, 0]] }])), []);
  const t0 = Date.now();
  renderSvg(spec([{ t: "line", pts: [[0, 0], [9999, 9999]] }]));
  assert.ok(Date.now() - t0 < 1000, "最大座標的線應該很快畫完");
});

test("圖形種類與調色盤只認自己定義的名字 (不吃原型鏈)", () => {
  for (const t of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.ok(validateSpec(spec([{ t }])).length > 0, t);
  }
  const dot = (fill) => spec([{ t: "dot", x: 0, y: 0, r: 2, fill }]);
  for (const n of ["$constructor", "$toString", "$__proto__"]) assert.ok(validateSpec(dot(n)).length > 0, n);
  assert.deepEqual(validateSpec({ ...dot("$ink"), palette: { ink: "#123" } }), []);
});

test("欄位型別錯誤時回報錯誤, 不丟例外", () => {
  for (const style of [null, "x", [], 5]) assert.ok(validateSpec(spec([], { style })).some((e) => e.startsWith("style")), JSON.stringify(style));
  assert.ok(validateSpec(spec([{ t: "group", transform: null, children: [] }])).length > 0);
  assert.ok(validateSpec(spec([{ t: "repeat", n: 2, dx: [1, 2], children: [] }])).length > 0, "repeat 自己的 dx 不能是陣列");
  assert.deepEqual(validateSpec(spec([{ t: "repeat", n: 2, dx: 3, children: [{ t: "dot", x: [1, 2], y: 0, r: 1, fill: "#fff" }] }])), []);
});

test("顏色只接受合法的 hex (3 / 4 / 6 / 8 位)", () => {
  const dot = (fill) => validateSpec(spec([{ t: "dot", x: 0, y: 0, r: 2, fill }]));
  for (const ok of ["#fff", "#ffff", "#ffffff", "#ffffff80", "none"]) assert.deepEqual(dot(ok), [], ok);
  for (const bad of ["#fffff", "#fffffff", "#ff", "red", "url(#x)"]) assert.ok(dot(bad).length > 0, bad);
});

test("renderSvg 的 id 前綴只接受英數字、底線與連字號", () => {
  assert.doesNotThrow(() => renderSvg(spec([]), { id: "th-ab_1-" }));
  for (const id of ['a"b', "a b", "<x>", "a'b"]) assert.throws(() => renderSvg(spec([]), { id }), SpecError, id);
});

test("本機伺服器擋掉路徑穿越與公開目錄以外的檔案", async () => {
  const { startServer } = await import("../scripts/serve.mjs");
  const { server, port } = await startServer(0);
  const get = (path) => new Promise((resolve) => http.get({ host: "127.0.0.1", port, path }, (res) => { res.resume(); resolve(res.statusCode); }));
  try {
    assert.equal(await get("/web/humanoid.html"), 200);
    assert.equal(await get("/package.json"), 404);
    assert.equal(await get("/web/../package.json"), 404);
    assert.equal(await get("/web/%2e%2e/package.json"), 404);
    assert.equal(await get("/web/%2e%2e%2f%2e%2e/etc/passwd"), 404);
    assert.equal(await get("/%E0%A4%A"), 404);
  } finally {
    server.close();
  }
});

// ---------- 人形文件 / skill ----------
const humanDocs = ["docs/humanoid-prompt.md", "docs/humanoid-prompt.en.md"];

test("人形規格文件裡的 JSON 範例都通過 validateHuman", async () => {
  for (const f of humanDocs) {
    const text = await read(f);
    const blocks = [...text.matchAll(/```[a-z]*\n(\{[\s\S]*?\})\n```/g)].map((m) => m[1]);
    assert.ok(blocks.length >= 2, `${f} 應該至少有 2 個 JSON 範例`);
    for (const b of blocks) assert.deepEqual(validateHuman(JSON.parse(b)), [], `${f}: ${b}`);
  }
});

test("人形規格文件的欄位表中英一致, 且涵蓋全部欄位", async () => {
  const fields = async (f) => [...(await read(f)).matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1]);
  const [zh, en] = await Promise.all(humanDocs.map(fields));
  assert.deepEqual(zh, en);
  assert.deepEqual([...zh].sort(), ["hair", "hairStyle", "name", "pants", "shade", "shoe", "skin", "top", "version"]);
});

test("skills/handdrawn-humanoid/SKILL.md 與 docs/humanoid-prompt.md 同步 (不同步請執行 npm run skill)", async () => {
  const { buildHumanSkill, HUMAN_SKILL_PATH } = await import("../scripts/sync-skill.mjs");
  assert.equal(await readFile(HUMAN_SKILL_PATH, "utf8"), await buildHumanSkill());
});

test("人形頁用到的介面 key 都有翻譯, 且 STORE_KEYS 包含人形的儲存鍵", async () => {
  const { default: zh } = await import("../web/i18n/zh-TW.js");
  const { default: en } = await import("../web/i18n/en.js");
  const html = await read("web/humanoid.html");
  const js = (await read("web/humanoid.js")) + (await read("web/common.js"));
  const used = new Set([
    ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(";").map((p) => p.split(":")[1].trim())),
    ...[...js.matchAll(/\bt\("([^"]+)"/g)].map((m) => m[1]),
  ]);
  for (const key of used) {
    assert.ok(key in zh, `zh-TW 缺少 ${key}`);
    assert.ok(key in en, `en 缺少 ${key}`);
  }
  const { STORE_KEYS } = await import("../web/common.js").catch(() => ({ STORE_KEYS: null }));
  const keys = STORE_KEYS ?? [...(await read("web/common.js")).matchAll(/"(studio\.\w+)"/g)].map((m) => m[1]);
  for (const k of [...(await read("web/humanoid.js")).matchAll(/"(studio\.\w+)"/g)].map((m) => m[1])) assert.ok(keys.includes(k), `STORE_KEYS 缺少 ${k}`);
});
