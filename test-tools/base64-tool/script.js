'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🔤 Base64 Converter', subtitle:'UTF-8 safe encode / decode, 100% local.',
    inLabel:'Input', inPh:'Type or paste text / Base64…', outLabel:'Output',
    encode:'→ Encode', decode:'← Decode', copy:'📋 Copy', clear:'Clear',
    copied:'✅ Copied', copyErr:'Copy failed: ', invalid:'❌ Not valid Base64' },
  zh: { title:'🔤 Base64 转换', subtitle:'支持中文的编解码，全部本地处理。',
    inLabel:'输入', inPh:'输入或粘贴文本 / Base64…', outLabel:'输出',
    encode:'→ 编码', decode:'← 解码', copy:'📋 复制', clear:'清空',
    copied:'✅ 已复制', copyErr:'复制失败：', invalid:'❌ 不是有效的 Base64' },
  jp: { title:'🔤 Base64 変換', subtitle:'UTF-8 対応のエンコード / デコード。完全ローカル。',
    inLabel:'入力', inPh:'テキスト / Base64 を貼り付け…', outLabel:'出力',
    encode:'→ エンコード', decode:'← デコード', copy:'📋 コピー', clear:'クリア',
    copied:'✅ コピーしました', copyErr:'コピー失敗：', invalid:'❌ 有効な Base64 ではありません' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
  document.title = I18N[LANG].title;
}
function setStatus(msg, cls) { const el = $('status'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

// UTF-8 安全的 Base64
const b64encode = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
function b64decode(s) {
  const bin = atob(s.replace(/\s+/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

$('btn-enc').addEventListener('click', () => {
  try { $('out').value = b64encode($('inp').value); setStatus(''); }
  catch (e) { setStatus(e.message, 'err'); }
});
$('btn-dec').addEventListener('click', () => {
  try { $('out').value = b64decode($('inp').value); setStatus(''); }
  catch (e) { setStatus(t('invalid'), 'err'); }
});
$('btn-copy').addEventListener('click', async () => {
  try { await tb.copyToClipboard($('out').value); setStatus(t('copied'), 'ok'); }
  catch (e) { setStatus(t('copyErr') + e.message, 'err'); }
});
$('btn-clear').addEventListener('click', () => { $('inp').value = ''; $('out').value = ''; setStatus(''); });

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
