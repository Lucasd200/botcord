import { useEffect, useState } from 'react'
import { api } from '../api'
import { useStore } from '../store'

export default function TitleBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const latency = useStore((s) => s.latency)
  const view = useStore((s) => s.view)
  const update = useStore((s) => s.update)
  const installUpdate = useStore((s) => s.installUpdate)
  const isMac = api.platform === 'darwin'

  useEffect(() => {
    if (isMac) return
    api.windowIsMaximized().then(setMaximized)
    return api.onMaximizeChange((v: boolean) => setMaximized(v))
  }, [isMac])

  return (
    <div className={'titlebar' + (isMac ? ' mac' : '')}>
      <div className="titlebar-drag">
        <div className="titlebar-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="var(--accent)"
              d="M20 4.5A16.5 16.5 0 0 0 15.7 3l-.2.4a15 15 0 0 1 4 .9 13.6 13.6 0 0 0-4.7-.8 13.6 13.6 0 0 0-4.7.8 15 15 0 0 1 4-.9L9.9 3A16.5 16.5 0 0 0 5.6 4.5C2.9 8.5 2.2 12.4 2.5 16.2A16.7 16.7 0 0 0 7.6 18l.4-.6c-.8-.3-1.6-.7-2.3-1.2l.6-.4a11.8 11.8 0 0 0 10 0l.6.4c-.7.5-1.5.9-2.3 1.2l.4.6a16.7 16.7 0 0 0 5.1-1.8c.4-4.4-.6-8.3-2.5-11.7ZM9.3 14c-.8 0-1.5-.8-1.5-1.7 0-1 .7-1.7 1.5-1.7s1.5.8 1.5 1.7c0 1-.7 1.7-1.5 1.7Zm5.4 0c-.8 0-1.5-.8-1.5-1.7 0-1 .7-1.7 1.5-1.7s1.5.8 1.5 1.7c0 1-.6 1.7-1.5 1.7Z"
            />
          </svg>
          <span>Botcord</span>
          {view === 'app' && (
            <span className="titlebar-ping" title="Gateway latency">
              <i className="ping-dot" style={{ background: latency < 150 ? 'var(--online)' : latency < 300 ? 'var(--idle)' : 'var(--dnd)' }} />
              {latency} ms
            </span>
          )}
        </div>
      </div>
      <div className="titlebar-controls">
        {update.available && (
          <button
            className={'tb-update ' + (update.downloaded ? 'ready' : 'downloading')}
            onClick={() => update.downloaded && installUpdate()}
            data-tip={update.downloaded ? 'Update Ready!' : `Downloading ${update.version}…`}
            aria-label="Update"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M12 3v10m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
        )}
        {!isMac && (
          <>
            <button className="tb-btn" onClick={() => api.windowMinimize()} aria-label="Minimize">
              <svg width="11" height="11" viewBox="0 0 11 11"><rect fill="currentColor" y="5" width="11" height="1" /></svg>
            </button>
            <button className="tb-btn" onClick={() => api.windowMaximize()} aria-label="Maximize">
              {maximized ? (
                <svg width="11" height="11" viewBox="0 0 11 11"><path fill="none" stroke="currentColor" d="M2.5 2.5h6v6h-6z M3.5 2.5V1.5h6v6h-1" /></svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 11 11"><rect fill="none" stroke="currentColor" x="1.5" y="1.5" width="8" height="8" /></svg>
              )}
            </button>
            <button className="tb-btn tb-close" onClick={() => api.windowClose()} aria-label="Close">
              <svg width="11" height="11" viewBox="0 0 11 11"><path stroke="currentColor" strokeWidth="1.1" d="M1 1l9 9M10 1l-9 9" /></svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
