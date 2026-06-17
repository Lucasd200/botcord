import { EventEmitter } from 'events'
import { basename } from 'path'
import { existsSync } from 'fs'
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
import type { Track } from '@shared/types'

// ffmpeg-static gives prism-media a binary without a system install.
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

/** Voice connection + music/soundboard playback via @discordjs/voice + play-dl. */
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

  constructor(client: Client) {
    super()
    this.client = client
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

  private scInit = false

  /** SoundCloud needs a free client id once per session. */
  private async ensureSoundcloud(play: any): Promise<boolean> {
    if (this.scInit) return true
    try {
      const id = await play.getFreeClientID()
      play.setToken({ soundcloud: { client_id: id } })
      this.scInit = true
      return true
    } catch {
      return false
    }
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

  private async resolveTrack(query: string, requester: string): Promise<QueueItem | null> {
    const play: any = await import('play-dl')
    const q = query.trim()

    if (/open\.spotify\.com/i.test(q)) {
      const term = (await this.spotifyToQuery(q)) || q
      const results = await play.search(term, { limit: 1, source: { youtube: 'video' } })
      if (!results.length) return null
      const r = results[0]
      return { title: r.title || term, url: r.url, duration: r.durationInSec || null, thumbnail: r.thumbnails?.[0]?.url || null, requester, local: false }
    }

    if (/soundcloud\.com/i.test(q)) {
      if (!(await this.ensureSoundcloud(play))) {
        this.emit('log', 'SoundCloud is unavailable right now.')
        return null
      }
      const info = await play.soundcloud(q)
      if (info?.type && info.type !== 'track') {
        this.emit('log', 'Only SoundCloud track links are supported.')
        return null
      }
      const durSec = info.durationInSec ?? (info.durationInMs ? Math.round(info.durationInMs / 1000) : null)
      return { title: info.name || q, url: q, duration: durSec, thumbnail: info.thumbnail || null, requester, local: false }
    }

    if (play.yt_validate(q) === 'video') {
      const info = await play.video_basic_info(q)
      const d = info.video_details
      return { title: d.title || q, url: q, duration: d.durationInSec || null, thumbnail: d.thumbnails?.[0]?.url || null, requester, local: false }
    }

    const results = await play.search(q, { limit: 1, source: { youtube: 'video' } })
    if (!results.length) return null
    const r = results[0]
    return { title: r.title || q, url: r.url, duration: r.durationInSec || null, thumbnail: r.thumbnails?.[0]?.url || null, requester, local: false }
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
    if (!item) {
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
      let resource
      if (this.current.local && this.current.localPath) {
        resource = createAudioResource(this.current.localPath, { inlineVolume: true })
      } else {
        const play = await import('play-dl')
        const stream = await play.stream(this.current.url!)
        resource = createAudioResource(stream.stream, {
          inputType: stream.type as unknown as StreamType,
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
