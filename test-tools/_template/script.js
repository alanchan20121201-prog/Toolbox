'use strict';

/**
 * 工具範本 — 展示標準寫法：
 *   1. 四語 I18N（語系由主程式注入的 lang.js 決定，工具不需自己偵測）
 *   2. Tool API 呼叫（window.toolbox.*，需在 manifest.json 宣告對應 permissions）
 *   3. 統一的錯誤處理（把錯誤顯示在工具自己的狀態列，不該拋給使用者看到）
 *
 * 開始寫你的工具：把 YOUR_LOGIC() 換成真正的邏輯即可。
 */

const tb = window.toolbox || {};
let LANG = window.__TOOL_LANG__ || 'en';

const I18N = {
  en: {
    title: '🧩 My New Tool',
    subtitle: 'Replace this line with a short description',
    inputPlaceholder: 'Paste text here, or open a file…',
    open: '📂 Open file',
    run: '⚡ Run',
    copy: '📋 Copy',
    save: '💾 Save',
    opened: 'File loaded',
    runDone: 'Done — {{n}} lines processed',
    copied: '✅ Copied to clipboard',
    saved: '✅ Saved',
    emptyInput: 'Nothing to process',
    error: 'Error: '
  },
  zh: {
    title: '🧩 我的新工具',
    subtitle: '用一句话描述这个工具的用途',
    inputPlaceholder: '在此粘贴文字，或打开文件…',
    open: '📂 打开文件',
    run: '⚡ 执行',
    copy: '📋 复制',
    save: '💾 保存',
    opened: '文件已载入',
    runDone: '完成 — 已处理 {{n}} 行',
    copied: '✅ 已复制到剪贴板',
    saved: '✅ 已保存',
    emptyInput: '没有内容可处理',
    error: '错误：'
  },
  'zh-TW': {
    title: '🧩 我的新工具',
    subtitle: '用一句話描述這個工具的用途',
    inputPlaceholder: '在此貼上文字，或打開文件…',
    open: '📂 打開文件',
    run: '⚡ 執行',
    copy: '📋 複製',
    save: '💾 儲存',
    opened: '文件已載入',
    runDone: '完成 — 已處理 {{n}} 行',
    copied: '✅ 已複製到剪貼板',
    saved: '✅ 已儲存',
    emptyInput: '沒有內容可處理',
    error: '錯誤：'
  },
  jp: {
    title: '🧩 新しいツール',
    subtitle: 'このツールの用途を一言で説明',
    inputPlaceholder: 'テキストを貼り付けるか、ファイルを開いてください…',
    open: '📂 ファイルを開く',
    run: '⚡ 実行',
    copy: '📋 コピー',
    save: '💾 保存',
    opened: 'ファイルを読み込みました',
    runDone: '完了 — {{n}} 行を処理しました',
    copied: '✅ クリップボードにコピーしました',
    saved: '✅ 保存しました',
    emptyInput: '処理する内容がありません',
    error: 'エラー：'
  }
};

const t = (k, vars) => {
  let s = (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
  if (vars) for (const [key, val] of Object.entries(vars)) s = s.replace('{{' + key + '}}', val);
  return s;
};

/* ---------- UI ---------- */

const inputEl = document.getElementById('input');
const statusEl = document.getElementById('status');

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'status err' : 'status';
}

/** 把 data-i18n / data-i18n-ph 的內容套上目前語系 */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
  document.title = (I18N[LANG] && I18N[LANG].title) || 'My New Tool';
}

/* ---------- 你的邏輯：替換這裡 ---------- */

function YOUR_LOGIC(text) {
  return [...new Set(text.split(/\r?\n/))].sort().join('\n'); // 範例：去重 + 排序
}

/* ---------- Tool API 用法 ---------- */

document.getElementById('btn-open').addEventListener('click', async () => {
  try {
    // 需要 permissions: dialog + file:read
    const res = await tb.openFile({ filters: [{ name: 'Text', extensions: ['txt', 'md', 'csv'] }] });
    if (res.canceled || !res.filePaths.length) return;
    inputEl.value = await tb.readTextFile(res.filePaths[0]);
    setStatus(t('opened'));
  } catch (e) {
    setStatus(t('error') + e.message, true);
  }
});

document.getElementById('btn-run').addEventListener('click', () => {
  try {
    if (!inputEl.value.trim()) { setStatus(t('emptyInput'), true); return; }
    const out = YOUR_LOGIC(inputEl.value);
    inputEl.value = out;
    setStatus(t('runDone', { n: out.split('\n').length }));
  } catch (e) {
    setStatus(t('error') + e.message, true);
  }
});

document.getElementById('btn-copy').addEventListener('click', async () => {
  try {
    // 需要 permissions: clipboard
    await tb.copyToClipboard(inputEl.value);
    setStatus(t('copied'));
  } catch (e) {
    setStatus(t('error') + e.message, true);
  }
});

document.getElementById('btn-save').addEventListener('click', async () => {
  try {
    // 需要 permissions: dialog + file:write
    const res = await tb.saveFile({ defaultPath: 'output.txt', filters: [{ name: 'Text', extensions: ['txt'] }] });
    if (res.canceled || !res.filePath) return;
    await tb.writeTextFile(res.filePath, inputEl.value);
    // 需要 permissions: notify
    await tb.notify({ title: 'My New Tool', body: t('saved') });
    setStatus(t('saved'));
  } catch (e) {
    setStatus(t('error') + e.message, true);
  }
});

applyI18n();/** 偵測介面語言：注入的 lang.js → 主程式 getLocale() → 瀏覽器語言，全失敗才用英文 */
async function detectLang() {
  let l = window.__TOOL_LANG__ || null;
  if (!l && tb && typeof tb.getLocale === 'function') {
    try { l = await tb.getLocale(); } catch (_e) { l = null; }
  }
  if (!l) { try { l = navigator.language; } catch (_e) { l = null; } }
  if (!l) return;
  const n = String(l).toLowerCase();
  const code = n.indexOf('zh') === 0 && /tw|hk|mo|hant/.test(n) ? 'zh-TW'  // 繁體：zh-TW / zh-HK / zh-MO / zh-Hant…
    : n.indexOf('zh') === 0 ? 'zh'                                          // 簡體：zh / zh-CN…
    : (n.indexOf('ja') === 0 || n.indexOf('jp') === 0) ? 'jp'
    : n.indexOf('en') === 0 ? 'en' : null;
  if (code && I18N[code]) LANG = code;
}


