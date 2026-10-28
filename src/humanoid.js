// 人形繪圖 (Beta): 一份「部位圖形」JSON → 正面 / 背面 / 側面的走路逐幀圖。
// JSON 為 腿 / 手臂 / 身體 / 頭 各寫一組貼紙圖形 (rect、poly、ell、line、tube、dot、group、repeat, 和貼紙同一套);
// 工具固定處理骨架: 左右鏡像、關節擺動、走路起伏, 再交給 renderSvg 畫出抖動外框與白色描邊。
// 不做受傷、衝刺、死亡動作、配件與腳底光暈。
//
// 為了讓 AI 的回覆短一點 (回覆越長, 使用者花的 token 越多), 輸入格式有三個省字的做法, 結果和完整寫法完全相同:
//   1. 腿 / 手臂 / 身體 的 back 可以省略, 沿用 front (頭的 back 沒有臉, 一定要自己寫)
//   2. 人形裡的預設值: poly 的 box 預設 false、dot 的 sw 預設 0、line 的 amp 預設 0.6
//   3. 常用圖形可以用陣列簡寫: ["poly", fill, pts, w?]、["ell", fill, cx, cy, rx, ry, w?]、["line", pts, w?, col?]、["dot", fill, x, y, r]
import { renderSvg } from "./render.js";
import { NAME, validateSpec } from "./spec.js";

export const VIEWS = ["front", "back", "side"];
export const PARTS = ["leg", "arm", "torso", "head"];
export const ACTIONS = { walk: 6 };
// 圖集: 每格 128, 6 欄, 3 列 (正面 / 背面 / 側面各一列), 共 18 格 → 768×384
export const SHEET = { cell: 128, cols: 6, rows: 3, width: 768, height: 384 };
// JSON 壓縮後超過這個字元數就提醒 (基本人形約 2 千字元, 文件要求 AI 控制在 3000 以內)
export const SIZE_HINT = 4000;

const KEYS = ["version", "name", "palette", "shade", "parts"];
const BACK_FROM_FRONT = ["leg", "arm", "torso"];

export class HumanError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.errors = errors;
  }
}

// ---------- 省字: 預設值與陣列簡寫 ----------
const DEFAULTS = { poly: { box: false }, dot: { sw: 0 }, line: { amp: 0.6 } };
// 簡寫: 陣列第一個元素是種類, 後面依序是欄位值 (req 個必填, 其餘可省略)
const SHORT = {
  poly: { args: ["fill", "pts", "w"], req: 2 },
  ell: { args: ["fill", "cx", "cy", "rx", "ry", "w"], req: 5 },
  line: { args: ["pts", "w", "col"], req: 1 },
  dot: { args: ["fill", "x", "y", "r"], req: 4 },
};
const SHORT_SIGNATURE = {
  poly: '["poly", fill, pts, w?]',
  ell: '["ell", fill, cx, cy, rx, ry, w?]',
  line: '["line", pts, w?, col?]',
  dot: '["dot", fill, x, y, r]',
};
// 簡寫寫錯時佔位用的合法圖形, 讓後面圖形的索引不位移 (錯誤已經另外記下)
const PLACEHOLDER = { t: "dot", x: 0, y: 0, r: 1, fill: "none" };

const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);

// 把一個圖形整理成完整寫法: 展開簡寫、補上人形預設值; 群組與重複的 children 也一併處理
function normalizeShape(shape, path, errs) {
  let s = shape;
  if (Array.isArray(shape)) {
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
    s = { t: tag };
    def.args.forEach((k, i) => { if (vals[i] !== undefined) s[k] = vals[i]; });
  }
  if (!isObj(s)) return s;   // 交給貼紙驗證回報
  const out = typeof s.t === "string" && Object.hasOwn(DEFAULTS, s.t) ? { ...DEFAULTS[s.t], ...s } : { ...s };
  if (Array.isArray(out.children)) out.children = out.children.map((c, i) => normalizeShape(c, `${path}.children[${i}]`, errs));
  return out;
}

