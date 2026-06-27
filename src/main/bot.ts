import { EventEmitter } from 'events'
import {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  OverwriteType,
  PermissionsBitField,
  EmbedBuilder,
  type Message,
  type Guild,
  type TextBasedChannel,
  type GuildMember
} from 'discord.js'
import type { EmbedData } from '@shared/types'
import type {
  GuildInfo,
  CategoryInfo,
  ChannelInfo,
  MessageData,
  MemberData,
  DMInfo,
  HistoryPayload,
  ReplyRef,
  AttachmentFile,
  GuildDetail,
  RoleDetail,
  ChannelDetail,
  MemberDetail,
  ChannelOverwrite,
  ActionResult,
  PermValue,
  BotProfile
} from '@shared/types'
import { MusicManager } from './music'

const IMG_RE = /https?:\/\/\S+?\.(?:png|jpe?g|gif|webp)(?:\?\S*)?/gi

function acronym(name: string): string {
  return (name || '?')
    .replace(/'s /g, ' ')
    .replace(/\w+/g, (s) => s[0])
    .replace(/\s/g, '')
    .slice(0, 4)
}

/**
 * Owns the discord.js client and translates gateway events into plain,
 * serialisable payloads the renderer understands. Mirrors the Python
 * `DiscordBackend` but adds edits, reactions and richer channel typing.
 */
export class BotManager extends EventEmitter {
  client: Client | null = null
  music: MusicManager | null = null
  activeChannelId: string | null = null
  hasPresences = true
  hasMembers = true
  private historyLimit = 50
  private latencyTimer: NodeJS.Timeout | null = null
  private connected = false
  /** Cached member list per guild id, with the time it was built. Switching
   *  channels inside the same guild reuses the cache instead of re-fetching
   *  the whole member list from Discord every time. */
  private memberCache = new Map<string, { members: MemberData[]; ts: number }>()
  private static readonly MEMBER_CACHE_TTL = 60_000

  setHistoryLimit(n: number): void {
    this.historyLimit = Math.max(10, Math.min(100, n || 50))
  }

  private makeClient(presences: boolean, members: boolean): Client {
    const intents = [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions
    ]
    if (members) intents.push(GatewayIntentBits.GuildMembers)
    if (presences) intents.push(GatewayIntentBits.GuildPresences)
    return new Client({
      intents,
      partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
    })
  }

  /** Connect, with graceful fallback when privileged intents are disabled. */
  async login(token: string): Promise<{ ok: boolean; error?: string }> {
    token = (token || '').trim()
    if (!token) return { ok: false, error: 'Please enter a bot token.' }

    const attempts: Array<{ presences: boolean; members: boolean }> = [
      { presences: true, members: true },
      { presences: false, members: true },
      { presences: false, members: false }
    ]

    let lastError = 'Could not connect.'
    for (const a of attempts) {
      this.hasPresences = a.presences
      this.hasMembers = a.members
      const client = this.makeClient(a.presences, a.members)
      this.client = client
      this.registerEvents(client)
      try {
        await client.login(token)
        return { ok: true }
      } catch (err) {
        const msg = (err as Error)?.message || String(err)
        try {
          await client.destroy()
        } catch {
          /* ignore */
        }
        if (/token/i.test(msg) && /invalid/i.test(msg)) {
          return { ok: false, error: 'Invalid token. Double-check it in the Developer Portal.' }
        }
        if (/disallowed|privileged|not enabled|whitelisted/i.test(msg)) {
          lastError =
            'Enable the Message Content, Server Members and Presence intents in the ' +
            'Developer Portal → Bot, then log in again.'
          continue // try with fewer intents
        }
        lastError = msg
      }
    }
    return { ok: false, error: lastError }
  }

  private registerEvents(client: Client): void {
    client.once('ready', () => {
      this.connected = true
      const u = client.user!
      this.music = new MusicManager(client)
      for (const ev of ['voiceState', 'nowPlaying', 'queue', 'log'] as const) {
        this.music.on(ev, (...args: unknown[]) => this.emit(ev, ...args))
      }
      this.emitReady()
      this.emit('guilds', this.buildGuilds())
      this.emit('dms', this.recentDMs())
      this.startLatencyLoop()
    })

    client.on('guildCreate', () => this.emit('guilds', this.buildGuilds()))
    client.on('guildDelete', (g) => {
      this.memberCache.delete(g.id)
      this.emit('guilds', this.buildGuilds())
    })
    client.on('voiceStateUpdate', () => this.emit('guilds', this.buildGuilds()))
    client.on('roleCreate', () => this.emit('guilds', this.buildGuilds()))
    client.on('roleUpdate', () => this.emit('guilds', this.buildGuilds()))
    client.on('roleDelete', () => this.emit('guilds', this.buildGuilds()))
    client.on('guildUpdate', () => this.emit('guilds', this.buildGuilds()))
    client.on('channelCreate', () => this.emit('guilds', this.buildGuilds()))
    client.on('channelDelete', () => this.emit('guilds', this.buildGuilds()))
    client.on('channelUpdate', () => this.emit('guilds', this.buildGuilds()))

    client.on('messageCreate', (message) => {
      this.emit('message', this.messageToDict(message))
      if (message.channel.type === ChannelType.DM) this.emit('dms', this.recentDMs())
    })

    client.on('messageUpdate', (_old, neu) => {
      const full = neu.partial ? null : (neu as Message)
      if (full) this.emit('messageUpdate', this.messageToDict(full))
    })

    client.on('messageDelete', (message) => {
      this.emit('messageDelete', { channelId: message.channelId, id: message.id })
    })

    // Re-emit the message when reactions change so they update live under it.
    const onReaction = async (reaction: any): Promise<void> => {
      try {
        if (reaction.partial) reaction = await reaction.fetch()
        let msg = reaction.message
        if (msg.partial) msg = await msg.fetch()
        if (msg.channelId === this.activeChannelId) this.emit('messageUpdate', this.messageToDict(msg))
      } catch {
        /* ignore */
      }
    }
    client.on('messageReactionAdd', onReaction)
    client.on('messageReactionRemove', onReaction)

    client.on('typingStart', (typing) => {
      if (typing.channel.id === this.activeChannelId && typing.user.id !== client.user?.id) {
        this.emit('typing', { channelId: typing.channel.id, name: typing.user.username })
      }
    })

    client.on('shardDisconnect', () => {
      if (this.connected) this.emit('disconnect')
    })
    client.on('error', (e) => this.emit('log', 'Connection error: ' + e.message))
  }

  private emitReady(): void {
    const u = this.client?.user
    if (!u) return
    this.emit('ready', {
      id: u.id,
      name: u.username,
      discriminator: u.discriminator,
      avatar: u.displayAvatarURL({ size: 128 }),
      guildCount: this.client?.guilds.cache.size ?? 0
    })
  }

  async getBotProfile(): Promise<BotProfile | null> {
    if (!this.client?.user) return null
    let description = ''
    try {
      const app = this.client.application
      if (app) {
        await app.fetch().catch(() => {})
        description = app.description || ''
      }
    } catch {
      /* ignore */
    }
    return {
      username: this.client.user.username,
      description,
      avatar: this.client.user.displayAvatarURL({ size: 256 })
    }
  }

  async editBotProfile(changes: {
    username?: string
    description?: string
    avatarPath?: string
  }): Promise<ActionResult> {
    if (!this.client?.user) return { ok: false, error: 'Not connected.' }
    try {
      if (changes.avatarPath) await this.client.user.setAvatar(changes.avatarPath)
      if (changes.username && changes.username.trim()) {
        await this.client.user.setUsername(changes.username.trim())
      }
      if (changes.description != null && this.client.application) {
        await this.client.application.edit({ description: changes.description })
      }
      this.emitReady()
      return { ok: true }
    } catch (e) {
      const msg = (e as Error)?.message || String(e)
      if (/rate limit|too many/i.test(msg))
        return { ok: false, error: 'Discord rate-limits username changes (2 per hour). Try later.' }
      return { ok: false, error: this.actionError(e) }
    }
  }

  async getPins(channelId: string): Promise<MessageData[]> {
    const ch = (await this.fetchTextChannel(channelId)) as any
    if (!ch?.messages?.fetchPinned) return []
    try {
      const pinned = await ch.messages.fetchPinned()
      return [...pinned.values()]
        .sort((a: Message, b: Message) => a.createdTimestamp - b.createdTimestamp)
        .map((m: Message) => this.messageToDict(m))
    } catch {
      return []
    }
  }

  async pinMessage(messageId: string): Promise<ActionResult> {
    const ch = this.activeChannel() as any
    if (!ch) return { ok: false, error: 'No active channel.' }
    try {
      const m = await ch.messages.fetch(messageId)
      await m.pin()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  async unpinMessage(messageId: string): Promise<ActionResult> {
    const ch = this.activeChannel() as any
    if (!ch) return { ok: false, error: 'No active channel.' }
    try {
      const m = await ch.messages.fetch(messageId)
      await m.unpin()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  private startLatencyLoop(): void {
    if (this.latencyTimer) clearInterval(this.latencyTimer)
    this.latencyTimer = setInterval(() => {
      const ping = this.client?.ws.ping
      if (ping != null && ping >= 0 && Number.isFinite(ping)) this.emit('latency', Math.round(ping))
    }, 5000)
  }

  recentDMs(): DMInfo[] {
    const out: DMInfo[] = []
    if (!this.client) return out
    for (const ch of this.client.channels.cache.values()) {
      if (ch.type === ChannelType.DM) {
        const r = ch.recipient
        if (r) out.push({ id: r.id, name: r.displayName || r.username, avatar: r.displayAvatarURL({ size: 64 }) })
      }
    }
    return out.slice(0, 30)
  }

  private channelKind(type: ChannelType): ChannelInfo['type'] | null {
    switch (type) {
      case ChannelType.GuildText:
        return 'text'
      case ChannelType.GuildAnnouncement:
        return 'announcement'
      case ChannelType.GuildVoice:
        return 'voice'
      case ChannelType.GuildStageVoice:
        return 'stage'
      case ChannelType.GuildForum:
        return 'forum'
      default:
        return null
    }
  }

  buildGuilds(): GuildInfo[] {
    if (!this.client) return []
    const data: GuildInfo[] = []
    for (const guild of this.client.guilds.cache.values()) {
      const me = guild.members.me
      const cats = new Map<string, CategoryInfo>()
      const order: string[] = []
      const ensureCat = (id: string | null, name: string | null): CategoryInfo => {
        const key = id ?? '__none__'
        let c = cats.get(key)
        if (!c) {
          c = { id, name, channels: [] }
          cats.set(key, c)
          order.push(key)
        }
        return c
      }
      const voiceFlat: { id: string; name: string }[] = []

      const channels = [...guild.channels.cache.values()].sort(
        (a, b) => ((a as any).rawPosition ?? 0) - ((b as any).rawPosition ?? 0)
      )
      // Categories first so they exist before children reference them.
      for (const ch of channels) {
        if (ch.type === ChannelType.GuildCategory) ensureCat(ch.id, ch.name)
      }
      for (const ch of channels) {
        const kind = this.channelKind(ch.type)
        if (!kind) continue
        const tch = ch as any
        if (me) {
          try {
            if (!tch.permissionsFor(me)?.has(PermissionsBitField.Flags.ViewChannel)) continue
          } catch {
            /* keep channel if perms can't be read */
          }
        }
        const parentName = tch.parent ? tch.parent.name : null
        const cat = ensureCat(tch.parentId ?? null, parentName)
        const isVoiceKind = kind === 'voice' || kind === 'stage'
        const voiceMembers = isVoiceKind
          ? [...(tch.members?.values() ?? [])].map((m: any) => ({
              id: m.id,
              name: m.displayName,
              avatar: m.displayAvatarURL({ size: 32 })
            }))
          : undefined
        cat.channels.push({
          id: ch.id,
          name: ch.name,
          type: kind,
          nsfw: !!tch.nsfw,
          topic: tch.topic ?? null,
          voiceMembers
        })
        if (isVoiceKind) voiceFlat.push({ id: ch.id, name: ch.name })
      }

      const categories = order
        .map((k) => cats.get(k)!)
        .filter((c) => c.channels.length > 0)
        // categoryless channels float to the top, like Discord.
        .sort((a, b) => (a.id === null ? -1 : 0) - (b.id === null ? -1 : 0))

      let online = 0
      if (this.hasPresences) {
        for (const m of guild.members.cache.values()) {
          if (m.presence && m.presence.status !== 'offline') online++
        }
      }

      const roles = [...guild.roles.cache.values()]
        .filter((r) => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor !== '#000000' ? r.hexColor : null }))

      data.push({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 128 }) ?? null,
        acronym: acronym(guild.name),
        categories,
        voice: voiceFlat,
        roles,
        memberCount: guild.memberCount,
        onlineCount: online
      })
    }
    return data
  }

  private messageToDict(message: Message): MessageData {
    let replyTo: ReplyRef | null = null
    if (message.reference?.messageId) {
      const resolved = message.channel.messages?.cache.get(message.reference.messageId)
      if (resolved) {
        replyTo = {
          author: resolved.member?.displayName || resolved.author.username,
          content: (resolved.content || '[embed / attachment]').slice(0, 140),
          avatar: resolved.author.displayAvatarURL({ size: 32 })
        }
      } else {
        replyTo = { author: '', content: '' }
      }
    }

    const images: string[] = []
    const files: AttachmentFile[] = []
    for (const a of message.attachments.values()) {
      const ct = (a.contentType || '').toLowerCase()
      const isImg = ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(a.name)
      if (isImg) images.push(a.url)
      else files.push({ url: a.url, name: a.name, size: a.size })
    }
    for (const e of message.embeds) {
      if (e.image?.url) images.push(e.image.url)
      else if (e.thumbnail?.url) images.push(e.thumbnail.url)
    }
    const matches = (message.content || '').match(IMG_RE) || []
    for (const m of matches) if (!images.includes(m)) images.push(m)

    const me = this.client?.user
    let mentionsMe = false
    let directPing = false
    if (me) {
      if (message.channel.type === ChannelType.DM) {
        mentionsMe = true
        directPing = true
      } else {
        // ignoreRepliedUser stops discord.js's auto replied-user mention from
        // counting as a ping. mentionsMe (highlight) includes @everyone/@here;
        // directPing (notifications) excludes them so busy servers spamming
        // @everyone don't notify on "Only @mentions & DMs".
        const meRef = message.guild?.members.me ?? me.id
        mentionsMe = message.mentions.has(meRef, {
          ignoreEveryone: false,
          ignoreRoles: false,
          ignoreRepliedUser: true
        })
        // Strict: only a literal @mention of the bot in the message text counts
        // as a ping for the badge — not reply auto-mentions, role pings or
        // @everyone (which for a bot are mostly command spam). DMs set it above.
        directPing = new RegExp(`<@!?${me.id}>`).test(message.content || '')
      }
    }

    const roleColor =
      message.member && message.member.displayHexColor !== '#000000'
        ? message.member.displayHexColor
        : null

    const mentions = {
      users: {} as Record<string, string>,
      roles: {} as Record<string, { name: string; color: string | null }>,
      channels: {} as Record<string, string>
    }
    for (const [id, user] of message.mentions.users) {
      const member = message.mentions.members?.get(id)
      mentions.users[id] = member?.displayName || user.username
    }
    for (const [id, role] of message.mentions.roles) {
      mentions.roles[id] = { name: role.name, color: role.hexColor !== '#000000' ? role.hexColor : null }
    }
    for (const [id, ch] of message.mentions.channels) {
      mentions.channels[id] = (ch as any).name || 'channel'
    }

    return {
      id: message.id,
      channelId: message.channelId,
      isActiveChannel: this.activeChannelId != null && message.channelId === this.activeChannelId,
      author: message.member?.displayName || message.author.username,
      authorId: message.author.id,
      bot: message.author.bot,
      isSelf: me != null && message.author.id === me.id,
      content: message.content || '',
      timestamp: message.createdTimestamp,
      editedTimestamp: message.editedTimestamp,
      replyTo,
      avatarUrl: message.author.displayAvatarURL({ size: 64 }),
      roleColor,
      images,
      files,
      mentionsMe,
      directPing,
      pinned: message.pinned,
      mentions,
      reactions: message.reactions.cache.map((r) => ({
        emoji: r.emoji.name || '❓',
        id: r.emoji.id,
        animated: r.emoji.animated ?? false,
        count: r.count,
        me: r.me
      }))
    }
  }

  private async fetchTextChannel(id: string): Promise<TextBasedChannel | null> {
    if (!this.client) return null
    const ch = this.client.channels.cache.get(id) || (await this.client.channels.fetch(id))
    if (!ch) return null
    if (ch.isTextBased()) return ch as TextBasedChannel
    return null
  }

  async openChannel(channelId: string): Promise<void> {
    try {
      const channel = await this.fetchTextChannel(channelId)
      if (!channel) {
        this.emit('log', 'That is not a text channel.')
        return
      }
      this.activeChannelId = channel.id
      const guild = (channel as any).guild as Guild | undefined
      const isDM = channel.type === ChannelType.DM

      // History and members are independent — fetch them in parallel rather
      // than serially so the channel opens as fast as the slower of the two.
      const historyP = channel.messages.fetch({ limit: this.historyLimit })
      const membersP = guild ? this.loadMembers(guild) : Promise.resolve([] as MemberData[])

      const [fetched, members] = await Promise.all([historyP, membersP])
      const messages = [...fetched.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map((m) => this.messageToDict(m))

      const payload: HistoryPayload = {
        channelId: channel.id,
        messages,
        channelName: (channel as any).name || 'Direct Message',
        guildName: guild?.name || 'Direct Message',
        topic: (channel as any).topic ?? null,
        isDM
      }
      this.emit('history', payload)
      this.emit('members', members, guild?.name || '')
    } catch (err) {
      const msg = (err as Error)?.message || String(err)
      if (/missing access|permission/i.test(msg))
        this.emit('log', 'Missing access to that channel (check bot permissions).')
      else this.emit('log', 'Could not open channel: ' + msg)
    }
  }

  async openDM(userId: string): Promise<void> {
    try {
      if (!this.client) return
      const user = this.client.users.cache.get(userId) || (await this.client.users.fetch(userId))
      const dm = await user.createDM()
      this.activeChannelId = dm.id
      const fetched = await dm.messages.fetch({ limit: this.historyLimit })
      const messages = [...fetched.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map((m) => this.messageToDict(m))
      this.emit('history', {
        channelId: dm.id,
        messages,
        channelName: '@' + user.username,
        guildName: 'Direct Message',
        topic: null,
        isDM: true
      } as HistoryPayload)
      this.emit('members', [], '')
    } catch {
      this.emit('log', "Can't DM that user (no shared server or DMs closed).")
    }
  }

  private async loadMembers(guild: Guild): Promise<MemberData[]> {
    const cached = this.memberCache.get(guild.id)
    if (cached && Date.now() - cached.ts < BotManager.MEMBER_CACHE_TTL) {
      return cached.members
    }
    try {
      if (this.hasMembers) await guild.members.fetch()
    } catch {
      /* ignore — use cache */
    }
    const out: MemberData[] = []
    for (const m of guild.members.cache.values()) {
      const status = m.presence?.status || 'offline'
      if (this.hasPresences && (status === 'offline' || (status as string) === 'invisible')) continue
      const hoisted = [...m.roles.cache.values()].filter((r) => r.hoist)
      const role = hoisted.sort((a, b) => b.position - a.position)[0]
      const roleName = role ? role.name : this.hasPresences ? 'Online' : 'Members'
      let activity = ''
      if (m.voice.channel) activity = 'In voice'
      else {
        const act = m.presence?.activities?.[0]
        if (act?.name) activity = act.type === 2 ? 'Listening to ' + act.name : act.name
      }
      out.push({
        id: m.id,
        name: m.displayName,
        bot: m.user.bot,
        status: this.hasPresences ? status : '',
        activity,
        role: roleName,
        rolePos: role ? role.position : -1,
        roleColor: m.displayHexColor !== '#000000' ? m.displayHexColor : null,
        avatar: m.displayAvatarURL({ size: 64 })
      })
    }
    out.sort((a, b) => b.rolePos - a.rolePos || a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    const sliced = out.slice(0, 250)
    this.memberCache.set(guild.id, { members: sliced, ts: Date.now() })
    return sliced
  }

  private activeChannel(): TextBasedChannel | null {
    if (!this.client || !this.activeChannelId) return null
    const ch = this.client.channels.cache.get(this.activeChannelId)
    return ch?.isTextBased() ? (ch as TextBasedChannel) : null
  }

  async sendText(text: string): Promise<void> {
    const ch = this.activeChannel() as any
    if (!ch) {
      this.emit('log', 'No active channel.')
      return
    }
    try {
      await ch.send(text)
    } catch (e) {
      this.emit('log', 'Send failed: ' + (e as Error).message)
    }
  }

  async sendFile(path: string, text: string): Promise<void> {
    const ch = this.activeChannel() as any
    if (!ch) {
      this.emit('log', 'No active channel.')
      return
    }
    try {
      await ch.send({ content: text || undefined, files: [path] })
    } catch (e) {
      this.emit('log', 'File send failed: ' + (e as Error).message)
    }
  }

  async sendEmbed(data: EmbedData): Promise<void> {
    const ch = this.activeChannel() as any
    if (!ch) {
      this.emit('log', 'No active channel.')
      return
    }
    try {
      const embed = new EmbedBuilder()
      if (data.title) embed.setTitle(data.title.slice(0, 256))
      if (data.description) embed.setDescription(data.description.slice(0, 4096))
      if (data.url) embed.setURL(data.url)
      if (data.color) embed.setColor(parseInt(data.color.replace('#', ''), 16))
      if (data.authorName)
        embed.setAuthor({
          name: data.authorName.slice(0, 256),
          iconURL: data.authorIcon || undefined,
          url: data.authorUrl || undefined
        })
      if (data.footerText)
        embed.setFooter({ text: data.footerText.slice(0, 2048), iconURL: data.footerIcon || undefined })
      if (data.image) embed.setImage(data.image)
      if (data.thumbnail) embed.setThumbnail(data.thumbnail)
      if (data.timestamp) embed.setTimestamp()
      const fields = data.fields
        .filter((f) => f.name.trim() && f.value.trim())
        .slice(0, 25)
        .map((f) => ({ name: f.name.slice(0, 256), value: f.value.slice(0, 1024), inline: f.inline }))
      if (fields.length) embed.addFields(fields)

      const hasContent =
        data.title || data.description || data.authorName || data.footerText || data.image || fields.length
      if (!hasContent && !data.content) {
        this.emit('log', 'Add some content to the embed first.')
        return
      }
      await ch.send({ content: data.content || undefined, embeds: hasContent ? [embed] : [] })
      this.emit('log', 'Embed sent.')
    } catch (e) {
      this.emit('log', 'Embed failed: ' + (e as Error).message)
    }
  }

  async reply(messageId: string, text: string): Promise<void> {
    const ch = this.activeChannel() as any
    if (!ch) return
    try {
      const target = await ch.messages.fetch(messageId)
      await target.reply(text)
    } catch (e) {
      this.emit('log', 'Reply failed: ' + (e as Error).message)
    }
  }

  async editMessage(messageId: string, text: string): Promise<void> {
    const ch = this.activeChannel() as any
    if (!ch) return
    try {
      const target = await ch.messages.fetch(messageId)
      await target.edit(text)
    } catch (e) {
      this.emit('log', 'Edit failed: ' + (e as Error).message)
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    const ch = this.activeChannel() as any
    if (!ch) return
    try {
      const target = await ch.messages.fetch(messageId)
      await target.delete()
    } catch (e) {
      this.emit('log', 'Delete failed: ' + (e as Error).message)
    }
  }

  async addReaction(messageId: string, emoji: string): Promise<void> {
    const ch = this.activeChannel() as any
    if (!ch) return
    try {
      const target = await ch.messages.fetch(messageId)
      await target.react(emoji)
    } catch (e) {
      this.emit('log', 'Reaction failed: ' + (e as Error).message)
    }
  }

  async typing(): Promise<void> {
    const ch = this.activeChannel() as any
    try {
      await ch?.sendTyping?.()
    } catch {
      /* ignore */
    }
  }

  async setPresence(statusName: string, activityText: string): Promise<void> {
    if (!this.client?.user) return
    const map: Record<string, 'online' | 'idle' | 'dnd' | 'invisible'> = {
      Online: 'online',
      Idle: 'idle',
      'Do Not Disturb': 'dnd',
      Invisible: 'invisible'
    }
    try {
      this.client.user.setPresence({
        status: map[statusName] || 'online',
        activities: activityText ? [{ name: activityText, type: 0 }] : []
      })
      this.emit('log', 'Presence updated: ' + statusName + (activityText ? ' — playing ' + activityText : ''))
    } catch (e) {
      this.emit('log', 'Presence update failed: ' + (e as Error).message)
    }
  }

  async refreshMembers(): Promise<void> {
    const ch = this.activeChannel() as any
    const guild = ch?.guild as Guild | undefined
    if (guild) this.emit('members', await this.loadMembers(guild), guild.name)
  }

  async getProfile(userId: string): Promise<import('@shared/types').ProfileData | null> {
    if (!this.client) return null
    try {
      const user =
        this.client.users.cache.get(userId) || (await this.client.users.fetch(userId, { force: true }))
      const ch = this.activeChannel() as any
      const guild = ch?.guild as Guild | undefined
      let member: GuildMember | null = null
      if (guild) {
        member =
          guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null))
      }
      const roles = member
        ? [...member.roles.cache.values()]
            .filter((r) => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map((r) => ({ name: r.name, color: r.hexColor !== '#000000' ? r.hexColor : null }))
        : []
      return {
        id: user.id,
        username: user.discriminator && user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : user.username,
        displayName: member?.displayName || (user as any).globalName || user.username,
        avatar: user.displayAvatarURL({ size: 256 }),
        banner: user.bannerURL ? user.bannerURL({ size: 600 }) ?? null : null,
        bannerColor: (user as any).hexAccentColor ?? null,
        bot: user.bot,
        status: member?.presence?.status || '',
        roles,
        roleColor: member && member.displayHexColor !== '#000000' ? member.displayHexColor : null,
        createdAt: user.createdTimestamp,
        joinedAt: member?.joinedTimestamp ?? null
      }
    } catch {
      return null
    }
  }

  /** Custom emojis from every guild the bot is in, for the ":" autocomplete. */
  getEmojis(): import('@shared/types').EmojiInfo[] {
    if (!this.client) return []
    const out: import('@shared/types').EmojiInfo[] = []
    for (const e of this.client.emojis.cache.values()) {
      if (!e.name) continue
      out.push({
        name: e.name,
        id: e.id,
        animated: e.animated ?? false,
        url: e.imageURL({ size: 64 }) || e.url,
        guild: e.guild?.name || ''
      })
    }
    return out
  }

  // ---- server settings & management ----------------------------------------

  private actionError(e: unknown): string {
    const msg = (e as Error)?.message || String(e)
    if (/Missing Permissions/i.test(msg)) return 'The bot is missing the permission for that action.'
    if (/Missing Access/i.test(msg)) return 'The bot lacks access to that channel or server.'
    if (/hierarchy|higher|highest role/i.test(msg))
      return "The bot's role is not high enough to manage that target. Move its role up in Server Settings."
    if (/owner/i.test(msg)) return 'You cannot perform that action on the server owner.'
    return msg
  }

  /** Full snapshot of one guild for the Server Settings window. */
  async getGuildDetail(guildId: string): Promise<GuildDetail | null> {
    if (!this.client) return null
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return null
    try {
      if (this.hasMembers) await guild.members.fetch()
    } catch {
      /* fall back to cache */
    }
    const me = guild.members.me
    const myTopRolePos = me ? me.roles.highest.position : 0

    const roles: RoleDetail[] = [...guild.roles.cache.values()]
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor !== '#000000' ? r.hexColor : null,
        position: r.position,
        memberCount: r.members.size,
        managed: r.managed,
        hoist: r.hoist
      }))

    const channels: ChannelDetail[] = []
    const sorted = [...guild.channels.cache.values()].sort(
      (a, b) => ((a as any).rawPosition ?? 0) - ((b as any).rawPosition ?? 0)
    )
    for (const ch of sorted) {
      let type: ChannelDetail['type'] | null
      if (ch.type === ChannelType.GuildCategory) type = 'category'
      else type = this.channelKind(ch.type)
      if (!type) continue
      channels.push({
        id: ch.id,
        name: ch.name,
        type,
        parentId: (ch as any).parentId ?? null,
        position: (ch as any).rawPosition ?? 0
      })
    }

    const members: MemberDetail[] = [...guild.members.cache.values()]
      .map((m) => ({
        id: m.id,
        name: m.displayName,
        username: m.user.username,
        avatar: m.displayAvatarURL({ size: 64 }),
        bot: m.user.bot,
        roleIds: [...m.roles.cache.keys()].filter((id) => id !== guild.id),
        topRolePos: m.roles.highest.position,
        joinedAt: m.joinedTimestamp ?? null
      }))
      .sort((a, b) => b.topRolePos - a.topRolePos || a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .slice(0, 1000)

    const perms = me?.permissions
    const has = (f: bigint): boolean => !!perms?.has(f)
    return {
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      roles,
      channels,
      members,
      caps: {
        manageRoles: has(PermissionsBitField.Flags.ManageRoles),
        manageChannels: has(PermissionsBitField.Flags.ManageChannels),
        kick: has(PermissionsBitField.Flags.KickMembers),
        ban: has(PermissionsBitField.Flags.BanMembers),
        moderate: has(PermissionsBitField.Flags.ModerateMembers),
        myTopRolePos,
        isOwner: guild.ownerId === me?.id
      }
    }
  }

  async createChannel(
    guildId: string,
    name: string,
    kind: 'text' | 'voice' | 'category',
    parentId?: string | null
  ): Promise<ActionResult> {
    const guild = this.client?.guilds.cache.get(guildId)
    if (!guild) return { ok: false, error: 'Server not found.' }
    const clean = (name || '').trim()
    if (!clean) return { ok: false, error: 'Give the channel a name.' }
    const typeMap = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      category: ChannelType.GuildCategory
    } as const
    try {
      await guild.channels.create({
        name: clean,
        type: typeMap[kind],
        parent: kind === 'category' ? undefined : parentId || undefined
      })
      this.emit('guilds', this.buildGuilds())
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  async deleteChannel(channelId: string): Promise<ActionResult> {
    const ch = this.client?.channels.cache.get(channelId) as any
    if (!ch || typeof ch.delete !== 'function') return { ok: false, error: 'Channel not found.' }
    try {
      await ch.delete()
      this.emit('guilds', this.buildGuilds())
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  async editChannel(
    channelId: string,
    changes: { name?: string; topic?: string }
  ): Promise<ActionResult> {
    const ch = this.client?.channels.cache.get(channelId) as any
    if (!ch || typeof ch.edit !== 'function') return { ok: false, error: 'Channel not found.' }
    const opts: { name?: string; topic?: string } = {}
    if (changes.name != null && changes.name.trim()) opts.name = changes.name.trim()
    if (changes.topic != null) opts.topic = changes.topic
    if (Object.keys(opts).length === 0) return { ok: false, error: 'Nothing to change.' }
    try {
      await ch.edit(opts)
      this.emit('guilds', this.buildGuilds())
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  async getChannelPermissions(channelId: string): Promise<ChannelOverwrite[]> {
    const ch = this.client?.channels.cache.get(channelId) as any
    if (!ch?.permissionOverwrites) return []
    const guild = ch.guild as Guild | undefined
    const out: ChannelOverwrite[] = []
    for (const ow of ch.permissionOverwrites.cache.values()) {
      const type: 'role' | 'member' = ow.type === OverwriteType.Role ? 'role' : 'member'
      let name = ow.id
      if (type === 'role') name = guild?.roles.cache.get(ow.id)?.name ?? 'unknown role'
      else name = guild?.members.cache.get(ow.id)?.displayName ?? 'member'
      out.push({ targetId: ow.id, type, name, allow: ow.allow.toArray(), deny: ow.deny.toArray() })
    }
    return out
  }

  async setChannelPermission(
    channelId: string,
    targetId: string,
    perm: string,
    value: PermValue
  ): Promise<ActionResult> {
    const ch = this.client?.channels.cache.get(channelId) as any
    if (!ch?.permissionOverwrites) return { ok: false, error: 'Channel not found.' }
    const flag = (PermissionsBitField.Flags as Record<string, bigint>)[perm]
    if (flag === undefined) return { ok: false, error: 'Unknown permission.' }
    const v = value === 'allow' ? true : value === 'deny' ? false : null
    try {
      await ch.permissionOverwrites.edit(targetId, { [perm]: v })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  private async fetchMember(guildId: string, userId: string): Promise<GuildMember | null> {
    const guild = this.client?.guilds.cache.get(guildId)
    if (!guild) return null
    return guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null))
  }

  async setMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
    add: boolean
  ): Promise<ActionResult> {
    const member = await this.fetchMember(guildId, userId)
    if (!member) return { ok: false, error: 'Member not found.' }
    try {
      if (add) await member.roles.add(roleId)
      else await member.roles.remove(roleId)
      void this.refreshMembers()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  async kickMember(guildId: string, userId: string, reason?: string): Promise<ActionResult> {
    const member = await this.fetchMember(guildId, userId)
    if (!member) return { ok: false, error: 'Member not found.' }
    if (!member.kickable) return { ok: false, error: "The bot can't kick that member (role hierarchy)." }
    try {
      await member.kick(reason || undefined)
      void this.refreshMembers()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  async banMember(guildId: string, userId: string, reason?: string): Promise<ActionResult> {
    const guild = this.client?.guilds.cache.get(guildId)
    if (!guild) return { ok: false, error: 'Server not found.' }
    try {
      await guild.members.ban(userId, { reason: reason || undefined })
      void this.refreshMembers()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  /** minutes <= 0 clears the timeout. */
  async timeoutMember(guildId: string, userId: string, minutes: number): Promise<ActionResult> {
    const member = await this.fetchMember(guildId, userId)
    if (!member) return { ok: false, error: 'Member not found.' }
    if (!member.moderatable)
      return { ok: false, error: "The bot can't time out that member (role hierarchy)." }
    try {
      await member.timeout(minutes > 0 ? Math.min(minutes, 40320) * 60 * 1000 : null)
      void this.refreshMembers()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: this.actionError(e) }
    }
  }

  // ---- voice + music (delegate to MusicManager) ----------------------------
  joinVoice(id: string): void {
    void this.music?.join(id)
  }
  leaveVoice(): void {
    this.music?.leave()
  }
  musicEnqueue(query: string): void {
    void this.music?.enqueue(query)
  }
  musicPlayLocal(path: string): void {
    this.music?.enqueueLocal(path)
  }
  musicPause(): void {
    this.music?.pause()
  }
  musicResume(): void {
    this.music?.resume()
  }
  musicSkip(): void {
    this.music?.skip()
  }
  musicStop(): void {
    this.music?.stop()
  }
  musicSetVolume(v: number): void {
    this.music?.setVolume(v)
  }
  musicToggleLoop(): boolean {
    return this.music?.toggleLoop() ?? false
  }
  musicShuffle(): void {
    this.music?.shuffle()
  }
  musicRemove(i: number): void {
    this.music?.remove(i)
  }

  async logout(): Promise<void> {
    if (this.latencyTimer) clearInterval(this.latencyTimer)
    this.latencyTimer = null
    this.connected = false
    this.activeChannelId = null
    try {
      this.music?.leave()
    } catch {
      /* ignore */
    }
    this.music = null
    try {
      await this.client?.destroy()
    } catch {
      /* ignore */
    }
    this.client = null
    this.memberCache.clear()
  }
}
