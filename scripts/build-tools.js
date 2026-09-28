'use strict';

/**
 * 建置腳本 — 產生測試資產與應用程式圖標（開發期用，不需 GitHub）：
 *   1. 產生 app icon.png(256) 與 icon.ico(256)
 *   2. 為每個工具產生 logo.png
 *   3. 為每個工具打包「三種語言」的 zip（注入 lang.js 固定語系）
 *      → dev-server/dist/<id>-en.zip / <id>-zh-CN.zip / <id>-ja.zip
 *   4. 複製 logo 到 dev-server/icons/<id>.png
 *   5. 計算 sha256 並產出 dev-server/tools.json（downloadUrl / sha256 依語言分組）
 *
 * 用法：
 *   node scripts/build-tools.js                 # 本地測試（相對路徑，size 用本機 zip 實測值）
 *   node scripts/build-tools.js --base <URL>    # 產生 GitHub 絕對網址
 *     例：node scripts/build-tools.js --base https://github.com/YOUR_NAME/toolbox/releases/download/v1.0.0
 *   node scripts/build-tools.js --base <URL> --github-sizes [tag]
 *                                               # size 改用 GitHub Release 上資產的實際大小（預設 tag=tool）
 *                                               # 建議每次上傳 zip 後用它重建 tools.json，確保市集顯示的大小精準
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const ROOT = path.join(__dirname, '..');
const TEST_TOOLS = path.join(ROOT, 'test-tools');
const DEV_SERVER = path.join(ROOT, 'dev-server');
const DIST = path.join(DEV_SERVER, 'dist');
const ICONS = path.join(DEV_SERVER, 'icons');

const LANGS = ['en', 'zh', 'jp'];
const GITHUB_REPO = process.env.TOOLBOX_REPO || 'alanchan20121201-prog/Toolbox';
// zip 檔名的語言後綴（用戶指定格式：appname-zh/jp/en-版本）
const ZIP_LANG = { en: 'en', zh: 'zh', jp: 'jp' };
const TOOL_SIZE = 128;
const APP_ICON_SIZE = 256;

/* ================= PNG 產生器（無依賴） ================= */

const CRC_TABLE = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/** 把單一 PNG（256x256）包成 ICO 容器（Vista+ 支援 PNG-in-ICO） */
function makeICO(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);   // width 256
  entry.writeUInt8(0, 1);   // height 256
  entry.writeUInt8(0, 2);   // palette
  entry.writeUInt8(0, 3);   // reserved
  entry.writeUInt16LE(1, 4);   // planes
  entry.writeUInt16LE(32, 6);  // bit count
  entry.writeUInt32LE(pngBuffer.length, 8); // bytes in resource
  entry.writeUInt32LE(22, 12);              // image offset
  return Buffer.concat([header, entry, pngBuffer]);
}

/* ================= 繪圖工具 ================= */

