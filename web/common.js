// 貼紙頁 (app.js) 和人形頁 (humanoid.js) 共用的瀏覽器端小工具。
import { LOCALES, locale, setLocale, detectLocale, t } from "./i18n/index.js";

export const $ = (s) => document.querySelector(s);

// 本站存在 localStorage 的全部項目; 「資料儲存」聲明的內容要和這份清單一致
export const STORE_KEYS = ["studio.items", "studio.current", "studio.lang", "studio.bg", "studio.split", "studio.galleryW", "studio.notice", "studio.human"];
export const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  // 回傳是否寫入成功; 私密視窗、被封鎖或空間不足時為 false
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  clear: () => { for (const k of STORE_KEYS) { try { localStorage.removeItem(k); } catch { /* 同上 */ } } },
};

let toastTimer;
export function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

export function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 下載檔名: 只換掉作業系統不允許的字元, 中文照用
export const fileBase = (title, fallback = "image") => (String(title).trim() || fallback).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 80);

// 狀態列: errors 有值就顯示錯誤清單, 否則顯示一行文字 (一律用 textContent)
export function showStatus(el, text, errors) {
  el.className = errors ? "status error" : "status";
  el.replaceChildren();
  if (!errors) { el.textContent = text; return; }
  const head = document.createElement("strong");
  head.textContent = t("status.errors", { n: errors.length });
  const ul = document.createElement("ul");
  for (const e of errors) { const li = document.createElement("li"); li.textContent = e; ul.append(li); }
  el.append(head, ul);
}

// 種子控制 (輸入框 + 減 / 加 / 隨機)
export function bindSeed({ input, down, up, dice }, getSeed, setSeed) {
  const apply = (n) => { const v = Number.isFinite(n) ? Math.trunc(n) : 0; setSeed(v); input.value = v; };
  input.addEventListener("input", (e) => apply(Number(e.target.value)));
  down.addEventListener("click", () => apply(getSeed() - 1));
  up.addEventListener("click", () => apply(getSeed() + 1));
  dice.addEventListener("click", () => apply(Math.floor(Math.random() * 10000)));
}

// AI 規格視窗: fileFor() 回傳目前語系要顯示的 docs/ 檔名; 載入過的依檔名快取
export function bindAiSpec({ open, dialog, text, copy, link, note }, fileFor) {
  const cache = new Map();
  let current = null;
  async function show() {
    const file = fileFor();
    const url = new URL(`../docs/${file}`, import.meta.url);
    link.href = url.href;
    link.download = file;
    if (note) note.hidden = !t("aiSpec.note");
    if (cache.has(file)) { current = cache.get(file); text.textContent = current; return; }
    current = null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.text();
      cache.set(file, body);
      if (file !== fileFor()) return;   // 載入期間切換了語系
      current = body;
      text.textContent = body;
    } catch {
      text.textContent = t("error.aiSpecLoad");
    }
  }
  open.addEventListener("click", () => { dialog.showModal(); show(); });
  copy.addEventListener("click", async () => {
    if (current === null) return;
    try { await navigator.clipboard.writeText(current); toast(t("toast.aiSpecCopied")); } catch { toast(t("toast.clipboardDenied")); }
  });
  return { refresh: () => { if (dialog.open) show(); } };
}

// 語系選單; onChange 在切換後呼叫
export function bindLang(select, onChange) {
  for (const [code, { label }] of Object.entries(LOCALES)) select.add(new Option(label, code));
  select.addEventListener("change", () => {
    setLocale(select.value);
    store.set("studio.lang", locale());
    onChange();
  });
  setLocale(detectLocale(store.get("studio.lang")));
  select.value = locale();
}
