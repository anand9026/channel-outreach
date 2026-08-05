import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useWhatsAppStore, type ToastItem } from '../store/WhatsAppStore'

const ICONS: Record<string, string> = {
  success: '✓',
  info: '•',
  error: '!',
}

const TOAST_DURATION_MS: Record<ToastItem['variant'], number> = {
  success: 4000,
  info: 4500,
  error: 6000,
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  useEffect(() => {
    const duration = TOAST_DURATION_MS[toast.variant] ?? 4500
    const timer = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.variant, onDismiss])

  return (
    <div className={`rx-toast ${toast.variant}`} role="status">
      <span aria-hidden>{ICONS[toast.variant] ?? '•'}</span>
      <span>{toast.message}</span>
      <button
        type="button"
        className="rx-toast-close"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastStack() {
  const { state, actions } = useWhatsAppStore()
  if (state.toasts.length === 0) return null
  return (
    <div className="rx-toasts">
      {state.toasts.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          onDismiss={() => actions.dismissToast(t.id)}
        />
      ))}
    </div>
  )
}
