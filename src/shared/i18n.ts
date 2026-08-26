/**
 * 轻量国际化字典（无第三方依赖）
 * 主进程（菜单/对话框）与渲染进程（工具栏/状态栏）共用。
 * 新增文案：两处语言各加一条 key，保持同步。
 */

export type Lang = 'zh' | 'en';

export const translations = {
  zh: {
    // 工具栏
    new: '新建',
    open: '打开',
    save: '保存',
    saveAs: '另存为',
    closeFile: '关闭',
    edit: '编辑',
    preview: '阅读',
    split: '分栏',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    selectAll: '全选',
    undo: '撤销',
    redo: '重做',
    language: '语言',
    copyFileName: '复制文件名',
    copyFullPath: '复制完整路径',
    noRecents: '（暂无记录）',
    // 状态栏
    lines: '行',
    words: '字数',
    editMode: '编辑模式',
    previewMode: '阅读模式',
    splitMode: '分栏模式',
    // 菜单
    menuAbout: '关于 Markdown Maker',
    menuServices: '服务',
    menuHide: '隐藏 Markdown Maker',
    menuHideOthers: '隐藏其他',
    menuUnhide: '显示全部',
    menuQuit: '退出',
    menuFile: '文件',
    menuRecent: '最近打开',
    menuEdit: '编辑',
    // 对话框
    allFiles: '所有文件',
    unsavedTitle: '未保存的更改',
    unsavedForQuitDetail: '是否需要保存后退出？',
    unsavedDetail: '您想要保存这些更改吗？',
    unsavedSave: '保存并关闭',
    unsavedDiscard: '不保存并关闭',
    unsavedCancel: '取消',
    unsavedYes: '是',
    unsavedNo: '否',
  },
  en: {
    // Toolbar
    new: 'New',
    open: 'Open',
    save: 'Save',
    saveAs: 'Save As',
    closeFile: 'Close',
    edit: 'Edit',
    preview: 'Preview',
    split: 'Split',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    undo: 'Undo',
    redo: 'Redo',
    language: 'Language',
    copyFileName: 'Copy File Name',
    copyFullPath: 'Copy Full Path',
    noRecents: '(Empty)',
    // Status bar
    lines: 'Lines',
    words: 'Words',
    editMode: 'Edit Mode',
    previewMode: 'Preview Mode',
    splitMode: 'Split Mode',
    // Menu
    menuAbout: 'About Markdown Maker',
    menuServices: 'Services',
    menuHide: 'Hide Markdown Maker',
    menuHideOthers: 'Hide Others',
    menuUnhide: 'Show All',
    menuQuit: 'Quit',
    menuFile: 'File',
    menuRecent: 'Recent Files',
    menuEdit: 'Edit',
    // Dialog
    allFiles: 'All Files',
    unsavedTitle: 'Unsaved Changes',
    unsavedForQuitDetail: 'Save before quitting?',
    unsavedDetail: 'Do you want to save your changes?',
    unsavedSave: 'Save and Close',
    unsavedDiscard: 'Discard and Close',
    unsavedCancel: 'Cancel',
    unsavedYes: 'Yes',
    unsavedNo: 'No',
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;

/** 取当前语言文案 */
export function t(lang: Lang, key: TranslationKey): string {
  return translations[lang][key];
}

/** 把存储的任意值规整为合法语言（默认中文） */
export function normalizeLang(value: string | null | undefined): Lang {
  return value === 'en' ? 'en' : 'zh';
}
