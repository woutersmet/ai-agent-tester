const { app, BrowserWindow, ipcMain, nativeImage, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn, exec } = require('child_process');
const expressApp = require('./server/app');

// Detect if running in development mode (must be done early, before app is ready)
const isDev = !app.isPackaged || process.argv.includes('--dev');
const appTitle = isDev ? 'AI Agent Tester (Dev)' : 'AI Agent Tester';

// Override the app name BEFORE app is ready (critical for macOS menu bar)
app.name = appTitle;

// Set app name for macOS - must be done before app is ready
if (process.platform === 'darwin') {
  // Force set the name multiple times to ensure it sticks
  app.setName(appTitle);
}

// Set dock icon for macOS
if (process.platform === 'darwin') {
  const iconPath = path.join(__dirname, 'ai_agent_tester_icon_2.png');
  const icon = nativeImage.createFromPath(iconPath);
  app.dock.setIcon(icon);
}

let mainWindow;
let server;
let PORT = 3000; // Will be updated if port is in use

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: appTitle,
    titleBarStyle: 'hiddenInset', // macOS style
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, 'ai_agent_tester_icon_2.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false // Don't show window until it's ready
  });

  mainWindow.loadFile('renderer/index.html');

  // Open external links in the default browser and handle vscode:// protocol
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    if (url.startsWith('vscode://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Show window when ready to prevent white flash and ensure server is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // DevTools can be toggled with View > Toggle Developer Tools in the menu
  // or by pressing Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows/Linux)

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const server = net.createServer();

    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try next port
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

function startExpressServer() {
  return new Promise(async (resolve, reject) => {
    try {
      // Find an available port starting from 3000
      PORT = await findAvailablePort(PORT);
      console.log(`🔍 Using port ${PORT}`);

      server = expressApp.listen(PORT, () => {
        console.log(`✅ Express server running on http://localhost:${PORT}`);
        resolve();
      });

      server.on('error', (error) => {
        console.error(`❌ Server error:`, error);
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: appTitle,
      submenu: [
        { role: 'about', label: `About ${appTitle}` },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: `Hide ${appTitle}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: `Quit ${appTitle}` }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            console.log('📝 Creating new session via Cmd+N...');
            if (mainWindow) {
              mainWindow.webContents.send('new-session');
            }
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Restart App',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            console.log('🔄 Restarting app via Cmd+R...');
            app.relaunch();
            app.exit(0);
          }
        },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Force set app name again when ready (ensures it's applied)
    if (process.platform === 'darwin') {
      app.setName(appTitle);
      app.dock.setBadge(''); // Refresh dock
    }

    // Log app mode
    console.log(`🚀 Starting ${appTitle}${isDev ? ' in DEVELOPMENT mode' : ''}`);

    // Set user data path for session storage
    const userDataPath = app.getPath('userData');
    process.env.USER_DATA_PATH = userDataPath;
    console.log(`📁 User data path: ${userDataPath}`);

    // Start Express server and wait for it to be fully ready
    await startExpressServer();

    // Give the server a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    createMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (server) {
    server.close(() => {
      console.log('Express server closed');
    });
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

// IPC handlers (optional - for direct main process communication)
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('restart-app', () => {
  console.log('🔄 Restarting app...');
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('expand-path', (_event, filePath) => {
  // Expand tilde to home directory
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
});

ipcMain.handle('get-gemini-settings', async () => {
  try {
    const homeDir = os.homedir();
    const geminiSettingsPath = path.join(homeDir, '.gemini', 'settings.json');

    // Check if file exists
    try {
      await fs.access(geminiSettingsPath);
    } catch (error) {
      // File doesn't exist
      return { found: false };
    }

    // Read and parse the file
    const fileContent = await fs.readFile(geminiSettingsPath, 'utf-8');
    const settings = JSON.parse(fileContent);

    return { found: true, settings };
  } catch (error) {
    console.error('Error reading Gemini settings:', error);
    return { found: false, error: error.message };
  }
});

ipcMain.handle('get-claude-settings', async () => {
  try {
    const homeDir = os.homedir();
    const claudeSettingsPath = path.join(homeDir, '.claude.json');

    // Check if file exists
    try {
      await fs.access(claudeSettingsPath);
    } catch (error) {
      // File doesn't exist
      return { found: false };
    }

    // Read and parse the file
    const fileContent = await fs.readFile(claudeSettingsPath, 'utf-8');
    const settings = JSON.parse(fileContent);

    return { found: true, settings };
  } catch (error) {
    console.error('Error reading Claude settings:', error);
    return { found: false, error: error.message };
  }
});

ipcMain.handle('get-chatgpt-settings', async () => {
  try {
    const homeDir = os.homedir();
    const chatgptSettingsPath = path.join(homeDir, '.codex', 'config.toml');

    // Check if file exists
    try {
      await fs.access(chatgptSettingsPath);
    } catch (error) {
      // File doesn't exist
      return { found: false };
    }

    // Read the TOML file (return as plain text since we don't have a TOML parser)
    const fileContent = await fs.readFile(chatgptSettingsPath, 'utf-8');

    return { found: true, settings: fileContent, isToml: true };
  } catch (error) {
    console.error('Error reading ChatGPT Codex settings:', error);
    return { found: false, error: error.message };
  }
});

// CLI Version Checks
function execCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout) => {
      if (error) {
        resolve({ installed: false, version: null, error: error.message });
      } else {
        resolve({ installed: true, version: stdout.trim(), error: null });
      }
    });
  });
}

ipcMain.handle('check-claude-version', async () => {
  return await execCommand('claude --version');
});

ipcMain.handle('check-gemini-version', async () => {
  return await execCommand('gemini --version');
});

ipcMain.handle('check-codex-version', async () => {
  return await execCommand('codex --version');
});

ipcMain.handle('check-chatgpt-version', async () => {
  return await execCommand('chatgpt --version');
});

// MCP Server Management
let mcpServerProcess = null;

// Start the Famous Quotes MCP Server (standalone version - no dependencies needed)
ipcMain.handle('start-mcp-server', async () => {
  try {
    if (mcpServerProcess) {
      return { success: false, error: 'MCP server is already running' };
    }

    // Use the root level standalone version that has no dependencies
    const mcpServerPath = path.join(__dirname, 'famous-quotes-mcp-server.js');
    const mcpServerDir = __dirname;

    // Check if the server file exists
    try {
      await fs.access(mcpServerPath);
    } catch (error) {
      return { success: false, error: 'MCP server file not found' };
    }

    // Start the MCP server process
    mcpServerProcess = spawn('node', [mcpServerPath], {
      cwd: mcpServerDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverOutput = '';
    let serverError = '';

    mcpServerProcess.stdout.on('data', (data) => {
      serverOutput += data.toString();
      console.log('[MCP Server]:', data.toString());
    });

    mcpServerProcess.stderr.on('data', (data) => {
      serverError += data.toString();
      console.error('[MCP Server Error]:', data.toString());
    });

    mcpServerProcess.on('close', (code) => {
      console.log(`[MCP Server] Process exited with code ${code}`);
      mcpServerProcess = null;
    });

    mcpServerProcess.on('error', (error) => {
      console.error('[MCP Server] Failed to start:', error);
      mcpServerProcess = null;
    });

    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (mcpServerProcess && !mcpServerProcess.killed) {
      // Get the absolute path for configuration
      const absolutePath = mcpServerPath;

      return {
        success: true,
        message: 'MCP server started successfully',
        path: absolutePath,
        pid: mcpServerProcess.pid
      };
    } else {
      return { success: false, error: 'MCP server failed to start', stderr: serverError };
    }
  } catch (error) {
    console.error('Error starting MCP server:', error);
    return { success: false, error: error.message };
  }
});

// Stop the Famous Quotes MCP Server
ipcMain.handle('stop-mcp-server', async () => {
  try {
    if (!mcpServerProcess) {
      return { success: false, error: 'MCP server is not running' };
    }

    mcpServerProcess.kill('SIGTERM');

    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 500));

    // Force kill if still running
    if (mcpServerProcess && !mcpServerProcess.killed) {
      mcpServerProcess.kill('SIGKILL');
    }

    mcpServerProcess = null;

    return { success: true, message: 'MCP server stopped successfully' };
  } catch (error) {
    console.error('Error stopping MCP server:', error);
    return { success: false, error: error.message };
  }
});

// Get MCP Server status
ipcMain.handle('get-mcp-server-status', async () => {
  const isRunning = mcpServerProcess !== null && !mcpServerProcess.killed;

  if (isRunning) {
    const mcpServerPath = path.join(__dirname, 'famous-quotes-mcp-server.js');
    return {
      running: true,
      pid: mcpServerProcess.pid,
      path: mcpServerPath
    };
  } else {
    return {
      running: false
    };
  }
});

