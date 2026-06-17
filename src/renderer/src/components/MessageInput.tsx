import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'

const EMOJI = ['😀', '😂', '🥰', '😎', '🤔', '👍', '🙏', '🎉', '🔥', '❤️', '✨', '👀', '😭', '💀', '🤖', '✅']

export default function MessageInput(): JSX.Element {
  const activeChannelId = useStore((s) => s.activeChannelId)
  const channelName = useStore((s) => s.channelName)
  const isDM = useStore((s) => s.isDM)
  const replyTarget = useStore((s) => s.replyTarget)
  const editingId = useStore((s) => s.editingId)
  const messages = useStore((s) => s.messages)
  const setReplyTarget = useStore((s) => s.setReplyTarget)
  const setEditing = useStore((s) => s.setEditing)
  const sendMessage = useStore((s) => s.sendMessage)
  const pushToast = useStore((s) => s.pushToast)
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const typingRef = useRef(0)

  useEffect(() => {
    if (editingId) {
      const m = messages.find((x) => x.id === editingId)
      setText(m?.content || '')
      ref.current?.focus()
    }
  }, [editingId, messages])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [text])

  const triggerTyping = (): void => {
    const now = Date.now()
    if (now - typingRef.current > 4000) {
      typingRef.current = now
      api.typing()
    }
  }

  const submit = async (): Promise<void> => {
    const value = text
    if (!value.trim()) return
    setText('')
    setShowEmoji(false)
    await sendMessage(value)
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      if (editingId) setEditing(null)
      if (replyTarget) setReplyTarget(null)
    }
  }

  const attach = async (): Promise<void> => {
    const path = await api.pickFile()
    if (path) {
      await api.sendFile(path, text)
      setText('')
      pushToast('File sent', 'success')
    }
  }

  if (!activeChannelId) return <></>

  return (
    <div className="composer">
      {replyTarget && (
        <div className="composer-banner">
          <span>Replying to <b>{replyTarget.author}</b></span>
          <button onClick={() => setReplyTarget(null)}>✕</button>
        </div>
      )}
      {editingId && (
        <div className="composer-banner edit">
          <span>Editing message · <i>escape to cancel</i></span>
          <button onClick={() => setEditing(null)}>✕</button>
        </div>
      )}
      <div className="composer-box">
        <button className="composer-attach" title="Send a file" onClick={attach}>
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <textarea
          ref={ref}
          rows={1}
          className="composer-input"
          placeholder={`Message ${isDM ? '@' : '#'}${channelName}`}
          value={text}
          spellCheck={useStore.getState().settings.spellcheck}
          onChange={(e) => {
            setText(e.target.value)
            triggerTyping()
          }}
          onKeyDown={onKey}
        />
        <div className="composer-tools">
          {showEmoji && (
            <div className="emoji-popover">
              {EMOJI.map((e) => (
                <button key={e} onClick={() => { setText((t) => t + e); ref.current?.focus() }}>{e}</button>
              ))}
            </div>
          )}
          <button className="composer-emoji" title="Emoji" onClick={() => setShowEmoji((v) => !v)}>
            <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 17.5c-2.3 0-4.3-1.4-5-3.5h10c-.7 2.1-2.7 3.5-5 3.5Z" /></svg>
          </button>
          <button className={'composer-send ' + (text.trim() ? 'ready' : '')} title="Send" onClick={submit}>
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 20.5 22 12 3 3.5 3 10l13 2-13 2z" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
