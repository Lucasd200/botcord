import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'
import Icon from './Icon'

/** Modal to edit the logged-in bot's avatar, username and About Me. */
export default function EditBotProfile(): JSX.Element | null {
  const show = useStore((s) => s.showEditProfile)
  const botProfile = useStore((s) => s.botProfile)
  const user = useStore((s) => s.user)
  const close = useStore((s) => s.closeEditProfile)
  const pushToast = useStore((s) => s.pushToast)
  const [username, setUsername] = useState('')
  const [description, setDescription] = useState('')
  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (botProfile) {
      setUsername(botProfile.username)
      setDescription(botProfile.description)
      setAvatarPath(null)
    }
  }, [botProfile])

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, close])

  if (!show) return null

  const pickAvatar = async (): Promise<void> => {
    const p = await api.pickFile()
    if (p) setAvatarPath(p)
  }

  const save = async (): Promise<void> => {
    const changes: { username?: string; description?: string; avatarPath?: string } = {}
    if (username.trim() && username.trim() !== botProfile?.username) changes.username = username.trim()
    if (description !== (botProfile?.description ?? '')) changes.description = description
    if (avatarPath) changes.avatarPath = avatarPath
    if (Object.keys(changes).length === 0) {
      pushToast('Nothing changed.', 'info')
      return
    }
    setSaving(true)
    const r = await api.editBotProfile(changes)
    setSaving(false)
    if (r.ok) {
      pushToast('Bot profile updated.', 'success')
      close()
    } else pushToast(r.error || 'Update failed.', 'error')
  }

  const avatarFile = avatarPath ? avatarPath.split(/[\\/]/).pop() : null

  return (
    <div className="chmodal-overlay" onMouseDown={close}>
      <div className="chmodal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="chmodal-head">
          <h3>Edit Bot Profile</h3>
          <button className="embed-close" onClick={close} title="Close (Esc)">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="chmodal-body">
          {!botProfile ? (
            <div className="ss-loading">Loading…</div>
          ) : (
            <>
              <div className="ebp-avatar-row">
                <Avatar name={user?.name || 'Bot'} src={user?.avatar} size={72} status="online" />
                <div>
                  <button className="btn-secondary" onClick={pickAvatar}>
                    Change avatar
                  </button>
                  {avatarFile && <div className="ebp-file">Selected: {avatarFile}</div>}
                </div>
              </div>

              <h4 className="settings-label">Username</h4>
              <input
                className="settings-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={32}
              />
              <p className="settings-hint">Discord limits bot username changes to 2 per hour.</p>

              <h4 className="settings-label">About Me</h4>
              <textarea
                className="settings-input ebp-about"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={400}
                placeholder="Shown on your bot's profile"
              />

              <div className="ebp-actions">
                <button className="btn-secondary" onClick={close}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
