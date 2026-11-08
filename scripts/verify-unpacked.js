'use strict';

/**
 * 驗證 electron-builder 產出的 win-unpacked 是否完整。
 *
 * 背景：v1.0.2 打包時檔案複製被中斷（少了 ffmpeg.dll / libEGL.dll /
 * icudtl.dat / locales 等 Chromium 執行檔），安裝後軟體無法啟動。
 * 因此每次打包後都要跑這個檢查，確認 Node/Electron 原始 dist 裡的
 * 檔案都有被正確複製進去。
 *
 * 用法：node scripts/verify-unpacked.js [unpackedDir]
 *   unpackedDir 預設 release/win-unpacked
 * 結束碼：0 = 通過，1 = 有缺漏
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules', 'electron', 'dist');
const DST = process.argv[2] || path.join(ROOT, 'release', 'win-unpacked');

// dist 檔名 → 打包後檔名（electron-builder 會改名）
const RENAME = {
  'electron.exe': process.env.npm_package_build_productName
    ? `${process.env.npm_package_build_productName}.exe`
    : 'Toolbox.exe',
  LICENSE: 'LICENSE.electron.txt'
};

// electron-builder 刻意排除、執行期不需要的檔案
const IGNORE = new Set(['version']);

// 缺少這些檔案就一定跑不起來
const CRITICAL = [
  'ffmpeg.dll',
  'd3dcompiler_47.dll',
  'libEGL.dll',
  'libGLESv2.dll',
  'icudtl.dat',
  'vk_swiftshader.dll',
  'vulkan-1.dll',
  'locales',
  'resources'
];

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('❌ 找不到 ' + SRC);
    process.exit(1);
  }
  if (!fs.existsSync(DST)) {
    console.error('❌ 找不到 ' + DST);
    process.exit(1);
  }

  let bad = 0;

  for (const e of fs.readdirSync(SRC, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue;
    const target = RENAME[e.name] || e.name;
    const dstPath = path.join(DST, target);

    if (!fs.existsSync(dstPath)) {
      console.log('❌ 缺少：' + target);
      bad++;
      continue;
    }
    if (e.isDirectory()) {
      const nSrc = fs.readdirSync(path.join(SRC, e.name)).length;
      const nDst = fs.readdirSync(dstPath).length;
      if (nSrc !== nDst) {
        console.log(`❌ 目錄不完整：${target}（應有 ${nSrc} 個，實有 ${nDst} 個）`);
        bad++;
      } else {
        console.log(`✔ ${target}/（${nDst} 個檔案）`);
      }
      continue;
    }
    const sSrc = fs.statSync(path.join(SRC, e.name)).size;
    const sDst = fs.statSync(dstPath).size;
    // exe 會被 rcedit 改寫（簽章/版本資源），大小本來就不同
    if (!target.endsWith('.exe') && sSrc !== sDst) {
      console.log(`❌ 大小不符：${target}（${sSrc} → ${sDst}）`);
      bad++;
    } else {
      console.log(`✔ ${target}`);
    }
  }

  console.log('\n核心檔案：');
  for (const f of CRITICAL) {
    const ok = fs.existsSync(path.join(DST, f));
    console.log(`  ${ok ? '✔' : '❌'} ${f}`);
    if (!ok) bad++;
  }

  // resources/app.asar 一定要存在
  const asar = path.join(DST, 'resources', 'app.asar');
  const hasAsar = fs.existsSync(asar);
  console.log(`  ${hasAsar ? '✔' : '❌'} resources/app.asar`);
  if (!hasAsar) bad++;

  if (bad > 0) {
    console.error(`\n❌ 完整性檢查失敗：${bad} 個問題。請勿繼續打包安裝程式！`);
    process.exit(1);
  }
  console.log('\n✅ 完整性檢查全部通過，可以繼續打包安裝程式。');
}

main();
