import { create } from 'zustand';
import { EditorView } from 'codemirror';
import { ViewMode, FileMeta } from '../../shared/types';

interface EditorState {
  content: string;
  originalContent: string;
  viewMode: ViewMode;
  currentFile: FileMeta | null;
  editorView: EditorView | null;
  lineCount: number;
  wordCount: number;
  setContent: (content: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setCurrentFile: (file: FileMeta | null) => void;
  setEditorView: (view: EditorView | null) => void;
  setLineCount: (count: number) => void;
  setWordCount: (count: number) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  content: '',
  originalContent: '',
  viewMode: 'edit',
  currentFile: null,
  editorView: null,
  lineCount: 0,
  wordCount: 0,
  setContent: (content) => {
    const state = get();
    if (state.currentFile) {
      const isModified = content !== state.originalContent;
      set({ 
        content, 
        currentFile: { ...state.currentFile, modified: isModified } 
      });
    } else {
      set({ content });
    }
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentFile: (file) => {
    if (file) {
      const content = get().content;
      set({ 
        currentFile: file, 
        originalContent: content 
      });
    } else {
      set({ 
        currentFile: null, 
        originalContent: '',
        content: '' 
      });
    }
  },
  setEditorView: (view) => set({ editorView: view }),
  setLineCount: (count) => set({ lineCount: count }),
  setWordCount: (count) => set({ wordCount: count }),
}));
