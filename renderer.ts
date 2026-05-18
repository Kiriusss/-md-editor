/**
 * MD Editor - Renderer Process
 * Handles all UI logic, markdown rendering, and IPC communication
 */

// Use the API exposed by preload.js via contextBridge
const { openFile, saveFile, getCurrentFile, setCurrentFile, resizeWindow } = window.electronAPI;

// ==================== Internationalization (i18n) ====================

type LocaleDict = Record<string, string>;

const locales: Record<string, LocaleDict> = {
  en: {
    'app.title': 'MD Editor',
    'app.title.modified': 'MD Editor - Modified',
    'toolbar.new': '📄 New',
    'toolbar.open': '📂 Open',
    'toolbar.save': '💾 Save',
    'toolbar.saveAs': '💾 Save As',
    'toolbar.toggleSource': '{⌨} Source',
    'toolbar.toggleSource.show': '{⌨} Show Source',
    'toolbar.toggleSource.hide': '{⌨} Hide Source',
    'toolbar.toggleLang.en': '🌐 English',
    'toolbar.toggleLang.zh': '🌐 中文',
    'tip.bold': 'Bold (Ctrl+B)',
    'tip.italic': 'Italic (Ctrl+I)',
    'tip.underline': 'Underline (Ctrl+U)',
    'tip.strikethrough': 'Strikethrough',
    'tip.highlight': 'Highlight Text',
    'tip.h1': 'Heading 1',
    'tip.h2': 'Heading 2',
    'tip.h3': 'Heading 3',
    'tip.codeInline': 'Inline Code',
    'tip.codeBlock': 'Code Block',
    'tip.blockquote': 'Blockquote',
    'tip.horizontalRule': 'Horizontal Rule',
    'tip.link': 'Insert Link',
    'tip.image': 'Insert Image',
    'tip.table': 'Insert Table',
    'tip.checkbox': 'Checkbox List',
    'tip.ul': 'Unordered List',
    'tip.ol': 'Ordered List',
    'status.ready': 'Ready',
    'status.opened': 'Opened: ',
    'status.saved': 'Saved: ',
    'status.newFile': 'New file',
    'status.lineCol': 'Line: {line}, Col: {col}',
    'status.words': 'Words: {count}',
    'status.errorOpen': 'Error opening file',
    'status.errorSave': 'Error saving file',
    'editor.placeholder': 'Start typing your Markdown here...',
    'preview.placeholder': 'Click here to edit preview directly...',
    'confirm.unsaved': 'Unsaved changes. Continue anyway?',
    'prompt.url': 'Enter URL:',
    'prompt.alt': 'Enter alt text:',
    'prompt.defaultUrl': 'https://',
    'prompt.defaultAlt': 'image',
    'toolbar.sync': '↻ Sync',
  },
  zh: {
    'app.title': 'MD Editor',
    'app.title.modified': 'MD Editor - 已修改',
    'toolbar.new': '📄 新建',
    'toolbar.open': '📂 打开',
    'toolbar.save': '💾 保存',
    'toolbar.saveAs': '💾 另存为',
    'toolbar.toggleSource': '{⌨} 源码',
    'toolbar.toggleSource.show': '{⌨} 显示源码',
    'toolbar.toggleSource.hide': '{⌨} 隐藏源码',
    'toolbar.toggleLang.en': '🌐 English',
    'toolbar.toggleLang.zh': '🌐 中文',
    'tip.bold': '加粗 (Ctrl+B)',
    'tip.italic': '斜体 (Ctrl+I)',
    'tip.underline': '下划线 (Ctrl+U)',
    'tip.strikethrough': '删除线',
    'tip.highlight': '高亮文本',
    'tip.h1': '一级标题',
    'tip.h2': '二级标题',
    'tip.h3': '三级标题',
    'tip.codeInline': '行内代码',
    'tip.codeBlock': '代码块',
    'tip.blockquote': '引用',
    'tip.horizontalRule': '分割线',
    'tip.link': '插入链接',
    'tip.image': '插入图片',
    'tip.table': '插入表格',
    'tip.checkbox': '复选框列表',
    'tip.ul': '无序列表',
    'tip.ol': '有序列表',
    'status.ready': '就绪',
    'status.opened': '已打开: ',
    'status.saved': '已保存: ',
    'status.newFile': '新文件',
    'status.lineCol': '行: {line}, 列: {col}',
    'status.words': '词数: {count}',
    'status.errorOpen': '打开文件失败',
    'status.errorSave': '保存文件失败',
    'editor.placeholder': '在此输入 Markdown 内容...',
    'preview.placeholder': '点击此处直接编辑预览内容...',
    'confirm.unsaved': '有未保存的修改，是否继续？',
    'prompt.url': '输入网址：',
    'prompt.alt': '输入替代文本：',
    'prompt.defaultUrl': 'https://',
    'prompt.defaultAlt': '图片',
    'toolbar.sync': '↻ 同步',
  },
};

