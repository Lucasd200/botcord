import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'

/** Right-click menu for a channel in the sidebar. */
export default function ChannelContextMenu(): JSX.Element | null {
  const menu = useStore((s) => s.channelMenu)
  const close = useStore((s) => s.closeChannelMenu)
  const muted = useStore((s) => s.settings.mutedChannels || [])
  const guildId = useStore((s) => s.activeGuildId)
  const toggleMute = useStore((s) => s.toggleMuteChannel)
  const markRead = useStore((s) => s.markChannelRead)
  const openChannelSettings = useStore((s) => s.openChannelSettings)
  const pushToast = useStore((s) => s.pushToast)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const pad = 8
    let x = menu.x
    let y = menu.y
    if (x + r.width + pad > window.innerWidth) x = window.innerWidth - r.width - pad
    if (y + r.height + pad > window.innerHeight) y = window.innerHeight - r.height - pad
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, close])

  if (!menu) return null
  const isMuted = muted.includes(menu.channelId)

  const copyLink = (): void => {
    navigator.clipboard.writeText(`https://discord.com/channels/${guildId ?? '@me'}/${menu.channelId}`)
    pushToast('Channel link copied', 'success')
    close()
  }
  const del = async (): Promise<void> => {
    const name = menu.channelName
    const id = menu.channelId
    close()
    if (confirm(`Delete #${name}? This cannot be undone.`)) {
      const r = await api.deleteChannel(id)
      pushToast(r.ok ? 'Channel deleted' : r.error || 'Delete failed', r.ok ? 'success' : 'error')
    }
  }

  return (
    <div className="ctx-overlay" onClick={close} onContextMenu={(e) => { e.preventDefault(); close() }}>
      <div ref={ref} className="ctx-menu" style={{ left: pos.x, top: pos.y }} onClick={(e) => e.stopPropagation()}>
        <button className="ctx-item" onClick={() => { markRead(menu.channelId); close() }}>
          Mark As Read
        </button>
        <button className="ctx-item" onClick={() => { toggleMute(menu.channelId); close() }}>
          {isMuted ? 'Unmute Channel' : 'Mute Channel'}
        </button>
        <div className="ctx-sep" />
        <button className="ctx-item" onClick={copyLink}>
          Copy Link
        </button>
        <div className="ctx-sep" />
        <button className="ctx-item" onClick={() => { openChannelSettings(menu.channelId); close() }}>
          Edit Channel
        </button>
        <button className="ctx-item danger" onClick={del}>
          Delete Channel
        </button>
      </div>
    </div>
  )
}
