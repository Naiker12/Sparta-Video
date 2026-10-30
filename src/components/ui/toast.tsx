import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, X, XCircle } from 'lucide-react'
import { t } from '../../features/editor/services/locale'
import { useToastStore, type ToastItem, type ToastVariant } from './toast-service'

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: LoaderCircle,
} satisfies Record<ToastVariant, typeof Info>

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss)
  const [paused, setPaused] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const remaining = useRef(item.duration)
  const startedAt = useRef(0)

  useEffect(() => {
    if (!item.duration || paused || leaving) return
    startedAt.current = Date.now()
    const timer = window.setTimeout(() => setLeaving(true), remaining.current)
    return () => { window.clearTimeout(timer); remaining.current -= Date.now() - startedAt.current }
  }, [item.duration, paused, leaving])

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => dismiss(item.id), 180)
    return () => window.clearTimeout(timer)
  }, [leaving, dismiss, item.id])

  const Icon = icons[item.variant]
  const assertive = item.variant === 'error' || item.variant === 'warning'
  return <li
    className={`toast toast-${item.variant}${leaving ? ' is-leaving' : ''}`}
    role={assertive ? 'alert' : 'status'}
    aria-live={assertive ? 'assertive' : 'polite'}
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)}
    onBlur={() => setPaused(false)}
  >
    <span className="toast-icon" aria-hidden="true"><Icon size={15} className={item.variant === 'loading' ? 'spin' : undefined} /></span>
    <div className="toast-body">
      <p className="toast-title">{item.title}</p>
      {item.description && <p className="toast-description">{item.description}</p>}
    </div>
    {item.action && <button type="button" className="toast-action" onClick={() => { item.action?.onClick(); setLeaving(true) }}>{item.action.label}</button>}
    <button type="button" className="toast-close" aria-label={t('Cerrar notificación', 'Dismiss notification')} onClick={() => setLeaving(true)}><X size={13} /></button>
    {item.duration > 0 && <span key={item.createdAt} className="toast-progress" style={{ animationDuration: `${item.duration}ms`, animationPlayState: paused || leaving ? 'paused' : 'running' }} aria-hidden="true" />}
  </li>
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && toasts.length && !document.querySelector('[role="dialog"]')) useToastStore.getState().dismiss(toasts.at(-1)?.id) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toasts])
  return <section className="toaster" aria-label={t('Notificaciones', 'Notifications')}>
    <ol className="toast-list">{toasts.map((item) => <ToastCard key={`${item.id}-${item.createdAt}`} item={item} />)}</ol>
  </section>
}
