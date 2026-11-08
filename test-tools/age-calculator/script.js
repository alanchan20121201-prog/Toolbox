'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'📅 Date Calculator', subtitle:'Age · date difference · add or subtract time.',
    ageTitle:'🎂 Age from birthday', birth:'Birthday', calc:'Calculate',
    ageResult:(y,m,d,days)=>`<b>${y}</b> years <b>${m}</b> months <b>${d}</b> days — ${days} days lived`,
    diffTitle:'📆 Days between two dates', diffResult:(d,w)=>`<b>${d}</b> days (${w} weeks)`,
    addTitle:'➕ Add / subtract time', days:'day(s)', weeks:'week(s)', months:'month(s)', years:'year(s)',
    needDate:'Please pick a date', future:'(not born yet!)' },
  zh: { title:'📅 日期计算器', subtitle:'年龄 · 日期相差 · 日期加减。',
    ageTitle:'🎂 生日算年龄', birth:'生日', calc:'计算',
    ageResult:(y,m,d,days)=>`<b>${y}</b> 岁 <b>${m}</b> 个月 <b>${d}</b> 天 —— 已生活 ${days} 天`,
    diffTitle:'📆 两个日期相差', diffResult:(d,w)=>`相差 <b>${d}</b> 天（约 ${w} 周）`,
    addTitle:'➕ 日期加减', days:'天', weeks:'周', months:'月', years:'年',
    needDate:'请选择日期', future:'（还没出生哦！）' },
  jp: { title:'📅 日付計算ツール', subtitle:'年齢 · 日数差 · 日付の加減算。',
    ageTitle:'🎂 誕生日から年齢', birth:'誕生日', calc:'計算',
    ageResult:(y,m,d,days)=>`<b>${y}</b> 歳 <b>${m}</b> か月 <b>${d}</b> 日 — 生まれてから ${days} 日`,
    diffTitle:'📆 二つの日付の差', diffResult:(d,w)=>`差は <b>${d}</b> 日（約 ${w} 週間）`,
    addTitle:'➕ 日付の加減算', days:'日', weeks:'週', months:'か月', years:'年',
    needDate:'日付を選択してください', future:'（まだ生まれていません！）' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.title = I18N[LANG].title;
}

function ymd(a, b) { // a 之後到 b 的年月日
  let y = b.getFullYear() - a.getFullYear();
  let m = b.getMonth() - a.getMonth();
  let d = b.getDate() - a.getDate();
  if (d < 0) { m--; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  return [y, m, d];
}

$('btn-age').addEventListener('click', () => {
  if (!$('birth').value) { $('out-age').textContent = t('needDate'); return; }
  const b = new Date($('birth').value), now = new Date();
  const [y, m, d] = ymd(b, now);
  const days = Math.floor((now - b) / 86400000);
  $('out-age').innerHTML = y < 0 ? t('future') : t('ageResult')(y, m, d, days);
});

$('btn-diff').addEventListener('click', () => {
  if (!$('d1').value || !$('d2').value) { $('out-diff').textContent = t('needDate'); return; }
  const a = new Date($('d1').value), b = new Date($('d2').value);
  const days = Math.abs(Math.round((b - a) / 86400000));
  $('out-diff').innerHTML = t('diffResult')(days, Math.round(days / 7));
});

$('btn-add').addEventListener('click', () => {
  if (!$('base').value) { $('out-add').textContent = t('needDate'); return; }
  const d = new Date($('base').value);
  const n = parseInt($('delta').value, 10) || 0;
  const u = $('unit').value;
  if (u === 'd') d.setDate(d.getDate() + n);
  else if (u === 'w') d.setDate(d.getDate() + n * 7);
  else if (u === 'm') d.setMonth(d.getMonth() + n);
  else d.setFullYear(d.getFullYear() + n);
  $('out-add').innerHTML = `<b>${fmt(d)}</b> <span style="color:var(--dim)">(${d.toDateString()})</span>`;
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
  $('birth').value = '2000-01-01';
})();
