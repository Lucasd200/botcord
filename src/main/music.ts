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

  async enqueue(query: string, requester = 'You'): Promise<void> {
    if (!this.connection) {
      this.emit('log', 'Join a voice channel first, then add a track.')
      return
    }
    let item: QueueItem | null = null
    try {
      const play = await import('play-dl')
      let url = query.trim()
      const isYt = play.yt_validate(url) === 'video'
      if (!isYt) {
        const results = await play.search(url, { limit: 1, source: { youtube: 'video' } })
        if (!results.length) {
          this.emit('log', 'Nothing found for: ' + query)
          return
        }
        url = results[0].url
        item = {
          title: results[0].title || query,
          url,
          duration: results[0].durationInSec || null,
          thumbnail: results[0].thumbnails?.[0]?.url || null,
          requester,
          local: false
        }
      } else {
        const info = await play.video_basic_info(url)
        const d = info.video_details
        item = {
          title: d.title || query,
          url,
          duration: d.durationInSec || null,
          thumbnail: d.thumbnails?.[0]?.url || null,
          requester,
          local: false
        }
      }
    } catch (e) {
      this.emit('log', 'Lookup error: ' + (e as Error).message)
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
