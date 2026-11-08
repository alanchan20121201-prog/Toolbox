'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'📝 Quick Notes', subtitle:'Notes are saved on this computer (encrypted). Click a title to open it.',
    ttlPh:'Title', bodyPh:'Write something…', save:'💾 Save', new:'📄 New', del:'🗑 Delete this note',
    empty:'No notes yet', saved:'✅ Saved', needTitle:'Please enter a title', deleted:'🗑️ Deleted',
    nothingOpen:'No note is open', loadError:'Load failed: ', saveError:'Save failed: ' },
  zh: { title:'📝 快速记事本', subtitle:'记事保存在本机（加密）。点击标题即可打开。',
    ttlPh:'标题', bodyPh:'写点什么…', save:'💾 保存', new:'📄 新建', del:'🗑 删除此笔记',
    empty:'还没有笔记', saved:'✅ 已保存', needTitle:'请输入标题', deleted:'🗑️ 已删除',
    nothingOpen:'当前没有打开的笔记', loadError:'读取失败：', saveError:'保存失败：' },
  jp: { title:'📝 クイックメモ', subtitle:'メモは端末内に暗号化保存。タイトルをクリックで開きます。',
    ttlPh:'タイトル', bodyPh:'何か書いて…', save:'💾 保存', new:'📄 新規', del:'🗑 このメモを削除',
    empty:'メモはまだありません', saved:'✅ 保存しました', needTitle:'タイトルを入力してください', deleted:'🗑️ 削除しました',
    nothingOpen:'開いているメモはありません', loadError:'読み込み失敗：', saveError:'保存失敗：' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
let notes = [];
let currentId = null;

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
  document.title = I18N[LANG].title;
}
function setStatus(msg, isErr) { const el = $('status'); el.textContent = msg; el.className = 'status' + (isErr ? ' err' : ''); }

function render() {
  $('notes').innerHTML = notes.length ? notes.map((n) => `
    <div class="note" data-id="${esc(n.id)}">
      <span class="ttl" data-open>${esc(n.title)}</span>
      <span class="dt">${esc(new Date(n.updatedAt).toLocaleDateString())}</span>
      <button class="btn" data-open>📂</button>
    </div>`).join('') : `<div class="empty">${esc(t('empty'))}</div>`;
}
function openNote(n) {
  currentId = n.id;
  $('ttl').value = n.title;
  $('body').value = n.body;
}
function resetEditor() {
  currentId = null; $('ttl').value = ''; $('body').value = '';
}

async function persist() { await tb.storageSet('notes', JSON.stringify(notes)); }

$('btn-save').addEventListener('click', async () => {
  const title = $('ttl').value.trim();
  if (!title) { setStatus(t('needTitle'), true); return; }
  const body = $('body').value;
  if (currentId) {
    const n = notes.find((x) => x.id === currentId);
    n.title = title; n.body = body; n.updatedAt = Date.now();
  } else {
    currentId = Date.now() + '-' + Math.floor(Math.random() * 1e6);
    notes.unshift({ id: currentId, title, body, updatedAt: Date.now() });
  }
  notes.sort((a, b) => b.updatedAt - a.updatedAt);
  try { await persist(); setStatus(t('saved')); render(); }
  catch (e) { setStatus(t('saveError') + e.message, true); }
});

$('btn-new').addEventListener('click', () => { resetEditor(); $('ttl').focus(); });

$('btn-del').addEventListener('click', async () => {
  if (!currentId) { setStatus(t('nothingOpen'), true); return; }
  notes = notes.filter((x) => x.id !== currentId);
  resetEditor();
  try { await persist(); setStatus(t('deleted')); render(); }
  catch (e) { setStatus(t('saveError') + e.message, true); }
});

$('notes').addEventListener('click', (e) => {
  const el = e.target.closest('[data-open]');
  if (!el) return;
  const n = notes.find((x) => x.id === el.closest('.note').getAttribute('data-id'));
  if (n) openNote(n);
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
  try {
    const raw = await tb.storageGet('notes');
    notes = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(notes)) notes = [];
  } catch (e) { setStatus(t('loadError') + e.message, true); }
  render();
})();
