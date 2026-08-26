import React from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { t } from '../../../shared/i18n';

export const StatusBar: React.FC = () => {
  const lineCount = useEditorStore(s => s.lineCount);
  const wordCount = useEditorStore(s => s.wordCount);
  const viewMode = useEditorStore(s => s.viewMode);
  const language = useEditorStore(s => s.language);

  const modeLabel: Record<string, string> = {
    edit: t(language, 'editMode'),
    preview: t(language, 'previewMode'),
    split: t(language, 'splitMode'),
  };

  return (
    <div className="statusbar">
      <span>{t(language, 'lines')} {lineCount} / {t(language, 'words')} {wordCount}</span>
      <span>{modeLabel[viewMode]}</span>
    </div>
  );
};
