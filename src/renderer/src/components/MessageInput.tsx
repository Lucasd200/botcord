import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'

const EMOJI = ['😀', '😂', '🥰', '😎', '🤔', '👍', '🙏', '🎉', '🔥', '❤️', '✨', '👀', '😭', '💀', '🤖', '✅']

interface MentionItem {
  kind: 'user' | 'role'
  id: string
  name: string
  avatar: string | null
  color: string | null
}

export default function MessageInput(): JSX.Element {
  const activeGuildId = useStore((s) => s.activeGuildId)
  const guilds = useStore((s) => s.guilds)
  const members = useStore((s) => s.members)
  const activeChannelId = useStore((s) => s.activeChannelId)
  const channelName = useStore((s) => s.channelName)
  const isDM = useStore((s) => s.isDM)
  const replyTarget = useStore((s) => s.replyTarget)
  const editingId = useStore((s) => s.editingId)
  const messages = useStore((s) => s.messages)
  const setReplyTarget = useStore((s) => s.setReplyTarget)
  const setEditing = useStore((s) => s.setEditing)
  const sendMessage = useStore((s) => s.sendMessage)
  const setShowEmbed = useStore((s) => s.setShowEmbed)
  const pushToast = useStore((s) => s.pushToast)
  const mentionRequest = useStore((s) => s.mentionRequest)
  const mentionTargetId = useStore((s) => s.mentionTargetId)
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null)
  const [mIdx, setMIdx] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)
  const typingRef = useRef(0)

  const roles = useMemo(
    () => guilds.find((g) => g.id === activeGuildId)?.roles || [],
    [guilds, activeGuildId]
  )

  const results = useMemo<MentionItem[]>(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    const seen = new Set<string>()
    const users: MentionItem[] = []
    for (const m of members) {
      if (seen.has(m.id)) continue
      if (m.name.toLowerCase().includes(q)) {
        users.push({ kind: 'user', id: m.id, name: m.name, avatar: m.avatar, color: m.roleColor })
        seen.add(m.id)
      }
      if (users.length >= 6) break
    }
    const roleItems: MentionItem[] = roles
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((r) => ({ kind: 'role', id: r.id, name: r.name, avatar: null, color: r.color }))
    return [...users, ...roleItems].slice(0, 8)
  }, [mention, members, roles])

  useEffect(() => {
    if (editingId) {
      const m = messages.find((x) => x.id === editingId)
      setText(m?.content || '')
      ref.current?.focus()
    }
  }, [editingId, messages])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [text])

  // Insert a ping when "Mention" is clicked in a profile card.
  useEffect(() => {
    if (!mentionRequest || !mentionTargetId) return
    setText((t) => (t ? t.replace(/\s*$/, ' ') : '') + `<@${mentionTargetId}> `)
    ref.current?.focus()
  }, [mentionRequest, mentionTargetId])

  const detect = (value: string, cursor: number): void => {
    const before = value.slice(0, cursor)
    const m = before.match(/(^|\s)@([^@\n]{0,30})$/)
    if (m) {
      setMention({ query: m[2], start: cursor - m[2].length - 1 })
      setMIdx(0)
    } else {
      setMention(null)
    }
  }

  const choose = (item: MentionItem): void => {
    if (!mention) return
    const code = item.kind === 'role' ? `<@&${item.id}> ` : `<@${item.id}> `
    const end = mention.start + 1 + mention.query.length
    const next = text.slice(0, mention.start) + code + text.slice(end)
    setText(next)
    setMention(null)
    const pos = mention.start + code.length
    requestAnimationFrame(() => {
      const el = ref.current
      if (el) {
        el.focus()
        el.setSelectionRange(pos, pos)
      }
    })
  }

  const triggerTyping = (): void => {
    const now = Date.now()
    if (now - typingRef.current > 4000) {
      typingRef.current = now
      api.typing()
    }
  }

  const submit = async (): Promise<void> => {
    const value = text
    if (!value.trim()) return
    setText('')
    setShowEmoji(false)
    setMention(null)
    await sendMessage(value)
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (mention && results.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMIdx((i) => (i + 1) % results.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMIdx((i) => (i - 1 + results.length) % results.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        choose(results[mIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      if (editingId) setEditing(null)
      if (replyTarget) setReplyTarget(null)
    }
  }

  const attach = async (): Promise<void> => {
    const path = await api.pickFile()
    if (path) {
      await api.sendFile(path, text)
      setText('')
      pushToast('File sent', 'success')
    }
  }

  if (!activeChannelId) return <></>

  return (
    <div className="composer">
      {mention && results.length > 0 && (
        <div className="mention-popup">
          <div className="mention-head">{mention.query ? `Matching "${mention.query}"` : 'Members & roles'}</div>
          {results.map((r, i) => (
            <button
              key={r.kind + r.id}
              className={'mention-item ' + (i === mIdx ? 'active' : '')}
              onMouseEnter={() => setMIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(r)
              }}
            >
              {r.kind === 'user' ? (
                <Avatar name={r.name} src={r.avatar} size={22} />
              ) : (
                <i className="mention-role-dot" style={{ background: r.color || 'var(--text-faint)' }} />
              )}
              <span className="mention-name" style={r.color ? { color: r.color } : undefined}>
                {r.kind === 'role' ? '@' : ''}
                {r.name}
              </span>
              <span className="mention-kind">{r.kind}</span>
            </button>
          ))}
        </div>
      )}

      {replyTarget && (
        <div className="composer-banner">
          <span>Replying to <b>{replyTarget.author}</b></span>
          <button onClick={() => setReplyTarget(null)}>✕</button>
        </div>
      )}
      {editingId && (
        <div className="composer-banner edit">
          <span>Editing message · <i>escape to cancel</i></span>
          <button onClick={() => setEditing(null)}>✕</button>
        </div>
      )}
      <div className="composer-box">
        <button className="composer-attach" title="Send a file" onClick={attach}>
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <textarea
          ref={ref}
          rows={1}
          className="composer-input"
          placeholder={`Message ${isDM ? '@' : '#'}${channelName}`}
          value={text}
          spellCheck={useStore.getState().settings.spellcheck}
          onChange={(e) => {
            setText(e.target.value)
            detect(e.target.value, e.target.selectionStart || 0)
            triggerTyping()
          }}
          onKeyUp={(e) => detect((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart || 0)}
          onClick={(e) => detect((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart || 0)}
          onKeyDown={onKey}
        />
        <div className="composer-tools">
          {showEmoji && (
            <div className="emoji-popover">
              {EMOJI.map((e) => (
                <button key={e} onClick={() => { setText((t) => t + e); ref.current?.focus() }}>{e}</button>
              ))}
            </div>
          )}
          <button className="composer-emoji" title="Embed builder" onClick={() => setShowEmbed(true)}>
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 4v2h8V7H6Zm0 4v2h12v-2H6Zm0 4v2h9v-2H6Z" /><rect x="3" y="3" width="3" height="18" fill="var(--accent)" /></svg>
          </button>
          <button className="composer-emoji" title="Emoji" onClick={() => setShowEmoji((v) => !v)}>
            <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 17.5c-2.3 0-4.3-1.4-5-3.5h10c-.7 2.1-2.7 3.5-5 3.5Z" /></svg>
          </button>
          <button className={'composer-send ' + (text.trim() ? 'ready' : '')} title="Send" onClick={submit}>
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 20.5 22 12 3 3.5 3 10l13 2-13 2z" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
