import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'
import { DEFAULT_THEME_SWATCHES, COLOR_THEMES } from '../theme'

type Tab = 'account' | 'appearance' | 'notifications' | 'presence' | 'advanced'

const TABS: [Tab, string][] = [
  ['account', 'My Account'],
  ['appearance', 'Appearance'],
  ['notifications', 'Notifications'],
  ['presence', 'Bot Presence'],
  ['advanced', 'Advanced']
]

export default function Settings(): JSX.Element {
  const settings = useStore((s) => s.settings)
  const user = useStore((s) => s.user)
  const apply = useStore((s) => s.applySettings)
  const logout = useStore((s) => s.logout)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const pushToast = useStore((s) => s.pushToast)
  const [tab, setTab] = useState<Tab>('account')
  const [presStatus, setPresStatus] = useState(settings.presenceStatus || 'Online')
  const [presActivity, setPresActivity] = useState(settings.presenceActivity || '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShowSettings(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setShowSettings])

  const savePresence = (): void => {
    api.setPresence(presStatus, presActivity)
    apply({ presenceStatus: presStatus, presenceActivity: presActivity })
    pushToast('Presence updated', 'success')
  }

  return (
    <div className="settings-window">
      <nav className="settings-nav">
        <div className="settings-nav-inner">
          <div className="settings-nav-title">Settings</div>
          {TABS.map(([id, label]) => (
            <button key={id} className={'settings-tab ' + (tab === id ? 'active' : '')} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
          <div className="settings-divider" />
          <button className="settings-tab danger" onClick={logout}>Log Out</button>
        </div>
      </nav>

      <div className="settings-content">
        <button className="settings-close" onClick={() => setShowSettings(false)} title="Close (Esc)">
          <svg viewBox="0 0 24 24" width="20" height="20"><path stroke="currentColor" strokeWidth="2" d="M5 5l14 14M19 5L5 19" /></svg>
          <span>ESC</span>
        </button>

        {tab === 'account' && (
          <section className="settings-section">
            <h2>My Account</h2>
            <div className="account-card">
              <div className="account-banner" />
              <div className="account-body">
                <Avatar name={user?.name || 'Bot'} src={user?.avatar} size={80} status="online" />
                <div className="account-meta">
                  <h3>{user?.name} <span className="bot-tag">APP</span></h3>
                  <div className="account-fields">
                    <div><label>Bot ID</label><span>{user?.id}</span></div>
                    <div><label>Servers</label><span>{user?.guildCount}</span></div>
                  </div>
                </div>
                <button className="btn-danger" onClick={logout}>Log Out</button>
              </div>
            </div>
          </section>
        )}

        {tab === 'appearance' && (
          <section className="settings-section">
            <h2>Appearance</h2>
            <h4 className="settings-label">Theme</h4>
            <div className="theme-grid">
              {DEFAULT_THEME_SWATCHES.map(([key, label, swatch]) => (
                <button
                  key={key}
                  className={'theme-card ' + (settings.theme === key && !settings.colorTheme ? 'active' : '')}
                  onClick={() => apply({ theme: key, colorTheme: '' })}
                >
                  <span className="theme-swatch" style={{ background: swatch }} />
                  <span>{label}</span>
                </button>
              ))}
              <button
                className={'theme-card ' + (settings.theme === 'sync' && !settings.colorTheme ? 'active' : '')}
                onClick={() => apply({ theme: 'sync', colorTheme: '' })}
              >
                <span className="theme-swatch" style={{ background: 'linear-gradient(135deg,#fff 50%,#313338 50%)' }} />
                <span>Sync</span>
              </button>
            </div>

            <h4 className="settings-label">Color themes</h4>
            <div className="color-grid">
              <button
                className={'color-chip none ' + (!settings.colorTheme ? 'active' : '')}
                onClick={() => apply({ colorTheme: '' })}
                title="No gradient"
              >∅</button>
              {COLOR_THEMES.map(([name, c1, c2]) => (
                <button
                  key={name}
                  className={'color-chip ' + (settings.colorTheme === name ? 'active' : '')}
                  style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                  title={name}
                  onClick={() => apply({ colorTheme: name })}
                />
              ))}
            </div>

            <h4 className="settings-label">Accent color</h4>
            <div className="accent-row">
              <input
                type="color"
                value={settings.accent}
                onChange={(e) => apply({ accent: e.target.value, colorTheme: '' })}
              />
              <span>{settings.accent}</span>
            </div>

            <div className="toggle-row">
              <div>
                <h4>Compact messages</h4>
                <p>Show messages tightly packed with smaller spacing.</p>
              </div>
              <Toggle on={settings.compactMessages} onChange={(v) => apply({ compactMessages: v })} />
            </div>
            <div className="toggle-row">
              <div>
                <h4>Spellcheck</h4>
                <p>Underline misspelled words in the message box.</p>
              </div>
              <Toggle on={settings.spellcheck} onChange={(v) => apply({ spellcheck: v })} />
            </div>
          </section>
        )}

        {tab === 'notifications' && (
          <section className="settings-section">
            <h2>Notifications</h2>
            <h4 className="settings-label">Desktop notifications</h4>
            {([['all', 'All messages'], ['pings', 'Only @mentions & DMs'], ['none', 'Nothing']] as const).map(
              ([val, label]) => (
                <label key={val} className="radio-row">
                  <input
                    type="radio"
                    name="notif"
                    checked={settings.notificationMode === val}
                    onChange={() => apply({ notificationMode: val })}
                  />
                  <span>{label}</span>
                </label>
              )
            )}
          </section>
        )}

        {tab === 'presence' && (
          <section className="settings-section">
            <h2>Bot Presence</h2>
            <p className="settings-hint">Change how your bot appears to everyone on Discord.</p>
            <h4 className="settings-label">Status</h4>
            <select className="settings-select" value={presStatus} onChange={(e) => setPresStatus(e.target.value)}>
              <option>Online</option>
              <option>Idle</option>
              <option>Do Not Disturb</option>
              <option>Invisible</option>
            </select>
            <h4 className="settings-label">Activity (Playing …)</h4>
            <input
              className="settings-input"
              placeholder="e.g. with Botcord"
              value={presActivity}
              onChange={(e) => setPresActivity(e.target.value)}
            />
            <button className="btn-primary" onClick={savePresence}>Apply presence</button>
          </section>
        )}

        {tab === 'advanced' && (
          <section className="settings-section">
            <h2>Advanced</h2>
            <h4 className="settings-label">Message history to load: {settings.historyLimit}</h4>
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={settings.historyLimit}
              onChange={(e) => apply({ historyLimit: Number(e.target.value) })}
              className="settings-range"
            />
            <div className="advanced-actions">
              <button className="btn-secondary" onClick={() => api.openDataFolder()}>Open data folder</button>
            </div>
            <p className="settings-hint">Botcord {__APP_VERSION__} · built with Electron + discord.js</p>
          </section>
        )}
      </div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button className={'toggle ' + (on ? 'on' : '')} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="toggle-knob" />
    </button>
  )
}
