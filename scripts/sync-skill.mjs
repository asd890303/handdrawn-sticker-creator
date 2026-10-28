// 由 docs/ai-prompt.md 產生 skills/handdrawn-sticker-creator/SKILL.md。
// 規格只維護 docs/ai-prompt.md 一份, 改完執行 npm run skill 同步; npm test 會檢查是否同步。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Windows 與 macOS 的換行不同 (CRLF / LF); 讀進來一律轉成 LF, 產出的 SKILL.md 才會在兩邊相同
const lf = (s) => s.replace(/\r\n/g, "\n");

export const SKILL_PATH = path.join(ROOT, "skills", "handdrawn-sticker-creator", "SKILL.md");

const FRONTMATTER = `---
name: handdrawn-sticker-creator
description: 產生手繪貼紙風格的透明 PNG 所需的 JSON 規格。使用者想畫貼紙、手繪風圖示、sticker，或提到 Handdrawn Sticker Creator 時使用。會先詢問要畫什麼；沒有想法就從素材清單隨機挑一個。
---

`;

const AGENT_NOTES = `## 在 coding agent 裡執行的額外規定

- STEP 1 直接在對話中詢問使用者，等他回答再繼續。
- STEP 3 除了在回覆中輸出 JSON，也把同一份 JSON 存成目前目錄下的 \`<name>.json\` (\`name\` 就是 JSON 的 \`name\` 欄位)，並告訴使用者檔案路徑。
- 存檔後提醒使用者：到 https://asd890303.github.io/handdrawn-sticker-creator/ 按「新增」貼上 JSON，再按「下載 PNG」。
- 以下規格中「不要其他說明文字」的限制，只針對貼進 JSON 的那一則回覆內容；存檔路徑與使用提醒可以另外在 JSON 之後簡短補上。

`;

export async function buildSkill() {
  const spec = lf(await readFile(path.join(ROOT, "docs", "ai-prompt.md"), "utf8"));
  return FRONTMATTER + AGENT_NOTES + spec;
}

// 人形繪圖 (Beta) 的 skill: 規格只維護 docs/humanoid-prompt.md 一份
export const HUMAN_SKILL_PATH = path.join(ROOT, "skills", "handdrawn-humanoid", "SKILL.md");

const HUMAN_FRONTMATTER = `---
name: handdrawn-humanoid
description: 產生手繪風人形角色 (正面 / 背面 / 側面 × 走路 / 受傷 / 衝刺) 所需的角色 JSON。使用者想畫人物的逐幀圖、人形精靈圖，或提到 Handdrawn Sticker Creator 的人形繪圖時使用。只決定顏色與髮型，骨架與動作由工具固定處理。
---

`;

const HUMAN_AGENT_NOTES = `## 在 coding agent 裡執行的額外規定

- STEP 1 直接在對話中詢問使用者，等他回答再繼續。
- STEP 3 除了在回覆中輸出 JSON，也把同一份 JSON 存成目前目錄下的 \`<name>.json\` (\`name\` 就是 JSON 的 \`name\` 欄位)，並告訴使用者檔案路徑。
- 存檔後提醒使用者：到 https://asd890303.github.io/handdrawn-sticker-creator/web/humanoid.html 把 JSON 貼進「角色規格」，再按「下載圖集 PNG」。
- 以下規格中「不要其他說明文字」的限制，只針對貼進 JSON 的那一則回覆內容；存檔路徑與使用提醒可以另外在 JSON 之後簡短補上。

`;

export async function buildHumanSkill() {
  const spec = lf(await readFile(path.join(ROOT, "docs", "humanoid-prompt.md"), "utf8"));
  return HUMAN_FRONTMATTER + HUMAN_AGENT_NOTES + spec;
}

if (import.meta.url === new URL(process.argv[1], "file:///").href || process.argv[1]?.endsWith("sync-skill.mjs")) {
  await writeFile(SKILL_PATH, await buildSkill());
  console.log("已更新", path.relative(ROOT, SKILL_PATH));
  await mkdir(path.dirname(HUMAN_SKILL_PATH), { recursive: true });
  await writeFile(HUMAN_SKILL_PATH, await buildHumanSkill());
  console.log("已更新", path.relative(ROOT, HUMAN_SKILL_PATH));
}
