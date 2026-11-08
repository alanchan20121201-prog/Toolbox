'use strict';
const tb = window.toolbox || {};
const I18N = {
  en: { title:'🎨 Color Converter', subtitle:'HEX ⇄ RGB ⇄ HSL. Copy any format, or use the picker.',
    copied:'✅ Copied', copyErr:'Copy failed: ', invalid:'❌ Invalid color' },
  zh: { title:'🎨 颜色工具', subtitle:'HEX / RGB / HSL 互转，可复制任意格式，也可用取色器。',
    copied:'✅ 已复制', copyErr:'复制失败：', invalid:'❌ 无效的颜色值' },
  jp: { title:'🎨 カラー変換ツール', subtitle:'HEX / RGB / HSL の相互変換。カラーピッカーにも対応。',
    copied:'✅ コピーしました', copyErr:'コピー失敗：', invalid:'❌ 無効な色です' }
};
let LANG = 'en';
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.getAttribute('data-i18n')));
  document.title = I18N[LANG].title;
}
function setStatus(msg) { $('status').textContent = msg; }

function hexToRgb(hex) {
  let s = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = [...s].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

function update(source) {
  let rgb = null;
  if (source === 'picker') {
    rgb = hexToRgb($('picker').value);
  } else {
    rgb = hexToRgb($('hex').value);
  }
  if (!rgb) {
    if (source !== 'picker') setStatus(t('invalid'));
    return;
  }
  setStatus('');
  const hsl = rgbToHsl(rgb);
  const hexStr = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  if (source !== 'hex') $('hex').value = hexStr;
  if (source !== 'picker') $('picker').value = hexStr;
  $('rgb').value = `rgb(${rgb.join(', ')})`;
  $('hsl').value = `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`;
  $('preview').style.background = hexStr;
}

$('hex').addEventListener('input', () => update('hex'));
$('picker').addEventListener('input', () => update('picker'));

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try { await tb.copyToClipboard($(btn.getAttribute('data-copy')).value); setStatus(t('copied')); }
    catch (e) { setStatus(t('copyErr') + e.message); }
  });
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
  update('hex');
})();
