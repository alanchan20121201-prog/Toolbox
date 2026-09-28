'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'💰 Simple Expense Tracker', subtitle:'Income & expenses stored locally (encrypted). Nothing is uploaded.',
    expense:'Expense', income:'Income', notePh:'Note (e.g. lunch)', amountPh:'Amount', add:'Add',
    totalIn:'Income', totalOut:'Expense', balance:'Balance', searchPh:'🔍 Filter by note…',
    empty:'No records yet', needAmount:'Please enter a valid amount', saved:'✅ Saved', deleted:'🗑️ Deleted',
    loadError:'Load failed: ', saveError:'Save failed: ' },
  zh: { title:'💰 简易记账', subtitle:'收支记录在本机并加密保存，不会上传到任何地方。',
    expense:'支出', income:'收入', notePh:'备注（如：午餐）', amountPh:'金额', add:'添加',
    totalIn:'收入', totalOut:'支出', balance:'结余', searchPh:'🔍 按备注筛选…',
    empty:'还没有记录', needAmount:'请输入有效金额', saved:'✅ 已保存', deleted:'🗑️ 已删除',
    loadError:'读取失败：', saveError:'保存失败：' },
  jp: { title:'💰 簡易家計簿', subtitle:'収支を端末内に暗号化保存。アップロードは一切ありません。',
    expense:'支出', income:'収入', notePh:'メモ（例：昼食）', amountPh:'金額', add:'追加',
    totalIn:'収入', totalOut:'支出', balance:'残高', searchPh:'🔍 メモで絞り込み…',
    empty:'記録はまだありません', needAmount:'有効な金額を入力してください', saved:'✅ 保存しました', deleted:'🗑️ 削除しました',
    loadError:'読み込み失敗：', saveError:'保存失敗：' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;

const KEY = 'entries';
let items = [];
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmt = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
  document.title = I18N[LANG].title;
}

function setStatus(msg, isErr) { const el = $('status'); el.textContent = msg; el.className = 'status' + (isErr ? ' err' : ''); }

function render() {
  const q = $('search').value.trim().toLowerCase();
  const shown = q ? items.filter((x) => x.note.toLowerCase().includes(q)) : items;
  let ti = 0, to = 0;
  items.forEach((x) => x.type === 'in' ? ti += x.amount : to += x.amount);
  $('t-in').textContent = fmt(ti);
  $('t-out').textContent = fmt(to);
  $('t-bal').textContent = fmt(ti - to);
  $('t-bal').style.color = ti - to < 0 ? 'var(--red)' : 'var(--text)';
  $('list').innerHTML = shown.length ? shown.map((x) => `
    <div class="item" data-id="${esc(x.id)}">
      <div class="info"><div class="note">${esc(x.note || '—')}</div><div class="date">${esc(x.date)}</div></div>
      <span class="amt ${x.type}">${x.type === 'in' ? '+' : '−'} ${fmt(x.amount)}</span>
      <button class="btn danger" data-del>🗑</button>
    </div>`).join('') : `<div class="empty">${esc(t('empty'))}</div>`;
}

async function load() {
  try {
    const raw = await tb.storageGet(KEY);
    items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) items = [];
  } catch (e) { setStatus(t('loadError') + e.message, true); }
  render();
}

async function save() { await tb.storageSet(KEY, JSON.stringify(items)); }

$('btn-add').addEventListener('click', async () => {
  const amount = parseFloat($('amount').value);
  if (!isFinite(amount) || amount <= 0) { setStatus(t('needAmount'), true); return; }
  items.unshift({
    id: Date.now() + '-' + Math.floor(Math.random() * 1e6),
    type: $('type').value, note: $('note').value.trim(), amount,
    date: new Date().toLocaleString()
  });
  try { await save(); $('note').value = ''; $('amount').value = ''; setStatus(t('saved')); render(); }
  catch (e) { setStatus(t('saveError') + e.message, true); }
});

$('list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;
  const id = btn.closest('.item').getAttribute('data-id');
  items = items.filter((x) => x.id !== id);
  try { await save(); setStatus(t('deleted')); render(); }
  catch (err) { setStatus(t('saveError') + err.message, true); }
});
$('search').addEventListener('input', render);

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
