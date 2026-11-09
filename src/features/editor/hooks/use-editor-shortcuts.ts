import { useEffect } from 'react'
import { useEditorStore } from '../editor-store'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'

interface UseEditorShortcutsOptions {
  settingsOpen: boolean
  renameOpen: boolean
  effectiveDuration: number
  handleClearSubtitles: () => void
  undo: () => void
  redo: () => void
  moveClip: (clipId: string, start: number, duration?: number) => void
  setPlayhead: (playhead: number) => void
  duplicateClip: (clipId: string) => void
  deleteClip: (clipId: string) => void
  splitClip: (clipId: string, at: number) => void
  freezeFrame: (clipId: string, at: number) => string | null
  toggleSnap: () => void
  setActiveTool: (tool: 'select' | 'razor') => void
  addMarker: (time: number) => void
}

export function useEditorShortcuts({
  settingsOpen,
  renameOpen,
  effectiveDuration,
  handleClearSubtitles,
  undo,
  redo,
  moveClip,
  setPlayhead,
  duplicateClip,
  deleteClip,
  splitClip,
  freezeFrame,
  toggleSnap,
  setActiveTool,
  addMarker,
}: UseEditorShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      if (
        event.target instanceof HTMLElement &&
        (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target.isContentEditable ||
          (event.target.closest(
            'button,select,[role="dialog"],[role="menu"],[role="menuitem"],[role="separator"],[role="slider"],[role="switch"],[role="tab"],[role="tabpanel"]',
          ) &&
            !event.target.closest('.timeline-clip')))
      ) {
        return
      }
      if (settingsOpen || renameOpen) return

      const clipFocused = event.target instanceof HTMLElement && !!event.target.closest('.timeline-clip')
      if (clipFocused) {
        if (event.code === 'Space' || ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.altKey)) {
          return
        }
      }

      const timelineFocused =
        event.target instanceof HTMLElement &&
        (!!event.target.closest('[role="region"]') || !!event.target.closest('.timeline-panel'))

      if (timelineFocused && clipFocused && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const state = useEditorStore.getState()
        const clip = state.tracks.flatMap((track) => track.clips).find((item) => item.id === state.selectedClipId)
        const owner = state.tracks.find((track) => track.clips.some((item) => item.id === clip?.id))
        if (clip && owner && !state.lockedTracks.includes(owner.id)) {
          const direction = event.key === 'ArrowLeft' ? -1 : 1
          const step = event.shiftKey ? 1 : 1 / state.sequence.frameRate
          if (event.ctrlKey && event.altKey) {
            const start = Math.max(0, clip.start + direction * step)
            const duration = Math.max(1 / state.sequence.frameRate, clip.duration - (start - clip.start))
            moveClip(
              clip.id,
              state.snapToFrames ? Math.round(start * state.sequence.frameRate) / state.sequence.frameRate : start,
              state.snapToFrames ? Math.round(duration * state.sequence.frameRate) / state.sequence.frameRate : duration,
            )
          } else if (event.altKey) {
            const duration = Math.max(1 / state.sequence.frameRate, clip.duration + direction * step)
            moveClip(
              clip.id,
              clip.start,
              state.snapToFrames ? Math.round(duration * state.sequence.frameRate) / state.sequence.frameRate : duration,
            )
          } else {
            const start = Math.max(0, clip.start + direction * step)
            moveClip(
              clip.id,
              state.snapToFrames ? Math.round(start * state.sequence.frameRate) / state.sequence.frameRate : start,
            )
          }
          event.preventDefault()
          return
        }
      }

      if (event.key === 'ArrowLeft') {
        setPlayhead(useEditorStore.getState().playhead - (event.shiftKey ? 1 : 1 / useEditorStore.getState().sequence.frameRate))
      }
      if (event.key === 'ArrowRight') {
        setPlayhead(useEditorStore.getState().playhead + (event.shiftKey ? 1 : 1 / useEditorStore.getState().sequence.frameRate))
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setPlayhead(0)
      }
      if (event.key === 'End') {
        event.preventDefault()
        setPlayhead(effectiveDuration)
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        const id = useEditorStore.getState().selectedClipId
        if (id) {
          event.preventDefault()
          duplicateClip(id)
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('[aria-label="Buscar medios"]')?.focus()
      }
      if (event.altKey && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        handleClearSubtitles()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const id = useEditorStore.getState().selectedClipId
        if (id) {
          event.preventDefault()
          deleteClip(id)
        }
      }
      if (
        (event.key.toLowerCase() === 's' && !event.ctrlKey && !event.metaKey) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b')
      ) {
        const st = useEditorStore.getState()
        if (st.selectedClipId) {
          event.preventDefault()
          splitClip(st.selectedClipId, st.playhead)
        }
      }
      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const st = useEditorStore.getState()
        if (st.selectedClipId) {
          event.preventDefault()
          const frozenId = freezeFrame(st.selectedClipId, st.playhead)
          if (frozenId) toast.success(t('Fotograma congelado insertado', 'Frozen frame inserted'))
        }
      }
      if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        toggleSnap()
      }
      if (event.key.toLowerCase() === 'c') setActiveTool('razor')
      if (event.key.toLowerCase() === 'v') setActiveTool('select')
      if (event.key.toLowerCase() === 'm') addMarker(useEditorStore.getState().playhead)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    addMarker,
    deleteClip,
    duplicateClip,
    effectiveDuration,
    freezeFrame,
    handleClearSubtitles,
    moveClip,
    redo,
    renameOpen,
    setActiveTool,
    setPlayhead,
    settingsOpen,
    splitClip,
    toggleSnap,
    undo,
  ])
}

