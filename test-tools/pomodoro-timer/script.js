'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🍅 Pomodoro Timer', subtitle:'Focus in cycles. A notification pops when time is up.',
    work:'🍅 Focus', rest:'☕ Break', start:'▶ Start', pause:'⏸ Pause', reset:'↺ Reset', restBtn:'☕ Break now',
    workLen:'Work', restLen:'Break', min:'min', doneWork:'🍅 Focus session done! Take a break.',
    doneRest:'☕ Break over — back to work!', sessions:(n)=>n+' session(s) completed' },
  zh: { title:'🍅 番茄钟', subtitle:'专注-休息循环，结束时弹系统通知。',
    work:'🍅 专注中', rest:'☕ 休息中', start:'▶ 开始', pause:'⏸ 暂停', reset:'↺ 重置', restBtn:'☕ 直接休息',
    workLen:'专注', restLen:'休息', min:'分钟', doneWork:'🍅 专注结束！休息一下吧。',
    doneRest:'☕ 休息结束——继续加油！', sessions:(n)=>'已完成 '+n+' 个番茄' },
  jp: { title:'🍅 ポモドーロタイマー', subtitle:'集中と休憩のサイクル。終了時に通知します。',
    work:'🍅 集中中', rest:'☕ 休憩中', start:'▶ 開始', pause:'⏸ 一時停止', reset:'↺ リセット', restBtn:'☕ 休憩する',
    workLen:'集中', restLen:'休憩', min:'分', doneWork:'🍅 集中終了！休憩しましょう。',
    doneRest:'☕ 休憩終了 — 再開しましょう！', sessions:(n)=>n+' セッション完了' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.title = I18N[LANG].title;
}

let phase = 'work';           // work | rest
let remaining = 25 * 60;
let timer = null;
let sessions = 0;

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function paint() {
  const c = $('clock');
  c.textContent = fmt(remaining);
  c.className = 'clock ' + (phase === 'work' ? 'work' : 'rest');
  $('mode').textContent = phase === 'work' ? t('work') : t('rest');
  $('btn-start').textContent = timer ? t('pause') : t('start');
  $('count').textContent = t('sessions')(sessions);
}

function notify(title, body) {
  try { tb.notify({ title, body }); } catch (_e) {}
}

function tick() {
  remaining--;
  if (remaining <= 0) {
    if (phase === 'work') {
      sessions++;
      notify(t('title'), t('doneWork'));
      switchTo('rest');
    } else {
      notify(t('title'), t('doneRest'));
      switchTo('work');
    }
    return;
  }
  paint();
}

function switchTo(p) {
  phase = p;
  const mins = parseInt((p === 'work' ? $('work') : $('rest')).value, 10) || (p === 'work' ? 25 : 5);
  remaining = mins * 60;
  stop();
  paint();
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

$('btn-start').addEventListener('click', () => {
  if (timer) { stop(); paint(); return; }
  timer = setInterval(tick, 1000);
  paint();
});
$('btn-reset').addEventListener('click', () => { stop(); switchTo(phase); });
$('btn-rest').addEventListener('click', () => { switchTo('rest'); });
$('work').addEventListener('change', () => { if (!timer) switchTo(phase); });
$('rest').addEventListener('change', () => { if (!timer) switchTo(phase); });

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
  paint();
})();
