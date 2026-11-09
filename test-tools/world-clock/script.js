'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🌍 World Clock', subtitle:'Live time in major cities (uses your system clock).',
    today:'Today' },
  zh: { title:'🌍 世界时钟', subtitle:'全球主要城市实时时间（依你电脑的系统时钟）。',
    today:'今天' },
  'zh-TW': { title:'🌍 世界時鐘', subtitle:'全球主要城市即時時間（依你電腦的系統時鐘）。',
    today:'今天' },
  jp: { title:'🌍 世界時計', subtitle:'世界の主要都市のライブ時刻（端末の時計ベース）。',
    today:'今日' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));

const CITY_NAMES = {
  'Asia/Taipei': ['Taipei', '台北', '台北'],
  'Asia/Shanghai': ['Beijing / Shanghai', '北京/上海', '北京/上海'],
  'Asia/Hong_Kong': ['Hong Kong', '香港', '香港'],
  'Asia/Tokyo': ['Tokyo', '东京', '東京'],
  'Asia/Seoul': ['Seoul', '首尔', 'ソウル'],
  'Asia/Singapore': ['Singapore', '新加坡', 'シンガポール'],
  'Asia/Bangkok': ['Bangkok', '曼谷', 'バンコク'],
  'Asia/Dubai': ['Dubai', '迪拜', 'ドバイ'],
  'Europe/London': ['London', '伦敦', 'ロンドン'],
  'Europe/Paris': ['Paris', '巴黎', 'パリ'],
  'Europe/Moscow': ['Moscow', '莫斯科', 'モスクワ'],
  'America/New_York': ['New York', '纽约', 'ニューヨーク'],
  'America/Los_Angeles': ['Los Angeles', '洛杉矶', 'ロサンゼルス'],
  'America/Sao_Paulo': ['São Paulo', '圣保罗', 'サンパウロ'],
  'Australia/Sydney': ['Sydney', '悉尼', 'シドニー'],
  'Pacific/Auckland': ['Auckland', '奥克兰', 'オークランド']
};
const CITIES = Object.keys(CITY_NAMES);
const cname = (tz) => CITY_NAMES[tz][LANG === 'zh' ? 1 : LANG === 'jp' ? 2 : 0];

function render() {
  const now = new Date();
  $('list').innerHTML = CITIES.map((tz) => {
    let timeStr = '--:--:--', dayBadge = '🌙', dateStr = '';
    try {
      timeStr = now.toLocaleTimeString(LANG === 'zh' ? 'zh' : LANG === 'jp' ? 'ja' : 'en-GB', { timeZone: tz, hour12: false });
      dateStr = now.toLocaleDateString(LANG === 'zh' ? 'zh' : LANG === 'jp' ? 'ja' : 'en-GB', { timeZone: tz, month: 'short', day: 'numeric' });
      const hour = Number(now.toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }));
      dayBadge = hour >= 6 && hour < 18 ? '☀️' : '🌙';
    } catch (_e) {}
    return `<div class="city">
      <span class="badge">${dayBadge}</span>
      <span class="name">${cname(tz)}<small>${tz} · ${dateStr}</small></span>
      <span class="time">${timeStr}</span>
    </div>`;
  }).join('');
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.title = I18N[LANG].title;
}

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
  render();
  setInterval(render, 1000);
})();
