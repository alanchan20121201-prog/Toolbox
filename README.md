<div align="center">

# 🧰 Toolbox 工具箱

**模組化 · 輕量級 · 可擴展的 Windows 桌面效率中心**<br/>
A modular, lightweight, extensible **Windows desktop efficiency center**.

[![Version](https://img.shields.io/badge/version-1.0.1-2563EB?style=flat-square)](https://github.com/alanchan20121201-prog/Toolbox/releases)
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
   
2. 运行安装程序并启动 **Toolbox**。
   
3. 打开**工具市集**，对任意工具点击**安装**——它会从 GitHub 下载对应语言的 zip，装好即可用。

> 默认语言为**英文**，可随时在「设置 → 语言」切换为简体中文 / 日本語。

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

2. インストーラを実行して **Toolbox** を起動。
   
3. **ツールショップ**を開き、任意のツールの**インストール**をクリック——GitHub から言語に合った zip をダウンロードし、すぐに使えます。

> デフォルト言語は**英語**。「設定 → 言語」でいつでも简体中文 / 日本語に切り替えられます。
