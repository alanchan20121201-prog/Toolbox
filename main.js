'use strict';

/**
 * Toolbox — 主進程 (main process)
 * 職責：視窗框架、本地檔案讀寫、網路下載、工具安裝生命週期、
 *      以及權限化的 Tool API（供沙盒內的工具透過 IPC 呼叫）。
 *
 * 安全模型（v1）：
 *  - 工具在 <webview> 內執行，nodeIntegration=off、contextIsolation=on。
 *  - 工具只能透過 tool-preload.js 暴露的 window.toolbox 呼叫白名單 API。
 *  - 每次呼叫都依 manifest.json 的 permissions 做最小權限驗證。
 */

const { app, BrowserWindow, ipcMain, dialog, shell, Notification, clipboard, nativeTheme, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const AdmZip = require('adm-zip');
const { spawn } = require('child_process');
const { pathToFileURL, fileURLToPath } = require('url');

/* ------------------------------------------------------------------ *
 * 路徑與環境
 * ------------------------------------------------------------------ */

const SMOKE = process.argv.includes('--smoke');
const SMOKE_WINDOW = process.argv.includes('--smoke-window');

/** 截圖模式：啟動、渲染、把畫面存成 PNG 後退出（用於驗證介面） */
const SCREENSHOT = process.argv.includes('--screenshot');
function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const SCREENSHOT_PATH = SCREENSHOT
  ? (argValue('--screenshot') || path.join(__dirname, 'screenshot.png'))
  : null;
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const TOOLBOX_HOME = SMOKE
  ? path.join(os.tmpdir(), 'toolbox-smoke-test')
  : (process.env.TOOLBOX_HOME || path.join(LOCALAPPDATA, 'Toolbox'));

const TOOLS_DIR = path.join(TOOLBOX_HOME, 'tools');
const TMP_DIR = path.join(TOOLBOX_HOME, 'tmp');
const CONFIG_PATH = path.join(TOOLBOX_HOME, 'config.json');
/** 各工具的持久化資料目錄（storageGet / storageSet 存放處） */
const TOOL_DATA_DIR = path.join(TOOLBOX_HOME, 'tool-data');

/** 生產環境的 GitHub 清單位址 */
const PROD_MANIFEST_URL = 'https://raw.githubusercontent.com/alanchan20121201-prog/Toolbox/main/tools.json';
/** 生產環境的「應用程式更新」資訊位址（repo 根目錄的 update.json） */
const PROD_UPDATE_URL = 'https://raw.githubusercontent.com/alanchan20121201-prog/Toolbox/main/update.json';

/* ------------------------------------------------------------------ *
 * 設定 (config.json)
 * ------------------------------------------------------------------ */

const DEFAULT_CONFIG = {
  language: 'en',   // 預設英文（可選 en | zh | jp | auto）
  theme: 'light',   // light | dark
  manifestUrl: ''   // 空白 → 使用預設（開發期指向本地 dev-server/tools.json）
};

let config = { ...DEFAULT_CONFIG };

function ensureDirs() {
  for (const d of [TOOLBOX_HOME, TOOLS_DIR, TMP_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function loadConfig() {
  ensureDirs();
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = { ...DEFAULT_CONFIG, ...raw };
  } catch {
    config = { ...DEFAULT_CONFIG };
  }
}

function saveConfig() {
  ensureDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

/** 解析目前生效的清單位址（環境變數 > 設定 > 預設） */
function getManifestUrl() {
  if (process.env.TOOLBOX_MANIFEST_URL) return process.env.TOOLBOX_MANIFEST_URL;
  if (config.manifestUrl) return config.manifestUrl;
  if (!app.isPackaged) {
    // 開發期：直接指向專案內 dev-server/tools.json（零設定、離線可測）
    return pathToFileURL(path.join(__dirname, 'dev-server', 'tools.json')).href;
  }
  return PROD_MANIFEST_URL;
}

/** 解析語系：auto → 依系統；否則直接用設定值（en / zh / jp） */
function resolveLanguage() {
  // 舊版設定值遷移（1.0.4 以前使用 zh-CN / ja）
  if (config.language === 'zh-CN') return 'zh';
  if (config.language === 'ja') return 'jp';
  if (config.language && config.language !== 'auto') return config.language;
  const loc = (app.getLocale() || 'en-US').toLowerCase();
  if (loc.startsWith('ja')) return 'jp';
  if (loc.startsWith('zh')) return 'zh';
  return 'en';
}

/* ------------------------------------------------------------------ *
 * 工具清單 (tools.json)
 * ------------------------------------------------------------------ */

let catalogCache = null;
let catalogCacheTime = 0;
const CATALOG_TTL = 60 * 1000; // 1 分鐘

/**
 * 抓取並正規化工具清單；downloadUrl / icon 相對路徑都解析為絕對。
 * 支援兩種格式：
 *   1. 陣列（傳統）：[ {...tool}, ... ]
 *   2. 物件（v1.0.4 起）：{ "update": {...update.json 內容...}, "tools": [ {...tool}, ... ] }
 *      → 應用程式更新資訊直接內嵌在 tools.json，update.json 僅供舊版相容。
 * 回傳值為工具陣列，若來源含更新資訊會以 `__update` 屬性附帶。
 */
async function fetchCatalog(force = false) {
  const now = Date.now();
  if (!force && catalogCache && now - catalogCacheTime < CATALOG_TTL) return catalogCache;

  const manifestUrl = getManifestUrl();
  const text = await fetchText(manifestUrl);
  const parsed = JSON.parse(text);

  let items;
  let embeddedUpdate = null;
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && Array.isArray(parsed.tools)) {
    items = parsed.tools;
    embeddedUpdate = parsed.update || null;
  } else {
    throw new Error('tools.json 格式錯誤（需為陣列或含 tools 欄位的物件）');
  }

  items = items.map((it) => {
    const resolve = (u) => (u ? new URL(u, manifestUrl).href : u);
    return {
      ...it,
      downloadUrl: resolveDownloadUrl(it.downloadUrl, resolve),
      icon: resolve(it.icon),
      name: normalizeLocalized(it.name),
      description: normalizeLocalized(it.description)
    };
  });

  if (embeddedUpdate) {
    try { Object.defineProperty(items, '__update', { value: embeddedUpdate, enumerable: false }); } catch {}
  }

  catalogCache = items;
  catalogCacheTime = now;
  return items;
}

/** downloadUrl 可為字串（單一網址）或物件（依語言分組）→ 一律正規化為物件 */
function resolveDownloadUrl(u, resolve) {
  if (u == null) return null;
  if (typeof u === 'string') return resolve(u);
  if (typeof u === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(u)) o[k] = resolve(v);
    return o;
  }
  return null;
}

/** 依語系從字串或物件中挑選值 */
function pickLang(obj, lang) {
  if (obj == null) return null;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object') {
    return obj[lang] || obj.en || obj[Object.keys(obj)[0]] || null;
  }
  return null;
}

/** 支援 name / description 為純字串或 {en, zh, jp} 物件 */
function normalizeLocalized(v) {
  if (v == null) return {};
  if (typeof v === 'string') {
    const o = {}; o[resolveLanguage()] = v; o.en = v; return o;
  }
  return v;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    if (url.startsWith('file://')) {
      fsp.readFile(fileURLToPath(url), 'utf8').then(resolve, reject);
      return;
    }
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Toolbox/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        req.destroy();
        fetchText(new URL(res.headers.location, url).href).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('請求逾時（15 秒）')));
  });
}