// 驗證一組圖形 (貼紙規格的驗證), 錯誤路徑從 shapes[...] 改寫成 parts.<部位>.<視角>[...]; 回傳整理後的圖形
function checkShapes(path, shapes, palette, errs, missing) {
  if (shapes === undefined) { errs.push(`${path}: ${missing}`); return undefined; }
  if (!Array.isArray(shapes) || !shapes.length) { errs.push(`${path}: 需為至少一個圖形的陣列`); return undefined; }
  const list = shapes.map((s, i) => normalizeShape(s, `${path}[${i}]`, errs));
  const probe = { version: 1, name: "probe", canvas: { w: SHEET.cell, h: SHEET.cell }, palette, shapes: list };
  for (const e of validateSpec(probe)) if (e.startsWith("shapes")) errs.push(path + e.slice("shapes".length));
  return list;
}

// 驗證並整理: 回傳 { errors, parts } (parts 是補完 back、展開簡寫、補上預設值的完整寫法)
function prepare(spec) {
  const errs = [];
  if (!isObj(spec)) return { errors: ["根節點必須是物件"] };
  if (spec.version !== 1) errs.push("version: 必須是 1");
  if (typeof spec.name !== "string" || !NAME.test(spec.name)) errs.push("name: 必填, 1~64 字元, 不可含 < > \" & ' \\");
  if (spec.shade !== undefined && typeof spec.shade !== "boolean") errs.push("shade: 需為 true 或 false");
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) errs.push(`${k}: 未知的欄位`);

  const palette = spec.palette ?? {};
  // 調色盤只檢查一次 (用空的圖形清單借貼紙的驗證)
  for (const e of validateSpec({ version: 1, name: "probe", canvas: { w: SHEET.cell, h: SHEET.cell }, palette, shapes: [] })) if (e.startsWith("palette")) errs.push(e);

  const raw = spec.parts;
  if (!isObj(raw)) return { errors: [...errs, "parts: 必填, 需為物件"] };
  for (const k of Object.keys(raw)) if (!PARTS.includes(k)) errs.push(`parts.${k}: 未知的部位 (只有 ${PARTS.join(" / ")})`);
  const parts = {};
  for (const part of PARTS) {
    const p = raw[part];
    if (!isObj(p)) { errs.push(`parts.${part}: 必填, 需為物件`); continue; }
    for (const k of Object.keys(p)) if (!VIEWS.includes(k)) errs.push(`parts.${part}.${k}: 未知的欄位`);
    parts[part] = {};
    for (const view of VIEWS) {
      const fallback = view === "back" && BACK_FROM_FRONT.includes(part);   // 沒寫 back 就沿用 front
      const missing = view === "back" && part === "head" ? "必填 (背面沒有臉, 要自己寫一組只有頭和頭髮的)" : "必填, 需為圖形陣列";
      parts[part][view] = checkShapes(`parts.${part}.${view}`, fallback && p.back === undefined ? p.front : p[view], palette, errs, missing);
    }
  }
  return { errors: errs, parts };
}

export const validateHuman = (spec) => prepare(spec).errors;

// 不影響畫圖、但會讓 AI 回覆變長的寫法; 回傳提醒文字陣列 (不擋下)
export function humanWarnings(spec) {
  const out = [];
  if (!isObj(spec) || !isObj(spec.parts)) return out;
  for (const part of BACK_FROM_FRONT) {
    const p = spec.parts[part];
    if (isObj(p) && p.back !== undefined && JSON.stringify(p.back) === JSON.stringify(p.front)) out.push(`parts.${part}.back 和 front 相同, 可以省略`);
  }
  const n = JSON.stringify(spec).length;
  if (n > SIZE_HINT) out.push(`JSON 偏長 (${n} 字元, 基本人形約 2000): 用陣列簡寫、省略 back 可以縮短`);
  return out;
}

// ---------- 骨架與走路 ----------
const FOOT = 53;      // 腳底 y
const LEG_LEN = 36;   // 側面腿: 髖 (y=12) 到腳 (y=48) 的長度, 用來把腳的前後位置換成擺動角度
const ARM_LEN = 33;   // 側面手臂: 肩 (y=-21) 到手 (y=12)

// 相位連續計算 (4 格時經過格兩張一樣, 左右走看起來會卡)
function phase(th) {
  const c = Math.cos(th), s = Math.sin(th);
  return {
    sa: 3 + 10 * c, sb: 3 - 10 * c,                     // 側面: 兩腳的腳尖 x
    la: Math.max(0, -s) * 5, lb: Math.max(0, s) * 5,    // 往前擺的那隻腳抬高
    arm: -6 * c,                                        // 手臂和腳反向擺
    bl: Math.max(0, s) * 5, br: Math.max(0, -s) * 5,    // 正面 / 背面: 左右腳輪流抬
    bob: -2 * Math.abs(s),
  };
}

