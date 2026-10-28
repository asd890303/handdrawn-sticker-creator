// 人形繪圖 (Beta): 一份角色規格 → 正面 / 背面 / 側面 × 走路 / 受傷 / 衝刺 的逐幀圖。
// 人體骨架與姿勢都寫在這個檔案裡, 輸出的是貼紙工具既有的 shapes 清單, 再交給 renderSvg 畫,
// 所以抖動外框、偏移填色、白色貼紙描邊都和一般貼紙同一套, 同一個角色每格風格一致。
// 不做死亡動作、不做配件 (帽子 / 背包 / 圍裙等) 與腳底光暈。
import { renderSvg } from "./render.js";
import { HEX, NAME } from "./spec.js";

export const VIEWS = ["front", "back", "side"];
export const ACTIONS = { walk: 6, hurt: 2, dash: 4 };
export const FPS = { walk: 12, hurt: 4, dash: 6 };   // 預覽動畫的播放速度 (每秒幾格)
export const HAIR_STYLES = ["short", "swoop", "none"];
// 圖集: 每格 128, 6 欄, 共 36 格 → 768×768
export const SHEET = { cell: 128, cols: 6, size: 768 };

const KEYS = ["version", "name", "skin", "top", "pants", "hair", "shoe", "hairStyle", "shade"];
const DEFAULTS = { skin: "#ffd2a6", top: "#8ec9ff", pants: "#2f5fcf", hair: "#2a2a2a", shoe: "#4a2c14", hairStyle: "short" };

export function validateHuman(spec) {
  const errs = [];
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return ["根節點必須是物件"];
  if (spec.version !== 1) errs.push("version: 必須是 1");
  if (typeof spec.name !== "string" || !NAME.test(spec.name)) errs.push("name: 必填, 1~64 字元, 不可含 < > \" & ' \\");
  for (const k of ["skin", "top", "pants", "hair", "shoe"]) {
    if (spec[k] !== undefined && (typeof spec[k] !== "string" || !HEX.test(spec[k]))) errs.push(`${k}: 需為 #rrggbb`);
  }
  if (spec.shade !== undefined && typeof spec.shade !== "boolean") errs.push("shade: 需為 true 或 false");
  if (spec.hairStyle !== undefined && !HAIR_STYLES.includes(spec.hairStyle)) errs.push(`hairStyle: 只能是 ${HAIR_STYLES.join(" / ")}`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) errs.push(`${k}: 未知的欄位`);
  return errs;
}

// ---------- 圖形原語 (輸出貼紙規格的 shape) ----------
const PEN = "#111";
const poly = (pts, fill, w) => ({ t: "poly", pts, fill, box: false, ...(w ? { w } : {}) });
const mirror = (pts) => pts.map(([x, y]) => [-x, y]);
const raiseFoot = (pts, d) => pts.map(([x, y]) => [x, y > 20 ? y - d : y]);
const ELL_N = 10;
const oval = (cx, cy, rx, ry, fill, w) =>
  poly(Array.from({ length: ELL_N }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / ELL_N), cy + ry * Math.sin((2 * Math.PI * i) / ELL_N)]), fill, w);
const stroke = (pts, w = 2.8, col = PEN) => ({ t: "line", pts, w, col, amp: 0.6 });
// 實心小橢圓 (眼睛): 疊兩個圓, 不經過抖動
const solidOval = (x, y, rx, ry) => [{ t: "dot", x, y: y - (ry - rx) / 2, r: rx, fill: PEN, sw: 0 }, { t: "dot", x, y: y + (ry - rx) / 2, r: rx, fill: PEN, sw: 0 }];

// ---------- 走路相位 ----------
// 相位連續計算 (4 格時經過格兩張一樣, 左右走看起來會卡)
function phase(th, stride = 1) {
  const c = Math.cos(th), s = Math.sin(th);
  return {
    sa: 3 + 10 * stride * c, sb: 3 - 10 * stride * c,   // 側面: 兩腳的腳尖 x
    la: Math.max(0, -s) * 5, lb: Math.max(0, s) * 5,    // 往前擺的那隻腳抬高
    arm: -6 * stride * c,                               // 手臂和腳反向擺
    bl: Math.max(0, s) * 5, br: Math.max(0, -s) * 5,    // 正面 / 背面: 左右腳輪流抬
    bob: -2 * Math.abs(s),
  };
}

function eyes(x, face, y = -40) {
  if (face === "hurt") {   // 痛到瞇眼 > <
    const d = x < 0 ? 1 : -1;
    return [stroke([[x - 3 * d, y - 3], [x + 2 * d, y], [x - 3 * d, y + 3]], 2.2)];
  }
  return solidOval(x, y, 2.2, 3.2);
}