/* ------------------------------------------------------------------ *
 * 下載（支援 file:// / http(s)://，附進度回報）
 * ------------------------------------------------------------------ */

function download(url, dest, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    if (url.startsWith('file://')) {
      fsp.copyFile(fileURLToPath(url), dest)
        .then(() => { onProgress(100); resolve(); })
        .catch(reject);
      return;
    }
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Toolbox/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        req.destroy();
        download(new URL(res.headers.location, url).href, dest, onProgress).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const out = fs.createWriteStream(dest);
      res.on('data', (chunk) => {
        received += chunk.length;
        if (total) onProgress(Math.min(99, Math.round((received / total) * 100)));
      });
      res.pipe(out);
      out.on('finish', () => { onProgress(100); resolve(); });
      out.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('下載逾時（30 秒）')));
  });
}

/* ------------------------------------------------------------------ *
 * 安全解壓（防 zip-slip 路徑穿越）
 * ------------------------------------------------------------------ */

function extractZip(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  const root = path.resolve(destDir);
  const entries = zip.getEntries();
  for (const entry of entries) {
    const name = entry.entryName.replace(/\\/g, '/');
    const target = path.resolve(root, name);
    // 防護：目標必須落在 destDir 內
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`危險的 zip 路徑（已攔截）: ${name}`);
    }
    if (entry.isDirectory) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.getData());
  }
}

