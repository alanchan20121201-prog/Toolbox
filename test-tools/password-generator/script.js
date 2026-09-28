'use strict';

/**
 * 密碼工具箱（原密碼產生器）— 三合一：
 *   1. 生成：本機 crypto.getRandomValues 隨機產生
 *   2. 保存庫：帳密存在本機（主程式以 Windows DPAPI 加密，綁定使用者帳戶），重開機都在
 *   3. 強度檢測：熵值 + 常見密碼/鍵盤/重複/連續樣式偵測 + 破解時間估算
 * 語系由建置時注入的 lang.js（window.__TOOL_LANG__）決定。
 */

const tb = window.toolbox || {};
let LANG = window.__TOOL_LANG__ || 'en';

const I18N = {
  en: {
    title: '🔑 Password Toolbox',
    subtitle: 'Generate · local encrypted vault · strength check — everything stays on your computer',
    tabGen: '🎲 Generator', tabVault: '🔐 Vault', tabCheck: '🛡️ Strength check',
    placeholder: 'Click "Generate"',
    length: 'Length', upper: 'Uppercase A-Z', lower: 'Lowercase a-z', digits: 'Digits 0-9', symbols: 'Symbols !@#$…',
    generate: '🎲 Generate', copy: '📋 Copy', toVault: '💾 Save',
    emptySet: 'Select at least one character type',
    generated: 'Generated — click "Copy" to copy to clipboard',
    generateFirst: 'Generate a password first',
    copyDone: '✅ Copied to clipboard', copyError: 'Copy failed: ',
    vaultHint: 'Stored encrypted on this computer (Windows user account bound). Nothing is uploaded.',
    vaultUserPh: 'Username / site name', vaultPassPh: 'Password',
    vaultSearchPh: '🔍 Search by username…',
    vaultSave: '💾 Save',
    vaultEmpty: 'No saved entries yet',
    vaultSaved: '✅ Saved to vault',
    vaultNeedUser: 'Please enter a username / site name',
    vaultNeedPass: 'Please enter a password',
    vaultDeleted: '🗑️ Deleted',
    vaultLoadError: 'Vault read failed: ',
    vaultSaveError: 'Vault write failed: ',
    checkPh: 'Type a password to check',
    vVeryWeak: '🚨 Very weak', vWeak: '⚠️ Weak', vFair: '🤔 Fair', vStrong: '💪 Strong', vVeryStrong: '🏆 Very strong',
    entropy: 'Entropy', guessesPerSec: '≈ offline attack at 100 billion guesses/sec',
    crackTime: 'Time to crack',
    tipLength: 'Use at least 12 characters',
    tipClass: 'Mix uppercase, lowercase, digits and symbols',
    tipCommon: 'This is one of the most commonly used passwords — avoid it',
    tipSeq: 'Contains sequences like "abc" or "123"',
    tipRepeat: 'Contains repeated characters like "aaa"',
    tipKeyboard: 'Contains keyboard patterns like "qwerty"',
    tipDigitsOnly: 'Digits only — far too easy to brute-force',
    tipOk: 'No obvious weaknesses found. Nice password!'
  },
  zh: {
    title: '🔑 密码工具箱',
    subtitle: '生成 · 本机加密保存库 · 强度检测 —— 一切都在你的电脑上',
    tabGen: '🎲 生成', tabVault: '🔐 保存库', tabCheck: '🛡️ 强度检测',
    placeholder: '点击「生成密码」',
    length: '长度', upper: '大写字母 A-Z', lower: '小写字母 a-z', digits: '数字 0-9', symbols: '符号 !@#$…',
    generate: '🎲 生成密码', copy: '📋 复制', toVault: '💾 保存',
    emptySet: '请至少勾选一种字符',
    generated: '已生成，点「复制」可复制到剪贴板',
    generateFirst: '请先生成密码',
    copyDone: '✅ 已复制到剪贴板', copyError: '复制失败：',
    vaultHint: '保存在本机并加密（绑定 Windows 用户账户），不会上传到任何地方。',
    vaultUserPh: '用户名称 / 网站名称', vaultPassPh: '密码',
    vaultSearchPh: '🔍 输入用户名称查找…',
    vaultSave: '💾 保存',
    vaultEmpty: '还没有保存的记录',
    vaultSaved: '✅ 已保存到保存库',
    vaultNeedUser: '请输入用户名称 / 网站名称',
    vaultNeedPass: '请输入密码',
    vaultDeleted: '🗑️ 已删除',
    vaultLoadError: '保存库读取失败：',
    vaultSaveError: '保存库写入失败：',
    checkPh: '输入要检测的密码',
    vVeryWeak: '🚨 非常弱', vWeak: '⚠️ 弱', vFair: '🤔 一般', vStrong: '💪 强', vVeryStrong: '🏆 非常强',
    entropy: '熵值', guessesPerSec: '按每秒 1000 亿次离线暴力破解估算',
    crackTime: '破解所需时间',
    tipLength: '建议至少 12 个字符',
    tipClass: '混合大小写、数字和符号',
    tipCommon: '这是最常见的密码之一，请避免使用',
    tipSeq: '包含连续字符，如 "abc"、"123"',
    tipRepeat: '包含重复字符，如 "aaa"',
    tipKeyboard: '包含键盘排列，如 "qwerty"',
    tipDigitsOnly: '纯数字——太容易被暴力破解',
    tipOk: '未发现明显弱点，不错的密码！'
  },
  jp: {
    title: '🔑 パスワードツールボックス',
    subtitle: '生成・ローカル暗号化ボールト・強度チェック —— すべて端末内で完結',
    tabGen: '🎲 生成', tabVault: '🔐 ボールト', tabCheck: '🛡️ 強度チェック',
    placeholder: '「生成」をクリック',
    length: '長さ', upper: '大文字 A-Z', lower: '小文字 a-z', digits: '数字 0-9', symbols: '記号 !@#$…',
    generate: '🎲 生成', copy: '📋 コピー', toVault: '💾 保存',
    emptySet: '少なくとも1種類選択してください',
    generated: '生成しました。「コピー」でクリップボードへ',
    generateFirst: '先にパスワードを生成してください',
    copyDone: '✅ クリップボードにコピーしました', copyError: 'コピー失敗：',
    vaultHint: 'この端末内に暗号化して保存（Windows ユーザーアカウントに紐付け）。アップロードは一切ありません。',
    vaultUserPh: 'ユーザー名 / サイト名', vaultPassPh: 'パスワード',
    vaultSearchPh: '🔍 ユーザー名で検索…',
    vaultSave: '💾 保存',
    vaultEmpty: '保存された項目はありません',
    vaultSaved: '✅ ボールトに保存しました',
    vaultNeedUser: 'ユーザー名 / サイト名を入力してください',
    vaultNeedPass: 'パスワードを入力してください',
    vaultDeleted: '🗑️ 削除しました',
    vaultLoadError: 'ボールトの読み込み失敗：',
    vaultSaveError: 'ボールトの書き込み失敗：',
    checkPh: 'チェックしたいパスワードを入力',
    vVeryWeak: '🚨 非常に弱い', vWeak: '⚠️ 弱い', vFair: '🤔 普通', vStrong: '💪 強い', vVeryStrong: '🏆 非常に強い',
    entropy: 'エントロピー', guessesPerSec: '毎秒1000億回のオフライン攻撃で試算',
    crackTime: '解読にかかる時間',
    tipLength: '12文字以上を推奨',
    tipClass: '大文字・小文字・数字・記号を混ぜましょう',
    tipCommon: '最もよく使われるパスワードの一つです — 避けましょう',
    tipSeq: '"abc" や "123" のような連続文字が含まれています',
    tipRepeat: '"aaa" のような繰り返し文字が含まれています',
    tipKeyboard: '"qwerty" のようなキーボードパターンが含まれています',
    tipDigitsOnly: '数字のみ — 総当たり攻撃に極めて弱いです',
    tipOk: '明顯な弱点は見つかりませんでした。良いパスワードです！'
  }
};

