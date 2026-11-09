'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'📐 Unit Converter', subtitle:'Length · Weight · Temperature · Data · Area · Speed — all local',
    length:'Length', weight:'Weight', temperature:'Temp', data:'Data', area:'Area', speed:'Speed',
    eq:'=' },
  zh: { title:'📐 单位换算器', subtitle:'长度 · 重量 · 温度 · 数据量 · 面积 · 速度 —— 全部本地计算',
    length:'长度', weight:'重量', temperature:'温度', data:'数据量', area:'面积', speed:'速度',
    unit:'单位', result:'结果', eq:'=' },
  'zh-TW': { title:'📐 單位換算器', subtitle:'長度 · 重量 · 溫度 · 資料量 · 面積 · 速度 —— 全部本地計算',
    length:'長度', weight:'重量', temperature:'溫度', data:'資料量', area:'面積', speed:'速度',
    unit:'單位', result:'結果', eq:'=' },
  jp: { title:'📐 単位変換ツール', subtitle:'長さ・重さ・温度・データ量・面積・速度 — すべてローカル計算',
    length:'長さ', weight:'重さ', temperature:'温度', data:'データ量', area:'面積', speed:'速度',
    unit:'単位', result:'結果', eq:'=' }
};
// 補充的單位中/日名（I18N 之外的靜態表）
const UNIT_NAMES = {
  mm:['mm','毫米','mm'], cm:['cm','厘米','cm'], m:['m','米','m'], km:['km','公里','km'], in:['in','英寸','in'], ft:['ft','英尺','ft'], mi:['mi','英里','mi'],
  mg:['mg','毫克','mg'], g:['g','克','g'], kg:['kg','千克','kg'], t:['t','吨','t'], oz:['oz','盎司','oz'], lb:['lb','磅','lb'],
  c:['°C','摄氏度','°C'], f:['°F','华氏度','°F'], k:['K','开尔文','K'],
  b:['B','字节','B'], kb:['KB','KB','KB'], mb:['MB','MB','MB'], gb:['GB','GB','GB'], tb:['TB','TB','TB'],
  m2:['m²','平方米','m²'], km2:['km²','平方公里','km²'], ha:['ha','公顷','ha'], ft2:['ft²','平方英尺','ft²'], ping:['ping','坪','坪'],
  ms:['m/s','米/秒','m/s'], kmh:['km/h','公里/小时','km/h'], mph:['mph','英里/小时','mph'], kn:['kn','节','kn']
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const uname = (u) => UNIT_NAMES[u][LANG === 'zh' ? 1 : LANG === 'jp' ? 2 : 0];

// 各類別：單位 → 換算成「基準單位」的倍率
const CATS = {
  length: { base: 'm', units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, mi: 1609.344 } },
  weight: { base: 'kg', units: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.0283495, lb: 0.453592 } },
  temperature: { base: 'c', units: { c: 1, f: 1, k: 1 } },
  data: { base: 'b', units: { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 } },
  area: { base: 'm2', units: { m2: 1, km2: 1e6, ha: 1e4, ft2: 0.092903, ping: 3.30579 } },
  speed: { base: 'ms', units: { ms: 1, kmh: 1 / 3.6, mph: 0.44704, kn: 0.514444 } }
};

function toBase(cat, unit, v) {
  if (cat === 'temperature') {
    if (unit === 'c') return v;
    if (unit === 'f') return (v - 32) * 5 / 9;
    return v - 273.15;
  }
  return v * CATS[cat].units[unit];
}
function fromBase(cat, unit, v) {
  if (cat === 'temperature') {
    if (unit === 'c') return v;
    if (unit === 'f') return v * 9 / 5 + 32;
    return v + 273.15;
  }
  return v / CATS[cat].units[unit];
}

let cat = 'length';
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));

function renderTabs() {
  const labels = { length: 'length', weight: 'weight', temperature: 'temperature', data: 'data', area: 'area', speed: 'speed' };
  $('tabs').innerHTML = Object.keys(CATS).map((k) =>
    `<button class="tab${k === cat ? ' active' : ''}" data-cat="${k}">${t(labels[k])}</button>`).join('');
}
function renderSelects() {
  const keys = Object.keys(CATS[cat].units);
  const opts = (sel) => keys.map((u) => `<option value="${u}"${u === sel ? ' selected' : ''}>${uname(u)}</option>`).join('');
  $('from').innerHTML = opts(keys[0]);
  $('to').innerHTML = opts(keys[1] || keys[0]);
}
function convert() {
  const v = parseFloat($('val').value);
  if (!isFinite(v)) { $('out').textContent = '—'; return; }
  const r = fromBase(cat, $('to').value, toBase(cat, $('from').value, v));
  const n = Math.abs(r) >= 1000 || (Math.abs(r) < 0.001 && r !== 0) ? r.toExponential(4) : parseFloat(r.toFixed(6)).toString();
  $('out').textContent = `${n} ${uname($('to').value)}`;
}

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  cat = b.getAttribute('data-cat');
  renderTabs(); renderSelects(); convert();
});
$('val').addEventListener('input', convert);
$('from').addEventListener('change', convert);
$('to').addEventListener('change', convert);
$('btn-swap').addEventListener('click', () => {
  const f = $('from').value; $('from').value = $('to').value; $('to').value = f; convert();
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
  const code = n.indexOf('zh') === 0 && /tw|hk|mo|hant/.test(n) ? 'zh-TW'  // 繁體：zh-TW / zh-HK / zh-MO / zh-Hant…
    : n.indexOf('zh') === 0 ? 'zh'                                          // 簡體：zh / zh-CN…
    : (n.indexOf('ja') === 0 || n.indexOf('jp') === 0) ? 'jp'
    : n.indexOf('en') === 0 ? 'en' : null;
  if (code && I18N[code]) LANG = code;
}

(async () => {
  await detectLang();
  applyI18n();
  renderTabs(); renderSelects(); convert();
})();
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.title = I18N[LANG].title;
}
