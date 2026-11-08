'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'📊 Text Statistics', subtitle:'Live counts while you type.',
    ph:'Type or paste text…', chars:'Characters', charsNs:'No spaces', words:'Words',
    cjk:'CJK chars', lines:'Lines', read:'Read (min)', unit:'min' },
  zh: { title:'📊 文字统计', subtitle:'边输入边统计。',
    ph:'输入或粘贴文本…', chars:'字符数', charsNs:'不含空格', words:'单词数',
    cjk:'中文字数', lines:'行数', read:'阅读时间(分)', unit:'分钟' },
  jp: { title:'📊 文字数カウンター', subtitle:'入力しながらリアルタイム集計。',
    ph:'テキストを入力・貼り付け…', chars:'文字数', charsNs:'空白除く', words:'単語数',
    cjk:'漢字かな文字数', lines:'行数', read:'読了時間(分)', unit:'分' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
  document.title = I18N[LANG].title;
}

function run() {
  const s = $('inp').value;
  const chars = [...s].length;
  const noSpace = [...s.replace(/\s/g, '')].length;
  const cjk = (s.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const words = (s.match(/[A-Za-z0-9_'’\-]+/g) || []).length;
  const lines = s === '' ? 0 : s.split('\n').length;
  // 閱讀時間：中文約每分鐘 300 字、英文約每分鐘 200 詞
  const minutes = Math.max((cjk / 300) + (words / 200), s ? 1 / 60 : 0);
  const readStr = minutes < 1 ? '< 1 ' + t('unit') : Math.round(minutes) + ' ' + t('unit');
  $('s-chars').textContent = chars;
  $('s-ns').textContent = noSpace;
  $('s-words').textContent = words;
  $('s-cjk').textContent = cjk;
  $('s-lines').textContent = lines;
  $('s-read').textContent = readStr;
}
$('inp').addEventListener('input', run);

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
