import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import { Logger } from './logger';
import { initDatabase, addRecentFile, getRecentFiles, getAppState, setAppState, getWindowBounds, saveWindowBounds } from './database';

const IPC_CHANNELS = {
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  SHOW_UNSAVED_DIALOG: 'dialog:unsaved',
  LOG: 'log',
  CHECK_UNSAVED: 'check:unsaved',
} as const;

const logger = Logger.getInstance();

let mainWindow: BrowserWindow | null = null;
let rendererReady = false;
let pendingFile: { path: string; content: string; name: string } | null = null;
let isQuitting = false;
let quitRequested = false;

function createWindow() {
  logger.info('App', 'Creating main window');

  // 恢复上次窗口位置大小（无记录时用默认值）
  const savedBounds = getWindowBounds();

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1000,
    height: savedBounds?.height ?? 700,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')).catch((err) => {
      logger.error('Window', `loadFile failed: ${err?.message || err}`);
    });
  }

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Window', 'Web contents finished loading');
  });

  // 诊断：页面加载失败 / 渲染进程异常退出
  mainWindow.webContents.on('did-fail-load', (_e: any, code: number, desc: string, url: string) => {
    logger.error('Window', `did-fail-load: code=${code} desc=${desc} url=${url}`);
  });
  mainWindow.webContents.on('preload-error', (_e: any, preloadPath: string, err: any) => {
    logger.error('Window', `preload-error: ${preloadPath} ${err?.message || err}`);
  });

  mainWindow.on('close', (e) => {
    logger.info('Window', 'Window close requested');
    // 保存窗口位置大小（窗口销毁前）
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowBounds(mainWindow.getBounds());
    }
    if (isQuitting) {
      return;
    }
    
    e.preventDefault();
    
    mainWindow?.webContents.send(IPC_CHANNELS.CHECK_UNSAVED);
  });

  mainWindow.on('closed', () => {
    logger.info('Window', 'Main window closed');
    mainWindow = null;
    rendererReady = false;
    isQuitting = false;
  });
}

function sendFileToRenderer(file: { path: string; content: string; name: string }) {
  logger.info('File', `Opening file: ${file.path}`);
  addRecentFile(file.path, file.name);
  refreshMenu();
  mainWindow?.webContents.send('file:opened', file);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function openFileWhenReady(file: { path: string; content: string; name: string }) {
  pendingFile = file;

  if (!app.isReady()) {
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  showMainWindow();
  if (rendererReady) {
    sendFileToRenderer(file);
    pendingFile = null;
  }
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

  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async () => {
    logger.info('IPC', 'File open requested');
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: '所有文件', extensions: ['*'] },
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

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (_event, filePath: string, content: string) => {
    logger.info('IPC', 'File save requested');
    if (!filePath) {
      const result = await dialog.showSaveDialog(mainWindow!, {
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

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_AS, async (_event, content: string) => {
    logger.info('IPC', 'File save as requested');
    const result = await dialog.showSaveDialog(mainWindow!, {
      filters: [
        { name: '所有文件', extensions: ['*'] },
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

  ipcMain.handle(IPC_CHANNELS.SHOW_UNSAVED_DIALOG, async (_event, fileName: string, forQuit = false) => {
    logger.info('IPC', 'Unsaved dialog requested');
    const result = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      buttons: forQuit ? ['是', '否', '取消'] : ['保存并关闭', '不保存并关闭', '取消'],
      defaultId: 0,
      cancelId: 2,
      title: '未保存的更改',
      message: `“${fileName}”包含未保存的更改`,
      detail: forQuit ? '是否需要保存后退出？' : '您想要保存这些更改吗？',
    });
    const choice = ['save', 'discard', 'cancel'][result.response];
    logger.info('Dialog', `User choice: ${choice}`);
    return choice;
  });

  ipcMain.on('app:ready', () => {
    logger.info('App', 'Renderer is ready');
    rendererReady = true;
    if (pendingFile) {
      sendFileToRenderer(pendingFile);
      pendingFile = null;
    }
  });

  ipcMain.on('check:unsaved:response', (_event, result: 'close' | 'cancel') => {
    logger.info('IPC', `Check unsaved response: ${result}`);
    if (result === 'close') {
      isQuitting = true;
      mainWindow?.close();
    }
  });

  ipcMain.on('check-unsaved-for-quit:response', async (_event, result: 'save' | 'discard' | 'cancel') => {
    logger.info('IPC', `Check unsaved for quit response: ${result}`);
    if (result === 'cancel') {
      quitRequested = false;
      return;
    }
    if (result === 'save') {
      // 让渲染进程保存，保存后再退出
      // 我们等待渲染进程处理保存，渲染进程保存成功后会发送 'save-done-for-quit'
      return;
    }
    if (result === 'discard') {
      quitRequested = false;
      isQuitting = true;
      app.quit();
    }
  });

  ipcMain.on('save-done-for-quit', () => {
    logger.info('IPC', 'Save done for quit');
    quitRequested = false;
    isQuitting = true;
    app.quit();
  });
}

function createMenu() {
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
    : [{ label: '（暂无记录）', enabled: false }];

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 Markdown Maker' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 Markdown Maker' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { 
          label: '退出', 
          accelerator: 'Cmd+Q',
          click: () => {
            logger.info('App', 'Quit requested via menu');
            app.quit();
          }
        },
      ],
    },
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'Cmd+N',
          click: () => mainWindow?.webContents.send('menu:new'),
        },
        {
          label: '打开',
          accelerator: 'Cmd+O',
          click: () => mainWindow?.webContents.send('menu:open'),
        },
        {
          label: '最近打开',
          submenu: recentItems,
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'Cmd+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        {
          label: '另存为',
          accelerator: 'Cmd+Shift+S',
          click: () => mainWindow?.webContents.send('menu:save-as'),
        },
        { type: 'separator' },
        {
          label: '关闭',
          accelerator: 'Cmd+W',
          click: () => mainWindow?.webContents.send('menu:close-tab'),
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
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

  initDatabase();
  registerIpcHandlers();
  createMenu();
  createWindow();

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

  app.on('activate', () => {
    logger.info('App', 'App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
  if (!mainWindow || mainWindow.isDestroyed()) {
    isQuitting = true;
    return;
  }
  if (quitRequested) {
    // 已有退出请求在处理中，继续等待渲染进程回复
    e.preventDefault();
    return;
  }
  // 阻止默认退出行为
  e.preventDefault();
  quitRequested = true;
  // 发送消息给渲染进程检查未保存
  mainWindow?.webContents.send('check-unsaved-for-quit');
});

app.on('quit', () => {
  logger.info('App', 'App quit');
});
