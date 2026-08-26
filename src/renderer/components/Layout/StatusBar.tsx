import React from 'react';
import { useEditorStore } from '../../stores/editorStore';

export const StatusBar: React.FC = () => {
  const lineCount = useEditorStore(s => s.lineCount);
  const wordCount = useEditorStore(s => s.wordCount);
  const viewMode = useEditorStore(s => s.viewMode);

  const modeLabel: Record<string, string> = {
    edit: '编辑模式',
    preview: '阅读模式',
    split: '分栏模式',
  };

  return (
    <div className="statusbar">
      <span>行 {lineCount} / 字数 {wordCount}</span>
      <span>{modeLabel[viewMode]}</span>
    </div>
  );
};
