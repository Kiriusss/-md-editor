// Type declarations for CDN-loaded libraries

declare const marked: {
  parse(markdown: string): string;
};

declare class TurndownService {
  constructor(options?: Record<string, unknown>);
  turndown(html: string): string;
  addRule(name: string, rule: Record<string, unknown>): void;
}

// Preload API exposed via contextBridge
interface FileResult {
  content: string;
  filePath: string;
}

interface SaveResult {
  success: boolean;
  filePath?: string;
}

interface ElectronAPI {
  openFile: () => Promise<FileResult | null>;
  saveFile: (content: string, filePath: string | null) => Promise<SaveResult>;
  getCurrentFile: () => Promise<string | null>;
  setCurrentFile: (filePath: string) => Promise<{ success: boolean }>;
  resizeWindow: (width: number, height: number) => Promise<void>;
}

interface Window {
  electronAPI: ElectronAPI;
  __isDirty: boolean;
  syncPreviewToEditor: () => void;
  saveFileHandler: () => Promise<void>;
}
