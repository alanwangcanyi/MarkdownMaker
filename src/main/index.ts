import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import { Logger } from './logger';
import { initDatabase, addRecentFile, getRecentFiles, getAppState, setAppState, getWindowBounds, saveWindowBounds } from './database';
import { t, normalizeLang } from '../shared/i18n';

const IPC_CHANNELS = {
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  SHOW_UNSAVED_DIALOG: 'dialog:unsaved',
  LOG: 'log',
  CHECK_UNSAVED: 'check:unsaved',
} as const;

const logger = Logger.getInstance();

// ── 多窗口状态 ─────────────────────────────────────────
/** 允许直接关闭（已完成未保存检查）的窗口 */
const closingAllowed = new Set<BrowserWindow>();
/** 创建后需弹「保存对话框选新文件路径」的窗口（新建流程） */
const promptSaveWindows = new Set<BrowserWindow>();
/** 退出确认队列：逐窗口串行检查未保存 */
let quitPendingWindows: BrowserWindow[] = [];
/** 退出确认流程进行中（防 before-quit 重入重复弹框） */
let quitInProgress = false;

let pendingFile: { path: string; content: string; name: string } | null = null;
let isQuitting = false;

/** 取当前应接收菜单/文件事件的窗口（焦点优先，回退第一个） */
function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function createWindow(opts?: { promptSaveAs?: boolean }) {
  logger.info('App', 'Creating window');

  // 恢复上次窗口位置大小（无记录时用默认值）；多窗口级联偏移避免完全重叠
  const savedBounds = getWindowBounds();
  const cascade = BrowserWindow.getAllWindows().length * 26;

  const win = new BrowserWindow({
    width: savedBounds?.width ?? 1000,
    height: savedBounds?.height ?? 700,
    x: savedBounds?.x !== undefined ? savedBounds.x + cascade : undefined,
    y: savedBounds?.y !== undefined ? savedBounds.y + cascade : undefined,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (opts?.promptSaveAs) {
    promptSaveWindows.add(win);
  }

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/index.html')).catch((err) => {
      logger.error('Window', `loadFile failed: ${err?.message || err}`);
    });
  }

  win.webContents.on('did-finish-load', () => {
    logger.info('Window', 'Web contents finished loading');
  });

  // 诊断：页面加载失败 / 渲染进程异常退出
  win.webContents.on('did-fail-load', (_e: any, code: number, desc: string, url: string) => {
    logger.error('Window', `did-fail-load: code=${code} desc=${desc} url=${url}`);
  });
  win.webContents.on('preload-error', (_e: any, preloadPath: string, err: any) => {
    logger.error('Window', `preload-error: ${preloadPath} ${err?.message || err}`);
  });

  win.on('close', (e) => {
    logger.info('Window', 'Window close requested');
    // 保存窗口位置大小（窗口销毁前；多窗口下最后关闭者胜出）
    if (!win.isDestroyed()) {
      saveWindowBounds(win.getBounds());
    }
    if (isQuitting || closingAllowed.has(win)) {
      return;
    }

    e.preventDefault();

    // 该窗口独立走未保存检查
    win.webContents.send(IPC_CHANNELS.CHECK_UNSAVED);
  });

  win.on('closed', () => {
    logger.info('Window', 'Window closed');
    closingAllowed.delete(win);
    promptSaveWindows.delete(win);
  });
}

function sendFileToWindow(win: BrowserWindow, file: { path: string; content: string; name: string }) {
  logger.info('File', `Opening file: ${file.path}`);
  addRecentFile(file.path, file.name);
  refreshMenu();
  win.webContents.send('file:opened', file);
}

