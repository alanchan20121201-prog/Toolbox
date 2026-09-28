'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'⏱ Timestamp Converter', subtitle:'Unix timestamp ⇄ human date, fully local.',
    now:'Current time (updates every second)', stampPh:'e.g. 1727500000 or 1727500000123', convert:'Convert',
    s2dLabel:'Timestamp → date (seconds or milliseconds, auto-detected)',
    d2sLabel:'Date → timestamp',
    invalid:'Invalid timestamp', local:'Local', utc:'UTC' },
  zh: { title:'⏱ 时间戳转换', subtitle:'Unix 时间戳与日期互转，全部本地计算。',
    now:'当前时间（每秒更新）', stampPh:'例如 1727500000 或 1727500000123', convert:'转换',
    s2dLabel:'时间戳 → 日期（秒或毫秒，自动识别）',
    d2sLabel:'日期 → 时间戳',
    invalid:'无效的时间戳', local:'本地', utc:'UTC' },
  jp: { title:'⏱ タイムスタンプ変換', subtitle:'Unix タイムスタンプと日付の相互変換。すべてローカル。',
    now:'現在時刻（1秒ごと更新）', stampPh:'例：1727500000 または 1727500000123', convert:'変換',
    s2dLabel:'タイムスタンプ → 日付（秒/ミリ秒を自動判別）',
    d2sLabel:'日付 → タイムスタンプ',
    invalid:'無効なタイムスタンプ', local:'ローカル', utc:'UTC' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
  document.title = I18N[LANG].title;
}
const pad = (n) => String(n).padStart(2, '0');
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

$('btn-s2d').addEventListener('click', () => {
  const raw = $('stamp').value.trim();
  if (!/^\d{1,16}$/.test(raw)) { $('out-s2d').textContent = t('invalid'); return; }
  let n = Number(raw);
  if (raw.length >= 13) n = n;             // 毫秒
  else n = n * 1000;                        // 秒
  const d = new Date(n);
  if (isNaN(d.getTime())) { $('out-s2d').textContent = t('invalid'); return; }
  $('out-s2d').textContent = `${t('local')}: ${fmtDate(d)} | ${t('utc')}: ${d.toUTCString()}`;
});
$('stamp').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-s2d').click(); });

$('btn-d2s').addEventListener('click', () => {
  const v = $('dt').value;
  if (!v) { $('out-d2s').textContent = t('invalid'); return; }
  const d = new Date(v);
  const sec = Math.floor(d.getTime() / 1000);
  $('out-d2s').textContent = `${sec} (s) | ${d.getTime()} (ms)`;
});

setInterval(() => {
  const d = new Date();
  $('now-s').textContent = Math.floor(d.getTime() / 1000);
  $('now-ms').textContent = d.getTime();
}, 250);

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
