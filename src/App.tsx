import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Clapperboard, Film, FolderOpen, Pencil, Settings2, Sparkles, Undo2, Video } from 'lucide-react'
import { AssistantPanel } from './features/editor/components/AssistantPanel'
import { IconButton } from './features/editor/components/controls'
import { InspectorPanel } from './features/editor/components/InspectorPanel'
import { MediaLibraryPanel } from './features/editor/components/MediaLibraryPanel'
import { PreviewMonitor } from './features/editor/components/PreviewMonitor'
import { TimelinePanel } from './features/editor/components/TimelinePanel'
import { ActionMenu } from './features/editor/components/ActionMenu'
import { PreferencesSheet } from './features/editor/components/PreferencesSheet'
import { RenameProjectDialog } from './features/editor/components/RenameProjectDialog'
import { getProjectSaveStatus, subscribeProjectSaveStatus, useEditorStore } from './features/editor/editor-store'
import type { MediaItem } from './features/editor/model'
import { captureVideoThumbnail, getMediaMimeType, storeMediaFile, storeMediaPreview } from './features/editor/services/media-storage'
import { Group, Panel, Separator, useDefaultLayout, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { t, useLanguage } from './features/editor/services/locale'
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
  const previewClip = tracks.filter((track) => track.kind === 'video').reduce<NonNullable<typeof selectedClip> | undefined>((active, track) => {
    const current = track.clips.filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration).sort((left, right) => left.start - right.start).at(-1)
    return current ?? active
  }, undefined)
  const selectedMedia = assets.find((item) => item.id === selectedMediaId)
  const [chatOpen, setChatOpen] = useState(true)
  const [notice, setNotice] = useState('')
  const [saveStatus, setSaveStatus] = useState(getProjectSaveStatus)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const resolution = `${sequence.width} × ${sequence.height}`
  const frameRate = sequence.frameRate
  const fileInput = useRef<HTMLInputElement>(null)
  const assistantPanelRef = usePanelRef()
  const shellGroupRef = useGroupRef()
  const upperGroupRef = useGroupRef()
  const editorVerticalGroupRef = useGroupRef()
  const shellLayout = useDefaultLayout({ id: 'sparta-workspace', panelIds: ['library', 'editor', 'assistant'], storage: layoutStorage })
  const upperLayout = useDefaultLayout({ id: 'sparta-preview-inspector', panelIds: ['monitor', 'inspector'], storage: layoutStorage })
  const editorVerticalLayout = useDefaultLayout({ id: 'sparta-editor-vertical', panelIds: ['stage', 'timeline'], storage: layoutStorage })

  useEffect(() => subscribeProjectSaveStatus(setSaveStatus), [])

  useEffect(() => {
    if (!playing || sequenceDuration <= 0) return
    let lastFrameAt = performance.now()
    let animationFrame = 0
    const advance = (now: number) => {
      const elapsed = (now - lastFrameAt) / 1000
      if (elapsed < 1 / frameRate) { animationFrame = requestAnimationFrame(advance); return }
      lastFrameAt = now
      const next = useEditorStore.getState().playhead + elapsed
      if (next >= sequenceDuration) {
        setPlayhead(sequenceDuration)
        setPlaying(false)
        return
      }
      setPlayhead(next)
      animationFrame = requestAnimationFrame(advance)
    }
    animationFrame = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(animationFrame)
  }, [playing, sequenceDuration, frameRate, setPlayhead, setPlaying])

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
    shellGroupRef.current?.setLayout(window.innerWidth < 1100 ? { library: 20, editor: 80, assistant: 0 } : { library: 16, editor: 67, assistant: 17 })
    upperGroupRef.current?.setLayout(window.innerWidth < 1100 ? { monitor: 72, inspector: 28 } : { monitor: 76, inspector: 24 })
    editorVerticalGroupRef.current?.setLayout({ stage: 52, timeline: 48 })
  }
  const toggleTimelineExpanded = () => {
    const next = !timelineExpanded
    setTimelineExpanded(next)
    editorVerticalGroupRef.current?.setLayout(next ? { stage: 16, timeline: 84 } : { stage: 52, timeline: 48 })
  }

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
  }, [addMarker, deleteClip, moveClip, redo, renameOpen, sequenceDuration, setActiveTool, setPlayhead, settingsOpen, splitClip, undo])

  const importFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    const sourceFiles = Array.from(files)
    const pending = sourceFiles.map((file) => {
      const mime = getMediaMimeType(file)
      const type: MediaItem['type'] = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'video'
      const asset: MediaItem = { id: `local-${crypto.randomUUID()}`, title: file.name, detail: `${type.toUpperCase()} · ${formatFileSize(file.size)}`, thumb: type === 'audio' ? 'wave' : type === 'image' ? 'image-catalog' : 'video-catalog', type, status: 'processing' }
      return { file, asset }
    })
    addAssets(pending.map(({ asset }) => asset))
    if (pending[0].asset.type !== 'audio') selectMedia(pending[0].asset.id)
    setNotice(sourceFiles.length === 1 ? t('Importando archivo…', 'Importing file…') : t(`Importando ${sourceFiles.length} archivos…`, `Importing ${sourceFiles.length} files…`))
    const { inspectMediaFile } = await import('./features/editor/services/media-catalog')
    const results = await Promise.allSettled(pending.map(async ({ file, asset }) => {
      const metadata = await inspectMediaFile(file)
      if (asset.type !== 'audio') await storeMediaFile(asset.id, file)
      if (asset.type === 'video') {
        const preview = await captureVideoThumbnail(file)
        if (preview) await storeMediaPreview(asset.id, preview)
      }
      updateAsset(asset.id, {
        title: metadata.name,
        detail: `${asset.type.toUpperCase()} · ${formatFileSize(metadata.sizeBytes)}`,
        status: asset.type === 'audio' ? metadata.status : 'ready',
      })
      return asset.id
    }))
    const failedNames = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return []
      const message = result.reason instanceof Error ? result.reason.message : t('No se pudo procesar el archivo.', 'Could not process the file.')
      updateAsset(pending[index].asset.id, { status: 'error', detail: message })
      return [sourceFiles[index].name]
    })
    const succeeded = results.length - failedNames.length
    setNotice(succeeded && failedNames.length
      ? t(`${succeeded} importados; ${failedNames.length} no se pudieron procesar: ${failedNames.join(', ')}`, `${succeeded} imported; ${failedNames.length} could not be processed: ${failedNames.join(', ')}`)
      : succeeded
        ? succeeded === 1 ? t('1 archivo importado a la biblioteca', '1 file imported to the library') : t(`${succeeded} archivos importados a la biblioteca`, `${succeeded} files imported to the library`)
        : t(`${failedNames.length} archivo(s) no se pudieron procesar. Revisa el estado en la biblioteca.`, `${failedNames.length} file(s) could not be processed. Check their status in the library.`))
    window.setTimeout(() => setNotice(''), 2800)
  }
  const deleteMedia = (assetId: string) => removeAsset(assetId)
  const togglePlayback = () => {
    if (!playing && sequenceDuration > 0 && playhead >= sequenceDuration) setPlayhead(0)
    setPlaying(!playing)
  }
  const relinkMedia = async (assetId: string, file: File) => {
    updateAsset(assetId, { status: 'processing' })
    try {
      const { inspectMediaFile } = await import('./features/editor/services/media-catalog')
      const metadata = await inspectMediaFile(file)
      const type: MediaItem['type'] = metadata.mimeType.startsWith('image/') ? 'image' : metadata.mimeType.startsWith('audio/') ? 'audio' : 'video'
      if (type !== 'audio') await storeMediaFile(assetId, file)
      if (type === 'video') {
        const preview = await captureVideoThumbnail(file)
        if (preview) await storeMediaPreview(assetId, preview)
      }
      updateAsset(assetId, { title: metadata.name, type, detail: `${type.toUpperCase()} · ${formatFileSize(metadata.sizeBytes)}`, thumb: type === 'image' ? 'image-catalog' : type === 'audio' ? 'wave' : 'video-catalog', status: type === 'audio' ? metadata.status : 'ready' })
    } catch (error) {
      updateAsset(assetId, { status: 'error', detail: error instanceof Error ? error.message : t('No se pudo vincular el archivo.', 'Could not link the file.') })
    }
  }
  const addMediaToTimeline = (asset: MediaItem, at?: number, trackId?: string) => {
    const id = addMedia(asset, at, trackId)
    if (!id) {
      setNotice(asset.type === 'audio'
        ? t('Elige una pista de audio desbloqueada para insertar este medio.', 'Choose an unlocked audio track to insert this media.')
        : t('Elige una pista de vídeo desbloqueada para insertar este medio.', 'Choose an unlocked video track to insert this media.'))
      window.setTimeout(() => setNotice(''), 2800)
    }
    return id
  }
  const copyClipName = async (name: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(name)
      setNotice(t('Nombre del clip copiado.', 'Clip name copied.'))
    } catch {
      setNotice(t('No se pudo acceder al portapapeles en este navegador.', 'Clipboard access is unavailable in this browser.'))
    }
    window.setTimeout(() => setNotice(''), 2800)
  }
  return <main className="app-shell">
    <header className="titlebar">
      <div className="brand">
        <div className="brand-mark"><Clapperboard size={15} /></div><span>SPARTA</span><span className="brand-video">VIDEO</span><span className="brand-divider" />
        <ActionMenu label={t('Acciones del proyecto', 'Project actions')} triggerClass="project-menu-trigger" items={[
          { heading: t('PROYECTO', 'PROJECT') },
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
    <Group id="sparta-workspace" groupRef={shellGroupRef} className="workspace" orientation="horizontal" defaultLayout={shellLayout.defaultLayout ?? { library: 16, editor: 67, assistant: 17 }} onLayoutChanged={(layout, meta) => { shellLayout.onLayoutChanged(layout, meta); setChatOpen((layout.assistant ?? 0) > 0) }} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}>
      <Panel id="library" defaultSize="16%" minSize="190px" maxSize="25%" className="resize-panel-content"><MediaLibraryPanel assets={assets} selectedMedia={selectedMediaId} projectName={projectName} onSelect={(asset) => selectMedia(asset.id)} onAdd={(asset) => addMediaToTimeline(asset)} onRename={(assetId, name) => updateAsset(assetId, { title: name })} onDelete={(assetId) => void deleteMedia(assetId)} onRelink={(assetId, file) => void relinkMedia(assetId, file)} onImport={() => fileInput.current?.click()} onImportFiles={(files) => void importFiles(files)} onOpenProject={() => setSettingsOpen(true)} /></Panel>
      <Separator id="library-separator" className="panel-separator" aria-label={t('Redimensionar biblioteca de medios','Resize media library')} />
      <Panel id="editor" defaultSize="67%" minSize="45%" className="resize-panel-content"><section className={`edit-area ${timelineExpanded ? 'timeline-expanded' : ''}`}>
        <div className="toolbar"><div className="toolbar-left"><span className="sequence-icon"><Film size={15} /></span><ActionMenu label={t('Ajustes de secuencia','Sequence settings')} triggerClass="sequence-menu-trigger" items={[{ heading: t('Resolución de secuencia','Sequence resolution') }, ...[{ label: '1920 × 1080', width: 1920, height: 1080 }, { label: '1280 × 720', width: 1280, height: 720 }, { label: '1080 × 1920', width: 1080, height: 1920 }].map((value) => ({ label: value.label, checked: sequence.width === value.width && sequence.height === value.height, onSelect: () => setSequence({ ...sequence, width: value.width, height: value.height }) })) , { separator: true }, { heading: t('Fotogramas por segundo','Frame rate') }, ...[24, 30, 60].map((value) => ({ label: `${value} fps`, checked: frameRate === value, onSelect: () => setSequence({ ...sequence, frameRate: value }) }))]}><strong>Secuencia 01 <span className="sr-only">Sequence 01</span></strong><ChevronDown size={13} /></ActionMenu><span className="toolbar-slash">/</span><span className="muted">{resolution} · {frameRate} fps</span></div><div className="toolbar-right"><IconButton label={t('Deshacer','Undo')} onClick={undo} active={past.length > 0} disabled={!past.length}><Undo2 size={16} /></IconButton><IconButton label={t('Rehacer (Ctrl+Mayús+Z)','Redo (Ctrl+Shift+Z)')} onClick={redo} active={future.length > 0} disabled={!future.length}><Undo2 size={16} className="redo-icon" /></IconButton><span className="toolbar-divider" /><IconButton label={chatOpen ? t('Cerrar panel asistente','Close assistant panel') : t('Abrir panel asistente','Open assistant panel')} onClick={toggleAssistant} active={chatOpen}><Sparkles size={16} /></IconButton><button type="button" className="export-button" disabled title={t('El motor de exportación aún no está conectado','The export engine is not connected yet')} aria-label={t('Exportación no disponible','Export unavailable')}><Video size={15} /> {t('Exportar','Export')} <span className="sr-only">Export</span></button></div></div>
        <Group id="sparta-editor-vertical" groupRef={editorVerticalGroupRef} className="editor-vertical-group" orientation="vertical" defaultLayout={editorVerticalLayout.defaultLayout ?? { stage: 52, timeline: 48 }} onLayoutChanged={editorVerticalLayout.onLayoutChanged} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}>
          <Panel id="stage" defaultSize="52%" minSize="26%" maxSize="78%" className="resize-panel-content">
            <div className="upper-workspace"><Group id="sparta-preview-inspector" groupRef={upperGroupRef} className="preview-inspector-group" orientation="horizontal" defaultLayout={upperLayout.defaultLayout ?? { monitor: 76, inspector: 24 }} onLayoutChanged={upperLayout.onLayoutChanged} resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}><Panel id="monitor" defaultSize="76%" minSize="55%" className="resize-panel-content"><PreviewMonitor playhead={playhead} markers={markers} onSeek={setPlayhead} frameRate={frameRate} duration={sequenceDuration} clip={previewClip} media={!previewClip ? selectedMedia : undefined} sequenceSize={sequence} playing={playing} onTogglePlay={togglePlayback} /></Panel><Separator id="monitor-splitter" className="panel-separator" aria-label={t('Redimensionar monitor e inspector','Resize preview and inspector')} /><Panel id="inspector" defaultSize="24%" minSize="18%" maxSize="40%" className="resize-panel-content"><InspectorPanel clip={selectedClip} selectedMedia={selectedMedia} assets={assets} playhead={playhead} sequenceSize={sequence} onSeek={setPlayhead} readOnly={selectedClipReadOnly} onAddSelected={() => { if (selectedMedia) addMediaToTimeline(selectedMedia, playhead) }} onUpdateClip={updateClip} onCopyClipName={(name) => void copyClipName(name)} onResetClip={() => { if (selectedClip && !selectedClipReadOnly) updateClip(selectedClip.id, { transform: { x: sequence.width / 2, y: sequence.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }, opacity: 100, blendMode: 'normal', volume: 100, fadeIn: 0, fadeOut: 0, uniformScale: true, keyframes: [] }) }} /></Panel></Group></div>
          </Panel>
          <Separator id="stage-timeline-splitter" className="panel-separator panel-separator-horizontal" aria-label={t('Redimensionar monitor y línea de tiempo', 'Resize monitor and timeline')} />
          <Panel id="timeline" defaultSize="48%" minSize="22%" className="resize-panel-content">
            <TimelinePanel tracks={tracks} assets={assets} markers={markers} selected={selectedClipId} playhead={playhead} zoom={zoom} frameRate={frameRate} snap={snapToFrames} expanded={timelineExpanded} tool={activeTool} mutedTracks={mutedTracks} lockedTracks={lockedTracks} onMuteTrack={toggleMute} onLockTrack={toggleLock} onSelect={selectClip} onSeek={setPlayhead} onZoom={setZoom} onAddTrack={addTrack} onAddMedia={addMediaToTimeline} onMoveClip={moveClip} onMoveClipToNewTrack={moveClipToNewTrack} onSplitClip={splitClip} onAddMarker={addMarker} onRemoveMarker={removeMarker} onToggleSnap={toggleSnap} onToggleExpanded={toggleTimelineExpanded} onSetTool={setActiveTool} />
          </Panel>
        </Group>
      </section></Panel>
      <Separator id="assistant-separator" className="panel-separator" aria-label={t('Redimensionar panel del asistente','Resize assistant panel')} />
      <Panel id="assistant" panelRef={assistantPanelRef} defaultSize="17%" minSize="13%" maxSize="28%" collapsedSize="0%" collapsible className="resize-panel-content"><AssistantPanel open onClose={toggleAssistant} projectName={projectName} /></Panel>
    </Group>
    <PreferencesSheet open={settingsOpen} onOpenChange={setSettingsOpen} onResetLayout={resetWorkspace} snapToFrames={snapToFrames} onToggleSnap={toggleSnap} saveStatus={saveStatus} />
    <RenameProjectDialog open={renameOpen} name={projectName} onOpenChange={setRenameOpen} onSave={setProjectName} />
    {notice && <div className="toast-notice"><span className="toast-check"><span>✓</span></span>{notice}</div>}
  </main>
}

function formatFileSize(bytes: number) { return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB` }
export default App




