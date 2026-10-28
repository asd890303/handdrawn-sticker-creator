// 瀏覽器端: SVG 字串 → 透明背景 PNG。
function loadSvg(svg) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG 無法載入成圖片")); };
    img.src = url;
  });
}

const toBlob = (canvas) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 輸出失敗"))), "image/png"));

export async function svgToPngBlob(svg, width, height, scale = 1) {
  const img = await loadSvg(svg);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return toBlob(canvas);
}

