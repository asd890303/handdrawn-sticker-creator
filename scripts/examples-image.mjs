// 把 examples/ 的所有範例排成一張 docs/images/examples.png (README 用)。
// 需要本機的 Chrome 或 Edge (用無頭模式截圖); 找不到時用環境變數 BROWSER_PATH 指定。
// 用法: npm run examples-image
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderSvg } from "../src/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "images", "examples.png");
const COLS = 5;
const CELL = 256;
const BG = "#131622";

const BROWSERS = [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) throw new Error("找不到 Chrome 或 Edge, 請用 BROWSER_PATH 指定瀏覽器執行檔");

const list = JSON.parse(await readFile(path.join(ROOT, "examples", "index.json"), "utf8"));
const cells = [];
for (const [i, { file }] of list.entries()) {
  const spec = JSON.parse(await readFile(path.join(ROOT, "examples", file), "utf8"));
  // 同一頁放多張 SVG, 用 id 前綴避免濾鏡 id 衝突
  cells.push(renderSvg(spec, { id: `ex${i}-` }).svg);
}
const rows = Math.ceil(cells.length / COLS);
const width = COLS * CELL;
const height = rows * CELL;
const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:${BG}}
.grid{display:grid;grid-template-columns:repeat(${COLS},${CELL}px);width:${width}px;height:${height}px}
.grid svg{display:block}
</style><div class="grid">${cells.join("")}</div>`;

const dir = await mkdtemp(path.join(os.tmpdir(), "sticker-examples-"));
try {
  const page = path.join(dir, "examples.html");
  await writeFile(page, html);
  execFileSync(browser, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--user-data-dir=${path.join(dir, "profile")}`,
    `--window-size=${width},${height}`,
    `--screenshot=${OUT}`,
    pathToFileURL(page).href,
  ], { stdio: "ignore" });
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log(`已更新 ${path.relative(ROOT, OUT)} (${list.length} 張, ${width}x${height})`);
