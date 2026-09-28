'use strict';

/**
 * Toolbox — 前端互動與動態渲染
 * 職責：側欄導航、市集列表、設定、工具 webview 載入與安裝進度。
 */

/* 重要：contextBridge.exposeInMainWorld('api') 會在 window 上建立「不可配置」的屬性，
   若在此用 const api 宣告同名全域詞法綁定會丟 SyntaxError 導致整個檔案不執行，
   因此變數名必須避開 'api'。 */
const bridge = window.api;

/* 錯誤僅記錄到 console（不顯示紅字，避免干擾使用者） */
window.addEventListener('error', (e) => console.error('[Toolbox]', e.message || e));
window.addEventListener('unhandledrejection', (e) => console.error('[Toolbox]', (e.reason && e.reason.message) || e.reason));

const state = {
  view: 'shop',
  currentToolId: null,
  language: 'en',
  configLanguage: 'en',
  theme: 'light',
  toolsDir: '',
  toolPreloadPath: '',
  appVersion: '',
  manifestUrl: '',
  catalog: [],
  installed: [],
  installing: {} // toolId -> { percent, stage }
};

let I18N = {};
const t = (k, ...args) => {
  let s = I18N[k] != null ? I18N[k] : k;
  args.forEach((a, i) => { s = s.replace(`{${i}}`, a); });
  return s;
};

let currentWebview = null;

/* ---------------- 初始化 ---------------- */

async function init() {
  const s = await bridge.getState();
  state.language = s.language;
  state.configLanguage = s.config.language;
  state.theme = s.config.theme;
  state.toolsDir = s.toolsDir;
  state.toolPreloadPath = s.toolPreloadPath;
  state.appVersion = s.appVersion;
  state.manifestUrl = s.manifestUrl;

  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('version-label').textContent = 'v' + state.appVersion;

  bridge.onInstallProgress(onInstallProgress);
  bindNav();
  await loadI18n(state.language);
  // 立即渲染市集（避免右側空白），再於背景刷新資料
  renderShopLoading();
  refreshAll().catch(() => {});
}

async function loadI18n(lang) {
  I18N = await bridge.getLocaleStrings(lang);
  applyI18n();
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.title = t('app.title');
}

/** 依目前語系取 name/description 物件中的字串 */
function loc(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[state.language] || obj.en || Object.values(obj)[0] || '';
}

/* ---------------- 導航 ---------------- */

function bindNav() {
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
  });
}

function switchView(view) {
  if (view === 'tool' && state.view === 'tool') return;
  destroyWebview();
  state.view = view;
  state.currentToolId = null;
  updateNavActive();
  renderContent();
}

function updateNavActive() {
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === state.view);
  });
  document.querySelectorAll('.tool-item').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-tool') === state.currentToolId && state.view === 'tool');
  });
}

/* ---------------- 資料刷新 ---------------- */

async function refreshAll() {
  await Promise.all([refreshInstalled(), refreshCatalog()]);
}

async function refreshInstalled() {
  state.installed = await bridge.toolsList();
  renderSidebarTools();
}

async function refreshCatalog() {
  try {
    state.catalog = await bridge.catalogList(false);
    if (state.view === 'shop') withPreservedScroll(() => renderShop());
  } catch (err) {
    if (state.view === 'shop') withPreservedScroll(() => renderShop(err));
  }
}

/* ---------------- 側欄：我的工具 ---------------- */

function renderSidebarTools() {
  const list = document.getElementById('tool-list');
  const empty = document.getElementById('tool-list-empty');
  list.innerHTML = '';
  empty.style.display = state.installed.length ? 'none' : 'block';

  state.installed.forEach((tool) => {
    const btn = document.createElement('button');
    btn.className = 'tool-item';
    btn.setAttribute('data-tool', tool.id);
    const logo = tool.icon
      ? `<img class="tool-logo" src="${tool.icon}" alt="" />`
      : `<span class="tool-logo" style="display:flex;align-items:center;justify-content:center;">📦</span>`;
    btn.innerHTML = `${logo}<span class="tool-name">${escapeHtml(loc(tool.name))}</span>`;
    btn.addEventListener('click', () => openTool(tool.id));
    list.appendChild(btn);
  });
  updateNavActive();
}