// Current language (default: Chinese)
let currentLang: string = 'zh';

/** Translate a key with optional parameter replacement */
function t(key: string, params?: Record<string, string | number>): string {
  let value = locales[currentLang][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
}

// ==================== DOM Elements ====================

const editor = document.getElementById('editor') as HTMLTextAreaElement;
const preview = document.getElementById('preview') as HTMLDivElement;
const divider = document.getElementById('divider') as HTMLDivElement;
const editorPanel = document.getElementById('editor-panel') as HTMLDivElement;
const previewPanel = document.getElementById('preview-panel') as HTMLDivElement;
const fileStatus = document.getElementById('file-status') as HTMLSpanElement;
const lineCount = document.getElementById('line-count') as HTMLSpanElement;
const wordCount = document.getElementById('word-count') as HTMLSpanElement;

// State
let currentFile: string | null = null;
let isDirty: boolean = false;
let isDarkTheme: boolean = true;
let showSourceEditor: boolean = false;

// Sync control: prevents infinite loops when syncing editor <-> preview
let isSyncing: boolean = false;

// Turndown instance for HTML -> Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  blankReplacement: function (content: string) {
    return content + '\n\n';
  },
});

// Configure turndown to keep basic formatting clean
turndownService.addRule('inlineCode', {
  filter: function (node: Node, test: (tag: string) => boolean) {
    return test('code') && !(node.parentElement && node.parentElement.matches('pre'));
  },
  replacement: function (content: string) {
    return '`' + content + '`';
  },
});

turndownService.addRule('listItem', {
  filter: 'li',
  replacement: function (content: string, node: Node) {
    content = content.replace(/^\n+/, '').replace(/\n+$/, '');
    const prefix = '- ' + (node.firstChild && node.firstChild.nodeName === 'I' ? ' ' : '');
    return prefix + content + '\n';
  },
});

