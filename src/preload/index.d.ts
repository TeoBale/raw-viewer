import { ElectronAPI } from '@electron-toolkit/preload'
import { RawViewerApi } from '../shared/contracts'

declare global {
  interface Window {
    electron: ElectronAPI
    api: RawViewerApi
  }
}