function showWindow(win: BrowserWindow) {
  if (win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function openFileWhenReady(file: { path: string; content: string; name: string }) {
  pendingFile = file;

  if (!app.isReady()) {
    return;
  }

  if (BrowserWindow.getAllWindows().length === 0) {
    // 新建窗口，渲染进程 ready 后由 app:ready 处理器带出 pendingFile
    createWindow();
    return;
  }

  // 已有窗口必已完成渲染，直接发给焦点窗口
  const win = getFocusedWindow();
  if (!win) return;
  showWindow(win);
  sendFileToWindow(win, file);
  pendingFile = null;
}

function registerIpcHandlers() {
  ipcMain.on(IPC_CHANNELS.LOG, (_event, level: string, tag: string, message: string) => {
    switch (level) {
      case 'info':
        logger.info(tag, message);
        break;
      case 'warn':
        logger.warn(tag, message);
        break;
      case 'error':
        logger.error(tag, message);
        break;
      case 'debug':
        logger.debug(tag, message);
        break;
      default:
        logger.info(tag, message);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (event) => {
    logger.info('IPC', 'File open requested');
    const parent = BrowserWindow.fromWebContents(event.sender) ?? getFocusedWindow();
    const result = await dialog.showOpenDialog(parent!, {
      properties: ['openFile'],
      filters: [
        { name: t(normalizeLang(getAppState('language')), 'allFiles'), extensions: ['*'] },
        { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      ],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      logger.info('File', `File opened: ${filePath}`);
      addRecentFile(filePath, path.basename(filePath));
      return { path: filePath, content, name: path.basename(filePath) };
    }
    logger.info('File', 'File open canceled');
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (event, filePath: string, content: string) => {
    logger.info('IPC', 'File save requested');
    const parent = BrowserWindow.fromWebContents(event.sender) ?? getFocusedWindow();
    if (!filePath) {
      const result = await dialog.showSaveDialog(parent!, {
        defaultPath: 'Untitled.md',
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
        ],
      });
      if (result.canceled || !result.filePath) {
        logger.info('File', 'File save canceled');
        return null;
      }
      filePath = result.filePath;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    logger.info('File', `File saved: ${filePath}`);
    addRecentFile(filePath, path.basename(filePath));
    return { path: filePath, name: path.basename(filePath) };
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_AS, async (event, content: string) => {
    logger.info('IPC', 'File save as requested');
    const parent = BrowserWindow.fromWebContents(event.sender) ?? getFocusedWindow();
    const result = await dialog.showSaveDialog(parent!, {
      defaultPath: 'Untitled.md',
      filters: [
        { name: t(normalizeLang(getAppState('language')), 'allFiles'), extensions: ['*'] },
        { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      ],
    });
    if (result.canceled || !result.filePath) {
      logger.info('File', 'File save as canceled');
      return null;
    }
    fs.writeFileSync(result.filePath, content, 'utf-8');
    logger.info('File', `File saved as: ${result.filePath}`);
    addRecentFile(result.filePath, path.basename(result.filePath));
    return { path: result.filePath, name: path.basename(result.filePath) };
  });

  // 视图模式持久化（渲染进程读写上次模式）
  ipcMain.handle('app:get-view-mode', () => getAppState('viewMode'));
  ipcMain.on('app:set-view-mode', (_event, mode: string) => setAppState('viewMode', mode));

  // 界面语言持久化（切换时同步重建菜单）
  ipcMain.handle('app:get-language', () => getAppState('language'));
  ipcMain.on('app:set-language', (_event, lang: string) => {
    const normalized = normalizeLang(lang);
    setAppState('language', normalized);
    createMenu();
    logger.info('App', `Language changed: ${normalized}`);
  });

  ipcMain.handle(IPC_CHANNELS.SHOW_UNSAVED_DIALOG, async (event, fileName: string, forQuit = false) => {
    logger.info('IPC', 'Unsaved dialog requested');
    const parent = BrowserWindow.fromWebContents(event.sender) ?? getFocusedWindow();
    const lang = normalizeLang(getAppState('language'));
    const result = await dialog.showMessageBox(parent!, {
      type: 'warning',
      buttons: forQuit
        ? [t(lang, 'unsavedYes'), t(lang, 'unsavedNo'), t(lang, 'unsavedCancel')]
        : [t(lang, 'unsavedSave'), t(lang, 'unsavedDiscard'), t(lang, 'unsavedCancel')],
      defaultId: 0,
      cancelId: 2,
      title: t(lang, 'unsavedTitle'),
      message: `“${fileName}” ${t(lang, 'unsavedDetail')}`,
      detail: forQuit ? t(lang, 'unsavedForQuitDetail') : t(lang, 'unsavedDetail'),
    });
    const choice = ['save', 'discard', 'cancel'][result.response];
    logger.info('Dialog', `User choice: ${choice}`);
    return choice;
  });

  // 新建流程：渲染进程请求新开一个应用窗口
  ipcMain.on('window:new', (event) => {
    const source = BrowserWindow.fromWebContents(event.sender);
    logger.info('IPC', `New window requested from: ${source?.id ?? 'unknown'}`);
    createWindow({ promptSaveAs: true });
  });

  // Word 式打开：新开窗口加载指定文件（当前窗口已有文档时由渲染进程请求）
  ipcMain.on('window:open-file', (_event, filePath: string) => {
    try {
      logger.info('IPC', `Open file in new window: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const file = { path: filePath, content, name: path.basename(filePath) };
      createWindow();
      // 新窗口渲染就绪后由 app:ready 处理器带出（recents 亦由 sendFileToWindow 记录）
      pendingFile = file;
    } catch (err: any) {
      logger.error('IPC', `Failed to open file in new window: ${err.message}`);
    }
  });

  ipcMain.on('app:ready', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    logger.info('App', `Renderer is ready (window ${win.id})`);

    if (promptSaveWindows.has(win)) {
      // 新建流程：就绪后触发「弹保存对话框选新文件路径」
      promptSaveWindows.delete(win);
      if (pendingFile) {
        sendFileToWindow(win, pendingFile);
        pendingFile = null;
      } else {
        win.webContents.send('new-file-prompt');
      }
      return;
    }

    if (pendingFile) {
      sendFileToWindow(win, pendingFile);
      pendingFile = null;
    }
  });

  ipcMain.on('check:unsaved:response', (event, result: 'close' | 'cancel') => {
    logger.info('IPC', `Check unsaved response: ${result}`);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    if (result === 'close') {
      closingAllowed.add(win);
      win.close();
    }
  });

  ipcMain.on('check-unsaved-for-quit:response', (event, result: 'save' | 'discard' | 'cancel') => {
    logger.info('IPC', `Check unsaved for quit response: ${result}`);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (result === 'cancel') {
      // 用户取消：中止整个退出流程
      quitPendingWindows = [];
      quitInProgress = false;
      return;
    }
    if (result === 'discard') {
      if (win && !win.isDestroyed()) closingAllowed.add(win);
      processNextQuitWindow();
    }
    // 'save'：等待该窗口 save-done-for-quit 后再继续下一个
  });

  ipcMain.on('save-done-for-quit', (event) => {
    logger.info('IPC', 'Save done for quit');
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) closingAllowed.add(win);
    processNextQuitWindow();
  });
}

/** 退出队列：逐窗口串行确认，全部完成后真正退出 */
function processNextQuitWindow() {
  while (quitPendingWindows.length > 0) {
    const win = quitPendingWindows.shift()!;
    if (win.isDestroyed()) continue; // 过程中已被单独关闭的窗口直接跳过
    win.webContents.send('check-unsaved-for-quit');
    return;
  }
  finishQuit();
}

function finishQuit() {
  logger.info('App', 'All windows confirmed, quitting');
  quitInProgress = false;
  isQuitting = true;
  for (const win of BrowserWindow.getAllWindows()) {
    closingAllowed.add(win);
  }
  app.quit();
}

function createMenu() {
  const lang = normalizeLang(getAppState('language'));

  /** 菜单事件发给焦点窗口（无焦点时回退第一个窗口） */
  const sendToFocused = (channel: string) => {
    getFocusedWindow()?.webContents.send(channel);
  };

  // 「最近打开」子菜单（数据来自 SQLite，最多 20 条）
  const recents = getRecentFiles();
  const recentItems: MenuItemConstructorOptions[] = recents.length > 0
    ? recents.map((f) => ({
        label: f.name,
        click: () => {
          try {
            const content = fs.readFileSync(f.path, 'utf-8');
            openFileWhenReady({ path: f.path, content, name: f.name });
          } catch (err: any) {
            logger.error('File', `Failed to open recent file: ${err.message}`);
          }
        },
      }))
    : [{ label: t(lang, 'noRecents'), enabled: false }];

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: t(lang, 'menuAbout') },
        { type: 'separator' },
        { role: 'services', label: t(lang, 'menuServices') },
        { type: 'separator' },
        { role: 'hide', label: t(lang, 'menuHide') },
        { role: 'hideOthers', label: t(lang, 'menuHideOthers') },
        { role: 'unhide', label: t(lang, 'menuUnhide') },
        { type: 'separator' },
        {
          label: t(lang, 'menuQuit'),
          accelerator: 'Cmd+Q',
          click: () => {
            logger.info('App', 'Quit requested via menu');
            app.quit();
          }
        },
      ],
    },
    {
      label: t(lang, 'menuFile'),
      submenu: [
        {
          label: t(lang, 'new'),
          accelerator: 'Cmd+N',
          click: () => sendToFocused('menu:new'),
        },
        {
          label: t(lang, 'open'),
          accelerator: 'Cmd+O',
          click: () => sendToFocused('menu:open'),
        },
        {
          label: t(lang, 'menuRecent'),
          submenu: recentItems,
        },
        { type: 'separator' },
        {
          label: t(lang, 'save'),
          accelerator: 'Cmd+S',
          click: () => sendToFocused('menu:save'),
        },
        {
          label: t(lang, 'saveAs'),
          accelerator: 'Cmd+Shift+S',
          click: () => sendToFocused('menu:save-as'),
        },
        { type: 'separator' },
        {
          label: t(lang, 'closeFile'),
          accelerator: 'Cmd+W',
          click: () => sendToFocused('menu:close-tab'),
        },
      ],
    },
    {
      label: t(lang, 'menuEdit'),
      submenu: [
        { role: 'undo', label: t(lang, 'undo') },
        { role: 'redo', label: t(lang, 'redo') },
        { type: 'separator' },
        { role: 'cut', label: t(lang, 'cut') },
        { role: 'copy', label: t(lang, 'copy') },
        { role: 'paste', label: t(lang, 'paste') },
        {
          label: t(lang, 'selectAll'),
          accelerator: 'CmdOrCtrl+A',
          click: () => sendToFocused('menu:select-all'),
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/** 最近文件变化后重建菜单（刷新「最近打开」子菜单） */
function refreshMenu() {
  createMenu();
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  logger.info('App', `Open file event: ${filePath}`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const file = { path: filePath, content, name: path.basename(filePath) };
    openFileWhenReady(file);
  } catch (err: any) {
    logger.error('App', `Failed to open file: ${err.message}`);
  }
});

app.whenReady().then(() => {
  logger.init();
  logger.info('App', 'App starting');

  // 「关于」对话框版权行（兜底：打包配置未生效的开发模式下同样显示）
  app.setAboutPanelOptions({ copyright: 'Copyright © 2026 alanwangcanyi' });

  initDatabase();
  registerIpcHandlers();
  createMenu();

  // 命令行文件参数（须在创建首窗口前解析，决定首窗口是否走新建流程）
  const mdArg = process.argv.find((arg) => {
    return (arg.endsWith('.md') || arg.endsWith('.markdown') || arg.endsWith('.txt'))
      && fs.existsSync(arg);
  });
  if (mdArg && !pendingFile) {
    try {
      logger.info('App', `Command line file argument: ${mdArg}`);
      const content = fs.readFileSync(mdArg, 'utf-8');
      pendingFile = { path: mdArg, content, name: path.basename(mdArg) };
    } catch (err: any) {
      logger.error('App', `Failed to read command line file: ${err.message}`);
    }
  }

  // 直接启动（无文件）时首窗口等于「新建」：弹保存对话框选新文件路径
  createWindow({ promptSaveAs: !pendingFile });

  app.on('activate', () => {
    logger.info('App', 'App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      // Dock 重新激活且无窗口：等同直接打开应用（新建流程）
      createWindow({ promptSaveAs: true });
    }
  });
});

app.on('window-all-closed', () => {
  logger.info('App', 'All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (e) => {
  logger.info('App', 'App before quit');
  if (isQuitting) {
    // 已经设置了 isQuitting，允许退出
    return;
  }

  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) {
    isQuitting = true;
    return;
  }

  // 阻止默认退出行为，逐窗口串行确认未保存
  e.preventDefault();

  if (quitInProgress) {
    // 已有退出确认流程在进行中，等待各窗口回复即可
    return;
  }
  quitInProgress = true;
  quitPendingWindows = [...windows];
  processNextQuitWindow();
});

app.on('quit', () => {
  logger.info('App', 'App quit');
});