// Apply current language to all UI elements
function applyLanguage(): void {
  // Toolbar buttons
  document.getElementById('new-file')!.textContent = t('toolbar.new');
  document.getElementById('open-file')!.textContent = t('toolbar.open');
  document.getElementById('save-file')!.textContent = t('toolbar.save');
  document.getElementById('save-as-file')!.textContent = t('toolbar.saveAs');

  // Tooltips
  document.getElementById('bold')!.title = t('tip.bold');
  document.getElementById('italic')!.title = t('tip.italic');
  document.getElementById('underline')!.title = t('tip.underline');
  document.getElementById('strikethrough')!.title = t('tip.strikethrough');
  document.getElementById('highlight')!.title = t('tip.highlight');
  document.getElementById('h1')!.title = t('tip.h1');
  document.getElementById('h2')!.title = t('tip.h2');
  document.getElementById('h3')!.title = t('tip.h3');
  document.getElementById('code-inline')!.title = t('tip.codeInline');
  document.getElementById('code-block')!.title = t('tip.codeBlock');
  document.getElementById('blockquote')!.title = t('tip.blockquote');
  document.getElementById('horizontal-rule')!.title = t('tip.horizontalRule');
  document.getElementById('link')!.title = t('tip.link');
  document.getElementById('image')!.title = t('tip.image');
  document.getElementById('table')!.title = t('tip.table');
  document.getElementById('checkbox')!.title = t('tip.checkbox');
  document.getElementById('ul')!.title = t('tip.ul');
  document.getElementById('ol')!.title = t('tip.ol');

  // Editor placeholder
  editor.placeholder = t('editor.placeholder');

  // Language toggle button (show the OTHER language)
  const langBtn = document.getElementById('toggle-lang')!;
  if (currentLang === 'zh') {
    langBtn.textContent = t('toolbar.toggleLang.en');
  } else {
    langBtn.textContent = t('toolbar.toggleLang.zh');
  }

  // Update source editor button if needed
  const srcBtn = document.getElementById('toggle-source')!;
  if (showSourceEditor) {
    srcBtn.textContent = t('toolbar.toggleSource.hide');
  } else {
    srcBtn.textContent = t('toolbar.toggleSource.show');
  }

  // Sync button
  document.getElementById('sync-both')!.textContent = t('toolbar.sync');

  // Update status bar if no file operations pending
  if (!isDirty) {
    fileStatus.textContent = t('status.ready');
  }
}

// Toggle language
function toggleLanguage(): void {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  applyLanguage();
  updateWordCountFromPreview();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  applyLanguage();
  initEditor();
  initPreviewEditor();
  initToolbar();
  initDivider();
  initKeyboardShortcuts();
  updatePreview();
});

// ==================== Editor Functions ====================

function initEditor(): void {
  editor.addEventListener('input', () => {
    if (!isSyncing) {
      isSyncing = true;
      updatePreview();
      markAsDirty();
      updateStatus();
      setTimeout(() => { isSyncing = false; }, 50);
    }
  });

  editor.addEventListener('keyup', updateLineCol);
  editor.addEventListener('click', updateLineCol);

  // Handle tab key
  editor.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 4;
    }
  });
}

// ==================== Editable Preview Functions ====================

let previewIsUserEditing: boolean = false;

function syncPreviewToEditor(): void {
  if (!isSyncing && preview.innerHTML.trim()) {
    isSyncing = true;
    const html = preview.innerHTML;
    const markdown = turndownService.turndown(html);
    editor.value = markdown;
    markAsDirty();
    updateStatus();
    setTimeout(() => { isSyncing = false; }, 50);
  }
}

function updateWordCountFromPreview(): void {
  const text = preview.innerText || preview.textContent || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCount.textContent = t('status.words', { count: words });
}