/* ---------------- 內容渲染 ---------------- */

/**
 * 執行「會整塊重繪內容」的動作，但保留捲軸位置。
 * 真正的捲動容器是 .page（#content 本身 overflow:hidden），
 * 所以兩種都要記住：重繪後捲軸才不會彈回頂部。
 */
function withPreservedScroll(fn) {
  const c = document.getElementById('content');
  const page = c ? c.querySelector('.page') : null;
  const prev = page ? page.scrollTop : (c ? c.scrollTop : 0);
  fn();
  const page2 = c ? c.querySelector('.page') : null;
  const target = page2 || c;
  if (target && prev > 0) target.scrollTop = prev;
}

function renderContent() {
  const c = document.getElementById('content');
  withPreservedScroll(() => {
    if (state.view === 'shop') renderShop();
    else if (state.view === 'settings') renderSettings();
    else if (state.view === 'mytools') renderMyTools();
    else if (state.view === 'tool') renderTool();
    else c.innerHTML = '';
  });
}

function renderShop(err) {
  const c = document.getElementById('content');
  c.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">${t('shop.title')}</h1>
        <p class="page-subtitle">${t('shop.subtitle')}</p>
      </div>
      <div style="margin-bottom:18px;">
        <button class="btn" id="btn-refresh">${t('shop.refresh')}</button>
      </div>
      ${err
        ? `<div class="empty-state">⚠️ ${t('shop.error')}<br/>${t('shop.checkConnection')}</div>`
        : (state.catalog.length
            ? `<div class="card-grid">${state.catalog.map(renderCard).join('')}</div>`
            : `<div class="empty-state">${t('shop.empty')}</div>`)}
    </div>`;

  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', () => { renderShopLoading(); refreshCatalog().catch(() => {}); });

  state.catalog.forEach(bindShopButtons);
}

function renderShopLoading() {
  const c = document.getElementById('content');
  c.innerHTML = `<div class="page"><div class="empty-state">${t('shop.loading')}</div></div>`;
}

/* ---------------- 我的工具（已下載工具頁） ---------------- */

function renderMyTools() {
  const c = document.getElementById('content');
  const items = state.installed;
  c.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">${t('nav.myToolsPage')}</h1>
        <p class="page-subtitle">${t('mytools.subtitle')}</p>
      </div>
      ${items.length
        ? `<div class="card-grid">${items.map(renderInstalledCard).join('')}</div>`
        : `<div class="empty-state">${t('nav.noTools')}</div>`}
    </div>`;

  items.forEach((tool) => {
    const openBtn = document.getElementById(`btn-open-${tool.id}`);
    const rmBtn = document.getElementById(`btn-remove-${tool.id}`);
    if (openBtn) openBtn.addEventListener('click', () => openTool(tool.id));
    if (rmBtn) rmBtn.addEventListener('click', () => uninstallTool(tool.id));
  });
}

/** 從市集清單找出該工具目前語系的安裝包大小（找不到就回空字串） */
function catalogSizeFor(id) {
  const it = state.catalog.find((c) => c.id === id);
  return it ? pickSize(it) : '';
}

function renderInstalledCard(tool) {
  const size = catalogSizeFor(tool.id);
  return `
    <div class="card">
      <div class="card-head">
        ${tool.icon
          ? `<img class="card-logo" src="${tool.icon}" alt="" />`
          : `<div class="card-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">📦</div>`}
        <div>
          <h3 class="card-title">${escapeHtml(loc(tool.name))}</h3>
          <div class="card-version">v${escapeHtml(tool.version)}${size ? `<span class="card-size"> · ${escapeHtml(size)}</span>` : ''}</div>
        </div>
      </div>
      <p class="card-desc">${escapeHtml(loc(tool.description))}</p>
      <div class="card-actions">
        <button class="btn primary" id="btn-open-${tool.id}">${t('mytools.open')}</button>
        <button class="btn danger" id="btn-remove-${tool.id}">${t('shop.uninstall')}</button>
      </div>
    </div>`;
}

function installedVersion(id) {
  const it = state.installed.find((x) => x.id === id);
  return it ? it.version : null;
}

