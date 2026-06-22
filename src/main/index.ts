import { app, shell, BrowserWindow, ipcMain, dialog, nativeImage, session } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { BotManager } from './bot'
import { loadSettings, saveSettings, getDataDir } from './store'
import { initUpdater } from './updater'
import { IPC } from '@shared/types'
import type { Settings } from '@shared/types'

const isDev = !app.isPackaged
const isMac = process.platform === 'darwin'
let mainWindow: BrowserWindow | null = null
const bot = new BotManager()
const updater = initUpdater(() => mainWindow)

// Use a dedicated data folder so we never read or clobber the legacy Python
// Botcord client, which also lives in %APPDATA%/Botcord (case-insensitive on
// Windows). Keeps each app's settings.json independent.
app.setName('Botcord')
try {
  app.setPath('userData', join(app.getPath('appData'), 'Botcord 2.0'))
} catch {
  /* getPath unavailable in some sandboxes — fall back to default */
}

function resolveIcon(): string | undefined {
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(process.resourcesPath || '', 'build/icon.png'),
    join(__dirname, '../../resources/icon.png')
  ]
  return candidates.find((p) => existsSync(p))
}

function createWindow(): void {
  const iconPath = resolveIcon()
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 940,
    minHeight: 560,
    show: false,
    backgroundColor: '#1e1f22',
    title: 'Botcord',
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    autoHideMenuBar: true,
    // macOS: keep the native traffic lights (left), inset into our custom title
    // bar. Windows/Linux: frameless window with our own controls (right).
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 13, y: 10 } }
      : { frame: false as const }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('maximize', () => mainWindow?.webContents.send(IPC.evMaximize, true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send(IPC.evMaximize, false))
  mainWindow.on('closed', () => (mainWindow = null))

  // Open external links in the user's browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function send(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args)
}

// ---- forward bot events to the renderer -----------------------------------
bot.on('ready', (u) => send(IPC.evReady, u))
bot.on('guilds', (g) => send(IPC.evGuilds, g))
bot.on('dms', (d) => send(IPC.evDMs, d))
bot.on('history', (h) => send(IPC.evHistory, h))
bot.on('message', (m) => send(IPC.evMessage, m))
bot.on('messageUpdate', (m) => send(IPC.evMessageUpdate, m))
bot.on('messageDelete', (d) => send(IPC.evMessageDelete, d))
bot.on('members', (m, name) => send(IPC.evMembers, m, name))
bot.on('latency', (l) => send(IPC.evLatency, l))
bot.on('log', (l) => send(IPC.evLog, l))
bot.on('typing', (t) => send(IPC.evTyping, t))
bot.on('disconnect', () => send(IPC.evDisconnect))
bot.on('voiceState', (v) => send(IPC.evVoiceState, v))
bot.on('nowPlaying', (n) => send(IPC.evNowPlaying, n))
bot.on('queue', (q) => send(IPC.evQueue, q))

