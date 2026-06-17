import { create } from 'zustand'
import { api } from './api'
import { resolvePalette, applyPalette } from './theme'
import type {
  Settings,
  GuildInfo,
  DMInfo,
  MessageData,
  MemberData,
  BotUser,
  HistoryPayload,
  Track,
  NowPlaying,
  VoiceStatus
} from '@shared/types'

export interface ContextMenuState {
  x: number
  y: number
  messageId: string
  mode: 'full' | 'react'
}

export interface UpdateState {
  available: boolean
  downloaded: boolean
  version: string
}

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error' | 'success'
}

interface State {
  ready: boolean
  view: 'login' | 'app'
  connecting: boolean
  loginError: string

  user: BotUser | null
  settings: Settings
  latency: number

  guilds: GuildInfo[]
  dms: DMInfo[]
  activeGuildId: string | null // null => Home / DMs
  activeChannelId: string | null
  channelName: string
  guildName: string
  topic: string | null
  isDM: boolean

  messages: MessageData[]
  members: MemberData[]
  memberGuildName: string

  showMembers: boolean
  showSettings: boolean
  showMusic: boolean
  typingUser: string | null

  voice: VoiceStatus
  nowPlaying: NowPlaying | null
  queue: Track[]
  update: UpdateState
  contextMenu: ContextMenuState | null
  windowFocused: boolean

  unread: Record<string, number> // channelId -> count
  collapsed: Record<string, boolean>
  replyTarget: MessageData | null
  editingId: string | null
  toasts: Toast[]

