import { useMemo } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'
import SelfProfile from './SelfProfile'
import Icon from './Icon'
import type { ChannelInfo } from '@shared/types'

function ChannelIcon({ type }: { type: ChannelInfo['type'] }): JSX.Element {
  if (type === 'voice' || type === 'stage')
    return <Icon name="mic" size={20} className="ch-icon" />
  if (type === 'announcement')
    return <Icon name="campaign" size={20} className="ch-icon" />
  if (type === 'forum')
    return <Icon name="forum" size={20} className="ch-icon" />
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
  const mutedChannels = useStore((s) => s.settings.mutedChannels || [])
  const user = useStore((s) => s.user)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setShowMusic = useStore((s) => s.setShowMusic)
  const openSelfProfile = useStore((s) => s.openSelfProfile)
  const showSelfProfile = useStore((s) => s.showSelfProfile)
  const openChannelMenu = useStore((s) => s.openChannelMenu)
  const openServerSettings = useStore((s) => s.openServerSettings)
  const openChannelSettings = useStore((s) => s.openChannelSettings)
  const openProfile = useStore((s) => s.openProfile)
  const joinVoiceChannel = useStore((s) => s.voice)
  const guild = useMemo(() => guilds.find((g) => g.id === activeGuildId) || null, [guilds, activeGuildId])

  const joinVoice = (id: string): void => {
    api.joinVoice(id)
    setShowMusic(true)
  }

  const channelRow = (ch: ChannelInfo): JSX.Element => {
    const isVoice = ch.type === 'voice' || ch.type === 'stage'
    const isMuted = mutedChannels.includes(ch.id)
    const hasUnread = !muted && !isMuted && (unread[ch.id] || 0) > 0
    const mentions = muted ? 0 : unreadMentions[ch.id] || 0
    const connectedHere = isVoice && joinVoiceChannel.connected && joinVoiceChannel.channelName === ch.name
    const vMembers = ch.voiceMembers || []
    return (
      <div key={ch.id} className="channel-wrap">
        <button
          className={
            'channel-row ' +
            (activeChannelId === ch.id ? 'active ' : '') +
            (hasUnread ? 'unread ' : '') +
            (isVoice ? 'voice ' : '') +
            (isMuted ? 'muted-channel ' : '') +
            (connectedHere ? 'connected' : '')
          }
          onClick={() => openChannel(ch.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            openChannelMenu(e.clientX, e.clientY, ch.id, ch.name, isVoice)
          }}
          title={isVoice ? 'Open voice channel chat' : ch.topic || ch.name}
        >
          {hasUnread && mentions === 0 && <span className="unread-dot" />}
          <ChannelIcon type={ch.type} />
          <span className="channel-name">{ch.name}</span>
          {connectedHere && <span className="voice-live">●</span>}
          {isVoice && vMembers.length > 0 && <span className="voice-count">{vMembers.length}</span>}
          {mentions > 0 && <span className="channel-badge">{mentions > 99 ? '99+' : mentions}</span>}
          {isVoice && (
            <span
              className="voice-join"
              role="button"
              tabIndex={0}
              title={connectedHere ? 'Connected' : 'Join voice'}
              onClick={(e) => {
                e.stopPropagation()
                joinVoice(ch.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  joinVoice(ch.id)
                }
              }}
            >
              <Icon name="call" size={14} />
            </span>
          )}
          <span
            className="channel-gear"
            role="button"
            tabIndex={0}
            title="Edit channel"
            onClick={(e) => {
              e.stopPropagation()
              openChannelSettings(ch.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                openChannelSettings(ch.id)
              }
            }}
          >
            <Icon name="settings" size={14} />
          </span>
        </button>
        {isVoice &&
          vMembers.map((vm) => (
            <button key={vm.id} className="voice-member" onClick={() => openProfile(vm.id)} title={vm.name}>
              <Avatar name={vm.name} src={vm.avatar} size={20} status="online" />
              <span>{vm.name}</span>
            </button>
          ))}
      </div>
    )
  }

  return (
    <aside className="channel-sidebar">
      <header className="sidebar-header">
        <div className="sidebar-header-text">
          <span className="sidebar-title">{activeGuildId === null ? 'Direct Messages' : guild?.name || 'Server'}</span>
          {activeGuildId !== null && guild && (
            <span className="sidebar-online">{guild.onlineCount} online</span>
          )}
        </div>
        {activeGuildId !== null && guild && (
          <button
            className="sidebar-gear"
            title="Server Settings"
            aria-label="Server Settings"
            onClick={() => openServerSettings()}
          >
            <Icon name="settings" size={18} />
          </button>
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
                    <Icon name="expand_more" size={12} className={'cat-caret ' + (isCollapsed ? 'closed' : '')} />
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
        {showSelfProfile && <SelfProfile />}
        <button className="user-panel-info" onClick={() => openSelfProfile()} title="Your bot — click for options">
          <Avatar name={user?.name || 'Bot'} src={user?.avatar} size={32} status="online" />
          <div className="user-panel-text">
            <span className="user-panel-name">{user?.name || 'Bot'}</span>
            <span className="user-panel-tag">{user?.guildCount ?? 0} servers</span>
          </div>
        </button>
        <button
          className={'user-panel-btn ' + (joinVoiceChannel.connected ? 'voice-on' : '')}
          onClick={() => setShowMusic(true)}
          title="Music"
          aria-label="Music"
        >
          <Icon name="music_note" size={20} />
        </button>
        <button className="user-panel-btn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
          <Icon name="settings" size={20} />
        </button>
      </footer>
    </aside>
  )
}
