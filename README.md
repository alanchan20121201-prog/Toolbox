<div align="center">

<img src="icon.png" width="96" alt="Toolbox logo" />

# 🧰 Toolbox 工具箱

**模組化 · 輕量級 · 可擴展的 Windows 桌面效率中心**<br/>
A modular, lightweight, extensible **Windows desktop efficiency center**.

[![Version](https://img.shields.io/badge/version-1.0.4-2563EB?style=flat-square)](https://github.com/alanchan20121201-prog/Toolbox/releases)
[![License](https://img.shields.io/badge/license-MIT-22C55E?style=flat-square)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-31-47848F?style=flat-square)](https://www.electronjs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square)](#)
[![i18n](https://img.shields.io/badge/i18n-en%20%7C%20zh--CN%20%7C%20ja-EC4899?style=flat-square)](#english)

</div>

> 主程式只負責「框架、導航、工具管理器、本地檔案讀寫」；所有具體功能都透過**獨立的工具（Tool）**動態下載、安裝與載入，隨需即用（On-demand）。<br/>
> The host app only handles the framework, navigation, tool manager, and local file I/O — every concrete feature is delivered through **independent tools** downloaded and loaded on demand.

---

## 📖 Languages · 語言 · 言語

| English | 简体中文 | 日本語 |
|:---:|:---:|:---:|
| [English](#english) | [简体中文](#简体中文) | [日本語](#日本語) |

---

## English

Toolbox is a **modular, lightweight, extensible desktop efficiency center** for Windows. Instead of installing one bulky all-in-one application, users pick only the small tools they need from a built-in **Tool Shop**, and the host app downloads, installs, and loads each tool on demand.

### ✨ Features

- 🧩 **On-demand tools** — browse a tool shop and install only what you need; add tools without ever touching the host app.
- 💸 **Zero cost** — the whole ecosystem (host app, `tools.json`, tool `.zip`) is hosted on free GitHub repositories and GitHub Releases.
- 🔒 **Local-first** — all data and computation stay on your disk; after download, tools work **100% offline**.
- 🛡️ **Secure sandbox** — tools run inside a `<webview>` with `nodeIntegration=off`; they can only reach system resources through a **permission-gated Tool API**.
- 🌐 **Trilingual** — UI and tools support **English (en) / Simplified Chinese (zh-CN) / Japanese (ja)**. Installing a tool automatically downloads the **language-matching zip**.
- 🔄 **In-app updates** — from v1.0.1, you can check for and install new versions directly from **Settings → App Update**.

### 🏗️ Architecture

```
[ GitHub cloud repository ]
├── tools.json                # tool catalog (downloadUrl grouped by language)
├── update.json               # app self-update info (version / url)
└── releases/                 # per-language .zip for each tool + exe installer
        │
        ▼  (user clicks "Install" in the Shop → downloads the matching-language zip)
[ Windows client (.exe host) ]
├── Left sidebar      dynamically renders "My Tools"
├── Right pane        sandboxed tool UI
└── %LOCALAPPDATA%\Toolbox\tools\    auto-extract, validate, manage
```

**Installation lifecycle (atomic + rollback):**

1. Pick `downloadUrl[language]` for the current UI language
2. Download the `.zip` to a temp area (with progress)
3. Optional SHA-256 verification (`sha256[language]`)
4. Safe extraction with **zip-slip path-traversal protection**
5. Validate `manifest.json`, the `index.html` entry point, and matching `id`
6. Atomic move from staging into `tools/[id]/`
7. Clean up the temp zip and refresh the sidebar

Any failure rolls back automatically — no half-installed tools.

### 📥 Installation (end users)

1. Download the latest installer from [Releases](https://github.com/alanchan20121201-prog/Toolbox/releases):
   ```
   https://github.com/alanchan20121201-prog/Toolbox/releases/download/exe/Toolbox-Setup-1.0.4.exe
   ```
2. Run the installer and launch **Toolbox**.
3. Open the **Tool Shop**, click **Install** on any tool — it downloads the language-matching zip from GitHub and is ready to use immediately.

> The default language is **English**. You can switch to 简体中文 / 日本語 at any time in **Settings → Language**.

### 🛠️ Development (local, no GitHub needed)

```bash
npm install           # install dependencies
npm run build:tools   # generate icons + trilingual zips + tools.json
npm start             # launch the app (reads local dev-server/tools.json)

# after uploading the zips to a Release, sync exact package sizes into tools.json:
node scripts/build-tools.js --base <release-asset-url> --github-sizes <tag>
```

> **Always verify a packaged build** before shipping it:
> `node scripts/verify-unpacked.js release/win-unpacked`
> A truncated Electron payload (missing `ffmpeg.dll`, `libEGL.dll`, `icudtl.dat`, `locales/`, …) still produces an installer — it just won't start.

| Command | What it does |
|---|---|
| `npm run smoke` | Headless end-to-end test: fetch catalog → install by language → validate → zip-slip guard → uninstall |
| `npm run smoke:window` | UI load test (requires a real desktop/display) |
| `npm run dist` | Build the installer (icon auto-applied from `icon.ico`) |

> If your shell sets `ELECTRON_RUN_AS_NODE=1`, Electron is forced into pure-Node mode (`require('electron')` returns a path string and `app` is `undefined`). This happens in some CI/sandbox environments. Run `unset ELECTRON_RUN_AS_NODE` first.

**Custom catalog source** (priority): env var `TOOLBOX_MANIFEST_URL` → `config.json` → default.

```bash
TOOLBOX_MANIFEST_URL="http://127.0.0.1:8787/tools.json" npm start
```

### 🧰 Building your own tool

Drop your tool source into `test-tools/<id>/` with three files — scaffold it with one command:

```bash
node scripts/new-tool.js my-tool    # copies the starter template into test-tools/my-tool
```

**No registration needed** — the build script auto-discovers every folder under `test-tools/` that has a `manifest.json` (folders starting with `_` are skipped, so templates stay ignored). The logo generating follows: ① your own `logo.png` in the tool folder → ② a custom drawer registered in `CUSTOM_ICONS` → ③ an auto-generated gradient icon colored by the tool id.

| File | Purpose |
|---|---|
| `manifest.json` | identity: `id`, `name` (trilingual), `version`, `description`, `entry`, `icon`, `permissions` |
| `index.html` | UI; mark text with `data-i18n="key"` |
| `script.js` | logic + a trilingual `I18N` dictionary |

```json
{
  "id": "image-tools",
  "name": { "en": "Image Converter", "zh-CN": "图片转档工具", "ja": "画像変換ツール" },
  "version": "1.0.0",
  "description": { "en": "...", "zh-CN": "...", "ja": "..." },
  "entry": "index.html",
  "icon": "logo.png",
  "permissions": ["dialog", "file:read", "file:write", "notify"]
}
```

**Permissions (least privilege):**

| Permission | Use |
|---|---|
| `dialog` | open/save file dialogs |
| `file:read` | read files |
| `file:write` | write files |
| `clipboard` | read/write clipboard |
| `notify` | system notifications |
| `shell` | open external links / show in folder |
| `storage` | private encrypted key-value storage (per-tool, survives restarts) |

**Tool API** (call `window.toolbox.*` directly — no SDK to bundle, injected by the host):

```js
const r = await toolbox.openFile({ filters: [{ name: 'Images', extensions: ['png','jpg'] }] });
const dataUrl = await toolbox.readFileAsDataURL(r.filePaths[0]);
await toolbox.writeFile(save.filePath, base64);
await toolbox.copyToClipboard(text);
await toolbox.notify({ title: 'OK', body: 'Done' });
```

See `tool-preload.js` for the full list.

**Trilingual mechanism** (automatic): the build injects `lang.js` (`window.__TOOL_LANG__`) into each zip, and the host downloads the zip matching the user's language — one source, three language builds, no runtime detection needed.

### 📦 Publishing to GitHub

1. Build with your release base URL (tools are picked up automatically, no registration):
   ```bash
   node scripts/build-tools.js --base https://github.com/alanchan20121201-prog/Toolbox/releases/download/tool
   ```
2. Upload the generated zips to a GitHub Release.
3. Overwrite `tools.json` (and `update.json`) in the repo root.
4. That's it — the shop updates from `tools.json` alone. **No exe rebuild needed.**

> Since v1.0.4, `tools.json` uses a merged format `{ "update": {…}, "tools": […] }` that also embeds the app-update info (checked first by the host). Keep uploading `update.json` as well — hosts ≤1.0.3 only understand it.

**Zip naming** (automatic): `<tool-id>-<lang>-v<version>.zip`, where `<lang>` is `en` / `zh` / `ja`.

### 🗂️ Project structure

```
toolbox/
├── package.json            # deps, scripts, electron-builder config
├── main.js                 # main process (fs / network / IPC / lifecycle / Tool API)
├── preload.js              # main-window bridge (contextBridge)
├── tool-preload.js         # tool sandbox bridge (exposes window.toolbox)
├── index.html              # main UI (sidebar + content pane)
├── renderer.js             # front-end logic & dynamic rendering
├── css/style.css           # styles (light/dark theme)
├── icon.png / icon.ico     # app icon (exe / taskbar / title bar / brand)
├── locales/                # i18n (en / zh / jp)
├── tools.json              # LIVE catalog served by GitHub (generated)
├── update.json             # app update info (authored by hand)
├── scripts/
│   ├── build-tools.js      # builds icons, universal zips, tools.json
│   ├── new-tool.js         # scaffolds a new tool from _template
│   ├── verify-unpacked.js  # checks a packaged win-unpacked tree
│   ├── audit-tools.js      # audits $() misuse & i18n key coverage
│   └── test-tools-dom.js   # loads every zip in jsdom, catches runtime errors
├── test-tools/             # tool sources (22 tools + _template)
└── dev-server/             # local mock of the GitHub cloud
    ├── tools.json          # local catalog (generated)
    ├── update.json         # app update info
    ├── dist/<id>-<lang>-v<ver>.zip
    └── icons/*.png
```

### 📤 Publishing this source to GitHub

The repo root **is** the published site of the catalog:
`https://raw.githubusercontent.com/<user>/<repo>/main/tools.json`

So the root `tools.json` / `update.json` are the live files — they must stay at the repo root
(they are deliberately *not* in `.gitignore`). Running the build with `--base` regenerates both
at the root as well as in `dev-server/`:

```bash
node scripts/build-tools.js --base https://github.com/<user>/<repo>/releases/download/tool
```

Everything else is excluded by `.gitignore`: `node_modules/`, all `release*/` build output,
and the generated `dev-server/dist/` + `dev-server/icons/`.

Runtime folders (auto-created on the user's machine):

```
%LOCALAPPDATA%\Toolbox\
├── config.json     # language / theme / catalog source
├── tools\          # installed tools (one folder per tool)
└── tmp\            # download & extract staging (auto-cleaned)
```

### 🔖 Versioning

| Change | Bump |
|---|---|
| Bug fix / small tweak | patch (`1.0.1` → `1.0.2`) |
| New feature | minor (`1.1.0`) |

Each release: bump `version` in `package.json` → rebuild tools + exe → update `update.json` and upload the exe. Users on v1.0.1+ get the update in-app.

### 📄 License

[MIT](LICENSE)

---

## 简体中文

Toolbox 是一个面向 Windows 的**模块化、轻量级、可扩展的桌面效率中心**。与其安装一个臃肿的全功能软件，用户只需在内置的**工具市集**里挑选自己需要的小工具，主程序会按需下载、安装并加载每个工具。

### ✨ 功能特性

- 🧩 **随需即用**——逛工具市集、只装自己需要的工具；新增工具完全不用改主程序。
- 💸 **零成本**——整个生态（主程序、`tools.json`、工具 `.zip`）全部托管在免费的 GitHub 仓库 + GitHub Releases 上。
- 🔒 **本地优先**——数据与运算都在你自己的硬盘上，下载后工具可 **100% 离线**使用。
- 🛡️ **安全沙盒**——工具在 `<webview>` 内以 `nodeIntegration=off` 运行，只能通过**权限化的 Tool API**访问系统资源。
- 🌐 **三语支持**——界面与工具皆支持 **英文（en）/ 简体中文（zh-CN）/ 日语（ja）**；安装工具时会**自动下载对应语言的 zip**。
- 🔄 **应用内更新**——自 v1.0.1 起，可在「设置 → 应用更新」里直接检查并安装新版本。

### 🏗️ 架构总览

```
[ GitHub 云端仓库 ]
├── tools.json                # 工具清单（downloadUrl 依语言分组）
├── update.json               # 应用更新信息（version / url）
└── releases/                 # 各工具的多语言 .zip + exe 安装包
        │
        ▼  (用户在市集点击「安装」→ 依语言下载对应 zip)
[ Windows 客户端 (.exe 主程序) ]
├── 左侧工作列   动态渲染「我的工具」
├── 右侧主画面   沙盒化加载工具 UI
└── %LOCALAPPDATA%\Toolbox\tools\    自动解压、验证、管理
```

**安装生命周期（原子安装 + 回滚）：**

1. 依当前界面语言挑选 `downloadUrl[language]`
2. 下载 `.zip` 到暂存区（含进度回传）
3. 可选 SHA-256 校验（`sha256[language]`）
4. 安全解压（内置 zip-slip 路径穿越防护）
5. 校验 `manifest.json`、`index.html` 入口点及 `id` 一致
6. 原子搬移到 `tools/[id]/`
7. 清理临时 zip，刷新侧栏

任何一步失败都会自动回滚，不会留下残缺工具。

### 📥 安装（面向用户）

1. 从 [Releases](https://github.com/alanchan20121201-prog/Toolbox/releases) 下载最新安装包：
   ```
   https://github.com/alanchan20121201-prog/Toolbox/releases/download/exe/Toolbox-Setup-1.0.4.exe
   ```
2. 运行安装程序并启动 **Toolbox**。
3. 打开**工具市集**，对任意工具点击**安装**——它会从 GitHub 下载对应语言的 zip，装好即可用。

> 默认语言为**英文**，可随时在「设置 → 语言」切换为简体中文 / 日本語。

### 🛠️ 开发与测试（本地，无需 GitHub）

```bash
npm install           # 安装依赖
npm run build:tools   # 生成图标 + 三语言 zip + tools.json
npm start             # 启动应用（读取本地 dev-server/tools.json）

# 上傳 zip 到 Release 後，同步「實際體積」到 tools.json（市集顯示才精準）：
node scripts/build-tools.js --base <release-asset-url> --github-sizes <tag>
```

> **打包後務必驗證**：`node scripts/verify-unpacked.js release/win-unpacked`
> Electron 檔案複製若被中斷（少了 `ffmpeg.dll`、`libEGL.dll`、`icudtl.dat`、`locales/` 等），
> 安裝程式一樣會產生，只是裝起來完全打不開。

| 命令 | 作用 |
|---|---|
| `npm run smoke` | 无界面端到端测试：抓清单 → 依语言安装 → 校验 → zip-slip 防护 → 卸载 |
| `npm run smoke:window` | 界面加载测试（需真实桌面/显示环境） |
| `npm run dist` | 打包安装包（自动套用 `icon.ico`） |

> 若你的 shell 设了 `ELECTRON_RUN_AS_NODE=1`，Electron 会被强制当纯 Node 跑（`require('electron')` 返回路径字符串、`app` 为 `undefined`），这是某些 CI/沙盒环境的设置。先 `unset ELECTRON_RUN_AS_NODE` 再跑。

**自定义清单来源**（优先级）：环境变量 `TOOLBOX_MANIFEST_URL` → `config.json` → 默认值。

```bash
TOOLBOX_MANIFEST_URL="http://127.0.0.1:8787/tools.json" npm start
```

### 🧰 开发自己的工具

把工具源码放进 `test-tools/<id>/`，含三个文件；一行指令就能从范本生成：

```bash
node scripts/new-tool.js my-tool    # 从范本复制一份到 test-tools/my-tool
```

**无需手动注册**——建置脚本会自动扫描 `test-tools/` 下所有含 `manifest.json` 的文件夹（`_` 开头视为范本，自动略过）。logo 取得顺序：① 工具资料夹里的 `logo.png` → ② `CUSTOM_ICONS` 注册的绘图函数 → ③ 依 id 生成专属配色的渐变预设图标。

| 文件 | 用途 |
|---|---|
| `manifest.json` | 身份：`id`、`name`（三语）、`version`、`description`、`entry`、`icon`、`permissions` |
| `index.html` | 界面；文字用 `data-i18n="key"` 标记 |
| `script.js` | 逻辑 + 三语 `I18N` 字典 |

```json
{
  "id": "image-tools",
  "name": { "en": "Image Converter", "zh-CN": "图片转档工具", "ja": "画像変換ツール" },
  "version": "1.0.0",
  "description": { "en": "...", "zh-CN": "...", "ja": "..." },
  "entry": "index.html",
  "icon": "logo.png",
  "permissions": ["dialog", "file:read", "file:write", "notify"]
}
```

**权限（最小授权）：**

| 权限 | 用途 |
|---|---|
| `dialog` | 打开/保存文件对话框 |
| `file:read` | 读取文件 |
| `file:write` | 写入文件 |
| `clipboard` | 读写剪贴板 |
| `notify` | 系统通知 |
| `shell` | 打开外部链接 / 在文件夹中显示 |
| `storage` | 工具私有的加密键值存储（各工具隔离，重启后仍在） |

**Tool API**（工具内直接调用 `window.toolbox.*`，无需打包 SDK，由主程序注入）：

```js
const r = await toolbox.openFile({ filters: [{ name: 'Images', extensions: ['png','jpg'] }] });
const dataUrl = await toolbox.readFileAsDataURL(r.filePaths[0]);
await toolbox.writeFile(save.filePath, base64);
await toolbox.copyToClipboard(text);
await toolbox.notify({ title: 'OK', body: 'Done' });
```

完整清单见 `tool-preload.js`。

**三语机制**（自动）：建置时把 `lang.js`（`window.__TOOL_LANG__`）注入每个 zip，主程序按用户语言下载对应 zip——一份源码产出三种语言，无需运行时侦测。

### 📦 发布到 GitHub

1. 带 release base 建置（工具会被自动扫描，无需注册）：
   ```bash
   node scripts/build-tools.js --base https://github.com/alanchan20121201-prog/Toolbox/releases/download/tool
   ```
2. 把生成的 zip 上传到 GitHub Release。
3. 用新内容覆盖仓库根目录的 `tools.json`（和 `update.json`）。
4. 完成——市集只靠 `tools.json` 更新，**无需重打包 exe**。

> 从 v1.0.4 起，`tools.json` 采用合并格式 `{ "update": {…}, "tools": […] }`，内嵌应用更新信息（主程序优先读取）；仍请照常上传 `update.json`——1.0.3 及更早的主程序只认它。

**Zip 命名**（自动）：`<工具id>-<lang>-v<版本>.zip`，其中 `<lang>` 为 `en` / `zh` / `ja`。

### 🗂️ 项目结构

```
toolbox/
├── package.json            # 依赖、scripts、electron-builder 配置
├── main.js                 # 主进程（fs / 网络 / IPC / 生命周期 / Tool API）
├── preload.js              # 主窗口桥接（contextBridge）
├── tool-preload.js         # 工具沙盒桥接（暴露 window.toolbox）
├── index.html              # 主界面（侧栏 + 内容区）
├── renderer.js             # 前端逻辑与动态渲染
├── css/style.css           # 样式（浅色/深色主题）
├── icon.png / icon.ico     # 应用图标（exe / 任务栏 / 标题栏 / 品牌）
├── locales/                # 多语言（en / zh-CN / ja）
├── scripts/build-tools.js  # 建置脚本（图标、三语言 zip、tools.json）
├── test-tools/             # 工具源码
│   ├── image-tools/
│   └── password-generator/
└── dev-server/             # 本地模拟 GitHub 云端
    ├── tools.json          # 本地清单（自动生成）
    ├── update.json         # 应用更新信息
    ├── dist/<id>-<lang>-v<ver>.zip
    ├── icons/*.png
    └── serve.js            # 可选的 localhost 静态服务
```

运行期目录（在用户机器上自动生成）：

```
%LOCALAPPDATA%\Toolbox\
├── config.json     # 语言 / 主题 / 清单来源
├── tools\          # 已安装工具（每个工具一个文件夹）
└── tmp\            # 下载与解压暂存（自动清理）
```

### 🔖 版本规范

| 变更类型 | 版本号 |
|---|---|
| 修 bug / 小改 | 第三位 +1（`1.0.1` → `1.0.2`） |
| 新功能 | 第二位 +1（`1.1.0`） |

每次发布：改 `package.json` 的 `version` → 重建工具 + 打包 exe → 更新 `update.json` 并上传 exe。v1.0.1+ 的用户会在应用内收到更新。

### 📄 许可证

[MIT](LICENSE)

---

## 日本語

Toolbox は Windows 向けの**モジュール式・軽量・拡張可能なデスクトップ効率センター**です。肥大化したオールインワンアプリをインストールする代わりに、内蔵の**ツールショップ**から必要な小さなツールだけを選び、ホストアプリが必要に応じて各ツールをダウンロード・インストール・ロードします。

### ✨ 特徴

- 🧩 **オンデマンドのツール**——ツールショップを眺めて必要なものだけ導入。ツール追加にホストアプリの変更は不要。
- 💸 **ゼロコスト**——エコシステム全体（ホストアプリ、`tools.json`、ツール `.zip`）を無料の GitHub リポジトリ + GitHub Releases でホスティング。
- 🔒 **ローカルファースト**——データと演算はすべて自分のディスク上。ダウンロード後は **100% オフライン**で動作。
- 🛡️ **安全なサンドボックス**——ツールは `nodeIntegration=off` の `<webview>` 内で実行され、**権限制御された Tool API** を通じてのみシステム資源へアクセス。
- 🌐 **3 言語対応**——UI とツールは **英語（en）/ 簡体字中国語（zh-CN）/ 日本語（ja）** に対応。ツールをインストールすると**言語に合った zip を自動ダウンロード**。
- 🔄 **アプリ内アップデート**——v1.0.1 から「設定 → アプリ更新」で新バージョンを直接確認・導入可能。

### 🏗️ アーキテクチャ

```
[ GitHub クラウドリポジトリ ]
├── tools.json                # ツールカタログ（downloadUrl を言語ごとに分類）
├── update.json               # アプリ更新情報（version / url）
└── releases/                 # 各ツールの言語別 .zip + exe インストーラ
        │
        ▼  (ユーザーがショップで「インストール」→ 言語に合う zip をDL)
[ Windows クライアント (.exe ホスト) ]
├── 左サイドバー    「マイツール」を動的描画
├── 右ペイン        サンドボックス化されたツール UI
└── %LOCALAPPDATA%\Toolbox\tools\    自動展開・検証・管理
```

**インストールのライフサイクル（アトミック + ロールバック）：**

1. 現在の UI 言語に応じて `downloadUrl[language]` を選択
2. `.zip` を一時領域へダウンロード（進捗あり）
3. 任意の SHA-256 検証（`sha256[language]`）
4. **zip-slip パストラバーサル対策**付きの安全な展開
5. `manifest.json`・`index.html` エントリポイント・`id` の一致を検証
6. ステージングから `tools/[id]/` へアトミック移動
7. 一時 zip を削除してサイドバーを更新

いずれかの工程で失敗すると自動的にロールバック——中途半端なツールは残りません。

### 📥 インストール（一般ユーザー向け）

1. [Releases](https://github.com/alanchan20121201-prog/Toolbox/releases) から最新のインストーラをダウンロード：
   ```
   https://github.com/alanchan20121201-prog/Toolbox/releases/download/exe/Toolbox-Setup-1.0.4.exe
   ```
2. インストーラを実行して **Toolbox** を起動。
3. **ツールショップ**を開き、任意のツールの**インストール**をクリック——GitHub から言語に合った zip をダウンロードし、すぐに使えます。

> デフォルト言語は**英語**。「設定 → 言語」でいつでも简体中文 / 日本語に切り替えられます。

### 🛠️ 開発（ローカル、GitHub 不要）

```bash
npm install           # 依存関係をインストール
npm run build:tools   # アイコン + 3言語 zip + tools.json を生成
npm start             # アプリを起動（ローカルの dev-server/tools.json を読む）

# zip を Release にアップロード後、実際のサイズを tools.json に同期（ショップ表示が正確になります）:
node scripts/build-tools.js --base <release-asset-url> --github-sizes <tag>
```

> **パッケージ後は必ず検証してください**：`node scripts/verify-unpacked.js release/win-unpacked`
> Electron のファイルコピーが中断されると（`ffmpeg.dll`、`libEGL.dll`、`icudtl.dat`、`locales/` などが欠落）、
> インストーラーは作成されますが、インストールしても起動しません。

| コマンド | 内容 |
|---|---|
| `npm run smoke` | ヘッドレス E2E：カタログ取得 → 言語別インストール → 検証 → zip-slip 対策 → アンインストール |
| `npm run smoke:window` | UI ロードテスト（実デスクトップ/表示環境が必要） |
| `npm run dist` | インストーラをビルド（`icon.ico` を自動適用） |

> シェルで `ELECTRON_RUN_AS_NODE=1` が設定されていると、Electron が純粋な Node として強制実行されます（`require('electron')` がパス文字列を返し、`app` が `undefined`）。これは一部の CI/サンドボックス環境の設定です。先に `unset ELECTRON_RUN_AS_NODE` を実行してください。

**カスタムカタログソース**（優先順）：環境変数 `TOOLBOX_MANIFEST_URL` → `config.json` → デフォルト。

```bash
TOOLBOX_MANIFEST_URL="http://127.0.0.1:8787/tools.json" npm start
```

### 🧰 自作ツールの開発

ツールのソースを `test-tools/<id>/` に置き、3 つのファイルを用意します（コマンド一つでテンプレートから生成できます）：

```bash
node scripts/new-tool.js my-tool    # テンプレートを test-tools/my-tool にコピー
```

**手動登録は不要**——ビルドスクリプトが `test-tools/` 配下の `manifest.json` を持つフォルダを自動検出します（`_` で始まるフォルダはテンプレートとして無視）。ロゴの決定順：① ツール内の `logo.png` → ② `CUSTOM_ICONS` に登録した描画関数 → ③ id から配色を決めるグラデーション既定アイコン。

| ファイル | 役割 |
|---|---|
| `manifest.json` | 識別情報：`id`、`name`（3言語）、`version`、`description`、`entry`、`icon`、`permissions` |
| `index.html` | UI。テキストは `data-i18n="key"` でマーク |
| `script.js` | ロジック + 3言語の `I18N` 辞書 |

```json
{
  "id": "image-tools",
  "name": { "en": "Image Converter", "zh-CN": "图片转档工具", "ja": "画像変換ツール" },
  "version": "1.0.0",
  "description": { "en": "...", "zh-CN": "...", "ja": "..." },
  "entry": "index.html",
  "icon": "logo.png",
  "permissions": ["dialog", "file:read", "file:write", "notify"]
}
```

**権限（最小権限）：**

| 権限 | 用途 |
|---|---|
| `dialog` | 開く/保存ダイアログ |
| `file:read` | ファイル読み取り |
| `file:write` | ファイル書き込み |
| `clipboard` | クリップボードの読み書き |
| `notify` | システム通知 |
| `shell` | 外部リンクを開く / フォルダで表示 |
| `storage` | ツール専用の暗号化キーバリュー保存（ツールごとに分離、再起動後も残る） |

**Tool API**（ツール内で `window.toolbox.*` を直接呼ぶ。SDK の同梱は不要でホストが注入）：

```js
const r = await toolbox.openFile({ filters: [{ name: 'Images', extensions: ['png','jpg'] }] });
const dataUrl = await toolbox.readFileAsDataURL(r.filePaths[0]);
await toolbox.writeFile(save.filePath, base64);
await toolbox.copyToClipboard(text);
await toolbox.notify({ title: 'OK', body: 'Done' });
```

全リストは `tool-preload.js` を参照。

**3言語メカニズム**（自動）：ビルド時に `lang.js`（`window.__TOOL_LANG__`）を各 zip へ注入し、ホストがユーザー言語に合った zip をダウンロード——1 つのソースで 3 言語ビルドを生成し、実行時の言語判定は不要です。

### 📦 GitHub への公開

1. リリースのベース URL を指定してビルド（ツールは自動スキャンされ、登録は不要）：
   ```bash
   node scripts/build-tools.js --base https://github.com/alanchan20121201-prog/Toolbox/releases/download/tool
   ```
2. 生成された zip を GitHub Release にアップロード。
3. リポジトリ直下の `tools.json`（と `update.json`）を新しい内容で上書き。
4. 完了——ショップは `tools.json` だけで更新され、**exe の再ビルドは不要**です。

> v1.0.4 から `tools.json` は `{ "update": {…}, "tools": […] }` の統合形式で、アプリ更新情報も内嵌（ホストが優先的に読む）。`update.json` も従来どおりアップロードしてください——1.0.3 以前のホストはこちらのみ解釈します。

**Zip の命名**（自動）：`<ツールid>-<lang>-v<バージョン>.zip`。`<lang>` は `en` / `zh` / `ja`。

### 🗂️ プロジェクト構成

```
toolbox/
├── package.json            # 依存関係・scripts・electron-builder 設定
├── main.js                 # メインプロセス（fs / ネットワーク / IPC / ライフサイクル / Tool API）
├── preload.js              # メインウィンドウのブリッジ（contextBridge）
├── tool-preload.js         # ツールサンドボックスのブリッジ（window.toolbox を公開）
├── index.html              # メイン UI（サイドバー + コンテンツペイン）
├── renderer.js             # フロントエンドのロジックと動的描画
├── css/style.css           # スタイル（ライト/ダークテーマ）
├── icon.png / icon.ico     # アプリアイコン（exe / タスクバー / タイトルバー / ブランド）
├── locales/                # i18n（en / zh-CN / ja）
├── scripts/build-tools.js  # ビルドスクリプト（アイコン・3言語 zip・tools.json）
├── test-tools/             # ツールのソース
│   ├── image-tools/
│   └── password-generator/
└── dev-server/             # GitHub クラウドのローカルモック
    ├── tools.json          # ローカルカタログ（自動生成）
    ├── update.json         # アプリ更新情報
    ├── dist/<id>-<lang>-v<ver>.zip
    ├── icons/*.png
    └── serve.js            # 任意の localhost 静的サーバ
```

実行時ディレクトリ（ユーザーのマシンに自動生成）：

```
%LOCALAPPDATA%\Toolbox\
├── config.json     # 言語 / テーマ / カタログソース
├── tools\          # インストール済みツール（ツールごとに 1 フォルダ）
└── tmp\            # ダウンロード・展開ステージング（自動クリーンアップ）
```

### 🔖 バージョニング

| 変更 | バージョン |
|---|---|
| バグ修正 / 小変更 | パッチ（`1.0.1` → `1.0.2`） |
| 新機能 | マイナー（`1.1.0`） |

各リリース：`package.json` の `version` を更新 → ツールを再ビルド + exe をパッケージ → `update.json` を更新して exe をアップロード。v1.0.1+ のユーザーはアプリ内で更新を受け取れます。

### 📄 ライセンス

[MIT](LICENSE)
