// 統一的後製濾鏡: rim = 白色貼紙描邊, dark + shade = 下半部陰影, glow = 腳底色塊光暈。
// rim 的作用範圍放大到 160%, 否則小物件的描邊會被切成方角; shade 遮罩橫向放寬, 寬物件的陰影才不會中斷。
export function defs(id = "") {
  return (
    `<defs><filter id="${id}glow"><feGaussianBlur stdDeviation="4"/></filter>` +
    `<filter id="${id}rim" x="-30%" y="-30%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="d"/><feFlood flood-color="#e8ecff"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="${id}dark"><feColorMatrix values=".62 0 0 0 0  0 .58 0 0 0  0 0 .7 0 0  0 0 0 1 0"/></filter>` +
    `<linearGradient id="${id}sg" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#000"/><stop offset=".8" stop-color="#fff" stop-opacity=".9"/></linearGradient>` +
    `<mask id="${id}shade" maskContentUnits="userSpaceOnUse"><rect x="-400" y="-100" width="800" height="170" fill="url(#${id}sg)"/></mask></defs>`
  );
}

export function wrap(fig, { id = "", rim = true, shade = true } = {}) {
  const inner = shade ? `<g filter="url(#${id}dark)" mask="url(#${id}shade)">${fig}</g>` : "";
  const body = `${fig}${inner}`;
  return rim ? `<g filter="url(#${id}rim)">${body}</g>` : body;
}

export function glowEllipse({ color, rx = 40, ry = 7, cy = 0, opacity = 0.4 }, id = "") {
  return `<ellipse cx="0" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${opacity}" filter="url(#${id}glow)"/>`;
}
