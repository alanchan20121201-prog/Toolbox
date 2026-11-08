'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🔗 URL Encoder / Decoder', subtitle:'Percent-encode / decode + query-string parser, all local.',
    inLabel:'Input', ph:'URL or text…', outLabel:'Output', enc:'Encode component', dec:'Decode',
    copy:'📋 Copy', copied:'✅ Copied', copyErr:'Copy failed: ', invalid:'❌ Malformed encoding',
    key:'Parameter', val:'Value' },
  zh: { title:'🔗 URL 编解码', subtitle:'百分号编解码 + 查询参数解析，全部本地处理。',
    inLabel:'输入', ph:'网址或文本…', outLabel:'输出', enc:'编码组件', dec:'解码',
    copy:'📋 复制', copied:'✅ 已复制', copyErr:'复制失败：', invalid:'❌ 编码格式错误',
    key:'参数', val:'值' },
  jp: { title:'🔗 URL エンコード / デコード', subtitle:'パーセントエンコード / デコード + クエリ解析。すべてローカル。',
    inLabel:'入力', ph:'URL またはテキスト…', outLabel:'出力', enc:'コンポーネントをエンコード', dec:'デコード',
    copy:'📋 コピー', copied:'✅ コピーしました', copyErr:'コピー失敗：', invalid:'❌ 不正なエンコーディング',
    key:'パラメータ', val:'値' }
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
function setStatus(msg, cls) { const el = $('status'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

function renderQuery(text) {
  const qIdx = text.indexOf('?');
  const tbody = $('qtable').querySelector('tbody');
  if (qIdx < 0) { $('qtable').hidden = true; return; }
  const qs = text.slice(qIdx + 1);
  const rows = [];
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const k = i < 0 ? pair : pair.slice(0, i);
    const v = i < 0 ? '' : pair.slice(i + 1);
    try { rows.push([decodeURIComponent(k.replace(/\+/g, ' ')), decodeURIComponent(v.replace(/\+/g, ' '))]); }
    catch (_e) { rows.push([k, v]); }
  }
  if (!rows.length) { $('qtable').hidden = true; return; }
  $('qtable').hidden = false;
  tbody.innerHTML = rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
}

$('btn-enc').addEventListener('click', () => {
  $('out').value = encodeURIComponent($('inp').value);
  $('qtable').hidden = true; setStatus('');
});
$('btn-dec').addEventListener('click', () => {
  try {
    const out = decodeURIComponent($('inp').value.replace(/\+/g, ' '));
    $('out').value = out;
    renderQuery(out);
    setStatus('');
  } catch (_e) { setStatus(t('invalid'), 'err'); }
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
  const code = n.indexOf('zh') === 0 ? 'zh'   // zh / zh-CN / zh-TW…
    : (n.indexOf('ja') === 0 || n.indexOf('jp') === 0) ? 'jp'
    : n.indexOf('en') === 0 ? 'en' : null;
  if (code && I18N[code]) LANG = code;
}

(async () => {
  await detectLang();
  applyI18n();
})();
