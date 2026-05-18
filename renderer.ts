/**
 * MD Editor - Renderer Process
 * Architecture:
 *   - Left panel (editor textarea): all editing & formatting happens here
 *   - Right panel (preview div): read-only Markdown rendering
 *   - Default layout: dual-pane (both visible side-by-side)
 */

const { openFile, saveFile, getCurrentFile, setCurrentFile, resizeWindow, selectImage } = window.electronAPI;

// ==================== i18n ====================

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
    'confirm.unsaved': '有未保存的修改，是否继续？',
    'prompt.url': '输入网址：',
    'prompt.alt': '输入替代文本：',
    'prompt.defaultUrl': 'https://',
    'prompt.defaultAlt': '图片',
    'toolbar.sync': '↻ 同步',
  },
};

let currentLang: string = 'zh';

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

// ==================== State ====================

let currentFile: string | null = null;
let isDirty: boolean = false;
let isDarkTheme: boolean = true;
let showSourceEditor: boolean = true;

window.__isDirty = false;

// Sync guard: prevent editor input handler from re-rendering during programmatic updates
let isSyncing: boolean = false;

function beginSync(): boolean {
  if (isSyncing) return false;
  isSyncing = true;
  return true;
}

function endSync(): void {
  isSyncing = false;
}

// ==================== Language ====================

function applyLanguage(): void {
  document.getElementById('new-file')!.textContent = t('toolbar.new');
  document.getElementById('open-file')!.textContent = t('toolbar.open');
  document.getElementById('save-file')!.textContent = t('toolbar.save');
  document.getElementById('save-as-file')!.textContent = t('toolbar.saveAs');

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

  editor.placeholder = t('editor.placeholder');

  const langBtn = document.getElementById('toggle-lang')!;
  langBtn.textContent = currentLang === 'zh' ? t('toolbar.toggleLang.en') : t('toolbar.toggleLang.zh');

  const srcBtn = document.getElementById('toggle-source')!;
  srcBtn.textContent = showSourceEditor ? t('toolbar.toggleSource.hide') : t('toolbar.toggleSource.show');

  document.getElementById('sync-both')!.textContent = t('toolbar.sync');

  if (!isDirty) fileStatus.textContent = t('status.ready');
}

function toggleLanguage(): void {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  applyLanguage();
  updateWordCount();
}

// ==================== Editor ====================

