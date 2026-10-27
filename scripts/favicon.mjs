// 用本工具的引擎產生網站圖示, 輸出到 web/:
//   favicon.svg           一般瀏覽器
//   favicon-32.png        不支援 SVG 圖示的瀏覽器
//   apple-touch-icon.png  iOS 加到主畫面 (180x180, 切割墊綠底; iOS 會把透明處填黑)
// PNG 用 Chrome 截圖產生。找不到 Chrome 時只輸出 SVG; 可用環境變數 CHROME 指定執行檔路徑。
import { execFile } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { renderSvg } from "../src/index.js";
import { pencilSpec } from "../web/logo.js";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

await writeFile(path.join(WEB, "favicon.svg"), renderSvg(pencilSpec(64, 1)).svg);
console.log("web/favicon.svg");

try {
  await access(CHROME);
} catch {
  console.log(`找不到 Chrome (${CHROME}), 略過 PNG。設定 CHROME 環境變數後重跑即可產生。`);
  process.exit(0);
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "favicon-"));
const shot = async (name, size, scale, bg) => {
  const svg = path.join(tmp, `${name}.svg`);
  await writeFile(svg, renderSvg(pencilSpec(size, scale)).svg);
  await promisify(execFile)(CHROME, [
    "--headless", "--disable-gpu", "--hide-scrollbars", `--default-background-color=${bg}`,
    `--window-size=${size},${size}`, `--screenshot=${path.join(WEB, name)}`, `file://${svg}`,
  ]);
  console.log(`web/${name}`);
};
try {
  await shot("favicon-32.png", 32, 0.5, "00000000");
  await shot("apple-touch-icon.png", 180, 2.3, "2f6a5cff");
} finally {
  await rm(tmp, { recursive: true, force: true });
}
