import { useEffect } from 'react'
import { useStore } from '../store'
import Avatar from './Avatar'

const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline'
}

function dateStr(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProfileCard(): JSX.Element | null {
  const profile = useStore((s) => s.profile)
  const loading = useStore((s) => s.profileLoading)
  const close = useStore((s) => s.closeProfile)
  const openDM = useStore((s) => s.openDM)
  const mentionUser = useStore((s) => s.mentionUser)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  if (!profile && !loading) return null

  return (
    <div className="profile-overlay" onClick={close}>
      <div className="profile-card" onClick={(e) => e.stopPropagation()}>
        {loading || !profile ? (
          <div className="profile-loading"><span className="spinner" /></div>
        ) : (
          <>
            <div
              className="profile-banner"
              style={{ background: profile.banner ? `url(${profile.banner}) center/cover` : profile.bannerColor || 'var(--accent)' }}
            />
            <div className="profile-avatar-wrap">
              <Avatar name={profile.displayName} src={profile.avatar} size={88} status={profile.status || undefined} />
            </div>
            <button className="profile-close" onClick={close} aria-label="Close">✕</button>

            <div className="profile-body">
              <div className="profile-names">
                <span className="profile-display" style={profile.roleColor ? { color: profile.roleColor } : undefined}>
                  {profile.displayName}
                </span>
                {profile.bot && <span className="bot-tag">APP</span>}
              </div>
              <div className="profile-username">{profile.username}</div>

              {profile.status && <div className="profile-status">{STATUS_LABEL[profile.status] || profile.status}</div>}

              <div className="profile-divider" />

              {profile.roles.length > 0 && (
                <div className="profile-section">
                  <h4>Roles — {profile.roles.length}</h4>
                  <div className="role-pills">
                    {profile.roles.map((r, i) => (
                      <span className="role-pill" key={i}>
                        <i className="role-dot" style={{ background: r.color || 'var(--text-faint)' }} />
                        {r.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="profile-section profile-dates">
                <div><h4>Account created</h4><span>{dateStr(profile.createdAt)}</span></div>
                {profile.joinedAt && <div><h4>Joined server</h4><span>{dateStr(profile.joinedAt)}</span></div>}
              </div>

              <div className="profile-actions">
                <button className="btn-primary" onClick={() => mentionUser(profile.id)}>@ Mention</button>
                <button className="btn-secondary" onClick={() => { openDM(profile.id); close() }}>Message</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
