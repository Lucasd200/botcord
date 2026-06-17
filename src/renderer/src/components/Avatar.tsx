import { useState } from 'react'
import { colorFor, initials } from '../theme'

interface Props {
  name: string
  src?: string | null
  size?: number
  status?: string
  className?: string
}

const STATUS_COLOR: Record<string, string> = {
  online: 'var(--online)',
  idle: 'var(--idle)',
  dnd: 'var(--dnd)',
  offline: 'var(--text-faint)'
}

export default function Avatar({ name, src, size = 40, status, className }: Props): JSX.Element {
  const [failed, setFailed] = useState(false)
  const showImg = src && !failed
  return (
    <div
      className={'avatar ' + (className || '')}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {showImg ? (
        <img src={src!} alt={name} draggable={false} onError={() => setFailed(true)} />
      ) : (
        <div className="avatar-fallback" style={{ background: colorFor(name) }}>
          {initials(name)}
        </div>
      )}
      {status !== undefined && status !== '' && (
        <span
          className="status-dot"
          style={{
            background: STATUS_COLOR[status] || STATUS_COLOR.offline,
            width: size * 0.32,
            height: size * 0.32
          }}
        />
      )}
    </div>
  )
}
