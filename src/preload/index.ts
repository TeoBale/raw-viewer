import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IPC_CHANNELS,
  type GetImageSourceRequest,
  type GetImageSourceResult,
  type GetImagesPageRequest,
  type GetImagesPageResult,
  type IndexFolderRequest,
  type IndexFolderResult,
  type IndexProgressEvent,
  type DecodeProgressEvent,
  type MoveRejectedRequest,
  type MoveRejectedResult,
  type RawViewerApi,
  type SetImageStatusRequest,
  type SetImageStatusResult,
  type SyncXmpRequest,
  type SyncXmpResult
} from '../shared/contracts'

const api: RawViewerApi = {
  pickFolder: () => ipcRenderer.invoke(IPC_CHANNELS.pickFolder),
  indexFolder: (input: IndexFolderRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.indexFolder, input) as Promise<IndexFolderResult>,
  getImagesPage: (input: GetImagesPageRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.getImagesPage, input) as Promise<GetImagesPageResult>,
  getImageSource: (input: GetImageSourceRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.getImageSource, input) as Promise<GetImageSourceResult>,
  setImageStatus: (input: SetImageStatusRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.setImageStatus, input) as Promise<SetImageStatusResult>,
  moveRejected: (input: MoveRejectedRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.moveRejected, input) as Promise<MoveRejectedResult>,
  syncXmp: (input: SyncXmpRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.syncXmp, input) as Promise<SyncXmpResult>,
  onIndexProgress: (callback: (event: IndexProgressEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: IndexProgressEvent): void =>
      callback(event)
    ipcRenderer.on(IPC_CHANNELS.indexProgress, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.indexProgress, handler)
  },
  onDecodeProgress: (callback: (event: DecodeProgressEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: DecodeProgressEvent): void =>
      callback(event)
    ipcRenderer.on(IPC_CHANNELS.decodeProgress, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.decodeProgress, handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