/** 卡片下方的按鈕區（安裝中 → 進度條；已安裝 → 更新/移除；未安裝 → 安裝） */
function renderCardActions(item) {
  const installed = installedVersion(item.id);
  const hasUpdate = installed && installed !== item.version;
  const prog = state.installing[item.id];

  if (prog) {
    return renderProgress(item.id, prog);
  }
  if (installed) {
    return `
        <span class="card-version">✅ ${t('shop.installed')} · v${escapeHtml(installed)}${pickSize(item) ? ` · ${escapeHtml(pickSize(item))}` : ''}</span>
        ${hasUpdate ? `<button class="btn primary" id="btn-update-${item.id}">${t('shop.update')}</button>` : ''}
        <button class="btn danger" id="btn-uninstall-${item.id}">${t('shop.uninstall')}</button>`;
  }
  return `<button class="btn primary" id="btn-install-${item.id}">${t('shop.install')}</button>`;
}

/** 只重繪單張卡片的按鈕區（安裝/更新時用，避免整頁重繪把捲軸彈回頂部） */
function refreshShopCard(toolId) {
  const item = state.catalog.find((x) => x.id === toolId);
  const box = document.getElementById('actions-' + toolId);
  if (!item || !box) { renderContent(); return; }
  box.innerHTML = renderCardActions(item);
  bindShopButtons(item);
}

/** 綁定單張卡片的按鈕事件 */
function bindShopButtons(item) {
  const installBtn = document.getElementById(`btn-install-${item.id}`);
  const updateBtn = document.getElementById(`btn-update-${item.id}`);
  const uninstallBtn = document.getElementById(`btn-uninstall-${item.id}`);
  if (installBtn) installBtn.addEventListener('click', () => installTool(item.id));
  if (updateBtn) updateBtn.addEventListener('click', () => updateTool(item.id));
  if (uninstallBtn) uninstallBtn.addEventListener('click', () => uninstallTool(item.id));
}

function renderCard(item) {
  const actions = renderCardActions(item);

  return `
    <div class="card">
      <div class="card-head">
        ${item.icon
          ? `<img class="card-logo" src="${escapeHtml(item.icon)}" alt="" onerror="this.style.visibility='hidden'" />`
          : `<div class="card-logo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">📦</div>`}
        <div>
          <h3 class="card-title">${escapeHtml(loc(item.name))}</h3>
          ${renderMetaLine(item)}
        </div>
      </div>
      <p class="card-desc">${escapeHtml(loc(item.description))}</p>
      <div class="card-actions" id="actions-${item.id}">${actions}</div>
    </div>`;
}

/**
 * 卡片標題下的中繼資訊列：「v1.0.0 · 128 KB」
 * 大小刻意維持與版本相同的字級與顏色（再淡一點），不要搶眼。
 */
function renderMetaLine(item) {
  const versionHtml = 'v' + escapeHtml(item.version);
  const sizeHtml = pickSize(item);
  if (!sizeHtml) return `<div class="card-version">${versionHtml}</div>`;
  return `<div class="card-version">${versionHtml}<span class="card-size"> · ${escapeHtml(sizeHtml)}</span></div>`;
}

/** 從 item.size（數字 或 依語言分組的物件）取出目前語系的大小，轉成人類可讀字串 */
function pickSize(item) {
  const raw = item && item.size;
  if (raw == null) return '';
  let bytes;
  if (typeof raw === 'number') {
    bytes = raw;
  } else {
    const positive = (v) => typeof v === 'number' && v > 0;
    bytes = [raw[state.language], raw.en].find(positive);
    if (bytes == null) bytes = Object.values(raw).find(positive);
  }
  return formatBytes(bytes);
}

/** 位元組 → 人類可讀大小（1024 進位） */
function formatBytes(bytes) {
  const n = Number(bytes);
  if (!isFinite(n) || n <= 0) return '';
  if (n < 1024) return n + ' B';
  const kb = n / 1024;
  if (kb < 1024) return kb.toFixed(kb < 10 ? 1 : 0) + ' KB';
  const mb = kb / 1024;
  return mb.toFixed(mb < 10 ? 1 : 0) + ' MB';
}

