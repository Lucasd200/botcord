import { useMemo, useState } from 'react'
import { useStore } from '../store'
import Message from './Message'
import MessageInput from './MessageInput'
import PinsPopover from './PinsPopover'
import Icon from './Icon'

function dayKey(ts: number): string {
  return new Date(ts).toDateString()
}
function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ChatView(): JSX.Element {
  const messages = useStore((s) => s.messages)
  const channelName = useStore((s) => s.channelName)
  const topic = useStore((s) => s.topic)
  const isDM = useStore((s) => s.isDM)
  const activeChannelId = useStore((s) => s.activeChannelId)
  const showMembers = useStore((s) => s.showMembers)
  const toggleMembers = useStore((s) => s.toggleMembers)
  const openChannelSettings = useStore((s) => s.openChannelSettings)
  const togglePins = useStore((s) => s.togglePins)
  const showPins = useStore((s) => s.showPins)
  const jumpToMessage = useStore((s) => s.jumpToMessage)
  const jumpTarget = useStore((s) => s.jumpTarget)
  const typingUser = useStore((s) => s.typingUser)
  const compact = useStore((s) => s.settings.compactMessages)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return messages
    const q = query.toLowerCase()
    return messages.filter((m) => m.content.toLowerCase().includes(q) || m.author.toLowerCase().includes(q))
  }, [messages, query])

  if (!activeChannelId) {
    return (
      <div className="chat-view">
        <div className="chat-empty">
          <Icon name="forum" size={92} style={{ opacity: 0.18 }} />
          <h2>No channel open</h2>
          <p>Pick a server on the left, then choose a channel to start reading and chatting as your bot.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-view">
      <header className="chat-header">
        <div className="chat-header-title">
          {isDM ? <span className="ch-at">@</span> : <span className="ch-hash big">#</span>}
          <span className="chat-channel-name">{channelName}</span>
          {topic && <><span className="header-sep" /><span className="chat-topic">{topic}</span></>}
        </div>
        <div className="chat-header-actions">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {activeChannelId && (
            <div className="header-pins">
              <button className={'header-btn ' + (showPins ? 'active' : '')} title="Pinned messages" onClick={togglePins}>
                <Icon name="push_pin" size={20} />
              </button>
              {showPins && <PinsPopover />}
            </div>
          )}
          {!isDM && activeChannelId && (
            <button
              className="header-btn"
              title="Edit Channel"
              onClick={() => openChannelSettings(activeChannelId)}
            >
              <Icon name="settings" size={20} />
            </button>
          )}
          {!isDM && (
            <button className={'header-btn ' + (showMembers ? 'active' : '')} title="Toggle member list" onClick={toggleMembers}>
              <Icon name="groups" size={22} />
            </button>
          )}
        </div>
      </header>

      <div className="message-area">
        <div id="message-scroll" className="message-scroll">
          <div className="channel-intro">
            <div className="intro-hash">{isDM ? '@' : '#'}</div>
            <h2>{isDM ? channelName : 'Welcome to #' + channelName}</h2>
            <p>{isDM ? 'This is the start of your direct message history.' : 'This is the beginning of the #' + channelName + ' channel.'}</p>
          </div>

          {filtered.map((m, i) => {
            const prev = filtered[i - 1]
            const newDay = !prev || dayKey(prev.timestamp) !== dayKey(m.timestamp)
            const grouped =
              !newDay &&
              !!prev &&
              prev.authorId === m.authorId &&
              !m.replyTo &&
              m.timestamp - prev.timestamp < 7 * 60 * 1000
            return (
              <div key={m.id} id={'msg-' + m.id} className={'msg-wrap' + (jumpTarget === m.id ? ' jump-flash' : '')}>
                {newDay && (
                  <div className="day-divider">
                    <span>{dayLabel(m.timestamp)}</span>
                  </div>
                )}
                {query.trim() && (
                  <button className="msg-jump" onClick={() => { setQuery(''); jumpToMessage(m.id) }} title="Jump to message">
                    Jump
                  </button>
                )}
                <Message m={m} grouped={grouped} compact={compact} />
              </div>
            )
          })}

          {query && filtered.length === 0 && <div className="search-empty">No messages match “{query}”.</div>}
        </div>

        {typingUser && (
          <div className="typing-indicator">
            <span className="typing-dots"><i /><i /><i /></span>
            <b>{typingUser}</b> is typing…
          </div>
        )}
      </div>

      <MessageInput />
    </div>
  )
}
