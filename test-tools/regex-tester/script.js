'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🧪 Regex Tester', subtitle:'Live match highlighting. Flags: g / i / m / s / u …',
    ph:'Test text…', noMatch:'No matches', count:(n)=>n+' match(es)', ok:'✅ Valid', invalid:'❌ Invalid regex: ' },
  zh: { title:'🧪 正则测试器', subtitle:'实时高亮匹配。标志：g / i / m / s / u …',
    ph:'测试文本…', noMatch:'没有匹配', count:(n)=>n+' 个匹配', ok:'✅ 语法正确', invalid:'❌ 无效正则：' },
  jp: { title:'🧪 正規表現テスター', subtitle:'マッチ箇所をライブ表示。フラグ：g / i / m / s / u …',
    ph:'テストテキスト…', noMatch:'マッチなし', count:(n)=>n+' 件のマッチ', ok:'✅ 正しい正規表現', invalid:'❌ 無効な正規表現：' }
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

function run() {
  const pat = $('pattern').value;
  const flags = [...new Set($('flags').value)].join('').replace(/[^gimsuy]/g, '');
  const text = $('test').value;
  const status = $('status');
  if (!pat) { $('hl').innerHTML = esc(text); $('matches').innerHTML = ''; status.textContent = ''; return; }
  let re;
  try { re = new RegExp(pat, flags.includes('g') ? flags : flags + 'g'); }
  catch (e) { status.textContent = t('invalid') + e.message; status.className = 'status err'; return; }

  const found = [];
  let m, guard = 0;
  while ((m = re.exec(text)) !== null) {
    found.push(m);
    if (m.index === re.lastIndex) re.lastIndex++; // 空匹配防死循環
    if (++guard > 10000) break;
  }
  status.textContent = t('ok'); status.className = 'status ok';

  // 高亮（由後往前替換避免位移）
  let html = esc(text);
  if (found.length) {
    const spans = found
      .filter((x) => x[0])
      .map((x) => [x.index, x.index + x[0].length])
      .sort((a, b) => b[0] - a[0]);
    for (const [s, e] of spans) {
      html = html.slice(0, s) + '<mark>' + html.slice(s, e) + '</mark>' + html.slice(e);
    }
  }
  $('hl').innerHTML = html || '&nbsp;';
  $('matches').innerHTML = found.length
    ? found.map((x, i) => `<div class="match">#${i + 1} @${x.index}: <b>${esc(x[0])}</b>${x.length > 1 ? ' ─ groups: [' + x.slice(1).map(esc).join(', ') + ']' : ''}</div>`).join('')
    : `<div class="match">${esc(t('noMatch'))}</div>`;
  $('status').textContent = t('count')(found.length);
}

$('pattern').addEventListener('input', run);
$('flags').addEventListener('input', run);
$('test').addEventListener('input', run);

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
