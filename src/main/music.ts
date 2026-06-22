import { EventEmitter } from 'events'
import { basename, join, dirname } from 'path'
import { existsSync, chmodSync } from 'fs'
import type { ChildProcess } from 'child_process'
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  type VoiceConnection,
  type AudioPlayer
} from '@discordjs/voice'
import { ChannelType, type Client, type VoiceChannel } from 'discord.js'
import { create as createYtDlp } from 'youtube-dl-exec'
import type { Track } from '@shared/types'

// ffmpeg-static gives prism-media a binary without a system install. yt-dlp
// streams the source container to stdout and @discordjs/voice transcodes it to
// opus through this ffmpeg.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ff = require('ffmpeg-static')
  if (ff) process.env.FFMPEG_PATH = ff
} catch {
  /* optional */
}

interface QueueItem extends Track {
  localPath?: string
}

/**
 * Resolve the bundled yt-dlp binary. In a packaged app the JS lives inside
 * app.asar but native/executable files are unpacked next to it, so the path has
 * to be rewritten to app.asar.unpacked or spawning fails (child_process does not
 * go through Electron's asar shim).
 */
function resolveYtDlp(): string {
  const name = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  let pkgDir: string
  try {
    pkgDir = dirname(require.resolve('youtube-dl-exec/package.json'))
  } catch {
    pkgDir = join(__dirname, '..', '..', 'node_modules', 'youtube-dl-exec')
  }
  let bin = join(pkgDir, 'bin', name)
  // In a packaged app the JS resolves inside app.asar, but executables are
  // unpacked alongside it (see asarUnpack in electron-builder.yml).
  if (bin.includes('app.asar') && !bin.includes('app.asar.unpacked')) {
    bin = bin.replace('app.asar', 'app.asar.unpacked')
  }
  if (process.platform !== 'win32') {
    try {
      chmodSync(bin, 0o755)
    } catch {
      /* bundle may be read-only; npm/electron-builder preserves the exec bit */
    }
  }
  return bin
}

/** Voice connection + music/soundboard playback via @discordjs/voice + yt-dlp. */
export class MusicManager extends EventEmitter {
  private client: Client
  private connection: VoiceConnection | null = null
  private player: AudioPlayer | null = null
  private guildId: string | null = null
  private queue: QueueItem[] = []
  private current: QueueItem | null = null
  private resource: ReturnType<typeof createAudioResource> | null = null
  private volume = 0.5
  private loop = false
  private channelName = ''
  private ytProc: ChildProcess | null = null
  private yt: ReturnType<typeof createYtDlp> | null = null

  constructor(client: Client) {
    super()
    this.client = client
  }

  private ytdlp(): ReturnType<typeof createYtDlp> {
    if (!this.yt) this.yt = createYtDlp(resolveYtDlp())
    return this.yt
  }

  private ensurePlayer(): AudioPlayer {
    if (this.player) return this.player
    const player = createAudioPlayer()
    player.on(AudioPlayerStatus.Idle, () => this.advance())
    player.on('error', (e) => {
      this.emit('log', 'Playback error: ' + e.message)
      this.advance()
    })
    this.player = player
    return player
  }

