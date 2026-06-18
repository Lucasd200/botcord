import { Fragment, type ReactNode } from 'react'
import type { MessageMentions } from '@shared/types'

/**
 * A small, safe subset of Discord markdown rendered to React nodes (never
 * raw HTML). Handles code blocks, inline code, bold/italic/underline/strike,
 * block quotes, links, and @/# mention pills.
 */

interface Token {
  type: 'code' | 'text'
  value: string
}

function splitCode(text: string): Token[] {
  const tokens: Token[] = []
  const re = /```([\s\S]*?)```|`([^`\n]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) })
    tokens.push({ type: 'code', value: m[1] ?? m[2] ?? '' })
    last = m.index + m[0].length
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) })
  return tokens
}

const INLINE = [
  { re: /\*\*\*([^*]+)\*\*\*/g, tag: 'bi' },
  { re: /\*\*([^*]+)\*\*/g, tag: 'b' },
  { re: /__([^_]+)__/g, tag: 'u' },
  { re: /~~([^~]+)~~/g, tag: 's' },
  { re: /\*([^*\n]+)\*/g, tag: 'i' },
  { re: /_([^_\n]+)_/g, tag: 'i' }
] as const

function renderInline(text: string, keyBase: string): ReactNode[] {
  // Links first so we don't format inside URLs.
  const out: ReactNode[] = []
  const linkRe = /(https?:\/\/[^\s<]+)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = linkRe.exec(text))) {
    if (m.index > last) out.push(...styleText(text.slice(last, m.index), `${keyBase}-t${i}`))
    out.push(
      <a key={`${keyBase}-l${i}`} href={m[1]} target="_blank" rel="noreferrer" className="md-link">
        {m[1]}
      </a>
    )
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) out.push(...styleText(text.slice(last), `${keyBase}-t${i}`))
  return out
}

function styleText(text: string, keyBase: string): ReactNode[] {
  for (const rule of INLINE) {
    rule.re.lastIndex = 0
    const m = rule.re.exec(text)
    if (m) {
      const before = text.slice(0, m.index)
      const after = text.slice(m.index + m[0].length)
      const inner = m[1]
      const wrap = (n: ReactNode): ReactNode => {
        switch (rule.tag) {
          case 'b':
            return <b key={keyBase + 'b'}>{n}</b>
          case 'i':
            return <i key={keyBase + 'i'}>{n}</i>
          case 'u':
            return <u key={keyBase + 'u'}>{n}</u>
          case 's':
            return <s key={keyBase + 's'}>{n}</s>
          case 'bi':
            return (
              <b key={keyBase + 'bi'}>
                <i>{n}</i>
              </b>
            )
          default:
            return n
        }
      }
      return [
        ...styleText(before, keyBase + 'B'),
        wrap(styleText(inner, keyBase + 'I')),
        ...styleText(after, keyBase + 'A')
      ]
    }
  }
  return [renderMentions(text, keyBase)]
}

const EMOJI_TOKEN = /<(a)?:(\w+):(\d+)>/
let jumboEmoji = false // set per formatContent call (synchronous render)
let currentMentions: MessageMentions | null = null

function renderMentions(text: string, keyBase: string, jumbo = jumboEmoji): ReactNode {
  const parts: ReactNode[] = []
  const re = /(@everyone|@here|<a?:\w+:\d+>|<@!?\d+>|<#\d+>|<@&\d+>)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const raw = m[1]
    const emo = raw.match(EMOJI_TOKEN)
    if (emo) {
      const animated = emo[1] === 'a'
      const name = emo[2]
      const id = emo[3]
      const ext = animated ? 'gif' : 'png'
      parts.push(
        <img
          key={`${keyBase}-e${i}`}
          className={'custom-emoji' + (jumbo ? ' jumbo' : '')}
          src={`https://cdn.discordapp.com/emojis/${id}.${ext}?size=48`}
          alt={`:${name}:`}
          title={`:${name}:`}
          draggable={false}
        />
      )
    } else {
      let label = raw
      let color: string | null = null
      const id = raw.match(/\d+/)?.[0] || ''
      if (raw.startsWith('<#')) {
        label = '#' + (currentMentions?.channels[id] || 'channel')
      } else if (raw.startsWith('<@&')) {
        const role = currentMentions?.roles[id]
        label = '@' + (role?.name || 'role')
        color = role?.color || null
      } else if (raw.startsWith('<@')) {
        label = '@' + (currentMentions?.users[id] || 'user')
      }
      parts.push(
        <span
          key={`${keyBase}-m${i}`}
          className="mention-pill"
          style={color ? { color, background: color + '28' } : undefined}
        >
          {label}
        </span>
      )
    }
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment key={keyBase + 'frag'}>{parts}</Fragment>
}

/** Discord enlarges emoji-only messages. */
function isJumbo(text: string): boolean {
  const stripped = text.replace(/<a?:\w+:\d+>/g, '').trim()
  return stripped.length === 0 && /<a?:\w+:\d+>/.test(text)
}

export function formatContent(text: string, mentions?: MessageMentions): ReactNode {
  jumboEmoji = isJumbo(text)
  currentMentions = mentions ?? null
  const tokens = splitCode(text)
  return (
    <>
      {tokens.map((t, i) => {
        if (t.type === 'code') {
          return t.value.includes('\n') ? (
            <pre key={i} className="code-block">
              <code>{t.value.replace(/^\n/, '')}</code>
            </pre>
          ) : (
            <code key={i} className="code-inline">
              {t.value}
            </code>
          )
        }
        const lines = t.value.split('\n')
        return (
          <Fragment key={i}>
            {lines.map((line, li) => {
              const quote = line.startsWith('> ')
              return (
                <Fragment key={li}>
                  {quote ? (
                    <span className="block-quote">{renderInline(line.slice(2), `${i}-${li}`)}</span>
                  ) : (
                    renderInline(line, `${i}-${li}`)
                  )}
                  {li < lines.length - 1 && <br />}
                </Fragment>
              )
            })}
          </Fragment>
        )
      })}
    </>
  )
}
