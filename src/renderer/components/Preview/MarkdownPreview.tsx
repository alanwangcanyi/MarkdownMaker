import React from 'react';
import markdownit from 'markdown-it';
import { useEditorStore } from '../../stores/editorStore';

const md = markdownit();

export const MarkdownPreview: React.FC = () => {
  const content = useEditorStore(s => s.content);

  return (
    <div className="preview-wrapper" dangerouslySetInnerHTML={{ __html: md.render(content) }} />
  );
};
