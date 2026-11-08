'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🔤 Case Converter', subtitle:'Type anything — all naming conventions update live.',
    ph:'e.g. "hello world example" or "HelloWorld_Example"', copy:'copy',
    copied:'✅ Copied', copyErr:'Copy failed: ' },
  zh: { title:'🔤 命名格式转换', subtitle:'输入任意文字，所有命名格式实时更新。',
    ph:'例如 "hello world example" 或 "HelloWorld_Example"', copy:'复制',
    copied:'✅ 已复制', copyErr:'复制失败：' },
  jp: { title:'🔤 ケース変換ツール', subtitle:'入力すると全ケースがリアルタイム更新。',
    ph:'例："hello world example" など', copy:'コピー',
    copied:'✅ コピーしました', copyErr:'コピー失敗：' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
  document.title = I18N[LANG].title;
}

/** 拆詞：支援 camelCase、PascalCase、snake、kebab、空格、連續大寫 */
function words(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

const FORMATS = [
  ['camelCase',      (w) => w.map((x, i) => i ? cap(x) : x).join('')],
  ['PascalCase',     (w) => w.map(cap).join('')],
  ['snake_case',     (w) => w.join('_')],
  ['kebab-case',     (w) => w.join('-')],
  ['CONSTANT_CASE',  (w) => w.join('_').toUpperCase()],
  ['Title Case',     (w) => w.map(cap).join(' ')],
  ['lower case',     (w) => w.join(' ')],
  ['UPPER CASE',     (w) => w.join(' ').toUpperCase()]
];

function run() {
  const w = words($('inp').value);
  $('out').innerHTML = FORMATS.map(([name, fn]) => `
    <div class="conv">
      <span class="name">${esc(name)}</span>
      <span class="val">${esc(w.length ? fn(w) : '—')}</span>
      <button class="btn" data-val="${esc(w.length ? fn(w) : '')}">${esc(t('copy'))}</button>
    </div>`).join('');
}

$('inp').addEventListener('input', run);
$('out').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-val]');
  if (!btn || !btn.getAttribute('data-val')) return;
  try { await tb.copyToClipboard(btn.getAttribute('data-val')); setStatus(t('copied'), 'ok'); }
  catch (err) { setStatus(t('copyErr') + err.message, 'err'); }
});
function setStatus(msg, cls) { const el = $('status'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

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
  run();
})();
