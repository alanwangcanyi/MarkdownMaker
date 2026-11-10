import React from 'react';
import markdownit from 'markdown-it';
import { useEditorStore } from '../../stores/editorStore';

const md = markdownit();

export const MarkdownPreview: React.FC = () => {
  const content = useEditorStore(s => s.content);

  return (
    <div
      className="preview-wrapper"
      tabIndex={-1}
      onMouseDown={event => event.currentTarget.focus({ preventScroll: true })}
      dangerouslySetInnerHTML={{ __html: md.render(content) }}
    />
  );
};
