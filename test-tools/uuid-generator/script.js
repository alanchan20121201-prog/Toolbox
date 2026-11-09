'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🆔 UUID Generator', subtitle:'Random IDs from crypto.getRandomValues — no network.',
    count:'Count', type:'Type', gen:'🎲 Generate', copy:'📋 Copy',
    copied:'✅ Copied', copyErr:'Copy failed: ' },
  zh: { title:'🆔 UUID 生成器', subtitle:'使用 crypto.getRandomValues 的安全随机 ID，无网络。',
    count:'数量', type:'类型', gen:'🎲 生成', copy:'📋 复制',
    copied:'✅ 已复制', copyErr:'复制失败：' },
  'zh-TW': { title:'🆔 UUID 產生器', subtitle:'使用 crypto.getRandomValues 的安全隨機 ID，無網路。',
    count:'數量', type:'類型', gen:'🎲 產生', copy:'📋 複製',
    copied:'✅ 已複製', copyErr:'複製失敗：' },
  jp: { title:'🆔 UUID 生成ツール', subtitle:'crypto.getRandomValues による安全なランダム ID。ネットワーク不要。',
    count:'個数', type:'種類', gen:'🎲 生成', copy:'📋 コピー',
    copied:'✅ コピーしました', copyErr:'コピー失敗：' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.title = I18N[LANG].title;
}
function setStatus(msg, cls) { const el = $('status'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
function randomStr(len, pool) {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < len; i++) s += pool[buf[i] % pool.length];
  return s;
}
function uuidV4() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback：手動組 v4
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function genOne(type) {
  switch (type) {
    case 'upper': return uuidV4().toUpperCase();
    case 'short': return randomStr(8, ALPHABET.slice(0, 62));
    case 'nanoid': return randomStr(21, ALPHABET);
    default: return uuidV4();
  }
}

$('btn-gen').addEventListener('click', () => {
  const n = parseInt($('count').value, 10);
  const type = $('type').value;
  const list = Array.from({ length: n }, () => genOne(type));
  $('out').value = list.join('\n');
});
$('btn-copy').addEventListener('click', async () => {
  try { await tb.copyToClipboard($('out').value); setStatus(t('copied'), 'ok'); }
  catch (e) { setStatus(t('copyErr') + e.message, 'err'); }
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
  const code = n.indexOf('zh') === 0 && /tw|hk|mo|hant/.test(n) ? 'zh-TW'  // 繁體：zh-TW / zh-HK / zh-MO / zh-Hant…
    : n.indexOf('zh') === 0 ? 'zh'                                          // 簡體：zh / zh-CN…
    : (n.indexOf('ja') === 0 || n.indexOf('jp') === 0) ? 'jp'
    : n.indexOf('en') === 0 ? 'en' : null;
  if (code && I18N[code]) LANG = code;
}

(async () => {
  await detectLang();
  applyI18n();
  $('btn-gen').click();
})();
