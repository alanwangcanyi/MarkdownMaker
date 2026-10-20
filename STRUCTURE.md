# 目录结构与架构说明

## 一、目录结构

```
markdown-maker/
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript 主配置
├── tsconfig.main.json       # 主进程 TypeScript 配置（rootDir=src，含 src/shared，产物入口 dist/main/main/index.js）
├── vite.config.ts           # 渲染进程打包配置
├── electron-builder.yml     # Electron 打包配置
├── scripts/
│   ├── generate-icon.js     # 生成 macOS 图标脚本
│   └── archive.js           # 编译产物自动归档脚本
├── src/
│   ├── main/                # 主进程
│   │   ├── index.ts         # 入口，窗口创建、IPC 注册、文件打开处理、菜单
│   │   ├── database.ts      # SQLite 持久层（better-sqlite3），最近文件/应用状态
│   │   ├── logger.ts        # 日志模块，主进程日志记录
│   │   └── preload.ts       # 预加载脚本，暴露 API 到渲染进程
│   ├── renderer/            # 渲染进程（React）
│   │   ├── index.html       # HTML 模板
│   │   ├── main.tsx         # 渲染入口
│   │   ├── App.tsx          # 主组件，业务逻辑核心
│   │   ├── components/
│   │   │   ├── Editor/      # 编辑器组件（CodeMirror 6）
│   │   │   ├── Preview/     # 预览组件（markdown-it）
│   │   │   └── Layout/      # 工具栏/状态栏等
│   │   ├── stores/          # Zustand 状态管理
│   │   ├── styles/          # 全局样式
│   │   └── utils/
│   │       └── logger.ts    # 渲染进程日志工具
│   └── shared/              # 共享类型和常量
│       ├── types.ts         # 类型定义
│       ├── constants.ts     # 常量
│       └── i18n.ts          # 中英文字典 + t() 翻译函数（主/渲染进程共用）
├── assets/
│   ├── icon.svg             # 应用图标源文件
│   └── icon.icns            # macOS 应用图标
├── release/                 # 打包输出目录
├── 20260506-MarkdownMaker-archive/  # 编译产物归档目录（编号-日期-产品名）
├── LTD/                     # 历史版本备份
├── PRODUCT.md               # 产品文档
├── STRUCTURE.md             # 本文档
└── README.md                # 开发说明（架构总览，修改前需先更新）
```

## 二、核心架构

### 2.1 主进程（Main Process）

主要职责：
1. 创建和管理应用窗口
2. 处理文件打开（open-file 事件）
3. 注册 IPC 通道，处理文件操作请求
4. 管理窗口关闭时的未保存检查
5. 日志记录

**关键模块：**

- **index.ts**：
  - 窗口生命周期管理
  - 注册 IPC 处理器
  - 窗口关闭事件拦截
  - 文件打开事件处理

- **logger.ts**：
  - 支持 info/warn/error/debug 四个级别
  - 按日期分割日志文件
  - 自动清理 1 天前的日志

- **preload.ts**：
  - 安全暴露 Electron API 到渲染进程
  - 上下文隔离模式

### 2.2 渲染进程（Renderer Process）

主要职责：
1. UI 渲染和用户交互
2. 编辑器功能
3. 状态管理

**关键模块：**

- **App.tsx**：
  - 主业务组件
  - 处理文件的新建/打开/保存/关闭
  - 监听主进程事件
  - 未保存检查和确认对话框

- **editorStore.ts**：
  - 使用 Zustand 管理状态
  - 存储：content / originalContent / currentFile / viewMode / language 等
  - `originalContent` 用于准确判断修改状态
  - `language` 为界面语言（zh/en），由语言按钮切换，主进程持久化

- **MarkdownEditor.tsx**：
  - 基于 CodeMirror 6 的编辑器
  - 支持编辑、撤销/重做
  - 实时统计行数和字数

### 2.3 IPC 通信机制

| 通道名 | 方向 | 说明 |
|--------|------|------|
| file:open | renderer → main | 请求打开文件 |
| file:save | renderer → main | 保存文件 |
| file:save-as | renderer → main | 另存为文件 |
| dialog:unsaved | renderer → main | 显示未保存对话框 |
| file:opened | main → renderer | 通知文件已打开 |
| menu:* | main → renderer | 菜单事件 |
| check:unsaved | main → renderer | 检查未保存内容（窗口关闭时）|
| check:unsaved:response | renderer → main | 检查结果 |
| app:get-language / app:set-language | 双向 | 界面语言读取/切换（切换时主进程重建菜单） |
| window:new | renderer → main | 请求新开一个应用窗口（新建流程入口） |
| new-file-prompt | main → renderer | 新窗口就绪后触发弹保存对话框选新文件路径 |
| window:open-file | renderer → main | 请求新开窗口加载指定路径文件（Word 式打开） |
| log | renderer → main | 日志转发到主进程 |

## 三、关键流程

### 3.1 文件打开流程
1. 用户双击 .md 文件 → 主进程收到 `open-file` 事件
2. 读取文件内容，创建主窗口
3. 通过 IPC 发送到渲染进程
4. 渲染进程更新状态并显示

### 3.2 窗口关闭流程（含未保存检查，多窗口各自独立）
1. 用户点击某窗口关闭按钮 → 该窗口 `close` 事件触发
2. 拦截默认关闭，发送 `check:unsaved` 到**该窗口**的渲染进程
3. 渲染进程检查该窗口自己的未保存内容
4. 有修改时弹出对话框询问用户
5. 根据用户选择：
   - 保存 → 保存后关闭
   - 不保存 → 直接关闭
   - 取消 → 保持窗口打开

### 3.3 新建流程（多窗口）
1. 用户点「新建」（工具栏/Cmd+N/菜单）→ 渲染进程发送 `window:new`
2. 主进程 `createWindow({ promptSaveAs: true })` 新开窗口（位置级联偏移）
3. 新窗口渲染就绪（`app:ready`）→ 主进程发 `new-file-prompt`
4. 新窗口自动触发「另存为」弹保存对话框选新文件路径
5. 选定路径 → 创建空文件并绑定；取消 → 保留为空白未命名文档
6. 直接启动应用（无文件参数）时首窗口同样走此流程

### 3.4 退出流程（多窗口串行确认）
1. Cmd+Q → `before-quit` 拦截，全部窗口入队
2. 逐窗口发送 `check-unsaved-for-quit`，串行确认
3. 任一窗口「取消」→ 中止退出
4. 全部确认后统一放行关闭并退出

### 3.5 打包配置（electron-builder.yml）
- 配置文件关联，支持 .md/.markdown/.txt
- 输出为 DMG 和 ZIP 格式
- 自动生成图标