const grp = (children, transform) => ({ t: "group", transform, children });
const deg = (rad) => +((rad * 180) / Math.PI).toFixed(2);
const r2 = (n) => +n.toFixed(2);

// 走路第 i 格 (shape 清單), 腳底在 y = 53
function frameShapes(parts, view, i) {
  const th = (2 * Math.PI * i) / ACTIONS.walk;
  const G = phase(th);
  let body;
  if (view === "side") {
    // 兩隻腳: 髖固定 (後腳 x=-1, 前腳 x=3), 依腳尖位置轉一個角度, 再抬高
    const leg = (hx, fx, lift) => grp(parts.leg.side, { tx: hx - 1, ty: -r2(lift), rot: -deg(Math.atan2(fx - hx, LEG_LEN)), px: 1, py: 12 });
    body = [
      leg(-1, G.sb, G.lb), leg(3, G.sa, G.la),
      ...parts.torso.side,
      grp(parts.arm.side, { rot: -deg(Math.atan2(G.arm, ARM_LEN)), px: 0, py: -21 }),
      ...parts.head.side,
    ];
  } else {
    // 正面 / 背面: 右邊是左邊的鏡像; 抬腳 / 手臂前後擺 = 整個部位往上移一點 (身體畫在腿和手臂上面, 接縫看不到)
    const al = Math.abs(G.arm / 2), ar = Math.abs(-G.arm / 2);
    body = [
      grp(parts.leg[view], { ty: -r2(G.bl) }), grp(parts.leg[view], { sx: -1, ty: -r2(G.br) }),
      grp(parts.arm[view], { ty: -r2(al * 0.6) }), grp(parts.arm[view], { sx: -1, ty: -r2(ar * 0.6) }),
      ...parts.torso[view],
      ...parts.head[view],
    ];
  }
  return [grp(body, { ty: r2(G.bob) })];
}

// 圖集順序: 正面 0-5 / 背面 6-11 / 側面 12-17 (每個視角 6 格走路)
export const FRAMES = VIEWS.flatMap((view) => Array.from({ length: ACTIONS.walk }, (_, i) => ({ action: "walk", view, i })));

const STYLE = { amp: 1.8, off: [2.2, 1.6], w: 3.6, pen: "#111" };

function draw(spec, parts, view, i, seed, id) {
  return renderSvg(
    {
      version: 1,
      // 同一個角色同一個視角固定用同一個名字當亂數種子, 每格抖動一致、不會閃
      name: `${spec.name}_${view}`,
      canvas: { w: SHEET.cell, h: SHEET.cell, scale: 0.82, foot: FOOT, baseY: 116.5, rim: true, shade: spec.shade ?? true },
      palette: spec.palette ?? {},
      style: STYLE,
      shapes: frameShapes(parts, view, i),
    },
    { seed, id },
  );
}

function ready(spec) {
  const { errors, parts } = prepare(spec);
  if (errors.length) throw new HumanError(errors);
  return parts;
}

// 單格 SVG
export function renderFrame(spec, view, i, { seed = 0, id = "" } = {}) {
  return draw(spec, ready(spec), view, i, seed, id);
}

// 全部 18 格 [{ action, view, i, svg }]
export function renderAll(spec, { seed = 0, id = "" } = {}) {
  const parts = ready(spec);
  return FRAMES.map((f, k) => ({ ...f, svg: draw(spec, parts, f.view, f.i, seed, `${id}f${k}-`).svg }));
}

// 18 格排成一張 768×384 的 SVG (每格是一個內嵌的 <svg>), 預覽、複製 SVG、輸出 PNG 都用它; warnings 是不擋下的提醒
export function renderSheet(spec, { seed = 0, id = "" } = {}) {
  const frames = renderAll(spec, { seed, id });
  const { cell, cols, width, height } = SHEET;
  const body = frames.map((f, k) => f.svg.replace("<svg ", `<svg x="${(k % cols) * cell}" y="${Math.floor(k / cols) * cell}" `)).join("");
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`, width, height, frames, warnings: humanWarnings(spec) };
}
