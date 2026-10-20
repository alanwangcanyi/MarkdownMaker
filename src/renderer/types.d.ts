export interface ElectronAPI {
  openFile: () => Promise<{ path: string; content: string; name: string } | null>;
  saveFile: (filePath: string, content: string) => Promise<{ path: string; name: string } | null>;
  saveAsFile: (content: string) => Promise<{ path: string; name: string } | null>;
  showUnsavedDialog: (fileName: string, forQuit?: boolean) => Promise<'save' | 'discard' | 'cancel'>;
  saveDoneForQuit: () => void;
  sendCheckUnsavedForQuitResponse: (choice: 'save' | 'discard' | 'cancel') => void;
  onCheckUnsavedForQuit: (callback: () => Promise<void>) => () => void;
  logFromRenderer: (level: string, tag: string, message: string) => void;
  onCheckUnsaved: (callback: () => Promise<'close' | 'cancel'>) => () => void;
  onFileOpened: (callback: (file: { path: string; content: string; name: string }) => void) => () => void;
  onMenuNew: (callback: () => void) => () => void;
  onMenuOpen: (callback: () => void) => () => void;
  onMenuSave: (callback: () => void) => () => void;
  onMenuSaveAs: (callback: () => void) => () => void;
  onMenuCloseTab: (callback: () => void) => () => void;
  onMenuSelectAll: (callback: () => void) => () => void;
  newWindow: () => void;
  openFileInNewWindow: (filePath: string) => void;
  onNewFilePrompt: (callback: () => void) => () => void;
  appReady: () => void;
  getViewMode: () => Promise<string | null>;
  setViewMode: (mode: string) => void;
  getLanguage: () => Promise<string | null>;
  setLanguage: (lang: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
