const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  getGeminiSettings: () => ipcRenderer.invoke('get-gemini-settings')
});

console.log('Preload script loaded');

