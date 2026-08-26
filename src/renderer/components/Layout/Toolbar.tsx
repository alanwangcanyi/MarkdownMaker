import React, { useState, useRef, useEffect } from 'react';
import { redo, selectAll, undo } from '@codemirror/commands';
import { useEditorStore } from '../../stores/editorStore';
import { ViewMode } from '../../../shared/types';

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

  const [showPathMenu, setShowPathMenu] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const modeButtons: { mode: ViewMode; label: string }[] = [
    { mode: 'edit', label: '编辑' },
    { mode: 'preview', label: '阅读' },
    { mode: 'split', label: '分栏' },
  ];

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

  const execEditorCommand = (cmd: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll') => {
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
    } else if (cmd === 'selectAll') {
      selectAll(editorView);
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
        <button className="tb-btn" onClick={onNew} title="新建 (⌘N)">
          <span className="tb-icon">📄</span>
          <span className="tb-label">新建</span>
        </button>
        <button className="tb-btn" onClick={onOpen} title="打开 (⌘O)">
          <span className="tb-icon">📂</span>
          <span className="tb-label">打开</span>
        </button>
        <button className="tb-btn" onClick={onSave} title="保存 (⌘S)">
          <span className="tb-icon">💾</span>
          <span className="tb-label">保存</span>
        </button>
        <button className="tb-btn" onClick={onSaveAs} title="另存为 (⇧⌘S)">
          <span className="tb-icon">📋</span>
          <span className="tb-label">另存为</span>
        </button>
        <button className="tb-btn tb-btn-danger" onClick={onClose} title="关闭 (⌘W)">
          <span className="tb-icon">✕</span>
          <span className="tb-label">关闭</span>
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
                  复制文件名
                </div>
                <div className="path-menu-item" onClick={handleCopyFullPath}>
                  复制完整路径
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="toolbar-spacer" />

      <div className="toolbar-section">
        <button className="tb-btn" onClick={() => execEditorCommand('undo')} title="撤销 (⌘Z)">
          <span className="tb-icon">↩</span>
        </button>
        <button className="tb-btn" onClick={() => execEditorCommand('redo')} title="重做 (⇧⌘Z)">
          <span className="tb-icon">↪</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button className="tb-btn" onClick={() => execEditorCommand('cut')} title="剪切 (⌘X)">
          <span className="tb-icon">✂️</span>
          <span className="tb-label">剪切</span>
        </button>
        <button className="tb-btn" onClick={() => execEditorCommand('copy')} title="复制 (⌘C)">
          <span className="tb-icon">📋</span>
          <span className="tb-label">复制</span>
        </button>
        <button className="tb-btn" onClick={() => execEditorCommand('paste')} title="粘贴 (⌘V)">
          <span className="tb-icon">📎</span>
          <span className="tb-label">粘贴</span>
        </button>
        <button className="tb-btn" onClick={() => execEditorCommand('selectAll')} title="全选 (⌘A)">
          <span className="tb-label">全选</span>
        </button>
      </div>
    </div>
  );
};
