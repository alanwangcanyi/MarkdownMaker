# Markdown Maker

极简的 macOS Markdown 编辑器，支持编辑、预览和分栏模式，操作方式参考 Microsoft Word。

- 功能：
  - 编辑/阅读/分栏三视图
  - **界面语言切换**：工具栏「语言/EN」按钮，中文/英文一键切换（字典在 `src/shared/i18n.ts`，覆盖工具栏/菜单/状态栏/对话框；偏好存 SQLite `app_state.language`，重启保持）
  - **多窗口 + 新建即选路径**：点「新建」/ Cmd+N 不清空当前窗口，而是**新开一个应用窗口**并立即弹保存对话框选新文件路径（取消则保留为空白未命名文档）；直接启动应用（不带文件）时首窗口同样走该流程；旧窗口及其未保存内容原样保留

> **开发约定：修改本项目任意代码或配置前，必须先更新本 README 相关章节，再动代码。**

## 一、代码架构

### 1.1 进程模型（Electron 三层）

```
┌─────────────────────────────────────────────────────┐
│ 主进程 src/main/（多窗口模型）                        │
│  index.ts    窗口生命周期 / IPC / 菜单 / 文件读写     │
│              对话框父窗口=event.sender 反查           │
│              菜单事件→焦点窗口；退出逐窗口确认         │
│  database.ts SQLite 持久层（better-sqlite3）         │
│  logger.ts   日志（按天分割，保留1天）                │
│  preload.ts  安全桥（contextBridge 暴露 electronAPI）│
└──────────────────────┬──────────────────────────────┘
                       │ IPC（见下表）
┌──────────────────────┴──────────────────────────────┐
│ 渲染进程 src/renderer/（React + Zustand，每窗口一份）│
│  App.tsx                     业务逻辑核心            │
│  stores/editorStore.ts       全局状态                │
│  components/Editor/          CodeMirror 6 编辑器     │
│  components/Preview/         markdown-it 预览        │
│  components/Layout/          工具栏 / 状态栏         │
│  styles/global.css           全局样式                │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ 共享 src/shared/  types.ts 类型 / constants.ts 常量  │
│                i18n.ts 中英文字典 + t() 翻译函数      │
└─────────────────────────────────────────────────────┘
```

### 1.2 IPC 通道一览

| 通道 | 方向 | 说明 |
|------|------|------|
| file:open / file:save / file:save-as | 渲染→主 | 文件操作请求 |
| dialog:unsaved | 渲染→主 | 未保存确认弹窗 |
| file:opened | 主→渲染 | 通知文件已加载（发给发起/焦点窗口） |
| menu:* | 主→渲染 | 菜单事件转发（发给焦点窗口） |
| window:new | 渲染→主 | 请求新开一个应用窗口（新建流程入口） |
| new-file-prompt | 主→渲染 | 新窗口就绪后触发「弹保存对话框选新文件路径」 |
| check:unsaved 及其 response | 双向 | 关闭前未保存检查 |
| check-unsaved-for-quit 及其 response | 双向 | 退出前未保存检查 |
| app:get-view-mode / app:set-view-mode | 双向 | 视图模式持久化 |
| app:get-language / app:set-language | 双向 | 界面语言切换与持久化（切语言时主进程同步重建菜单） |
| log | 渲染→主 | 渲染进程日志转发 |

### 1.3 数据持久化（SQLite）

- 库：better-sqlite3@12.4.1（Electron 预编译二进制，随 app 打包）
- 数据库文件：`~/Library/Application Support/Markdown Maker/markdown-maker.db`
- 表：
  - `recents` —— 最近打开文件（去重，上限 20 条），数据源为打开/保存动作，入口在「文件 → 最近打开」子菜单
  - `app_state` —— 键值状态：`windowBounds`（窗口位置大小，关闭时保存、启动时恢复）、`viewMode`（上次视图模式）、`language`（界面语言 zh/en，默认 zh）

**原生模块二进制获取方式**（沙箱环境无法本地编译，用官方预编译包）：

```bash
npm install better-sqlite3@12.4.1
cd node_modules/better-sqlite3 && rm -rf build && npx prebuild-install --runtime=electron --target=33.4.11 --arch=arm64 --force
```

- 打包配置 `npmRebuild: false`（electron-builder.yml），打包时直接使用上述二进制，跳过重编译
- **升级 Electron 版本时必须**：用新版本号重跑上面 prebuild-install 命令，否则 app 启动时 SQLite 加载失败
- 执行 `npm install` 后如果 build/ 目录被重建为 node 版二进制，同样需重跑 prebuild-install

## 二、文档位置

| 文档 | 路径 | 内容 |
|------|------|------|
| 本文档 | README.md | 架构总览 / 开发流程 / 归档规则 |
| 产品文档 | PRODUCT.md | 产品定位与功能清单 |
| 架构文档 | STRUCTURE.md | 目录结构与模块细节 |

## 三、开发与打包

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（Vite + Electron 热加载）
npm run build      # 类型检查 + 编译主进程/渲染进程
npm run pack       # 完整打包（dmg + zip，dmg 需系统终端跑，见下）
npm run pack:app   # 打包 app 并自动归档（推荐日常使用）
npm run archive    # 单独执行归档（把最新 app 复制进归档目录）
npm run clean      # 清理 release/ 与 dist/
```

注意：DMG 生成依赖 `hdiutil` 访问 `/dev/rdisk*`，在 TRAE 等沙箱环境内会被拦截，需在系统终端执行 `npm run pack` 或单独的 hdiutil 命令。

## 四、编译产物归档规则

- 归档目录：`20260506-MarkdownMaker-archive/`（项目建立日期 2026-05-06 - 项目名 - archive）
- 命名规则：**四位递增编号-打包日期-产品名**，如 `0001-20260824-MarkdownMaker.app`
- 每次编译后执行 `npm run pack:app` 或 `npm run archive` 自动归档，编号自动 +1
- 临时验证用的 app 在 `release/mac-arm64/Markdown Maker.app`（每次打包覆盖）

## 五、日志

日志文件存储在 `~/Library/Logs/Markdown Maker/`，按天分割，自动保留最近 1 天。

## 六、版权显示

「关于」对话框版权行 = `Copyright © 2026 alanwangcanyi`，来源两处（保持同步修改）：
- `electron-builder.yml` 的 `copyright`（写入 Info.plist 的 NSHumanReadableCopyright）
- `src/main/index.ts` 的 `app.setAboutPanelOptions`（开发模式兜底）
