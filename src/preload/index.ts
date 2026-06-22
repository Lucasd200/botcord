import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/types'
import type { Settings } from '@shared/types'

type Listener = (...args: any[]) => void

function on(channel: string, cb: Listener): () => void {
  const handler = (_e: Electron.IpcRendererEvent, ...args: any[]): void => cb(...args)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  platform: process.platform as string,
  // actions (renderer -> main)
  login: (token: string) => ipcRenderer.invoke(IPC.login, token),
  logout: () => ipcRenderer.invoke(IPC.logout),
  openChannel: (id: string) => ipcRenderer.invoke(IPC.openChannel, id),
  openDM: (id: string) => ipcRenderer.invoke(IPC.openDM, id),
  sendText: (text: string) => ipcRenderer.invoke(IPC.sendText, text),
  sendFile: (path: string, text: string) => ipcRenderer.invoke(IPC.sendFile, path, text),
  sendEmbed: (data: import('@shared/types').EmbedData) => ipcRenderer.invoke(IPC.sendEmbed, data),
  reply: (id: string, text: string) => ipcRenderer.invoke(IPC.reply, id, text),
  editMessage: (id: string, text: string) => ipcRenderer.invoke(IPC.editMessage, id, text),
  deleteMessage: (id: string) => ipcRenderer.invoke(IPC.deleteMessage, id),
  addReaction: (id: string, emoji: string) => ipcRenderer.invoke(IPC.addReaction, id, emoji),
  typing: () => ipcRenderer.invoke(IPC.typing),
  setPresence: (status: string, activity: string) => ipcRenderer.invoke(IPC.setPresence, status, activity),
  loadMembers: () => ipcRenderer.invoke(IPC.loadMembers),
  getProfile: (id: string) => ipcRenderer.invoke(IPC.getProfile, id),
  getEmojis: (): Promise<import('@shared/types').EmojiInfo[]> => ipcRenderer.invoke(IPC.getEmojis),
  getBotProfile: (): Promise<import('@shared/types').BotProfile | null> =>
    ipcRenderer.invoke(IPC.getBotProfile),
  editBotProfile: (changes: {
    username?: string
    description?: string
    avatarPath?: string
  }): Promise<import('@shared/types').ActionResult> => ipcRenderer.invoke(IPC.editBotProfile, changes),
  getPins: (id: string): Promise<import('@shared/types').MessageData[]> =>
    ipcRenderer.invoke(IPC.getPins, id),
  pinMessage: (id: string): Promise<import('@shared/types').ActionResult> =>
    ipcRenderer.invoke(IPC.pinMessage, id),
  unpinMessage: (id: string): Promise<import('@shared/types').ActionResult> =>
    ipcRenderer.invoke(IPC.unpinMessage, id),

  // server settings & management
  getGuildDetail: (id: string): Promise<import('@shared/types').GuildDetail | null> =>
    ipcRenderer.invoke(IPC.getGuildDetail, id),
  createChannel: (
    guildId: string,
    name: string,
    kind: 'text' | 'voice' | 'category',
    parentId?: string | null
  ): Promise<import('@shared/types').ActionResult> =>
    ipcRenderer.invoke(IPC.createChannel, guildId, name, kind, parentId),
  deleteChannel: (id: string): Promise<import('@shared/types').ActionResult> =>
    ipcRenderer.invoke(IPC.deleteChannel, id),
  editChannel: (
    id: string,
    changes: { name?: string; topic?: string }
  ): Promise<import('@shared/types').ActionResult> => ipcRenderer.invoke(IPC.editChannel, id, changes),
  getChannelPermissions: (id: string): Promise<import('@shared/types').ChannelOverwrite[]> =>
    ipcRenderer.invoke(IPC.getChannelPermissions, id),
  setChannelPermission: (
    id: string,
    targetId: string,
    perm: string,
    value: import('@shared/types').PermValue
  ): Promise<import('@shared/types').ActionResult> =>
    ipcRenderer.invoke(IPC.setChannelPermission, id, targetId, perm, value),
  setMemberRole: (
    guildId: string,
    userId: string,
    roleId: string,
    add: boolean
  ): Promise<import('@shared/types').ActionResult> =>
    ipcRenderer.invoke(IPC.setMemberRole, guildId, userId, roleId, add),
  kickMember: (guildId: string, userId: string, reason?: string): Promise<import('@shared/types').ActionResult> =>
    ipcRenderer.invoke(IPC.kickMember, guildId, userId, reason),
  banMember: (guildId: string, userId: string, reason?: string): Promise<import('@shared/types').ActionResult> =>
    ipcRenderer.invoke(IPC.banMember, guildId, userId, reason),
  timeoutMember: (guildId: string, userId: string, minutes: number): Promise<import('@shared/types').ActionResult> =>
    ipcRenderer.invoke(IPC.timeoutMember, guildId, userId, minutes),

  pickFile: (): Promise<string | null> => ipcRenderer.invoke(IPC.pickFile),
  pickAudioFile: (): Promise<string | null> => ipcRenderer.invoke(IPC.pickAudioFile),

  // voice + music
  joinVoice: (id: string) => ipcRenderer.invoke(IPC.joinVoice, id),
  leaveVoice: () => ipcRenderer.invoke(IPC.leaveVoice),
  musicEnqueue: (q: string) => ipcRenderer.invoke(IPC.musicEnqueue, q),
  musicPlayLocal: (p: string) => ipcRenderer.invoke(IPC.musicPlayLocal, p),
  musicPause: () => ipcRenderer.invoke(IPC.musicPause),
  musicResume: () => ipcRenderer.invoke(IPC.musicResume),
  musicSkip: () => ipcRenderer.invoke(IPC.musicSkip),
  musicStop: () => ipcRenderer.invoke(IPC.musicStop),
  musicSetVolume: (v: number) => ipcRenderer.invoke(IPC.musicSetVolume, v),
  musicToggleLoop: (): Promise<boolean> => ipcRenderer.invoke(IPC.musicToggleLoop),
  musicShuffle: () => ipcRenderer.invoke(IPC.musicShuffle),
  musicRemove: (i: number) => ipcRenderer.invoke(IPC.musicRemove, i),

  // updates
  checkUpdate: () => ipcRenderer.invoke(IPC.checkUpdate),
  installUpdate: () => ipcRenderer.invoke(IPC.installUpdate),

  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.getSettings),
  setSettings: (partial: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke(IPC.setSettings, partial),
  openDataFolder: () => ipcRenderer.invoke(IPC.openDataFolder),

  // window controls
  windowMinimize: () => ipcRenderer.invoke(IPC.windowMinimize),
  windowMaximize: () => ipcRenderer.invoke(IPC.windowMaximize),
  windowClose: () => ipcRenderer.invoke(IPC.windowClose),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.windowIsMaximized),

  // events (main -> renderer); each returns an unsubscribe fn
  onReady: (cb: Listener) => on(IPC.evReady, cb),
  onGuilds: (cb: Listener) => on(IPC.evGuilds, cb),
  onDMs: (cb: Listener) => on(IPC.evDMs, cb),
  onHistory: (cb: Listener) => on(IPC.evHistory, cb),
  onMessage: (cb: Listener) => on(IPC.evMessage, cb),
  onMessageUpdate: (cb: Listener) => on(IPC.evMessageUpdate, cb),
  onMessageDelete: (cb: Listener) => on(IPC.evMessageDelete, cb),
  onMembers: (cb: Listener) => on(IPC.evMembers, cb),
  onLatency: (cb: Listener) => on(IPC.evLatency, cb),
  onLog: (cb: Listener) => on(IPC.evLog, cb),
  onTyping: (cb: Listener) => on(IPC.evTyping, cb),
  onDisconnect: (cb: Listener) => on(IPC.evDisconnect, cb),
  onMaximizeChange: (cb: Listener) => on(IPC.evMaximize, cb),
  onVoiceState: (cb: Listener) => on(IPC.evVoiceState, cb),
  onNowPlaying: (cb: Listener) => on(IPC.evNowPlaying, cb),
  onQueue: (cb: Listener) => on(IPC.evQueue, cb),
  onUpdateAvailable: (cb: Listener) => on(IPC.evUpdateAvailable, cb),
  onUpdateProgress: (cb: Listener) => on(IPC.evUpdateProgress, cb),
  onUpdateDownloaded: (cb: Listener) => on(IPC.evUpdateDownloaded, cb)
}

contextBridge.exposeInMainWorld('botcord', api)

export type BotcordApi = typeof api
