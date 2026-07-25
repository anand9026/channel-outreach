import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  size?: 'md' | 'lg' | 'default'
  children: ReactNode
  footer?: ReactNode
}

export function Drawer({ open, onClose, title, subtitle, size, children, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  const sizeCls = size === 'md' ? ' md' : size === 'lg' ? ' lg' : ''

  return (
    <>
      <div className="rx-overlay" onClick={onClose} aria-hidden />
      <aside
        className={`rx-drawer${sizeCls}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rx-drawer-title"
      >
        <div className="rx-drawer-head">
          <div>
            <div id="rx-drawer-title" className="rx-drawer-title">
              {title}
            </div>
            {subtitle ? <div className="rx-drawer-sub">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            className="rx-icon-btn"
            onClick={onClose}
            aria-label="Close"
            data-testid="drawer-close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="rx-drawer-body">{children}</div>
        {footer ? <div className="rx-drawer-foot">{footer}</div> : null}
      </aside>
    </>
  )
}
