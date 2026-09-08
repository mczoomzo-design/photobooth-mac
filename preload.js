const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  saveImage: (dataUrl, name) => ipcRenderer.invoke('save-image', dataUrl, name),
  printImage: (dataUrl) => ipcRenderer.invoke('print-image', dataUrl)
});
