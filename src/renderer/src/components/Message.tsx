import { memo } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'
import Icon from './Icon'
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
                  <Icon name="description" size={22} filled style={{ color: 'var(--accent)' }} />
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
            <Icon name="add_reaction" size={18} />
          </button>
          <button title="Reply" onClick={() => setReplyTarget(m)}>
            <Icon name="reply" size={18} />
          </button>
          {m.isSelf && (
            <button title="Edit" onClick={() => setEditing(m.id)}>
              <Icon name="edit" size={18} />
            </button>
          )}
          <button title="Copy text" onClick={copy}>
            <Icon name="content_copy" size={18} />
          </button>
          {m.isSelf && (
            <button title="Delete" className="danger" onClick={del}>
              <Icon name="delete" size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(MessageRow)
