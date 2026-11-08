'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'✅ To-Do List', subtitle:'Tasks are saved on this computer automatically.', ph:'New task…', add:'Add',
    empty:'Nothing to do — enjoy!', meta:(a,b)=>a+' open · '+b+' done', clearDone:'Clear finished',
    saved:'✅ Saved', loadError:'Load failed: ', saveError:'Save failed: ' },
  zh: { title:'✅ 待办清单', subtitle:'任务自动保存在本机，重启后仍在。', ph:'新任务…', add:'添加',
    empty:'没有待办——享受吧！', meta:(a,b)=>'未完成 '+a+' 项 · 已完成 '+b+' 项', clearDone:'清除已完成',
    saved:'✅ 已保存', loadError:'读取失败：', saveError:'保存失败：' },
  jp: { title:'✅ ToDo リスト', subtitle:'タスクは自動的に端末に保存され、再起動後も残ります。', ph:'新しいタスク…', add:'追加',
    empty:'タスクなし — ゆっくりどうぞ！', meta:(a,b)=>'未完了 '+a+' 件 · 完了 '+b+' 件', clearDone:'完了を削除',
    saved:'✅ 保存しました', loadError:'読み込み失敗：', saveError:'保存失敗：' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
let items = [];

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
  document.title = I18N[LANG].title;
}
function setStatus(msg, isErr) { const el = $('status'); el.textContent = msg; el.className = 'status' + (isErr ? ' err' : ''); }

function render() {
  const open = items.filter((x) => !x.done).length;
  $('meta').textContent = t('meta')(open, items.length - open);
  $('list').innerHTML = items.length ? items.map((x) => `
    <div class="item${x.done ? ' done' : ''}" data-id="${esc(x.id)}">
      <input type="checkbox" data-toggle ${x.done ? 'checked' : ''} />
      <span class="txt">${esc(x.text)}</span>
      <button class="btn" data-del>🗑</button>
    </div>`).join('') : `<div class="empty">${esc(t('empty'))}</div>`;
}

async function persist() {
  try { await tb.storageSet('todos', JSON.stringify(items)); setStatus(t('saved')); }
  catch (e) { setStatus(t('saveError') + e.message, true); }
}

async function load() {
  try {
    const raw = await tb.storageGet('todos');
    items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) items = [];
  } catch (e) { setStatus(t('loadError') + e.message, true); }
  render();
}

$('btn-add').addEventListener('click', async () => {
  const text = $('inp').value.trim();
  if (!text) return;
  items.unshift({ id: Date.now() + '-' + Math.floor(Math.random() * 1e6), text, done: false });
  $('inp').value = '';
  await persist(); render();
});
$('inp').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-add').click(); });

$('list').addEventListener('click', async (e) => {
  const box = e.target.closest('[data-toggle]');
  const del = e.target.closest('[data-del]');
  if (!box && !del) return;
  const id = e.target.closest('.item').getAttribute('data-id');
  if (box) items.find((x) => x.id === id).done = box.checked;
  if (del) items = items.filter((x) => x.id !== id);
  await persist(); render();
});
$('btn-clear').addEventListener('click', async () => {
  items = items.filter((x) => !x.done);
  await persist(); render();
});

/** 偵測介面語言：注入的 lang.js → 主程式 getLocale() → 瀏覽器語言，全失敗才用英文 */
async function detectLang() {
  let l = window.__TOOL_LANG__ || null;
  if (!l && tb && typeof tb.getLocale === 'function') {
    try { l = await tb.getLocale(); } catch (_e) { l = null; }
  }
  if (!l) { try { l = navigator.language; } catch (_e) { l = null; } }
  if (!l) return;
  const n = String(l).toLowerCase();
  const code = n.indexOf('zh') === 0 ? 'zh'   // zh / zh-CN / zh-TW…
    : (n.indexOf('ja') === 0 || n.indexOf('jp') === 0) ? 'jp'
    : n.indexOf('en') === 0 ? 'en' : null;
  if (code && I18N[code]) LANG = code;
}

(async () => {
  await detectLang();
  applyI18n();
  await load();
})();
