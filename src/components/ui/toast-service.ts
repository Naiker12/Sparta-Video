import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading'
export type ToastAction = { label: string; onClick: () => void }
export type ToastItem = {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  action?: ToastAction
  duration: number
  createdAt: number
}
export type ToastOptions = Partial<Pick<ToastItem, 'id' | 'description' | 'action' | 'duration'>>

const MAX_VISIBLE = 4
const DEFAULT_DURATION: Record<ToastVariant, number> = { success: 3200, info: 3600, warning: 5200, error: 6400, loading: 0 }
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
    const item: ToastItem = { id, variant, title, description: options.description, action: options.action, duration: options.duration ?? DEFAULT_DURATION[variant], createdAt: Date.now() }
    set((state) => {
      const exists = state.toasts.some((toast) => toast.id === id)
      const toasts = exists ? state.toasts.map((toast) => toast.id === id ? item : toast) : [...state.toasts, item]
      return { toasts: toasts.slice(-MAX_VISIBLE) }
    })
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: id ? state.toasts.filter((toast) => toast.id !== id) : [] })),
}))

const push = (variant: ToastVariant) => (title: string, options?: ToastOptions) => useToastStore.getState().push(variant, title, options)

export const toast = Object.assign(push('info'), {
  success: push('success'), error: push('error'), warning: push('warning'), info: push('info'), loading: push('loading'),
  dismiss: (id?: string) => useToastStore.getState().dismiss(id),
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

export function errorMessage(reason: unknown, fallback: string) {
  if (typeof reason === 'string' && reason.trim()) return reason
  if (reason instanceof Error && reason.message.trim()) return reason.message
  return fallback
}
