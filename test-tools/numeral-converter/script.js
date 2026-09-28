'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🔢 Radix Converter', subtitle:'Type in any base — the others update live. Safe integers only.',
    invalid:'❌ Invalid number for this base', bits:'Binary view (8 / 16 / 32-bit)' },
  zh: { title:'🔢 进制转换', subtitle:'在任意进制输入，其他进制实时更新（仅限安全整数范围）。',
    invalid:'❌ 当前进制下不是有效数字', bits:'二进制位视图（8 / 16 / 32 位）' },
  jp: { title:'🔢 進数変換ツール', subtitle:'任意の進数で入力すると他がリアルタイム更新（安全な整数のみ）。',
    invalid:'❌ この進数では無効な数値です', bits:'2 進ビット表示（8 / 16 / 32 ビット）' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
const inputs = [...document.querySelectorAll('[data-r]')];

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.title = I18N[LANG].title;
}

function update(source) {
  const radix = Number(source.getAttribute('data-r'));
  const raw = source.value.trim().replace(/^0[bBoOxX]/, '');
  const status = $('status');
  if (raw === '' || !/^[0-9a-fA-F]+$/.test(raw)) {
    if (raw === '') { inputs.forEach((i) => { if (i !== source) i.value = ''; }); $('bits').hidden = true; status.textContent = ''; return; }
    status.textContent = t('invalid'); return;
  }
  const n = parseInt(raw, radix);
  if (!Number.isSafeInteger(n) || n < 0) { status.textContent = t('invalid'); return; }
  status.textContent = '';
  inputs.forEach((i) => { if (i !== source) i.value = n.toString(Number(i.getAttribute('data-r'))).toUpperCase(); });
  const bits = n.toString(2).padStart(8, '0');
  $('bits').hidden = false;
  $('bits').innerHTML = `${t('bits')}<br /><b>${bits}</b> <span style="color:var(--dim)">(8)</span><br /><b>${n.toString(2).padStart(16, '0')}</b> <span style="color:var(--dim)">(16)</span>`;
}

inputs.forEach((i) => i.addEventListener('input', () => update(i)));

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
