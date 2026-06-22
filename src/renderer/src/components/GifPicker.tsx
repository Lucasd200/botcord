import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

// Tenor's public sample key — works out of the box; users can set their own in
// Settings → Advanced if it ever gets rate-limited.
const DEFAULT_TENOR_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'

interface Gif {
  id: string
  url: string
  preview: string
  desc: string
}

export default function GifPicker({ onClose }: { onClose: () => void }): JSX.Element {
  const settingsKey = useStore((s) => s.settings.tenorApiKey)
  const sendMessage = useStore((s) => s.sendMessage)
  const pushToast = useStore((s) => s.pushToast)
  const key = settingsKey || DEFAULT_TENOR_KEY
  const [q, setQ] = useState('')
  const [gifs, setGifs] = useState<Gif[]>([])
  const [loading, setLoading] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    let live = true
    setLoading(true)
    const run = async (): Promise<void> => {
      try {
        const term = q.trim()
        const base = term
          ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(term)}`
          : 'https://tenor.googleapis.com/v2/featured?'
        const url = `${base}&key=${key}&client_key=botcord&limit=24&media_filter=tinygif,gif&contentfilter=medium`
        const r = await fetch(url)
        const j = await r.json()
        if (j.error) throw new Error(j.error.message || 'Tenor request failed')
        const list: Gif[] = (j.results || [])
          .map((g: any) => ({
            id: String(g.id),
            url: g.media_formats?.gif?.url || g.url,
            preview: g.media_formats?.tinygif?.url || g.media_formats?.gif?.url,
            desc: g.content_description || 'gif'
          }))
          .filter((g: Gif) => g.url && g.preview)
        if (live) setGifs(list)
      } catch (e) {
        if (live) pushToast('GIF search failed: ' + (e as Error).message, 'error')
      } finally {
        if (live) setLoading(false)
      }
    }
    const t = setTimeout(run, q ? 350 : 0)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q, key, pushToast])

  const pick = async (g: Gif): Promise<void> => {
    onClose()
    await sendMessage(g.url)
  }

  return (
    <div className="gif-picker" ref={boxRef}>
      <div className="gif-search">
        <input
          autoFocus
          placeholder="Search Tenor"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="gif-close" onClick={onClose} title="Close">
          ✕
        </button>
      </div>
      <div className="gif-grid">
        {loading && <div className="gif-msg">Loading…</div>}
        {!loading && gifs.length === 0 && <div className="gif-msg">No GIFs found.</div>}
        {gifs.map((g) => (
          <button key={g.id} className="gif-cell" onClick={() => pick(g)} title={g.desc}>
            <img src={g.preview} alt={g.desc} loading="lazy" />
          </button>
        ))}
      </div>
      <div className="gif-foot">Powered by Tenor</div>
    </div>
  )
}
