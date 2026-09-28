'use strict';

/**
 * 工具沙盒 preload — 在每個工具 <webview> 內執行（contextIsolation=on）。
 * 只暴露一組白名單 Tool API 給工具的 window.toolbox，
 * 實際權限由主進程依該工具 manifest.json 的 permissions 做最終驗證。
 */

const { contextBridge, ipcRenderer } = require('electron');

const call = (method, ...args) => ipcRenderer.invoke('tool:call', { method, args });

contextBridge.exposeInMainWorld('toolbox', {
  // 底層通用呼叫（進階用法）
  call,

  // 檔案對話框
  openFile: (opts) => call('openFile', opts),
  saveFile: (opts) => call('saveFile', opts),

  // 檔案讀寫
  readFile: (p) => call('readFile', p),               // → base64 string
  readTextFile: (p) => call('readTextFile', p),       // → utf8 string
  readFileAsDataURL: (p) => call('readFileAsDataURL', p),
  writeFile: (p, base64) => call('writeFile', p, base64),
  writeTextFile: (p, text) => call('writeTextFile', p, text),

  // 剪貼簿
  copyToClipboard: (text) => call('copyToClipboard', text),
  readClipboard: () => call('readClipboard'),

  // 系統
  notify: (opts) => call('notify', opts),
  openExternal: (url) => call('openExternal', url),
  showItemInFolder: (p) => call('showItemInFolder', p),

  // 環境
  getTheme: () => call('getTheme'),
  getLocale: () => call('getLocale'),

  // 工具私有持久化儲存（加密後存本機，重開機/重啟程式都在）
  storageGet: (key) => call('storageGet', key),        // → string | null
  storageSet: (key, value) => call('storageSet', key, value)
});
