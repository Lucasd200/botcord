import { useStore } from '../store'

export default function Toasts(): JSX.Element {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + t.kind} onClick={() => dismiss(t.id)}>
          {t.kind === 'error' ? '⚠️' : t.kind === 'success' ? '✅' : 'ℹ️'} <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
