import { useMemo } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'
import type { ChannelInfo } from '@shared/types'

function ChannelIcon({ type }: { type: ChannelInfo['type'] }): JSX.Element {
  if (type === 'voice' || type === 'stage')
    return <svg className="ch-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm7 9a7 7 0 0 1-6 6.92V21h-2v-2.08A7 7 0 0 1 5 12h2a5 5 0 0 0 10 0Z" /></svg>
  if (type === 'announcement')
    return <svg className="ch-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M3 10v4h3l4 4V6L6 10H3Zm13 2a4 4 0 0 0-2-3.46v6.92A4 4 0 0 0 16 12Z" /></svg>
  if (type === 'forum')
    return <svg className="ch-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16v10H7l-3 3V4Z" /></svg>
  return <span className="ch-hash">#</span>
}

export default function ChannelSidebar(): JSX.Element {
  const guilds = useStore((s) => s.guilds)
  const dms = useStore((s) => s.dms)
  const activeGuildId = useStore((s) => s.activeGuildId)
  const activeChannelId = useStore((s) => s.activeChannelId)
  const openChannel = useStore((s) => s.openChannel)
  const openDM = useStore((s) => s.openDM)
  const collapsed = useStore((s) => s.collapsed)
  const toggleCollapsed = useStore((s) => s.toggleCollapsed)
  const unread = useStore((s) => s.unread)
  const unreadMentions = useStore((s) => s.unreadMentions)
  const muted = useStore((s) => s.settings.notificationMode === 'none')
  const user = useStore((s) => s.user)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setShowMusic = useStore((s) => s.setShowMusic)
  const joinVoiceChannel = useStore((s) => s.voice)
  const guild = useMemo(() => guilds.find((g) => g.id === activeGuildId) || null, [guilds, activeGuildId])

  const joinVoice = (id: string): void => {
    api.joinVoice(id)
    setShowMusic(true)
  }

  const channelRow = (ch: ChannelInfo): JSX.Element => {
    const isVoice = ch.type === 'voice' || ch.type === 'stage'
    const hasUnread = (unread[ch.id] || 0) > 0
    const mentions = muted ? 0 : unreadMentions[ch.id] || 0
    const connectedHere = isVoice && joinVoiceChannel.connected && joinVoiceChannel.channelName === ch.name
    return (
      <button
        key={ch.id}
        className={
          'channel-row ' +
          (activeChannelId === ch.id ? 'active ' : '') +
          (hasUnread ? 'unread ' : '') +
          (isVoice ? 'voice ' : '') +
          (connectedHere ? 'connected' : '')
        }
        onClick={() => (isVoice ? joinVoice(ch.id) : openChannel(ch.id))}
        title={isVoice ? 'Click to join voice' : ch.topic || ch.name}
      >
        {hasUnread && mentions === 0 && <span className="unread-dot" />}
        <ChannelIcon type={ch.type} />
        <span className="channel-name">{ch.name}</span>
        {connectedHere && <span className="voice-live">●</span>}
        {mentions > 0 && <span className="channel-badge">{mentions > 99 ? '99+' : mentions}</span>}
      </button>
    )
  }

  return (
    <aside className="channel-sidebar">
      <header className="sidebar-header">
        <span className="sidebar-title">{activeGuildId === null ? 'Direct Messages' : guild?.name || 'Server'}</span>
        {activeGuildId !== null && guild && (
          <span className="sidebar-online">{guild.onlineCount} online</span>
        )}
      </header>

      <div className="channel-scroll">
        {activeGuildId === null ? (
          <>
            <div className="dm-search-hint">Recent conversations</div>
            {dms.length === 0 && <div className="dm-empty">No direct messages yet. They appear here as your bot chats with users.</div>}
            {dms.map((d) => (
              <button
                key={d.id}
                className={'dm-row ' + (activeChannelId === d.id ? 'active' : '')}
                onClick={() => openDM(d.id)}
              >
                <Avatar name={d.name} src={d.avatar} size={32} />
                <span className="channel-name">{d.name}</span>
              </button>
            ))}
          </>
        ) : guild ? (
          guild.categories.map((cat, i) => {
            const key = cat.id || `__none__${i}`
            const isCollapsed = collapsed[key]
            return (
              <div className="category" key={key}>
                {cat.name && (
                  <button className="category-header" onClick={() => toggleCollapsed(key)}>
                    <svg className={'cat-caret ' + (isCollapsed ? 'closed' : '')} viewBox="0 0 24 24"><path fill="currentColor" d="M7 10l5 5 5-5z" /></svg>
                    <span>{cat.name}</span>
                  </button>
                )}
                {!isCollapsed && cat.channels.map(channelRow)}
              </div>
            )
          })
        ) : (
          <div className="dm-empty">Loading…</div>
        )}
      </div>

      <footer className="user-panel">
        <div className="user-panel-info">
          <Avatar name={user?.name || 'Bot'} src={user?.avatar} size={32} status="online" />
          <div className="user-panel-text">
            <span className="user-panel-name">{user?.name || 'Bot'}</span>
            <span className="user-panel-tag">{user?.guildCount ?? 0} servers</span>
          </div>
        </div>
        <button
          className={'user-panel-btn ' + (joinVoiceChannel.connected ? 'voice-on' : '')}
          onClick={() => setShowMusic(true)}
          title="Music"
          aria-label="Music"
        >
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 17.5A2.5 2.5 0 1 1 6.5 15c.6 0 1.1.2 1.5.5V4l11-2v12.5a2.5 2.5 0 1 1-2-2.45V6L10 7.2v10.3Z" /></svg>
        </button>
        <button className="user-panel-btn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.5h-3.8l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.7 7.7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h3.8l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" /></svg>
        </button>
      </footer>
    </aside>
  )
}
