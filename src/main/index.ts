import { app, shell, BrowserWindow, dialog, ipcMain, protocol, net } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { AppServices } from './services/app-services'
import {
  IPC_CHANNELS,
  type DecodeProgressEvent,
  type IndexProgressEvent
} from '../shared/contracts'

let services: AppServices | null = null

function registerRawCacheProtocol(): void {
  protocol.handle('raw-cache', (request) => {
    const url = new URL(request.url)
    const encodedPath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
    const absolutePath = decodeURIComponent(encodedPath)
    return net.fetch(pathToFileURL(absolutePath).toString())
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  void mainWindow.webContents.setVisualZoomLevelLimits(1, 1)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function emitIndexProgress(event: IndexProgressEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC_CHANNELS.indexProgress, event)
  }
}

function emitDecodeProgress(event: DecodeProgressEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC_CHANNELS.decodeProgress, event)
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.pickFolder, async () => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(window, {
      title: 'Select RAW Folder',
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.indexFolder, (_, payload) => {
    if (!services) {
      throw new Error('Services unavailable')
    }
    return services.indexFolder(payload)
  })

  ipcMain.handle(IPC_CHANNELS.getImagesPage, (_, payload) => {
    if (!services) {
      throw new Error('Services unavailable')
    }
    return services.getImagesPage(payload)
  })

  ipcMain.handle(IPC_CHANNELS.getImageSource, (_, payload) => {
    if (!services) {
      throw new Error('Services unavailable')
    }
    return services.getImageSource(payload)
  })

  ipcMain.handle(IPC_CHANNELS.setImageStatus, (_, payload) => {
    if (!services) {
      throw new Error('Services unavailable')
    }
    return services.setImageStatus(payload)
  })

  ipcMain.handle(IPC_CHANNELS.moveRejected, (_, payload) => {
    if (!services) {
      throw new Error('Services unavailable')
    }
    return services.moveRejected(payload)
  })

  ipcMain.handle(IPC_CHANNELS.syncXmp, (_, payload) => {
    if (!services) {
      throw new Error('Services unavailable')
    }
    return services.syncXmp(payload)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.rawviewer.app')
  registerRawCacheProtocol()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  services = new AppServices(emitIndexProgress, emitDecodeProgress)
  registerIpc()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  services?.close()
})
