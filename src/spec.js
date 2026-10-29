// JSON 規格驗證。輸入只能是資料, 數值與顏色逐欄檢查, 不執行任何程式碼, 也不會讓字串帶著標籤進 SVG。
import { GLYPHS } from "./engine/glyphs.js";
import { expandSpec } from "./shorthand.js";

// coord: 所有座標 / 長度類數字的絕對值上限; 沒有上限的話, 一條超長的線會讓外框插點多到卡死瀏覽器
export const LIMITS = { shapes: 2000, depth: 6, repeat: 200, pts: 200, text: 32, palette: 64, coord: 10000 };

// 只接受合法的 CSS hex 顏色 (3 / 4 / 6 / 8 位)
export const HEX = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR = /^(#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|none|\$[A-Za-z_]\w*)$/;
export const NAME = /^[^<>"&'\\]{1,64}$/;

// num / col: 可為單值, 在 repeat 內也可為陣列 (依迴圈序號取值)
const OPS = {
  rect: { req: ["x0", "y0", "x1", "y1", "fill"], num: ["x0", "y0", "x1", "y1", "w", "amp"], col: ["fill"] },
  poly: { req: ["pts", "fill"], num: ["w", "amp"], col: ["fill"], pts: 3 },
  ell: { req: ["cx", "cy", "rx", "ry", "fill"], num: ["cx", "cy", "rx", "ry", "w"], col: ["fill"] },
  line: { req: ["pts"], num: ["w", "amp"], col: ["col"], pts: 2 },
  tube: { req: ["pts", "w", "col"], num: ["w"], col: ["col"], pts: 2 },
  dot: { req: ["x", "y", "r", "fill"], num: ["x", "y", "r", "sw"], col: ["fill"] },
  word: { req: ["text", "x", "y"], num: ["x", "y", "s", "w", "amp"], col: ["col"] },
  group: { children: true },
  repeat: { req: ["n"], num: ["dx", "dy", "rot"], children: true },
};

export const SHAPE_TYPES = Object.keys(OPS);

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const inRange = (x, lo, hi) => isNum(x) && x >= lo && x <= hi;
const isCoord = (x) => inRange(x, -LIMITS.coord, LIMITS.coord);
const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);

export function validateSpec(input) {
  const errs = [];
  const spec = expandSpec(input, errs);   // 陣列簡寫先展開, 之後只看完整寫法 (簡寫寫錯的錯誤也記在 errs)
  const err = (path, msg) => errs.push(`${path}: ${msg}`);
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return ["根節點必須是物件"];
  if (spec.version !== 1) err("version", "必須是 1");
  if (typeof spec.name !== "string" || !NAME.test(spec.name)) err("name", "必填, 1~64 字元, 不可含 < > \" & ' \\");

  const c = spec.canvas;
  if (!c || typeof c !== "object") err("canvas", "必填");
  else {
    if (!inRange(c.w, 8, 4096)) err("canvas.w", "需為 8~4096 的數字");
    if (!inRange(c.h, 8, 4096)) err("canvas.h", "需為 8~4096 的數字");
    if (c.scale !== undefined && !inRange(c.scale, 0.1, 40)) err("canvas.scale", "需為 0.1~40 的數字");
    for (const k of ["foot", "baseY", "cx"]) if (c[k] !== undefined && !isNum(c[k])) err(`canvas.${k}`, "需為數字");
    for (const k of ["rim", "shade"]) if (c[k] !== undefined && typeof c[k] !== "boolean") err(`canvas.${k}`, "需為布林");
    // glow 已不再繪製 (輸出要能乾淨去背), 這裡只檢查格式, 讓舊的 JSON 不會報錯
    if (c.glow !== undefined) {
      const g = c.glow;
      if (!g || typeof g.color !== "string" || !HEX.test(g.color)) err("canvas.glow.color", "需為 #rrggbb");
      for (const k of ["rx", "ry", "cy", "opacity"]) if (g && g[k] !== undefined && !isNum(g[k])) err(`canvas.glow.${k}`, "需為數字");
    }
  }

  const palette = spec.palette ?? {};
  if (typeof palette !== "object" || Array.isArray(palette)) err("palette", "需為物件");
  else {
    const keys = Object.keys(palette);
    if (keys.length > LIMITS.palette) err("palette", `最多 ${LIMITS.palette} 色`);
    for (const k of keys) {
      if (!/^[A-Za-z_]\w*$/.test(k)) err(`palette.${k}`, "名稱只能是英數字與底線");
      if (typeof palette[k] !== "string" || !(HEX.test(palette[k]) || palette[k] === "none")) err(`palette.${k}`, "需為 #rrggbb");
    }
  }

  const st = spec.style;
  if (st !== undefined && !isObj(st)) err("style", "需為物件");
  else if (st !== undefined) {
    if (st.amp !== undefined && !inRange(st.amp, 0, 5)) err("style.amp", "需為 0~5");
    if (st.w !== undefined && !inRange(st.w, 0, 20)) err("style.w", "需為 0~20");
    if (st.pen !== undefined && !HEX.test(st.pen)) err("style.pen", "需為 #rrggbb");
    if (st.off !== undefined && !(Array.isArray(st.off) && st.off.length === 2 && st.off.every(isNum))) err("style.off", "需為 [x, y]");
  }

  let count = 0;
  const color = (v, path) => {
    if (typeof v !== "string" || !COLOR.test(v)) return err(path, `不是合法顏色: ${JSON.stringify(v)}`);
    if (v[0] === "$" && !Object.hasOwn(palette, v.slice(1))) err(path, `調色盤沒有 ${v}`);
  };
  const scalar = (v, path, check, loopable) => {
    if (Array.isArray(v)) {
      if (!loopable) return err(path, "只有 repeat 內才能用陣列");
      if (!v.length || v.length > LIMITS.repeat) return err(path, "陣列長度不合法");
      v.forEach((x, i) => check(x, `${path}[${i}]`));
    } else check(v, path);
  };
  const pts = (v, path, min) => {
    if (!Array.isArray(v) || v.length < min || v.length > LIMITS.pts) return err(path, `需為 ${min}~${LIMITS.pts} 個 [x, y]`);
    v.forEach((p, i) => {
      if (!(Array.isArray(p) && p.length === 2 && p.every(isCoord))) err(`${path}[${i}]`, "需為 [x, y]");
    });
  };

  const walk = (list, path, depth, loopable) => {
    if (!Array.isArray(list)) return err(path, "需為陣列");
    if (depth > LIMITS.depth) return err(path, `巢狀超過 ${LIMITS.depth} 層`);
    list.forEach((s, i) => {
      const p = `${path}[${i}]`;
      if (++count > LIMITS.shapes) return count === LIMITS.shapes + 1 ? err(path, `圖形超過 ${LIMITS.shapes} 個`) : undefined;
      const op = s && typeof s.t === "string" && Object.hasOwn(OPS, s.t) ? OPS[s.t] : undefined;
      if (!op) return err(p, `未知的 t: ${JSON.stringify(s && s.t)}`);
      for (const k of op.req ?? []) if (s[k] === undefined) err(p, `缺少欄位 ${k}`);
      // repeat 自己的 dx / dy / rot 必須是單一數字 (陣列只能出現在它的 children 裡, 否則展開時會算出 NaN)
      const own = s.t === "repeat" ? false : loopable;
      for (const k of op.num ?? []) if (s[k] !== undefined) scalar(s[k], `${p}.${k}`, (x, q) => isCoord(x) || err(q, `需為 ±${LIMITS.coord} 以內的數字`), own);
      for (const k of op.col ?? []) if (s[k] !== undefined) scalar(s[k], `${p}.${k}`, color, loopable);
      if (op.pts && s.pts !== undefined) pts(s.pts, `${p}.pts`, op.pts);
      if (s.t === "poly" && s.box !== undefined && typeof s.box !== "boolean") err(`${p}.box`, "需為布林");
      if (s.t === "word") {
        if (typeof s.text !== "string" || s.text.length > LIMITS.text) err(`${p}.text`, `需為最多 ${LIMITS.text} 字的字串`);
        else for (const ch of s.text) if (ch !== " " && !GLYPHS[ch]) err(`${p}.text`, `不支援的字母 ${ch} (目前只有 ${Object.keys(GLYPHS).join("")})`);
      }
      if (s.t === "repeat" && !(Number.isInteger(s.n) && s.n >= 1 && s.n <= LIMITS.repeat)) err(`${p}.n`, `需為 1~${LIMITS.repeat} 的整數`);
      if (s.t === "group" && s.transform !== undefined) {
        const t = s.transform;
        if (!isObj(t)) err(`${p}.transform`, "需為物件");
        else for (const k of ["tx", "ty", "rot", "sx", "sy", "px", "py"]) if (t[k] !== undefined && !isCoord(t[k])) err(`${p}.transform.${k}`, `需為 ±${LIMITS.coord} 以內的數字`);
      }
      if (op.children) walk(s.children, `${p}.children`, depth + 1, s.t === "repeat" || loopable);
    });
  };
  if (spec.shapes === undefined) err("shapes", "必填");
  else walk(spec.shapes, "shapes", 1, false);
  return errs;
}
