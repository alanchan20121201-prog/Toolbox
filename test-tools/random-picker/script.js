'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🎲 Random Picker', subtitle:'Crypto-grade randomness, 100% local.',
    drawTitle:'🎟 Draw from a list', namesPh:'One name per line…', winners:'Winners',
    draw:'🎯 Draw', dice:'🎲 Dice ×', coin:'🪙 Flip coin', needNames:'Please enter at least one name',
    needMore:'Not enough names', heads:'Heads', tails:'Tails', diceTotal:'total' },
  zh: { title:'🎲 随机抽选', subtitle:'密码学级随机，全部本地计算。',
    drawTitle:'🎟 名单抽奖', namesPh:'每行一个名字…', winners:'中奖者',
    draw:'🎯 抽取', dice:'🎲 掷骰子 ×', coin:'🪙 抛硬币', needNames:'请至少输入一个名字',
    needMore:'名字数量不够', heads:'正面', tails:'反面', diceTotal:'总计' },
  jp: { title:'🎲 ランダム抽選ツール', subtitle:'暗号学的ランダム、完全ローカル。',
    drawTitle:'🎟 リストから抽選', namesPh:'1 行に 1 名…', winners:'当選者',
    draw:'🎯 抽選', dice:'🎲 サイコロ ×', coin:'🪙 コイン投げ', needNames:'1 名以上入力してください',
    needMore:'名前が足りません', heads:'表', tails:'裏', diceTotal:'合計' }
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

const randInt = (max) => { // [0, max)
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
};

$('btn-draw').addEventListener('click', () => {
  const names = $('names').value.split('\n').map((s) => s.trim()).filter(Boolean);
  const n = parseInt($('n').value, 10) || 1;
  if (!names.length) { $('status').textContent = t('needNames'); return; }
  if (n > names.length) { $('status').textContent = t('needMore'); return; }
  $('status').textContent = '';
  const pool = [...names];
  const winners = [];
  for (let i = 0; i < n; i++) winners.push(pool.splice(randInt(pool.length), 1)[0]);
  $('winners').innerHTML = winners.map((w) => `<b>🏆 ${esc(w)}</b>`).join('　');
});

$('btn-dice').addEventListener('click', () => {
  const n = parseInt($('dice-n').value, 10);
  const rolls = Array.from({ length: n }, () => randInt(6) + 1);
  const total = rolls.reduce((a, b) => a + b, 0);
  $('big').innerHTML = `${rolls.map((r) => '🎲 ' + r).join('　')} <small>${t('diceTotal')}: <b>${total}</b></small>`;
});

$('btn-coin').addEventListener('click', () => {
  $('big').innerHTML = randInt(2) ? `<b>${t('heads')}</b>` : `<b>${t('tails')}</b>`;
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
