# Handdrawn Sticker Creator

跟 AI 說你要什麼圖，把它回的 JSON 貼進來，就得到一張手繪貼紙風格的透明 PNG。

![範例: 蘋果、卡車、冰箱、卡車司機、小貓、火箭、消防車、螢幕、腳踏車、手機](docs/images/examples.png)

**線上版：** https://asd890303.github.io/handdrawn-sticker-creator/

粗黑外框、塗出線的填色、白色貼紙描邊都由工具自動加上，輸出是乾淨去背的透明 PNG，不帶陰影或背景。AI 只需要描述形狀和顏色，任何聊天型 AI 都寫得出來，不用會畫圖，也不用會寫程式。

## 產生一張圖

1. 打開線上版，按右上角「AI 規格」，再按「複製全部」。也可以直接複製 [docs/ai-prompt.md](docs/ai-prompt.md) (繁體中文) 或 [docs/ai-prompt.en.md](docs/ai-prompt.en.md) (English) 的全文。網頁切換成 English 時，視窗裡也會顯示英文版。
2. 整份貼給任何 AI 並送出。AI 會先問你要畫什麼，回答例如「側面的紅色消防車」。沒想法就回「隨機」，它會自己挑一個題材。
3. 在線上版按左下「新增」，取個名字，把 AI 回的 JSON 貼進編輯區。
4. 按右下角「下載 PNG」。

AI 寫錯時，編輯區下方會列出哪個欄位有問題。把錯誤訊息貼回給 AI，請它修正。

左邊「圖片列表」一開始有蘋果、卡車、冰箱、卡車司機、小貓、火箭、消防車、螢幕、腳踏車、手機十張範例，可以直接點來看。

## 常見問題

**我的圖會上傳到哪裡嗎？**
不會。繪圖都在你的瀏覽器裡完成，JSON 和圖片都不會送出去。

**關掉網頁後，圖還在嗎？**
在。圖片列表裡的每張圖都邊改邊存在你的瀏覽器裡，最多 100 張。換電腦、換瀏覽器或用無痕模式就看不到，重要的圖請按「下載 JSON」另存。

## 文件

| 文件 | 給誰看 |
|---|---|
| [docs/ai-prompt.md](docs/ai-prompt.md) | 給 AI 的完整規格。整份貼給 AI 送出，它會先問你要畫什麼 |
| [docs/ai-prompt.en.md](docs/ai-prompt.en.md) | 同上，英文版 (English version of the AI spec) |
| [docs/architecture.md](docs/architecture.md) | 想了解手繪效果原理、安全設計的人 |

## 授權

[MIT](LICENSE)
