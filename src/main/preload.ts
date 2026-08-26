import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  SHOW_UNSAVED_DIALOG: 'dialog:unsaved',
  LOG: 'log',
  CHECK_UNSAVED: 'check:unsaved',
} as const;

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN),
  saveFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE, filePath, content),
  saveAsFile: (content: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE_AS, content),
  showUnsavedDialog: (fileName: string, forQuit = false) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_UNSAVED_DIALOG, fileName, forQuit),
  saveDoneForQuit: () => ipcRenderer.send('save-done-for-quit'),
  sendCheckUnsavedForQuitResponse: (choice: 'save' | 'discard' | 'cancel') =>
    ipcRenderer.send('check-unsaved-for-quit:response', choice),
  onCheckUnsavedForQuit: (callback: () => Promise<void>) => {
    const listener = async (_event: any) => {
      await callback();
    };
    ipcRenderer.on('check-unsaved-for-quit', listener);
    return () => ipcRenderer.removeListener('check-unsaved-for-quit', listener);
  },
  logFromRenderer: (level: string, tag: string, message: string) =>
    ipcRenderer.send(IPC_CHANNELS.LOG, level, tag, message),
  onCheckUnsaved: (callback: () => Promise<'close' | 'cancel'>) => {
    const listener = async (_event: any) => {
      const result = await callback();
      ipcRenderer.send('check:unsaved:response', result);
    };
    ipcRenderer.on(IPC_CHANNELS.CHECK_UNSAVED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CHECK_UNSAVED, listener);
  },
  onFileOpened: (callback: (file: { path: string; content: string; name: string }) => void) => {
    const listener = (_event: any, file: any) => callback(file);
    ipcRenderer.on('file:opened', listener);
    return () => ipcRenderer.removeListener('file:opened', listener);
  },
  onMenuNew: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:new', listener);
    return () => ipcRenderer.removeListener('menu:new', listener);
  },
  onMenuOpen: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:open', listener);
    return () => ipcRenderer.removeListener('menu:open', listener);
  },
  onMenuSave: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:save', listener);
    return () => ipcRenderer.removeListener('menu:save', listener);
  },
  onMenuSaveAs: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:save-as', listener);
    return () => ipcRenderer.removeListener('menu:save-as', listener);
  },
  onMenuCloseTab: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('menu:close-tab', listener);
    return () => ipcRenderer.removeListener('menu:close-tab', listener);
  },
  newWindow: () => ipcRenderer.send('window:new'),
  onNewFilePrompt: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('new-file-prompt', listener);
    return () => ipcRenderer.removeListener('new-file-prompt', listener);
  },
  appReady: () => ipcRenderer.send('app:ready'),
  getViewMode: () => ipcRenderer.invoke('app:get-view-mode') as Promise<string | null>,
  setViewMode: (mode: string) => ipcRenderer.send('app:set-view-mode', mode),
  getLanguage: () => ipcRenderer.invoke('app:get-language') as Promise<string | null>,
  setLanguage: (lang: string) => ipcRenderer.send('app:set-language', lang),
});
