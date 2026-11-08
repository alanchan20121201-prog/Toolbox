'use strict';

/**
 * 主視窗 preload — 以 contextBridge 安全暴露「框架」能力給前端。
 * 這裡只暴露主程式框架的 API，不暴露 Node 能力給頁面。
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('app:getState'),
  setConfig: (patch) => ipcRenderer.invoke('app:setConfig', patch),
  openToolsFolder: () => ipcRenderer.invoke('app:openToolsFolder'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  getLocaleStrings: (lang) => ipcRenderer.invoke('locale:get', lang),

  catalogList: (force) => ipcRenderer.invoke('catalog:list', force),
  toolsList: () => ipcRenderer.invoke('tools:list'),
  installTool: (toolId) => ipcRenderer.invoke('tools:install', toolId),
  updateTool: (toolId) => ipcRenderer.invoke('tools:update', toolId),
  uninstallTool: (toolId) => ipcRenderer.invoke('tools:uninstall', toolId),

  onInstallProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('install:progress', handler);
    return () => ipcRenderer.removeListener('install:progress', handler);
  },

  /* 應用程式自我更新 */
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  applyUpdate: async (url, onProgress) => {
    const handler = (_e, d) => onProgress(d && d.percent);
    ipcRenderer.on('update:progress', handler);
    try {
      return await ipcRenderer.invoke('app:apply-update', url);
    } finally {
      ipcRenderer.removeListener('update:progress', handler);
    }
  }
});
