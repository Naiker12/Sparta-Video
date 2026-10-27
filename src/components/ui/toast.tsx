import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, X, XCircle } from 'lucide-react'
import { t } from '../../features/editor/services/locale'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading'

export type ToastAction = { label: string; onClick: () => void }

export type ToastItem = {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  action?: ToastAction
  /** Milliseconds before auto-dismiss. `0` keeps the toast until dismissed. */
  duration: number
  createdAt: number
}

export type ToastOptions = Partial<Pick<ToastItem, 'id' | 'description' | 'action' | 'duration'>>

const MAX_VISIBLE = 4
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3200,
  info: 3600,
  warning: 5200,
  error: 6400,
  loading: 0,
}

type ToastState = {
  toasts: ToastItem[]
  push: (variant: ToastVariant, title: string, options?: ToastOptions) => string
  dismiss: (id?: string) => void
}

let sequence = 0
const nextId = () => `toast-${Date.now().toString(36)}-${(sequence += 1)}`

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (variant, title, options = {}) => {
    const id = options.id ?? nextId()
    const item: ToastItem = {
      id,
      variant,
      title,
      description: options.description,
      action: options.action,
      duration: options.duration ?? DEFAULT_DURATION[variant],
      createdAt: Date.now(),
    }
    set((state) => {
      const exists = state.toasts.some((toast) => toast.id === id)
      // Updating an existing id (e.g. loading → success) keeps its position in the stack.
      const toasts = exists ? state.toasts.map((toast) => (toast.id === id ? item : toast)) : [...state.toasts, item]
      return { toasts: toasts.slice(-MAX_VISIBLE) }
    })
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: id ? state.toasts.filter((toast) => toast.id !== id) : [] })),
}))

const push = (variant: ToastVariant) => (title: string, options?: ToastOptions) => useToastStore.getState().push(variant, title, options)

/** Imperative API usable from components, services and event handlers. */
export const toast = Object.assign(push('info'), {
  success: push('success'),
  error: push('error'),
  warning: push('warning'),
  info: push('info'),
  loading: push('loading'),
  dismiss: (id?: string) => useToastStore.getState().dismiss(id),
  /** Shows a loading toast that resolves into success or error with the same id. */
  promise: async <T,>(task: Promise<T>, messages: { loading: string; success: string | ((value: T) => string); error: string | ((reason: unknown) => string) }) => {
    const id = push('loading')(messages.loading)
    try {
      const value = await task
      push('success')(typeof messages.success === 'function' ? messages.success(value) : messages.success, { id })
      return value
    } catch (reason) {
      push('error')(typeof messages.error === 'function' ? messages.error(reason) : messages.error, { id })
      throw reason
    }
  },
})

/** Normalizes Tauri (string) and JS errors into a readable message. */
export function errorMessage(reason: unknown, fallback: string) {
  if (typeof reason === 'string' && reason.trim()) return reason
  if (reason instanceof Error && reason.message.trim()) return reason.message
  return fallback
}

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
