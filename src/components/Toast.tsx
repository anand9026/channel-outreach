import { X } from 'lucide-react'
import { useWhatsAppStore } from '../store/WhatsAppStore'

export function ToastStack() {
  const { state, actions } = useWhatsAppStore()

  if (state.toasts.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite">
      {state.toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.variant}`}>
          <span>{t.message}</span>
          <button
            type="button"
            className="icon-btn ghost"
            aria-label="Dismiss"
            onClick={() => actions.dismissToast(t.id)}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