const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;

/* ---------------- 共用：語系 / 分頁 ---------------- */

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  document.getElementById('pw').textContent = t('placeholder');
  document.title = I18N[LANG] ? I18N[LANG].title : 'Password Toolbox';
}

function switchTab(name) {
  for (const id of ['gen', 'vault', 'check']) {
    document.getElementById('tab-' + id).classList.toggle('active', id === name);
    document.getElementById('panel-' + id).hidden = id !== name;
  }
}
document.getElementById('tab-gen').addEventListener('click', () => switchTab('gen'));
document.getElementById('tab-vault').addEventListener('click', () => switchTab('vault'));
document.getElementById('tab-check').addEventListener('click', () => switchTab('check'));

function setStatus(el, msg, isErr = false) {
  el.textContent = msg;
  el.className = 'status' + (isErr ? ' err' : '');
}

/* ================= 1. 生成 ================= */

const pwEl = document.getElementById('pw');
const lenInput = document.getElementById('length');
const lenVal = document.getElementById('len-val');
const strengthBar = document.getElementById('strength-bar');
const statusEl = document.getElementById('status');

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/'
};

let currentPw = '';

lenInput.addEventListener('input', () => { lenVal.textContent = lenInput.value; });

function generate() {
  const selected = ['upper', 'lower', 'digits', 'symbols']
    .filter((k) => document.getElementById(k).checked)
    .map((k) => SETS[k]);
  const len = parseInt(lenInput.value, 10);

  if (!selected.length) {
    pwEl.textContent = t('emptySet');
    strengthBar.style.width = '0';
    return;
  }

  const pool = selected.join('');
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < len; i++) out += pool[buf[i] % pool.length];

  // 確保每個被選中的集合至少出現一次（避免長密碼仍缺某類）
  const indices = [...out].map((c) => {
    for (let s = 0; s < selected.length; s++) if (selected[s].includes(c)) return s;
    return 0;
  });
  selected.forEach((_s, si) => {
    if (!indices.includes(si)) {
      const pos = buf[0] % len;
      out = out.slice(0, pos) + selected[si][buf[1] % selected[si].length] + out.slice(pos + 1);
    }
  });

  currentPw = out;
  pwEl.textContent = out;
  updateStrength(len, selected.length);
  setStatus(statusEl, t('generated'));
}

