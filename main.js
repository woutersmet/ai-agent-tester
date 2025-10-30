const { app, BrowserWindow, ipcMain, nativeImage, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
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
const PORT = 3000;

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

function startExpressServer() {
  return new Promise((resolve, reject) => {
    server = expressApp.listen(PORT, () => {
      console.log(`✅ Express server running on http://localhost:${PORT}`);
      resolve();
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        reject(error);
      } else {
        reject(error);
      }
    });
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