/* ------------------------------------------------------------------ *
 * 工具驗證
 * ------------------------------------------------------------------ */

function readManifest(toolDir) {
  const mp = path.join(toolDir, 'manifest.json');
  if (!fs.existsSync(mp)) throw new Error('缺少 manifest.json');
  return JSON.parse(fs.readFileSync(mp, 'utf8'));
}

function validateTool(toolDir, expectedId) {
  const manifest = readManifest(toolDir);
  if (!manifest.id) throw new Error('manifest 缺少 id');
  if (expectedId && manifest.id !== expectedId) {
    throw new Error(`工具 id 不符（預期 ${expectedId}，實際 ${manifest.id}）`);
  }
  const entry = manifest.entry || 'index.html';
  const entryPath = path.join(toolDir, entry);
  if (!fs.existsSync(entryPath)) throw new Error(`缺少進入點 ${entry}`);
  return manifest;
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', (d) => hash.update(d))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

/* ------------------------------------------------------------------ *
 * 工具安裝生命週期（原子安裝 + 回滾）
 * ------------------------------------------------------------------ */

async function installTool(item, onProgress) {
  const toolDir = path.join(TOOLS_DIR, item.id);
  const stageDir = path.join(TMP_DIR, `${item.id}-${Date.now()}`);
  const zipPath = path.join(TMP_DIR, `${item.id}.zip`);

  // 依目前語系挑選下載網址與校驗值
  const lang = resolveLanguage();
  const downloadUrl = pickLang(item.downloadUrl, lang);
  const expectedSha = pickLang(item.sha256, lang);

  ensureDirs();
  const progress = (percent, stage) => onProgress && onProgress({ toolId: item.id, percent, stage });

  try {
    if (!downloadUrl) throw new Error('此工具沒有可用的下載網址');
    progress(0, 'downloading');
    await download(downloadUrl, zipPath, (p) => progress(p, 'downloading'));

    if (expectedSha) {
      progress(100, 'verifying');
      const h = await sha256(zipPath);
      if (h.toLowerCase() !== String(expectedSha).toLowerCase()) {
        throw new Error('SHA256 校驗失敗，檔案可能已損毀');
      }
    }

    progress(100, 'extracting');
    fs.mkdirSync(stageDir, { recursive: true });
    extractZip(zipPath, stageDir);

    progress(100, 'validating');
    validateTool(stageDir, item.id);

    progress(100, 'installing');
    // 原子搬移：先清舊的，再從暫存 rename 進正式目錄
    if (fs.existsSync(toolDir)) fs.rmSync(toolDir, { recursive: true, force: true });
    fs.renameSync(stageDir, toolDir);

    // 清理中繼 zip
    fs.rmSync(zipPath, { force: true });

    progress(100, 'done');
    return readManifest(toolDir);
  } catch (err) {
    // 回滾：清掉半套目錄與暫存
    try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    throw err;
  }
}

function uninstallTool(toolId) {
  const toolDir = path.join(TOOLS_DIR, toolId);
  if (!fs.existsSync(toolDir)) return false;
  fs.rmSync(toolDir, { recursive: true, force: true });
  return true;
}

/** 掃描本地已安裝工具，回傳清單（含 icon dataURL） */
function listInstalled() {
  ensureDirs();
  const result = [];
  if (!fs.existsSync(TOOLS_DIR)) return result;
  for (const id of fs.readdirSync(TOOLS_DIR)) {
    const dir = path.join(TOOLS_DIR, id);
    const mp = path.join(dir, 'manifest.json');
    if (!fs.existsSync(mp)) continue;
    try {
      const manifest = readManifest(dir);
      const entry = manifest.entry || 'index.html';
      const stat = fs.statSync(dir);
      result.push({
        id: manifest.id || id,
        name: normalizeLocalized(manifest.name),
        version: manifest.version || '0.0.0',
        description: normalizeLocalized(manifest.description),
        permissions: manifest.permissions || [],
        icon: readIconAsDataUrl(dir, manifest.icon),
        entryUrl: pathToFileURL(path.join(dir, entry)).href,
        installedAt: stat.mtimeMs
      });
    } catch {
      // 結構不完整的工具直接略過
    }
  }
  return result;
}

function readIconAsDataUrl(toolDir, iconName) {
  const candidates = [iconName, 'logo.png', 'icon.png'].filter(Boolean);
  for (const c of candidates) {
    const p = path.join(toolDir, c);
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      const mime = mimeOf(c);
      return `data:${mime};base64,${buf.toString('base64')}`;
    }
  }
  return null;
}

