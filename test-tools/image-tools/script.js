'use strict';

/**
 * 圖片轉檔工具 — 透過主程式注入的 window.toolbox API 讀寫檔案，
 * 轉檔本身在本地 Canvas 完成，不會上傳任何資料。
 * 語系由建置時注入的 lang.js（window.__TOOL_LANG__）決定。
 *
 * v1.1.1：
 *  - 輸出格式新增 BMP（24 位元，自製編碼器）與 ICO（內嵌 PNG，自動縮到 256px 內）
 *  - 品質滑桿只對 WebP / JPG 有意義，其他格式自動停用
 *  - 未選圖時 preview 保持隱藏（[hidden] 不被 display:block 蓋掉）
 */

const tb = window.toolbox || {};
let LANG = window.__TOOL_LANG__ || 'en';
const MIME = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };
/** 品質參數只對這些格式有效 */
const QUALITY_FORMATS = ['webp', 'jpg'];

const I18N = {
  en: {
    title: '🖼️ Image Converter',
    subtitle: 'Select an image and convert it to WebP / JPG / PNG / BMP / ICO (100% local, no upload)',
    open: '📂 Choose image',
    format: 'Output format',
    quality: 'Quality',
    convert: 'Convert & Save',
    loaded: 'Image loaded',
    readError: 'Read failed: ',
    convertError: 'Conversion failed',
    saveError: 'Save failed: ',
    saved: 'Saved: ',
    cantRead: 'Cannot read image',
    notifyTitle: 'Image Converter',
    notifyBody: 'Conversion complete!'
  },
  zh: {
    title: '🖼️ 图片转档工具',
    subtitle: '选择图片，快速转成 WebP / JPG / PNG / BMP / ICO（100% 本地处理，不上传）',
    open: '📂 选择图片',
    format: '输出格式',
    quality: '品质',
    convert: '转换并保存',
    loaded: '图片已加载',
    readError: '读取失败：',
    convertError: '转换失败',
    saveError: '保存失败：',
    saved: '已保存：',
    cantRead: '无法读取图片',
    notifyTitle: '图片转档工具',
    notifyBody: '转换完成！'
  },
  jp: {
    title: '🖼️ 画像変換ツール',
    subtitle: '画像を選択して WebP / JPG / PNG / BMP / ICO に変換（100% ローカル処理、アップロードなし）',
    open: '📂 画像を選択',
    format: '出力形式',
    quality: '品質',
    convert: '変換して保存',
    loaded: '画像を読み込みました',
    readError: '読み込み失敗：',
    convertError: '変換に失敗しました',
    saveError: '保存失敗：',
    saved: '保存しました：',
    cantRead: '画像を読み込めません',
    notifyTitle: '画像変換ツール',
    notifyBody: '変換が完了しました！'
  }
};

const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.title = I18N[LANG] ? I18N[LANG].title : 'Image Converter';
}

const btnOpen = document.getElementById('btn-open');
const btnConvert = document.getElementById('btn-convert');
const formatSel = document.getElementById('format');
const qualityInput = document.getElementById('quality');
const qualityVal = document.getElementById('quality-val');
const preview = document.getElementById('preview');
const fileName = document.getElementById('file-name');
const statusEl = document.getElementById('status');

let currentDataUrl = null;
let currentBase = 'image';

qualityInput.addEventListener('input', () => {
  qualityVal.textContent = qualityInput.value + '%';
});

/** 品質只對 WebP / JPG 有意義 → 其他格式停用滑桿並淡化 */
function syncQualityEnabled() {
  const on = QUALITY_FORMATS.includes(formatSel.value);
  qualityInput.disabled = !on;
  qualityVal.style.opacity = on ? '1' : '0.4';
}
formatSel.addEventListener('change', syncQualityEnabled);

function setStatus(msg, isErr = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isErr ? ' err' : '');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

btnOpen.addEventListener('click', async () => {
  try {
    const r = await tb.openFile({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }]
    });
    if (r.canceled || !r.filePaths.length) return;
    const p = r.filePaths[0];
    currentBase = p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    fileName.textContent = p.split(/[\\/]/).pop();
    currentDataUrl = await tb.readFileAsDataURL(p);
    preview.src = currentDataUrl;
    preview.hidden = false;
    btnConvert.disabled = false;
    setStatus(t('loaded'));
  } catch (e) {
    setStatus(t('readError') + e.message, true);
  }
});

/* ---------------- 格式編碼器 ---------------- */

/**
 * RGBA 像素 → 24 位元 BMP 位元組（BMP 不支援透明，透明處請先鋪白底）。
 * 格式：BITMAPFILEHEADER(14) + BITMAPINFOHEADER(40) + 由下往上的 BGR 像素（每列補齊 4 bytes）
 */
