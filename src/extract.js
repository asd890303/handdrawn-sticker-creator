// 讀取 AI 回覆的 JSON。AI 的 JSON 常有小毛病: 包在 ``` 程式碼框裡、前後有說明、引號是彎引號 “ ” 或單引號、
// 欄位名稱沒加引號、有註解、結尾多一個逗號。每個毛病都要使用者再問一次 AI, 多問一次就是多花一次 token,
// 所以這裡先自己修好 (只在標準 JSON 解析失敗時才動手, 合法的 JSON 原樣不動), 並回報修了什麼。
const DQ = new Set(['"', "“", "”", "„", "‟", "＂"]);
const SQ = new Set(["'", "‘", "’", "‚", "‛"]);
const INVISIBLE = /[​-‍⁠﻿]/g;
const ODD_SPACE = /[  -   　]/g;
const WORD = /[A-Za-z0-9_$]/;

// 修正常見的 JSON 小毛病; 回傳 { text, fixes } (fixes 是修了哪幾類, 沒有毛病時是空陣列)
export function repairJson(input) {
  const fixes = new Set();
  let src = String(input);
  if (INVISIBLE.test(src)) { INVISIBLE.lastIndex = 0; src = src.replace(INVISIBLE, ""); fixes.add("不可見字元"); }
  INVISIBLE.lastIndex = 0;
  if (ODD_SPACE.test(src)) { ODD_SPACE.lastIndex = 0; src = src.replace(ODD_SPACE, " "); fixes.add("特殊空白"); }
  ODD_SPACE.lastIndex = 0;

  let out = "", i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (DQ.has(c) || SQ.has(c)) {   // 字串: 統一改成半形雙引號
      const closers = c === '"' ? new Set(['"']) : c === "'" ? new Set(["'"]) : DQ.has(c) ? DQ : SQ;
      if (c !== '"') fixes.add(DQ.has(c) ? "彎引號 / 全形引號" : "單引號");
      let j = i + 1, body = "";
      while (j < n && !closers.has(src[j])) {
        if (src[j] === "\\" && j + 1 < n) { body += src[j] + src[j + 1]; j += 2; continue; }   // 保留跳脫
        body += src[j] === '"' ? '\\"' : src[j];
        j++;
      }
      if (j >= n) { out += src.slice(i); break; }   // 沒有結尾引號: 原樣交給 JSON.parse 報錯
      out += `"${body.replace(/\\'/g, "'")}"`;
      i = j + 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {   // 單行註解
      while (i < n && src[i] !== "\n") i++;
      fixes.add("註解");
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {   // 區塊註解
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
      fixes.add("註解");
      continue;
    }
    if (c === "，" || c === "：") {   // 全形逗號、冒號
      out += c === "，" ? "," : ":";
      fixes.add("全形標點");
      i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {   // 沒加引號的欄位名稱 (後面接冒號); true / false / null 原樣保留
      let j = i;
      while (j < n && WORD.test(src[j])) j++;
      const word = src.slice(i, j);
      let k = j;
      while (k < n && /\s/.test(src[k])) k++;
      if (src[k] === ":") { out += `"${word}"`; fixes.add("沒加引號的欄位名稱"); } else out += word;
      i = j;
      continue;
    }
    if (c === "}" || c === "]") {   // 結尾多餘的逗號
      out = out.trimEnd();
      if (out.endsWith(",")) { out = out.slice(0, -1); fixes.add("結尾多餘的逗號"); }
    }
    out += c;
    i++;
  }
  return { text: out, fixes: [...fixes] };
}

// 標準 JSON 解析; 失敗時先修正再解析, 都失敗就丟出原本的錯誤。回傳 { value, fixes, text }
export function parseLoose(input) {
  try {
    return { value: JSON.parse(input), fixes: [], text: String(input) };
  } catch (e) {
    const r = repairJson(input);
    if (r.fixes.length) {
      try { return { value: JSON.parse(r.text), fixes: r.fixes, text: r.text }; } catch { /* 修了也不行, 丟出原本的錯誤 */ }
    }
    throw e;
  }
}

const tryLoose = (s) => { try { return parseLoose(s); } catch { return null; } };

// 從貼上的文字取出 JSON: 去掉程式碼框與前後說明、修好小毛病。
// 回傳 { json, removed, fixes } (removed 是前後被丟掉的字元數, 不含頭尾空白); 整段本來就是合法 JSON 時 removed = 0、fixes 是空的; 找不到時回傳 null。
export function extractJson(text) {
  const raw = String(text);
  const t = raw.trim();
  const candidates = [t];
  for (const m of t.matchAll(/```[A-Za-z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```/g)) candidates.push(m[1]);
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) candidates.push(t.slice(a, b + 1));
  for (const c of candidates) {
    const s = c.trim();
    if (!s.startsWith("{")) continue;
    const r = tryLoose(s);
    if (r && r.value && typeof r.value === "object") return { json: r.fixes.length ? r.text : s, removed: t.length - s.length, fixes: r.fixes };
  }
  return null;
}
