import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { GuildInfo } from '@shared/types'

function orderedGuilds(guilds: GuildInfo[], order: string[]): GuildInfo[] {
  if (!order?.length) return guilds
  const map = new Map(guilds.map((g) => [g.id, g]))
  const out: GuildInfo[] = []
  for (const id of order) {
    const g = map.get(id)
    if (g) {
      out.push(g)
      map.delete(id)
    }
  }
  for (const g of map.values()) out.push(g)
  return out
}

export default function ServerRail(): JSX.Element {
  const guilds = useStore((s) => s.guilds)
  const activeGuildId = useStore((s) => s.activeGuildId)
  const selectGuild = useStore((s) => s.selectGuild)
  const settings = useStore((s) => s.settings)
  const applySettings = useStore((s) => s.applySettings)
  const unreadMentions = useStore((s) => s.unreadMentions)
  const muted = useStore((s) => s.settings.notificationMode === 'none')
  const [dragId, setDragId] = useState<string | null>(null)

  const ordered = useMemo(() => orderedGuilds(guilds, settings.serverOrder || []), [guilds, settings.serverOrder])

  const guildUnread = (g: GuildInfo): number => {
    if (muted) return 0
    let n = 0
    for (const cat of g.categories) for (const ch of cat.channels) n += unreadMentions[ch.id] || 0
    return n
  }

  const onDrop = (targetId: string): void => {
    if (!dragId || dragId === targetId) return
    const ids = ordered.map((g) => g.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    ids.splice(to, 0, ids.splice(from, 1)[0])
    applySettings({ serverOrder: ids })
    setDragId(null)
  }

  return (
    <nav className="server-rail">
      <button
        className={'rail-item home ' + (activeGuildId === null ? 'active' : '')}
        onClick={() => selectGuild(null)}
        data-tip="Direct Messages"
      >
        <svg width="26" height="26" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3 3 10v11h6v-6h6v6h6V10z" /></svg>
      </button>
      <div className="rail-divider" />
      <div className="rail-scroll">
        {ordered.map((g) => {
          const count = guildUnread(g)
          return (
            <button
              key={g.id}
              className={'rail-item guild ' + (activeGuildId === g.id ? 'active' : '')}
              onClick={() => selectGuild(g.id)}
              draggable
              onDragStart={() => setDragId(g.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(g.id)}
              data-tip={`${g.name}\n${g.memberCount.toLocaleString()} members · ${g.onlineCount} online`}
            >
              {g.icon ? (
                <img src={g.icon} alt={g.name} draggable={false} />
              ) : (
                <span className="guild-acronym">{g.acronym}</span>
              )}
              {count > 0 && <span className="rail-badge">{count > 99 ? '99+' : count}</span>}
              <span className="rail-pill" />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