function initPreviewEditor(): void {
  preview.setAttribute('contenteditable', 'true');

  preview.addEventListener('focus', () => {
    previewIsUserEditing = true;
  });

  preview.addEventListener('blur', () => {
    setTimeout(() => {
      if (!previewIsUserEditing) {
        syncPreviewToEditor();
      }
      previewIsUserEditing = false;
    }, 500);
  });

  // Listen for input changes in preview
  preview.addEventListener('input', () => {
    if (!isSyncing) {
      isSyncing = true;
      markAsDirty();
      updateWordCountFromPreview();
      if (showSourceEditor) {
        editor.value = turndownService.turndown(preview.innerHTML);
        updateLineCol();
      }
      setTimeout(() => { isSyncing = false; }, 50);
    }
  });

  // Listen for mutations in preview (for paste, format operations)
  const mutationObserver = new MutationObserver(() => {
    if (!isSyncing && previewIsUserEditing) {
      isSyncing = true;
      markAsDirty();
      updateWordCountFromPreview();
      if (showSourceEditor) {
        editor.value = turndownService.turndown(preview.innerHTML);
        updateLineCol();
      }
      setTimeout(() => { isSyncing = false; }, 50);
    }
  });

  mutationObserver.observe(preview, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

// Sync editor markdown -> preview HTML
function updatePreview(): void {
  const isUserEditingPreview = previewIsUserEditing && document.activeElement === preview;
  if (!isUserEditingPreview) {
    preview.innerHTML = marked.parse(editor.value);
  }
}

// Sync preview HTML -> editor markdown, then re-render preview
function syncEditorToPreview(): void {
  if (!isSyncing) {
    isSyncing = true;
    preview.innerHTML = marked.parse(editor.value);
    setTimeout(() => { isSyncing = false; }, 50);
  }
}

function markAsDirty(): void {
  isDirty = true;
  document.title = t('app.title.modified');
}

function markAsClean(): void {
  isDirty = false;
  document.title = t('app.title');
}

function updateStatus(): void {
  const text = editor.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCount.textContent = t('status.words', { count: words });
  updateLineCol();
}

function updateLineCol(): void {
  const text = editor.value;
  const pos = editor.selectionStart;
  const lines = text.substring(0, pos).split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  lineCount.textContent = t('status.lineCol', { line, col });
}

// ==================== Helper: apply format via markdown sync ====================

function insertMarkdownAtCursor(mdText: string): void {
  preview.focus();
  const html = marked.parse(mdText);
  document.execCommand('insertHTML', false, html);
  markAsDirty();
  updateWordCountFromPreview();
}

function wrapSelectionWithMarkdown(before: string, after: string): void {
  preview.focus();
  const sel = window.getSelection()!;
  const selectedText = sel.toString();
  if (sel.rangeCount > 0 && !sel.isCollapsed) {
    const md = before + selectedText + after;
    const html = marked.parse(md);
    document.execCommand('insertHTML', false, html);
  } else {
    const md = before + after;
    insertMarkdownAtCursor(md);
  }
  markAsDirty();
  updateWordCountFromPreview();
}

// ==================== Toolbar Functions ====================

function initToolbar(): void {
  // File operations
  document.getElementById('new-file')!.addEventListener('click', createNewFile);
  document.getElementById('open-file')!.addEventListener('click', openFileHandler);
  document.getElementById('save-file')!.addEventListener('click', saveFileHandler);
  document.getElementById('save-as-file')!.addEventListener('click', saveAsFileHandler);

  // Text formatting
  document.getElementById('bold')!.addEventListener('click', () => {
    preview.focus();
    document.execCommand('bold', false);
    markAsDirty(); updateWordCountFromPreview();
  });
  document.getElementById('italic')!.addEventListener('click', () => {
    preview.focus();
    document.execCommand('italic', false);
    markAsDirty(); updateWordCountFromPreview();
  });
  document.getElementById('underline')!.addEventListener('click', () => {
    preview.focus();
    document.execCommand('underline', false);
    markAsDirty(); updateWordCountFromPreview();
  });
  document.getElementById('strikethrough')!.addEventListener('click', () => {
    preview.focus();
    document.execCommand('strikeThrough', false);
    markAsDirty(); updateWordCountFromPreview();
  });
  document.getElementById('highlight')!.addEventListener('click', () => {
    preview.focus();
    document.execCommand('hiliteColor', false, '#ffff00');
    markAsDirty(); updateWordCountFromPreview();
  });

  // Headings
  document.getElementById('h1')!.addEventListener('click', () => applyHeading('h1'));
  document.getElementById('h2')!.addEventListener('click', () => applyHeading('h2'));
  document.getElementById('h3')!.addEventListener('click', () => applyHeading('h3'));

  // Code
  document.getElementById('code-inline')!.addEventListener('click', insertInlineCode);
  document.getElementById('code-block')!.addEventListener('click', insertCodeBlock);
  document.getElementById('blockquote')!.addEventListener('click', insertBlockquote);
  document.getElementById('horizontal-rule')!.addEventListener('click', insertHorizontalRule);

  // Insert elements
  document.getElementById('link')!.addEventListener('click', insertLink);
  document.getElementById('image')!.addEventListener('click', insertImage);
  document.getElementById('table')!.addEventListener('click', insertTable);
  document.getElementById('checkbox')!.addEventListener('click', insertCheckboxList);

  // Lists
  document.getElementById('ul')!.addEventListener('click', () => {
    preview.focus();
    document.execCommand('insertUnorderedList', false);
    markAsDirty(); updateWordCountFromPreview();
  });
  document.getElementById('ol')!.addEventListener('click', () => {
    preview.focus();
    document.execCommand('insertOrderedList', false);
    markAsDirty(); updateWordCountFromPreview();
  });

  // View controls
  document.getElementById('toggle-source')!.addEventListener('click', toggleSourceEditor);
  document.getElementById('sync-both')!.addEventListener('click', syncBoth);
  document.getElementById('toggle-theme')!.addEventListener('click', toggleTheme);
  document.getElementById('toggle-lang')!.addEventListener('click', toggleLanguage);
}

// --- Format functions (operate on preview contenteditable) ---

function applyHeading(tag: string): void {
  preview.focus();
  document.execCommand('formatBlock', false, '<' + tag + '>');
  markAsDirty();
  updateWordCountFromPreview();
}

function insertInlineCode(): void {
  preview.focus();
  const sel = window.getSelection()!;
  const text = sel.toString() || 'code';
  const codeEl = document.createElement('code');
  codeEl.textContent = text;
  document.execCommand('insertHTML', false, codeEl.outerHTML);
  markAsDirty();
  updateWordCountFromPreview();
}

function insertCodeBlock(): void {
  preview.focus();
  const codeHtml = '<pre><code>your code here</code></pre><p><br></p>';
  document.execCommand('insertHTML', false, codeHtml);
  markAsDirty();
  updateWordCountFromPreview();
}

function insertBlockquote(): void {
  preview.focus();
  document.execCommand('formatBlock', false, '<blockquote>');
  markAsDirty();
  updateWordCountFromPreview();
}

function insertHorizontalRule(): void {
  preview.focus();
  document.execCommand('insertHTML', false, '<hr>');
  markAsDirty();
  updateWordCountFromPreview();
}

function insertLink(): void {
  preview.focus();
  const url = prompt(t('prompt.url'), t('prompt.defaultUrl'));
  if (url) {
    document.execCommand('createLink', false, url);
    markAsDirty();
    updateWordCountFromPreview();
  }
}

function insertImage(): void {
  preview.focus();
  const url = prompt(t('prompt.url'), t('prompt.defaultUrl'));
  if (url) {
    const alt = prompt(t('prompt.alt'), t('prompt.defaultAlt'));
    const imgHtml = `<img src="${url}" alt="${alt || t('prompt.defaultAlt')}">`;
    document.execCommand('insertHTML', false, imgHtml);
    markAsDirty();
    updateWordCountFromPreview();
  }
}

function insertTable(): void {
  preview.focus();
  const tableHtml = '<table><thead><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td><td>Cell 3</td></tr><tr><td>Cell 4</td><td>Cell 5</td><td>Cell 6</td></tr></tbody></table><p><br></p>';
  document.execCommand('insertHTML', false, tableHtml);
  markAsDirty();
  updateWordCountFromPreview();
}

function insertCheckboxList(): void {
  preview.focus();
  const checkboxHtml = '<div><input type="checkbox" disabled> Task 1</div><div><input type="checkbox" disabled> Task 2</div><div><input type="checkbox" disabled> Task 3</div><p><br></p>';
  document.execCommand('insertHTML', false, checkboxHtml);
  markAsDirty();
  updateWordCountFromPreview();
}

// ==================== File Operations ====================

async function createNewFile(): Promise<void> {
  if (isDirty && (editor.value.trim() || preview.innerHTML.trim())) {
    const shouldContinue = confirm(t('confirm.unsaved'));
    if (!shouldContinue) return;
  }

  syncPreviewToEditor();

  editor.value = '';
  preview.innerHTML = '';
  currentFile = null;
  markAsClean();
  fileStatus.textContent = t('status.newFile');
  updatePreview();
  updateStatus();
  updateWordCountFromPreview();
}

async function openFileHandler(): Promise<void> {
  try {
    const result = await openFile();
    if (result && result.content !== undefined) {
      editor.value = result.content;
      currentFile = result.filePath;
      markAsClean();
      fileStatus.textContent = t('status.opened') + result.filePath;
      updatePreview();
      updateStatus();
    }
  } catch (error) {
    console.error('Error opening file:', error);
    fileStatus.textContent = t('status.errorOpen');
  }
}

async function saveFileHandler(): Promise<void> {
  if (currentFile) {
    await saveToFile(currentFile);
  } else {
    await saveAsFileHandler();
  }
}

async function saveAsFileHandler(): Promise<void> {
  try {
    const result = await saveFile(editor.value, null);
    if (result && result.success) {
      currentFile = result.filePath!;
      markAsClean();
      fileStatus.textContent = t('status.saved') + result.filePath;
    }
  } catch (error) {
    console.error('Error saving file:', error);
    fileStatus.textContent = t('status.errorSave');
  }
}

async function saveToFile(filePath: string): Promise<void> {
  try {
    const result = await saveFile(editor.value, filePath);
    if (result && result.success) {
      markAsClean();
      fileStatus.textContent = t('status.saved') + filePath;
    }
  } catch (error) {
    console.error('Error saving file:', error);
    fileStatus.textContent = t('status.errorSave');
  }
}

// ==================== View Controls ====================

function syncBoth(): void {
  if (!isSyncing) {
    isSyncing = true;
    const inPreview = document.activeElement === preview;
    if (inPreview) {
      editor.value = turndownService.turndown(preview.innerHTML);
      updateLineCol();
    }
    preview.innerHTML = marked.parse(editor.value);
    markAsDirty();
    updateWordCountFromPreview();
    setTimeout(() => { isSyncing = false; }, 50);
  }
}

function toggleTheme(): void {
  isDarkTheme = !isDarkTheme;
  document.body.className = isDarkTheme ? 'dark-theme' : 'light-theme';
  document.getElementById('toggle-theme')!.textContent = isDarkTheme ? '🌙' : '☀️';
}

function toggleSourceEditor(): void {
  showSourceEditor = !showSourceEditor;
  const btn = document.getElementById('toggle-source')!;

  if (showSourceEditor) {
    editorPanel.classList.add('visible');
    divider.classList.add('visible');
    btn.textContent = t('toolbar.toggleSource.hide');
    syncPreviewToEditor();
    resizeWindow(1400, 900);
  } else {
    syncPreviewToEditor();
    editorPanel.classList.remove('visible');
    divider.classList.remove('visible');
    btn.textContent = t('toolbar.toggleSource.show');
    resizeWindow(800, 900);
  }
}

function initDivider(): void {
  let isDragging: boolean = false;

  divider.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;

    const container = document.querySelector('.main-content') as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const newEditorWidth = e.clientX - containerRect.left;
    const totalWidth = containerRect.width - 4; // minus divider width

    const editorPercent = (newEditorWidth / totalWidth) * 100;
    const previewPercent = 100 - editorPercent;

    if (editorPercent > 20 && editorPercent < 80) {
      editorPanel.style.flex = `${editorPercent}`;
      previewPanel.style.flex = `${previewPercent}`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = '';
  });
}

// ==================== Keyboard Shortcuts ====================

function initKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ctrl+S / Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      syncPreviewToEditor();
      saveFileHandler();
    }

    // Ctrl+Shift+S / Cmd+Shift+S
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      syncPreviewToEditor();
      saveAsFileHandler();
    }

    // Ctrl+O / Cmd+O
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      openFileHandler();
    }

    // Ctrl+N / Cmd+N
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewFile();
    }

    // Ctrl+\ to toggle source editor
    if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
      e.preventDefault();
      toggleSourceEditor();
    }
  });
}

// Warn before closing with unsaved changes
window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
