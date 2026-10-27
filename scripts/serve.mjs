// 本機靜態檔伺服器: 只綁 127.0.0.1, 只提供專案目錄內的檔案。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".md": "text/markdown; charset=utf-8" };
const PUBLIC_DIRS = ["web", "src", "examples", "docs"];

// 預設提供原始碼目錄 (開發用); dist = true 時改為提供建置好的 dist/ (預覽上線版本)
export function startServer(port = 0, { dist = false } = {}) {
  const root = dist ? path.join(ROOT, "dist") : ROOT;
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== "GET") { res.writeHead(405).end(); return; }
      let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (rel === "/") {
        if (!dist) { res.writeHead(302, { Location: "/web/index.html" }).end(); return; }
        rel = "/index.html";
      }
      const file = path.resolve(root, "." + rel);
      const top = path.relative(root, file).split(path.sep)[0];
      const allowed = dist || PUBLIC_DIRS.includes(top);
      if (!file.startsWith(root + path.sep) || !allowed || !(await stat(file)).isFile()) { res.writeHead(404).end("Not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await startServer(Number(process.env.PORT) || 5173, { dist: process.argv[2] === "dist" });
  console.log(`http://127.0.0.1:${port}/`);
}