const MIME_MAP = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
function mimeOf(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

/* ------------------------------------------------------------------ *
 * Tool API：方法 → 所需權限 對照表
 * ------------------------------------------------------------------ */

const METHOD_PERMISSIONS = {
  openFile: ['dialog', 'file:read'],
  saveFile: ['dialog', 'file:write'],
  readFile: ['file:read'],
  readTextFile: ['file:read'],
  readFileAsDataURL: ['file:read'],
  writeFile: ['file:write'],
  writeTextFile: ['file:write'],
  copyToClipboard: ['clipboard'],
  readClipboard: ['clipboard'],
  notify: ['notify'],
  openExternal: ['shell'],
  showItemInFolder: ['shell'],
  getTheme: [],
  getLocale: [],
  // 工具私有的持久化儲存（各工具只能碰到自己的資料夾，與一般檔案讀寫分開控管）
  storageGet: ['storage'],
  storageSet: ['storage']
};

/** key 只允許安全字元，避免路徑跳脫 */
function safeStorageKey(key) {
  return String(key || 'data').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

function toolStoragePath(toolId, key) {
  const dir = path.join(TOOL_DATA_DIR, toolId);
  return { dir, file: path.join(dir, safeStorageKey(key) + '.bin') };
}

/** 加密（Windows 用 DPAPI，綁定目前使用者帳戶）；不支援時退回明文但仍存在工具私有目錄 */
function encryptForStorage(text) {
  if (safeStorage.isEncryptionAvailable()) return safeStorage.encryptString(String(text));
  return Buffer.from(String(text), 'utf8');
}

function decryptFromStorage(buf) {
  if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf);
  return buf.toString('utf8');
}

/** 比較語意化版本：a > b 回 1，a < b 回 -1，相同回 0 */
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

async function dispatchToolCall(method, args = [], toolId = null) {
  switch (method) {
    case 'openFile': {
      const opts = args[0] || {};
      const r = await dialog.showOpenDialog({
        title: opts.title,
        properties: opts.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: opts.filters || undefined
      });
      return { canceled: r.canceled, filePaths: r.filePaths };
    }
    case 'saveFile': {
      const opts = args[0] || {};
      const r = await dialog.showSaveDialog({
        title: opts.title,
        defaultPath: opts.defaultPath,
        filters: opts.filters || undefined
      });
      return { canceled: r.canceled, filePath: r.filePath || null };
    }
    case 'readFile':
      return (await fsp.readFile(String(args[0]))).toString('base64');
    case 'readTextFile':
      return await fsp.readFile(String(args[0]), 'utf8');
    case 'readFileAsDataURL': {
      const p = String(args[0]);
      const buf = await fsp.readFile(p);
      return `data:${mimeOf(p)};base64,${buf.toString('base64')}`;
    }
    case 'writeFile':
      await fsp.writeFile(String(args[0]), Buffer.from(String(args[1]), 'base64'));
      return true;
    case 'writeTextFile':
      await fsp.writeFile(String(args[0]), String(args[1]), 'utf8');
      return true;
    case 'copyToClipboard':
      clipboard.writeText(String(args[0] ?? ''));
      return true;
    case 'readClipboard':
      return clipboard.readText();
    case 'notify': {
      const o = args[0] || {};
      if (Notification.isSupported()) {
        new Notification({ title: o.title || '', body: o.body || '' }).show();
      }
      return true;
    }
    case 'openExternal': {
      const u = String(args[0] ?? '');
      if (!/^https?:\/\//i.test(u)) throw new Error('僅允許 http/https 連結');
      await shell.openExternal(u);
      return true;
    }
    case 'showItemInFolder':
      shell.showItemInFolder(String(args[0]));
      return true;
    case 'getTheme':
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    case 'getLocale':
      return resolveLanguage();
    case 'storageGet': {
      const { file } = toolStoragePath(toolId, args[0]);
      if (!fs.existsSync(file)) return null;
      return decryptFromStorage(fs.readFileSync(file));
    }
    case 'storageSet': {
      const { dir, file } = toolStoragePath(toolId, args[0]);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, encryptForStorage(String(args[1] ?? '')));
      return true;
    }
    default:
      throw new Error(`未知的 Tool API: ${method}`);
  }
}

/* ------------------------------------------------------------------ *
 * IPC 處理
 * ------------------------------------------------------------------ */

function setupIpc() {
  ipcMain.handle('app:getState', () => ({
    config,
    language: resolveLanguage(),
    manifestUrl: getManifestUrl(),
    toolsDir: TOOLS_DIR,
    toolPreloadPath: pathToFileURL(path.join(__dirname, 'tool-preload.js')).href,
    isPackaged: app.isPackaged,
    appVersion: app.getVersion()
  }));

  ipcMain.handle('app:setConfig', (_e, patch) => {
    config = { ...config, ...(patch || {}) };
    saveConfig();
    return { config, language: resolveLanguage(), manifestUrl: getManifestUrl() };
  });

  ipcMain.handle('app:openToolsFolder', async () => {
    ensureDirs();
    return shell.openPath(TOOLS_DIR);
  });

  ipcMain.handle('app:openExternal', (_e, url) => {
    // 白名單：只允許 GitHub 網址（意見回饋用），避免被拿去開任意連結
    if (typeof url === 'string' && /^https:\/\/github\.com\//.test(url)) {
      return shell.openExternal(url);
    }
    throw new Error('不允許的網址');
  });

  ipcMain.handle('locale:get', async (_e, lang) => {
    const dir = path.join(__dirname, 'locales');
    const read = (l) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8'));
      } catch {
        return null;
      }
    };
    return read(lang) || read('en') || {};
  });

  ipcMain.handle('catalog:list', async (_e, force) => fetchCatalog(!!force));

  ipcMain.handle('tools:list', () => listInstalled());

  ipcMain.handle('tools:install', async (event, toolId) => {
    const catalog = await fetchCatalog();
    const item = catalog.find((t) => t.id === toolId);
    if (!item) throw new Error(`清單中找不到工具: ${toolId}`);
    const manifest = await installTool(item, (p) => {
      if (!event.sender.isDestroyed()) event.sender.send('install:progress', p);
    });
    return listInstalled().find((t) => t.id === toolId) || null;
  });

  ipcMain.handle('tools:update', async (event, toolId) => {
    const catalog = await fetchCatalog(true);
    const item = catalog.find((t) => t.id === toolId);
    if (!item) throw new Error(`清單中找不到工具: ${toolId}`);
    const manifest = await installTool(item, (p) => {
      if (!event.sender.isDestroyed()) event.sender.send('install:progress', p);
    });
    return listInstalled().find((t) => t.id === toolId) || null;
  });

  ipcMain.handle('tools:uninstall', (_e, toolId) => {
    uninstallTool(toolId);
    return listInstalled();
  });

  /* ---------------- 應用程式自我更新 ---------------- */

  ipcMain.handle('app:check-update', async () => {
    const current = app.getVersion();
    try {
      // 優先使用內嵌在 tools.json 的更新資訊（v1.0.4 起的新格式）；抓不到再讀 update.json（舊版相容）
      let info = null;
      try {
        const items = await fetchCatalog(true);
        if (items && items.__update) info = items.__update;
      } catch {}
      if (!info) info = JSON.parse(await fetchText(PROD_UPDATE_URL));
      const available = compareVersions(info.version, current) > 0 && !!info.url;
      return { available, current, version: info.version, url: info.url, notes: info.notes || '' };
    } catch (e) {
      return { available: false, current, error: e.message };
    }
  });

  ipcMain.handle('app:apply-update', async (event, url) => {
    if (!/^https:\/\//i.test(String(url || ''))) throw new Error('無效的更新網址');
    ensureDirs();
    const dest = path.join(TMP_DIR, 'toolbox-update-installer.exe');
    await download(String(url), dest, (p) => {
      if (!event.sender.isDestroyed()) event.sender.send('update:progress', { percent: p });
    });
    // 啟動安裝精靈（NSIS 會引導完成更新，安裝目錄沿用上次選擇），稍後關閉本程式
    spawn(dest, [], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 800);
    return true;
  });

  ipcMain.handle('tool:call', async (event, { method, args = [] }) => {
    // 工具身分改由「webview 實際載入的檔案路徑」推導（頁面無法偽造）。
    // 舊做法監聽 <webview> 元素的 did-attach-webview 事件——該事件不存在於元素上，導致永遠未註冊。
    let toolId;
    try {
      const u = new URL(event.sender.getURL() || '');
      if (u.protocol !== 'file:') throw new Error('not a file view');
      const resolved = path.resolve(path.dirname(fileURLToPath(u)));
      const root = path.resolve(TOOLS_DIR);
      if (!resolved.startsWith(root + path.sep)) throw new Error('outside tools dir');
      toolId = path.basename(resolved);
    } catch {
      throw new Error('無法識別工具視圖');
    }

    let manifest;
    try {
      manifest = readManifest(path.join(TOOLS_DIR, toolId));
    } catch {
      throw new Error('工具不存在或結構不完整');
    }

    const required = METHOD_PERMISSIONS[method];
    if (!required) throw new Error(`未知的 Tool API: ${method}`);
    const granted = manifest.permissions || [];
    for (const p of required) {
      if (!granted.includes(p)) throw new Error(`權限不足: ${p}`);
    }
    return dispatchToolCall(method, args, toolId);
  });
}

