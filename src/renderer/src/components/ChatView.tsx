import { useMemo, useState } from 'react'
import { useStore } from '../store'
import Message from './Message'
import MessageInput from './MessageInput'
import PinsPopover from './PinsPopover'

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
          <svg width="92" height="92" viewBox="0 0 24 24" opacity="0.18"><path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" /></svg>
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
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5Zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z" /></svg>
            <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {activeChannelId && (
            <div className="header-pins">
              <button className={'header-btn ' + (showPins ? 'active' : '')} title="Pinned messages" onClick={togglePins}>
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M14 4v5l2 3v2h-5v5l-1 1-1-1v-5H4v-2l2-3V4a2 2 0 0 1-1-1.7V2h10v.3A2 2 0 0 1 14 4Z" /></svg>
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
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.5h-3.8l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.7 7.7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h3.8l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" /></svg>
            </button>
          )}
          {!isDM && (
            <button className={'header-btn ' + (showMembers ? 'active' : '')} title="Toggle member list" onClick={toggleMembers}>
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-2.7 0-8 1.3-8 4v3h8v-3c0-1 .4-1.9 1-2.6A12 12 0 0 0 8 13Zm8 0c-.3 0-.7 0-1.1.1 1 .8 1.6 1.8 1.6 2.9v3h7.5v-3c0-2.7-5.3-4-8-4Z" /></svg>
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