function rgbaToBmpBytes(data, w, h) {
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const pixelSize = rowSize * h;
  const fileSize = 54 + pixelSize;
  const buf = new ArrayBuffer(fileSize);
  const v = new DataView(buf);
  v.setUint8(0, 0x42); v.setUint8(1, 0x4d);            // 'BM'
  v.setUint32(2, fileSize, true);
  v.setUint32(10, 54, true);                            // 像素資料偏移
  v.setUint32(14, 40, true);                            // BITMAPINFOHEADER 大小
  v.setInt32(18, w, true);
  v.setInt32(22, h, true);
  v.setUint16(26, 1, true);                             // planes
  v.setUint16(28, 24, true);                            // bits per pixel
  v.setUint32(34, pixelSize, true);
  v.setInt32(38, 2835, true); v.setInt32(42, 2835, true); // 72 DPI
  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y;                             // BMP 由下往上
    let off = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (srcY * w + x) * 4;
      v.setUint8(off++, data[i + 2]);                   // B
      v.setUint8(off++, data[i + 1]);                   // G
      v.setUint8(off++, data[i]);                       // R
    }
  }
  return buf;
}

function canvasToBmpBlob(canvas) {
  const w = canvas.width, h = canvas.height;
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  return new Blob([rgbaToBmpBytes(data, w, h)], { type: 'image/bmp' });
}

/** PNG 位元組 → ICO 容器（Vista+ 支援 PNG-in-ICO；寬高超過 255 以 0 表示 256） */
function pngBytesToIco(pngBuf, width, height) {
  const header = new ArrayBuffer(22);                   // ICONDIR(6) + 目錄項(16)
  const v = new DataView(header);
  v.setUint16(2, 1, true);                              // type = icon
  v.setUint16(4, 1, true);                              // 圖片數量
  v.setUint8(6, width >= 256 ? 0 : width);
  v.setUint8(7, height >= 256 ? 0 : height);
  v.setUint16(10, 1, true);                             // planes
  v.setUint16(12, 32, true);                            // bit count
  v.setUint32(14, pngBuf.length, true);                 // 資料大小
  v.setUint32(18, 22, true);                            // 資料偏移
  const out = new Uint8Array(22 + pngBuf.length);
  out.set(new Uint8Array(header), 0);
  out.set(pngBuf, 22);
  return out;
}

/** ICO：內嵌 PNG，超過 256px 自動等比縮小 */
async function canvasToIcoBlob(canvas) {
  const MAX = 256;
  let src = canvas;
  const scale = Math.min(1, MAX / Math.max(canvas.width, canvas.height));
  if (scale < 1) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(canvas.width * scale));
    c.height = Math.max(1, Math.round(canvas.height * scale));
    const cx = c.getContext('2d');
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, c.width, c.height);
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(canvas, 0, 0, c.width, c.height);
    src = c;
  }
  const png = await new Promise((resolve, reject) => {
    src.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
  });
  const bytes = new Uint8Array(await png.arrayBuffer());
  return new Blob([pngBytesToIco(bytes, src.width, src.height)], { type: 'image/x-icon' });
}

/** 依格式把 canvas 編成 Blob */
function encodeCanvas(canvas, fmt, quality) {
  if (fmt === 'bmp') return Promise.resolve(canvasToBmpBlob(canvas));
  if (fmt === 'ico') return canvasToIcoBlob(canvas);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), MIME[fmt], quality);
  });
}

btnConvert.addEventListener('click', async () => {
  const fmt = formatSel.value;
  const quality = parseInt(qualityInput.value, 10) / 100;
  const img = new Image();
  img.onload = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      // JPG / BMP / ICO 不支援透明 → 先鋪白底，避免透明區變黑
      if (fmt !== 'png' && fmt !== 'webp') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      const blob = await encodeCanvas(canvas, fmt, quality);
      if (!blob) { setStatus(t('convertError'), true); return; }
      const base64 = await blobToBase64(blob);
      const save = await tb.saveFile({
        defaultPath: currentBase + '.' + fmt,
        filters: [{ name: fmt.toUpperCase(), extensions: [fmt] }]
      });
      if (save.canceled || !save.filePath) return;
      await tb.writeFile(save.filePath, base64);
      setStatus(t('saved') + save.filePath);
      tb.notify({ title: t('notifyTitle'), body: t('notifyBody') });
    } catch (e) {
      setStatus(t('saveError') + e.message, true);
    }
  };
  img.onerror = () => setStatus(t('cantRead'), true);
  img.src = currentDataUrl;
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
  syncQualityEnabled();
})();