function updateStrength(len, cats) {
  const entropy = Math.round(len * Math.log2(cats * (cats >= 2 ? 26 : 10)));
  let pct = Math.min(100, Math.round((entropy / 100) * 100));
  pct = Math.max(pct, 8);
  const color = pct < 40 ? '#ef4444' : pct < 70 ? '#f59e0b' : '#10b981';
  strengthBar.style.width = pct + '%';
  strengthBar.style.background = color;
}

document.getElementById('btn-gen').addEventListener('click', generate);

document.getElementById('btn-copy').addEventListener('click', async () => {
  if (!currentPw) { setStatus(statusEl, t('generateFirst')); return; }
  try {
    await tb.copyToClipboard(currentPw);
    setStatus(statusEl, t('copyDone'));
  } catch (e) {
    setStatus(statusEl, t('copyError') + e.message);
  }
});

// 把目前生成的密碼帶到保存庫
document.getElementById('btn-to-vault').addEventListener('click', () => {
  if (!currentPw) { setStatus(statusEl, t('generateFirst')); return; }
  document.getElementById('vault-pass').value = currentPw;
  switchTab('vault');
  document.getElementById('vault-user').focus();
});

/* ================= 2. 保存庫 ================= */

const VAULT_KEY = 'vault';
const vaultUser = document.getElementById('vault-user');
const vaultPass = document.getElementById('vault-pass');
const vaultSearch = document.getElementById('vault-search');
const vaultList = document.getElementById('vault-list');
const vaultStatus = document.getElementById('vault-status');

let vaultItems = [];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function maskPw(pw) {
  return '•'.repeat(Math.min(Math.max(pw.length, 4), 24));
}

