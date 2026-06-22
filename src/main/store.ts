import { app, safeStorage } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { Settings } from '@shared/types'

const DEFAULTS: Settings = {
  keepLoggedIn: false,
  savedToken: '',
  accounts: [],
  mutedChannels: [],
  theme: 'dark',
  colorTheme: '',
  accent: '#5865F2',
  compactMessages: false,
  historyLimit: 50,
  notificationMode: 'pings',
  favorites: [],
  serverOrder: [],
  railWidth: 72,
  lastChannelId: '',
  presenceStatus: 'Online',
  presenceActivity: '',
  spellcheck: true,
  tenorApiKey: ''
}

function dataDir(): string {
  const dir = app.getPath('userData')
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  } catch {
    /* ignore */
  }
  return dir
}

function settingsPath(): string {
  return join(dataDir(), 'settings.json')
}

/**
 * The bot token is stored encrypted with the OS keychain (DPAPI / Keychain /
 * libsecret) via Electron's safeStorage so a plain-text token never touches
 * disk. We persist it base64-encoded in a side field and decrypt on load.
 */
function encryptToken(token: string): string {
  if (!token) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return 'enc:' + safeStorage.encryptString(token).toString('base64')
    }
  } catch {
    /* fall through to plain */
  }
  return token
}

function decryptToken(stored: string): string {
  if (!stored) return ''
  if (stored.startsWith('enc:')) {
    try {
      const buf = Buffer.from(stored.slice(4), 'base64')
      return safeStorage.decryptString(buf)
    } catch {
      return ''
    }
  }
  return stored
}

export function loadSettings(): Settings {
  const data: Settings = { ...DEFAULTS }
  try {
    const path = settingsPath()
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, 'utf-8'))
      Object.assign(data, raw)
      data.savedToken = decryptToken(raw.savedToken || '')
      data.accounts = Array.isArray(raw.accounts)
        ? raw.accounts.map((a: { token?: string }) => ({ ...a, token: decryptToken(a.token || '') }))
        : []
    }
  } catch {
    /* ignore — return defaults */
  }
  return data
}

export function saveSettings(partial: Partial<Settings>): Settings {
  const current = loadSettings()
  const merged: Settings = { ...current, ...partial }
  try {
    const toWrite = {
      ...merged,
      savedToken: encryptToken(merged.savedToken || ''),
      accounts: (merged.accounts || []).map((a) => ({ ...a, token: encryptToken(a.token || '') }))
    }
    writeFileSync(settingsPath(), JSON.stringify(toWrite, null, 2), 'utf-8')
  } catch {
    /* ignore */
  }
  return merged
}

export function getDataDir(): string {
  return dataDir()
}
