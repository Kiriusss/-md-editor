const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (content, filePath) => ipcRenderer.invoke('save-file', { content, filePath }),
  getCurrentFile: () => ipcRenderer.invoke('get-current-file'),
  setCurrentFile: (filePath) => ipcRenderer.invoke('set-current-file', filePath)
});