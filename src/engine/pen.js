// 手繪風原語: 抖動外框 + 偏移填色 + 不封口的粗黑線。座標單位與縮放由呼叫端決定。
const r1 = (n) => (Math.round(n * 10) / 10).toString();

export const DEFAULT_STYLE = { amp: 0.3, off: [1.6, 1.2], w: 3.2, pen: "#111" };

// Catmull-Rom 轉三次貝茲, 外框是曲線而不是折線
export function smooth(p, closed = true) {
  const n = p.length;
  let d = `M${r1(p[0][0])},${r1(p[0][1])}`;
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    let p0 = p[(i - 1 + n) % n];
    const p1 = p[i];
    const p2 = p[(i + 1) % n];
    let p3 = p[(i + 2) % n];
    if (!closed) {
      p0 = p[Math.max(i - 1, 0)];
      p3 = p[Math.min(i + 2, n - 1)];
    }
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`;
  }
  return d + (closed ? " Z" : "");
}

export class Pen {
  constructor(rng, style = {}) {
    this.rng = rng;
    this.style = { ...DEFAULT_STYLE, ...style };
  }

  u(a, b) {
    return a + (b - a) * this.rng();
  }

  jit(p, a) {
    return p.map(([x, y]) => [x + this.u(-a, a), y + this.u(-a, a)]);
  }

  // 沿邊插點, 讓直線在平滑後仍然是直的
  dense(p, step = 6, closed = true) {
    const out = [];
    const m = closed ? p.length : p.length - 1;
    for (let i = 0; i < m; i++) {
      const [x0, y0] = p[i];
      const [x1, y1] = p[(i + 1) % p.length];
      // 單邊最多插 120 點, 超長的邊不會把點數撐爆
      const n = Math.min(120, Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / step)));
      for (let t = 0; t < n; t++) out.push([x0 + ((x1 - x0) * t) / n, y0 + ((y1 - y0) * t) / n]);
    }
    return out;
  }

  shp(p, fill, w = this.style.w, a = this.style.amp, box = true) {
    const q = box ? this.dense(p) : p;
    const [ox, oy] = this.style.off;
    const f = this.jit(q.map(([x, y]) => [x + ox, y + oy]), a);
    const o = this.jit(q, a);
    const o2 = o.concat([o[0], [(o[1][0] + o[0][0]) / 2, (o[1][1] + o[0][1]) / 2]]);
    return (
      `<path d="${smooth(f)}" fill="${fill}"/>` +
      `<path d="${smooth(o2, false)}" fill="none" stroke="${this.style.pen}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }

  rect(x0, y0, x1, y1, fill, w, a) {
    return this.shp([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fill, w, a);
  }

  ln(p, w = 2.4, col = this.style.pen, a = 0.25) {
    const q = this.dense(p, 6, false).concat([p[p.length - 1]]);
    return `<path d="${smooth(this.jit(q, a), false)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  }

  // 黑色外框 + 彩色線芯
  tube(p, w, col) {
    return this.ln(p, w + 3.2, this.style.pen, 0.2) + this.ln(p, w, col, 0.2);
  }

  ell(cx, cy, rx, ry, fill, w = this.style.w) {
    const n = 16;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)]);
    return this.shp(pts, fill, w, 0.4, false);
  }

  dot(x, y, r, fill, sw = 1.6) {
    const stroke = sw > 0 ? ` stroke="${this.style.pen}" stroke-width="${sw}"` : "";
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke}/>`;
  }
}
