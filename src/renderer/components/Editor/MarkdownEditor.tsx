import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { useEditorStore } from '../../stores/editorStore';

export const MarkdownEditor: React.FC = () => {
  const content = useEditorStore(s => s.content);
  const setContent = useEditorStore(s => s.setContent);
  const setEditorView = useEditorStore(s => s.setEditorView);
  const setLineCount = useEditorStore(s => s.setLineCount);
  const setWordCount = useEditorStore(s => s.setWordCount);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setContent(update.state.doc.toString());
      }
      const text = update.state.doc.toString();
      const lines = update.state.doc.lines;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setLineCount(lines);
      setWordCount(words);
    });

    const view = new EditorView({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        updateListener,
      ],
      parent: editorRef.current,
    });

    viewRef.current = view;
    setEditorView(view);

    const lines = view.state.doc.lines;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    setLineCount(lines);
    setWordCount(words);

    return () => {
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
    };
  }, []);

  useEffect(() => {
    if (viewRef.current && viewRef.current.state.doc.toString() !== content) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: content,
        },
      });
    }
  }, [content]);

  return (
    <div className="editor-wrapper" ref={editorRef} />
  );
};
