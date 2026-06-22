import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Avatar from './Avatar'
import type { ActionResult, ChannelDetail, ChannelOverwrite, MemberDetail } from '@shared/types'

type Tab = 'overview' | 'roles' | 'members' | 'channels'

const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['roles', 'Roles'],
  ['members', 'Members'],
  ['channels', 'Channels']
]

// Channel-scoped permissions the editor can toggle (discord.js flag names).
const CHANNEL_PERMS: [string, string][] = [
  ['ViewChannel', 'View Channel'],
  ['SendMessages', 'Send Messages'],
  ['ManageMessages', 'Manage Messages'],
  ['EmbedLinks', 'Embed Links'],
  ['AttachFiles', 'Attach Files'],
  ['AddReactions', 'Add Reactions'],
  ['MentionEveryone', 'Mention @everyone'],
  ['Connect', 'Connect'],
  ['Speak', 'Speak'],
  ['MuteMembers', 'Mute Members'],
  ['ManageChannels', 'Manage Channel']
]

const TIMEOUTS: [string, number][] = [
  ['60 seconds', 1],
  ['5 minutes', 5],
  ['10 minutes', 10],
  ['1 hour', 60],
  ['1 day', 1440],
  ['1 week', 10080]
]

export default function ServerSettings(): JSX.Element {
  const detail = useStore((s) => s.serverDetail)
  const loading = useStore((s) => s.serverDetailLoading)
  const close = useStore((s) => s.closeServerSettings)
  const reload = useStore((s) => s.reloadServerDetail)
  const pushToast = useStore((s) => s.pushToast)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const act = async (p: Promise<ActionResult>, okMsg: string): Promise<boolean> => {
    const r = await p
    if (r.ok) {
      pushToast(okMsg, 'success')
      await reload()
      return true
    }
    pushToast(r.error || 'Action failed.', 'error')
    return false
  }

  return (
    <div className="settings-window">
      <nav className="settings-nav">
        <div className="settings-nav-inner">
          <div className="settings-nav-title">{detail?.name || 'Server'}</div>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={'settings-tab ' + (tab === id ? 'active' : '')}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="settings-content">
        <button className="settings-close" onClick={close} title="Close (Esc)">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path stroke="currentColor" strokeWidth="2" d="M5 5l14 14M19 5L5 19" />
          </svg>
          <span>ESC</span>
        </button>

        {loading || !detail ? (
          <div className="ss-loading">Loading server…</div>
        ) : (
          <>
            {tab === 'overview' && <Overview />}
            {tab === 'roles' && <Roles />}
            {tab === 'members' && <Members act={act} />}
            {tab === 'channels' && <Channels act={act} />}
          </>
        )}
      </div>
    </div>
  )
}

function Overview(): JSX.Element {
  const detail = useStore((s) => s.serverDetail)!
  const caps = detail.caps
  const can = (v: boolean): JSX.Element => (
    <span className={'cap-pill ' + (v ? 'yes' : 'no')}>{v ? 'Allowed' : 'No permission'}</span>
  )
  return (
    <section className="settings-section">
      <h2>Overview</h2>
      <div className="ss-overview">
        <div className="ss-stat">
          <span className="ss-stat-num">{detail.memberCount}</span>
          <span className="ss-stat-label">Members</span>
        </div>
        <div className="ss-stat">
          <span className="ss-stat-num">{detail.roles.filter((r) => r.id !== detail.id).length}</span>
          <span className="ss-stat-label">Roles</span>
        </div>
        <div className="ss-stat">
          <span className="ss-stat-num">{detail.channels.filter((c) => c.type !== 'category').length}</span>
          <span className="ss-stat-label">Channels</span>
        </div>
      </div>

      <h4 className="settings-label">What this bot can manage</h4>
      <div className="cap-list">
        <div className="cap-row"><span>Manage channels</span>{can(caps.manageChannels)}</div>
        <div className="cap-row"><span>Manage roles</span>{can(caps.manageRoles)}</div>
        <div className="cap-row"><span>Kick members</span>{can(caps.kick)}</div>
        <div className="cap-row"><span>Ban members</span>{can(caps.ban)}</div>
        <div className="cap-row"><span>Time out members</span>{can(caps.moderate)}</div>
      </div>
      {caps.isOwner && <p className="settings-hint">This bot owns the server.</p>}
      <p className="settings-hint">
        Actions are limited by the bot&apos;s permissions and role position. Grayed-out controls mean the
        bot can&apos;t perform that action.
      </p>
    </section>
  )
}

