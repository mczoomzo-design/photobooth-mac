const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 900,
    minWidth: 380,
    minHeight: 720,
    title: 'Photo Booth',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Grant camera/media to the renderer so getUserMedia works with the Canon device.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(permission === 'media' || permission === 'camera' || permission === 'microphone');
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

/* ---- save a base64 PNG to disk (defaults to ~/Pictures/PhotoBooth) ---- */
ipcMain.handle('save-image', async (_e, dataUrl, name) => {
  const dir = path.join(os.homedir(), 'Pictures', 'PhotoBooth');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  const res = await dialog.showSaveDialog(win, {
    title: 'บันทึกรูป',
    defaultPath: path.join(dir, name || 'photobooth.png'),
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  const b64 = String(dataUrl).split(',')[1] || '';
  fs.writeFileSync(res.filePath, Buffer.from(b64, 'base64'));
  return { ok: true, path: res.filePath };
});

/* ---- print a base64 PNG through the macOS system print dialog ---- */
ipcMain.handle('print-image', async (_e, dataUrl) => {
  // Write the slip PNG + a tiny wrapper HTML to a temp dir, then print the file
  // (avoids stuffing a multi-MB data: URL through loadURL).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pbprint-'));
  const pngPath = path.join(tmp, 'slip.png');
  const htmlPath = path.join(tmp, 'print.html');
  const b64 = String(dataUrl).split(',')[1] || '';
  fs.writeFileSync(pngPath, Buffer.from(b64, 'base64'));
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '@page{margin:0}html,body{margin:0;padding:0}' +
    'img{display:block;width:80mm;height:auto}' +            // 80mm receipt width
    '</style></head><body><img src="slip.png"></body></html>';
  fs.writeFileSync(htmlPath, html);

  return await new Promise(resolve => {
    const pw = new BrowserWindow({ show: false });
    pw.loadFile(htmlPath);
    const cleanup = () => { try { pw.close(); } catch (e) {} try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} };
    pw.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        pw.webContents.print({ silent: false, printBackground: true, margins: { marginType: 'none' } },
          (success, reason) => { cleanup(); resolve({ ok: success, reason }); });
      }, 250);
    });
    pw.webContents.once('did-fail-load', () => { cleanup(); resolve({ ok: false }); });
  });
});
