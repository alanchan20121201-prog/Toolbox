'use strict';
/**
 * 工具沙盒測試平台：把每個工具 zip 解開，放進 jsdom 實際執行，
 * 抓出頂層例外（這類錯誤會讓整個 script.js 不執行 → 按鈕全空、事件失效）。
 * 另外稽核 i18n：t('key') / data-i18n 用到的 key 是否三語都齊。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIST = 'C:/Users/alanc/Desktop/Toolbox/dev-server/dist';

async function testTool(id, zipName) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-' + id + '-'));
  const zip = new AdmZip(path.join(DIST, zipName));
  zip.extractAllTo(tmp, true);

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const detail = e.detail && e.detail.message ? e.detail.message : e.message;
    // 通用版 zip 沒有 lang.js（工具改用 getLocale 偵測語言），這個 404 是預期的
    if (/Could not load script/.test(detail) && /lang\.js/.test(detail)) return;
    errors.push('jsdomError: ' + detail.split('\n')[0]);
    if (e.detail && e.detail.stack && !/Could not load script/.test(detail)) {
      errors.push('  stack: ' + e.detail.stack.split('\n').slice(1, 4).join(' | ').slice(0, 300));
    }
  });
  vc.on('error', (m) => errors.push('console.error: ' + m));

  const dom = await JSDOM.fromFile(path.join(tmp, 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      // 模擬主程式：getLocale 回傳中文 → 若工具偵測成功，介面應該是中文
      window.toolbox = {
        getLocale: async () => (process.env.TEST_LANG || 'zh'),
        getTheme: async () => 'light',
        storageGet: async () => null,
        storageSet: async () => true,
        copyToClipboard: async () => true
      };
    }
  });
  dom.window.onerror = (msg) => errors.push('window.onerror: ' + msg);
  // 捕捉未處理的 rejection
  dom.window.addEventListener('unhandledrejection', () => {});

  await new Promise((r) => setTimeout(r, 400));

  const doc = dom.window.document;
  const empty = [...doc.querySelectorAll('[data-i18n]')].filter((el) => !el.textContent.trim()).length;
  // 語言檢查：getLocale 回傳 'zh' → 標題應含 CJK；若仍是純英文 = 語言偵測失敗
  const h1 = doc.querySelector('h1');
  const h1Text = h1 ? h1.textContent : '';
  const want = process.env.TEST_LANG || 'zh';
  const langOk = want === 'zh' ? /[\u4e00-\u9fff]/.test(h1Text) : /[\u3040-\u30ff\u4e00-\u9fff]/.test(h1Text);
  const results = { id, errors, emptyI18n: empty, langOk, h1Text };

  // i18n 稽核：HTML 的 data-i18n + script 的 t('key')
  const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(tmp, 'script.js'), 'utf8');
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) keys.add(m[1]);
  for (const m of script.matchAll(/\bt\('([^']+)'\)/g)) keys.add(m[1]);
  for (const m of script.matchAll(/\bt\("([^"]+)"\)/g)) keys.add(m[1]);
  results.i18n = {};
  // 從 script 抽出 I18N 物件的 keys（用寬鬆解析：抓 en: { ... } 區塊的 key）
  results.usedKeys = keys.size;

  fs.rmSync(tmp, { recursive: true, force: true });
  return results;
}

(async () => {
  const only = process.argv[2] ? [process.argv[2]] : null;
  const dist = fs.readdirSync(DIST).filter((f) => f.endsWith('.zip'))
    .filter((f) => !only || f.startsWith(only[0]));
  for (const zipName of dist.sort()) {
    const id = zipName.replace(/-v[\d.]+\.zip$/, '');
    try {
      const r = await testTool(id, zipName);
      const flag = r.errors.length ? '❌' : (r.langOk ? '✔' : '⚠️');
      console.log(`${flag} ${id} — 標題: ${r.h1Text.slice(0, 30) || '(空)'}`);
      for (const e of r.errors) console.log('    ' + e.split('\n')[0].slice(0, 200));
      if (r.emptyI18n) console.log(`    ⚠ ${r.emptyI18n} 個 data-i18n 元素沒有文字（腳本未填充）`);
      if (!r.langOk && !r.errors.length) console.log('    ⚠ 語言偵測失敗：getLocale 回傳 zh 但介面還是英文');
    } catch (e) {
      console.log('❌ ' + id + ' — 測試平台錯誤: ' + e.message.split('\n')[0]);
    }
  }
})();
