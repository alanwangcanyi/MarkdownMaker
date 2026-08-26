export type ViewMode = 'edit' | 'preview' | 'split';

export interface FileMeta {
  path: string;
  name: string;
  modified: boolean;
}
