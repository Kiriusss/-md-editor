import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Suppress libpng iCCP sRGB warnings from Chromium
const stderrWrite = process.stderr.write.bind(process.stderr);
(process.stderr.write as unknown) = (chunk: string | Uint8Array, encoding?: any, cb?: any): boolean => {
  if (typeof chunk === 'string' && chunk.includes('iCCP')) return true;
  return stderrWrite(chunk, encoding, cb);
};

let mainWindow: BrowserWindow | null = null;
let currentFilePath: string | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#1e1e2e',
    show: false,
    frame: true,
    titleBarStyle: 'default',
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.show();
}


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

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    currentFilePath = filePath;
    return { content, filePath };
  }
  return null;
});

ipcMain.handle('save-file', async (_event, { content, filePath }: { content: string; filePath: string | null }) => {
  if (filePath) {
    fs.writeFileSync(filePath, content, 'utf-8');
    currentFilePath = filePath;
    return { success: true, filePath };
  } else {
    const result = await dialog.showSaveDialog(mainWindow!, {
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: 'untitled.md',
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

ipcMain.handle('set-current-file', (_event, filePath: string) => {
  currentFilePath = filePath;
  return { success: true };
});

ipcMain.handle('resize-window', (_event, { width, height }: { width: number; height: number }) => {
  if (mainWindow) {
    mainWindow.setSize(width, height);
    mainWindow.center();
  }
});

ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }
    ],
    properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// --- Word-style close confirmation ---

let closeHandlerAttached = false;

function attachCloseHandler(): void {
  if (closeHandlerAttached || !mainWindow) return;
  closeHandlerAttached = true;

  mainWindow.on('close', async (event) => {
    // Check dirty flag exposed on window by renderer
    const isDirty = await mainWindow!.webContents.executeJavaScript('window.__isDirty');
    if (isDirty) {
      event.preventDefault();
      const result = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        buttons: ['保存', '不保存', '取消'],
        message: '是否保存对文档的更改？',
        detail: '如果不保存，所有更改将丢失。',
      });
      if (result.response === 0) {
        // Save — editor is authoritative, just save
        await mainWindow!.webContents.executeJavaScript(`
          (async () => {
            await saveFileHandler();
          })();
        `);
        // Allow save to complete
        await new Promise(r => setTimeout(r, 1500));
        mainWindow!.close();
      } else if (result.response === 1) {
        mainWindow!.close();
      }
    }
  });
}

// Attach after window is ready
app.whenReady().then(() => {
  createWindow();
  setTimeout(attachCloseHandler, 500); // ensure window is fully created
});