  async join(channelId: string): Promise<void> {
    try {
      const ch = (this.client.channels.cache.get(channelId) ||
        (await this.client.channels.fetch(channelId))) as VoiceChannel | null
      if (!ch || (ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice)) {
        this.emit('log', 'That is not a voice channel.')
        return
      }
      this.guildId = ch.guild.id
      this.channelName = ch.name
      this.connection = joinVoiceChannel({
        channelId: ch.id,
        guildId: ch.guild.id,
        adapterCreator: ch.guild.voiceAdapterCreator,
        selfDeaf: false
      })
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000)
      this.connection.subscribe(this.ensurePlayer())
      this.connection.on(VoiceConnectionStatus.Disconnected, () => this.leave())
      this.emit('voiceState', { connected: true, channelName: ch.name })
      this.emit('log', 'Joined voice: ' + ch.name)
    } catch (e) {
      this.emit('log', 'Voice join failed: ' + (e as Error).message)
    }
  }

  leave(): void {
    this.queue = []
    this.current = null
    this.killProc()
    try {
      this.player?.stop(true)
      this.connection?.destroy()
    } catch {
      /* ignore */
    }
    this.connection = null
    this.guildId = null
    this.emit('voiceState', { connected: false, channelName: '' })
    this.emit('nowPlaying', null)
    this.emit('queue', [])
  }

  private killProc(): void {
    if (this.ytProc) {
      try {
        this.ytProc.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      this.ytProc = null
    }
  }

  private snapshot(): Track[] {
    return this.queue.map((t) => ({
      title: t.title,
      url: t.url,
      duration: t.duration,
      thumbnail: t.thumbnail,
      requester: t.requester,
      local: t.local
    }))
  }

  private emitNowPlaying(): void {
    if (!this.current) {
      this.emit('nowPlaying', null)
      return
    }
    this.emit('nowPlaying', {
      title: this.current.title,
      duration: this.current.duration,
      thumbnail: this.current.thumbnail,
      requester: this.current.requester,
      paused: this.player?.state.status === AudioPlayerStatus.Paused,
      loop: this.loop
    })
  }

  /** Spotify has no public stream — scrape the title and find it on YouTube. */
  private async spotifyToQuery(url: string): Promise<string | null> {
    const decode = (s: string): string =>
      s
        .replace(/&amp;/g, '&')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const html = await res.text()
      const title = html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]
      const desc = html.match(/<meta property="og:description" content="([^"]+)"/i)?.[1]
      if (!title) return null
      let artist = ''
      if (desc) artist = decode(desc.split('·')[0]?.trim() || '')
      return decode(title) + (artist && !title.includes(artist) ? ' ' + artist : '')
    } catch {
      return null
    }
  }

  /** Ask yt-dlp for metadata (works for a URL or a "ytsearch1:" search term). */
  private async metaFromYtDlp(
    target: string,
    requester: string,
    fallbackTitle?: string
  ): Promise<QueueItem | null> {
    try {
      const raw = (await this.ytdlp()(target, {
        dumpSingleJson: true,
        noPlaylist: true,
        noWarnings: true
      })) as unknown as Record<string, unknown>
      const info = (Array.isArray((raw as any).entries) ? (raw as any).entries[0] : raw) as
        | Record<string, unknown>
        | undefined
      if (!info) return null
      const thumbs = info.thumbnails as Array<{ url?: string }> | undefined
      const thumb =
        (info.thumbnail as string | undefined) ||
        (thumbs && thumbs.length ? thumbs[thumbs.length - 1]?.url : undefined) ||
        null
      const url =
        (info.webpage_url as string | undefined) ||
        (info.original_url as string | undefined) ||
        (/^https?:\/\//i.test(target) ? target : null)
      const dur = info.duration
      return {
        title: (info.title as string) || fallbackTitle || target,
        url,
        duration: typeof dur === 'number' ? Math.round(dur) : null,
        thumbnail: thumb,
        requester,
        local: false
      }
    } catch (e) {
      const stderr = (e as { stderr?: string }).stderr
      const msg = stderr ? String(stderr).trim().split('\n').pop() : (e as Error).message
      this.emit('log', 'Lookup failed: ' + msg)
      return null
    }
  }

  private async resolveTrack(query: string, requester: string): Promise<QueueItem | null> {
    const q = query.trim()
    // Spotify can't be streamed directly — pull the title and search YouTube.
    if (/open\.spotify\.com/i.test(q)) {
      const term = (await this.spotifyToQuery(q)) || q
      return this.metaFromYtDlp('ytsearch1:' + term, requester, term)
    }
    // Any direct link (YouTube, SoundCloud, and the many other sites yt-dlp
    // supports) is handed straight to yt-dlp.
    if (/^https?:\/\//i.test(q)) return this.metaFromYtDlp(q, requester)
    // Plain text -> YouTube search.
    return this.metaFromYtDlp('ytsearch1:' + q, requester, q)
  }

  async enqueue(query: string, requester = 'You'): Promise<void> {
    if (!this.connection) {
      this.emit('log', 'Join a voice channel first, then add a track.')
      return
    }
    let item: QueueItem | null = null
    try {
      item = await this.resolveTrack(query, requester)
    } catch (e) {
      this.emit('log', 'Lookup error: ' + (e as Error).message)
      return
    }
    if (!item || !item.url) {
      this.emit('log', 'Nothing found for: ' + query)
      return
    }
    this.queue.push(item)
    this.emit('queue', this.snapshot())
    this.emit('log', 'Queued: ' + item.title)
    if (!this.current) this.advance()
  }

  enqueueLocal(path: string): void {
    if (!this.connection) {
      this.emit('log', 'Join a voice channel first.')
      return
    }
    if (!existsSync(path)) {
      this.emit('log', 'File not found: ' + path)
      return
    }
    const item: QueueItem = {
      title: basename(path),
      url: null,
      duration: null,
      thumbnail: null,
      requester: 'You',
      local: true,
      localPath: path
    }
    this.queue.push(item)
    this.emit('queue', this.snapshot())
    this.emit('log', 'Queued file: ' + item.title)
    if (!this.current) this.advance()
  }

  private async advance(): Promise<void> {
    this.killProc()
    if (this.loop && this.current) {
      // replay current
    } else {
      this.current = this.queue.shift() || null
    }
    if (!this.current) {
      this.resource = null
      this.emit('nowPlaying', null)
      this.emit('queue', this.snapshot())
      return
    }
    try {
      let resource: ReturnType<typeof createAudioResource>
      if (this.current.local && this.current.localPath) {
        resource = createAudioResource(this.current.localPath, { inlineVolume: true })
      } else {
        // yt-dlp downloads the best audio to stdout; ffmpeg (via @discordjs/voice)
        // transcodes the arbitrary container to opus.
        const sub = this.ytdlp().exec(
          this.current.url!,
          {
            output: '-',
            format: 'bestaudio/best',
            quiet: true,
            noWarnings: true,
            noPlaylist: true,
            // Be polite to YouTube's throttling so playback doesn't stutter.
            limitRate: '8M'
          },
          { stdio: ['ignore', 'pipe', 'ignore'] }
        ) as unknown as ChildProcess & Promise<unknown>
        // Killing the process on skip/stop makes it exit non-zero; swallow that.
        ;(sub as unknown as Promise<unknown>).catch(() => {})
        this.ytProc = sub
        if (!sub.stdout) throw new Error('yt-dlp produced no audio stream')
        resource = createAudioResource(sub.stdout, {
          inputType: StreamType.Arbitrary,
          inlineVolume: true
        })
      }
      resource.volume?.setVolume(this.volume)
      this.resource = resource
      this.ensurePlayer().play(resource)
      this.emitNowPlaying()
      this.emit('queue', this.snapshot())
      this.emit('log', 'Now playing: ' + this.current.title)
    } catch (e) {
      this.emit('log', 'Could not play: ' + (e as Error).message)
      this.advance()
    }
  }

  pause(): void {
    this.player?.pause()
    this.emitNowPlaying()
  }
  resume(): void {
    this.player?.unpause()
    this.emitNowPlaying()
  }
  skip(): void {
    this.player?.stop()
  }
  stop(): void {
    this.queue = []
    this.current = null
    this.loop = false
    this.killProc()
    this.player?.stop(true)
    this.emit('nowPlaying', null)
    this.emit('queue', [])
    this.emit('log', 'Stopped and cleared the queue.')
  }
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    this.resource?.volume?.setVolume(this.volume)
  }
  toggleLoop(): boolean {
    this.loop = !this.loop
    this.emitNowPlaying()
    return this.loop
  }
  shuffle(): void {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]
    }
    this.emit('queue', this.snapshot())
  }
  remove(index: number): void {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1)
      this.emit('queue', this.snapshot())
    }
  }
}
