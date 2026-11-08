'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🔒 Hash Calculator', subtitle:'SHA family hashes computed locally via WebCrypto.',
    ph:'Text to hash…', calc:'🧮 Calculate', cmpPh:'Paste a hash to compare…', cmp:'Compare',
    match:'✅ MATCH', diff:'❌ Does not match any hash', calcFirst:'Calculate a hash first' },
  zh: { title:'🔒 哈希计算器', subtitle:'使用 WebCrypto 在本地计算 SHA 系列哈希。',
    ph:'输入要计算的文本…', calc:'🧮 计算', cmpPh:'粘贴要比对的哈希…', cmp:'比对',
    match:'✅ 一致', diff:'❌ 与任何哈希都不一致', calcFirst:'请先计算哈希' },
  jp: { title:'🔒 ハッシュ計算ツール', subtitle:'WebCrypto でローカル計算する SHA 系ハッシュ。',
    ph:'ハッシュ化するテキスト…', calc:'🧮 計算', cmpPh:'比較するハッシュを貼り付け…', cmp:'比較',
    match:'✅ 一致', diff:'❌ どのハッシュとも一致しません', calcFirst:'先にハッシュを計算してください' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
let lastHashes = {};

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
  document.title = I18N[LANG].title;
}

const ALGS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

$('btn-calc').addEventListener('click', async () => {
  const data = new TextEncoder().encode($('inp').value);
  const rows = [];
  for (const alg of ALGS) {
    const h = hex(await crypto.subtle.digest(alg, data));
    lastHashes[alg] = h;
    rows.push(`<div class="hash"><div class="alg">${alg}</div><div class="val">${h}</div></div>`);
  }
  $('hashes').hidden = false;
  $('hashes').innerHTML = rows.join('');
  $('cmp-status').textContent = '';
});

$('btn-cmp').addEventListener('click', () => {
  if (!Object.keys(lastHashes).length) { $('cmp-status').textContent = t('calcFirst'); return; }
  const expect = $('expect').value.trim().toLowerCase();
  const hit = Object.entries(lastHashes).find(([_a, h]) => h === expect);
  const el = $('cmp-status');
  el.textContent = hit ? `${t('match')} (${hit[0]})` : t('diff');
  el.className = 'status ' + (hit ? 'match' : 'diff');
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
})();
