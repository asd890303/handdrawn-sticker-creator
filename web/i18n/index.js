// 介面語系。新增語系: 複製 zh-TW.js 翻譯成新檔, 在 LOCALES 加一筆; 缺少的 key 會退回繁體中文。
import zhTW from "./zh-TW.js";
import en from "./en.js";

export const LOCALES = {
  "zh-TW": { label: "繁體中文", dict: zhTW, spec: "ai-prompt.md" },
  en: { label: "English", dict: en, spec: "ai-prompt.en.md" },
};
const FALLBACK = "zh-TW";
let current = FALLBACK;

export const locale = () => current;
// 目前語系對應的 AI 規格文件檔名 (docs/ 底下)
export const specFile = () => LOCALES[current].spec;

// 先看使用者上次的選擇, 再看瀏覽器語言; 中文一律用繁中, 其他沒有對應的語言用英文
export function detectLocale(saved) {
  if (saved && LOCALES[saved]) return saved;
  for (const lang of navigator.languages ?? [navigator.language]) {
    if (LOCALES[lang]) return lang;
    if (lang.toLowerCase().startsWith("zh")) return "zh-TW";
    const base = lang.split("-")[0];
    if (LOCALES[base]) return base;
  }
  return "en";
}

export function t(key, params = {}) {
  const s = LOCALES[current].dict[key] ?? LOCALES[FALLBACK].dict[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

// data-i18n: 文字; data-i18n-html: 含 <code> 等標記的文字 (只用自家語系檔的內容);
// data-i18n-attr: "屬性:key; 屬性:key"
export function applyDom(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}

export function setLocale(code) {
  current = LOCALES[code] ? code : FALLBACK;
  document.documentElement.lang = current;
  applyDom();
}
