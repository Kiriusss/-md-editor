const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentFilePath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1e1e2e',
    show: false,
    frame: true,
    titleBarStyle: 'default'
  });

  mainWindow.loadFile('index.html');
  mainWindow.show();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// File operations via IPC
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    currentFilePath = filePath;
    return { content, filePath };
  }
  return null;
});

ipcMain.handle('save-file', async (event, { content, filePath }) => {
  if (filePath) {
    fs.writeFileSync(filePath, content, 'utf-8');
    currentFilePath = filePath;
    return { success: true, filePath };
  } else {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: 'untitled.md'
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      currentFilePath = result.filePath;
      return { success: true, filePath: result.filePath };
    }
  }
  return { success: false };
});

ipcMain.handle('get-current-file', () => {
  return currentFilePath;
});

ipcMain.handle('set-current-file', (event, filePath) => {
  currentFilePath = filePath;
  return { success: true };
});