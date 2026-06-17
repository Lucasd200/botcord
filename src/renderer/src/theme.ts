/** Theme palettes + helpers — a TypeScript port of the Python `theme.py`. */

export type Palette = Record<string, string>

const DARK: Palette = {
  bg: '#313338',
  bgDark: '#2B2D31',
  bgDarker: '#1E1F22',
  bgFloat: '#111214',
  bgInput: '#383A40',
  hover: '#393C41',
  hoverLight: '#404249',
  active: '#404249',
  accent: '#5865F2',
  accentHover: '#4752C4',
  accentText: '#FFFFFF',
  text: '#F2F3F5',
  textMuted: '#B5BAC1',
  textDim: '#949BA4',
  textFaint: '#6D6F78',
  online: '#23A55A',
  idle: '#F0B232',
  dnd: '#F23F43',
  danger: '#DA373C',
  dangerHover: '#A12828',
  divider: '#3F4147',
  link: '#00A8FC',
  mention: '#444037',
  mentionBar: '#F0B232',
  shadow: 'rgba(0,0,0,0.45)'
}

function variant(over: Palette): Palette {
  return { ...DARK, ...over }
}

export const THEMES: Record<string, Palette> = {
  dark: { ...DARK },
  light: variant({
    bg: '#FFFFFF',
    bgDark: '#F2F3F5',
    bgDarker: '#E3E5E8',
    bgFloat: '#FFFFFF',
    bgInput: '#EBEDEF',
    hover: '#E3E5E8',
    hoverLight: '#D7D9DC',
    active: '#D7D9DC',
    text: '#1E1F22',
    textMuted: '#4E5058',
    textDim: '#5C5E66',
    textFaint: '#8A8D93',
    divider: '#E3E5E8',
    link: '#0067E0',
    mention: '#FBF5E2',
    danger: '#D83C3E',
    dangerHover: '#A12828',
    shadow: 'rgba(0,0,0,0.10)'
  }),
  ash: variant({
    bg: '#3A3C42',
    bgDark: '#313338',
    bgDarker: '#2B2D31',
    bgFloat: '#202124',
    bgInput: '#43454B',
    hover: '#43454B',
    hoverLight: '#4B4D54',
    active: '#4B4D54',
    divider: '#494B52'
  }),
  onyx: variant({
    bg: '#141416',
    bgDark: '#0D0E10',
    bgDarker: '#060607',
    bgFloat: '#000000',
    bgInput: '#1A1B1E',
    hover: '#1A1B1E',
    hoverLight: '#232428',
    active: '#232428',
    divider: '#202024',
    textDim: '#87898C'
  })
}

export const DEFAULT_THEME_SWATCHES: [string, string, string][] = [
  ['light', 'Light', '#FFFFFF'],
  ['dark', 'Dark', '#313338'],
  ['ash', 'Ash', '#3A3C42'],
  ['onyx', 'Onyx', '#0A0A0B']
]

export const COLOR_THEMES: [string, string, string][] = [
  ['Mint Apple', '#83EDB6', '#2FB37A'],
  ['Citrus Sherbet', '#FFD57E', '#F0883E'],
  ['Cotton Candy', '#CDB4FF', '#7D5BED'],
  ['Sea Foam', '#A7E8D6', '#36B59A'],
  ['Dusk', '#C9A9FF', '#8A6CF0'],
  ['Sakura', '#FFC1E3', '#E06FAE'],
  ['Clear Sky', '#BCDCFF', '#5B9BF0'],
  ['Sandstone', '#EFE3C0', '#C2A35A'],
  ['Midnight Blurple', '#7A6BFF', '#3A2FB0'],
  ['Aurora', '#5B9BFF', '#B14DF0'],
  ['Mango Sunset', '#FF7E5F', '#FEB47B'],
  ['Bubblegum', '#FF6FB5', '#A24DF0'],
  ['Forest', '#3FA45B', '#2F6E3F'],
  ['Crimson Moon', '#E0564F', '#B1342F'],
  ['Deep Indigo', '#5B5FD0', '#3B3FB0'],
  ['Maple', '#D08A5A', '#A35A36'],
  ['Teal Dream', '#3FBEB8', '#2F9E9A'],
  ['Neon Nights', '#E94560', '#9B2C46'],
  ['Ocean', '#26D0CE', '#1A6FA8']
]