function makeCanvas(size) { return { size, data: Buffer.alloc(size * size * 4) }; }
function setPixel(cv, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= cv.size || y >= cv.size) return;
  const i = (y * cv.size + x) * 4;
  cv.data[i] = r; cv.data[i + 1] = g; cv.data[i + 2] = b; cv.data[i + 3] = a;
}
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function lerpColor(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
function insideRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
function insideCircle(x, y, cx, cy, r) { const dx = x - cx, dy = y - cy; return dx * dx + dy * dy <= r * r; }
function sign(p1, p2, p3) { return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]); }
function insideTriangle(px, py, a, b, c) {
  const d1 = sign([px, py], a, b), d2 = sign([px, py], b, c), d3 = sign([px, py], c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
function bg(cv, c1, c2, radius) {
  for (let y = 0; y < cv.size; y++) for (let x = 0; x < cv.size; x++) {
    if (insideRoundedRect(x, y, 0, 0, cv.size - 1, cv.size - 1, radius)) setPixel(cv, x, y, lerpColor(c1, c2, y / (cv.size - 1)));
  }
}

/* ----- 工具 logo ----- */

function drawImageIcon(cv) {
  const W = [255, 255, 255];
  bg(cv, [59, 130, 246], [124, 58, 237], 28);
  for (let y = 0; y < cv.size; y++) for (let x = 0; x < cv.size; x++) {
    if (insideCircle(x, y, 86, 42, 13)) setPixel(cv, x, y, W);
    if (insideTriangle(x, y, [20, 101], [62, 50], [104, 101])) setPixel(cv, x, y, W);
    if (insideTriangle(x, y, [72, 101], [106, 60], [126, 101])) setPixel(cv, x, y, W);
  }
}

function drawPasswordIcon(cv) {
  const W = [255, 255, 255];
  bg(cv, [16, 185, 129], [14, 165, 233], 28);
  for (let y = 0; y < cv.size; y++) for (let x = 0; x < cv.size; x++) {
    const dx = x - 64, dy = y - 52, d = Math.sqrt(dx * dx + dy * dy);
    if (d >= 12 && d <= 19 && y <= 52) setPixel(cv, x, y, W);
    if (insideRoundedRect(x, y, 34, 48, 94, 96, 10)) setPixel(cv, x, y, W);
    if (insideCircle(x, y, 64, 72, 6)) setPixel(cv, x, y, [15, 100, 130]);
    if (insideRoundedRect(x, y, 61, 74, 67, 92, 3)) setPixel(cv, x, y, [15, 100, 130]);
  }
}

/* ----- 應用程式圖標（工具箱） ----- */

function drawAppIcon(cv) {
  const S = cv.size;
  const W = [255, 255, 255];
  bg(cv, [59, 130, 246], [124, 58, 237], Math.round(S * 0.22));
  // 提把（D 形，上半圓環）
  const cx = S / 2, cy = Math.round(S * 0.47);
  const ro = Math.round(S * 0.20), ri = Math.round(S * 0.13);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    if (d >= ri && d <= ro && y <= cy) setPixel(cv, x, y, W);
  }
  // 箱體
  const bx0 = Math.round(S * 0.17), by0 = Math.round(S * 0.50);
  const bx1 = Math.round(S * 0.83), by1 = Math.round(S * 0.87);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (insideRoundedRect(x, y, bx0, by0, bx1, by1, Math.round(S * 0.06))) setPixel(cv, x, y, W);
  }
  // 鎖扣
  const hole = [30, 90, 200];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (insideRoundedRect(x, y, Math.round(S * 0.44), Math.round(S * 0.58), Math.round(S * 0.56), Math.round(S * 0.70), Math.round(S * 0.03))) setPixel(cv, x, y, hole);
  }
}

/**
 * 「自訂 logo 繪圖」註冊表（選用）。
 * 只有當工具資料夾「沒有自備 logo.png」時才會用到；
 * 未註冊的工具會自動套用「漸層預設圖標」，配色依工具 id 決定（每個工具都不同）。
 * 想重畫某個工具的 logo：刪掉該工具資料夾裡的 logo.png，再重新建置即可。
 */
const CUSTOM_ICONS = {
  'image-tools': drawImageIcon,
  'password-generator': drawPasswordIcon
};

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const rgb = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  return rgb.map((v) => Math.round((v + m) * 255));
}

/** 工具既沒自備 logo 也沒註冊繪圖函式時，用這個預設圖標 */
function defaultIconDrawer(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const c1 = hslToRgb(hue, 0.70, 0.56);
  const c2 = hslToRgb((hue + 38) % 360, 0.72, 0.42);
  return (cv) => {
    const S = cv.size;
    const W = [255, 255, 255];
    bg(cv, c1, c2, 28);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // 中空圓角方框
      if (insideRoundedRect(x, y, 26, 26, S - 27, S - 27, 22) &&
          !insideRoundedRect(x, y, 36, 36, S - 37, S - 37, 14)) setPixel(cv, x, y, W);
      // 中心實心方塊
      if (insideRoundedRect(x, y, 50, 50, S - 51, S - 51, 10)) setPixel(cv, x, y, W);
    }
  };
}

/** 自動掃描 test-tools/ 下所有含 manifest.json 的資料夾（_ 開頭為範本，略過） */
function discoverTools() {
  const out = [];
  for (const ent of fs.readdirSync(TEST_TOOLS, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith('_') || ent.name.startsWith('.')) continue;
    if (!fs.existsSync(path.join(TEST_TOOLS, ent.name, 'manifest.json'))) continue;
    out.push(ent.name);
  }
  return out.sort();
}

/* ================= 打包 ================= */

function addDir(zip, dir, base = '') {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(full).isDirectory()) addDir(zip, full, rel);
    else zip.addFile(rel, fs.readFileSync(full));
  }
}

