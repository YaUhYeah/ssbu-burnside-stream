const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Dialogs
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Menu events
  onNewProject: (callback) => ipcRenderer.on('menu-new-project', callback),
  onOpenProject: (callback) => ipcRenderer.on('menu-open-project', callback),
  onSaveProject: (callback) => ipcRenderer.on('menu-save-project', callback),
  onExport: (callback) => ipcRenderer.on('menu-export', callback),
  onUndo: (callback) => ipcRenderer.on('menu-undo', callback),
  onRedo: (callback) => ipcRenderer.on('menu-redo', callback),
  onSettings: (callback) => ipcRenderer.on('menu-settings', callback),

  // File system
  platform: process.platform,
});