  // actions
  init: () => Promise<void>
  login: (token: string, keep: boolean) => Promise<void>
  logout: () => Promise<void>
  selectGuild: (id: string | null) => void
  openChannel: (id: string) => Promise<void>
  openDM: (id: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  applySettings: (partial: Partial<Settings>) => Promise<void>
  toggleMembers: () => void
  setShowSettings: (v: boolean) => void
  setShowMusic: (v: boolean) => void
  toggleCollapsed: (key: string) => void
  setReplyTarget: (m: MessageData | null) => void
  setEditing: (id: string | null) => void
  openMenu: (x: number, y: number, messageId: string, mode: ContextMenuState['mode']) => void
  closeMenu: () => void
  installUpdate: () => void
  pushToast: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void
}

let toastSeq = 1
let typingTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false
const MAX_MESSAGES = 500

export const useStore = create<State>((set, get) => ({
  ready: false,
  view: 'login',
  connecting: false,
  loginError: '',
  user: null,
  settings: {} as Settings,
  latency: 0,
  guilds: [],
  dms: [],
  activeGuildId: null,
  activeChannelId: null,
  channelName: '',
  guildName: '',
  topic: null,
  isDM: false,
  messages: [],
  members: [],
  memberGuildName: '',
  showMembers: true,
  showSettings: false,
  showMusic: false,
  typingUser: null,
  voice: { connected: false, channelName: '' },
  nowPlaying: null,
  queue: [],
  update: { available: false, downloaded: false, version: '' },
  contextMenu: null,
  windowFocused: true,
  unread: {},
  collapsed: {},
  replyTarget: null,
  editingId: null,
  toasts: [],

  init: async () => {
    if (initialized) return // guard against React StrictMode double-invoke
    initialized = true
    window.addEventListener('focus', () => set({ windowFocused: true }))
    window.addEventListener('blur', () => set({ windowFocused: false }))
    set({ windowFocused: document.hasFocus() })
    const settings = await api.getSettings()
    const { palette, appearance } = resolvePalette(settings)
    applyPalette(palette, appearance)
    set({ settings, ready: true })

    // ---- wire up main-process events ----
    api.onReady((u: BotUser) => {
      set({ user: u, view: 'app', connecting: false, loginError: '' })
    })
    api.onGuilds((g: GuildInfo[]) => set({ guilds: g }))
    api.onDMs((d: DMInfo[]) => set({ dms: d }))
    api.onLatency((l: number) => set({ latency: l }))
    api.onLog((text: string) => get().pushToast(text, /fail|error|invalid|missing/i.test(text) ? 'error' : 'info'))

    api.onHistory((h: HistoryPayload) => {
      set((s) => ({
        messages: h.messages,
        channelName: h.channelName,
        guildName: h.guildName,
        topic: h.topic,
        isDM: h.isDM,
        activeChannelId: h.channelId,
        unread: { ...s.unread, [h.channelId]: 0 }
      }))
      requestAnimationFrame(() => {
        const el = document.getElementById('message-scroll')
        if (el) el.scrollTop = el.scrollHeight
      })
    })

    api.onMessage((m: MessageData) => {
      const s = get()
      if (m.channelId === s.activeChannelId) {
        if (!s.messages.some((x) => x.id === m.id)) {
          const scroller = document.getElementById('message-scroll')
          const atBottom = scroller
            ? scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120
            : true
          set({ messages: [...s.messages, m].slice(-MAX_MESSAGES), typingUser: null })
          if (atBottom)
            requestAnimationFrame(() => {
              if (scroller) scroller.scrollTop = scroller.scrollHeight
            })
        }
      } else if (!m.isSelf) {
        set({ unread: { ...s.unread, [m.channelId]: (s.unread[m.channelId] || 0) + 1 } })
      }
      maybeNotify(m, s)
    })

    api.onMessageUpdate((m: MessageData) => {
      set((s) => ({ messages: s.messages.map((x) => (x.id === m.id ? m : x)) }))
    })

    api.onMessageDelete(({ channelId, id }: { channelId: string; id: string }) => {
      set((s) =>
        channelId === s.activeChannelId
          ? { messages: s.messages.filter((x) => x.id !== id) }
          : {}
      )
    })

    api.onMembers((m: MemberData[], name: string) => set({ members: m, memberGuildName: name }))

    api.onTyping(({ name }: { name: string }) => {
      set({ typingUser: name })
      if (typingTimer) clearTimeout(typingTimer)
      typingTimer = setTimeout(() => set({ typingUser: null }), 6000)
    })

    api.onDisconnect(() => get().pushToast('Connection lost — reconnecting…', 'error'))

    api.onVoiceState((v: VoiceStatus) => set({ voice: v }))
    api.onNowPlaying((n: NowPlaying | null) => set({ nowPlaying: n }))
    api.onQueue((q: Track[]) => set({ queue: q }))
    api.onUpdateAvailable(({ version }: { version: string }) =>
      set((s) => ({ update: { ...s.update, available: true, version } }))
    )
    api.onUpdateDownloaded(({ version }: { version: string }) => {
      set({ update: { available: true, downloaded: true, version } })
      get().pushToast(`Update ${version} ready — click the button up top to install`, 'success')
    })

    // auto-login
    if (settings.keepLoggedIn && settings.savedToken) {
      get().login(settings.savedToken, true)
    }
  },

  login: async (token, keep) => {
    set({ connecting: true, loginError: '' })
    const res = await api.login(token)
    if (res.ok) {
      await api.setSettings({ keepLoggedIn: keep, savedToken: keep ? token : '' })
      set((s) => ({ settings: { ...s.settings, keepLoggedIn: keep, savedToken: keep ? token : '' } }))
    } else {
      set({ connecting: false, loginError: res.error || 'Could not connect.' })
    }
  },

  logout: async () => {
    await api.logout()
    await api.setSettings({ keepLoggedIn: false, savedToken: '' })
    set((s) => ({
      view: 'login',
      user: null,
      guilds: [],
      dms: [],
      messages: [],
      members: [],
      activeGuildId: null,
      activeChannelId: null,
      showSettings: false,
      settings: { ...s.settings, keepLoggedIn: false, savedToken: '' }
    }))
  },

  selectGuild: (id) => {
    set({ activeGuildId: id, showSettings: false })
  },

  openChannel: async (id) => {
    set({ activeChannelId: id, replyTarget: null, editingId: null })
    await api.openChannel(id)
  },

  openDM: async (id) => {
    set({ replyTarget: null, editingId: null })
    await api.openDM(id)
  },

  sendMessage: async (text) => {
    const s = get()
    if (!text.trim() || !s.activeChannelId) return
    if (s.editingId) {
      await api.editMessage(s.editingId, text)
      set({ editingId: null })
      return
    }
    if (s.replyTarget) {
      await api.reply(s.replyTarget.id, text)
      set({ replyTarget: null })
    } else {
      await api.sendText(text)
    }
  },

  applySettings: async (partial) => {
    const merged = await api.setSettings(partial)
    set({ settings: merged })
    if ('theme' in partial || 'colorTheme' in partial || 'accent' in partial) {
      const { palette, appearance } = resolvePalette(merged)
      applyPalette(palette, appearance)
    }
  },

  toggleMembers: () => set((s) => ({ showMembers: !s.showMembers })),
  setShowSettings: (v) => set({ showSettings: v }),
  setShowMusic: (v) => set({ showMusic: v }),
  toggleCollapsed: (key) => set((s) => ({ collapsed: { ...s.collapsed, [key]: !s.collapsed[key] } })),
  setReplyTarget: (m) => set({ replyTarget: m, editingId: null }),
  setEditing: (id) => set({ editingId: id, replyTarget: null }),
  openMenu: (x, y, messageId, mode) => set({ contextMenu: { x, y, messageId, mode } }),
  closeMenu: () => set({ contextMenu: null }),
  installUpdate: () => api.installUpdate(),

  pushToast: (text, kind = 'info') => {
    const id = toastSeq++
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }))
    setTimeout(() => get().dismissToast(id), 5000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

function maybeNotify(m: MessageData, s: State): void {
  if (m.isSelf) return
  // Read live state so a just-changed setting always applies.
  const st = useStore.getState()
  const mode = st.settings.notificationMode
  if (mode === 'none') return
  // "Only @mentions & DMs" uses directPing (excludes @everyone/@here spam).
  if (mode === 'pings' && !m.directPing) return
  // Never notify for the channel you're actively reading while focused.
  if (m.channelId === s.activeChannelId && st.windowFocused) return
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification(m.author, {
        body: m.content.slice(0, 160) || (m.images.length ? '📷 Image' : 'Sent an attachment'),
        silent: false
      })
      n.onclick = () => {
        window.focus()
        useStore.getState().openChannel(m.channelId)
      }
    }
  } catch {
    /* notifications unavailable */
  }
}
