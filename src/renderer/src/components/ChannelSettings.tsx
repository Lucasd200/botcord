import { useEffect } from 'react'
import { useStore } from '../store'
import { ChannelManage, glyph } from './ServerSettings'
import type { ActionResult } from '@shared/types'

/** Lightweight modal to edit one channel, opened by the gear next to a channel. */
export default function ChannelSettings(): JSX.Element | null {
  const channelSettingsId = useStore((s) => s.channelSettingsId)
  const detail = useStore((s) => s.serverDetail)
  const close = useStore((s) => s.closeChannelSettings)
  const reload = useStore((s) => s.reloadServerDetail)
  const pushToast = useStore((s) => s.pushToast)

  useEffect(() => {
    if (!channelSettingsId) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [channelSettingsId, close])

  if (!channelSettingsId) return null
  const channel = detail?.channels.find((c) => c.id === channelSettingsId) || null

  const act = async (p: Promise<ActionResult>, ok: string): Promise<boolean> => {
    const r = await p
    if (r.ok) {
      pushToast(ok, 'success')
      await reload()
    } else pushToast(r.error || 'Action failed.', 'error')
    return r.ok
  }

  return (
    <div className="chmodal-overlay" onMouseDown={close}>
      <div className="chmodal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="chmodal-head">
          <h3>{channel ? `${glyph(channel.type)} ${channel.name}` : 'Channel Settings'}</h3>
          <button className="embed-close" onClick={close} title="Close (Esc)">
            ✕
          </button>
        </div>
        <div className="chmodal-body">
          {channel ? (
            <ChannelManage channel={channel} act={act} onDeleted={close} />
          ) : (
            <div className="ss-loading">Loading…</div>
          )}
        </div>
      </div>
    </div>
  )
}
