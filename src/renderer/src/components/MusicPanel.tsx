import { useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import Icon from './Icon'

function fmt(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MusicPanel(): JSX.Element {
  const voice = useStore((s) => s.voice)
  const nowPlaying = useStore((s) => s.nowPlaying)
  const queue = useStore((s) => s.queue)
  const setShowMusic = useStore((s) => s.setShowMusic)
  const [query, setQuery] = useState('')
  const [volume, setVolume] = useState(50)

  const add = (): void => {
    if (!query.trim()) return
    api.musicEnqueue(query.trim())
    setQuery('')
  }
  const addLocal = async (): Promise<void> => {
    const path = await api.pickAudioFile()
    if (path) api.musicPlayLocal(path)
  }

  return (
    <aside className="music-panel">
      <header className="music-header">
        <span>🎵 Music</span>
        <button className="music-close" onClick={() => setShowMusic(false)} title="Hide">
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="music-scroll">
        {!voice.connected ? (
          <div className="music-empty">
            <p>Join a voice channel (click a 🔊 channel in the list) to start playing music and soundboard clips.</p>
          </div>
        ) : (
          <>
            <div className="voice-status">
              <span className="voice-dot" />
              Connected to <b>{voice.channelName}</b>
              <button className="voice-leave" onClick={() => api.leaveVoice()}>Leave</button>
            </div>

            <div className="now-playing">
              {nowPlaying ? (
                <>
                  {nowPlaying.thumbnail && <img className="np-thumb" src={nowPlaying.thumbnail} alt="" />}
                  <div className="np-title">{nowPlaying.title}</div>
                  <div className="np-meta">
                    {fmt(nowPlaying.duration)} · added by {nowPlaying.requester}
                  </div>
                  <div className="np-controls">
                    <button onClick={() => api.musicToggleLoop()} className={nowPlaying.loop ? 'on' : ''} title="Loop">
                      <Icon name="repeat" size={22} filled={nowPlaying.loop} />
                    </button>
                    <button
                      className="np-play"
                      onClick={() => (nowPlaying.paused ? api.musicResume() : api.musicPause())}
                      title={nowPlaying.paused ? 'Resume' : 'Pause'}
                    >
                      <Icon name={nowPlaying.paused ? 'play_arrow' : 'pause'} size={26} filled />
                    </button>
                    <button onClick={() => api.musicSkip()} title="Skip">
                      <Icon name="skip_next" size={22} filled />
                    </button>
                    <button onClick={() => api.musicStop()} title="Stop">
                      <Icon name="stop" size={22} filled />
                    </button>
                  </div>
                  <div className="np-volume">
                    <Icon name="volume_up" size={18} />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setVolume(v)
                        api.musicSetVolume(v / 100)
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="np-idle">Nothing playing — add a song below.</div>
              )}
            </div>

            <div className="music-add">
              <input
                placeholder="Song, or YouTube / Spotify / SoundCloud link"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
              <button onClick={add} className="music-add-btn">Add</button>
            </div>
            <button className="music-local" onClick={addLocal}>
              <Icon name="add" size={16} /> Add local audio file
            </button>

            {queue.length > 0 && (
              <div className="queue">
                <div className="queue-head">Up next — {queue.length}</div>
                {queue.map((t, i) => (
                  <div className="queue-item" key={i}>
                    <span className="queue-index">{i + 1}</span>
                    <div className="queue-text">
                      <span className="queue-title">{t.title}</span>
                      <span className="queue-req">{fmt(t.duration)} · {t.requester}</span>
                    </div>
                    <button className="queue-remove" onClick={() => api.musicRemove(i)} title="Remove">
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
                <button className="queue-shuffle" onClick={() => api.musicShuffle()}>
                  <Icon name="shuffle" size={16} /> Shuffle
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