function sha256Hex(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/** 位元組 → 人類可讀大小（1024 進位） */
function formatBytes(bytes) {
  const n = Number(bytes);
  if (!isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return n + ' B';
  const kb = n / 1024;
  if (kb < 1024) return kb.toFixed(kb < 10 ? 1 : 0) + ' KB';
  const mb = kb / 1024;
  return mb.toFixed(mb < 10 ? 1 : 0) + ' MB';
}

/**
 * 向 GitHub Release 查詢每個資產的實際大小。
 * 用途：本地重建 zip 的大小可能和已上傳的版本略有出入（例如 140 bytes），
 * 用雲端的真實大小才能讓市集顯示的值精準。
 * @returns {Promise<Record<string, number>>} zip 檔名 → bytes
 */
async function fetchGithubSizes(tag) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${encodeURIComponent(tag)}`;
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API ${res.status}：${res.statusText}`);
  const json = await res.json();
  const map = {};
  for (const a of json.assets || []) map[a.name] = a.size;
  return map;
}

async function main() {
  // 解析 --base（GitHub 絕對網址前綴）
  const baseIdx = process.argv.indexOf('--base');
  const BASE = baseIdx >= 0 ? process.argv[baseIdx + 1].replace(/\/+$/, '') : null;
  const baseUrl = (rel) => (BASE ? `${BASE}/${rel}` : rel);

  // 解析 --github-sizes [tag]：改用雲端資產的實際大小
  const ghIdx = process.argv.indexOf('--github-sizes');
  const GH_TAG = ghIdx >= 0 ? (process.argv[ghIdx + 1] && !process.argv[ghIdx + 1].startsWith('-') ? process.argv[ghIdx + 1] : 'tool') : null;
  let ghSizes = null;
  if (GH_TAG) {
    try {
      ghSizes = await fetchGithubSizes(GH_TAG);
      console.log(`✔ 已取得 GitHub Release「${GH_TAG}」上 ${Object.keys(ghSizes).length} 個資產的實際大小`);
    } catch (e) {
      console.warn(`⚠ 無法從 GitHub 取得大小（${e.message}），改用本地 zip 實測值`);
    }
  }

  for (const d of [DIST, ICONS]) fs.mkdirSync(d, { recursive: true });

  // 清掉舊的 zip 與 icons，避免殘留舊版本
  for (const f of fs.readdirSync(DIST)) {
    if (f.endsWith('.zip')) fs.rmSync(path.join(DIST, f), { force: true });
  }
  for (const f of fs.readdirSync(ICONS)) {
    if (f.endsWith('.png')) fs.rmSync(path.join(ICONS, f), { force: true });
  }

  // 1. 應用程式圖標
  const iconCv = makeCanvas(APP_ICON_SIZE);
  drawAppIcon(iconCv);
  const iconPng = encodePNG(iconCv.size, iconCv.data);
  fs.writeFileSync(path.join(ROOT, 'icon.png'), iconPng);
  fs.writeFileSync(path.join(ROOT, 'icon.ico'), makeICO(iconPng));
  console.log('✔ icon.png + icon.ico（256x256）');

  const catalog = [];

  for (const id of discoverTools()) {
    const srcDir = path.join(TEST_TOOLS, id);
    const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'));

    // 2. logo：① 工具自備的 logo.png → ② 註冊的繪圖函式 → ③ 自動漸層預設圖標
    const logoPath = path.join(srcDir, 'logo.png');
    if (fs.existsSync(logoPath)) {
      console.log(`✔ ${id} 使用自備 logo.png`);
    } else {
      const cv = makeCanvas(TOOL_SIZE);
      (CUSTOM_ICONS[id] || defaultIconDrawer(id))(cv);
      fs.writeFileSync(logoPath, encodePNG(cv.size, cv.data));
      console.log(`✔ ${id} 自動產生 logo.png`);
    }
    fs.copyFileSync(logoPath, path.join(ICONS, id + '.png'));

    // 3. 打包 zip。兩種模式：
    //    A) 三語分檔（預設）：注入 lang.js 固定語系，<id>-<en|zh|ja>-v<版本>.zip
    //    B) 通用單檔（manifest 加 "universal": true）：一個 zip 內含三語，
    //       工具啟動時呼叫 toolbox.getLocale() 偵測語言 → <id>-v<版本>.zip
    //       發佈時每個工具只需上傳 1 個資產。
    let downloadUrl;
    let size;
    if (manifest.universal === true) {
      const zip = new AdmZip();
      addDir(zip, srcDir);                    // 不注入 lang.js → 工具自行用 getLocale()
      const zipName = `${id}-v${manifest.version}.zip`;
      const zipPath = path.join(DIST, zipName);
      zip.writeZip(zipPath);
      const localSize = fs.statSync(zipPath).size;
      size = (ghSizes && ghSizes[zipName] != null) ? ghSizes[zipName] : localSize;
      downloadUrl = BASE ? baseUrl(zipName) : 'dist/' + zipName;
      console.log(`✔ ${zipName}（通用版，${formatBytes(size)}）`);
      catalog.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        icon: 'data:image/png;base64,' + fs.readFileSync(path.join(srcDir, 'logo.png')).toString('base64'),
        downloadUrl,
        size
      });
      continue; // 下一個工具
    }

    downloadUrl = {};
    size = {};
    for (const lang of LANGS) {
      const zip = new AdmZip();
      addDir(zip, srcDir);
      zip.addFile('lang.js', Buffer.from(`window.__TOOL_LANG__ = '${lang}';`));
      const zipName = `${id}-${ZIP_LANG[lang]}-v${manifest.version}.zip`;
      const zipPath = path.join(DIST, zipName);
      zip.writeZip(zipPath);
      const localSize = fs.statSync(zipPath).size;
      if (ghSizes && ghSizes[zipName] != null && ghSizes[zipName] !== localSize) {
        size[lang] = ghSizes[zipName];
        console.log(`✔ ${zipName}（${formatBytes(size[lang])}，取用 GitHub 上的實際大小；本地值 ${formatBytes(localSize)}）`);
      } else {
        size[lang] = localSize;
        console.log(`✔ ${zipName}（${formatBytes(size[lang])}）`);
      }
      // 本地測試：相對於 dev-server/tools.json 的 dist/；上 GitHub：直接用 Release 資產路徑
      downloadUrl[lang] = BASE ? baseUrl(zipName) : 'dist/' + zipName;
    }

    catalog.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      // 圖標以 base64 data URL 內嵌：不依賴 raw.githubusercontent，永遠顯示。
      // 也可改成檔案路徑（如 "icons/xxx.png"，需上傳到 repo）或 http 圖片網址。
      icon: 'data:image/png;base64,' + fs.readFileSync(path.join(srcDir, 'logo.png')).toString('base64'),
      downloadUrl,
      // 各語言安裝包的實際體積（bytes），工具市集用來顯示下載大小
      size
    });
  }

  // v1.0.4 起採用「合併格式」：{ "update": {...}, "tools": [...] }
  // 應用程式更新資訊直接內嵌在 tools.json，主程式會優先讀取；
  // update.json 仍照常產生/上傳，供 1.0.3 以前的舊版主程式相容（舊版只認陣列，
  // 收到合併格式時市集會載入失敗，但仍會透過 update.json 收到更新通知）。
  let updateInfo = null;
  const updatePath = path.join(DEV_SERVER, 'update.json');
  if (fs.existsSync(updatePath)) {
    try {
      updateInfo = JSON.parse(fs.readFileSync(updatePath, 'utf8'));
    } catch {
      console.warn('⚠ dev-server/update.json 解析失敗，tools.json 將不含 update 欄位');
    }
  }
  const output = updateInfo ? { update: updateInfo, tools: catalog } : catalog;
  const json = JSON.stringify(output, null, 2) + '\n';
  fs.writeFileSync(path.join(DEV_SERVER, 'tools.json'), json);
  console.log('✔ dev-server/tools.json 已產生（' + catalog.length + ' 個工具 × ' + LANGS.length + ' 語' +
    (updateInfo ? '，內嵌 update 資訊' : '') + '）');

  // 同步輸出到 repo 根目錄：GitHub 上的 tools.json / update.json 就是這兩份
  // （raw.githubusercontent.com/<user>/<repo>/main/tools.json）
  const REPO_ROOT = path.join(__dirname, '..');
  if (BASE) {
    fs.writeFileSync(path.join(REPO_ROOT, 'tools.json'), json);
    if (updateInfo) {
      fs.writeFileSync(path.join(REPO_ROOT, 'update.json'), JSON.stringify(updateInfo, null, 2) + '\n');
    }
    console.log('✔ 根目錄 tools.json / update.json 已同步（上傳 GitHub 用）');
  }
}

main().catch((e) => {
  console.error('❌ 建置失敗：', e);
  process.exit(1);
});
