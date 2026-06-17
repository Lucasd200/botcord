import { useMemo } from 'react'
import { useStore } from '../store'
import Avatar from './Avatar'
import type { MemberData } from '@shared/types'

export default function MemberList(): JSX.Element {
  const members = useStore((s) => s.members)
  const openDM = useStore((s) => s.openDM)

  const groups = useMemo(() => {
    const map = new Map<string, MemberData[]>()
    for (const m of members) {
      const key = m.role || 'Members'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return [...map.entries()]
  }, [members])

  return (
    <aside className="member-list">
      <div className="member-scroll">
        {members.length === 0 && (
          <div className="member-empty">No online members, or the Presence/Members intents are off.</div>
        )}
        {groups.map(([role, list]) => (
          <div key={role} className="member-group">
            <div className="member-group-head">
              {role} — {list.length}
            </div>
            {list.map((m) => (
              <button key={m.id} className="member-row" onDoubleClick={() => openDM(m.id)} title="Double-click to DM">
                <Avatar name={m.name} src={m.avatar} size={32} status={m.status || 'online'} />
                <div className="member-text">
                  <span className="member-name" style={m.roleColor ? { color: m.roleColor } : undefined}>
                    {m.name}
                    {m.bot && <span className="bot-tag small">APP</span>}
                  </span>
                  {m.activity && <span className="member-activity">{m.activity}</span>}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