/* ------------------------------------------------------------------ *
 * 主視窗
 * ------------------------------------------------------------------ */

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    title: 'Toolbox',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141519' : '#f5f6f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  });
  win.removeMenu();
  win.loadFile('index.html');
  return win;
}

/* ------------------------------------------------------------------ *
 * Smoke test 輔助：手工構造含任意條目名的 raw zip（AdmZip 會正規化 ../）
 * ------------------------------------------------------------------ */

function crc32buf(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeRawZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const crc = crc32buf(buf);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0x0800, 6); // UTF-8 flag
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(buf.length, 18);
    lfh.writeUInt32LE(buf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0800, 8);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(buf.length, 20);
    cdh.writeUInt32LE(buf.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(offset, 42);

    parts.push(lfh, nameBuf, buf);
    central.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + buf.length;
  }
  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, eocd]);
}

/* ------------------------------------------------------------------ *
 * Smoke test（無 UI，端到端驗證安裝生命週期）
 * ------------------------------------------------------------------ */

async function runSmoke() {
  const report = { steps: [], ok: true };
  const log = (name, detail) => report.steps.push({ name, ...detail });

  try {
    ensureDirs();

    // 1. 清單抓取
    const catalog = await fetchCatalog(true);
    log('catalog', { count: catalog.length });
    if (!catalog.length) throw new Error('清單為空');

    // 1.5 內嵌更新資訊（合併格式 { update, tools }）
    log('embedded-update', {
      present: !!catalog.__update,
      version: catalog.__update ? catalog.__update.version : null
    });

    // 2. 安裝第一個工具
    const item = catalog[0];
    const manifest = await installTool(item, () => {});
    log('install', { id: item.id, version: manifest.version });

    // 3. 驗證安裝結果
    const toolDir = path.join(TOOLS_DIR, item.id);
    validateTool(toolDir, item.id);
    const installed = listInstalled();
    log('validate', { found: installed.some((t) => t.id === item.id) });

    // 4. zip-slip 負面測試（raw zip 含 ../evil.txt 穿越條目）
    try {
      const badZip = makeRawZip([
        { name: '../evil.txt', data: 'x' },
        { name: 'manifest.json', data: JSON.stringify({ id: 'evil', entry: 'index.html' }) }
      ]);
      fs.writeFileSync(path.join(TMP_DIR, 'bad.zip'), badZip);
      let slipped = false;
      try {
        extractZip(path.join(TMP_DIR, 'bad.zip'), path.join(TMP_DIR, 'bad-dest'));
      } catch {
        slipped = true;
      }
      const escaped = fs.existsSync(path.join(path.dirname(path.join(TMP_DIR, 'bad-dest')), 'evil.txt'));
      log('zipslip-guard', { blocked: slipped, escaped });
      if (!slipped || escaped) throw new Error('zip-slip 防護未生效');
    } finally {
      fs.rmSync(path.join(TMP_DIR, 'bad.zip'), { force: true });
      fs.rmSync(path.join(path.dirname(path.join(TMP_DIR, 'bad-dest')), 'evil.txt'), { force: true });
      fs.rmSync(path.join(TMP_DIR, 'bad-dest'), { recursive: true, force: true });
    }

    // 5. 解除安裝
    uninstallTool(item.id);
    log('uninstall', { removed: !fs.existsSync(path.join(TOOLS_DIR, item.id)) });

    // 6. 工具儲存 API（加密讀寫 roundtrip）
    const { dir, file } = toolStoragePath('smoke-tool', 'vault');
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, encryptForStorage('秘密資料 secret123'));
      const back = decryptFromStorage(fs.readFileSync(file));
      log('storage', { roundtrip: back === '秘密資料 secret123' });
      if (back !== '秘密資料 secret123') throw new Error('儲存 roundtrip 失敗');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (err) {
    report.ok = false;
    report.error = err.message;
    log('error', { message: err.message });
  }

  console.log('SMOKE_RESULT ' + JSON.stringify(report));
  app.exit(report.ok ? 0 : 1);
}

