import { useEffect } from 'react'
import { useStore } from './store'
import TitleBar from './components/TitleBar'
import Login from './components/Login'
import ServerRail from './components/ServerRail'
import ChannelSidebar from './components/ChannelSidebar'
import ChatView from './components/ChatView'
import MemberList from './components/MemberList'
import MusicPanel from './components/MusicPanel'
import Settings from './components/Settings'
import ServerSettings from './components/ServerSettings'
import Toasts from './components/Toasts'
import ContextMenu from './components/ContextMenu'
import ProfileCard from './components/ProfileCard'
import EmbedBuilder from './components/EmbedBuilder'

export default function App(): JSX.Element {
  const ready = useStore((s) => s.ready)
  const view = useStore((s) => s.view)
  const showMembers = useStore((s) => s.showMembers)
  const showSettings = useStore((s) => s.showSettings)
  const showServerSettings = useStore((s) => s.showServerSettings)
  const showMusic = useStore((s) => s.showMusic)
  const isDM = useStore((s) => s.isDM)
  const activeChannelId = useStore((s) => s.activeChannelId)
  const init = useStore((s) => s.init)

  useEffect(() => {
    init()
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [init])

  if (!ready) return <div className="boot" />

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        {view === 'login' ? (
          <Login />
        ) : showSettings ? (
          <Settings />
        ) : showServerSettings ? (
          <ServerSettings />
        ) : (
          <div className="workspace">
            <ServerRail />
            <ChannelSidebar />
            <div className="main-column">
              <ChatView />
            </div>
            {showMusic ? (
              <MusicPanel />
            ) : (
              showMembers && activeChannelId && !isDM && <MemberList />
            )}
          </div>
        )}
      </div>
      <ContextMenu />
      <ProfileCard />
      <EmbedBuilder />
      <Toasts />
    </div>
  )
}
