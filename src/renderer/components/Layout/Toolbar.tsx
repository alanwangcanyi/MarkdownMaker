import React, { useState, useRef, useEffect } from 'react';
import { redo, undo } from '@codemirror/commands';
import { selectDocument } from '../../utils/selectDocument';
import { useEditorStore } from '../../stores/editorStore';
import { ViewMode } from '../../../shared/types';
import { t, Lang } from '../../../shared/i18n';

interface ToolbarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onClose: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onClose,
}) => {
  const viewMode = useEditorStore(s => s.viewMode);
  const setViewMode = useEditorStore(s => s.setViewMode);
  const currentFile = useEditorStore(s => s.currentFile);
  const editorView = useEditorStore(s => s.editorView);
  const language = useEditorStore(s => s.language);
  const setLanguage = useEditorStore(s => s.setLanguage);

  const [showPathMenu, setShowPathMenu] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const modeButtons: { mode: ViewMode; label: string }[] = [
    { mode: 'edit', label: t(language, 'edit') },
    { mode: 'preview', label: t(language, 'preview') },
    { mode: 'split', label: t(language, 'split') },
  ];

  // 语言切换（中文/英文），主进程会同步重建菜单
  const toggleLanguage = () => {
    const next: Lang = language === 'zh' ? 'en' : 'zh';
    setLanguage(next);
    window.electronAPI.setLanguage(next);
  };

  // 文件名过长时中间截断：前7字…后7字（保留扩展名）
  const truncateMiddle = (name: string, max = 15): string => {
    if (name.length <= max) return name;
    const side = Math.floor((max - 1) / 2);
    return `${name.slice(0, side)}…${name.slice(-side)}`;
  };

  const handleClickAnywhere = () => {
    if (showPathMenu) {
      setShowPathMenu(false);
    }
  };

  const handleCopyFileName = () => {
    if (currentFile) {
      navigator.clipboard.writeText(currentFile.name);
      setShowPathMenu(false);
    }
  };

  const handleCopyFullPath = () => {
    if (currentFile) {
      navigator.clipboard.writeText(currentFile.path);
      setShowPathMenu(false);
    }
  };

  const execEditorCommand = (cmd: 'undo' | 'redo' | 'cut' | 'copy' | 'paste') => {
    if (!editorView) return;
    editorView.focus();

    if (cmd === 'undo') {
      undo(editorView);
    } else if (cmd === 'redo') {
      redo(editorView);
    } else if (cmd === 'cut') {
      document.execCommand('cut');
    } else if (cmd === 'copy') {
      document.execCommand('copy');
    } else if (cmd === 'paste') {
      document.execCommand('paste');
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPathMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="toolbar" onClick={handleClickAnywhere}>
      <div className="toolbar-section">
        <button className="tb-btn" onClick={onNew} title={`${t(language, 'new')} (⌘N)`}>
          <span className="tb-icon">📄</span>
          <span className="tb-label">{t(language, 'new')}</span>
        </button>
        <button className="tb-btn" onClick={onOpen} title={`${t(language, 'open')} (⌘O)`}>
          <span className="tb-icon">📂</span>
          <span className="tb-label">{t(language, 'open')}</span>
        </button>
        <button className="tb-btn" onClick={onSave} title={`${t(language, 'save')} (⌘S)`}>
          <span className="tb-icon">💾</span>
          <span className="tb-label">{t(language, 'save')}</span>
        </button>
        <button className="tb-btn" onClick={onSaveAs} title={`${t(language, 'saveAs')} (⇧⌘S)`}>
          <span className="tb-icon">📋</span>
          <span className="tb-label">{t(language, 'saveAs')}</span>
        </button>
        <button className="tb-btn tb-btn-danger" onClick={onClose} title={`${t(language, 'closeFile')} (⌘W)`}>
          <span className="tb-icon">✕</span>
          <span className="tb-label">{t(language, 'closeFile')}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        {modeButtons.map(({ mode, label }) => (
          <button
            key={mode}
            className={`tb-btn ${viewMode === mode ? 'tb-active' : ''}`}
            onClick={() => setViewMode(mode)}
            title={label}
          >
            <span className="tb-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-spacer" />

      {currentFile && (
        <div className="toolbar-section file-section" ref={menuRef}>
          <div
            className="file-title"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
              setShowPathMenu(!showPathMenu);
            }}
            onMouseEnter={() => { if (!showPathMenu) setShowTooltip(true); }}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <span className="title-text">{truncateMiddle(currentFile.name)}</span>
            {currentFile.modified && <span className="title-modified">•</span>}
            {showTooltip && (
              <div className="path-tooltip">{currentFile.name}</div>
            )}
            {showPathMenu && (
              <div className="path-menu">
                <div className="path-menu-item" onClick={handleCopyFileName}>
                  {t(language, 'copyFileName')}
                </div>
                <div className="path-menu-item" onClick={handleCopyFullPath}>
                  {t(language, 'copyFullPath')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="toolbar-spacer" />

      <div className="toolbar-section">
        <button className="tb-btn" onClick={() => execEditorCommand('undo')} title={`${t(language, 'undo')} (⌘Z)`}>
          <span className="tb-icon">↩</span>
        </button>
        <button className="tb-btn" onClick={() => execEditorCommand('redo')} title={`${t(language, 'redo')} (⇧⌘Z)`}>
          <span className="tb-icon">↪</span>
        </button>
        <button className="tb-btn" onClick={toggleLanguage} title={t(language, 'language')}>
          <span className="tb-label">{language === 'zh' ? 'EN' : '中'}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button className="tb-btn" onClick={() => execEditorCommand('cut')} title={`${t(language, 'cut')} (⌘X)`}>
          <span className="tb-icon">✂️</span>
          <span className="tb-label">{t(language, 'cut')}</span>
        </button>
        <button className="tb-btn" onClick={() => execEditorCommand('copy')} title={`${t(language, 'copy')} (⌘C)`}>
          <span className="tb-icon">📋</span>
          <span className="tb-label">{t(language, 'copy')}</span>
        </button>
        <button className="tb-btn" onClick={() => execEditorCommand('paste')} title={`${t(language, 'paste')} (⌘V)`}>
          <span className="tb-icon">📎</span>
          <span className="tb-label">{t(language, 'paste')}</span>
        </button>
        <button className="tb-btn" onMouseDown={event => event.preventDefault()} onClick={selectDocument} title={`${t(language, 'selectAll')} (⌘A)`}>
          <span className="tb-label">{t(language, 'selectAll')}</span>
        </button>
      </div>
    </div>
  );
};
