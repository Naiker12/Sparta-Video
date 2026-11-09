import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssistantMode } from '../components/AssistantPanel'
import { ExportDialog } from '../components/ExportDialog'
import { PreferencesSheet } from '../components/PreferencesSheet'
import { RenameProjectDialog } from '../components/RenameProjectDialog'
import { ScriptToVideoDialog } from '../components/ScriptToVideoDialog'
import { SaveAsTemplateDialog } from '../../templates/ui/SaveAsTemplateDialog'
import { VersionHistoryDialog } from '../../projects/ui/VersionHistoryDialog'
import { useAppShellStore } from '../../../app/app-shell-store'
import { downloadSrtFile, parseSrtContent } from '../services/srt-converter'
import {
  getProjectSaveStatus,
  subscribeProjectSaveStatus,
  useEditorStore,
} from '../editor-store'
import { useEditorShortcuts } from '../hooks/use-editor-shortcuts'
import { useMediaImport } from '../hooks/use-media-import'
import { usePlaybackClock } from '../hooks/use-playback-clock'
import { useWorkspaceLayout } from '../hooks/use-workspace-layout'
import { formatMediaDuration } from '../services/media-storage'
import {
  generateSubtitlesFromTimelineVideo,
  repairTimelineAndAssetDurations,
  type SubtitleLanguage,
} from '../services/subtitle-generator'
import { EditorWorkspace } from './EditorWorkspace'
import { TitleBar } from './TitleBar'
import { t } from '../../../shared/i18n/locale'
import { Toaster } from '../../../shared/ui/toast'
import { toast } from '../../../shared/ui/toast-service'

export interface EditorShellProps {
  onGoHome?: () => void
  onNewProjectRequest?: () => void
}

