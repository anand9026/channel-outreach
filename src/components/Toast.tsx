import { X } from 'lucide-react'
import { useWhatsAppStore } from '../store/WhatsAppStore'

const ICONS: Record<string, string> = {
  success: '✓',
  info: '•',
  error: '!',
}

export function ToastStack() {
  const { state, actions } = useWhatsAppStore()
  if (state.toasts.length === 0) return null
  return (
    <div className="rx-toasts">
      {state.toasts.map((t) => (
        <div key={t.id} className={`rx-toast ${t.variant}`} role="status">
          <span aria-hidden>{ICONS[t.variant] ?? '•'}</span>
          <span>{t.message}</span>
          <button
            type="button"
            className="rx-toast-close"
            aria-label="Dismiss"
            onClick={() => actions.dismissToast(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
