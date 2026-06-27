import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Icon from './Icon'
import { formatContent } from '../format'
import type { EmbedData, EmbedField } from '@shared/types'

const EMPTY: EmbedData = {
  title: '',
  description: '',
  url: '',
  color: '#5865F2',
  authorName: '',
  authorIcon: '',
  authorUrl: '',
  footerText: '',
  footerIcon: '',
  image: '',
  thumbnail: '',
  timestamp: false,
  content: '',
  fields: []
}

export default function EmbedBuilder(): JSX.Element | null {
  const show = useStore((s) => s.showEmbed)
  const close = useStore((s) => s.setShowEmbed)
  const pushToast = useStore((s) => s.pushToast)
  const botName = useStore((s) => s.user?.name || 'Bot')
  const botAvatar = useStore((s) => s.user?.avatar)
  const [d, setD] = useState<EmbedData>(EMPTY)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') useStore.getState().setShowEmbed(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!show) return null

  const set = <K extends keyof EmbedData>(k: K, v: EmbedData[K]): void => setD((p) => ({ ...p, [k]: v }))
  const setField = (i: number, k: keyof EmbedField, v: string | boolean): void =>
    setD((p) => ({ ...p, fields: p.fields.map((f, j) => (j === i ? { ...f, [k]: v } : f)) }))
  const addField = (): void =>
    setD((p) => (p.fields.length >= 25 ? p : { ...p, fields: [...p.fields, { name: '', value: '', inline: false }] }))
  const removeField = (i: number): void => setD((p) => ({ ...p, fields: p.fields.filter((_, j) => j !== i) }))

  const send = async (): Promise<void> => {
    await api.sendEmbed(d)
    useStore.getState().setShowEmbed(false)
    setD(EMPTY)
    pushToast('Embed sent', 'success')
  }

  const hasEmbed =
    d.title || d.description || d.authorName || d.footerText || d.image || d.thumbnail || d.fields.some((f) => f.name && f.value)

  return (
    <div className="embed-overlay" onClick={() => close(false)}>
      <div className="embed-modal" onClick={(e) => e.stopPropagation()}>
        <header className="embed-head">
          <h2>Embed builder</h2>
          <button className="embed-close" onClick={() => close(false)}>
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="embed-body">
          <div className="embed-form">
            <label className="ef-label">Message text (optional, shown above the embed)</label>
            <textarea className="ef-input" rows={2} value={d.content} onChange={(e) => set('content', e.target.value)} />

            <div className="ef-row">
              <div className="ef-col">
                <label className="ef-label">Color</label>
                <div className="ef-color">
                  <input type="color" value={d.color} onChange={(e) => set('color', e.target.value)} />
                  <span>{d.color}</span>
                </div>
              </div>
              <label className="ef-toggle">
                <input type="checkbox" checked={d.timestamp} onChange={(e) => set('timestamp', e.target.checked)} />
                Timestamp
              </label>
            </div>

            <label className="ef-label">Author</label>
            <input className="ef-input" placeholder="Author name" value={d.authorName} onChange={(e) => set('authorName', e.target.value)} />
            <div className="ef-row">
              <input className="ef-input" placeholder="Author icon URL" value={d.authorIcon} onChange={(e) => set('authorIcon', e.target.value)} />
              <input className="ef-input" placeholder="Author link URL" value={d.authorUrl} onChange={(e) => set('authorUrl', e.target.value)} />
            </div>

            <label className="ef-label">Title</label>
            <input className="ef-input" placeholder="Embed title" value={d.title} onChange={(e) => set('title', e.target.value)} />
            <input className="ef-input" placeholder="Title link URL (optional)" value={d.url} onChange={(e) => set('url', e.target.value)} />

            <label className="ef-label">Description</label>
            <textarea className="ef-input" rows={4} placeholder="Markdown supported" value={d.description} onChange={(e) => set('description', e.target.value)} />

            <label className="ef-label">Fields ({d.fields.length}/25)</label>
            {d.fields.map((f, i) => (
              <div className="ef-field" key={i}>
                <div className="ef-row">
                  <input className="ef-input" placeholder="Field name" value={f.name} onChange={(e) => setField(i, 'name', e.target.value)} />
                  <button className="ef-remove" onClick={() => removeField(i)} title="Remove field">
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <textarea className="ef-input" rows={2} placeholder="Field value" value={f.value} onChange={(e) => setField(i, 'value', e.target.value)} />
                <label className="ef-toggle small">
                  <input type="checkbox" checked={f.inline} onChange={(e) => setField(i, 'inline', e.target.checked)} />
                  Inline
                </label>
              </div>
            ))}
            {d.fields.length < 25 && (
              <button className="ef-add" onClick={addField}>
                <Icon name="add" size={16} /> Add field
              </button>
            )}

            <label className="ef-label">Images</label>
            <input className="ef-input" placeholder="Large image URL" value={d.image} onChange={(e) => set('image', e.target.value)} />
            <input className="ef-input" placeholder="Thumbnail URL" value={d.thumbnail} onChange={(e) => set('thumbnail', e.target.value)} />

            <label className="ef-label">Footer</label>
            <input className="ef-input" placeholder="Footer text" value={d.footerText} onChange={(e) => set('footerText', e.target.value)} />
            <input className="ef-input" placeholder="Footer icon URL" value={d.footerIcon} onChange={(e) => set('footerIcon', e.target.value)} />
          </div>

          <div className="embed-preview-wrap">
            <div className="ef-label">Preview</div>
            <div className="preview-msg">
              <img className="preview-avatar" src={botAvatar || ''} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
              <div className="preview-content">
                <div className="preview-author"><b>{botName}</b><span className="bot-tag">APP</span></div>
                {d.content && <div className="preview-text">{formatContent(d.content)}</div>}
                {hasEmbed && (
                  <div className="embed-card" style={{ borderColor: d.color }}>
                    <div className="embed-grid">
                      <div className="embed-main">
                        {d.authorName && (
                          <div className="embed-author">
                            {d.authorIcon && <img src={d.authorIcon} alt="" />}
                            <span>{d.authorName}</span>
                          </div>
                        )}
                        {d.title && <div className="embed-title">{d.title}</div>}
                        {d.description && <div className="embed-desc">{formatContent(d.description)}</div>}
                        {d.fields.filter((f) => f.name && f.value).length > 0 && (
                          <div className="embed-fields">
                            {d.fields.filter((f) => f.name && f.value).map((f, i) => (
                              <div className={'embed-field ' + (f.inline ? 'inline' : '')} key={i}>
                                <div className="embed-field-name">{f.name}</div>
                                <div className="embed-field-value">{formatContent(f.value)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {d.image && <img className="embed-image" src={d.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                        {(d.footerText || d.timestamp) && (
                          <div className="embed-footer">
                            {d.footerIcon && <img src={d.footerIcon} alt="" />}
                            <span>{d.footerText}{d.footerText && d.timestamp ? ' • ' : ''}{d.timestamp ? new Date().toLocaleString() : ''}</span>
                          </div>
                        )}
                      </div>
                      {d.thumbnail && <img className="embed-thumb" src={d.thumbnail} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="embed-foot">
          <button className="btn-secondary" onClick={() => setD(EMPTY)}>Clear</button>
          <button className="btn-primary" onClick={send} disabled={!hasEmbed && !d.content}>Send embed</button>
        </footer>
      </div>
    </div>
  )
}