function hairShape(style, view, col) {
  if (style === "none") return [];
  if (view === "back") return [poly([[-17, -46], [-16, -58], [0, -63], [16, -58], [17, -46], [13, -30], [0, -27], [-13, -30]], col)];
  if (view === "side") return [poly([[-16, -40], [-15, -55], [2, -61], [14, -54], [6, -50], [-2, -46], [-6, -36]], col)];
  if (style === "swoop") return [poly([[-17, -42], [-16, -56], [0, -62], [16, -56], [17, -44], [8, -52], [-6, -50]], col)];
  return [poly([[-16, -42], [-16, -52], [0, -55], [16, -52], [16, -42], [8, -48], [-2, -46], [-10, -48]], col)];
}

function sideLeg(hx, fx, raised, pants, shoe) {
  const m = (hx + fx) / 2;
  return [
    poly([[hx - 6, 12], [hx + 5, 12], [m + 4, 30], [fx + 4, 48 - raised], [fx - 4, 48 - raised], [m - 5, 30]], pants),
    poly([[fx - 7, 47 - raised], [fx + 6, 46 - raised], [fx + 9, 53 - raised], [fx - 7, 53 - raised]], shoe),
  ];
}

// 一個姿勢的完整人形 (腳底在 y = 53)
function figure(col, view, { face = "normal", stride = 1, th = 0, arm } = {}) {
  const pose = phase(th, stride);
  if (arm !== undefined) pose.arm = arm;
  const s = [];
  if (view === "side") {
    s.push(...sideLeg(-1, pose.sb, pose.lb, col.pants, col.shoe), ...sideLeg(3, pose.sa, pose.la, col.pants, col.shoe));
    s.push(poly([[-9, -24], [6, -24], [12, -14], [11, 2], [9, 15], [-8, 15], [-11, 0], [-11, -16]], col.top));
    const hx = 4 + pose.arm;   // 手臂垂在身側 (畫在身體上面)
    s.push(poly([[-4, -21], [4, -21], [hx / 2 + 4, -4], [hx + 3, 8], [hx - 3, 9], [hx / 2 - 2, -4]], col.top), oval(hx, 12, 4.5, 4.5, col.skin, 2.5));
    s.push(poly([[-4, -28], [4, -28], [4, -22], [-4, -22]], col.skin));
    s.push(poly([[-16, -42], [-14, -54], [0, -59], [14, -52], [18, -42], [21, -38], [17, -35], [14, -28], [2, -24], [-10, -28]], col.skin));
    s.push(...hairShape(col.hairStyle, view, col.hair));
    if (face === "normal") s.push(...solidOval(9, -41, 2, 3), stroke([[6, -31], [11, -31]], 2));
    else s.push(...eyes(9, face, -41), oval(9, -31, 2.2, 1.8, "#7a1a1a", 2));
    return s;
  }
  // 正面 / 背面
  const leg = [[-15, 12], [-1, 12], [-3, 30], [-4, 48], [-13, 48], [-14, 30]];
  const shoeL = [[-15, 47], [-3, 47], [-2, 54], [-17, 54]];
  s.push(poly(raiseFoot(leg, pose.bl), col.pants), poly(mirror(raiseFoot(leg, pose.br)), col.pants));
  s.push(poly(raiseFoot(shoeL, pose.bl), col.shoe), poly(mirror(raiseFoot(shoeL, pose.br)), col.shoe));
  const armPts = [[-17, -22], [-24, -16], [-27, 0], [-27, 8], [-21, 8], [-20, -6]];
  const al = pose.arm / 2, ar = -pose.arm / 2;   // 背面手臂前後擺 = 手往上縮一點
  s.push(poly(raiseFoot(armPts, Math.abs(al)), col.top), poly(mirror(raiseFoot(armPts, Math.abs(ar))), col.top));
  s.push(oval(-24, 12 - Math.abs(al), 4.5, 4.5, col.skin, 2.5), oval(24, 12 - Math.abs(ar), 4.5, 4.5, col.skin, 2.5));
  s.push(poly([[-9, -25], [9, -25], [19, -21], [17, -4], [15, 15], [-15, 15], [-17, -4], [-19, -21]], col.top));   // 肩寬腰窄
  s.push(poly([[-4, -29], [4, -29], [4, -23], [-4, -23]], col.skin));
  s.push(poly([[-17, -42], [-15, -54], [0, -59], [15, -54], [17, -42], [14, -32], [6, -26], [-6, -26], [-14, -32]], col.skin));   // 下巴收窄
  if (view === "front") {
    s.push(oval(-17, -40, 2.5, 4, col.skin, 2), oval(17, -40, 2.5, 4, col.skin, 2));
    s.push(...hairShape(col.hairStyle, view, col.hair));
    s.push(...eyes(-6, face), ...eyes(6, face));
    s.push({ t: "dot", x: -11, y: -34, r: 2.6, fill: "#ffa59a", sw: 0 }, { t: "dot", x: 11, y: -34, r: 2.6, fill: "#ffa59a", sw: 0 });
    s.push(face === "normal" ? stroke([[-4, -31], [0, -29], [4, -31]], 2) : oval(0, -30, 2.5, 2, "#7a1a1a", 2));
  } else {
    s.push(...hairShape(col.hairStyle, view, col.hair));
  }
  return s;
}

