# Botcord

**Run your Discord bot like you'd run an account.** Botcord is a desktop app that logs in with your bot's token and gives you a full, familiar Discord-style window — so instead of staring at a terminal or a dashboard, you can actually *see* the servers your bot is in, read the chat, send messages, react, manage members, and even play music in voice. It looks and feels like Discord, but everything you do happens as your bot.

It's free, it updates itself, and it runs on **Windows** and **macOS**.

> Botcord is a complete rewrite of the original Python version into a real desktop app (Electron + React + discord.js), so it's faster, prettier, and far more capable.

---

## Get it

Head to **[botcord.dev](https://botcord.dev)** and click **Download**, then pick your platform:

- **Windows** — run the installer (`Botcord-Setup.exe`). It adds Botcord to your Start menu, so you can find it by searching "Botcord".
- **macOS** — download the `.zip` for your Mac (**arm64** for Apple Silicon, **x64** for Intel), unzip it, and drag **Botcord.app** into Applications. The first time, **right-click the app → Open** (this is a one-time macOS thing for apps from outside the App Store). If it ever says the app is "damaged", run this once in Terminal and you're set:
  ```bash
  xattr -dr com.apple.quarantine /Applications/Botcord.app
  ```

Once a new version ships, Botcord tells you with an **"Update Ready"** button in the top-right — click it and you're on the latest.

---

## Log in

You sign in with your **bot's token**, not a username and password.

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and pick your application.
2. Go to **Bot → Reset Token** and copy it.
3. While you're there, turn on the three **Privileged Gateway Intents** (Message Content, Server Members, Presence). Botcord still works without them, but you'll get the full experience with them on.
4. Paste the token into Botcord and hit **Log in**. Tick **Keep me logged in** and it'll reconnect automatically next time.

Your token is encrypted with your operating system's keychain and never leaves your computer.

---

## A quick tour

Once you're in, it'll feel instantly familiar:

- **Pick a server** from the rail on the far left, then **choose a channel**. You can drag servers to reorder them, and the **🏠 home button** holds your DMs.
- **Chat like normal.** Type a message and press Enter. Markdown works (**bold**, *italics*, `code`, and code blocks), and so do custom emojis, images, and file attachments.
- **Mention people.** Start typing `@` and a list of members and roles pops up — arrow keys or click to drop in a real ping. Mentions show the actual name and role color, not raw IDs.
- **React and manage messages.** Hover a message for quick reactions, or **right-click** any message for the full menu: reply, add a reaction, edit or delete your bot's own messages, copy the text, link, or ID.
- **See who's who.** Click anyone's **name or avatar** to open their profile — avatar, roles, status, and join date — with buttons to **mention** them or **DM** them.
- **Hang out in voice.** Click a 🔊 voice channel to make your bot join. You'll see everyone connected listed right under the channel.
- **Play music.** Open the music panel and paste a **YouTube, Spotify, or SoundCloud** link (or just type a song name). Queue tracks, skip, loop, shuffle, adjust volume, or drop in a local file as a soundboard clip.
- **Make it yours.** In Settings → Appearance, switch between Light, Dark, Ash, Onyx, or Sync-with-your-OS, pick from 19 color themes, or set a custom accent — it all applies instantly.
- **Stay notified, your way.** Choose **All messages**, **Only @mentions & DMs**, or **None**. The channel list shows a red badge only when your bot is actually mentioned, so busy servers stay quiet.

That's it — there's nothing to configure. Log in and use it.

---

## Having trouble?

- **"Enable the intents" on login** → flip on Message Content, Server Members, and Presence in the Developer Portal (Bot tab), then log in again.
- **No members showing** → that needs the Server Members (and ideally Presence) intent.
- **Music won't play** → make sure the bot joined a voice channel first and has permission to Connect and Speak there.

Still stuck? Join the **[Discord](https://discord.gg/3yn4qSX4Gj)** or email **lucas@botcord.dev**.

---

## For developers

Want to run it from source or build it yourself?

```bash
npm install
npm run dev        # launch in development
```

Build installers (each on its own OS):

```bash
npm run dist:win     # Windows installer (.exe)
npm run dist:mac     # macOS app (.zip, x64 + arm64)
```

Under the hood: **Electron + React + TypeScript**, with **discord.js** for the bot connection, bundled by electron-vite and packaged with electron-builder.

| Folder | What's in it |
|--------|--------------|
| `src/main/` | The Electron main process — window, the discord.js bot manager, voice/music, settings |
| `src/preload/` | The secure bridge between the app and the bot |
| `src/renderer/` | The React interface you actually see |
| `scripts/` | Icon generator + the macOS signing hook |

---

Built by Lucas · [botcord.dev](https://botcord.dev) · [Discord](https://discord.gg/3yn4qSX4Gj)
