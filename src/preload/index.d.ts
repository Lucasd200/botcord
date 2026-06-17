import type { BotcordApi } from './index'

declare global {
  interface Window {
    botcord: BotcordApi
  }
}

export {}
