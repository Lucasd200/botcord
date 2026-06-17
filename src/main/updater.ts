import { app, type BrowserWindow } from 'electron'
import { IPC } from '@shared/types'

/**
 * In-app auto-update via electron-updater. Downloads new releases published to
 * GitHub in the background and tells the renderer when one is ready, so the
 * title bar can show the "Update Ready" button. No-ops in dev (unpackaged).
 */
export function initUpdater(getWindow: () => BrowserWindow | null): {
  check: () => void
  install: () => void
} {
  let downloaded = false

  if (!app.isPackaged) {
    return { check: () => {}, install: () => {} }
  }

  // Lazy require so dev/unpackaged runs never load electron-updater.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (channel: string, ...args: unknown[]): void => {
    const w = getWindow()
    if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
  }

  autoUpdater.on('update-available', (info) => send(IPC.evUpdateAvailable, { version: info.version }))
  autoUpdater.on('download-progress', (p) => send(IPC.evUpdateProgress, { percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => {
    downloaded = true
    send(IPC.evUpdateDownloaded, { version: info.version })
  })
  autoUpdater.on('error', (err) => console.error('[updater]', err?.message || err))

  const check = (): void => {
    autoUpdater.checkForUpdates().catch((e) => console.error('[updater] check failed', e?.message))
  }

  // Check on launch and every 30 minutes.
  setTimeout(check, 8000)
  setInterval(check, 30 * 60 * 1000)

  return {
    check,
    install: () => {
      if (downloaded) autoUpdater.quitAndInstall(false, true)
    }
  }
}
