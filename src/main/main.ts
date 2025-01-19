/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { mainZustandBridge } from 'zutron/main';
import { store } from './store/create';
import { createMainWindow } from './window';

console.log('MISTRAL_API_KEY', process.env.MISTRAL_API_KEY);

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// Add handler for API key
ipcMain.handle('get-api-key', () => {
  return process.env.MISTRAL_API_KEY;
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')({ showDevTools: false });
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

// Function to create the chromeless window
function createChromelessWindow() {
  // Resolve paths for both dev and prod
  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'chromeless-preload.js')
    : path.join(__dirname, '../../src/main/chromeless-preload.js');
  const htmlPath = app.isPackaged
    ? path.join(__dirname, 'chromeless.html')
    : path.join(__dirname, '../../src/main/chromeless.html');

  console.log('Loading preload from:', preloadPath);
  console.log('Loading HTML from:', htmlPath);

  const chromelessWindow = new BrowserWindow({
    width: 300,
    height: 100,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    x: 50,
    y: 50,
    opacity: 0,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      devTools: true,
    },
  });

  chromelessWindow.loadFile(htmlPath).catch((err) => {
    console.error('Failed to load chromeless window:', err);
  });

  // Enable DevTools for debugging
  // chromelessWindow.webContents.openDevTools({ mode: 'detach' });

  // Log window lifecycle events
  chromelessWindow.webContents.on('did-finish-load', () => {
    console.log('Chromeless window loaded');
  });

  chromelessWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription) => {
      console.error(
        'Chromeless window failed to load:',
        errorCode,
        errorDescription,
      );
    },
  );

  // Prevent the window from being hidden
  chromelessWindow.on('minimize', () => {
    chromelessWindow.restore();
  });

  chromelessWindow.on('closed', () => {
    console.log('Chromeless window closed');
  });
}

const initializeApp = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const mainWindow = await createMainWindow(getAssetPath);

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();

  const { unsubscribe } = mainZustandBridge(ipcMain, store, [mainWindow], {
    // reducer: rootReducer,
  });

  app.on('quit', unsubscribe);

  // Create chromeless window
  createChromelessWindow();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    await initializeApp();
  })
  .catch(console.log);
