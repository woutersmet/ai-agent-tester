const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  expandPath: (filePath) => ipcRenderer.invoke('expand-path', filePath),
  getGeminiSettings: () => ipcRenderer.invoke('get-gemini-settings'),
  getClaudeSettings: () => ipcRenderer.invoke('get-claude-settings'),
  getChatGPTSettings: () => ipcRenderer.invoke('get-chatgpt-settings'),
  checkClaudeVersion: () => ipcRenderer.invoke('check-claude-version'),
  checkGeminiVersion: () => ipcRenderer.invoke('check-gemini-version'),
  checkCodexVersion: () => ipcRenderer.invoke('check-codex-version'),
  checkChatGPTVersion: () => ipcRenderer.invoke('check-chatgpt-version'),
  startMcpServer: () => ipcRenderer.invoke('start-mcp-server'),
  stopMcpServer: () => ipcRenderer.invoke('stop-mcp-server'),
  getMcpServerStatus: () => ipcRenderer.invoke('get-mcp-server-status'),
  onNewSession: (callback) => ipcRenderer.on('new-session', callback)
});

console.log('Preload script loaded');

