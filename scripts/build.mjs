// 產生可直接放上靜態網站 (GitHub Pages 等) 的 dist/。不打包、不轉譯, 原樣複製 ES 模組。
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST);
for (const dir of ["web", "src", "examples"]) {
  await cp(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
}
// 網頁的「AI 規格」視窗讀取這份文件
await mkdir(path.join(DIST, "docs"));
for (const f of ["ai-prompt.md", "ai-prompt.en.md", "humanoid-prompt.md", "humanoid-prompt.en.md"]) await cp(path.join(ROOT, "docs", f), path.join(DIST, "docs", f));

// 網站根目錄放一份 index.html, 資源改指向 web/; 網址就是 https://<帳號>.github.io/<repo>/
const html = await readFile(path.join(ROOT, "web", "index.html"), "utf8");
const files = ["style.css", "app.js", "favicon.svg", "favicon-32.png", "apple-touch-icon.png"];
let out = html;
for (const f of files) {
  const re = new RegExp(`(href|src)="${f.replace(".", "\\.")}"`);
  if (!re.test(out)) throw new Error(`web/index.html 找不到 ${f}, 請同步更新 scripts/build.mjs`);
  out = out.replace(re, `$1="web/${f}"`);
}
// 首頁在根目錄、人形頁在 web/ 底下: 首頁的連結要多一層 web/, 人形頁回首頁的連結要往上一層
if (!out.includes('href="humanoid.html"')) throw new Error("web/index.html 找不到人形頁連結, 請同步更新 scripts/build.mjs");
out = out.replace('href="humanoid.html"', 'href="web/humanoid.html"');
await writeFile(path.join(DIST, "index.html"), out);
const human = path.join(DIST, "web", "humanoid.html");
const humanHtml = await readFile(human, "utf8");
if (!humanHtml.includes('href="index.html"')) throw new Error("web/humanoid.html 找不到回首頁連結, 請同步更新 scripts/build.mjs");
await writeFile(human, humanHtml.replace('href="index.html"', 'href="../index.html"'));

// GitHub Pages 預設會用 Jekyll 處理檔案, 這個空檔讓它原樣提供
await writeFile(path.join(DIST, ".nojekyll"), "");

console.log(`dist/ 已建立: ${DIST}`);