export function EditorShell({ onGoHome, onNewProjectRequest }: EditorShellProps = {}) {
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
  const past = useEditorStore((state) => state.past)
  const future = useEditorStore((state) => state.future)
  const mutedTracks = useEditorStore((state) => state.mutedTracks)
  const lockedTracks = useEditorStore((state) => state.lockedTracks)

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
  const toggleMute = useEditorStore((state) => state.toggleMute)
  const toggleLock = useEditorStore((state) => state.toggleLock)
  const addAdjustmentLayer = useEditorStore((state) => state.addAdjustmentLayer)
  const freezeFrame = useEditorStore((state) => state.freezeFrame)

  const selectedClip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
  const selectedClipTrack = tracks.find((t) => t.clips.some((c) => c.id === selectedClipId))
  const selectedClipReadOnly = !!selectedClipTrack && lockedTracks.includes(selectedClipTrack.id)
  const sequenceDuration = Math.max(0, ...tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration)))
  const selectedMedia = assets.find((item) => item.id === selectedMediaId)
  const effectiveDuration = sequenceDuration > 0 ? sequenceDuration : (selectedMedia?.durationSeconds ?? 0)
  const frameRate = sequence.frameRate

  const activeVisualClips = tracks
    .map((track, trackOrder) => ({ track, trackOrder }))
    .filter(({ track }) => track.kind === 'video' && !mutedTracks.includes(track.id))
    .reverse()
    .flatMap(({ track, trackOrder }) =>
      track.clips
        .filter(
          (clip) =>
            clip.kind !== 'adjustment' &&
            clip.text === undefined &&
            clip.thumbnail !== 'text-overlay' &&
            playhead >= clip.start &&
            playhead < clip.start + clip.duration,
        )
        .map((clip) => ({ ...clip, trackId: track.id, trackOrder })),
    )

  const previewClip = tracks
    .filter((track) => track.kind === 'video' && !mutedTracks.includes(track.id))
    .reduce<NonNullable<typeof selectedClip> | undefined>((active, track) => {
      const current = track.clips
        .filter(
          (clip) =>
            playhead >= clip.start &&
            playhead < clip.start + clip.duration &&
            clip.text === undefined &&
            clip.thumbnail !== 'text-overlay' &&
            clip.kind !== 'adjustment',
        )
        .sort((left, right) => left.start - right.start)
        .at(-1)
      return current ?? active
    }, undefined)

  const activeAdjustmentLayers = tracks
    .map((track, trackOrder) => ({ track, trackOrder }))
    .filter(({ track }) => track.kind === 'video' && !mutedTracks.includes(track.id))
    .flatMap(({ track, trackOrder }) =>
      track.clips
        .filter((clip) => clip.kind === 'adjustment' && playhead >= clip.start && playhead < clip.start + clip.duration)
        .map((clip) => ({ ...clip, trackId: track.id, trackOrder })),
    )

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

  const hasReadyAssets = assets.some((asset) => asset.status === 'ready')
  const hasTextClips = tracks.some((track) => track.clips.some((clip) => clip.text !== undefined || clip.thumbnail === 'text-overlay'))
  const hasTimelineClips = tracks.some((track) => track.clips.length > 0)
  const canExport = (hasReadyAssets || hasTextClips) && hasTimelineClips && sequenceDuration > 0

  const [assistantMode, setAssistantMode] = useState<AssistantMode>('edit')
  const [saveStatus, setSaveStatus] = useState(getProjectSaveStatus)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false)
  const [scriptToVideoOpen, setScriptToVideoOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [extractingSubtitles, setExtractingSubtitles] = useState(false)
  const [subtitleProgressText, setSubtitleProgressText] = useState('')
  const currentProjectId = useAppShellStore((state) => state.currentProjectId)

  const fileInput = useRef<HTMLInputElement>(null)
  const projectFileInput = useRef<HTMLInputElement>(null)
  const srtFileInput = useRef<HTMLInputElement>(null)

  const {
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
  } = useWorkspaceLayout()

  const { togglePlayback } = usePlaybackClock({
    playing,
    effectiveDuration,
    frameRate,
    playhead,
    tracks,
    assets,
    mutedTracks,
    setPlayhead,
    setPlaying,
  })

  const {
    importStatus,
    importFiles,
    deleteMedia,
    relinkMedia,
    addMediaToTimeline,
    copyClipName,
  } = useMediaImport({
    tracks,
    sequence,
    addAssets,
    selectMedia,
    updateAsset,
    removeAsset,
    addMedia,
    setSequence,
    undo,
  })

  useEffect(() => subscribeProjectSaveStatus(setSaveStatus), [])

  useEffect(() => {
    const hasUnprobedReadyMedia = assets.some(
      (a) => a.status === 'ready' && a.type !== 'image' && !a.durationSeconds,
    )
    if (hasUnprobedReadyMedia) {
      void repairTimelineAndAssetDurations()
    }
  }, [assets])

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
        },
      )
    } else {
      toast.info(t('No hay subtítulos en la línea de tiempo para borrar', 'No subtitles on the timeline to delete'))
    }
  }, [clearAllSubtitles, undo])

  useEditorShortcuts({
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
  })

  const handleGenerateVideoSubtitles = async (
    presetId = 'hormozi-karaoke',
    customScript?: string,
    language: SubtitleLanguage = 'spanish',
  ) => {
    if (extractingSubtitles) return
    setExtractingSubtitles(true)
    setSubtitleProgressText(t('Extrayendo audio del video…', 'Extracting video audio…'))
    const subToast = toast.loading(t('Extrayendo subtítulos hablados del video…', 'Extracting spoken subtitles from video…'))
    try {
      const result = await generateSubtitlesFromTimelineVideo({
        presetId,
        customScript,
        language,
        onProgress: (status) => setSubtitleProgressText(status),
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
        const currentTracks = useEditorStore.getState().tracks
        const subTrack = currentTracks.find((tr) => tr.name.toLowerCase().includes('sub'))
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
    const existingSubClips = currentTracks.flatMap((tr) =>
      tr.clips.filter((c) => c.text !== undefined || c.thumbnail === 'text-overlay'),
    )
    if (existingSubClips.length > 1) {
      const count = applyPresetToAllSubtitles(presetId)
      if (count > 0) {
        toast.success(t(`Estilo aplicado a ${count} subtítulos de la secuencia`, `Style applied to ${count} sequence subtitles`))
      }
      return
    }
    void handleGenerateVideoSubtitles(presetId, undefined, language)
  }

  const handleNewProject = () => {
    if (onNewProjectRequest) {
      onNewProjectRequest()
    } else {
      useEditorStore.getState().resetProject()
      toast.info(t('Nuevo proyecto creado', 'New project created'))
    }
  }

  const handleExportSrt = () => {
    const success = downloadSrtFile(projectName, tracks)
    if (success) {
      toast.success(t('Subtítulos exportados (.srt)', 'Subtitles exported (.srt)'), {
        description: `${projectName}.srt`,
      })
    } else {
      toast.info(t('No hay subtítulos en la línea de tiempo', 'No subtitles on the timeline'))
    }
  }

  const handleImportSrtFile = async (file: File) => {
    try {
      const text = await file.text()
      const entries = parseSrtContent(text)
      if (entries.length === 0) {
        toast.info(t('El archivo .srt no contiene subtítulos legibles', 'The .srt file contains no readable subtitles'))
        return
      }
      const added = useEditorStore.getState().addSubtitleSequence(entries, { replaceExisting: false })
      toast.success(t(`${added} subtítulos importados`, `${added} subtitles imported`))
    } catch {
      toast.error(t('Error al leer el archivo .srt', 'Error reading .srt file'))
    }
  }

  return (
    <main className="app-shell">
      <TitleBar
        projectName={projectName}
        saveStatus={saveStatus}
        pastLength={past.length}
        futureLength={future.length}
        canExport={canExport}
        selectedClipId={selectedClipId}
        playhead={playhead}
        undo={undo}
        redo={redo}
        splitClip={splitClip}
        duplicateClip={duplicateClip}
        deleteClip={deleteClip}
        toggleAssistant={toggleAssistant}
        onGoHome={onGoHome}
        onNewProject={handleNewProject}
        onOpenProjectFile={() => projectFileInput.current?.click()}
        onOpenHistory={currentProjectId ? () => setHistoryOpen(true) : undefined}
        onSaveAsTemplate={() => setSaveAsTemplateOpen(true)}
        onOpenScriptToVideo={() => setScriptToVideoOpen(true)}
        onExportSrt={handleExportSrt}
        onImportSrt={() => srtFileInput.current?.click()}
        onImportMedia={() => fileInput.current?.click()}
        onExportVideo={() => setExportOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenRename={() => setRenameOpen(true)}
        onToggleTimelineExpanded={toggleTimelineExpanded}
      />
      <input
        ref={fileInput}
        className="visually-hidden hidden"
        style={{ display: 'none' }}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void importFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={projectFileInput}
        className="visually-hidden hidden"
        style={{ display: 'none' }}
        type="file"
        accept=".sparta,.json"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void import('../services/project-file').then(({ openProjectFromFile }) =>
              openProjectFromFile(file),
            )
          }
          event.target.value = ''
        }}
      />
      <input
        ref={srtFileInput}
        className="visually-hidden hidden"
        style={{ display: 'none' }}
        type="file"
        accept=".srt"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void handleImportSrtFile(file)
          }
          event.target.value = ''
        }}
      />
      <EditorWorkspace
        tracks={tracks}
        assets={assets}
        markers={markers}
        selectedClipId={selectedClipId}
        selectedMediaId={selectedMediaId}
        playhead={playhead}
        playing={playing}
        zoom={zoom}
        frameRate={frameRate}
        snapToFrames={snapToFrames}
        activeTool={activeTool}
        sequence={sequence}
        effectiveDuration={effectiveDuration}
        mutedTracks={mutedTracks}
        lockedTracks={lockedTracks}
        previewClip={previewClip}
        selectedClip={selectedClip}
        selectedMedia={selectedMedia}
        selectedClipReadOnly={selectedClipReadOnly}
        activeVisualClips={activeVisualClips}
        activeAdjustmentLayers={activeAdjustmentLayers}
        activeTextOverlays={activeTextOverlays}
        timelineExpanded={timelineExpanded}
        extractingSubtitles={extractingSubtitles}
        subtitleProgressText={subtitleProgressText}
        importStatus={importStatus}
        assistantMode={assistantMode}
        setAssistantMode={setAssistantMode}
        toggleAssistant={toggleAssistant}
        selectClip={selectClip}
        selectMedia={selectMedia}
        setPlayhead={setPlayhead}
        setPlaying={setPlaying}
        setZoom={setZoom}
        setSequence={setSequence}
        updateClip={updateClip}
        splitClip={splitClip}
        deleteClip={deleteClip}
        duplicateClip={duplicateClip}
        freezeFrame={freezeFrame}
        addTrack={addTrack}
        addMediaToTimeline={addMediaToTimeline}
        moveClip={moveClip}
        moveClipToNewTrack={moveClipToNewTrack}
        ripplePackTrack={ripplePackTrack}
        autoSceneMarkers={autoSceneMarkers}
        autoAudioBalance={autoAudioBalance}
        addMarker={addMarker}
        removeMarker={removeMarker}
        toggleSnap={toggleSnap}
        toggleTimelineExpanded={toggleTimelineExpanded}
        setActiveTool={setActiveTool}
        toggleMute={toggleMute}
        toggleLock={toggleLock}
        addAdjustmentLayer={addAdjustmentLayer}
        addTextClip={addTextClip}
        calibrateAllSubtitles={calibrateAllSubtitles}
        nudgeAllSubtitlesTime={nudgeAllSubtitlesTime}
        handleClearSubtitles={handleClearSubtitles}
        handleGenerateVideoSubtitles={handleGenerateVideoSubtitles}
        handleApplyOrExtractSubtitlePreset={handleApplyOrExtractSubtitlePreset}
        updateAsset={updateAsset}
        deleteMedia={deleteMedia}
        relinkMedia={relinkMedia}
        copyClipName={copyClipName}
        togglePlayback={togglePlayback}
        onImportClick={() => fileInput.current?.click()}
        onImportFiles={(files) => void importFiles(files)}
        projectName={projectName}
        assistantPanelRef={assistantPanelRef}
        appWorkspaceGroupRef={appWorkspaceGroupRef}
        mainVerticalGroupRef={mainVerticalGroupRef}
        upperGroupRef={upperGroupRef}
        appWorkspaceLayout={appWorkspaceLayout}
        verticalLayout={verticalLayout}
        upperLayout={upperLayout}
        setChatOpen={setChatOpen}
      />
      {settingsOpen && (
        <PreferencesSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onResetLayout={resetWorkspace}
          snapToFrames={snapToFrames}
          onToggleSnap={toggleSnap}
          saveStatus={saveStatus}
        />
      )}
      <RenameProjectDialog
        open={renameOpen}
        name={projectName}
        onOpenChange={setRenameOpen}
        onSave={(name) => {
          setProjectName(name)
          toast.success(t('Proyecto renombrado', 'Project renamed'), { description: name })
        }}
      />
      {exportOpen && (
        <ExportDialog
          open={exportOpen}
          projectName={projectName}
          sequenceDuration={sequenceDuration}
          sequenceSize={sequence}
          tracks={tracks}
          assets={assets}
          mutedTracks={mutedTracks}
          onOpenChange={setExportOpen}
        />
      )}
      <SaveAsTemplateDialog
        open={saveAsTemplateOpen}
        onOpenChange={setSaveAsTemplateOpen}
      />
      <ScriptToVideoDialog
        open={scriptToVideoOpen}
        onOpenChange={setScriptToVideoOpen}
      />
      {currentProjectId && (
        <VersionHistoryDialog
          open={historyOpen}
          projectId={currentProjectId}
          projectName={projectName}
          onOpenChange={setHistoryOpen}
          onRestore={(snapshot) => {
            useEditorStore.getState().loadProject(snapshot.state)
          }}
        />
      )}
      <Toaster />
    </main>
  )
}