function initEditor(): void {
  editor.addEventListener('input', () => {
    if (isSyncing) return;
    updatePreview();
    markAsDirty();
    updateStatus();
  });

  editor.addEventListener('keyup', updateLineCol);
  editor.addEventListener('click', updateLineCol);

  // Tab key inserts 4 spaces
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

// ==================== Preview (read-only rendering) ====================

/**
 * Configure Marked to track source line numbers via data-sourcepos attribute.
 * Each rendered block gets a data-sourcepos attribute like "1-3" (startLine-endLine).
 * We use this to implement double-click-to-jump.
 */
// Marked 4.x+ supports marked.use() with sourcePos option for line tracking
// We cast to any because the TypeScript types may not include this option
(marked as any).use?.({ sourcePos: true });

function updatePreview(): void {
  preview.innerHTML = marked.parse(editor.value) as string;
}

/**
 * Find the nearest ancestor element that has a data-sourcepos attribute.
 * Returns the starting line number (1-based) or null.
 */
function getSourceLineFromElement(target: EventTarget | null): number | null {
  let current: Node | null = target as Node | null;
  while (current && current !== preview) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const sourcepos = (current as Element).getAttribute('data-sourcepos');
      if (sourcepos) {
        const startLine = parseInt(sourcepos.split('-')[0], 10);
        if (!isNaN(startLine)) return startLine;
      }
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Jump the editor cursor to a specific line number and briefly highlight the line.
 */
function jumpToSourceLine(lineNumber: number): void {
  const text = editor.value;
  const lines = text.split('\n');

  // Clamp to valid range
  lineNumber = Math.max(1, Math.min(lineNumber, lines.length));

  // Calculate character offset for the start of the target line
  let offset = 0;
  for (let i = 0; i < lineNumber - 1; i++) {
    offset += lines[i].length + 1; // +1 for the newline character
  }

  // Set cursor position and select the entire line
  editor.focus();
  editor.selectionStart = offset;
  editor.selectionEnd = offset + lines[lineNumber - 1].length;

  // Scroll editor to show the line
  // Estimate line height and scroll to the target line
  const lineHeight = 24; // approximate px per line (matches font-size 15px * line-height 1.6)
  const editorScrollTop = editor.scrollTop;
  const visibleLines = Math.floor(editor.clientHeight / lineHeight);

  // Calculate which "visible line" the target corresponds to
  const textLinesAbove = text.substring(0, offset).split('\n').length;
  const targetScrollPos = Math.max(0, (textLinesAbove - Math.floor(visibleLines / 2)) * lineHeight);

  editor.scrollTop = targetScrollPos;

  // Ensure editor panel is visible
  if (!editorPanel.classList.contains('visible')) {
    editorPanel.classList.add('visible');
    divider.classList.add('visible');
  }

  // Brief visual flash on the editor to draw attention
  editor.style.boxShadow = '0 0 0 3px #007acc';
  setTimeout(() => {
    editor.style.boxShadow = '';
  }, 600);
}

/**
 * Handle double-click on preview: jump to corresponding source line.
 */
function handlePreviewDoubleClick(e: MouseEvent): void {
  const target = e.target;
  const line = getSourceLineFromElement(target);
  if (line !== null) {
    jumpToSourceLine(line);
  }
}

// ==================== Dirty / Status ====================

function markAsDirty(): void {
  isDirty = true;
  window.__isDirty = true;
  document.title = t('app.title.modified');
}

function markAsClean(): void {
  isDirty = false;
  window.__isDirty = false;
  document.title = t('app.title');
}

function updateStatus(): void {
  updateWordCount();
  updateLineCol();
}

function updateWordCount(): void {
  const text = editor.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCount.textContent = t('status.words', { count: words });
}

function updateLineCol(): void {
  const text = editor.value;
  const pos = editor.selectionStart;
  const lines = text.substring(0, pos).split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  lineCount.textContent = t('status.lineCol', { line, col });
}

// ==================== Editor Helpers ====================

/** Wrap the current selection with before/after strings. */
function wrapSelection(before: string, after: string): void {
  editor.focus();
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.substring(start, end);
  const replacement = before + selected + after;
  editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end);
  editor.selectionStart = start + before.length;
  editor.selectionEnd = start + before.length + selected.length;
  // Fire input event to update preview
  if (!beginSync()) return;
  try {
    editor.dispatchEvent(new Event('input'));
  } finally {
    endSync();
  }
}

/** Insert text at cursor position. */
function insertAtCursor(text: string): void {
  editor.focus();
  const start = editor.selectionStart;
  editor.value = editor.value.substring(0, start) + text + editor.value.substring(editor.selectionEnd);
  editor.selectionStart = editor.selectionEnd = start + text.length;
  if (!beginSync()) return;
  try {
    editor.dispatchEvent(new Event('input'));
  } finally {
    endSync();
  }
}

/** Insert a heading prefix at the start of the current line. */
function insertHeading(prefix: string): void {
  editor.focus();
  const pos = editor.selectionStart;
  const lineStart = editor.value.lastIndexOf('\n', pos - 2) + 1;
  editor.value = editor.value.substring(0, lineStart) + prefix + editor.value.substring(lineStart);
  editor.selectionStart = editor.selectionEnd = pos + prefix.length;
  if (!beginSync()) return;
  try {
    editor.dispatchEvent(new Event('input'));
  } finally {
    endSync();
  }
}

function insertLinkMd(): void {
  // Insert link template at cursor, select the text label for easy editing
  editor.focus();
  const start = editor.selectionStart;
  const template = '[link text](https://)';
  editor.value = editor.value.substring(0, start) + template + editor.value.substring(editor.selectionEnd);
  // Select "link text" so user can immediately type to replace it
  editor.selectionStart = start + 1;
  editor.selectionEnd = start + 9;
  if (!beginSync()) return;
  try {
    editor.dispatchEvent(new Event('input'));
  } finally {
    endSync();
  }
}

async function insertImageMd(): Promise<void> {
  // Open file dialog to select a local image
  const imagePath = await selectImage();
  if (!imagePath) return;

  editor.focus();
  const start = editor.selectionStart;
  // Use relative path if image is in the same directory as current file, otherwise use absolute path
  const altText = imagePath.split(pathSep).pop() || 'image';
  const template = `![${altText}](${imagePath})`;
  editor.value = editor.value.substring(0, start) + template + editor.value.substring(editor.selectionEnd);
  editor.selectionStart = editor.selectionEnd = start + template.length;
  if (!beginSync()) return;
  try {
    editor.dispatchEvent(new Event('input'));
  } finally {
    endSync();
  }
}

const pathSep = navigator.platform.includes('Win') ? '\\' : '/';

function insertTableMd(): void {
  insertAtCursor(`| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`);
}

function insertCheckboxMd(): void {
  insertAtCursor(`- [ ] Task 1
- [ ] Task 2
- [ ] Task 3`);
}

// ==================== Toolbar ====================

function initToolbar(): void {
  document.getElementById('new-file')!.addEventListener('click', createNewFile);
  document.getElementById('open-file')!.addEventListener('click', openFileHandler);
  document.getElementById('save-file')!.addEventListener('click', saveFileHandler);
  document.getElementById('save-as-file')!.addEventListener('click', saveAsFileHandler);

  // Formatting — always operates on the editor
  document.getElementById('bold')!.addEventListener('click', () => wrapSelection('**', '**'));
  document.getElementById('italic')!.addEventListener('click', () => wrapSelection('*', '*'));
  document.getElementById('underline')!.addEventListener('click', () => wrapSelection('<u>', '</u>'));
  document.getElementById('strikethrough')!.addEventListener('click', () => wrapSelection('~~', '~~'));
  document.getElementById('highlight')!.addEventListener('click', () => wrapSelection('<mark>', '</mark>'));

  document.getElementById('h1')!.addEventListener('click', () => insertHeading('# '));
  document.getElementById('h2')!.addEventListener('click', () => insertHeading('## '));
  document.getElementById('h3')!.addEventListener('click', () => insertHeading('### '));

  document.getElementById('code-inline')!.addEventListener('click', () => wrapSelection('`', '`'));
  document.getElementById('code-block')!.addEventListener('click', () => insertAtCursor('```\nyour code here\n```'));
  document.getElementById('blockquote')!.addEventListener('click', () => insertAtCursor('> '));
  document.getElementById('horizontal-rule')!.addEventListener('click', () => insertAtCursor('\n---\n'));

  document.getElementById('link')!.addEventListener('click', () => insertLinkMd());
  document.getElementById('image')!.addEventListener('click', () => insertImageMd());
  document.getElementById('table')!.addEventListener('click', () => insertTableMd());
  document.getElementById('checkbox')!.addEventListener('click', () => insertCheckboxMd());

  document.getElementById('ul')!.addEventListener('click', () => insertAtCursor('\n- item\n'));
  document.getElementById('ol')!.addEventListener('click', () => insertAtCursor('\n1. item\n'));

  document.getElementById('toggle-source')!.addEventListener('click', toggleSourceEditor);
  document.getElementById('sync-both')!.addEventListener('click', updatePreview);
  document.getElementById('toggle-theme')!.addEventListener('click', toggleTheme);
  document.getElementById('toggle-lang')!.addEventListener('click', toggleLanguage);
}

// ==================== File Operations ====================

async function createNewFile(): Promise<void> {
  if (isDirty && editor.value.trim()) {
    if (!confirm(t('confirm.unsaved'))) return;
  }
  editor.value = '';
  preview.innerHTML = '';
  currentFile = null;
  markAsClean();
  fileStatus.textContent = t('status.newFile');
  updatePreview();
  updateStatus();
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
    resizeWindow(1400, 900);
  } else {
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
    const totalWidth = containerRect.width - 4;

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
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveFileHandler();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      saveAsFileHandler();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      openFileHandler();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
      e.preventDefault();
      toggleSourceEditor();
    }
  });
}

// ==================== Expose for main process ====================

window.saveFileHandler = saveFileHandler;

// ==================== Initialize ====================

document.addEventListener('DOMContentLoaded', () => {
  applyLanguage();
  initEditor();
  initToolbar();
  initDivider();
  initKeyboardShortcuts();

  // Double-click preview to jump to source
  preview.addEventListener('dblclick', handlePreviewDoubleClick);

  // Default dual-pane: show editor + preview side by side
  editorPanel.classList.add('visible');
  divider.classList.add('visible');

  updatePreview();
});
