import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'

/** Popover listing the active channel's pinned messages, with jump + unpin. */
export default function PinsPopover(): JSX.Element {
  const pins = useStore((s) => s.pins)
  const close = useStore((s) => s.closePins)
  const jump = useStore((s) => s.jumpToMessage)
  const pushToast = useStore((s) => s.pushToast)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
    }
  }, [close])

  const unpin = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    const r = await api.unpinMessage(id)
    if (r.ok) {
      useStore.setState({ pins: useStore.getState().pins.filter((p) => p.id !== id) })
      pushToast('Message unpinned', 'success')
    } else pushToast(r.error || 'Unpin failed', 'error')
  }

  return (
    <div className="pins-popover" ref={ref}>
      <div className="pins-head">Pinned Messages</div>
      <div className="pins-list">
        {pins.length === 0 && <div className="pins-empty">This channel has no pinned messages.</div>}
        {pins.map((m) => (
          <div key={m.id} className="pin-item" onClick={() => jump(m.id)} title="Jump to message">
            <Avatar name={m.author} src={m.avatarUrl} size={36} />
            <div className="pin-body">
              <div className="pin-author" style={m.roleColor ? { color: m.roleColor } : undefined}>
                {m.author}
              </div>
              <div className="pin-content">
                {m.content || (m.images.length ? '📷 Image' : '[attachment]')}
              </div>
            </div>
            <button className="pin-unpin" title="Unpin" onClick={(e) => unpin(m.id, e)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
