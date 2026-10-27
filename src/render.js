import { Pen } from "./engine/pen.js";
import { defs, glowEllipse, wrap } from "./engine/fx.js";
import { ADVANCE, GLYPHS } from "./engine/glyphs.js";
import { hashSeed, mulberry32 } from "./engine/rng.js";
import { validateSpec } from "./spec.js";

export class SpecError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.errors = errors;
  }
}

const BUDGET = 20000;

function val(ctx, s, key, idx, fallback) {
  let x = s[key];
  if (x === undefined) return fallback;
  if (Array.isArray(x)) x = x[idx % x.length];
  if (typeof x === "string" && x.startsWith("$")) x = ctx.palette[x.slice(1)];
  return x;
}

function transform(t = {}) {
  const { tx = 0, ty = 0, rot = 0, sx = 1, sy = 1, px = 0, py = 0 } = t;
  return `translate(${tx},${ty}) translate(${px},${py}) rotate(${rot}) scale(${sx},${sy}) translate(${-px},${-py})`;
}

function node(s, ctx, idx) {
  if (--ctx.left < 0) throw new SpecError(["展開後的圖形數量超過上限"]);
  const { pen } = ctx;
  const v = (k, d) => val(ctx, s, k, idx, d);
  switch (s.t) {
    case "rect":
      return pen.rect(v("x0"), v("y0"), v("x1"), v("y1"), v("fill"), v("w"), v("amp"));
    case "poly":
      return pen.shp(s.pts, v("fill"), v("w"), v("amp"), s.box ?? true);
    case "ell":
      return pen.ell(v("cx"), v("cy"), v("rx"), v("ry"), v("fill"), v("w"));
    case "line":
      return pen.ln(s.pts, v("w"), v("col"), v("amp"));
    case "tube":
      return pen.tube(s.pts, v("w"), v("col"));
    case "dot":
      return pen.dot(v("x"), v("y"), v("r"), v("fill"), v("sw"));
    case "word": {
      const sc = v("s", 1);
      let x = v("x");
      let out = "";
      for (const ch of s.text) {
        for (const path of GLYPHS[ch] ?? []) {
          out += pen.ln(path.map(([px, py]) => [x + px * sc, v("y") + py * sc]), v("w", 1), v("col"), v("amp", 0));
        }
        x += ADVANCE * sc;
      }
      return out;
    }
    case "group":
      return `<g transform="${transform(s.transform)}">${nodes(s.children, ctx, idx)}</g>`;
    case "repeat": {
      let out = "";
      for (let i = 0; i < s.n; i++) {
        out += `<g transform="translate(${(s.dx ?? 0) * i},${(s.dy ?? 0) * i}) rotate(${(s.rot ?? 0) * i})">${nodes(s.children, ctx, i)}</g>`;
      }
      return out;
    }
  }
}

const nodes = (list, ctx, idx) => list.map((s) => node(s, ctx, idx)).join("");

// 回傳完整 SVG 字串。同一個 spec 與 seed 一定產出相同結果; 要在同一頁放多張 SVG 時, 用 id 前綴避免濾鏡 id 衝突。
export function renderSvg(spec, { seed = 0, id = "" } = {}) {
  const errors = validateSpec(spec);
  if (errors.length) throw new SpecError(errors);
  const pen = new Pen(mulberry32(hashSeed(`${spec.name}:${seed}`)), spec.style);
  const fig = nodes(spec.shapes, { pen, palette: spec.palette ?? {}, left: BUDGET }, 0);
  const c = spec.canvas;
  const sc = c.scale ?? 1;
  const foot = c.foot ?? 0;
  const ox = c.w / 2 - (c.cx ?? 0) * sc;
  const oy = (c.baseY ?? c.h - 32) - foot * sc;
  const glow = c.glow ? glowEllipse({ ...c.glow, cy: c.glow.cy ?? foot + 4 }, id) : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${c.w}" height="${c.h}" viewBox="0 0 ${c.w} ${c.h}">${defs(id)}` +
    `<g transform="translate(${ox},${oy}) scale(${sc})">${glow}${wrap(fig, { id, rim: c.rim ?? true, shade: c.shade ?? true })}</g></svg>`;
  return { svg, width: c.w, height: c.h };
}
