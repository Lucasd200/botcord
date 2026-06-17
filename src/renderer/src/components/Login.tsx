import { useState } from 'react'
import { useStore } from '../store'

export default function Login(): JSX.Element {
  const [token, setToken] = useState('')
  const [keep, setKeep] = useState(true)
  const [show, setShow] = useState(false)
  const connecting = useStore((s) => s.connecting)
  const error = useStore((s) => s.loginError)
  const login = useStore((s) => s.login)

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (token.trim() && !connecting) login(token.trim(), keep)
  }

  return (
    <div className="login-screen">
      <div className="login-aurora" />
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden>
            <path fill="var(--accent)" d="M20 4.5A16.5 16.5 0 0 0 15.7 3l-.2.4a15 15 0 0 1 4 .9 13.6 13.6 0 0 0-9.4 0 15 15 0 0 1 4-.9L13.9 3A16.5 16.5 0 0 0 9.6 3 16.5 16.5 0 0 0 5.6 4.5C2.9 8.5 2.2 12.4 2.5 16.2A16.7 16.7 0 0 0 7.6 18l.4-.6c-.8-.3-1.6-.7-2.3-1.2l.6-.4a11.8 11.8 0 0 0 10 0l.6.4c-.7.5-1.5.9-2.3 1.2l.4.6a16.7 16.7 0 0 0 5.1-1.8c.4-4.4-.6-8.3-2.5-11.7ZM9.3 14c-.8 0-1.5-.8-1.5-1.7 0-1 .7-1.7 1.5-1.7s1.5.8 1.5 1.7c0 1-.7 1.7-1.5 1.7Zm5.4 0c-.8 0-1.5-.8-1.5-1.7 0-1 .7-1.7 1.5-1.7s1.5.8 1.5 1.7c0 1-.6 1.7-1.5 1.7Z" />
          </svg>
        </div>
        <h1>Welcome back</h1>
        <p className="login-sub">Log in with your Discord <b>bot token</b> to control your bot.</p>

        <label className="login-label">Bot token</label>
        <div className="login-input-row">
          <input
            className="login-input"
            type={show ? 'text' : 'password'}
            placeholder="Paste your bot token…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          <button type="button" className="login-eye" onClick={() => setShow((v) => !v)} tabIndex={-1}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <label className="login-check">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          <span>Keep me logged in</span>
        </label>

        <button className="login-btn" type="submit" disabled={connecting || !token.trim()}>
          {connecting ? <span className="spinner" /> : 'Log in'}
        </button>

        <div className="login-help">
          Need a token? Open the{' '}
          <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">
            Developer Portal
          </a>{' '}
          → your app → <b>Bot</b> → Reset Token. Enable the <b>Message Content</b>, <b>Server
          Members</b> and <b>Presence</b> intents.
        </div>
        <div className="login-secure">🔒 Your token is encrypted with your OS keychain and never leaves this device.</div>
      </form>
    </div>
  )
}
