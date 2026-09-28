'use strict';
/**
 * 稽核工具：
 *   1. 找出 $('...') 呼叫時誤帶 '#' 前綴的寫法（$ 底層是 getElementById，帶 # 一定取不到元素）
 *   2. 稽核三語 i18n：HTML 的 data-i18n / data-i18n-ph 與 script 的 t('key')
 *      用到的每個 key，是否 en / zh / jp 三份字典都有
 */
const fs = require('fs');
const path = require('path');
const glob = fs.readdirSync(path.join(__dirname, '..', 'test-tools'));

const ROOT = path.join(__dirname, '..', 'test-tools');
let hashIssues = 0;
let i18nIssues = 0;

for (const id of glob) {
  const dir = path.join(ROOT, id);
  const scriptPath = path.join(dir, 'script.js');
  const htmlPath = path.join(dir, 'index.html');
  if (!fs.existsSync(scriptPath)) continue;

  const script = fs.readFileSync(scriptPath, 'utf8');
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';

  // --- 1. $('#...') 誤用 ---
  const hashCalls = script.match(/\$\(\s*['"]#/g) || [];
  if (hashCalls.length) {
    hashIssues++;
    console.log(`❌ [${id}] $() 呼叫誤帶 # 前綴：${hashCalls.length} 處（getElementById 不吃 #，會取不到元素）`);
  }

  // --- 2. i18n 缺 key ---
  //   從 script 取出 I18N 物件（用 vm 執行一段只含 I18N 的程式）
  let I18N = null;
  try {
    const start = script.indexOf('const I18N =');
    if (start >= 0) {
      const braceStart = script.indexOf('{', start);
      let depth = 0, end = -1;
      for (let i = braceStart; i < script.length; i++) {
        if (script[i] === '{') depth++;
        else if (script[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
      }
      I18N = eval('(' + script.slice(braceStart, end) + ')');
    }
  } catch (e) {
    console.log(`⚠ [${id}] I18N 解析失敗：${e.message}`);
  }
  if (!I18N) continue;

  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) keys.add(m[1]);
  for (const m of script.matchAll(/\bt\(\s*['"]([^'"]+)['"]\s*\)/g)) keys.add(m[1]);

  const missing = { en: [], zh: [], jp: [] };
  for (const k of keys) {
    for (const lang of ['en', 'zh', 'jp']) {
      if (!I18N[lang] || I18N[lang][k] === undefined) missing[lang].push(k);
    }
  }
  const total = Object.values(missing).reduce((a, b) => a + b.length, 0);
  if (total) {
    i18nIssues++;
    console.log(`❌ [${id}] 缺翻譯：en[${missing.en.length}] zh[${missing.zh.length}] jp[${missing.jp.length}]`);
    for (const lang of ['en', 'zh', 'jp']) if (missing[lang].length) console.log(`     ${lang}: ${missing[lang].join(', ')}`);
  }
}

console.log('\n==============================');
console.log(`$() 誤帶 # 的工具：${hashIssues} 個`);
console.log(`翻譯不完整的工具：${i18nIssues} 個`);
console.log(hashIssues === 0 && i18nIssues === 0 ? '✅ 全部通過' : '❌ 有問題需修正');
