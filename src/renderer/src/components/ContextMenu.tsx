import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { api } from '../api'

const QUICK = ['👍', '❤️', '😂', '🎉', '😮', '😢']
const MORE = [
  '👍', '👎', '❤️', '🔥', '🎉', '😂', '😭', '😮', '😡', '😎',
  '🥰', '🤔', '👀', '🙏', '💀', '✅', '❌', '⭐', '💯', '🤖',
  '🫡', '👋', '🤝', '🙌', '👏', '💪', '🧠', '🎶', '⚡', '🚀'
]

export default function ContextMenu(): JSX.Element | null {
  const menu = useStore((s) => s.contextMenu)
  const messages = useStore((s) => s.messages)
  const activeGuildId = useStore((s) => s.activeGuildId)
  const closeMenu = useStore((s) => s.closeMenu)
  const setReplyTarget = useStore((s) => s.setReplyTarget)
  const setEditing = useStore((s) => s.setEditing)
  const pushToast = useStore((s) => s.pushToast)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [showAllEmoji, setShowAllEmoji] = useState(false)

  useEffect(() => {
    if (menu) setShowAllEmoji(menu.mode === 'react')
  }, [menu])

  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const pad = 8
    let x = menu.x
    let y = menu.y
    if (x + r.width + pad > window.innerWidth) x = window.innerWidth - r.width - pad
    if (y + r.height + pad > window.innerHeight) y = window.innerHeight - r.height - pad
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
  }, [menu, showAllEmoji])

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, closeMenu])

  if (!menu) return null
  const m = messages.find((x) => x.id === menu.messageId)
  if (!m) return null

  const react = (emoji: string): void => {
    api.addReaction(m.id, emoji)
    closeMenu()
  }
  const copy = (text: string, label: string): void => {
    navigator.clipboard.writeText(text).then(() => pushToast(label, 'success'))
    closeMenu()
  }
  const link = `https://discord.com/channels/${activeGuildId ?? '@me'}/${m.channelId}/${m.id}`

  return (
    <div className="ctx-overlay" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu() }}>
      <div
        ref={ref}
        className="ctx-menu"
        style={{ left: pos.x, top: pos.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ctx-reactions">
          {QUICK.map((e) => (
            <button key={e} onClick={() => react(e)} title={`React ${e}`}>{e}</button>
          ))}
          <button className="ctx-more" onClick={() => setShowAllEmoji((v) => !v)} title="More emoji">＋</button>
        </div>

        {showAllEmoji && (
          <div className="ctx-emoji-grid">
            {MORE.map((e, i) => (
              <button key={e + i} onClick={() => react(e)}>{e}</button>
            ))}
          </div>
        )}

        <div className="ctx-sep" />
        <button className="ctx-item" onClick={() => { setReplyTarget(m); closeMenu() }}>
          Reply <Kbd>↩</Kbd>
        </button>
        {m.isSelf && (
          <button className="ctx-item" onClick={() => { setEditing(m.id); closeMenu() }}>
            Edit Message <Kbd>✎</Kbd>
          </button>
        )}
        <div className="ctx-sep" />
        <button className="ctx-item" onClick={() => copy(m.content, 'Text copied')}>
          Copy Text <Kbd>⧉</Kbd>
        </button>
        <button className="ctx-item" onClick={() => copy(link, 'Message link copied')}>
          Copy Message Link <Kbd>🔗</Kbd>
        </button>
        <button className="ctx-item" onClick={() => copy(m.id, 'Message ID copied')}>
          Copy Message ID <Kbd>#</Kbd>
        </button>
        {m.isSelf && (
          <>
            <div className="ctx-sep" />
            <button
              className="ctx-item danger"
              onClick={() => { if (confirm('Delete this message?')) api.deleteMessage(m.id); closeMenu() }}
            >
              Delete Message <Kbd>🗑</Kbd>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }): JSX.Element {
  return <span className="ctx-kbd">{children}</span>
}
