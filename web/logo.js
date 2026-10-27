// 鉛筆圖示: 頂列 logo 與 scripts/favicon.mjs 產生的網站圖示共用
export const PENCIL = [{
  t: "group", transform: { rot: -45 },
  children: [
    { t: "poly", pts: [[-24, -6], [-36, 0], [-24, 6]], fill: "#f2d2a6", w: 2.6 },
    { t: "poly", pts: [[-32, -2], [-36, 0], [-32, 2]], fill: "#22202b", w: 1.6 },
    { t: "rect", x0: -24, y0: -6, x1: 14, y1: 6, fill: "#ffd34a", w: 2.6 },
    { t: "rect", x0: 14, y0: -6, x1: 19, y1: 6, fill: "#c8ccde", w: 2.2 },
    { t: "rect", x0: 19, y0: -6, x1: 27, y1: 6, fill: "#ff9ad0", w: 2.6 },
  ],
}];

// 鉛筆軸心在 (-4.5, 0), 轉 -45 度後落在 (-3.18, 3.18); 用 cx / foot 把它移回畫布正中央
export function pencilSpec(size, scale) {
  return {
    version: 1,
    name: "pencil",
    canvas: { w: size, h: size, scale, cx: -3.18, foot: 3.18, baseY: size / 2, shade: false },
    shapes: PENCIL,
  };
}

export const LOGO = pencilSpec(44, 0.7);
