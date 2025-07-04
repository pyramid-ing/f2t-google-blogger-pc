import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // 앱 정보 API
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 업데이트 관련 API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // 업데이트 이벤트 리스너
  onDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('download-progress', (_, progress) => callback(progress))
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info))
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // IPC 통신 API
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  send: (channel: string, data?: any) => ipcRenderer.send(channel, data),
  on: (channel: string, callback: (event: any, data: any) => void) => {
    ipcRenderer.on(channel, callback)
  },
  removeListener: (channel: string, callback: (event: any, data: any) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },
})