export const AVATAR_PALETTE = [
  '#5865F2',
  '#3BA55D',
  '#FAA81A',
  '#ED4245',
  '#EB459E',
  '#9B59B6',
  '#1ABC9C',
  '#E67E22'
]

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return '#' + c(r) + c(g) + c(b)
}
export function mix(a: string, b: string, t: number): string {
  const [ra, ga, ba] = hexToRgb(a)
  const [rb, gb, bb] = hexToRgb(b)
  return rgbToHex(ra + (rb - ra) * t, ga + (gb - ga) * t, ba + (bb - ba) * t)
}
function luminance(h: string): number {
  const [r, g, b] = hexToRgb(h)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
export function isDark(h: string): boolean {
  try {
    return luminance(h) < 0.5
  } catch {
    return true
  }
}

function colorThemePalette(c1: string, c2: string): Palette {
  const pal = { ...THEMES.dark }
  pal.accent = c2
  pal.accentHover = mix(c2, '#000000', 0.25)
  pal.accentText = isDark(c2) ? '#FFFFFF' : '#11131A'
  pal.mention = mix(THEMES.dark.mention, c2, 0.3)
  pal.link = mix('#00A8FC', c2, 0.3)
  pal.bg = mix('#1D1E22', c1, 0.16)
  pal.bgDark = mix('#191A1D', c1, 0.16)
  pal.bgDarker = mix('#101012', c1, 0.18)
  pal.bgFloat = mix('#0A0A0C', c1, 0.16)
  pal.bgInput = mix('#26272B', c1, 0.14)
  pal.hover = pal.bgInput
  pal.hoverLight = mix('#2E2F34', c1, 0.14)
  pal.active = pal.hoverLight
  pal.divider = mix('#2A2B30', c1, 0.2)
  return pal
}

function osIsDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return true
  }
}

export interface ThemeSettings {
  theme: string
  colorTheme: string
  accent: string
}

export function resolvePalette(s: ThemeSettings): { palette: Palette; appearance: 'light' | 'dark' } {
  let name = s.theme || 'dark'
  const ctheme = s.colorTheme || ''
  if (name === 'sync') name = osIsDark() ? 'dark' : 'light'
  let appearance: 'light' | 'dark' = name === 'light' ? 'light' : 'dark'
  let palette = { ...(THEMES[name] || THEMES.dark) }

  if (ctheme) {
    appearance = 'dark'
    if (ctheme.startsWith('custom:')) {
      const c = ctheme.split(':')[1]
      palette = colorThemePalette(c, c)
    } else {
      const match = COLOR_THEMES.find((t) => t[0] === ctheme)
      if (match) palette = colorThemePalette(match[1], match[2])
    }
  } else if (s.accent) {
    palette.accent = s.accent
    palette.accentHover = mix(s.accent, '#000000', 0.25)
    palette.accentText = isDark(s.accent) ? '#FFFFFF' : '#11131A'
  }
  return { palette, appearance }
}

function camelToKebab(k: string): string {
  return k.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/** Push a palette into CSS custom properties on :root. */
export function applyPalette(palette: Palette, appearance: 'light' | 'dark'): void {
  const root = document.documentElement
  for (const [k, v] of Object.entries(palette)) {
    root.style.setProperty('--' + camelToKebab(k), v)
  }
  root.dataset.appearance = appearance
}

export function colorFor(key: string): string {
  let acc = 0
  for (const ch of String(key)) acc = (acc * 31 + ch.charCodeAt(0)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(acc) % AVATAR_PALETTE.length]
}

export function initials(name: string): string {
  const n = (name || '?').trim()
  const parts = n.split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (n.length >= 2) return n.slice(0, 2).toUpperCase()
  return (n.slice(0, 1) || '?').toUpperCase()
}
