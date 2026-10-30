import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Columns2, CopyPlus, FileDown, FileUp, Film, FolderOpen, Maximize2, Pencil, PlusCircle, Redo2, Scissors, Settings2, Trash2, Undo2, Upload, Video, Zap } from 'lucide-react'
import type { AssistantMode } from './features/editor/components/AssistantPanel'
import { InspectorPanel } from './features/editor/components/InspectorPanel'
import { MediaLibraryPanel } from './features/editor/components/MediaLibraryPanel'
import { PreviewMonitor } from './features/editor/components/PreviewMonitor'
import { TimelinePanel } from './features/editor/components/TimelinePanel'
import { ActionMenu } from './features/editor/components/ActionMenu'
import { RenameProjectDialog } from './features/editor/components/RenameProjectDialog'
import { TimelineAudioEngine } from './features/editor/services/audio-playback'
import { getProjectSaveStatus, subscribeProjectSaveStatus, useEditorStore } from './features/editor/editor-store'
import type { MediaItem, TransitionRef } from './features/editor/model'
import {
  captureVideoThumbnail,
  formatMediaDuration,
  getMediaMimeType,
  probeMediaMetadata,
  storeMediaFile,
  storeMediaPreview,
} from './features/editor/services/media-storage'
import {
  generateSubtitlesFromTimelineVideo,
  repairTimelineAndAssetDurations,
  type SubtitleLanguage,
} from './features/editor/services/subtitle-generator'
import { Group, Panel, Separator, useDefaultLayout, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { t, useLanguage } from './features/editor/services/locale'
import { Toaster } from './components/ui/toast'
import { errorMessage, toast } from './components/ui/toast-service'
import './App.css'
import './styles/editor-polish.css'
import './styles/toast.css'

const AssistantPanel = lazy(() => import('./features/editor/components/AssistantPanel').then(({ AssistantPanel: Component }) => ({ default: Component })))
const ExportDialog = lazy(() => import('./features/editor/components/ExportDialog').then(({ ExportDialog: Component }) => ({ default: Component })))
const PreferencesSheet = lazy(() => import('./features/editor/components/PreferencesSheet').then(({ PreferencesSheet: Component }) => ({ default: Component })))

// Layout is a convenience preference. Keep the editor usable if browser storage is blocked.
const layoutMemory = new Map<string, string>()
const layoutStorage: Storage = {
  get length() { try { return window.localStorage.length } catch { return layoutMemory.size } },
  clear() { layoutMemory.clear(); try { window.localStorage.clear() } catch { /* memory fallback is enough */ } },
  getItem(key) {
    try {
      const raw = window.localStorage.getItem(key) ?? layoutMemory.get(key) ?? null
      if (raw && (key.includes('sparta-workspace') || key === 'sparta-workspace')) {
        try {
          const parsed = JSON.parse(raw)
          let modified = false
          // Check standard object layout { library: number, editor: number, ... }
          if (typeof parsed.library === 'number' && parsed.library < 20) {
            parsed.library = 24
            const rest = 100 - parsed.library - (typeof parsed.assistant === 'number' ? parsed.assistant : 0)
            parsed.editor = Math.max(45, rest)
            modified = true
          }
          // Check react-resizable-panels v2 format: { [panelIds]: { layout: [number, number, number] } }
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
            try { window.localStorage.setItem(key, healed) } catch { /* ignore */ }
            layoutMemory.set(key, healed)
            return healed
          }
        } catch { /* parse error, ignore */ }
      }
      if (raw !== null) layoutMemory.set(key, raw)
      return raw
    } catch {
      return layoutMemory.get(key) ?? null
    }
  },
  key(index) { try { return window.localStorage.key(index) } catch { return [...layoutMemory.keys()][index] ?? null } },
  removeItem(key) { layoutMemory.delete(key); try { window.localStorage.removeItem(key) } catch { /* memory fallback is enough */ } },
  setItem(key, value) { layoutMemory.set(key, value); try { window.localStorage.setItem(key, value) } catch { /* retain the layout for this session */ } },
}

