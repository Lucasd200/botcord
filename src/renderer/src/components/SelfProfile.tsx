import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'
import Icon from './Icon'

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
          <Icon name="edit" size={18} />
          <span>Edit Profile</span>
        </button>

        <button className="sp-item" onClick={() => setShowSwitch((v) => !v)}>
          <Icon name="swap_horiz" size={18} />
          <span>Switch Accounts</span>
          <Icon name="expand_more" size={16} className={'sp-caret ' + (showSwitch ? 'open' : '')} />
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
              <Icon name="add" size={16} className="sp-add-plus" /> Add a bot
            </button>
          </div>
        )}

        <button className="sp-item" onClick={copyId}>
          <Icon name="content_copy" size={18} />
          <span>Copy Bot ID</span>
        </button>

        <button className="sp-item" onClick={() => { setShowSettings(true); close() }}>
          <Icon name="settings" size={18} />
          <span>Settings</span>
        </button>

        <div className="sp-divider" />

        <button className="sp-item danger" onClick={() => { close(); logout() }}>
          <Icon name="logout" size={18} />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  )
}