// ---------- 動作 ----------
const FOOT = 53;
// 受傷 2 格: [後仰角度, 水平位移]; 衝刺 4 格 (蓄力 / 衝出 / 滑行 / 收步):
// 側面 [前傾角度, 垂直縮放, 步幅, 手臂擺幅], 正面背面 [水平縮放, 垂直縮放, 走路相位]
const HURT_POSES = [[-10, -4], [-4, -1]];
const DASH_SIDE = [[-6, 0.9, 0.5, 6], [18, 1.04, 1.8, -12], [24, 1.02, 2.0, -14], [8, 0.97, 1.2, -6]];
const DASH_FRONT = [[1.08, 0.88, 0], [0.92, 1.1, Math.PI / 2], [0.94, 1.07, Math.PI / 2], [1.03, 0.96, 0]];
const grp = (children, transform) => ({ t: "group", transform, children });

// 回傳 action 的第 i 格 (shape 清單)。受傷: 往後仰 (側面) 或壓扁 (正面背面) + 瞇眼; 衝刺: 蓄力 → 衝出 → 滑行 → 收步
function frameShapes(col, view, action, i) {
  if (action === "walk") {
    const th = (2 * Math.PI * i) / ACTIONS.walk;
    return [grp(figure(col, view, { th }), { ty: +phase(th).bob.toFixed(2) })];
  }
  if (action === "hurt") {
    const [a, dx] = HURT_POSES[i];
    const f = figure(col, view, { face: "hurt" });
    if (view === "side") return [grp(f, { tx: dx, rot: a, px: 0, py: FOOT })];
    const sy = 1 + a / 100;
    return [grp(f, { sx: 2 - sy, sy, px: 0, py: FOOT })];
  }
  if (view === "side") {
    const [lean, sy, stride, arm] = DASH_SIDE[i];
    return [grp([grp(figure(col, view, { stride, th: 0, arm }), { sy, px: 0, py: FOOT })], { rot: lean, px: 0, py: FOOT })];
  }
  const [sx, sy, th] = DASH_FRONT[i];
  return [grp(figure(col, view, { th }), { sx, sy, px: 0, py: FOOT })];
}

// 圖集順序: 走路 0-17 / 受傷 18-23 / 衝刺 24-35, 每個動作內依 正面 / 背面 / 側面 排列
export const FRAMES = Object.entries(ACTIONS).flatMap(([action, n]) =>
  VIEWS.flatMap((view) => Array.from({ length: n }, (_, i) => ({ action, view, i }))),
);

const STYLE = { amp: 1.8, off: [2.2, 1.6], w: 3.6, pen: PEN };

// 單格 SVG。同一個角色同一個視角固定用同一個名字當亂數種子, 所以每格抖動一致、不會閃
export function renderFrame(spec, view, action, i, { seed = 0, id = "" } = {}) {
  const errors = validateHuman(spec);
  if (errors.length) throw new HumanError(errors);
  const col = { ...DEFAULTS, ...spec };
  return renderSvg(
    {
      version: 1,
      name: `${spec.name}_${view}`,
      canvas: { w: SHEET.cell, h: SHEET.cell, scale: 0.82, foot: FOOT, baseY: 116.5, rim: true, shade: spec.shade ?? true },
      style: STYLE,
      shapes: frameShapes(col, view, action, i),
    },
    { seed, id },
  );
}

export class HumanError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.errors = errors;
  }
}

// 全部 36 格 [{ action, view, i, svg }]
export function renderAll(spec, { seed = 0, id = "" } = {}) {
  return FRAMES.map((f, k) => ({ ...f, svg: renderFrame(spec, f.view, f.action, f.i, { seed, id: `${id}f${k}-` }).svg }));
}
