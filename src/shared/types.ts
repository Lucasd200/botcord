/** Types shared between the Electron main process and the React renderer. */

export type NotificationMode = 'all' | 'pings' | 'none'

export interface Settings {
  keepLoggedIn: boolean
  savedToken: string
  theme: string // 'dark' | 'light' | 'ash' | 'onyx' | 'sync'
  colorTheme: string // '' | a COLOR_THEMES name | 'custom:#RRGGBB'
  accent: string
  compactMessages: boolean
  historyLimit: number
  notificationMode: NotificationMode
  favorites: string[]
  serverOrder: string[]
  railWidth: number
  lastChannelId: string
  presenceStatus: string
  presenceActivity: string
  spellcheck: boolean
}

export interface VoiceMember {
  id: string
  name: string
  avatar: string | null
}

export interface ChannelInfo {
  id: string
  name: string
  type: 'text' | 'voice' | 'announcement' | 'forum' | 'stage'
  nsfw?: boolean
  topic?: string | null
  voiceMembers?: VoiceMember[]
}

export interface RoleInfo {
  id: string
  name: string
  color: string | null
}

export interface CategoryInfo {
  id: string | null
  name: string | null
  channels: ChannelInfo[]
}

export interface GuildInfo {
  id: string
  name: string
  icon: string | null
  acronym: string
  categories: CategoryInfo[]
  voice: { id: string; name: string }[]
  roles: RoleInfo[]
  memberCount: number
  onlineCount: number
}

export interface ReplyRef {
  author: string
  content: string
  avatar?: string | null
}

export interface AttachmentFile {
  url: string
  name: string
  size?: number
}

export interface MessageData {
  id: string
  channelId: string
  isActiveChannel: boolean
  author: string
  authorId: string
  bot: boolean
  isSelf: boolean
  content: string
  timestamp: number // epoch ms
  editedTimestamp: number | null
  replyTo: ReplyRef | null
  avatarUrl: string | null
  roleColor: string | null
  images: string[]
  files: AttachmentFile[]
  mentionsMe: boolean
  /** A real ping for notifications: DM, direct @mention or role mention — excludes @everyone/@here. */
  directPing: boolean
  reactions: Reaction[]
  /** Resolves <@id>/<@&id>/<#id> tokens in content to readable names. */
  mentions: MessageMentions
}

export interface MessageMentions {
  users: Record<string, string>
  roles: Record<string, { name: string; color: string | null }>
  channels: Record<string, string>
}

export interface Reaction {
  /** Unicode char for standard emoji, or the custom emoji name. */
  emoji: string
  /** Custom emoji id, or null for unicode emoji. */
  id: string | null
  animated: boolean
  count: number
  me: boolean
}

export interface MemberData {
  id: string
  name: string
  bot: boolean
  status: string // 'online' | 'idle' | 'dnd' | 'offline' | ''
  activity: string
  role: string
  rolePos: number
  roleColor: string | null
  avatar: string | null
}

export interface DMInfo {
  id: string
  name: string
  avatar: string | null
}

export interface BotUser {
  id: string
  name: string
  discriminator: string
  avatar: string | null
  guildCount: number
}

export interface ProfileRole {
  name: string
  color: string | null
}

export interface ProfileData {
  id: string
  username: string
  displayName: string
  avatar: string | null
  banner: string | null
  bannerColor: string | null
  bot: boolean
  status: string
  roles: ProfileRole[]
  roleColor: string | null
  createdAt: number
  joinedAt: number | null
}

export interface HistoryPayload {
  channelId: string
  messages: MessageData[]
  channelName: string
  guildName: string
  topic: string | null
  isDM: boolean
}

export interface LoginResult {
  ok: boolean
  error?: string
}

export interface Track {
  title: string
  url: string | null
  duration: number | null
  thumbnail: string | null
  requester: string
  local: boolean
}

export interface VoiceStatus {
  connected: boolean
  channelName: string
}

export interface NowPlaying {
  title: string
  duration: number | null
  thumbnail: string | null
  requester: string
  paused: boolean
  loop: boolean
}

export interface EmbedField {
  name: string
  value: string
  inline: boolean
}

export interface EmbedData {
  title: string
  description: string
  url: string
  color: string
  authorName: string
  authorIcon: string
  authorUrl: string
  footerText: string
  footerIcon: string
  image: string
  thumbnail: string
  timestamp: boolean
  content: string
  fields: EmbedField[]
}

export interface UpdateInfo {
  version: string
}

export interface UpdateProgress {
  percent: number
}

/** Channel names used by the IPC bridge (main <-> renderer). */
export const IPC = {
  // renderer -> main (invoke)
  login: 'bot:login',
  logout: 'bot:logout',
  openChannel: 'bot:openChannel',
  openDM: 'bot:openDM',
  sendText: 'bot:sendText',
  sendFile: 'bot:sendFile',
  sendEmbed: 'bot:sendEmbed',
  reply: 'bot:reply',
  deleteMessage: 'bot:deleteMessage',
  editMessage: 'bot:editMessage',
  addReaction: 'bot:addReaction',
  typing: 'bot:typing',
  setPresence: 'bot:setPresence',
  loadMembers: 'bot:loadMembers',
  getProfile: 'bot:getProfile',
  pickFile: 'dialog:pickFile',
  pickAudioFile: 'dialog:pickAudioFile',
  // voice + music
  joinVoice: 'music:joinVoice',
  leaveVoice: 'music:leaveVoice',
  musicEnqueue: 'music:enqueue',
  musicPlayLocal: 'music:playLocal',
  musicPause: 'music:pause',
  musicResume: 'music:resume',
  musicSkip: 'music:skip',
  musicStop: 'music:stop',
  musicSetVolume: 'music:setVolume',
  musicToggleLoop: 'music:toggleLoop',
  musicShuffle: 'music:shuffle',
  musicRemove: 'music:remove',
  // updates
  checkUpdate: 'update:check',
  installUpdate: 'update:install',
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  openDataFolder: 'app:openDataFolder',
  windowMinimize: 'win:minimize',
  windowMaximize: 'win:maximize',
  windowClose: 'win:close',
  windowIsMaximized: 'win:isMaximized',
  // main -> renderer (events)
  evReady: 'ev:ready',
  evGuilds: 'ev:guilds',
  evDMs: 'ev:dms',
  evHistory: 'ev:history',
  evMessage: 'ev:message',
  evMessageUpdate: 'ev:messageUpdate',
  evMessageDelete: 'ev:messageDelete',
  evMembers: 'ev:members',
  evLatency: 'ev:latency',
  evLog: 'ev:log',
  evDisconnect: 'ev:disconnect',
  evTyping: 'ev:typing',
  evMaximize: 'ev:maximize',
  evVoiceState: 'ev:voiceState',
  evNowPlaying: 'ev:nowPlaying',
  evQueue: 'ev:queue',
  evUpdateAvailable: 'ev:updateAvailable',
  evUpdateProgress: 'ev:updateProgress',
  evUpdateDownloaded: 'ev:updateDownloaded'
} as const
