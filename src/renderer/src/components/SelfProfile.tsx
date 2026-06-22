import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'

const STATUSES: [string, string][] = [
  ['Online', 'online'],
  ['Idle', 'idle'],
  ['Do Not Disturb', 'dnd'],
  ['Invisible', 'invisible']
]

/** Discord-style popover shown when the user clicks their own profile (bottom-left). */
export default function SelfProfile(): JSX.Element {
  const user = useStore((s) => s.user)
  const accounts = useStore((s) => s.settings.accounts || [])
  const presenceStatus = useStore((s) => s.settings.presenceStatus)
  const close = useStore((s) => s.closeSelfProfile)
  const openEditProfile = useStore((s) => s.openEditProfile)
  const switchAccount = useStore((s) => s.switchAccount)
  const addAccount = useStore((s) => s.addAccount)
  const removeAccount = useStore((s) => s.removeAccount)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const applySettings = useStore((s) => s.applySettings)
  const logout = useStore((s) => s.logout)
  const pushToast = useStore((s) => s.pushToast)
  const ref = useRef<HTMLDivElement>(null)
  const [showSwitch, setShowSwitch] = useState(false)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [close])

  const setStatus = (name: string): void => {
    api.setPresence(name, useStore.getState().settings.presenceActivity || '')
    applySettings({ presenceStatus: name })
  }

  const copyId = (): void => {
    if (user) {
      navigator.clipboard.writeText(user.id)
      pushToast('Bot ID copied', 'success')
    }
    close()
  }

  return (
    <div className="self-profile" ref={ref}>
      <div className="sp-banner" />
      <div className="sp-head">
        <Avatar name={user?.name || 'Bot'} src={user?.avatar} size={68} status="online" />
        <div className="sp-name-row">
          <span className="sp-name">{user?.name}</span>
          <span className="bot-tag">APP</span>
        </div>
        <div className="sp-sub">{user?.guildCount ?? 0} servers</div>
      </div>

      <div className="sp-body">
        <div className="sp-section-label">Status</div>
        <div className="sp-status-row">
          {STATUSES.map(([label, key]) => (
            <button
              key={key}
              className={'sp-status ' + (presenceStatus === label ? 'active' : '')}
              onClick={() => setStatus(label)}
              title={label}
            >
              <span className={'sp-status-dot ' + key} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="sp-divider" />

        <button className="sp-item" onClick={openEditProfile}>
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
          <span>Edit Profile</span>
        </button>

        <button className="sp-item" onClick={() => setShowSwitch((v) => !v)}>
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 7h11l-2.5-2.5L17 3l5 5-5 5-1.5-1.5L18 9H7V7zm10 10H6l2.5 2.5L7 21l-5-5 5-5 1.5 1.5L6 15h11v2z" /></svg>
          <span>Switch Accounts</span>
          <svg className={'sp-caret ' + (showSwitch ? 'open' : '')} viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 10l5 5 5-5z" /></svg>
        </button>

        {showSwitch && (
          <div className="sp-accounts">
            {accounts.map((a) => (
              <div key={a.id} className={'sp-account ' + (a.id === user?.id ? 'current' : '')}>
                <button className="sp-account-main" onClick={() => switchAccount(a.token)} disabled={a.id === user?.id}>
                  <Avatar name={a.name} src={a.avatar} size={28} />
                  <span className="sp-account-name">{a.name}</span>
                  {a.id === user?.id && <span className="sp-account-active">●</span>}
                </button>
                {a.id !== user?.id && (
                  <button
                    className="sp-account-remove"
                    title="Forget this bot"
                    onClick={() => removeAccount(a.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button className="sp-add-account" onClick={addAccount}>
              <span className="sp-add-plus">＋</span> Add a bot
            </button>
          </div>
        )}

        <button className="sp-item" onClick={copyId}>
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" /></svg>
          <span>Copy Bot ID</span>
        </button>

        <button className="sp-item" onClick={() => { setShowSettings(true); close() }}>
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.5h-3.8l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.7 7.7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h3.8l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" /></svg>
          <span>Settings</span>
        </button>

        <div className="sp-divider" />

        <button className="sp-item danger" onClick={() => { close(); logout() }}>
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16 13v-2H7V8l-5 4 5 4v-3h9zm3-10H10a2 2 0 0 0-2 2v3h2V5h9v14h-9v-3H8v3a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" /></svg>
          <span>Log Out</span>
        </button>
      </div>
    </div>
  )
}
