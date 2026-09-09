const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  saveImage: (dataUrl, name) => ipcRenderer.invoke('save-image', dataUrl, name),
  printImage: (dataUrl) => ipcRenderer.invoke('print-image', dataUrl),
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  btPrint: (devPath, bytes) => ipcRenderer.invoke('bt-print', devPath, bytes)
});