function renderProgress(toolId, prog) {
  const pct = prog.percent || 0;
  const stage = t('stage.' + (prog.stage || 'downloading')) || prog.stage;
  return `
    <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="progress-label">${stage} ${pct}%</span>
    </div>`;
}

/* ---------------- 設定 ---------------- */

function renderSettings() {
  const c = document.getElementById('content');
  const langs = [
    ['auto', t('settings.lang.auto')],
    ['en', 'English'],
    ['zh', '简体中文'],
    ['jp', '日本語']
  ];
  c.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">${t('settings.title')}</h1>
      </div>
      <div class="settings-form">
        <div class="form-row">
          <label class="form-label">${t('settings.language')}</label>
          <select id="sel-lang">
            ${langs.map(([v, label]) => `<option value="${v}" ${(state.configLanguage || 'auto') === v ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label class="form-label">${t('settings.theme')}</label>
          <select id="sel-theme">
            <option value="light" ${state.theme === 'light' ? 'selected' : ''}>${t('settings.theme.light')}</option>
            <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>${t('settings.theme.dark')}</option>
          </select>
        </div>
        <div class="form-row">
          <label class="form-label">${t('settings.appUpdate')}</label>
          <div class="form-hint" id="update-status">${t('settings.upToDate')}（v${escapeHtml(state.appVersion)}）</div>
          <button class="btn primary" id="btn-apply-update" hidden>${t('settings.btnApply')}</button>
        </div>
        <div class="form-actions">
          <button class="btn" id="btn-open-folder">${t('settings.openToolsFolder')}</button>
          <button class="btn" id="btn-check-update">${t('settings.checkUpdate')}</button>
        </div>
        <div class="feedback-row"><a href="#" id="btn-feedback">${t('settings.feedback')}</a></div>
        <div class="form-hint">${t('settings.about')} · Toolbox v${escapeHtml(state.appVersion)}</div>
      </div>
    </div>`;

  document.getElementById('sel-lang').addEventListener('change', async (e) => {
    await bridge.setConfig({ language: e.target.value });
    location.reload();
  });
  document.getElementById('sel-theme').addEventListener('change', async (e) => {
    state.theme = e.target.value;
    document.documentElement.setAttribute('data-theme', state.theme);
    await bridge.setConfig({ theme: e.target.value });
  });
  document.getElementById('btn-open-folder').addEventListener('click', () => bridge.openToolsFolder());

  /* 意見回饋：開啟 GitHub Issues（低調放置，點擊以系統瀏覽器開啟） */
  document.getElementById('btn-feedback').addEventListener('click', (e) => {
    e.preventDefault();
    bridge.openExternal('https://github.com/alanchan20121201-prog/Toolbox/issues/new');
  });

  /* 檢查應用程式更新 */
  document.getElementById('btn-check-update').addEventListener('click', async () => {
    const btn = document.getElementById('btn-check-update');
    const st = document.getElementById('update-status');
    const applyBtn = document.getElementById('btn-apply-update');
    btn.disabled = true;
    st.textContent = t('shop.loading');
    try {
      const r = await bridge.checkUpdate();
      if (r.available) {
        st.textContent = t('settings.newVersion').replace('{0}', r.version);
        applyBtn.dataset.url = r.url;
        applyBtn.hidden = false;
      } else {
        applyBtn.hidden = true;
        st.textContent = (r.error ? t('settings.checkFail') : t('settings.upToDate')) + `（v${r.current}）`;
      }
    } catch {
      st.textContent = t('settings.checkFail');
    }
    btn.disabled = false;
  });

  /* 下載並啟動新版安裝程式 */
  document.getElementById('btn-apply-update').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const st = document.getElementById('update-status');
    btn.disabled = true;
    try {
      await bridge.applyUpdate(btn.dataset.url, (pct) => {
        st.textContent = `${t('settings.downloading')} ${pct}%`;
      });
      st.textContent = t('settings.restarting');
    } catch (err) {
      st.textContent = t('settings.checkFail');
      btn.disabled = false;
    }
  });
}

/* ---------------- 工具載入 (webview 沙盒) ---------------- */

