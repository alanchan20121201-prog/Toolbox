'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🧾 JSON Formatter', subtitle:'Format / minify / validate — 100% local.',
    ph:'Paste JSON here…', format:'✨ Format', minify:'📦 Minify', copy:'📋 Copy', clear:'Clear',
    valid:'✅ Valid JSON', invalid:'❌ Invalid JSON: ', copied:'✅ Copied', copyErr:'Copy failed: ' },
  zh: { title:'🧾 JSON 工具', subtitle:'格式化 / 压缩 / 校验 —— 全部本地处理。',
    ph:'在此粘贴 JSON…', format:'✨ 格式化', minify:'📦 压缩', copy:'📋 复制', clear:'清空',
    valid:'✅ JSON 格式正确', invalid:'❌ JSON 错误：', copied:'✅ 已复制', copyErr:'复制失败：' },
  jp: { title:'🧾 JSON フォーマッター', subtitle:'整形 / 圧縮 / 検証 — 完全ローカル。',
    ph:'ここに JSON を貼り付け…', format:'✨ 整形', minify:'📦 圧縮', copy:'📋 コピー', clear:'クリア',
    valid:'✅ 正しい JSON です', invalid:'❌ JSON エラー：', copied:'✅ コピーしました', copyErr:'コピー失敗：' }
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

function run(indent) {
  const raw = $('inp').value;
  try {
    const obj = JSON.parse(raw);
    $('inp').value = JSON.stringify(obj, null, indent);
    setStatus(t('valid'), 'ok');
  } catch (e) {
    // 嘗試指出錯誤位置（取訊息裡的 position）
    const m = /position (\d+)/i.exec(e.message);
    let extra = '';
    if (m) {
      const pos = Number(m[1]);
      const line = raw.slice(0, pos).split('\n').length;
      extra = ` (line ${line})`;
    }
    setStatus(t('invalid') + e.message + extra, 'err');
  }
}
$('btn-fmt').addEventListener('click', () => run(2));
$('btn-min').addEventListener('click', () => run(0));
$('btn-copy').addEventListener('click', async () => {
  try { await tb.copyToClipboard($('inp').value); setStatus(t('copied'), 'ok'); }
  catch (e) { setStatus(t('copyErr') + e.message, 'err'); }
});
$('btn-clear').addEventListener('click', () => { $('inp').value = ''; setStatus(''); });

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
