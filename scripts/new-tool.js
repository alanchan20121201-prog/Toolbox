'use strict';

/**
 * 新增工具 scaffold：
 *   node scripts/new-tool.js my-tool
 *
 * 從 test-tools/_template 複製一份到 test-tools/my-tool，並自動帶入 id 與標題。
 * 接著只要：
 *   1. 編輯 my-tool/manifest.json —— 三語 name / description、permissions
 *   2. 編輯 my-tool/script.js    —— 把 YOUR_LOGIC() 換成真正邏輯、補齊三語 I18N
 *   3. node scripts/build-tools.js —— 自動掃描，不需手動註冊
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEST_TOOLS = path.join(ROOT, 'test-tools');
const TEMPLATE = path.join(TEST_TOOLS, '_template');

const id = process.argv[2];

if (!id) {
  console.error('用法：node scripts/new-tool.js <tool-id>');
  console.error('範例：node scripts/new-tool.js json-formatter');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error('❌ tool-id 只能用「小寫英數字 + 連字號」，且必須以英數字開頭（例：my-tool）');
  process.exit(1);
}

const dest = path.join(TEST_TOOLS, id);
if (fs.existsSync(dest)) {
  console.error('❌ 已存在：' + dest);
  process.exit(1);
}
if (!fs.existsSync(TEMPLATE)) {
  console.error('❌ 找不到範本目錄：' + TEMPLATE);
  process.exit(1);
}

fs.cpSync(TEMPLATE, dest, { recursive: true });

// 帶入 id
const manifestPath = path.join(dest, 'manifest.json');
fs.writeFileSync(
  manifestPath,
  fs.readFileSync(manifestPath, 'utf8').replace('"TOOL_ID"', JSON.stringify(id))
);

// 帶入標題
const htmlPath = path.join(dest, 'index.html');
fs.writeFileSync(
  htmlPath,
  fs.readFileSync(htmlPath, 'utf8').replace('<title>My New Tool</title>', `<title>${id}</title>`)
);

console.log(`✔ 已建立 test-tools/${id}/`);
console.log('');
console.log('接下來的步驟：');
console.log(`  1. 編輯 test-tools/${id}/manifest.json —— 三語名稱/描述、permissions（最小授權）`);
console.log(`  2. 編輯 test-tools/${id}/script.js    —— 把 YOUR_LOGIC() 換成你的邏輯、補齊三語`);
console.log('  3. node scripts/build-tools.js        —— 自動產生 logo + 三語 zip + tools.json');
console.log('');
console.log('（logo 會自動產生；想用自己的話，把 logo.png 放進工具資料夾即可）');
