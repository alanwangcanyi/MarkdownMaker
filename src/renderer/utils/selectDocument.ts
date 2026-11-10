import { selectAll } from '@codemirror/commands';
import { useEditorStore } from '../stores/editorStore';

export function selectDocument() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    activeElement.select();
    return;
  }

  const { viewMode, editorView } = useEditorStore.getState();
  const preview = document.querySelector<HTMLElement>('.preview-wrapper');
  if (preview && (viewMode === 'preview' || (viewMode === 'split' && preview.contains(activeElement)))) {
    preview.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(preview);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  if (editorView) {
    editorView.focus();
    selectAll(editorView);
  }
}
