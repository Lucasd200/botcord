import { memo } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'
import { formatContent } from '../format'
import type { MessageData } from '@shared/types'

function timeLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Today at ${time}`
  if (d.toDateString() === yest.toDateString()) return `Yesterday at ${time}`
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + time
}

interface Props {
  m: MessageData
  grouped: boolean
  compact: boolean
}

function MessageRow({ m, grouped, compact }: Props): JSX.Element {
  const setReplyTarget = useStore((s) => s.setReplyTarget)
  const setEditing = useStore((s) => s.setEditing)
  const openMenu = useStore((s) => s.openMenu)
  const openProfile = useStore((s) => s.openProfile)
  const pushToast = useStore((s) => s.pushToast)

  const copy = (): void => {
    navigator.clipboard.writeText(m.content).then(() => pushToast('Copied to clipboard', 'success'))
  }
  const del = (): void => {
    if (confirm('Delete this message?')) api.deleteMessage(m.id)
  }
  const onContext = (e: React.MouseEvent): void => {
    e.preventDefault()
    openMenu(e.clientX, e.clientY, m.id, 'full')
  }
  const reactIdentifier = (r: { emoji: string; id: string | null }): string =>
    r.id ? `${r.emoji}:${r.id}` : r.emoji

  return (
    <div
      className={'message ' + (grouped ? 'grouped ' : '') + (compact ? 'compact ' : '') + (m.mentionsMe ? 'mention ' : '')}
      data-id={m.id}
      onContextMenu={onContext}
    >
      {m.replyTo && (
        <div className="reply-line">
          <svg className="reply-curve" viewBox="0 0 16 10"><path fill="none" stroke="var(--text-faint)" strokeWidth="1.5" d="M14 9H6a3 3 0 0 1-3-3V1" /></svg>
          {m.replyTo.avatar && <Avatar name={m.replyTo.author} src={m.replyTo.avatar} size={16} />}
          <span className="reply-author">{m.replyTo.author}</span>
          <span className="reply-content">{m.replyTo.content || 'Click to see attachment'}</span>
        </div>
      )}

      <div className="message-inner">
        <div className="message-gutter">
          {grouped ? (
            <span className="gutter-time">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          ) : (
            <button className="avatar-btn" onClick={() => openProfile(m.authorId)} title="View profile">
              <Avatar name={m.author} src={m.avatarUrl} size={40} />
            </button>
          )}
        </div>

        <div className="message-content">
          {!grouped && (
            <div className="message-head">
              <span
                className="message-author clickable"
                style={m.roleColor ? { color: m.roleColor } : undefined}
                onClick={() => openProfile(m.authorId)}
              >
                {m.author}
              </span>
              {m.bot && <span className="bot-tag">{m.isSelf ? 'YOU' : 'APP'}</span>}
              <span className="message-time">{timeLabel(m.timestamp)}</span>
            </div>
          )}

          {m.content && <div className="message-text">{formatContent(m.content, m.mentions)}{m.editedTimestamp && <span className="edited">(edited)</span>}</div>}

          {m.images.length > 0 && (
            <div className="message-media">
              {m.images.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer" className="media-link">
                  <img src={src} loading="lazy" alt="attachment" />
                </a>
              ))}
            </div>
          )}

          {m.files.length > 0 && (
            <div className="message-files">
              {m.files.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="file-card">
                  <svg viewBox="0 0 24 24" width="22" height="22"><path fill="var(--accent)" d="M6 2h8l4 4v16H6z" /><path fill="var(--bg-darker)" d="M14 2v4h4z" /></svg>
                  <div className="file-meta">
                    <span className="file-name">{f.name}</span>
                    {f.size != null && <span className="file-size">{(f.size / 1024).toFixed(1)} KB</span>}
                  </div>
                </a>
              ))}
            </div>
          )}

          {m.reactions.length > 0 && (
            <div className="reactions">
              {m.reactions.map((r, i) => (
                <button
                  key={i}
                  className={'reaction ' + (r.me ? 'me' : '')}
                  onClick={() => api.addReaction(m.id, reactIdentifier(r))}
                  title={r.id ? `:${r.emoji}:` : r.emoji}
                >
                  {r.id ? (
                    <img
                      className="reaction-emoji"
                      src={`https://cdn.discordapp.com/emojis/${r.id}.${r.animated ? 'gif' : 'png'}?size=32`}
                      alt={r.emoji}
                    />
                  ) : (
                    <span>{r.emoji}</span>
                  )}
                  <span className="reaction-count">{r.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="message-actions">
          <button title="Add reaction" onClick={(e) => openMenu(e.clientX - 150, e.clientY + 10, m.id, 'react')}>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 17.5c-2 0-3.7-1.2-4.4-3h8.8c-.7 1.8-2.4 3-4.4 3Z" /></svg>
          </button>
          <button title="Reply" onClick={() => setReplyTarget(m)}>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4c5 0 8 1.5 10 5-1-5-4-10-10-11Z" /></svg>
          </button>
          {m.isSelf && (
            <button title="Edit" onClick={() => setEditing(m.id)}>
              <svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" /></svg>
            </button>
          )}
          <button title="Copy text" onClick={copy}>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" /></svg>
          </button>
          {m.isSelf && (
            <button title="Delete" className="danger" onClick={del}>
              <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm9-3 1 2H8l1-2h6Z" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(MessageRow, areEqual)

/**
 * Custom memo comparator. The main process rebuilds every message dict on
 * each channel switch (fresh object references even for unchanged messages),
 * which would defeat the default shallow compare and re-run formatContent
 * for every row. Treat two messages as equal when their visible fields
 * match, so re-entering a channel with overlapping history skips work.
 * Edits/reactions arrive via onMessageUpdate and replace the message by id,
 * so those updates still trigger a re-render (the field comparison changes).
 */
function areEqual(prev: Props, next: Props): boolean {
  if (prev.grouped !== next.grouped || prev.compact !== next.compact) return false
  const a = prev.m
  const b = next.m
  return (
    a.id === b.id &&
    a.content === b.content &&
    a.editedTimestamp === b.editedTimestamp &&
    a.author === b.author &&
    a.avatarUrl === b.avatarUrl &&
    a.roleColor === b.roleColor &&
    a.mentionsMe === b.mentionsMe &&
    a.images.length === b.images.length &&
    a.files.length === b.files.length &&
    a.reactions.length === b.reactions.length &&
    a.reactions.every((r, i) => r.count === b.reactions[i].count && r.me === b.reactions[i].me) &&
    a.images.every((u, i) => u === b.images[i])
  )
}
