const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  sendProgressUpdate: (progress) =>
    ipcRenderer.send('update-progress', progress),
  onCategoryUpdate: (callback) =>
    ipcRenderer.on('category-update', (_, category) => callback(category)),
});
