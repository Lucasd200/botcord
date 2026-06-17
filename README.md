# Botcord

A beautiful desktop client for **your own Discord bot** — built with the same stack the real Discord app uses (**Electron + React + TypeScript**, powered by **discord.js**).

Log in with your bot token and you get a full Discord-style workspace: server rail, categories & channels, live chat with markdown, images, files, replies, edits, reactions and search, a member list grouped by role, DMs, bot-presence control, desktop notifications, and a full themes system — all fast, native, and cross-platform.

> This is **Botcord 2.0** — a complete rewrite of the original Python/customtkinter client into a real Electron app.

---

## ✨ Features

- **Secure login** — paste your bot token; it's encrypted with your OS keychain (DPAPI / Keychain / libsecret) via Electron `safeStorage` and never stored in plain text. "Keep me logged in" for instant auto-login.
- **Server rail** — all your bot's servers as icons, **drag to reorder**, unread badges, hover tooltips with member/online counts, a **Home** button for DMs.
- **Channels by category** — collapsible categories, text / voice / announcement / forum / stage icons, permission-aware (hides channels the bot can't see), unread indicators.
- **Rich chat** — grouped messages, real avatars, role colors, day dividers, **markdown** (bold/italic/underline/strike, inline & block code, quotes, links, mention pills), **inline images & GIFs**, file cards, and **reactions**.
- **Message actions** — reply, add reaction, **edit** & **delete** your bot's own messages, copy text — all from a hover toolbar.
- **Composer** — auto-growing input, emoji picker, file attach, typing indicator, send on Enter / newline on Shift+Enter.
- **Members** — online members grouped by hoisted role, status dots, activity, role colors; double-click to DM.
- **Search** — instant in-channel message/author search.
- **Bot presence** — set your bot's status (Online / Idle / DND / Invisible) and "Playing …" activity right from Settings.
- **Notifications** — desktop notifications with **All / Only @mentions & DMs / None** modes.
- **Themes** — Light / Dark / Ash / Onyx / **Sync (follow OS)**, 19 Nitro-style **color themes**, a custom **accent color** picker, compact mode — all applied instantly.
- **Frameless custom UI** — custom title bar with live gateway latency, native window controls, single-instance.

---

## 🚀 Run from source

```bash
npm install
npm run dev
```

The app opens on the login screen. Paste your bot token to connect.

### Getting a bot token
1. Open the [Discord Developer Portal](https://discord.com/developers/applications) → your application → **Bot**.
2. Click **Reset Token** and copy it.
3. Under **Privileged Gateway Intents**, enable **Message Content**, **Server Members** and **Presence Intent** (Botcord degrades gracefully if some are off, but enable them for the full experience).

---

## 📦 Build installers

Botcord packages for all three platforms with [electron-builder](https://www.electron.build/):

```bash
npm run dist:win     # Windows  -> release/Botcord-Setup-<version>.exe (NSIS)
npm run dist:mac     # macOS    -> release/Botcord-<version>-<arch>.dmg (x64 + arm64)
npm run dist:linux   # Linux    -> release/Botcord-<version>-<arch>.AppImage + .deb
```

> Each OS must be built on (or cross-built for) that OS. Build the Windows installer on Windows, the dmg on macOS, etc.

Output lands in `release/`.

---

## 🧱 Project layout

| Path | Purpose |
|------|---------|
| `src/main/` | Electron main process — `index.ts` (window + IPC), `bot.ts` (discord.js manager), `store.ts` (encrypted settings) |
| `src/preload/` | Secure `contextBridge` API exposed to the renderer |
| `src/shared/` | Types + IPC channel names shared across processes |
| `src/renderer/` | React + TypeScript UI (`components/`, `theme.ts`, `store.ts`, `format.tsx`, `styles/`) |
| `build/` | App icons (`icon.png`, `icon.ico`) + `electron-builder` resources |
| `scripts/` | `make-icon.ps1` — icon generator |

---

## 🛠 Tech

Electron 33 · React 18 · TypeScript 5 · discord.js 14 · Vite (electron-vite) · Zustand · electron-builder

Built by Lucas · [botcord.dev](https://botcord.dev)