async function loadVault() {
  try {
    const raw = await tb.storageGet(VAULT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    vaultItems = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    vaultItems = [];
    setStatus(vaultStatus, t('vaultLoadError') + e.message, true);
  }
  renderVault();
}

async function saveVault() {
  await tb.storageSet(VAULT_KEY, JSON.stringify(vaultItems));
}

function renderVault() {
  const q = vaultSearch.value.trim().toLowerCase();
  const shown = q
    ? vaultItems.filter((it) => it.username.toLowerCase().includes(q))
    : vaultItems;

  if (!shown.length) {
    vaultList.innerHTML = `<div class="empty-tip">${esc(t('vaultEmpty'))}</div>`;
    return;
  }

  vaultList.innerHTML = shown.map((it) => `
    <div class="vault-item" data-id="${esc(it.id)}">
      <div class="info">
        <div class="user">${esc(it.username)}</div>
        <div class="masked" data-mask>${esc(maskPw(it.password))}</div>
      </div>
      <div class="btns">
        <button class="btn small" data-act="eye" title="👁">👁</button>
        <button class="btn small" data-act="copy" title="${esc(t('copy'))}">📋</button>
        <button class="btn small danger" data-act="del" title="🗑">🗑</button>
      </div>
    </div>`).join('');
}

vaultList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('.vault-item');
  const item = vaultItems.find((it) => String(it.id) === row.getAttribute('data-id'));
  if (!item) return;
  const act = btn.getAttribute('data-act');

  if (act === 'eye') {
    const el = row.querySelector('[data-mask]');
    const showing = el.dataset.show === '1';
    el.textContent = showing ? maskPw(item.password) : item.password;
    el.dataset.show = showing ? '0' : '1';
  } else if (act === 'copy') {
    try {
      await tb.copyToClipboard(item.password);
      setStatus(vaultStatus, t('copyDone'));
    } catch (err) {
      setStatus(vaultStatus, t('copyError') + err.message, true);
    }
  } else if (act === 'del') {
    vaultItems = vaultItems.filter((it) => it.id !== item.id);
    try {
      await saveVault();
      setStatus(vaultStatus, t('vaultDeleted'));
    } catch (err) {
      setStatus(vaultStatus, t('vaultSaveError') + err.message, true);
    }
    renderVault();
  }
});

document.getElementById('btn-vault-eye').addEventListener('click', () => {
  vaultPass.type = vaultPass.type === 'password' ? 'text' : 'password';
});

document.getElementById('btn-vault-save').addEventListener('click', async () => {
  const user = vaultUser.value.trim();
  const pass = vaultPass.value;
  if (!user) { setStatus(vaultStatus, t('vaultNeedUser'), true); return; }
  if (!pass) { setStatus(vaultStatus, t('vaultNeedPass'), true); return; }
  vaultItems.unshift({
    id: Date.now() + '-' + Math.floor(Math.random() * 1e6),
    username: user,
    password: pass,
    createdAt: new Date().toISOString()
  });
  try {
    await saveVault();
    vaultUser.value = '';
    vaultPass.value = '';
    vaultPass.type = 'password';
    setStatus(vaultStatus, t('vaultSaved'));
    renderVault();
  } catch (e) {
    setStatus(vaultStatus, t('vaultSaveError') + e.message, true);
  }
});

vaultSearch.addEventListener('input', renderVault);

/* ================= 3. 強度檢測 ================= */

const COMMON_PASSWORDS = new Set([
  '123456', 'password', '123456789', '12345678', '12345', 'qwerty', '111111', '1234567',
  'dragon', '123123', 'abc123', 'iloveyou', 'admin', 'welcome', 'monkey', 'login',
  'password1', 'qwerty123', '000000', '666666', '888888', 'a123456', '123qwe', '1q2w3e',
  'qwertyuiop', 'superman', 'asdfgh', 'zxcvbnm', 'letmein', 'sunshine', 'princess',
  'master', 'football', 'baseball', 'starwars', 'trustno1', 'hello', 'freedom', 'secret'
]);
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

const checkPass = document.getElementById('check-pass');
const checkResult = document.getElementById('check-result');
const checkVerdict = document.getElementById('check-verdict');
const checkBar = document.getElementById('check-bar');
const checkMeta = document.getElementById('check-meta');
const checkTips = document.getElementById('check-tips');
const checkStatus = document.getElementById('check-status');

document.getElementById('btn-check-eye').addEventListener('click', () => {
  checkPass.type = checkPass.type === 'password' ? 'text' : 'password';
});

function hasSequence(pw) {
  const s = pw.toLowerCase();
  for (let i = 0; i < s.length - 2; i++) {
    const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
    if (b === a + 1 && c === b + 1) return true;   // 遞增 abc / 123
    if (b === a - 1 && c === b - 1) return true;   // 遞減
  }
  return false;
}

