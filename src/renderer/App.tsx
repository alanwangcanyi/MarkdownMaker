import { useEffect } from 'react';
import { useEditorStore } from './stores/editorStore';
import { Toolbar } from './components/Layout/Toolbar';
import { StatusBar } from './components/Layout/StatusBar';
import { MarkdownEditor } from './components/Editor/MarkdownEditor';
import { MarkdownPreview } from './components/Preview/MarkdownPreview';
import { RendererLogger } from './utils/logger';
import './styles/global.css';

type LoadedFile = { path: string; content: string; name: string };
type UnsavedChoice = 'save' | 'discard' | 'cancel';

function App() {
  const viewMode = useEditorStore(s => s.viewMode);
  const setContent = useEditorStore(s => s.setContent);
  const setCurrentFile = useEditorStore(s => s.setCurrentFile);
  const setLineCount = useEditorStore(s => s.setLineCount);
  const setWordCount = useEditorStore(s => s.setWordCount);

  const loadFileIntoEditor = (file: LoadedFile) => {
    setContent(file.content);
    setCurrentFile({ path: file.path, name: file.name, modified: false });
  };

  const resetEditor = () => {
    setCurrentFile(null);
    setContent('');
    setLineCount(1);
    setWordCount(0);
  };

  const saveCurrentDocument = async (): Promise<boolean> => {
    const { content, currentFile } = useEditorStore.getState();
    const result = await window.electronAPI.saveFile(currentFile?.path || '', content);

    if (!result) {
      return false;
    }

    useEditorStore.setState({
      content,
      originalContent: content,
      currentFile: { path: result.path, name: result.name, modified: false },
    });
    return true;
  };

  const confirmUnsavedChanges = async (forQuit = false): Promise<UnsavedChoice> => {
    const { content, currentFile } = useEditorStore.getState();
    const hasUnsavedChanges = currentFile?.modified || (!currentFile && content.trim() !== '');

    if (!hasUnsavedChanges) {
      return 'discard';
    }

    const fileName = currentFile?.name || 'Untitled';
    const choice = await window.electronAPI.showUnsavedDialog(fileName, forQuit);

    if (choice !== 'save') {
      return choice;
    }

    return await saveCurrentDocument() ? 'save' : 'cancel';
  };

  const canReplaceDocument = async () => {
    const choice = await confirmUnsavedChanges();
    return choice !== 'cancel';
  };

  const handleNew = async () => {
    // 多窗口模型：新建 = 新开一个应用窗口并弹保存对话框（旧窗口原样保留）
    RendererLogger.info('App', 'Requesting new window');
    window.electronAPI.newWindow();
  };

  const handleOpen = async () => {
    RendererLogger.info('App', 'Opening file');
    const file = await window.electronAPI.openFile();
    if (file && await canReplaceDocument()) {
      loadFileIntoEditor(file);
    }
  };

  const handleSave = async () => {
    RendererLogger.info('App', 'Saving file');
    await saveCurrentDocument();
  };

  const handleSaveAs = async () => {
    RendererLogger.info('App', 'Saving file as');
    const { content } = useEditorStore.getState();
    const result = await window.electronAPI.saveAsFile(content);
    if (result) {
      useEditorStore.setState({
        content,
        originalContent: content,
        currentFile: { path: result.path, name: result.name, modified: false },
      });
    }
  };

  const checkUnsavedAndClose = async (): Promise<'close' | 'cancel'> => {
    RendererLogger.info('App', 'Checking unsaved changes for close');
    if (await canReplaceDocument()) {
      resetEditor();
      return 'close';
    }
    return 'cancel';
  };

  const checkUnsavedForQuit = async (): Promise<void> => {
    RendererLogger.info('App', 'Checking unsaved changes for quit');
    const choice = await confirmUnsavedChanges(true);

    if (choice === 'cancel') {
      window.electronAPI.sendCheckUnsavedForQuitResponse('cancel');
      return;
    }

    resetEditor();
    if (choice === 'save') {
      window.electronAPI.saveDoneForQuit();
      return;
    }

    window.electronAPI.sendCheckUnsavedForQuitResponse('discard');
  };

  const handleClose = async () => {
    RendererLogger.info('App', 'Closing file');
    await checkUnsavedAndClose();
  };

  useEffect(() => {
    RendererLogger.info('App', 'Renderer initialized');
    window.electronAPI.appReady();

    // 恢复上次视图模式（SQLite 持久化）
    void window.electronAPI.getViewMode().then((mode) => {
      if (mode === 'edit' || mode === 'preview' || mode === 'split') {
        useEditorStore.getState().setViewMode(mode);
      }
    });

    // 恢复上次界面语言（SQLite 持久化）
    void window.electronAPI.getLanguage().then((lang) => {
      useEditorStore.getState().setLanguage(lang === 'en' ? 'en' : 'zh');
    });

    const off1 = window.electronAPI.onFileOpened((file) => {
      RendererLogger.info('App', `File opened: ${file.path}`);
      void (async () => {
        if (await canReplaceDocument()) {
          loadFileIntoEditor(file);
        }
      })();
    });

    const off2 = window.electronAPI.onMenuNew(() => void handleNew());
    const off3 = window.electronAPI.onMenuOpen(() => void handleOpen());
    const off4 = window.electronAPI.onMenuSave(() => void handleSave());
    const off5 = window.electronAPI.onMenuSaveAs(() => void handleSaveAs());
    const off6 = window.electronAPI.onMenuCloseTab(() => void handleClose());

    // 新建流程：新窗口就绪后弹保存对话框选新文件路径（取消则保留为空白未命名文档）
    const off9 = window.electronAPI.onNewFilePrompt(() => void handleSaveAs());

    const off7 = window.electronAPI.onCheckUnsaved(async () => {
      return await checkUnsavedAndClose();
    });

    const off8 = window.electronAPI.onCheckUnsavedForQuit(async () => {
      await checkUnsavedForQuit();
    });

    return () => {
      off1();
      off2();
      off3();
      off4();
      off5();
      off6();
      off7();
      off8();
      off9();
    };
  }, []);

  // 视图模式变化时写入 SQLite 持久化
  useEffect(() => {
    window.electronAPI.setViewMode(viewMode);
  }, [viewMode]);

  const renderMainContent = () => {
    if (viewMode === 'edit') {
      return (
        <div className="editor-area">
          <MarkdownEditor />
        </div>
      );
    } else if (viewMode === 'preview') {
      return (
        <div className="preview-area">
          <MarkdownPreview />
        </div>
      );
    } else {
      return (
        <div className="split-area">
          <div className="editor-area">
            <MarkdownEditor />
          </div>
          <div className="preview-area">
            <MarkdownPreview />
          </div>
        </div>
      );
    }
  };

  return (
    <div className="app">
      <Toolbar
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onClose={handleClose}
      />
      <div className="app-body">
        {renderMainContent()}
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