function App() {
  useLanguage()
  const tracks = useEditorStore((state) => state.tracks)
  const assets = useEditorStore((state) => state.assets)
  const markers = useEditorStore((state) => state.markers)
  const snapToFrames = useEditorStore((state) => state.snapToFrames)
  const activeTool = useEditorStore((state) => state.activeTool)
  const projectName = useEditorStore((state) => state.projectName)
  const sequence = useEditorStore((state) => state.sequence)
  const selectedClipId = useEditorStore((state) => state.selectedClipId)
  const selectedMediaId = useEditorStore((state) => state.selectedMediaId)
  const playhead = useEditorStore((state) => state.playhead)
  const playing = useEditorStore((state) => state.playing)
  const zoom = useEditorStore((state) => state.zoom)
  const selectClip = useEditorStore((state) => state.selectClip)
  const selectMedia = useEditorStore((state) => state.selectMedia)
  const setPlayhead = useEditorStore((state) => state.setPlayhead)
  const setPlaying = useEditorStore((state) => state.setPlaying)
  const setZoom = useEditorStore((state) => state.setZoom)
  const addMedia = useEditorStore((state) => state.addMedia)
  const addTextClip = useEditorStore((state) => state.addTextClip)
  const applyPresetToAllSubtitles = useEditorStore((state) => state.applyPresetToAllSubtitles)
  const autoGenerateSubtitles = useEditorStore((state) => state.autoGenerateSubtitles)
  const clearAllSubtitles = useEditorStore((state) => state.clearAllSubtitles)
  const moveClip = useEditorStore((state) => state.moveClip)
  const moveClipToNewTrack = useEditorStore((state) => state.moveClipToNewTrack)
  const addAssets = useEditorStore((state) => state.addAssets)
  const updateAsset = useEditorStore((state) => state.updateAsset)
  const removeAsset = useEditorStore((state) => state.removeAsset)
  const addTrack = useEditorStore((state) => state.addTrack)
  const setProjectName = useEditorStore((state) => state.setProjectName)
  const setSequence = useEditorStore((state) => state.setSequence)
  const updateClip = useEditorStore((state) => state.updateClip)
  const splitClip = useEditorStore((state) => state.splitClip)
  const deleteClip = useEditorStore((state) => state.deleteClip)
  const duplicateClip = useEditorStore((state) => state.duplicateClip)
  const calibrateAllSubtitles = useEditorStore((state) => state.calibrateAllSubtitles)
  const nudgeAllSubtitlesTime = useEditorStore((state) => state.nudgeAllSubtitlesTime)
  const ripplePackTrack = useEditorStore((state) => state.ripplePackTrack)
  const autoAudioBalance = useEditorStore((state) => state.autoAudioBalance)
  const autoSceneMarkers = useEditorStore((state) => state.autoSceneMarkers)
  const addMarker = useEditorStore((state) => state.addMarker)
  const removeMarker = useEditorStore((state) => state.removeMarker)
  const toggleSnap = useEditorStore((state) => state.toggleSnap)
  const setActiveTool = useEditorStore((state) => state.setActiveTool)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const past = useEditorStore((state) => state.past)
  const future = useEditorStore((state) => state.future)
  const mutedTracks = useEditorStore((state) => state.mutedTracks)
  const lockedTracks = useEditorStore((state) => state.lockedTracks)
  const toggleMute = useEditorStore((state) => state.toggleMute)
  const toggleLock = useEditorStore((state) => state.toggleLock)
  const addAdjustmentLayer = useEditorStore((state) => state.addAdjustmentLayer)
  const freezeFrame = useEditorStore((state) => state.freezeFrame)
  const selectedClip = tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId)
  const selectedClipTrack = tracks.find((track) => track.clips.some((clip) => clip.id === selectedClipId))
  const selectedClipReadOnly = !!selectedClipTrack && lockedTracks.includes(selectedClipTrack.id)
  const sequenceDuration = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)))
  const activeVisualClips = tracks
    .map((track, trackOrder) => ({ track, trackOrder }))
    .filter(({ track }) => track.kind === 'video' && !mutedTracks.includes(track.id))
    .reverse()
    .flatMap(({ track, trackOrder }) => track.clips.filter((clip) => clip.kind !== 'adjustment' && clip.text === undefined && clip.thumbnail !== 'text-overlay' && playhead >= clip.start && playhead < clip.start + clip.duration).map((clip) => ({ ...clip, trackId: track.id, trackOrder })))
  const previewClip = tracks.filter((track) => track.kind === 'video' && !mutedTracks.includes(track.id)).reduce<NonNullable<typeof selectedClip> | undefined>((active, track) => {
    const current = track.clips
      .filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration && clip.text === undefined && clip.thumbnail !== 'text-overlay' && clip.kind !== 'adjustment')
      .sort((left, right) => left.start - right.start)
      .at(-1)
    return current ?? active
  }, undefined)
  const activeAdjustmentLayers = tracks
    .map((track, trackOrder) => ({ track, trackOrder }))
    .filter(({ track }) => track.kind === 'video' && !mutedTracks.includes(track.id))
    .flatMap(({ track, trackOrder }) => track.clips.filter((clip) => clip.kind === 'adjustment' && playhead >= clip.start && playhead < clip.start + clip.duration).map((clip) => ({ ...clip, trackId: track.id, trackOrder })))
  const activeTextOverlays = tracks
    .filter((track) => track.kind === 'video' && !mutedTracks.includes(track.id))
    .flatMap((track) =>
      track.clips.filter(
        (clip) =>
          playhead >= clip.start &&
          playhead < clip.start + clip.duration &&
          (clip.text !== undefined || clip.thumbnail === 'text-overlay'),
      ),
    )
  const selectedMedia = assets.find((item) => item.id === selectedMediaId)
  const effectiveDuration = sequenceDuration > 0 ? sequenceDuration : (selectedMedia?.durationSeconds ?? 0)
  const hasReadyAssets = assets.some((asset) => asset.status === 'ready')
  const hasTextClips = tracks.some((track) => track.clips.some((clip) => clip.text !== undefined || clip.thumbnail === 'text-overlay'))
  const hasTimelineClips = tracks.some((track) => track.clips.length > 0)
  const canExport = (hasReadyAssets || hasTextClips) && hasTimelineClips && sequenceDuration > 0
  const [chatOpen, setChatOpen] = useState(false)
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('edit')
  const [saveStatus, setSaveStatus] = useState(getProjectSaveStatus)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [extractingSubtitles, setExtractingSubtitles] = useState(false)
  const [subtitleProgressText, setSubtitleProgressText] = useState('')
  const [importStatus, setImportStatus] = useState<{
    isImporting: boolean
    current: number
    total: number
    currentFileName: string
  } | null>(null)
  const audioEngineRef = useRef<TimelineAudioEngine | null>(null)
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const frameRate = sequence.frameRate
  const fileInput = useRef<HTMLInputElement>(null)
  const projectFileInput = useRef<HTMLInputElement>(null)
  const assistantPanelRef = usePanelRef()
  const appWorkspaceGroupRef = useGroupRef()
  const mainVerticalGroupRef = useGroupRef()
  const upperGroupRef = useGroupRef()
  const appWorkspaceLayout = useDefaultLayout({ id: 'sparta-app-workspace', panelIds: ['editor', 'assistant'], storage: layoutStorage })
  const verticalLayout = useDefaultLayout({ id: 'sparta-main-vertical', panelIds: ['stage', 'timeline'], storage: layoutStorage })
  const upperLayout = useDefaultLayout({ id: 'sparta-upper-workspace', panelIds: ['library', 'monitor', 'inspector'], storage: layoutStorage })

  useEffect(() => subscribeProjectSaveStatus(setSaveStatus), [])

  useEffect(() => {
    const hasUnprobedReadyMedia = assets.some(
      (a) => a.status === 'ready' && a.type !== 'image' && !a.durationSeconds,
    )
    if (hasUnprobedReadyMedia) {
      void repairTimelineAndAssetDurations()
    }
  }, [assets])

  useEffect(() => {
    if (!playing || effectiveDuration <= 0) return
    let lastFrameAt = performance.now()
    let animationFrame = 0
    const advance = (now: number) => {
      const elapsed = (now - lastFrameAt) / 1000
      if (elapsed < 1 / frameRate) { animationFrame = requestAnimationFrame(advance); return }
      lastFrameAt = now
      const next = useEditorStore.getState().playhead + elapsed
      if (next >= effectiveDuration) {
        setPlayhead(effectiveDuration)
        setPlaying(false)
        return
      }
      setPlayhead(next)
      animationFrame = requestAnimationFrame(advance)
    }
    animationFrame = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(animationFrame)
  }, [playing, effectiveDuration, frameRate, setPlayhead, setPlaying])

  useEffect(() => {
    if (!audioEngineRef.current) audioEngineRef.current = new TimelineAudioEngine()
    const engine = audioEngineRef.current
    void engine.sync(playhead, playing, tracks, assets, mutedTracks)
    return () => { engine.pauseAll() }
  }, [playhead, playing, tracks, assets, mutedTracks])

  useEffect(() => {
    return () => { audioEngineRef.current?.destroy() }
  }, [])

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
    // Proactive self-healing for panels if crushed or corrupted in localStorage
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
      } catch { /* ignore */ }
    }
    const timer = setTimeout(healLayoutIfCrushed, 100)
    return () => clearTimeout(timer)
  }, [chatOpen, upperGroupRef, mainVerticalGroupRef])

  useEffect(() => {
    const compactLayout = () => {
      if (window.innerWidth >= 1100) return
      if (assistantPanelRef.current && !assistantPanelRef.current.isCollapsed()) assistantPanelRef.current.collapse()
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
    } catch { /* ignore */ }
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

  const handleClearSubtitles = useCallback(() => {
    const count = clearAllSubtitles()
    if (count > 0) {
      toast.success(
        t(`Se eliminaron ${count} subtítulos de la secuencia`, `${count} subtitles removed from sequence`),
        {
          action: {
            label: t('Deshacer', 'Undo'),
            onClick: () => undo(),
          },
        }
      )
    } else {
      toast.info(t('No hay subtítulos en la línea de tiempo para borrar', 'No subtitles on the timeline to delete'))
    }
  }, [clearAllSubtitles, undo])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      if (event.target instanceof HTMLElement && (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target.isContentEditable || (event.target.closest('button,select,[role="dialog"],[role="menu"],[role="menuitem"],[role="separator"],[role="slider"],[role="switch"],[role="tab"],[role="tabpanel"]') && !event.target.closest('.timeline-clip')))) return
      if (settingsOpen || renameOpen) return
      const clipFocused = event.target instanceof HTMLElement && !!event.target.closest('.timeline-clip')
      if (clipFocused) {
        if (event.code === 'Space' || ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.altKey)) {
          return
        }
      }
      const timelineFocused = event.target instanceof HTMLElement && (!!event.target.closest('[role="region"]') || !!event.target.closest('.timeline-panel'))
      if (timelineFocused && clipFocused && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const state = useEditorStore.getState(); const clip = state.tracks.flatMap((track) => track.clips).find((item) => item.id === state.selectedClipId)
        const owner = state.tracks.find((track) => track.clips.some((item) => item.id === clip?.id))
        if (clip && owner && !state.lockedTracks.includes(owner.id)) { const direction = event.key === 'ArrowLeft' ? -1 : 1; const step = event.shiftKey ? 1 : 1 / state.sequence.frameRate; if (event.ctrlKey && event.altKey) { const start = Math.max(0, clip.start + direction * step); const duration = Math.max(1 / state.sequence.frameRate, clip.duration - (start - clip.start)); moveClip(clip.id, state.snapToFrames ? Math.round(start * state.sequence.frameRate) / state.sequence.frameRate : start, state.snapToFrames ? Math.round(duration * state.sequence.frameRate) / state.sequence.frameRate : duration) } else if (event.altKey) { const duration = Math.max(1 / state.sequence.frameRate, clip.duration + direction * step); moveClip(clip.id, clip.start, state.snapToFrames ? Math.round(duration * state.sequence.frameRate) / state.sequence.frameRate : duration) } else { const start = Math.max(0, clip.start + direction * step); moveClip(clip.id, state.snapToFrames ? Math.round(start * state.sequence.frameRate) / state.sequence.frameRate : start) } event.preventDefault(); return }
      }
      if (event.key === 'ArrowLeft') setPlayhead(useEditorStore.getState().playhead - (event.shiftKey ? 1 : 1 / useEditorStore.getState().sequence.frameRate))
      if (event.key === 'ArrowRight') setPlayhead(useEditorStore.getState().playhead + (event.shiftKey ? 1 : 1 / useEditorStore.getState().sequence.frameRate))
      if (event.key === 'Home') { event.preventDefault(); setPlayhead(0) }
      if (event.key === 'End') { event.preventDefault(); setPlayhead(effectiveDuration) }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { const id = useEditorStore.getState().selectedClipId; if (id) { event.preventDefault(); duplicateClip(id) } }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('[aria-label="Buscar medios"]')?.focus() }
      if (event.altKey && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); handleClearSubtitles(); return }
      if (event.key === 'Delete' || event.key === 'Backspace') { const id = useEditorStore.getState().selectedClipId; if (id) { event.preventDefault(); deleteClip(id) } }
      if ((event.key.toLowerCase() === 's' && !event.ctrlKey && !event.metaKey) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b')) {
        const st = useEditorStore.getState()
        if (st.selectedClipId) { event.preventDefault(); splitClip(st.selectedClipId, st.playhead) }
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
  }, [addMarker, deleteClip, duplicateClip, effectiveDuration, freezeFrame, handleClearSubtitles, moveClip, redo, renameOpen, setActiveTool, setPlayhead, settingsOpen, splitClip, toggleSnap, undo])

  const importFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    const sourceFiles = Array.from(files)
    setImportStatus({
      isImporting: true,
      current: 0,
      total: sourceFiles.length,
      currentFileName: sourceFiles[0]?.name ?? '',
    })
    const pending = sourceFiles.map((file) => {
      const mime = getMediaMimeType(file)
      const type: MediaItem['type'] = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'video'
      const asset: MediaItem = { id: `local-${crypto.randomUUID()}`, title: file.name, detail: `${type.toUpperCase()} · ${formatFileSize(file.size)}`, thumb: type === 'audio' ? 'wave' : type === 'image' ? 'image-catalog' : 'video-catalog', type, status: 'processing' }
      return { file, asset }
    })
    addAssets(pending.map(({ asset }) => asset))
    if (pending[0].asset.type !== 'audio') selectMedia(pending[0].asset.id)
    const isSingle = sourceFiles.length === 1
    const importToast = toast.loading(
      isSingle
        ? t('Importando y procesando vídeo…', 'Importing and processing video…')
        : t(`Importando ${sourceFiles.length} archivos…`, `Importing ${sourceFiles.length} files…`),
      {
        description: isSingle
          ? t(`Indexando "${sourceFiles[0].name}" y generando miniatura…`, `Indexing "${sourceFiles[0].name}" and generating thumbnail…`)
          : t('Indexando metadatos y generando miniaturas…', 'Indexing metadata and generating thumbnails…'),
      },
    )
    const { inspectMediaFile } = await import('./features/editor/services/media-catalog')
    let processedCount = 0
    const results = await Promise.allSettled(pending.map(async ({ file, asset }, idx) => {
      setImportStatus((prev) => (prev ? { ...prev, currentFileName: file.name } : null))
      if (!isSingle) {
        toast.loading(
          t(`Procesando archivo ${idx + 1} de ${sourceFiles.length}…`, `Processing file ${idx + 1} of ${sourceFiles.length}…`),
          { id: importToast, description: file.name },
        )
      }
      const metadata = await inspectMediaFile(file)
      await storeMediaFile(asset.id, file)
      const probed = asset.type !== 'image' ? await probeMediaMetadata(file, asset.type) : await probeMediaMetadata(file, 'image')
      if (asset.type === 'video') {
        const preview = await captureVideoThumbnail(file)
        if (preview) await storeMediaPreview(asset.id, preview)
      }
      const durationSuffix = probed.duration ? ` · ${formatMediaDuration(probed.duration)}` : ''
      const resSuffix = probed.width && probed.height ? ` · ${probed.width}×${probed.height}` : ''
      updateAsset(asset.id, {
        title: metadata.name,
        detail: `${asset.type.toUpperCase()} · ${formatFileSize(metadata.sizeBytes)}${resSuffix}${durationSuffix}`,
        ...(probed.duration ? { durationSeconds: probed.duration } : {}),
        ...(probed.width ? { width: probed.width } : {}),
        ...(probed.height ? { height: probed.height } : {}),
        status: 'ready',
      })
      processedCount++
      setImportStatus((prev) => (prev ? { ...prev, current: processedCount } : null))
      return asset.id
    }))
    setImportStatus(null)
    const failedNames = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return []
      const message = result.reason instanceof Error ? result.reason.message : t('No se pudo procesar el archivo.', 'Could not process the file.')
      updateAsset(pending[index].asset.id, { status: 'error', detail: message })
      return [sourceFiles[index].name]
    })
    const succeeded = results.length - failedNames.length
    if (succeeded && failedNames.length) {
      toast.warning(t(`${succeeded} importados, ${failedNames.length} con incidencias`, `${succeeded} imported, ${failedNames.length} with issues`), { id: importToast, description: failedNames.join(', '), duration: 7000 })
    } else if (succeeded) {
      const firstName = sourceFiles[0]?.name ?? ''
      toast.success(
        isSingle
          ? t('Vídeo listo en la biblioteca', 'Video ready in library')
          : t(`${succeeded} archivos listos en la biblioteca`, `${succeeded} files ready in library`),
        {
          id: importToast,
          description: isSingle ? firstName : t('Listos para arrastrar a la línea de tiempo.', 'Ready to drag to the timeline.'),
          duration: 6000,
        },
      )
    } else {
      toast.error(t(`${failedNames.length} archivo(s) no se pudieron procesar`, `${failedNames.length} file(s) could not be processed`), { id: importToast, description: t('Revisa el estado en la biblioteca.', 'Check their status in the library.'), duration: 8000 })
    }
  }

  const importFilesRef = useRef(importFiles)
  useEffect(() => {
    importFilesRef.current = importFiles
  })

  // Global drag-and-drop listener for external file imports anywhere in the window
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    const handleDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault()
        void importFilesRef.current(e.dataTransfer.files)
      }
    }
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  const deleteMedia = (assetId: string) => {
    const asset = useEditorStore.getState().assets.find((item) => item.id === assetId)
    removeAsset(assetId)
    if (!asset) return
    const historyDepth = useEditorStore.getState().past.length
    toast.info(t('Medio eliminado', 'Media removed'), {
      description: asset.title,
      duration: 6000,
      // Only undo when nothing else has been committed since, so we never revert an unrelated edit.
      action: { label: t('Deshacer', 'Undo'), onClick: () => { if (useEditorStore.getState().past.length === historyDepth) undo() } },
    })
  }
  const togglePlayback = () => {
    if (!playing && effectiveDuration > 0 && playhead >= effectiveDuration) setPlayhead(0)
    setPlaying(!playing)
  }
  const relinkMedia = async (assetId: string, file: File) => {
    updateAsset(assetId, { status: 'processing' })
    try {
      const { inspectMediaFile } = await import('./features/editor/services/media-catalog')
      const metadata = await inspectMediaFile(file)
      const type: MediaItem['type'] = metadata.mimeType.startsWith('image/') ? 'image' : metadata.mimeType.startsWith('audio/') ? 'audio' : 'video'
      await storeMediaFile(assetId, file)
      const probed = type !== 'image' ? await probeMediaMetadata(file, type) : await probeMediaMetadata(file, 'image')
      if (type === 'video') {
        const preview = await captureVideoThumbnail(file)
        if (preview) await storeMediaPreview(assetId, preview)
      }
      const durationSuffix = probed.duration ? ` · ${formatMediaDuration(probed.duration)}` : ''
      const resSuffix = probed.width && probed.height ? ` · ${probed.width}×${probed.height}` : ''
      updateAsset(assetId, {
        title: metadata.name,
        type,
        detail: `${type.toUpperCase()} · ${formatFileSize(metadata.sizeBytes)}${resSuffix}${durationSuffix}`,
        ...(probed.duration ? { durationSeconds: probed.duration } : {}),
        ...(probed.width ? { width: probed.width } : {}),
        ...(probed.height ? { height: probed.height } : {}),
        thumb: type === 'image' ? 'image-catalog' : type === 'audio' ? 'wave' : 'video-catalog',
        status: 'ready',
      })
      toast.success(t('Medio vinculado', 'Media linked'), { description: metadata.name })
    } catch (error) {
      const message = errorMessage(error, t('No se pudo vincular el archivo.', 'Could not link the file.'))
      updateAsset(assetId, { status: 'error', detail: message })
      toast.error(t('No se pudo vincular el medio', 'Could not link media'), { description: message })
    }
  }
  const addMediaToTimeline = (asset: MediaItem, at?: number, trackId?: string) => {
    const existingVideoClips = tracks.filter((t) => t.kind === 'video').flatMap((t) => t.clips)
    if (existingVideoClips.length === 0 && asset.type === 'video') {
      const isVertical = asset.height && asset.width ? asset.height > asset.width : false
      if (isVertical && sequence.width > sequence.height) {
        setSequence({ ...sequence, width: 1080, height: 1920 })
        toast.info(t('Secuencia adaptada a formato vertical 9:16 (1080×1920)', 'Sequence adapted to vertical 9:16 (1080×1920)'), {
          description: t('Adaptado automáticamente al formato del vídeo.', 'Adapted automatically to video format.'),
        })
      } else if (!isVertical && asset.width && asset.height && sequence.height > sequence.width) {
        setSequence({ ...sequence, width: 1920, height: 1080 })
        toast.info(t('Secuencia adaptada a formato horizontal 16:9 (1920×1080)', 'Sequence adapted to horizontal 16:9 (1920×1080)'))
      }
    }
    const id = addMedia(asset, at, trackId)
    if (!id) {
      toast.warning(asset.type === 'audio'
        ? t('Elige una pista de audio desbloqueada para insertar este medio.', 'Choose an unlocked audio track to insert this media.')
        : t('Elige una pista de vídeo desbloqueada para insertar este medio.', 'Choose an unlocked video track to insert this media.'))
    }
    return id
  }
  const copyClipName = async (name: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(name)
      toast.success(t('Nombre del clip copiado.', 'Clip name copied.'))
    } catch {
      toast.error(t('No se pudo acceder al portapapeles en este navegador.', 'Clipboard access is unavailable in this browser.'))
    }
  }
  const handleGenerateVideoSubtitles = async (
    presetId = 'hormozi-karaoke',
    customScript?: string,
    language: SubtitleLanguage = 'spanish',
  ) => {
    if (extractingSubtitles) return
    setExtractingSubtitles(true)
    setSubtitleProgressText(t('Extrayendo audio del video…', 'Extracting video audio…'))
    const subToast = toast.loading(
      t('Extrayendo subtítulos hablados del video…', 'Extracting spoken subtitles from video…'),
    )
    try {
      const result = await generateSubtitlesFromTimelineVideo({
        presetId,
        customScript,
        language,
        onProgress: (status) => {
          setSubtitleProgressText(status)
        },
      })
      if (result.count > 0) {
        const modeDesc =
          result.mode === 'whisper-local'
            ? t('Transcripción de voz Whisper IA (Audio real del video)', 'Whisper AI voice transcription (Real video audio)')
            : result.mode === 'whisper'
              ? t('Transcripción de voz IA en la nube', 'Cloud AI voice transcription')
              : result.mode === 'ai-llm'
                ? t('Sincronizado con IA y segmentos vocales', 'Synced with AI and voice segments')
                : result.mode === 'waveform-vad'
                  ? t('Sincronizado con detección de voz del video', 'Synced with video voice detection')
                  : t('Sincronizado con la duración de la secuencia', 'Synced with sequence duration')
        toast.success(
          t(
            `${result.count} subtítulos extraídos (${formatMediaDuration(result.durationSeconds)})`,
            `${result.count} subtitles extracted (${formatMediaDuration(result.durationSeconds)})`,
          ),
          { id: subToast, description: modeDesc },
        )

        // Seleccionar automáticamente el primer subtítulo para que el usuario pueda calibrarlo y modificarlo de inmediato en el Inspector
        const currentTracks = useEditorStore.getState().tracks
        const subTrack = currentTracks.find((t) => t.name.toLowerCase().includes('sub'))
        const firstClip = subTrack?.clips.find((c) => c.text !== undefined || c.thumbnail === 'text-overlay')
        if (firstClip) {
          selectClip(firstClip.id)
          setPlayhead(firstClip.start)
        }
      } else {
        toast.warning(t('No se detectó voz en el video', 'No voice detected in video'), { id: subToast })
      }
    } catch {
      const fallbackCount = autoGenerateSubtitles(presetId, customScript)
      if (fallbackCount > 0) {
        toast.success(t(`${fallbackCount} subtítulos generados en pista`, `${fallbackCount} subtitles generated on track`), {
          id: subToast,
        })
      } else {
        toast.error(t('Error al analizar el audio del video', 'Error analyzing video audio'), { id: subToast })
      }
    } finally {
      setExtractingSubtitles(false)
      setSubtitleProgressText('')
    }
  }

  const handleApplyOrExtractSubtitlePreset = (presetId: string, language: SubtitleLanguage = 'spanish') => {
    const currentTracks = useEditorStore.getState().tracks
    const existingSubClips = currentTracks.flatMap((t) =>
      t.clips.filter((c) => c.text !== undefined || c.thumbnail === 'text-overlay'),
    )
    if (existingSubClips.length > 1) {
      const count = applyPresetToAllSubtitles(presetId)
      if (count > 0) {
        toast.success(
          t(
            `Estilo aplicado a ${count} subtítulos de la secuencia`,
            `Style applied to ${count} sequence subtitles`,
          ),
        )
      }
      return
    }
    void handleGenerateVideoSubtitles(presetId, undefined, language)
  }

  return <main className="app-shell">
    <header className="titlebar">
      <div className="titlebar-left flex items-center gap-6">
        <div className="sparta-logo-wrap flex items-center gap-2 select-none">
          <Zap size={16} fill="var(--primary)" stroke="var(--primary)" className="zap-icon shrink-0" />
          <span className="font-semibold text-[14px] text-foreground tracking-wide whitespace-nowrap">SPARTA VIDEO</span>
        </div>
        <nav className="sparta-menu-nav flex items-center gap-2">
          <ActionMenu label={t('Archivo', 'File')} triggerClass="sparta-menu-btn text-[13px] text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-[4px] hover:bg-secondary/60 transition-colors cursor-pointer" items={[
            { label: t('Nuevo proyecto', 'New project'), icon: PlusCircle, onSelect: () => { useEditorStore.getState().resetProject(); toast.info(t('Nuevo proyecto creado', 'New project created')) } },
            { label: t('Abrir proyecto (.sparta)…', 'Open project (.sparta)…'), icon: FileUp, onSelect: () => projectFileInput.current?.click() },
            { label: t('Guardar proyecto como (.sparta)…', 'Save project as (.sparta)…'), icon: FileDown, onSelect: () => { void import('./features/editor/services/project-file').then(({ exportProjectData, downloadProjectFile }) => { const fileData = exportProjectData(); downloadProjectFile(fileData); toast.success(t('Archivo de proyecto guardado', 'Project file saved'), { description: fileData.project.name + '.sparta' }) }) } },
            { separator: true },
            { label: t('Importar medios…', 'Import media…'), icon: FileUp, onSelect: () => fileInput.current?.click() },
            { label: t('Exportar vídeo…', 'Export video…'), icon: Video, onSelect: () => setExportOpen(true) },
          ]}>
            <span>{t('Archivo', 'File')}</span>
          </ActionMenu>
          <ActionMenu label={t('Editar', 'Edit')} triggerClass="sparta-menu-btn text-[13px] text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-[4px] hover:bg-secondary/60 transition-colors cursor-pointer" items={[
            { label: t('Deshacer', 'Undo'), icon: Undo2, disabled: !past.length, onSelect: undo },
            { label: t('Rehacer', 'Redo'), icon: Redo2, disabled: !future.length, onSelect: redo },
            { separator: true },
            { label: t('Dividir clip en cabezal (S)', 'Split clip at playhead (S)'), icon: Scissors, disabled: !selectedClipId, onSelect: () => { if (selectedClipId) splitClip(selectedClipId, playhead) } },
            { label: t('Duplicar clip (Ctrl+D)', 'Duplicate clip (Ctrl+D)'), icon: CopyPlus, disabled: !selectedClipId, onSelect: () => { if (selectedClipId) duplicateClip(selectedClipId) } },
            { label: t('Eliminar clip (Supr)', 'Delete clip (Del)'), icon: Trash2, disabled: !selectedClipId, onSelect: () => { if (selectedClipId) deleteClip(selectedClipId) } },
          ]}>
            <span>{t('Editar', 'Edit')}</span>
          </ActionMenu>
          <ActionMenu label={t('Ver', 'View')} triggerClass="sparta-menu-btn text-[13px] text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-[4px] hover:bg-secondary/60 transition-colors cursor-pointer" items={[
            { label: t('Ajustes de secuencia…', 'Sequence settings…'), icon: Film, onSelect: () => setSettingsOpen(true) },
            { label: t('Expandir línea de tiempo', 'Expand timeline'), icon: Maximize2, onSelect: toggleTimelineExpanded },
          ]}>
            <span>{t('Ver', 'View')}</span>
          </ActionMenu>
        </nav>
      </div>

      <div className="titlebar-center text-xs text-muted-foreground tabular-nums flex items-center gap-1.5">
        <ActionMenu
          label="Project actions"
          triggerClass="project-menu-trigger font-medium text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer bg-transparent border-none"
          items={[
            { heading: 'PROJECT' },
            { label: t('Cambiar nombre del proyecto', 'Rename project'), icon: Pencil, onSelect: () => setRenameOpen(true) },
            { label: t('Duplicar proyecto (.sparta)…', 'Duplicate project (.sparta)…'), icon: CopyPlus, onSelect: () => { void import('./features/editor/services/project-file').then(({ exportProjectData, downloadProjectFile }) => { const fileData = exportProjectData(); fileData.project.name = fileData.project.name + ' - copia'; downloadProjectFile(fileData); toast.success(t('Copia del proyecto guardada', 'Project copy saved'), { description: t('Los medios vinculados conservan sus ubicaciones actuales.', 'Linked media keeps its current locations.') }) }) } },
            { separator: true },
            { label: t('Preferencias del proyecto', 'Project preferences'), icon: FolderOpen, onSelect: () => setSettingsOpen(true) },
          ]}
        >
          <span>{(!projectName || projectName === 'Sin título') ? t('Proyecto sin título', 'Untitled project') : projectName}</span>
          <ChevronDown size={11} className="text-muted-foreground" />
        </ActionMenu>
        <span>·</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
        <span>{t('Guardado', 'Saved')}</span>
      </div>

      <div className="titlebar-right flex items-center gap-1.5">
        <button
          type="button"
          className="titlebar-icon-btn w-7 h-7 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center justify-center transition-colors cursor-pointer"
          aria-label={t('Deshacer', 'Undo')}
          title={t('Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)')}
          onClick={undo}
          disabled={!past.length}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="titlebar-icon-btn w-7 h-7 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center justify-center transition-colors cursor-pointer"
          aria-label={t('Rehacer', 'Redo')}
          title={t('Rehacer (Ctrl+Shift+Z)', 'Redo (Ctrl+Shift+Z)')}
          onClick={redo}
          disabled={!future.length}
        >
          <Redo2 size={15} />
        </button>
        <button
          type="button"
          className="titlebar-icon-btn w-7 h-7 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center justify-center transition-colors cursor-pointer"
          aria-label={t('Paneles / Asistente', 'Panels / Assistant')}
          title={t('Paneles / Asistente', 'Panels / Assistant')}
          onClick={toggleAssistant}
        >
          <Columns2 size={15} />
        </button>
        <button
          type="button"
          className="titlebar-icon-btn w-7 h-7 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Open preferences"
          title={t('Preferencias', 'Preferences')}
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 size={15} />
        </button>
        <button
          type="button"
          className="btn-export-primary h-8 px-3 rounded-[6px] bg-primary text-primary-foreground font-semibold text-xs hover:brightness-110 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:pointer-events-none"
          disabled={!canExport}
          aria-label={canExport ? t('Exportar vídeo', 'Export video') : t('Exportación no disponible', 'Export unavailable')}
          title={canExport ? t('Exportar vídeo', 'Export video') : t('El motor de exportación aún no está conectado', 'The export engine is not connected yet')}
          onClick={() => { if (canExport) setExportOpen(true) }}
        >
          <Upload size={13} strokeWidth={2.4} /> {t('Exportar', 'Export')}
        </button>
      </div>
    </header>
    <input ref={fileInput} className="visually-hidden hidden" style={{ display: 'none' }} type="file" multiple accept="video/*,audio/*,image/*" tabIndex={-1} aria-hidden="true" onChange={(event) => { void importFiles(event.target.files); event.target.value = '' }} />
    <input ref={projectFileInput} className="visually-hidden hidden" style={{ display: 'none' }} type="file" accept=".sparta,.json" tabIndex={-1} aria-hidden="true" onChange={(event) => { const file = event.target.files?.[0]; if (file) void import('./features/editor/services/project-file').then(({ openProjectFromFile }) => openProjectFromFile(file)); event.target.value = '' }} />
    <Group id="sparta-app-workspace" groupRef={appWorkspaceGroupRef} className="workspace" orientation="horizontal" defaultLayout={appWorkspaceLayout.defaultLayout ?? { editor: 100, assistant: 0 }} onLayoutChanged={(layout, meta) => { appWorkspaceLayout.onLayoutChanged(layout, meta); setChatOpen((layout.assistant ?? 0) > 0) }} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}>
      <Panel id="editor" defaultSize="100%" minSize="60%" className="editor-workspace-panel">
    <Group id="sparta-workspace" groupRef={mainVerticalGroupRef} className="editor-vertical-group" orientation="vertical" defaultLayout={verticalLayout.defaultLayout ?? { stage: 61, timeline: 39 }} onLayoutChanged={verticalLayout.onLayoutChanged} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}>
      <Panel id="stage" defaultSize="61%" minSize="32%" maxSize="80%" className="bg-transparent overflow-hidden h-full">
        <div className="upper-workspace">
          <Group id="sparta-upper-workspace" groupRef={upperGroupRef} className="preview-inspector-group" orientation="horizontal" defaultLayout={upperLayout.defaultLayout ?? { library: 23, monitor: 52, inspector: 25 }} onLayoutChanged={upperLayout.onLayoutChanged} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}>
            <Panel id="library" defaultSize="23%" minSize="240px" maxSize="38%" className="resize-panel-content">
              <MediaLibraryPanel assets={assets} selectedMedia={selectedMediaId} isExtractingSubtitles={extractingSubtitles} subtitleProgressText={subtitleProgressText} importStatus={importStatus} onSelect={(asset) => selectMedia(asset.id)} onAdd={(asset) => addMediaToTimeline(asset)} onAddTextClip={(presetId, text) => { addTextClip({ presetId, text, at: playhead }); toast.success(t('Titular insertado en el cabezal', 'Title inserted at playhead')) }} onAutoSubtitles={(presetId, script, language) => { void handleGenerateVideoSubtitles(presetId, script, language) }} onApplySubtitlePreset={(presetId, language) => { handleApplyOrExtractSubtitlePreset(presetId, language) }} onClearSubtitles={handleClearSubtitles} onRename={(assetId, name) => updateAsset(assetId, { title: name })} onDelete={(assetId) => void deleteMedia(assetId)} onRelink={(assetId, file) => void relinkMedia(assetId, file)} onImport={() => fileInput.current?.click()} onImportFiles={(files) => void importFiles(files)} />
            </Panel>
            <Separator
              id="library-separator"
              className="panel-separator"
              aria-label={t('Redimensionar biblioteca de medios', 'Resize media library')}
              title={t('Doble clic para restablecer ancho', 'Double-click to reset width')}
              onDoubleClick={() => {
                upperGroupRef.current?.setLayout({
                  library: 24,
                  monitor: 50,
                  inspector: 26,
                })
                toast.info(t('Ancho de biblioteca restaurado al 24%', 'Library width restored to 24%'))
              }}
            />
            <Panel id="monitor" defaultSize="52%" minSize="35%" className="resize-panel-content">
              {(() => {
                const isPreviewClipMuted = previewClip
                  ? mutedTracks.some((id) => tracks.find((t) => t.id === id)?.clips.some((c) => c.id === previewClip.id))
                  : false
                const previewClipVolume = previewClip?.volume !== undefined ? Math.max(0, Math.min(1.5, previewClip.volume / 100)) : 1
                return (
                  <PreviewMonitor
                    playhead={playhead}
                    markers={markers}
                    onSeek={setPlayhead}
                    frameRate={frameRate}
                    duration={effectiveDuration}
                    clip={previewClip}
                    visualClips={activeVisualClips}
                    adjustmentLayers={activeAdjustmentLayers}
                    textOverlays={activeTextOverlays}
                    selectedClipId={selectedClipId}
                    onSelectClip={selectClip}
                    onUpdateClip={updateClip}
                    media={!previewClip ? selectedMedia : undefined}
                    assets={assets}
                    sequenceSize={sequence}
                    onSetSequence={setSequence}
                    onDuplicateClip={duplicateClip}
                    onDeleteClip={deleteClip}
                    playing={playing}
                    onTogglePlay={togglePlayback}
                    isMuted={isPreviewClipMuted}
                    volume={previewClipVolume}
                  />
                )
              })()}
            </Panel>
            <Separator id="monitor-splitter" className="panel-separator" aria-label={t('Redimensionar monitor e inspector', 'Resize preview and inspector')} />
            <Panel id="inspector" defaultSize="25%" minSize="220px" maxSize="40%" className="resize-panel-content">
              <InspectorPanel clip={selectedClip ?? previewClip} selectedMedia={selectedMedia} assets={assets} playhead={playhead} sequenceSize={sequence} onSeek={setPlayhead} readOnly={selectedClipReadOnly} onAddSelected={() => { if (selectedMedia) addMediaToTimeline(selectedMedia, playhead) }} onAddTextClip={(presetId) => { addTextClip({ presetId, at: playhead }); toast.success(t('Capa de texto Pro añadida', 'Pro text layer added')) }} onUpdateClip={updateClip} onCopyClipName={(name) => void copyClipName(name)} onSplitAtPlayhead={() => { if (selectedClip && !selectedClipReadOnly) splitClip(selectedClip.id, playhead) }} onDuplicateClip={() => { if (selectedClip && !selectedClipReadOnly) { duplicateClip(selectedClip.id); toast.success(t('Clip duplicado', 'Clip duplicated')) } }} onFreezeFrame={(id, time) => { const fId = freezeFrame(id, time); if (fId) toast.success(t('Fotograma congelado insertado', 'Frozen frame inserted')) }} onCalibrateAllSubtitles={(id) => { const n = calibrateAllSubtitles(id); if (n > 0) toast.success(t(`Calibración aplicada a ${n} subtítulos`, `Calibration applied to ${n} subtitles`)) }} onNudgeAllSubtitlesTime={(delta) => { const n = nudgeAllSubtitlesTime(delta); if (n > 0) toast.success(t(`Sincronización ${delta > 0 ? '+' : ''}${delta}s en ${n} subtítulos`, `Sync ${delta > 0 ? '+' : ''}${delta}s on ${n} subtitles`)) }} onResetClip={() => { if (selectedClip && !selectedClipReadOnly) updateClip(selectedClip.id, { transform: { x: sequence.width / 2, y: sequence.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }, opacity: 100, blendMode: 'normal', volume: 100, fadeIn: 0, fadeOut: 0, uniformScale: true, keyframes: [] }) }} />
            </Panel>
          </Group>
        </div>
      </Panel>
      <Separator id="stage-timeline-splitter" className="panel-separator panel-separator-horizontal" aria-label={t('Redimensionar monitor y línea de tiempo', 'Resize monitor and timeline')} />
      <Panel id="timeline" defaultSize="42%" minSize="20%" className="resize-panel-content">
        <TimelinePanel tracks={tracks} assets={assets} markers={markers} selected={selectedClipId} playhead={playhead} zoom={zoom} frameRate={frameRate} snap={snapToFrames} expanded={timelineExpanded} tool={activeTool} mutedTracks={mutedTracks} lockedTracks={lockedTracks} onMuteTrack={toggleMute} onLockTrack={toggleLock} onSelect={selectClip} onSeek={setPlayhead} onZoom={setZoom} onAddTrack={addTrack} onAddMedia={addMediaToTimeline} onMoveClip={moveClip} onMoveClipToNewTrack={moveClipToNewTrack} onSplitClip={splitClip} onDeleteClip={deleteClip} onDuplicateClip={(id) => { duplicateClip(id); toast.success(t('Clip duplicado', 'Clip duplicated')) }} onFreezeFrame={(id, time) => { const fId = freezeFrame(id, time); if (fId) toast.success(t('Fotograma congelado insertado', 'Frozen frame inserted')) }} onAddTextClip={() => { addTextClip({ presetId: 'hormozi-karaoke', at: playhead }); toast.success(t('Texto animado Pro añadido en el cabezal', 'Pro animated text added at playhead')) }} onAddAdjustmentLayer={() => { addAdjustmentLayer(playhead); toast.success(t('Capa FX añadida en el cabezal', 'FX Layer added at playhead')) }} onAutoSubtitles={() => { void handleGenerateVideoSubtitles('hormozi-karaoke') }} onClearSubtitles={handleClearSubtitles} onPackClips={() => { const n = ripplePackTrack(); if (n > 0) toast.success(t(`${n} clip(s) compactados sin huecos`, `${n} clip(s) packed without gaps`)); else toast.info(t('No hay huecos que compactar', 'No gaps to pack')) }} onAutoMarkers={() => { const n = autoSceneMarkers(); if (n > 0) toast.success(t(`${n} marcador(es) añadidos en cortes`, `${n} marker(s) added at cuts`)); else toast.info(t('Ya existen marcadores en los cortes', 'There are already markers at the cuts')) }} onAutoAudio={() => { const n = autoAudioBalance(); if (n > 0) toast.success(t(`Mezcla y fundidos aplicados a ${n} clip(s)`, `Mix and fades applied to ${n} clip(s)`)); else toast.info(t('Añade clips para nivelar audio', 'Add clips to balance audio')) }} onAddMarker={addMarker} onRemoveMarker={removeMarker} onToggleSnap={toggleSnap} onToggleExpanded={toggleTimelineExpanded} onSetTool={setActiveTool} onImportFiles={(files) => void importFiles(files)} onApplyTransition={(clipId, transition: TransitionRef) => { const clip = useEditorStore.getState().tracks.flatMap((track) => track.clips).find((item) => item.id === clipId); if (!clip) return; updateClip(clipId, { transitionIn: transition }); selectClip(clipId); setPlaying(false); setPlayhead(clip.start + Math.min(transition.duration * 0.25, clip.duration / 2)); toast.success(t('Transición asignada y previsualizada en el corte', 'Transition applied and previewed at the cut')) }} />
      </Panel>
    </Group>
      </Panel>
      <Separator id="assistant-separator" className="panel-separator" aria-label={t('Redimensionar panel del asistente', 'Resize assistant panel')} />
      <Panel id="assistant" panelRef={assistantPanelRef} defaultSize="24%" minSize="260px" maxSize="40%" collapsedSize="0%" collapsible className="resize-panel-content assistant-workspace-panel">
        {chatOpen && <Suspense fallback={<aside className="assistant-panel assistant-loading" role="status" aria-label={t('Abriendo el asistente', 'Opening assistant')}><div className="assistant-loading-heading"><span className="assistant-loading-mark"><Zap size={15} /></span><span><strong>Sparta AI</strong><small>{t('Preparando el espacio de trabajo…', 'Preparing your workspace…')}</small></span></div><div className="assistant-loading-body"><i /><i /><i /></div><div className="assistant-loading-compose"><span /><b /></div></aside>}><AssistantPanel open onClose={toggleAssistant} projectName={projectName} activeMode={assistantMode} onModeChange={setAssistantMode} /></Suspense>}
      </Panel>
    </Group>
    {settingsOpen && <Suspense fallback={null}><PreferencesSheet open={settingsOpen} onOpenChange={setSettingsOpen} onResetLayout={resetWorkspace} snapToFrames={snapToFrames} onToggleSnap={toggleSnap} saveStatus={saveStatus} /></Suspense>}
    <RenameProjectDialog open={renameOpen} name={projectName} onOpenChange={setRenameOpen} onSave={(name) => { setProjectName(name); toast.success(t('Proyecto renombrado', 'Project renamed'), { description: name }) }} />
    {exportOpen && <Suspense fallback={null}><ExportDialog open={exportOpen} projectName={projectName} sequenceDuration={sequenceDuration} sequenceSize={sequence} tracks={tracks} assets={assets} mutedTracks={mutedTracks} onOpenChange={setExportOpen} /></Suspense>}
    <Toaster />
  </main>
}

function formatFileSize(bytes: number) { return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB` }
export default App




