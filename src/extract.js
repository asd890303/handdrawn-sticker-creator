// 從貼上的文字取出 JSON。AI 常把 JSON 包在 ``` 程式碼框裡, 或在前後加說明; 這些文字不是規格的一部分,
// 取出來可以讓使用者不用為了「只要 JSON」再問一次 AI (多問一次就是多花一次 token)。
// 回傳 { json, removed } (removed 是被丟掉的字元數); 整段本來就是 JSON 回傳 removed = 0; 找不到合法的 JSON 回傳 null。
const parses = (s) => { try { JSON.parse(s); return true; } catch { return false; } };

export function extractJson(text) {
  const t = String(text).trim();
  if (parses(t)) return { json: t, removed: String(text).length - t.length };
  const candidates = [];
  for (const m of t.matchAll(/```[A-Za-z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```/g)) candidates.push(m[1]);
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) candidates.push(t.slice(a, b + 1));
  for (const c of candidates) {
    const j = c.trim();
    if (j.startsWith("{") && parses(j)) return { json: j, removed: String(text).length - j.length };
  }
  return null;
}