// ---- IPC handlers ----------------------------------------------------------
function registerIpc(): void {
  ipcMain.handle(IPC.login, async (_e, token: string) => {
    const settings = loadSettings()
    bot.setHistoryLimit(settings.historyLimit)
    return bot.login(token)
  })
  ipcMain.handle(IPC.logout, () => bot.logout())
  ipcMain.handle(IPC.openChannel, (_e, id: string) => bot.openChannel(id))
  ipcMain.handle(IPC.openDM, (_e, id: string) => bot.openDM(id))
  ipcMain.handle(IPC.sendText, (_e, text: string) => bot.sendText(text))
  ipcMain.handle(IPC.sendFile, (_e, path: string, text: string) => bot.sendFile(path, text))
  ipcMain.handle(IPC.sendEmbed, (_e, data) => bot.sendEmbed(data))
  ipcMain.handle(IPC.reply, (_e, id: string, text: string) => bot.reply(id, text))
  ipcMain.handle(IPC.editMessage, (_e, id: string, text: string) => bot.editMessage(id, text))
  ipcMain.handle(IPC.deleteMessage, (_e, id: string) => bot.deleteMessage(id))
  ipcMain.handle(IPC.addReaction, (_e, id: string, emoji: string) => bot.addReaction(id, emoji))
  ipcMain.handle(IPC.typing, () => bot.typing())
  ipcMain.handle(IPC.setPresence, (_e, s: string, a: string) => bot.setPresence(s, a))
  ipcMain.handle(IPC.loadMembers, () => bot.refreshMembers())
  ipcMain.handle(IPC.getProfile, (_e, id: string) => bot.getProfile(id))
  ipcMain.handle(IPC.getEmojis, () => bot.getEmojis())
  ipcMain.handle(IPC.getBotProfile, () => bot.getBotProfile())
  ipcMain.handle(IPC.editBotProfile, (_e, changes: { username?: string; description?: string; avatarPath?: string }) =>
    bot.editBotProfile(changes)
  )
  ipcMain.handle(IPC.getPins, (_e, id: string) => bot.getPins(id))
  ipcMain.handle(IPC.pinMessage, (_e, id: string) => bot.pinMessage(id))
  ipcMain.handle(IPC.unpinMessage, (_e, id: string) => bot.unpinMessage(id))

  // server settings & management
  ipcMain.handle(IPC.getGuildDetail, (_e, id: string) => bot.getGuildDetail(id))
  ipcMain.handle(IPC.createChannel, (_e, gid: string, name: string, kind: 'text' | 'voice' | 'category', parentId?: string | null) =>
    bot.createChannel(gid, name, kind, parentId)
  )
  ipcMain.handle(IPC.deleteChannel, (_e, id: string) => bot.deleteChannel(id))
  ipcMain.handle(IPC.editChannel, (_e, id: string, changes: { name?: string; topic?: string }) =>
    bot.editChannel(id, changes)
  )
  ipcMain.handle(IPC.getChannelPermissions, (_e, id: string) => bot.getChannelPermissions(id))
  ipcMain.handle(IPC.setChannelPermission, (_e, id: string, targetId: string, perm: string, value: import('@shared/types').PermValue) =>
    bot.setChannelPermission(id, targetId, perm, value)
  )
  ipcMain.handle(IPC.setMemberRole, (_e, gid: string, uid: string, rid: string, add: boolean) =>
    bot.setMemberRole(gid, uid, rid, add)
  )
  ipcMain.handle(IPC.kickMember, (_e, gid: string, uid: string, reason?: string) => bot.kickMember(gid, uid, reason))
  ipcMain.handle(IPC.banMember, (_e, gid: string, uid: string, reason?: string) => bot.banMember(gid, uid, reason))
  ipcMain.handle(IPC.timeoutMember, (_e, gid: string, uid: string, minutes: number) =>
    bot.timeoutMember(gid, uid, minutes)
  )

  ipcMain.handle(IPC.getSettings, () => loadSettings())
  ipcMain.handle(IPC.setSettings, (_e, partial: Partial<Settings>) => {
    const merged = saveSettings(partial)
    if (partial.historyLimit != null) bot.setHistoryLimit(merged.historyLimit)
    return merged
  })

  ipcMain.handle(IPC.pickFile, async () => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Send a file',
      properties: ['openFile'],
      filters: [
        { name: 'All files', extensions: ['*'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
      ]
    })
    return res.canceled ? null : res.filePaths[0]
  })

  ipcMain.handle(IPC.pickAudioFile, async () => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Add audio to the queue',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus', 'webm'] }]
    })
    return res.canceled ? null : res.filePaths[0]
  })

  // voice + music
  ipcMain.handle(IPC.joinVoice, (_e, id: string) => bot.joinVoice(id))
  ipcMain.handle(IPC.leaveVoice, () => bot.leaveVoice())
  ipcMain.handle(IPC.musicEnqueue, (_e, q: string) => bot.musicEnqueue(q))
  ipcMain.handle(IPC.musicPlayLocal, (_e, p: string) => bot.musicPlayLocal(p))
  ipcMain.handle(IPC.musicPause, () => bot.musicPause())
  ipcMain.handle(IPC.musicResume, () => bot.musicResume())
  ipcMain.handle(IPC.musicSkip, () => bot.musicSkip())
  ipcMain.handle(IPC.musicStop, () => bot.musicStop())
  ipcMain.handle(IPC.musicSetVolume, (_e, v: number) => bot.musicSetVolume(v))
  ipcMain.handle(IPC.musicToggleLoop, () => bot.musicToggleLoop())
  ipcMain.handle(IPC.musicShuffle, () => bot.musicShuffle())
  ipcMain.handle(IPC.musicRemove, (_e, i: number) => bot.musicRemove(i))

  // updates
  ipcMain.handle(IPC.checkUpdate, () => updater.check())
  ipcMain.handle(IPC.installUpdate, () => updater.install())

  ipcMain.handle(IPC.openDataFolder, () => shell.openPath(getDataDir()))

  ipcMain.handle(IPC.windowMinimize, () => mainWindow?.minimize())
  ipcMain.handle(IPC.windowMaximize, () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle(IPC.windowClose, () => mainWindow?.close())
  ipcMain.handle(IPC.windowIsMaximized, () => mainWindow?.isMaximized() ?? false)
}

// single-instance lock so a second launch focuses the existing window
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Lock down content in packaged builds; dev needs Vite's inline HMR scripts.
    if (!isDev) {
      session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
        cb({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; " +
                "style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self' https:"
            ]
          }
        })
      })
    }
    registerIpc()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      bot.logout().finally(() => app.quit())
    }
  })

  app.on('before-quit', () => {
    bot.logout()
  })
}
