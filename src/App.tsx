import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, FileDown, FileUp, Film, FolderOpen, Pencil, PlusCircle, Settings2, Undo2, Video } from 'lucide-react'
import { AssistantPanel, type AssistantMode } from './features/editor/components/AssistantPanel'
import {
  IconNleBrandMark,
  IconNlePanelRight,
} from './features/editor/components/StudioIcons'
import { IconButton } from './features/editor/components/controls'
import { InspectorPanel } from './features/editor/components/InspectorPanel'
import { MediaLibraryPanel } from './features/editor/components/MediaLibraryPanel'
import { PreviewMonitor } from './features/editor/components/PreviewMonitor'
import { TimelinePanel } from './features/editor/components/TimelinePanel'
import { ActionMenu } from './features/editor/components/ActionMenu'
import { PreferencesSheet } from './features/editor/components/PreferencesSheet'
import { RenameProjectDialog } from './features/editor/components/RenameProjectDialog'
import { ExportDialog } from './features/editor/components/ExportDialog'
import { TimelineAudioEngine } from './features/editor/services/audio-playback'
import { getProjectSaveStatus, subscribeProjectSaveStatus, useEditorStore } from './features/editor/editor-store'
import type { MediaItem } from './features/editor/model'
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
import { downloadProjectFile, exportProjectData, openProjectFromFile } from './features/editor/services/project-file'
import { Group, Panel, Separator, useDefaultLayout, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { t, useLanguage } from './features/editor/services/locale'
import { Toaster, errorMessage, toast } from './components/ui/toast'
import './App.css'
import './styles/editor-polish.css'
import './styles/toast.css'

// Layout is a convenience preference. Keep the editor usable if browser storage is blocked.
const layoutMemory = new Map<string, string>()
const layoutStorage: Storage = {
  get length() { try { return window.localStorage.length } catch { return layoutMemory.size } },
  clear() { layoutMemory.clear(); try { window.localStorage.clear() } catch { /* memory fallback is enough */ } },
  getItem(key) { try { const value = window.localStorage.getItem(key); if (value !== null) layoutMemory.set(key, value); return value ?? layoutMemory.get(key) ?? null } catch { return layoutMemory.get(key) ?? null } },
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
  const selectedClip = tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId)
  const selectedClipTrack = tracks.find((track) => track.clips.some((clip) => clip.id === selectedClipId))
  const selectedClipReadOnly = !!selectedClipTrack && lockedTracks.includes(selectedClipTrack.id)
  const sequenceDuration = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)))
  const previewClip = tracks.filter((track) => track.kind === 'video' && !mutedTracks.includes(track.id)).reduce<NonNullable<typeof selectedClip> | undefined>((active, track) => {
    const current = track.clips
      .filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration && clip.text === undefined && clip.thumbnail !== 'text-overlay')
      .sort((left, right) => left.start - right.start)
      .at(-1)
    return current ?? active
  }, undefined)
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
  const [chatOpen, setChatOpen] = useState(true)
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
  const resolution = `${sequence.width} × ${sequence.height}`
  const frameRate = sequence.frameRate
  const fileInput = useRef<HTMLInputElement>(null)
  const projectFileInput = useRef<HTMLInputElement>(null)
  const assistantPanelRef = usePanelRef()
  const shellGroupRef = useGroupRef()
  const upperGroupRef = useGroupRef()
  const editorVerticalGroupRef = useGroupRef()
  const shellLayout = useDefaultLayout({ id: 'sparta-workspace', panelIds: ['library', 'editor', 'assistant'], storage: layoutStorage })
  const upperLayout = useDefaultLayout({ id: 'sparta-preview-inspector', panelIds: ['monitor', 'inspector'], storage: layoutStorage })
  const editorVerticalLayout = useDefaultLayout({ id: 'sparta-editor-vertical', panelIds: ['stage', 'timeline'], storage: layoutStorage })

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
    const panel = assistantPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) {
      panel.expand()
      shellGroupRef.current?.setLayout(window.innerWidth < 1100 ? { library: 18, editor: 58, assistant: 24 } : { library: 17, editor: 63, assistant: 20 })
      setChatOpen(true)
    } else {
      panel.collapse()
      setChatOpen(false)
    }
  }
  useEffect(() => {
    const compactLayout = () => {
      if (window.innerWidth >= 1100) return
      if (assistantPanelRef.current && !assistantPanelRef.current.isCollapsed()) assistantPanelRef.current.collapse()
      shellGroupRef.current?.setLayout({ library: 20, editor: 80, assistant: 0 })
      upperGroupRef.current?.setLayout({ monitor: 72, inspector: 28 })
      setChatOpen(false)
    }
    compactLayout()
    window.addEventListener('resize', compactLayout)
    return () => window.removeEventListener('resize', compactLayout)
  }, [assistantPanelRef, shellGroupRef, upperGroupRef, editorVerticalGroupRef])
  const resetWorkspace = () => {
    shellGroupRef.current?.setLayout(window.innerWidth < 1100 ? { library: 20, editor: 80, assistant: 0 } : { library: 17, editor: 63, assistant: 20 })
    upperGroupRef.current?.setLayout(window.innerWidth < 1100 ? { monitor: 72, inspector: 28 } : { monitor: 75, inspector: 25 })
    editorVerticalGroupRef.current?.setLayout({ stage: 52, timeline: 48 })
    toast.success(t('Distribución de paneles restablecida', 'Panel layout reset'))
  }
  const toggleTimelineExpanded = () => {
    const next = !timelineExpanded
    setTimelineExpanded(next)
    editorVerticalGroupRef.current?.setLayout(next ? { stage: 16, timeline: 84 } : { stage: 52, timeline: 48 })
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
      if (event.key.toLowerCase() === 's' && !event.ctrlKey && !event.metaKey) { const st = useEditorStore.getState(); if (st.selectedClipId) { splitClip(st.selectedClipId, st.playhead) } }
      if (event.key.toLowerCase() === 'c') setActiveTool('razor')
      if (event.key.toLowerCase() === 'v') setActiveTool('select')
      if (event.key.toLowerCase() === 'm') addMarker(useEditorStore.getState().playhead)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addMarker, deleteClip, duplicateClip, effectiveDuration, handleClearSubtitles, moveClip, redo, renameOpen, setActiveTool, setPlayhead, settingsOpen, splitClip, undo])

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
      <div className="brand">
        <div className="brand-mark"><IconNleBrandMark size={15} /></div><span>SPARTA</span><span className="brand-video">VIDEO</span><span className="brand-divider" />
        <ActionMenu label={t('Acciones del proyecto', 'Project actions')} triggerClass="project-menu-trigger" items={[
          { heading: t('PROYECTO', 'PROJECT') },
          { label: t('Nuevo proyecto', 'New project'), icon: PlusCircle, onSelect: () => { useEditorStore.getState().resetProject(); toast.info(t('Nuevo proyecto creado', 'New project created')) } },
          { label: t('Abrir proyecto (.sparta)…', 'Open project (.sparta)…'), icon: FileUp, onSelect: () => projectFileInput.current?.click() },
          { label: t('Guardar proyecto como (.sparta)…', 'Save project as (.sparta)…'), icon: FileDown, onSelect: () => { const fileData = exportProjectData(); downloadProjectFile(fileData); toast.success(t('Archivo de proyecto guardado', 'Project file saved'), { description: `${fileData.project.name}.sparta` }) } },
          { separator: true },
          { label: t('Cambiar nombre', 'Rename project'), icon: Pencil, onSelect: () => setRenameOpen(true) },
          { separator: true },
          { label: t('Preferencias del proyecto', 'Project preferences'), icon: FolderOpen, onSelect: () => setSettingsOpen(true) },
        ]}><span>{projectName}</span><ChevronDown size={13} /></ActionMenu>
      </div>
      <div className="title-meta">
        <button className="icon-button" aria-label={t('Abrir preferencias', 'Open preferences')} title={t('Preferencias', 'Preferences')} onClick={() => setSettingsOpen(true)}><Settings2 size={16} /></button>
      </div>
    </header>
    <input ref={fileInput} className="visually-hidden hidden" style={{ display: 'none' }} type="file" multiple accept="video/*,audio/*,image/*" tabIndex={-1} aria-hidden="true" onChange={(event) => { void importFiles(event.target.files); event.target.value = '' }} />
    <input ref={projectFileInput} className="visually-hidden hidden" style={{ display: 'none' }} type="file" accept=".sparta,.json" tabIndex={-1} aria-hidden="true" onChange={(event) => { const file = event.target.files?.[0]; if (file) void openProjectFromFile(file); event.target.value = '' }} />
    <Group id="sparta-workspace" groupRef={shellGroupRef} className="workspace" orientation="horizontal" defaultLayout={shellLayout.defaultLayout ?? { library: 18, editor: 62, assistant: 20 }} onLayoutChanged={(layout, meta) => { shellLayout.onLayoutChanged(layout, meta); setChatOpen((layout.assistant ?? 0) > 0) }} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}>
      <Panel id="library" defaultSize={18} minSize={14} maxSize={26} className="resize-panel-content"><MediaLibraryPanel assets={assets} selectedMedia={selectedMediaId} projectName={projectName} isExtractingSubtitles={extractingSubtitles} subtitleProgressText={subtitleProgressText} importStatus={importStatus} onSelect={(asset) => selectMedia(asset.id)} onAdd={(asset) => addMediaToTimeline(asset)} onAddTextClip={(presetId, text) => { addTextClip({ presetId, text, at: playhead }); toast.success(t('Titular insertado en el cabezal', 'Title inserted at playhead')) }} onAutoSubtitles={(presetId, script, language) => { void handleGenerateVideoSubtitles(presetId, script, language) }} onApplySubtitlePreset={(presetId, language) => { handleApplyOrExtractSubtitlePreset(presetId, language) }} onClearSubtitles={handleClearSubtitles} onRename={(assetId, name) => updateAsset(assetId, { title: name })} onDelete={(assetId) => void deleteMedia(assetId)} onRelink={(assetId, file) => void relinkMedia(assetId, file)} onImport={() => fileInput.current?.click()} onImportFiles={(files) => void importFiles(files)} onOpenProject={() => setSettingsOpen(true)} /></Panel>
      <Separator id="library-separator" className="panel-separator" aria-label={t('Redimensionar biblioteca de medios', 'Resize media library')} />
      <Panel id="editor" defaultSize={62} minSize={45} className="resize-panel-content"><section className={`edit-area ${timelineExpanded ? 'timeline-expanded' : ''}`}>
        <div className="toolbar"><div className="toolbar-left"><span className="sequence-icon"><Film size={15} /></span><ActionMenu label={t('Ajustes de secuencia', 'Sequence settings')} triggerClass="sequence-menu-trigger" items={[{ heading: t('Resolución de secuencia', 'Sequence resolution') }, ...[{ label: '1920 × 1080 (16:9)', width: 1920, height: 1080 }, { label: '1080 × 1920 (9:16)', width: 1080, height: 1920 }, { label: '1080 × 1080 (1:1)', width: 1080, height: 1080 }, { label: '1080 × 1350 (4:5)', width: 1080, height: 1350 }, { label: '1280 × 720 (16:9)', width: 1280, height: 720 }].map((value) => ({ label: value.label, checked: sequence.width === value.width && sequence.height === value.height, onSelect: () => setSequence({ ...sequence, width: value.width, height: value.height }) })), { separator: true }, { heading: t('Fotogramas por segundo', 'Frame rate') }, ...[24, 30, 60].map((value) => ({ label: `${value} fps`, checked: frameRate === value, onSelect: () => setSequence({ ...sequence, frameRate: value }) }))]}><strong>Secuencia 01 <span className="sr-only">Sequence 01</span></strong><ChevronDown size={13} /></ActionMenu><span className="toolbar-slash">/</span><span className="muted">{resolution} · {frameRate} fps</span></div><div className="toolbar-right"><IconButton label={t('Deshacer', 'Undo')} onClick={undo} active={past.length > 0} disabled={!past.length}><Undo2 size={16} /></IconButton><IconButton label={t('Rehacer (Ctrl+Mayús+Z)', 'Redo (Ctrl+Shift+Z)')} onClick={redo} active={future.length > 0} disabled={!future.length}><Undo2 size={16} className="redo-icon" /></IconButton><span className="toolbar-divider" /><IconButton label={chatOpen ? t('Cerrar panel asistente', 'Close assistant panel') : t('Abrir panel asistente', 'Open assistant panel')} onClick={toggleAssistant} active={chatOpen}><IconNlePanelRight size={15} /></IconButton><button type="button" className="export-button" disabled={!canExport} title={canExport ? t('Exportar secuencia de vídeo', 'Export video sequence') : t('El motor de exportación se habilita al tener medios listos en la línea de tiempo', 'The export engine is enabled when ready media is on the timeline')} aria-label={canExport ? t('Exportar vídeo', 'Export video') : t('Exportación no disponible', 'Export unavailable')} onClick={() => setExportOpen(true)}><Video size={15} /> {t('Exportar', 'Export')} <span className="sr-only">{canExport ? 'Export video' : 'Export'}</span></button></div></div>
        <Group id="sparta-editor-vertical" groupRef={editorVerticalGroupRef} className="editor-vertical-group" orientation="vertical" defaultLayout={editorVerticalLayout.defaultLayout ?? { stage: 52, timeline: 48 }} onLayoutChanged={editorVerticalLayout.onLayoutChanged} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}>
          <Panel id="stage" defaultSize="52%" minSize="26%" maxSize="78%" className="resize-panel-content">
            <div className="upper-workspace"><Group id="sparta-preview-inspector" groupRef={upperGroupRef} className="preview-inspector-group" orientation="horizontal" defaultLayout={upperLayout.defaultLayout ?? { monitor: 75, inspector: 25 }} onLayoutChanged={upperLayout.onLayoutChanged} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}><Panel id="monitor" defaultSize="75%" minSize="55%" className="resize-panel-content">{(() => {
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
                  textOverlays={activeTextOverlays}
                  selectedClipId={selectedClipId}
                  onSelectClip={selectClip}
                  onUpdateClip={updateClip}
                  media={!previewClip ? selectedMedia : undefined}
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
            })()}</Panel><Separator id="monitor-splitter" className="panel-separator" aria-label={t('Redimensionar monitor e inspector', 'Resize preview and inspector')} /><Panel id="inspector" defaultSize="25%" minSize="18%" maxSize="40%" className="resize-panel-content"><InspectorPanel clip={selectedClip} selectedMedia={selectedMedia} assets={assets} playhead={playhead} sequenceSize={sequence} onSeek={setPlayhead} readOnly={selectedClipReadOnly} onAddSelected={() => { if (selectedMedia) addMediaToTimeline(selectedMedia, playhead) }} onAddTextClip={(presetId) => { addTextClip({ presetId, at: playhead }); toast.success(t('Capa de texto Pro añadida', 'Pro text layer added')) }} onUpdateClip={updateClip} onCopyClipName={(name) => void copyClipName(name)} onSplitAtPlayhead={() => { if (selectedClip && !selectedClipReadOnly) splitClip(selectedClip.id, playhead) }} onDuplicateClip={() => { if (selectedClip && !selectedClipReadOnly) { duplicateClip(selectedClip.id); toast.success(t('Clip duplicado', 'Clip duplicated')) } }} onCalibrateAllSubtitles={(id) => { const n = calibrateAllSubtitles(id); if (n > 0) toast.success(t(`Calibración aplicada a ${n} subtítulos`, `Calibration applied to ${n} subtitles`)) }} onNudgeAllSubtitlesTime={(delta) => { const n = nudgeAllSubtitlesTime(delta); if (n > 0) toast.success(t(`Sincronización ${delta > 0 ? '+' : ''}${delta}s en ${n} subtítulos`, `Sync ${delta > 0 ? '+' : ''}${delta}s on ${n} subtitles`)) }} onResetClip={() => { if (selectedClip && !selectedClipReadOnly) updateClip(selectedClip.id, { transform: { x: sequence.width / 2, y: sequence.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }, opacity: 100, blendMode: 'normal', volume: 100, fadeIn: 0, fadeOut: 0, uniformScale: true, keyframes: [] }) }} /></Panel></Group></div>
          </Panel>
          <Separator id="stage-timeline-splitter" className="panel-separator panel-separator-horizontal" aria-label={t('Redimensionar monitor y línea de tiempo', 'Resize monitor and timeline')} />
          <Panel id="timeline" defaultSize="48%" minSize="22%" className="resize-panel-content">
            <TimelinePanel tracks={tracks} assets={assets} markers={markers} selected={selectedClipId} playhead={playhead} zoom={zoom} frameRate={frameRate} snap={snapToFrames} expanded={timelineExpanded} tool={activeTool} mutedTracks={mutedTracks} lockedTracks={lockedTracks} onMuteTrack={toggleMute} onLockTrack={toggleLock} onSelect={selectClip} onSeek={setPlayhead} onZoom={setZoom} onAddTrack={addTrack} onAddMedia={addMediaToTimeline} onMoveClip={moveClip} onMoveClipToNewTrack={moveClipToNewTrack} onSplitClip={splitClip} onDeleteClip={deleteClip} onDuplicateClip={(id) => { duplicateClip(id); toast.success(t('Clip duplicado', 'Clip duplicated')) }} onAddTextClip={() => { addTextClip({ presetId: 'hormozi-karaoke', at: playhead }); toast.success(t('Texto animado Pro añadido en el cabezal', 'Pro animated text added at playhead')) }} onAutoSubtitles={() => { void handleGenerateVideoSubtitles('hormozi-karaoke') }} onClearSubtitles={handleClearSubtitles} onPackClips={() => { const n = ripplePackTrack(); if (n > 0) toast.success(t(`${n} clip(s) compactados sin huecos`, `${n} clip(s) packed without gaps`)); else toast.info(t('No hay huecos que compactar', 'No gaps to pack')) }} onAutoMarkers={() => { const n = autoSceneMarkers(); if (n > 0) toast.success(t(`${n} marcador(es) añadidos en cortes`, `${n} marker(s) added at cuts`)); else toast.info(t('Ya existen marcadores en los cortes', 'Cut markers already exist')) }} onAutoAudio={() => { const n = autoAudioBalance(); if (n > 0) toast.success(t(`Mezcla y fundidos aplicados a ${n} clip(s)`, `Mix and fades applied to ${n} clip(s)`)); else toast.info(t('Añade clips para nivelar audio', 'Add clips to balance audio')) }} onAddMarker={addMarker} onRemoveMarker={removeMarker} onToggleSnap={toggleSnap} onToggleExpanded={toggleTimelineExpanded} onSetTool={setActiveTool} onImportFiles={(files) => void importFiles(files)} />
          </Panel>
        </Group>
      </section></Panel>
      <Separator id="assistant-separator" className="panel-separator" aria-label={t('Redimensionar panel del asistente', 'Resize assistant panel')} />
      <Panel id="assistant" panelRef={assistantPanelRef} defaultSize="20%" minSize="14%" maxSize="30%" collapsedSize="0%" collapsible className="resize-panel-content"><AssistantPanel open onClose={toggleAssistant} projectName={projectName} activeMode={assistantMode} onModeChange={setAssistantMode} /></Panel>
    </Group>
    <PreferencesSheet open={settingsOpen} onOpenChange={setSettingsOpen} onResetLayout={resetWorkspace} snapToFrames={snapToFrames} onToggleSnap={toggleSnap} saveStatus={saveStatus} />
    <RenameProjectDialog open={renameOpen} name={projectName} onOpenChange={setRenameOpen} onSave={(name) => { setProjectName(name); toast.success(t('Proyecto renombrado', 'Project renamed'), { description: name }) }} />
    <ExportDialog open={exportOpen} projectName={projectName} sequenceDuration={sequenceDuration} sequenceSize={sequence} tracks={tracks} assets={assets} mutedTracks={mutedTracks} onOpenChange={setExportOpen} />
    <Toaster />
  </main>
}

function formatFileSize(bytes: number) { return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB` }
export default App




