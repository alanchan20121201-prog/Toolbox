'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🏦 Loan Calculator', subtitle:'Equal monthly payment (annuity) — all local.',
    principal:'Loan amount', rate:'Annual rate (%)', years:'Term (years)', calc:'Calculate',
    monthly:'Monthly payment', totalPay:'Total paid', totalInt:'Total interest', year:'Year',
    interest:'Interest paid', remain:'Remaining', needValid:'Please enter valid numbers' },
  zh: { title:'🏦 贷款计算器', subtitle:'等额本息月供计算，全部本地处理。',
    principal:'贷款金额', rate:'年利率 (%)', years:'期限（年）', calc:'计算',
    monthly:'每月月供', totalPay:'还款总额', totalInt:'总利息', year:'年份',
    interest:'支付利息', remain:'剩余本金', needValid:'请输入有效数字' },
  jp: { title:'🏦 ローン計算ツール', subtitle:'元利均等返済の計算。完全ローカル。',
    principal:'借入金額', rate:'年利 (%)', years:'期間（年）', calc:'計算',
    monthly:'月々の返済額', totalPay:'支払総額', totalInt:'総利息', year:'年',
    interest:'支払利息', remain:'残高', needValid:'有効な数値を入力してください' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.title = I18N[LANG].title;
}

$('btn-calc').addEventListener('click', () => {
  const P = parseFloat($('p').value);
  const annual = parseFloat($('r').value);
  const years = parseInt($('y').value, 10);
  if (!(P > 0) || !(annual >= 0) || !(years > 0)) { $('status').textContent = t('needValid'); return; }
  $('status').textContent = '';

  const months = years * 12;
  const mr = annual / 100 / 12;
  // 等额本息：M = P * r(1+r)^n / ((1+r)^n - 1)
  const M = mr === 0 ? P / months : P * mr * Math.pow(1 + mr, months) / (Math.pow(1 + mr, months) - 1);
  const total = M * months;

  $('results').hidden = false;
  $('o-monthly').textContent = fmt(M);
  $('o-total').textContent = fmt(total);
  $('o-int').textContent = fmt(total - P);

  // 逐年统计
  let bal = P, rows = '';
  for (let y = 1; y <= years; y++) {
    let pPaid = 0, iPaid = 0;
    for (let m = 0; m < 12; m++) {
      const interest = bal * mr;
      const principal = Math.min(M - interest, bal);
      bal -= principal;
      pPaid += principal; iPaid += interest;
    }
    rows += `<tr><td>${y}</td><td>${fmt(pPaid)}</td><td>${fmt(iPaid)}</td><td>${fmt(Math.max(bal, 0))}</td></tr>`;
  }
  $('table').hidden = false;
  $('table').querySelector('tbody').innerHTML = rows;
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
  $('btn-calc').click();
})();
