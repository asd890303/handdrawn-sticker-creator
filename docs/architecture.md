# 架構

## 渲染流程

```
JSON 規格
  │ validateSpec   (src/spec.js)    逐欄檢查型別、範圍、顏色、上限
  ▼
圖形樹
  │ renderSvg      (src/render.js)  依序展開 group / repeat, 呼叫手繪原語
  ▼
手繪路徑
  │ Pen            (src/engine/pen.js)  插點、抖動、平滑、偏移填色、不封口外框
  ▼
套濾鏡
  │ wrap / defs    (src/engine/fx.js)   白色貼紙描邊 (下半部陰影預設關閉, 腳底光暈已移除)
  ▼
SVG 字串
  │ svgToPngBlob   (src/export.js)  瀏覽器 canvas 轉成透明 PNG
  ▼
PNG
```

`src/` 不依賴瀏覽器 API (除了 `export.js`)，Node 可以直接 import 來批次產生 SVG。

## 手繪效果怎麼來的

每個封閉圖形畫兩條路徑：

1. **填色**：`rect` 與 `box: true` 的 `poly` 先沿邊每 6 單位插一個點，讓直邊在平滑後仍然是直的；`ell` 固定取 16 點，`box: false` 的 `poly` 直接用給的點。接著整體偏移 `style.off`，每點加 ±`amp` 的隨機抖動，再用 Catmull-Rom 曲線連起來。
2. **外框**：同樣插點抖動，但不偏移；終點繞回起點後再多畫半段，做出沒有完全封口的筆觸。

整張圖畫完後，最外層用形態學膨脹做出白色貼紙描邊。輸出是透明背景，物件以外沒有任何顏色，可以直接去背使用。

下半部陰影 (再畫一次、套上變暗的色彩矩陣，並用上淡下濃的漸層遮罩疊上去) 預設關閉，`canvas.shade: true` 才會啟用。`canvas.glow` (腳底光暈) 已移除，舊 JSON 裡有這個欄位不會報錯，但不會畫出來。

## 決定性

亂數用 mulberry32，種子是 `name` 加介面上「線條變化」數字的雜湊值，座標輸出時四捨五入到 0.1。同一個執行環境裡，同樣的輸入產出相同字串，可以在測試裡比對。不同瀏覽器的三角函數偶爾有末位差異，跨環境逐字比對前先確認結果。

## 陣列簡寫與 JSON 容錯

AI 的回覆長度就是使用者的 token 花費，AI 的 JSON 有小毛病又要再問一次，所以輸入端做兩件事。

- **陣列簡寫** (`src/shorthand.js`)：`rect`、`poly`、`ell`、`line`、`tube`、`dot` 可以寫成陣列，第一個元素是種類，後面依序是欄位值，要跳過的欄位寫 `null`。`validateSpec` 和 `renderSvg` 開頭都先用 `expandSpec` 展開，之後只看完整寫法，所以安全規則和繪圖結果不變 (`test/json-tolerance.test.js` 比對輸出相同)。簡寫寫錯時，錯誤路徑仍然對得上，後面圖形的索引不位移。
- **JSON 容錯** (`src/extract.js`)：`parseLoose` 先用標準 `JSON.parse`，失敗才呼叫 `repairJson`，修正彎引號與全形引號、單引號、沒加引號的欄位名稱、註解、結尾多餘的逗號、全形逗號冒號、不可見字元。字串內容 (含 `//`、逗號、冒號、跳脫) 不會被改。合法的 JSON 原樣不動。
- **貼上** (`web/app.js`)：`extractJson` 另外去掉 JSON 前後的說明文字和程式碼框，再套用 `repairJson`，貼紙和人形都適用，並用提示說明修了什麼。
- **繪圖時**：編輯區的文字有小毛病時，`render` 用修正後的內容畫圖，狀態列說明修了什麼，編輯區的文字不動。按「整理格式」會把修正寫回編輯區。

## 人形繪圖 (Beta)

`src/humanoid.js` 把一份「部位圖形」JSON 變成一整套逐幀圖。JSON 為 `leg`、`arm`、`torso`、`head` 各寫 `front`、`back`、`side` 三組貼紙圖形。骨架和動作寫在這個檔案裡，它把部位擺成貼紙規格的圖形清單 (`group` 加上位移、旋轉、縮放)，再交給同一個 `renderSvg` 畫。抖動外框、偏移填色、白色描邊因此和貼紙共用同一套。

- **骨架**：正面和背面只畫左腿、左手，右邊用 `sx: -1` 鏡像。側面畫一條腿和一隻手，工具畫成前後兩條腿，依腳尖位置換算成以髖為軸的擺動角度。座標約定 (腳底 `y = 53`、髖 `y = 12`、肩 `y = -22`) 寫在 `docs/humanoid-prompt.md`。
- **動作**：只有走路，每個視角 6 格，相位用連續的三角函數計算 (`phase()`)，整個人物隨步伐上下起伏。
- **省字寫法**：AI 的回覆長度就是使用者的 token 花費，所以輸入格式有三個省字做法。測試逐格比對，結果和完整寫法相同。
  1. `leg`、`arm`、`torso` 的 `back` 省略時沿用 `front`。`head.back` 沒有臉，要寫。
  2. 人形裡 `poly` 的 `box` 預設 `false`，`dot` 的 `sw` 預設 `0`，`line` 的 `amp` 預設 `0.6`。
  3. 圖形可以寫成陣列簡寫，和貼紙共用 `src/shorthand.js`。

  `expandShapes` 把簡寫展開並補上人形預設值，再交給貼紙驗證。安全規則不變，錯誤路徑仍是 `parts.leg.front[0].fill` 這種形式。