function openTool(toolId) {
  const tool = state.installed.find((x) => x.id === toolId);
  if (!tool) return;
  destroyWebview();
  state.lastView = state.view === 'tool' ? (state.lastView || 'shop') : state.view;
  state.view = 'tool';
  state.currentToolId = toolId;
  updateNavActive();
  renderTool();
}

function renderTool() {
  const c = document.getElementById('content');
  const tool = state.installed.find((x) => x.id === state.currentToolId);
  if (!tool) { switchView('shop'); return; }

  c.innerHTML = `
    <div class="tool-view-wrap">
      <div class="tool-toolbar">
        <button class="btn" id="btn-back">← ${t('tool.back')}</button>
        <span class="tool-title">${escapeHtml(loc(tool.name))}</span>
        <span class="spacer"></span>
        <button class="btn" id="btn-reload">${t('tool.reload')}</button>
        <button class="btn" id="btn-open-folder">${t('tool.openFolder')}</button>
      </div>
      <div id="tool-container" style="flex:1;display:flex;"></div>
    </div>`;

  document.getElementById('btn-back').addEventListener('click', () => switchView(state.lastView || 'shop'));
  document.getElementById('btn-reload').addEventListener('click', () => loadWebview(tool));
  document.getElementById('btn-open-folder').addEventListener('click', () => bridge.openToolsFolder());

  loadWebview(tool);
}

function loadWebview(tool) {
  const container = document.getElementById('tool-container');
  if (!container) return;
  destroyWebview();

  const wv = document.createElement('webview');
  wv.id = 'tool-view';
  wv.setAttribute('partition', 'persist:toolbox-tool-' + tool.id);
  wv.setAttribute('preload', state.toolPreloadPath);
  wv.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no');
  wv.setAttribute('allowpopups', 'false');
  wv.src = tool.entryUrl;

  wv.addEventListener('did-fail-load', (e) => {
    if (e.errorCode !== -3) toast(t('tool.error') + ': ' + e.errorDescription, true);
  });

  container.appendChild(wv);
  currentWebview = wv;
}

function destroyWebview() {
  if (currentWebview) {
    try { currentWebview.remove(); } catch {}
    currentWebview = null;
  }
}

/* ---------------- 安裝 / 更新 / 移除 ---------------- */

function onInstallProgress(data) {
  state.installing[data.toolId] = data;
  if (state.view !== 'shop') return;
  const box = document.getElementById('actions-' + data.toolId);
  if (box) box.innerHTML = renderProgress(data.toolId, data);
}

/** 安裝/更新期間只重繪該張卡片，整頁不重繪 → 捲軸不會彈回頂部 */
function beginInstall(toolId) {
  state.installing[toolId] = { percent: 0, stage: 'downloading' };
  if (state.view === 'shop') refreshShopCard(toolId);
  else renderContent();
}

function endInstall(toolId) {
  delete state.installing[toolId];
  if (state.view === 'shop') refreshShopCard(toolId);
  else renderContent();
}

async function installTool(toolId) {
  beginInstall(toolId);
  try {
    await bridge.installTool(toolId);
    toast(t('shop.installDone'));
  } catch (err) {
    toast(t('shop.error') + ': ' + err.message, true);
  } finally {
    await refreshInstalled();
    endInstall(toolId);
  }
}

async function updateTool(toolId) {
  beginInstall(toolId);
  try {
    await bridge.updateTool(toolId);
    toast(t('shop.updateDone'));
  } catch (err) {
    toast(t('shop.error') + ': ' + err.message, true);
  } finally {
    await refreshInstalled();
    endInstall(toolId);
  }
}

async function uninstallTool(toolId) {
  if (!confirm(t('shop.confirmUninstall'))) return;
  await bridge.uninstallTool(toolId);
  await refreshInstalled();
  if (state.view === 'shop') refreshShopCard(toolId);
  else renderContent();
  toast(t('shop.uninstallDone'));
}

/* ---------------- 工具提示 ---------------- */

let toastTimer = null;
function toast(msg, isError = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3000);
}

/* ---------------- 工具函式 ---------------- */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------------- 啟動 ---------------- */

// 腳本位於 body 結尾，DOM 已就緒；不用等待 DOMContentLoaded，避免任何資源卡住時整個介面卡死
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
