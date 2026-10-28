// 圖形的陣列簡寫: AI 的回覆越短, 使用者花的 token 越少。簡寫只是換一種寫法, 展開後和物件寫法完全一樣,
// 之後的驗證與繪圖都只看展開後的完整寫法, 所以安全規則不變。
// 陣列第一個元素是種類, 後面依序是欄位值 (req 個必填, 其餘可省略; 中間要跳過的欄位寫 null):
//   ["rect", fill, x0, y0, x1, y1, w?]   ["poly", fill, pts, w?, box?]   ["ell", fill, cx, cy, rx, ry, w?]
//   ["line", pts, w?, col?, amp?]        ["tube", pts, w, col]           ["dot", fill, x, y, r, sw?]
export const SHORT = {
  rect: { args: ["fill", "x0", "y0", "x1", "y1", "w"], req: 5 },
  poly: { args: ["fill", "pts", "w", "box"], req: 2 },
  ell: { args: ["fill", "cx", "cy", "rx", "ry", "w"], req: 5 },
  line: { args: ["pts", "w", "col", "amp"], req: 1 },
  tube: { args: ["pts", "w", "col"], req: 3 },
  dot: { args: ["fill", "x", "y", "r", "sw"], req: 4 },
};

export const SHORT_SIGNATURE = Object.fromEntries(
  Object.entries(SHORT).map(([tag, d]) => [tag, `["${tag}", ${d.args.map((a, i) => (i < d.req ? a : `${a}?`)).join(", ")}]`]),
);

const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);

// 簡寫寫錯時佔位用的合法圖形, 讓後面圖形的索引不位移 (錯誤已經另外記下)
export const PLACEHOLDER = { t: "dot", x: 0, y: 0, r: 1, fill: "none" };

// 展開一個簡寫 (不是陣列就原樣回傳); 寫錯時把錯誤記進 errs 並回傳佔位圖形
export function expandShort(shape, path, errs) {
  if (!Array.isArray(shape)) return shape;
  const tag = shape[0];
  if (typeof tag !== "string" || !Object.hasOwn(SHORT, tag)) {
    errs.push(`${path}: 簡寫的第一個元素必須是 ${Object.keys(SHORT).join(" / ")}`);
    return PLACEHOLDER;
  }
  const def = SHORT[tag], vals = shape.slice(1);
  if (vals.length < def.req || vals.length > def.args.length) {
    errs.push(`${path}: 簡寫格式是 ${SHORT_SIGNATURE[tag]}`);
    return PLACEHOLDER;
  }
  const out = { t: tag };
  def.args.forEach((k, i) => { if (vals[i] !== undefined && vals[i] !== null) out[k] = vals[i]; });   // null = 略過這個欄位 (要寫後面的欄位又想用預設值時用)
  return out;
}

// 展開整棵圖形樹 (group / repeat 的 children 也處理); defaults 是種類 → 預設值 (人形用)
export function expandShapes(list, path, errs, defaults = {}) {
  if (!Array.isArray(list)) return list;
  return list.map((shape, i) => {
    const p = `${path}[${i}]`;
    const s = expandShort(shape, p, errs);
    if (!isObj(s)) return s;   // 交給貼紙驗證回報
    const out = typeof s.t === "string" && Object.hasOwn(defaults, s.t) ? { ...defaults[s.t], ...s } : { ...s };
    if (Array.isArray(out.children)) out.children = expandShapes(out.children, `${p}.children`, errs, defaults);
    return out;
  });
}

// 貼紙規格: 回傳 shapes 已展開的複本; 展開時的錯誤記進 errs
export function expandSpec(spec, errs = []) {
  if (!isObj(spec) || !Array.isArray(spec.shapes)) return spec;
  return { ...spec, shapes: expandShapes(spec.shapes, "shapes", errs) };
}