function hasRepeat(pw) {
  for (let i = 0; i < pw.length - 2; i++) {
    if (pw[i] === pw[i + 1] && pw[i] === pw[i + 2]) return true;
  }
  return false;
}

function hasKeyboardPattern(pw) {
  const s = pw.toLowerCase();
  return KEYBOARD_ROWS.some((row) => {
    for (let n = 3; n <= row.length; n++) {
      for (let i = 0; i + n <= row.length; i++) {
        if (s.includes(row.slice(i, i + n))) return true;
      }
    }
    return false;
  });
}

/** 把秒數轉成人類可讀的破解時間 */
function formatCrackTime(seconds) {
  if (seconds < 1) return '< 1 s';
  const units = [
    [60, 's', 60], [60, 'min', 60], [24, 'h', 24], [365, 'd', 365],
    [100, 'yr', 100], [1e8, 'centuries', Infinity]
  ];
  let v = seconds, unit = 's';
  for (const [div, name] of units) {
    if (v < div) { unit = name; break; }
    v /= div; unit = name;
  }
  if (v >= 1e6) return '≈ ' + v.toExponential(1).replace('e+', '×10^') + ' ' + unit;
  return '≈ ' + Math.round(v).toLocaleString() + ' ' + unit;
}

function checkStrength() {
  const pw = checkPass.value;
  if (!pw) { checkResult.hidden = true; return; }
  checkResult.hidden = false;

  const tips = [];
  const lower = pw.toLowerCase();

  // 字元池 × 長度 → 熵
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  if (/[^\x00-\x7F]/.test(pw)) pool += 80;  // 非 ASCII（中文等）
  let entropy = pw.length * (pool > 1 ? Math.log2(pool) : 0);

  const isCommon = COMMON_PASSWORDS.has(lower);
  if (pw.length < 12) tips.push(t('tipLength'));
  if (pool <= 10 && !isCommon) { tips.push(t('tipDigitsOnly')); entropy = Math.min(entropy, 20); }
  if ((/[a-z]/.test(pw) ? 1 : 0) + (/[A-Z]/.test(pw) ? 1 : 0) + (/[0-9]/.test(pw) ? 1 : 0) + (/[^a-zA-Z0-9]/.test(pw) ? 1 : 0) < 2) tips.push(t('tipClass'));
  if (isCommon) entropy = Math.min(entropy, 10);
  if (hasSequence(pw)) { tips.push(t('tipSeq')); entropy -= 8; }
  if (hasRepeat(pw)) { tips.push(t('tipRepeat')); entropy -= 8; }
  if (hasKeyboardPattern(pw)) { tips.push(t('tipKeyboard')); entropy -= 8; }
  entropy = Math.max(entropy, 1);

  // 破解時間：2^entropy / 2 次平均猜測 × 每秒 1e11 次
  const guesses = Math.pow(2, entropy) / 2;
  const seconds = guesses / 1e11;

  let verdictKey, color, pct;
  if (isCommon || entropy < 30) { verdictKey = 'vVeryWeak'; color = '#ef4444'; pct = 12; }
  else if (entropy < 55) { verdictKey = 'vWeak'; color = '#f97316'; pct = 35; }
  else if (entropy < 80) { verdictKey = 'vFair'; color = '#f59e0b'; pct = 60; }
  else if (entropy < 110) { verdictKey = 'vStrong'; color = '#10b981'; pct = 82; }
  else { verdictKey = 'vVeryStrong'; color = '#059669'; pct = 100; }

  if (!tips.length) tips.push(t('tipOk'));

  checkVerdict.textContent = t(verdictKey);
  checkVerdict.style.color = color;
  checkBar.style.width = pct + '%';
  checkBar.style.background = color;
  checkMeta.textContent = `${t('entropy')}: ${Math.round(entropy)} bits · ${t('crackTime')}: ${formatCrackTime(seconds)} (${t('guessesPerSec')})`;
  checkTips.innerHTML = tips.map((tip) => `<li>${esc(tip)}</li>`).join('');
  setStatus(checkStatus, '');
}

checkPass.addEventListener('input', checkStrength);

/* ---------------- 啟動 ---------------- */

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
  generate();
  loadVault();
})();
