import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, X, XCircle } from 'lucide-react'
import { t } from '../i18n/locale'
import { useToastStore, type ToastItem, type ToastVariant } from './toast-service'

const variantConfig: Record<
  ToastVariant,
  {
    icon: typeof Info
    cardClass: string
    iconBoxClass: string
    iconClass: string
    barClass: string
  }
> = {
  success: {
    icon: CheckCircle2,
    cardClass:
      'bg-[#0f141c]/95 border-emerald-500/35 shadow-[0_12px_32px_rgba(0,0,0,0.65),0_0_20px_rgba(16,185,129,0.12)]',
    iconBoxClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    iconClass: 'text-emerald-400',
    barClass: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    cardClass:
      'bg-[#170f14]/95 border-rose-500/35 shadow-[0_12px_32px_rgba(0,0,0,0.65),0_0_20px_rgba(244,63,94,0.12)]',
    iconBoxClass: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    iconClass: 'text-rose-400',
    barClass: 'bg-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    cardClass:
      'bg-[#17140f]/95 border-amber-500/35 shadow-[0_12px_32px_rgba(0,0,0,0.65),0_0_20px_rgba(245,158,11,0.12)]',
    iconBoxClass: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    iconClass: 'text-amber-400',
    barClass: 'bg-amber-500',
  },
  info: {
    icon: Info,
    cardClass:
      'bg-[#0f121a]/95 border-sky-500/35 shadow-[0_12px_32px_rgba(0,0,0,0.65),0_0_20px_rgba(56,189,248,0.12)]',
    iconBoxClass: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
    iconClass: 'text-sky-400',
    barClass: 'bg-sky-500',
  },
  loading: {
    icon: LoaderCircle,
    cardClass:
      'bg-[#120f1a]/95 border-purple-500/35 shadow-[0_12px_32px_rgba(0,0,0,0.65),0_0_20px_rgba(168,85,247,0.12)]',
    iconBoxClass: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    iconClass: 'text-purple-400 animate-spin',
    barClass: 'bg-purple-500',
  },
}

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
    return () => {
      window.clearTimeout(timer)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [item.duration, paused, leaving])

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => dismiss(item.id), 180)
    return () => window.clearTimeout(timer)
  }, [leaving, dismiss, item.id])

  const conf = variantConfig[item.variant]
  const Icon = conf.icon
  const assertive = item.variant === 'error' || item.variant === 'warning'

  return (
    <li
      className={`toast toast-${item.variant} pointer-events-auto relative flex items-start gap-3 w-[min(380px,calc(100vw-32px))] p-3.5 rounded-2xl border backdrop-blur-xl transition-all duration-200 select-none overflow-hidden ${conf.cardClass} ${
        leaving ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className={`toast-icon w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${conf.iconBoxClass}`}
        aria-hidden="true"
      >
        <Icon size={16} className={conf.iconClass} />
      </div>

      <div className="toast-body flex-1 min-w-0 flex flex-col gap-0.5 pt-0.5">
        <p className="toast-title text-xs font-semibold text-white tracking-tight leading-tight m-0">
          {item.title}
        </p>
        {item.description && (
          <p className="toast-description text-[11px] text-slate-300/80 leading-normal mt-0.5 break-words m-0">
            {item.description}
          </p>
        )}
      </div>

      {item.action && (
        <button
          type="button"
          className="toast-action self-center px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/10 text-white transition-colors cursor-pointer shrink-0"
          onClick={() => {
            item.action?.onClick()
            setLeaving(true)
          }}
        >
          {item.action.label}
        </button>
      )}

      <button
        type="button"
        className="toast-close p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 mt-0.5 cursor-pointer"
        aria-label={t('Cerrar notificación', 'Dismiss notification')}
        onClick={() => setLeaving(true)}
      >
        <X size={14} />
      </button>

      {item.duration > 0 && (
        <span
          key={item.createdAt}
          className={`toast-progress absolute left-0 right-0 bottom-0 h-0.5 ${conf.barClass} opacity-60 origin-left`}
          style={{
            animationDuration: `${item.duration}ms`,
            animationPlayState: paused || leaving ? 'paused' : 'running',
            animationName: 'toast-progress',
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards',
          }}
          aria-hidden="true"
        />
      )}
    </li>
  )
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        toasts.length &&
        !document.querySelector('[role="dialog"]')
      ) {
        useToastStore.getState().dismiss(toasts.at(-1)?.id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toasts])

  return (
    <section
      className="toaster fixed bottom-6 right-6 z-[99999] pointer-events-none"
      aria-label={t('Notificaciones', 'Notifications')}
    >
      <ol className="toast-list flex flex-col items-end gap-2.5 m-0 p-0 list-none">
        {toasts.map((item) => (
          <ToastCard key={`${item.id}-${item.createdAt}`} item={item} />
        ))}
      </ol>
    </section>
  )
}