- **回覆格式驗證**：`humanWarnings` 回傳不擋下的提醒 (`back` 和 `front` 相同可以省略、壓縮後超過 `SIZE_HINT` 字元)，顯示在狀態列。貼上時，`extractJson` (`src/extract.js`) 去掉 AI 回覆中 JSON 前後的說明文字和程式碼框，貼紙和人形都適用。規格文件要求 AI 輸出單行壓縮的 JSON，3000 字元以內。
- **一致風格**：同一個角色的同一個視角固定用 `<name>_<view>` 當亂數種子，每格抖動相同，畫面不會閃。所有角色共用一副骨架和一套線寬、抖動設定。
- **圖集格式**：18 格，768×384，每格 128、6 欄 3 列。順序是正面 0-5、背面 6-11、側面 12-17。向左用向右翻轉。常數在 `SHEET`、`ACTIONS`、`FRAMES`。`renderSheet` 把 18 格組成一張 SVG，預覽、複製 SVG、下載 PNG 都用它。
- **陰影**：`shade` 預設 `true`，陰影畫在人物裡面，外面仍是透明；貼紙的 `canvas.shade` 預設關閉。陰影遮罩套在整個人物外層，走路起伏時遮罩位置固定，不跟著身體移動。
- **沒有**：受傷、衝刺、死亡動作，配件 (帽子、背包、圍裙)，腳底光暈。
- **驗證**：`validateHuman` 檢查頂層欄位，部位的每組圖形 (展開簡寫、補上預設值之後) 借用 `validateSpec` 檢查，錯誤路徑改寫成 `parts.leg.front[0].fill` 這種形式。因此貼紙的安全規則 (顏色白名單、座標與數量上限、`Object.hasOwn`) 對人形同樣有效。
- **新增動作**：改 `ACTIONS`、`frameShapes` 的姿勢、`SHEET` 的列數與尺寸、兩份 `docs/humanoid-prompt*.md`；測試的格數是從 `ACTIONS` 推算的。
- **給 AI 的文件**：`docs/humanoid-prompt.md` (及 `.en.md`)，文件最後的範例就是 `examples/humanoid/blue_worker.json`。`npm run skill` 從文件產生 skill 版 (`skills/handdrawn-humanoid/SKILL.md`)，測試檢查兩者同步，也檢查文件範例通過驗證且與範例檔一致。
- **儲存**：人形角色和貼紙存在同一份列表 (`studio.items`，人形項目帶 `kind: "human"`)。`studio.mode` 記住上次的模式，`studio.humanSeeded` 記錄範例角色是否已放入，兩者都列在 `web/common.js` 的 `STORE_KEYS`。

## 安全設計

這個工具的輸入可能來自 AI 或陌生人分享的 JSON，因此：

- **只接受資料**：沒有 `eval`、沒有運算式、沒有外部資源引用。
- **字串白名單**：會寫進 SVG 屬性的字串只有顏色，必須符合 `#hex`、`none` 或已定義的 `$名稱`。`name` 不可含 `< > " & ' \`。其餘欄位都必須是數字或布林。
- **數量上限**：圖形數、巢狀深度、`repeat` 次數、展開後的總數都有上限，巨大的惡意 JSON 不會讓瀏覽器卡死。座標與長度類數字的絕對值上限是 `LIMITS.coord` (10000)，`pen.dense()` 單邊最多插 120 點，超長的線也撐不爆點數。
- **只認自己的欄位**：圖形種類 (`t`) 和調色盤名稱用 `Object.hasOwn` 查表，`constructor`、`toString` 這類原型鏈上的名字不會被當成合法值。`style`、`transform` 必須是物件。
- **id 前綴**：`renderSvg` 的 `id` 會寫進 SVG 屬性 (濾鏡 id)，只接受英數字、底線與連字號；從 localStorage 讀回的圖片 id 也用同一規則過濾。
- **本機伺服器** (`scripts/serve.mjs`)：只綁 `127.0.0.1`、只接受 GET、擋掉 `..` 路徑穿越。開發模式只提供 `web/`、`src/`、`examples/`、`docs/` 四個目錄 (`docs/` 是網頁的「AI 規格」視窗要讀的)；預覽模式 (`npm run preview`) 只提供 `dist/`。

`test/engine.test.js` 涵蓋注入字串、未知圖形、上限與輸出不含 `<script>`。`test/hardening.test.js` 涵蓋超大座標、原型鏈名稱、欄位型別錯誤、id 前綴和伺服器路徑穿越。

## 新增圖形種類

以新增一個 `star` 為例：

1. `src/spec.js` 的 `OPS` 加一筆，列出必填欄位、數值欄位、顏色欄位。驗證器會自動檢查型別與 `repeat` 陣列規則。
2. `src/render.js` 的 `node()` 加一個 `case "star"`，用 `pen.shp()` 或其他原語畫出來。
3. `docs/ai-prompt.md` 補上欄位說明和一行範例。AI 只會使用這份文件寫到的圖形。
4. `test/engine.test.js` 補一個測試。

新增的欄位如果是字串，要在 `spec.js` 用白名單正規表示式檢查，不能直接放進 SVG。

## 新增字母

`src/engine/glyphs.js` 的 `GLYPHS` 用折線描述每個字母：

- 座標以字母左上為原點，小寫高度 4.5、寬約 3.4。
- 一個字母可以有多筆，每筆是一串 `[x, y]`。
- 有上伸部的字母 (b、d、h、k、l) 用負的 y，例如 `k` 的直線從 `-2.5` 畫到 `4.5`。

加入後 `word` 就能使用，驗證器會自動接受新字母。

## 新增範例

1. 在 `examples/` 放一份 JSON。
2. 在 `examples/index.json` 加一行 `{ "file": "檔名.json", "title": "顯示名稱" }`。

測試會自動驗證清單裡的每個範例。