/** 隱藏視窗冒煙測試：驗證 index.html + preload 能正常載入 */
async function runSmokeWindow() {
  const result = { loaded: false, apiExposed: false, error: null };
  let win = null;
  try {
    setupIpc();
    win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: true
      }
    });
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('did-finish-load 逾時')), 15000);
      win.webContents.once('did-finish-load', () => { clearTimeout(to); resolve(); });
      win.webContents.once('did-fail-load', (_e, _c, d) => { clearTimeout(to); reject(new Error(d)); });
      win.loadFile('index.html');
    });
    result.loaded = true;
    await new Promise((r) => setTimeout(r, 1200));
    result.apiExposed = await win.webContents.executeJavaScript(
      'typeof window.api === "object" && typeof window.api.getState === "function"'
    );
  } catch (err) {
    result.error = err.message;
  }
  console.log('SMOKE_WINDOW_RESULT ' + JSON.stringify(result));
  if (win) win.destroy();
  app.exit(result.loaded && result.apiExposed && !result.error ? 0 : 1);
}

/** 截圖模式：正常渲染主介面後擷取畫面存成 PNG，供驗證/預覽 */
async function runScreenshot() {
  let win = null;
  try {
    loadConfig();
    setupIpc();
    win = createWindow();
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('did-finish-load 逾時')), 20000);
      win.webContents.once('did-finish-load', () => { clearTimeout(to); resolve(); });
      win.webContents.once('did-fail-load', (_e, _c, d) => { clearTimeout(to); reject(new Error(d)); });
    });
    // 等待非同步渲染（抓清單、畫市集卡片、載入圖標）
    await new Promise((r) => setTimeout(r, 2500));
    const image = await win.webContents.capturePage();
    fs.writeFileSync(SCREENSHOT_PATH, image.toPNG());
    console.log('SCREENSHOT_SAVED ' + SCREENSHOT_PATH);
    win.destroy();
    app.exit(0);
  } catch (err) {
    console.log('SCREENSHOT_ERROR ' + err.message);
    if (win) win.destroy();
    app.exit(1);
  }
}

/* ------------------------------------------------------------------ *
 * 啟動
 * ------------------------------------------------------------------ */

if (SMOKE || SMOKE_WINDOW) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  loadConfig();
}

app.whenReady().then(() => {
  if (SMOKE) {
    runSmoke();
    return;
  }
  if (SMOKE_WINDOW) {
    runSmokeWindow();
    return;
  }
  if (SCREENSHOT) {
    runScreenshot();
    return;
  }
  loadConfig();
  setupIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
