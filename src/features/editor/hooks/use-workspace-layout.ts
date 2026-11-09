import { useEffect, useState } from 'react'
import { useDefaultLayout, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'

const layoutMemory = new Map<string, string>()

export const layoutStorage: Storage = {
  get length() {
    try {
      return window.localStorage.length
    } catch {
      return layoutMemory.size
    }
  },
  clear() {
    layoutMemory.clear()
    try {
      window.localStorage.clear()
    } catch {
      /* memory fallback */
    }
  },
  getItem(key) {
    try {
      const raw = window.localStorage.getItem(key) ?? layoutMemory.get(key) ?? null
      if (raw && (key.includes('sparta-workspace') || key === 'sparta-workspace')) {
        try {
          const parsed = JSON.parse(raw)
          let modified = false
          if (typeof parsed.library === 'number' && parsed.library < 20) {
            parsed.library = 24
            const rest = 100 - parsed.library - (typeof parsed.assistant === 'number' ? parsed.assistant : 0)
            parsed.editor = Math.max(45, rest)
            modified = true
          }
          for (const k of Object.keys(parsed)) {
            const entry = parsed[k]
            if (entry && Array.isArray(entry.layout) && typeof entry.layout[0] === 'number' && entry.layout[0] < 20) {
              entry.layout[0] = 24
              const rest = 100 - entry.layout[0] - (entry.layout[2] ?? 0)
              entry.layout[1] = Math.max(45, rest)
              modified = true
            }
          }
          if (modified) {
            const healed = JSON.stringify(parsed)
            try {
              window.localStorage.setItem(key, healed)
            } catch {
              /* ignore */
            }
            layoutMemory.set(key, healed)
            return healed
          }
        } catch {
          /* parse error, ignore */
        }
      }
      if (raw !== null) layoutMemory.set(key, raw)
      return raw
    } catch {
      return layoutMemory.get(key) ?? null
    }
  },
  key(index) {
    try {
      return window.localStorage.key(index)
    } catch {
      return [...layoutMemory.keys()][index] ?? null
    }
  },
  removeItem(key) {
    layoutMemory.delete(key)
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* memory fallback */
    }
  },
  setItem(key, value) {
    layoutMemory.set(key, value)
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* retain in session */
    }
  },
}

export function useWorkspaceLayout() {
  const [chatOpen, setChatOpen] = useState(true)
  const [timelineExpanded, setTimelineExpanded] = useState(false)

  const assistantPanelRef = usePanelRef()
  const appWorkspaceGroupRef = useGroupRef()
  const mainVerticalGroupRef = useGroupRef()
  const upperGroupRef = useGroupRef()

  const appWorkspaceLayout = useDefaultLayout({
    id: 'sparta-app-workspace',
    panelIds: ['editor', 'assistant'],
    storage: layoutStorage,
  })
  const verticalLayout = useDefaultLayout({
    id: 'sparta-main-vertical',
    panelIds: ['stage', 'timeline'],
    storage: layoutStorage,
  })
  const upperLayout = useDefaultLayout({
    id: 'sparta-upper-workspace',
    panelIds: ['library', 'monitor', 'inspector'],
    storage: layoutStorage,
  })

  useEffect(() => {
    const panel = assistantPanelRef.current
    if (panel) setChatOpen(!panel.isCollapsed())
  }, [assistantPanelRef])

  const toggleAssistant = () => {
    if (!chatOpen) {
      appWorkspaceGroupRef.current?.setLayout({ editor: 76, assistant: 24 })
      setChatOpen(true)
    } else {
      appWorkspaceGroupRef.current?.setLayout({ editor: 100, assistant: 0 })
      setChatOpen(false)
    }
  }

  useEffect(() => {
    const healLayoutIfCrushed = () => {
      try {
        const layout = upperGroupRef.current?.getLayout() as Record<string, number> | undefined
        if (layout && typeof layout.library === 'number' && layout.library < 18) {
          upperGroupRef.current?.setLayout({
            library: 24,
            monitor: 50,
            inspector: 26,
          })
        }
        const vertLayout = mainVerticalGroupRef.current?.getLayout() as Record<string, number> | undefined
        if (vertLayout && typeof vertLayout.timeline === 'number' && vertLayout.timeline < 20) {
          mainVerticalGroupRef.current?.setLayout({ stage: 58, timeline: 42 })
        }
      } catch {
        /* ignore */
      }
    }
    const timer = setTimeout(healLayoutIfCrushed, 100)
    return () => clearTimeout(timer)
  }, [chatOpen, upperGroupRef, mainVerticalGroupRef])

  useEffect(() => {
    const compactLayout = () => {
      if (window.innerWidth >= 1100) return
      if (assistantPanelRef.current && !assistantPanelRef.current.isCollapsed()) {
        assistantPanelRef.current.collapse()
      }
      appWorkspaceGroupRef.current?.setLayout({ editor: 100, assistant: 0 })
      upperGroupRef.current?.setLayout({ library: 28, monitor: 44, inspector: 28 })
      mainVerticalGroupRef.current?.setLayout({ stage: 56, timeline: 44 })
      setChatOpen(false)
    }
    compactLayout()
    window.addEventListener('resize', compactLayout)
    return () => window.removeEventListener('resize', compactLayout)
  }, [assistantPanelRef, appWorkspaceGroupRef, mainVerticalGroupRef, upperGroupRef])

  const resetWorkspace = () => {
    try {
      window.localStorage.removeItem('react-resizable-panels:sparta-workspace')
      window.localStorage.removeItem('react-resizable-panels:sparta-app-workspace')
      window.localStorage.removeItem('react-resizable-panels:sparta-main-vertical')
      window.localStorage.removeItem('react-resizable-panels:sparta-upper-workspace')
      window.localStorage.removeItem('react-resizable-panels:sparta-preview-inspector')
      window.localStorage.removeItem('react-resizable-panels:sparta-editor-vertical')
      window.localStorage.removeItem('sparta-workspace')
      window.localStorage.removeItem('sparta-app-workspace')
      window.localStorage.removeItem('sparta-main-vertical')
      window.localStorage.removeItem('sparta-upper-workspace')
    } catch {
      /* ignore */
    }
    mainVerticalGroupRef.current?.setLayout({ stage: 58, timeline: 42 })
    appWorkspaceGroupRef.current?.setLayout({ editor: 100, assistant: 0 })
    upperGroupRef.current?.setLayout({ library: 24, monitor: 50, inspector: 26 })
    toast.success(t('Distribución de paneles restablecida', 'Panel layout reset'))
  }

  const toggleTimelineExpanded = () => {
    const next = !timelineExpanded
    setTimelineExpanded(next)
    if (next) {
      mainVerticalGroupRef.current?.setLayout({ stage: 18, timeline: 82 })
    } else {
      mainVerticalGroupRef.current?.setLayout({ stage: 58, timeline: 42 })
    }
  }

  return {
    chatOpen,
    setChatOpen,
    timelineExpanded,
    toggleAssistant,
    resetWorkspace,
    toggleTimelineExpanded,
    assistantPanelRef,
    appWorkspaceGroupRef,
    mainVerticalGroupRef,
    upperGroupRef,
    appWorkspaceLayout,
    verticalLayout,
    upperLayout,
  }
}

