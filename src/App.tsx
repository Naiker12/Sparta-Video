import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Clapperboard, CopyPlus, Film, FolderOpen, Pencil, Settings2, Sparkles, Undo2, Video } from 'lucide-react'
import { AssistantPanel } from './features/editor/components/AssistantPanel'
import { IconButton } from './features/editor/components/controls'
import { InspectorPanel } from './features/editor/components/InspectorPanel'
import { MediaLibraryPanel } from './features/editor/components/MediaLibraryPanel'
import { PreviewMonitor } from './features/editor/components/PreviewMonitor'
import { TimelinePanel } from './features/editor/components/TimelinePanel'
import { ActionMenu } from './features/editor/components/ActionMenu'
import { PreferencesSheet } from './features/editor/components/PreferencesSheet'
import { ExportDialog } from './features/editor/components/ExportDialog'
import { RenameProjectDialog } from './features/editor/components/RenameProjectDialog'
import { getProjectSaveStatus, retryProjectSave, subscribeProjectSaveStatus, useEditorStore } from './features/editor/editor-store'
import type { MediaItem } from './features/editor/model'
import type { ExportOptions } from './features/editor/services/contracts'
import { Group, Panel, Separator, useDefaultLayout, useGroupRef, usePanelRef } from 'react-resizable-panels'
import './App.css'
import './styles/editor-polish.css'

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
  const moveClip = useEditorStore((state) => state.moveClip)
  const moveClipToNewTrack = useEditorStore((state) => state.moveClipToNewTrack)
  const addAssets = useEditorStore((state) => state.addAssets)
  const addTrack = useEditorStore((state) => state.addTrack)
  const setProjectName = useEditorStore((state) => state.setProjectName)
  const setSequence = useEditorStore((state) => state.setSequence)
  const updateClip = useEditorStore((state) => state.updateClip)
  const splitClip = useEditorStore((state) => state.splitClip)
  const deleteClip = useEditorStore((state) => state.deleteClip)
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
  const selectedMedia = assets.find((item) => item.id === selectedMediaId)
  const [chatOpen, setChatOpen] = useState(true)
  const [loopPlayback, setLoopPlayback] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportComplete, setExportComplete] = useState(false)
  const [exportFileName, setExportFileName] = useState('')
  const [notice, setNotice] = useState('')
  const [saveStatus, setSaveStatus] = useState(getProjectSaveStatus)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const resolution = `${sequence.width} × ${sequence.height}`
  const frameRate = sequence.frameRate
  const fileInput = useRef<HTMLInputElement>(null)
  const exportJobRef = useRef<string | null>(null)
  const assistantPanelRef = usePanelRef()
  const shellGroupRef = useGroupRef()
  const upperGroupRef = useGroupRef()
  const shellLayout = useDefaultLayout({ id: 'sparta-workspace', panelIds: ['library', 'editor', 'assistant'], storage: layoutStorage })
  const upperLayout = useDefaultLayout({ id: 'sparta-preview-inspector', panelIds: ['monitor', 'inspector'], storage: layoutStorage })

  useEffect(() => subscribeProjectSaveStatus(setSaveStatus), [])

  useEffect(() => {
    const panel = assistantPanelRef.current
    if (panel) setChatOpen(!panel.isCollapsed())
  }, [assistantPanelRef])

  const toggleAssistant = () => {
    const panel = assistantPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) { panel.expand(); setChatOpen(true) }
    else { panel.collapse(); setChatOpen(false) }
  }
  useEffect(() => {
    const compactLayout = () => {
      if (window.innerWidth < 1100 && assistantPanelRef.current && !assistantPanelRef.current.isCollapsed()) {
        assistantPanelRef.current.collapse()
        setChatOpen(false)
      }
    }
    compactLayout()
    window.addEventListener('resize', compactLayout)
    return () => window.removeEventListener('resize', compactLayout)
  }, [assistantPanelRef])
  const resetWorkspace = () => {
    shellGroupRef.current?.setLayout({ library: 16, editor: 67, assistant: 17 })
    upperGroupRef.current?.setLayout({ monitor: 76, inspector: 24 })
  }

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      const state = useEditorStore.getState()
      const duration = Math.max(0, ...state.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)))
      if (state.playhead >= duration) { if (loopPlayback && duration > 0) setPlayhead(0); else setPlaying(false) }
      else setPlayhead(Math.min(duration, state.playhead + 1 / state.sequence.frameRate))
    }, 1000 / useEditorStore.getState().sequence.frameRate)
    return () => window.clearInterval(timer)
  }, [playing, loopPlayback, sequence.frameRate, setPlayhead, setPlaying])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showExport) { const jobId = exportJobRef.current; exportJobRef.current = null; if (jobId) void import('./features/editor/services/mock-services').then(({ mockExportService }) => mockExportService.cancel(jobId)); setExporting(false); setShowExport(false); return }
      if (event.defaultPrevented || event.isComposing) return
      if (event.target instanceof HTMLElement && (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target.isContentEditable || (event.target.closest('button,select,[role="dialog"],[role="menu"],[role="menuitem"],[role="separator"],[role="slider"],[role="switch"],[role="tab"],[role="tabpanel"]') && !event.target.closest('.timeline-clip')))) return
      if (settingsOpen || showExport || renameOpen) return
      if (event.code === 'Space') { event.preventDefault(); setPlaying(!useEditorStore.getState().playing) }
      const timelineFocused = event.target instanceof HTMLElement && !!event.target.closest('[aria-label^="Pistas de la línea de tiempo"]')
      const clipFocused = event.target instanceof HTMLElement && !!event.target.closest('.timeline-clip')
      if (timelineFocused && clipFocused && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const state = useEditorStore.getState(); const clip = state.tracks.flatMap((track) => track.clips).find((item) => item.id === state.selectedClipId)
        const owner = state.tracks.find((track) => track.clips.some((item) => item.id === clip?.id))
        if (clip && owner && !state.lockedTracks.includes(owner.id)) { const direction = event.key === 'ArrowLeft' ? -1 : 1; const step = event.shiftKey ? 1 : 1 / state.sequence.frameRate; if (event.ctrlKey && event.altKey) { const start = Math.max(0, clip.start + direction * step); const duration = Math.max(1 / state.sequence.frameRate, clip.duration - (start - clip.start)); moveClip(clip.id, state.snapToFrames ? Math.round(start * state.sequence.frameRate) / state.sequence.frameRate : start, state.snapToFrames ? Math.round(duration * state.sequence.frameRate) / state.sequence.frameRate : duration) } else if (event.altKey) { const duration = Math.max(1 / state.sequence.frameRate, clip.duration + direction * step); moveClip(clip.id, clip.start, state.snapToFrames ? Math.round(duration * state.sequence.frameRate) / state.sequence.frameRate : duration) } else { const start = Math.max(0, clip.start + direction * step); moveClip(clip.id, state.snapToFrames ? Math.round(start * state.sequence.frameRate) / state.sequence.frameRate : start) } event.preventDefault(); return }
      }
      if (event.key === 'ArrowLeft') setPlayhead(useEditorStore.getState().playhead - (event.shiftKey ? 1 : 1 / useEditorStore.getState().sequence.frameRate))
      if (event.key === 'ArrowRight') setPlayhead(useEditorStore.getState().playhead + (event.shiftKey ? 1 : 1 / useEditorStore.getState().sequence.frameRate))
      if (event.key === 'Home') { event.preventDefault(); setPlayhead(0) }
      if (event.key === 'End') { event.preventDefault(); setPlayhead(sequenceDuration) }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('[aria-label="Buscar medios"]')?.focus() }
      if (event.key === 'Delete' || event.key === 'Backspace') { const id = useEditorStore.getState().selectedClipId; if (id) { event.preventDefault(); deleteClip(id) } }
      if (event.key.toLowerCase() === 'c') setActiveTool('razor')
      if (event.key.toLowerCase() === 'v') setActiveTool('select')
      if (event.key.toLowerCase() === 'm') addMarker(useEditorStore.getState().playhead)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addMarker, deleteClip, moveClip, redo, renameOpen, sequenceDuration, setActiveTool, setPlayhead, setPlaying, settingsOpen, showExport, splitClip, undo])

  const importFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    const sourceFiles = Array.from(files)
    const results = await Promise.allSettled(sourceFiles.map(async (file): Promise<MediaItem> => {
      const { mockMediaService } = await import('./features/editor/services/mock-services')
      const metadata = await mockMediaService.inspect(file)
      const type = metadata.mimeType.startsWith('audio') ? 'audio' : metadata.mimeType.startsWith('image') ? 'image' : 'video'
      return { id: `local-${crypto.randomUUID()}`, title: metadata.name, detail: `${type.toUpperCase()} · ${formatFileSize(metadata.sizeBytes)}`, thumb: type === 'audio' ? 'wave' : type === 'image' ? 'image-catalog' : 'video-catalog', type, status: metadata.status }
    }))
    const imported = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
    const failed = results.length - imported.length
    addAssets(imported)
    const failedNames = results.flatMap((result, index) => result.status === 'rejected' ? [sourceFiles[index].name] : [])
    setNotice(imported.length && failed ? `${imported.length} añadidos; ${failed} omitidos: ${failedNames.join(', ')}` : imported.length ? `${imported.length} ${imported.length === 1 ? 'archivo añadido' : 'archivos añadidos'} a la biblioteca` : `${failed} archivo(s) no compatible(s); no se añadió ninguno.`)
    window.setTimeout(() => setNotice(''), 2800)
  }
  const addMediaToTimeline = (asset: MediaItem, at?: number, trackId?: string) => {
    const id = addMedia(asset, at, trackId)
    if (!id) {
      setNotice(`Elige una pista ${asset.type === 'audio' ? 'de audio' : 'de vídeo'} desbloqueada para insertar este medio.`)
      window.setTimeout(() => setNotice(''), 2800)
    }
    return id
  }
  const cancelExport = async () => {
    const jobId = exportJobRef.current
    exportJobRef.current = null
    if (jobId) { const { mockExportService } = await import('./features/editor/services/mock-services'); await mockExportService.cancel(jobId) }
    setExporting(false)
    setExportProgress(0)
  }
  const openExport = () => { setExportFileName(`${projectName.toLowerCase().replaceAll(' ', '-')}-final.mp4`); setExportComplete(false); setExportProgress(0); setShowExport(true) }
  const runExport = async () => {
    const options: ExportOptions = { projectName, fileName: exportFileName.trim() || `${projectName.toLowerCase().replaceAll(' ', '-')}-final.mp4`, format: 'mp4', codec: 'h264', width: sequence.width, height: sequence.height, frameRate, durationSeconds: sequenceDuration }
    setExporting(true)
    setExportComplete(false)
    setExportProgress(0)
    const { mockExportService } = await import('./features/editor/services/mock-services')
    const { jobId } = await mockExportService.start(options, (progress) => {
      setExportProgress(progress)
      if (progress >= 100) {
        exportJobRef.current = null
        setExporting(false)
        setExportComplete(true)
      }
    })
    exportJobRef.current = jobId
  }
  const copyClipName = async (name: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(name)
      setNotice('Nombre del clip copiado.')
    } catch {
      setNotice('No se pudo acceder al portapapeles en este navegador.')
    }
    window.setTimeout(() => setNotice(''), 2800)
  }
  useEffect(() => () => { const jobId = exportJobRef.current; if (jobId) void import('./features/editor/services/mock-services').then(({ mockExportService }) => mockExportService.cancel(jobId)) }, [])

  return <main className="app-shell">
    <header className="titlebar"><div className="brand"><div className="brand-mark"><Clapperboard size={16} /></div><span>SPARTA</span><span className="brand-video">VIDEO</span><span className="brand-divider" /><ActionMenu label="Acciones del proyecto" triggerClass="project-menu-trigger" items={[{ heading: 'PROYECTO' }, { label: 'Cambiar nombre', icon: Pencil, onSelect: () => setRenameOpen(true) }, { label: 'Duplicar proyecto · pronto', icon: CopyPlus, disabled: true, onSelect: () => undefined }, { separator: true }, { label: 'Preferencias del proyecto', icon: FolderOpen, onSelect: () => setSettingsOpen(true) }]}><span>{projectName}</span><ChevronDown size={13} /></ActionMenu></div><div className="title-meta"><span className="save-status" data-status={saveStatus} role="status" title={saveStatus === 'error' ? 'El navegador no pudo guardar los cambios del proyecto.' : saveStatus === 'unsaved' ? 'La demostración aún no ha guardado cambios en este navegador.' : undefined}><span />{saveStatus === 'saving' ? 'Guardando…' : saveStatus === 'saved' ? 'Guardado en este navegador' : saveStatus === 'error' ? <><span className="save-error-label">Error al guardar</span><button className="retry-save" onClick={() => { retryProjectSave(); setNotice('Se volvió a intentar guardar el proyecto.') }}>Reintentar</button></> : 'Demostración · sin guardar'}</span><span className="title-separator" /><span className="avatar" aria-label="Perfil de demostración" title="Perfil de demostración">JD</span><button className="icon-button" aria-label="Abrir preferencias" title="Preferencias" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /></button></div></header>
    <input ref={fileInput} className="visually-hidden" type="file" multiple accept="video/*,audio/*,image/*" onChange={(event) => { void importFiles(event.target.files); event.target.value = '' }} />
    <Group id="sparta-workspace" groupRef={shellGroupRef} className="workspace" orientation="horizontal" defaultLayout={shellLayout.defaultLayout ?? { library: 16, editor: 67, assistant: 17 }} onLayoutChanged={(layout, meta) => { shellLayout.onLayoutChanged(layout, meta); setChatOpen((layout.assistant ?? 0) > 0) }} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}>
      <Panel id="library" defaultSize="16%" minSize="190px" maxSize="25%" className="resize-panel-content"><MediaLibraryPanel assets={assets} selectedMedia={selectedMediaId} projectName={projectName} onSelect={(asset) => selectMedia(asset.id)} onAdd={(asset) => addMediaToTimeline(asset)} onImport={() => fileInput.current?.click()} onImportFiles={(files) => void importFiles(files)} onOpenProject={() => setSettingsOpen(true)} /></Panel>
      <Separator id="library-separator" className="panel-separator" aria-label="Redimensionar biblioteca de medios" />
      <Panel id="editor" defaultSize="67%" minSize="45%" className="resize-panel-content"><section className={`edit-area ${timelineExpanded ? 'timeline-expanded' : ''}`}>
        <div className="toolbar"><div className="toolbar-left"><span className="sequence-icon"><Film size={15} /></span><ActionMenu label="Ajustes de secuencia" triggerClass="sequence-menu-trigger" items={[{ heading: 'Resolución de secuencia' }, ...[{ label: '1920 × 1080', width: 1920, height: 1080 }, { label: '1280 × 720', width: 1280, height: 720 }, { label: '1080 × 1920', width: 1080, height: 1920 }].map((value) => ({ label: value.label, checked: sequence.width === value.width && sequence.height === value.height, onSelect: () => setSequence({ ...sequence, width: value.width, height: value.height }) })) , { separator: true }, { heading: 'Fotogramas por segundo' }, ...[24, 30, 60].map((value) => ({ label: `${value} fps`, checked: frameRate === value, onSelect: () => setSequence({ ...sequence, frameRate: value }) }))]}><strong>Secuencia 01</strong><ChevronDown size={13} /></ActionMenu><span className="toolbar-slash">/</span><span className="muted">{resolution} · {frameRate} fps</span></div><div className="toolbar-right"><IconButton label="Deshacer (Ctrl+Z)" onClick={undo} active={past.length > 0} disabled={!past.length}><Undo2 size={16} /></IconButton><IconButton label="Rehacer (Ctrl+Mayús+Z)" onClick={redo} active={future.length > 0} disabled={!future.length}><Undo2 size={16} className="redo-icon" /></IconButton><span className="toolbar-divider" /><IconButton label={chatOpen ? 'Cerrar panel asistente' : 'Abrir panel asistente'} onClick={toggleAssistant} active={chatOpen}><Sparkles size={16} /></IconButton><button type="button" className="export-button" onClick={openExport} title="Abrir opciones de exportación"><Video size={15} /> Exportar</button></div></div>
        <div className="upper-workspace"><Group id="sparta-preview-inspector" groupRef={upperGroupRef} className="preview-inspector-group" orientation="horizontal" defaultLayout={upperLayout.defaultLayout ?? { monitor: 76, inspector: 24 }} onLayoutChanged={upperLayout.onLayoutChanged} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}><Panel id="monitor" defaultSize="76%" minSize="55%" className="resize-panel-content"><PreviewMonitor playhead={playhead} playing={playing} loop={loopPlayback} onToggleLoop={() => setLoopPlayback((value) => !value)} markers={markers} onTogglePlay={() => setPlaying(!playing)} onSeek={setPlayhead} frameRate={frameRate} duration={sequenceDuration} clip={selectedClip} sequenceSize={sequence} /></Panel><Separator id="monitor-splitter" className="panel-separator" aria-label="Resize preview and inspector" /><Panel id="inspector" defaultSize="24%" minSize="18%" maxSize="40%" className="resize-panel-content"><InspectorPanel clip={selectedClip} selectedMedia={selectedMedia} assets={assets} playhead={playhead} sequenceSize={sequence} onSeek={setPlayhead} readOnly={selectedClipReadOnly} onAddSelected={() => { if (selectedMedia) addMediaToTimeline(selectedMedia, playhead) }} onUpdateClip={updateClip} onCopyClipName={(name) => void copyClipName(name)} onResetClip={() => { if (selectedClip && !selectedClipReadOnly) updateClip(selectedClip.id, { transform: { x: sequence.width / 2, y: sequence.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }, opacity: 100, blendMode: 'normal', volume: 100, fadeIn: 0, fadeOut: 0, uniformScale: true, keyframes: [] }) }} /></Panel></Group></div>
        <TimelinePanel tracks={tracks} assets={assets} markers={markers} selected={selectedClipId} playhead={playhead} zoom={zoom} frameRate={frameRate} snap={snapToFrames} expanded={timelineExpanded} tool={activeTool} mutedTracks={mutedTracks} lockedTracks={lockedTracks} onMuteTrack={toggleMute} onLockTrack={toggleLock} onSelect={selectClip} onSeek={setPlayhead} onZoom={setZoom} onAddTrack={addTrack} onAddMedia={addMediaToTimeline} onMoveClip={moveClip} onMoveClipToNewTrack={moveClipToNewTrack} onSplitClip={splitClip} onAddMarker={addMarker} onRemoveMarker={removeMarker} onToggleSnap={toggleSnap} onToggleExpanded={() => setTimelineExpanded((value) => !value)} onSetTool={setActiveTool} />
      </section></Panel>
      <Separator id="assistant-separator" className="panel-separator" aria-label="Redimensionar panel del asistente" />
      <Panel id="assistant" panelRef={assistantPanelRef} defaultSize="17%" minSize="13%" maxSize="28%" collapsedSize="0%" collapsible className="resize-panel-content"><AssistantPanel open onClose={toggleAssistant} projectName={projectName} /></Panel>
    </Group>
    <PreferencesSheet open={settingsOpen} onOpenChange={setSettingsOpen} onResetLayout={resetWorkspace} snapToFrames={snapToFrames} onToggleSnap={toggleSnap} saveStatus={saveStatus} />
    <RenameProjectDialog open={renameOpen} name={projectName} onOpenChange={setRenameOpen} onSave={setProjectName} />
    {notice && <div className="toast-notice"><span className="toast-check"><span>✓</span></span>{notice}</div>}
    <ExportDialog open={showExport} onOpenChange={setShowExport} projectName={projectName} fileName={exportFileName} onFileNameChange={setExportFileName} resolution={resolution} frameRate={frameRate} duration={sequenceDuration} exporting={exporting} progress={exportProgress} complete={exportComplete} onStart={() => void runExport()} onCancel={() => void cancelExport()} onEditSettings={() => { setExportComplete(false); setExportProgress(0) }} />
  </main>
}

function formatFileSize(bytes: number) { return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB` }
export default App