function Roles(): JSX.Element {
  const detail = useStore((s) => s.serverDetail)!
  const roles = detail.roles.filter((r) => r.id !== detail.id)
  return (
    <section className="settings-section">
      <h2>Roles — {roles.length}</h2>
      <p className="settings-hint">
        Roles in this server, highest first. Assign them to members on the Members tab.
      </p>
      <div className="role-list">
        {roles.map((r) => (
          <div key={r.id} className="role-list-row">
            <span className="role-dot" style={{ background: r.color || '#99aab5' }} />
            <span className="role-list-name" style={r.color ? { color: r.color } : undefined}>
              {r.name}
            </span>
            {r.managed && <span className="role-managed">managed</span>}
            {r.hoist && <span className="role-hoist">hoisted</span>}
            <span className="role-count">{r.memberCount} members</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Members({ act }: { act: (p: Promise<ActionResult>, ok: string) => Promise<boolean> }): JSX.Element {
  const detail = useStore((s) => s.serverDetail)!
  const [sel, setSel] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const members = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? detail.members.filter(
          (m) => m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
        )
      : detail.members
    return list.slice(0, 300)
  }, [detail.members, search])

  const selected = detail.members.find((m) => m.id === sel) || null

  return (
    <section className="settings-section ss-split">
      <div className="ss-list-col">
        <h2>Members — {detail.memberCount}</h2>
        <input
          className="ss-search"
          placeholder="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ss-scroll">
          {members.map((m) => (
            <button
              key={m.id}
              className={'ss-member-row ' + (sel === m.id ? 'active' : '')}
              onClick={() => setSel(m.id)}
            >
              <Avatar name={m.name} src={m.avatar} size={28} />
              <span className="ss-member-name">{m.name}</span>
              {m.bot && <span className="bot-tag small">APP</span>}
            </button>
          ))}
          {members.length === 0 && <div className="ss-empty">No members match.</div>}
        </div>
      </div>
      <div className="ss-detail-col">
        {selected ? (
          <MemberManage member={selected} act={act} />
        ) : (
          <div className="ss-placeholder">Pick a member to manage their roles and permissions.</div>
        )}
      </div>
    </section>
  )
}

function MemberManage({
  member,
  act
}: {
  member: MemberDetail
  act: (p: Promise<ActionResult>, ok: string) => Promise<boolean>
}): JSX.Element {
  const detail = useStore((s) => s.serverDetail)!
  const caps = detail.caps
  const assignable = detail.roles.filter((r) => r.id !== detail.id && !r.managed)
  const [busy, setBusy] = useState(false)

  const toggleRole = async (roleId: string, has: boolean): Promise<void> => {
    setBusy(true)
    await act(
      api.setMemberRole(detail.id, member.id, roleId, !has),
      has ? 'Role removed.' : 'Role added.'
    )
    setBusy(false)
  }

  const tooHigh = (rolePos: number): boolean => !caps.isOwner && rolePos >= caps.myTopRolePos
  const canModerateTarget = caps.isOwner || member.topRolePos < caps.myTopRolePos

  return (
    <div className="ss-member-manage">
      <div className="ss-member-head">
        <Avatar name={member.name} src={member.avatar} size={56} />
        <div>
          <div className="ss-member-title">{member.name}</div>
          <div className="ss-member-sub">@{member.username}</div>
          {member.joinedAt && (
            <div className="ss-member-sub">Joined {new Date(member.joinedAt).toLocaleDateString()}</div>
          )}
        </div>
      </div>

      <h4 className="settings-label">Roles</h4>
      {!caps.manageRoles && <p className="ss-warn">The bot is missing Manage Roles.</p>}
      <div className="ss-role-grid">
        {assignable.map((r) => {
          const has = member.roleIds.includes(r.id)
          const locked = !caps.manageRoles || tooHigh(r.position) || busy
          return (
            <label key={r.id} className={'ss-role-check ' + (locked ? 'locked' : '')}>
              <input
                type="checkbox"
                checked={has}
                disabled={locked}
                onChange={() => toggleRole(r.id, has)}
              />
              <span className="role-dot small" style={{ background: r.color || '#99aab5' }} />
              <span style={r.color ? { color: r.color } : undefined}>{r.name}</span>
            </label>
          )
        })}
        {assignable.length === 0 && <div className="ss-empty">No assignable roles.</div>}
      </div>

      <h4 className="settings-label">Moderation</h4>
      {!canModerateTarget && (
        <p className="ss-warn">This member&apos;s top role is above the bot&apos;s — moderation is limited.</p>
      )}
      <div className="ss-mod-row">
        <select className="settings-select ss-timeout" defaultValue="10" id="to-min">
          {TIMEOUTS.map(([label, min]) => (
            <option key={min} value={min}>
              {label}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary"
          disabled={!caps.moderate || !canModerateTarget}
          onClick={() => {
            const el = document.getElementById('to-min') as HTMLSelectElement | null
            const min = Number(el?.value || 10)
            act(api.timeoutMember(detail.id, member.id, min), 'Member timed out.')
          }}
        >
          Time out
        </button>
        <button
          className="btn-secondary"
          disabled={!caps.moderate || !canModerateTarget}
          onClick={() => act(api.timeoutMember(detail.id, member.id, 0), 'Timeout removed.')}
        >
          Clear timeout
        </button>
      </div>
      <div className="ss-mod-row">
        <button
          className="btn-danger"
          disabled={!caps.kick || !canModerateTarget}
          onClick={() => {
            if (confirm(`Kick ${member.name}?`)) act(api.kickMember(detail.id, member.id), 'Member kicked.')
          }}
        >
          Kick
        </button>
        <button
          className="btn-danger"
          disabled={!caps.ban || !canModerateTarget}
          onClick={() => {
            if (confirm(`Ban ${member.name}? This removes them and blocks rejoining.`))
              act(api.banMember(detail.id, member.id), 'Member banned.')
          }}
        >
          Ban
        </button>
      </div>
    </div>
  )
}

function Channels({ act }: { act: (p: Promise<ActionResult>, ok: string) => Promise<boolean> }): JSX.Element {
  const detail = useStore((s) => s.serverDetail)!
  const caps = detail.caps
  const [sel, setSel] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<'text' | 'voice' | 'category'>('text')

  const selected = detail.channels.find((c) => c.id === sel) || null

  const create = async (): Promise<void> => {
    if (!newName.trim()) return
    const ok = await act(api.createChannel(detail.id, newName, newKind), 'Channel created.')
    if (ok) setNewName('')
  }

  return (
    <section className="settings-section ss-split">
      <div className="ss-list-col">
        <h2>Channels</h2>
        {!caps.manageChannels && <p className="ss-warn">The bot is missing Manage Channels.</p>}
        <div className="ss-create">
          <input
            className="ss-search"
            placeholder="New channel name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            disabled={!caps.manageChannels}
          />
          <select
            className="settings-select"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as 'text' | 'voice' | 'category')}
            disabled={!caps.manageChannels}
          >
            <option value="text">Text</option>
            <option value="voice">Voice</option>
            <option value="category">Category</option>
          </select>
          <button className="btn-primary" onClick={create} disabled={!caps.manageChannels}>
            Add
          </button>
        </div>
        <div className="ss-scroll">
          {detail.channels.map((c) => (
            <button
              key={c.id}
              className={'ss-channel-row ' + (sel === c.id ? 'active' : '') + (c.type === 'category' ? ' cat' : '')}
              onClick={() => setSel(c.id)}
            >
              <span className="ss-channel-glyph">{glyph(c.type)}</span>
              <span className="ss-channel-name">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ss-detail-col">
        {selected ? (
          <ChannelManage channel={selected} act={act} />
        ) : (
          <div className="ss-placeholder">Pick a channel to rename, edit, set permissions, or delete.</div>
        )}
      </div>
    </section>
  )
}

function glyph(type: ChannelDetail['type']): string {
  if (type === 'voice' || type === 'stage') return '🔊'
  if (type === 'category') return '▾'
  if (type === 'announcement') return '📣'
  if (type === 'forum') return '🗂'
  return '#'
}

function ChannelManage({
  channel,
  act
}: {
  channel: ChannelDetail
  act: (p: Promise<ActionResult>, ok: string) => Promise<boolean>
}): JSX.Element {
  const detail = useStore((s) => s.serverDetail)!
  const caps = detail.caps
  const [name, setName] = useState(channel.name)
  const [topic, setTopic] = useState('')
  const [overwrites, setOverwrites] = useState<ChannelOverwrite[]>([])
  const [permRole, setPermRole] = useState<string>(detail.id) // default @everyone
  const isText = channel.type === 'text' || channel.type === 'announcement' || channel.type === 'forum'

  useEffect(() => {
    setName(channel.name)
    setTopic('')
    let live = true
    api.getChannelPermissions(channel.id).then((ow) => {
      if (live) setOverwrites(ow)
    })
    return () => {
      live = false
    }
  }, [channel.id, channel.name])

  const refreshPerms = async (): Promise<void> => {
    setOverwrites(await api.getChannelPermissions(channel.id))
  }

  const current = overwrites.find((o) => o.targetId === permRole)
  const stateOf = (perm: string): 'allow' | 'deny' | 'neutral' => {
    if (current?.allow.includes(perm)) return 'allow'
    if (current?.deny.includes(perm)) return 'deny'
    return 'neutral'
  }

  const setPerm = async (perm: string, value: 'allow' | 'deny' | 'neutral'): Promise<void> => {
    const r = await api.setChannelPermission(channel.id, permRole, perm, value)
    if (r.ok) await refreshPerms()
    else useStore.getState().pushToast(r.error || 'Could not update permission.', 'error')
  }

  return (
    <div className="ss-channel-manage">
      <div className="ss-member-title">
        {glyph(channel.type)} {channel.name}
      </div>

      <h4 className="settings-label">Rename</h4>
      <div className="ss-mod-row">
        <input className="settings-input" value={name} onChange={(e) => setName(e.target.value)} disabled={!caps.manageChannels} />
        <button
          className="btn-primary"
          disabled={!caps.manageChannels || name.trim() === channel.name || !name.trim()}
          onClick={() => act(api.editChannel(channel.id, { name }), 'Channel renamed.')}
        >
          Save
        </button>
      </div>

      {isText && (
        <>
          <h4 className="settings-label">Set topic</h4>
          <div className="ss-mod-row">
            <input
              className="settings-input"
              placeholder="New channel topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!caps.manageChannels}
            />
            <button
              className="btn-primary"
              disabled={!caps.manageChannels}
              onClick={() => act(api.editChannel(channel.id, { topic }), 'Topic updated.')}
            >
              Save
            </button>
          </div>
        </>
      )}

      {channel.type !== 'category' && (
        <>
          <h4 className="settings-label">Permissions</h4>
          {!caps.manageChannels && <p className="ss-warn">The bot is missing Manage Channels / Roles.</p>}
          <select
            className="settings-select"
            value={permRole}
            onChange={(e) => setPermRole(e.target.value)}
          >
            {detail.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id === detail.id ? '@everyone' : r.name}
              </option>
            ))}
          </select>
          <div className="perm-grid">
            {CHANNEL_PERMS.map(([flag, label]) => {
              const st = stateOf(flag)
              return (
                <div key={flag} className="perm-row">
                  <span className="perm-label">{label}</span>
                  <div className="perm-tri">
                    {(['deny', 'neutral', 'allow'] as const).map((v) => (
                      <button
                        key={v}
                        className={'perm-btn ' + v + (st === v ? ' on' : '')}
                        disabled={!caps.manageChannels}
                        onClick={() => setPerm(flag, v)}
                        title={v}
                      >
                        {v === 'deny' ? '✕' : v === 'allow' ? '✓' : '/'}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <h4 className="settings-label">Danger zone</h4>
      <button
        className="btn-danger"
        disabled={!caps.manageChannels}
        onClick={() => {
          if (confirm(`Delete #${channel.name}? This cannot be undone.`))
            act(api.deleteChannel(channel.id), 'Channel deleted.')
        }}
      >
        Delete channel
      </button>
    </div>
  )
}
