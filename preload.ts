import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (content: string, filePath: string | null) => ipcRenderer.invoke('save-file', { content, filePath }),
  getCurrentFile: () => ipcRenderer.invoke('get-current-file'),
  setCurrentFile: (filePath: string) => ipcRenderer.invoke('set-current-file', filePath),
  resizeWindow: (width: number, height: number) => ipcRenderer.invoke('resize-window', { width, height }),
  checkDirty: () => ipcRenderer.invoke('check-dirty'),
  requestSave: () => ipcRenderer.invoke('request-save'),
});