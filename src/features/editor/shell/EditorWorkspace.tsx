import { Group, Panel, Separator, useDefaultLayout, useGroupRef, usePanelRef } from 'react-resizable-panels'
import type { AssistantMode } from '../components/AssistantPanel'
import { AssistantPanel } from '../components/AssistantPanel'
import { InspectorPanel } from '../components/InspectorPanel'
import { MediaLibraryPanel } from '../components/MediaLibraryPanel'
import { PreviewMonitor } from '../components/PreviewMonitor'
import { TimelinePanel } from '../components/TimelinePanel'
import type {
  Clip,
  MediaItem,
  SequenceSettings,
  TimelineMarker,
  Track,
  TransitionRef,
} from '../model'
import type { SubtitleLanguage } from '../services/subtitle-generator'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'

interface EditorWorkspaceProps {
  tracks: Track[]
  assets: MediaItem[]
  markers: TimelineMarker[]
  selectedClipId: string | null
  selectedMediaId: string | null
  playhead: number
  playing: boolean
  zoom: number
  frameRate: number
  snapToFrames: boolean
  activeTool: 'select' | 'razor'
  sequence: SequenceSettings
  effectiveDuration: number
  mutedTracks: string[]
  lockedTracks: string[]
  previewClip: Clip | undefined
  selectedClip: Clip | undefined
  selectedMedia: MediaItem | undefined
  selectedClipReadOnly: boolean
  activeVisualClips: (Clip & { trackId: string; trackOrder: number })[]
  activeAdjustmentLayers: (Clip & { trackId: string; trackOrder: number })[]
  activeTextOverlays: Clip[]
  timelineExpanded: boolean
  extractingSubtitles: boolean
  subtitleProgressText: string
  importStatus: {
    isImporting: boolean
    current: number
    total: number
    currentFileName: string
  } | null
  assistantMode: AssistantMode
  setAssistantMode: (mode: AssistantMode) => void
  toggleAssistant: () => void
  selectClip: (id: string) => void
  selectMedia: (id: string) => void
  setPlayhead: (time: number) => void
  setPlaying: (playing: boolean) => void
  setZoom: (zoom: number) => void
  setSequence: (sequence: SequenceSettings) => void
  updateClip: (id: string, patch: Partial<Clip>) => void
  splitClip: (id: string, at: number) => void
  deleteClip: (id: string) => void
  duplicateClip: (id: string) => void
  freezeFrame: (id: string, at: number) => string | null
  addTrack: (kind: 'video' | 'audio') => void
  addMediaToTimeline: (asset: MediaItem, at?: number, trackId?: string) => string | null
  moveClip: (id: string, start: number, duration?: number) => void
  moveClipToNewTrack: (clipId: string) => void
  ripplePackTrack: () => number
  autoSceneMarkers: () => number
  autoAudioBalance: () => number
  addMarker: (time: number) => void
  removeMarker: (markerId: string) => void
  toggleSnap: () => void
  toggleTimelineExpanded: () => void
  setActiveTool: (tool: 'select' | 'razor') => void
  toggleMute: (trackId: string) => void
  toggleLock: (trackId: string) => void
  addAdjustmentLayer: (at: number) => void
  addTextClip: (options: { presetId: string; text?: string; at: number }) => void
  calibrateAllSubtitles: (clipId: string) => number
  nudgeAllSubtitlesTime: (delta: number) => number
  handleClearSubtitles: () => void
  handleGenerateVideoSubtitles: (presetId?: string, script?: string, language?: SubtitleLanguage) => Promise<void>
  handleApplyOrExtractSubtitlePreset: (presetId: string, language?: SubtitleLanguage) => void
  updateAsset: (id: string, patch: Partial<MediaItem>) => void
  deleteMedia: (id: string) => void
  relinkMedia: (id: string, file: File) => Promise<void>
  copyClipName: (name: string) => Promise<void>
  togglePlayback: () => void
  onImportClick: () => void
  onImportFiles: (files: FileList | File[] | null) => void
  projectName: string
  assistantPanelRef: ReturnType<typeof usePanelRef>
  appWorkspaceGroupRef: ReturnType<typeof useGroupRef>
  mainVerticalGroupRef: ReturnType<typeof useGroupRef>
  upperGroupRef: ReturnType<typeof useGroupRef>
  appWorkspaceLayout: ReturnType<typeof useDefaultLayout>
  verticalLayout: ReturnType<typeof useDefaultLayout>
  upperLayout: ReturnType<typeof useDefaultLayout>
  setChatOpen: (open: boolean) => void
}

export function EditorWorkspace({
  tracks,
  assets,
  markers,
  selectedClipId,
  selectedMediaId,
  playhead,
  playing,
  zoom,
  frameRate,
  snapToFrames,
  activeTool,
  sequence,
  effectiveDuration,
  mutedTracks,
  lockedTracks,
  previewClip,
  selectedClip,
  selectedMedia,
  selectedClipReadOnly,
  activeVisualClips,
  activeAdjustmentLayers,
  activeTextOverlays,
  timelineExpanded,
  extractingSubtitles,
  subtitleProgressText,
  importStatus,
  assistantMode,
  setAssistantMode,
  toggleAssistant,
  selectClip,
  selectMedia,
  setPlayhead,
  setPlaying,
  setZoom,
  setSequence,
  updateClip,
  splitClip,
  deleteClip,
  duplicateClip,
  freezeFrame,
  addTrack,
  addMediaToTimeline,
  moveClip,
  moveClipToNewTrack,
  ripplePackTrack,
  autoSceneMarkers,
  autoAudioBalance,
  addMarker,
  removeMarker,
  toggleSnap,
  toggleTimelineExpanded,
  setActiveTool,
  toggleMute,
  toggleLock,
  addAdjustmentLayer,
  addTextClip,
  calibrateAllSubtitles,
  nudgeAllSubtitlesTime,
  handleClearSubtitles,
  handleGenerateVideoSubtitles,
  handleApplyOrExtractSubtitlePreset,
  updateAsset,
  deleteMedia,
  relinkMedia,
  copyClipName,
  togglePlayback,
  onImportClick,
  onImportFiles,
  projectName,
  assistantPanelRef,
  appWorkspaceGroupRef,
  mainVerticalGroupRef,
  upperGroupRef,
  appWorkspaceLayout,
  verticalLayout,
  upperLayout,
  setChatOpen,
}: EditorWorkspaceProps) {
  const isPreviewClipMuted = previewClip
    ? mutedTracks.some((id) => tracks.find((tr) => tr.id === id)?.clips.some((c) => c.id === previewClip.id))
    : false
  const previewClipVolume =
    previewClip?.volume !== undefined ? Math.max(0, Math.min(1.5, previewClip.volume / 100)) : 1

  return (
    <Group
      id="sparta-app-workspace"
      groupRef={appWorkspaceGroupRef}
      className="workspace"
      orientation="horizontal"
      defaultLayout={appWorkspaceLayout.defaultLayout ?? { editor: 100, assistant: 0 }}
      onLayoutChanged={(layout, meta) => {
        appWorkspaceLayout.onLayoutChanged(layout, meta)
        setChatOpen((layout.assistant ?? 0) > 0)
      }}
      resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}
    >
      <Panel id="editor" defaultSize="100%" minSize="60%" className="editor-workspace-panel">
        <Group
          id="sparta-main-vertical"
          groupRef={mainVerticalGroupRef}
          className="editor-vertical-group"
          orientation="vertical"
          defaultLayout={verticalLayout.defaultLayout ?? { stage: 58, timeline: 42 }}
          onLayoutChanged={verticalLayout.onLayoutChanged}
          resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}
        >
          <Panel id="stage" defaultSize="58%" minSize="30%" maxSize="68%" className="bg-transparent overflow-hidden h-full">
            <div className="upper-workspace">
              <Group
                id="sparta-upper-workspace"
                groupRef={upperGroupRef}
                className="preview-inspector-group"
                orientation="horizontal"
                defaultLayout={upperLayout.defaultLayout ?? { library: 23, monitor: 52, inspector: 25 }}
                onLayoutChanged={upperLayout.onLayoutChanged}
                resizeTargetMinimumSize={{ fine: 6, coarse: 10 }}
              >
                <Panel id="library" defaultSize="23%" minSize="240px" maxSize="38%" className="resize-panel-content">
                  <MediaLibraryPanel
                    assets={assets}
                    selectedMedia={selectedMediaId}
                    isExtractingSubtitles={extractingSubtitles}
                    subtitleProgressText={subtitleProgressText}
                    importStatus={importStatus}
                    onSelect={(asset) => selectMedia(asset.id)}
                    onAdd={(asset) => addMediaToTimeline(asset)}
                    onAddTextClip={(presetId, text) => {
                      addTextClip({ presetId, text, at: playhead })
                      toast.success(t('Titular insertado en el cabezal', 'Title inserted at playhead'))
                    }}
                    onAutoSubtitles={(presetId, script, language) => {
                      void handleGenerateVideoSubtitles(presetId, script, language)
                    }}
                    onApplySubtitlePreset={(presetId, language) => {
                      handleApplyOrExtractSubtitlePreset(presetId, language)
                    }}
                    onClearSubtitles={handleClearSubtitles}
                    onRename={(assetId, name) => updateAsset(assetId, { title: name })}
                    onDelete={(assetId) => void deleteMedia(assetId)}
                    onRelink={(assetId, file) => void relinkMedia(assetId, file)}
                    onImport={onImportClick}
                    onImportFiles={onImportFiles}
                  />
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
                    selectedClipId={selectedClipId ?? undefined}
                    onSelectClip={selectClip}
                    onUpdateClip={updateClip}
                    media={!previewClip ? (selectedMedia ?? undefined) : undefined}
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
                </Panel>
                <Separator
                  id="monitor-splitter"
                  className="panel-separator"
                  aria-label={t('Redimensionar monitor e inspector', 'Resize preview and inspector')}
                />
                <Panel id="inspector" defaultSize="25%" minSize="220px" maxSize="40%" className="resize-panel-content">
                  <InspectorPanel
                    clip={selectedClip ?? previewClip}
                    selectedMedia={selectedMedia}
                    assets={assets}
                    playhead={playhead}
                    sequenceSize={sequence}
                    onSeek={setPlayhead}
                    readOnly={selectedClipReadOnly}
                    onAddSelected={() => {
                      if (selectedMedia) addMediaToTimeline(selectedMedia, playhead)
                    }}
                    onAddTextClip={(presetId) => {
                      addTextClip({ presetId: presetId ?? 'cine-title-bold', at: playhead })
                      toast.success(t('Capa de texto añadida', 'Text layer added'))
                    }}
                    onUpdateClip={updateClip}
                    onCopyClipName={(name) => void copyClipName(name)}
                    onSplitAtPlayhead={() => {
                      if (selectedClip && !selectedClipReadOnly) splitClip(selectedClip.id, playhead)
                    }}
                    onDuplicateClip={() => {
                      if (selectedClip && !selectedClipReadOnly) {
                        duplicateClip(selectedClip.id)
                        toast.success(t('Clip duplicado', 'Clip duplicated'))
                      }
                    }}
                    onFreezeFrame={(id, time) => {
                      const fId = freezeFrame(id, time)
                      if (fId) toast.success(t('Fotograma congelado insertado', 'Frozen frame inserted'))
                    }}
                    onCalibrateAllSubtitles={(id) => {
                      const n = calibrateAllSubtitles(id)
                      if (n > 0) toast.success(t(`Calibración aplicada a ${n} subtítulos`, `Calibration applied to ${n} subtitles`))
                    }}
                    onNudgeAllSubtitlesTime={(delta) => {
                      const n = nudgeAllSubtitlesTime(delta)
                      if (n > 0) {
                        toast.success(
                          t(
                            `Sincronización ${delta > 0 ? '+' : ''}${delta}s en ${n} subtítulos`,
                            `Sync ${delta > 0 ? '+' : ''}${delta}s on ${n} subtitles`,
                          ),
                        )
                      }
                    }}
                    onResetClip={() => {
                      if (selectedClip && !selectedClipReadOnly) {
                        updateClip(selectedClip.id, {
                          transform: {
                            x: sequence.width / 2,
                            y: sequence.height / 2,
                            scaleX: 100,
                            scaleY: 100,
                            rotation: 0,
                          },
                          opacity: 100,
                          blendMode: 'normal',
                          volume: 100,
                          fadeIn: 0,
                          fadeOut: 0,
                          uniformScale: true,
                          keyframes: [],
                        })
                      }
                    }}
                  />
                </Panel>
              </Group>
            </div>
          </Panel>
          <Separator
            id="stage-timeline-splitter"
            className="panel-separator panel-separator-horizontal"
            aria-label={t('Redimensionar monitor y línea de tiempo', 'Resize monitor and timeline')}
          />
          <Panel id="timeline" defaultSize="42%" minSize="32%" className="resize-panel-content">
            <TimelinePanel
              tracks={tracks}
              assets={assets}
              markers={markers}
              selected={selectedClipId ?? ''}
              playhead={playhead}
              zoom={zoom}
              frameRate={frameRate}
              snap={snapToFrames}
              expanded={timelineExpanded}
              tool={activeTool}
              mutedTracks={mutedTracks}
              lockedTracks={lockedTracks}
              onMuteTrack={toggleMute}
              onLockTrack={toggleLock}
              onSelect={selectClip}
              onSeek={setPlayhead}
              onZoom={setZoom}
              onAddTrack={addTrack}
              onAddMedia={addMediaToTimeline}
              onMoveClip={moveClip}
              onMoveClipToNewTrack={moveClipToNewTrack}
              onSplitClip={splitClip}
              onDeleteClip={deleteClip}
              onDuplicateClip={(id) => {
                duplicateClip(id)
                toast.success(t('Clip duplicado', 'Clip duplicated'))
              }}
              onFreezeFrame={(id, time) => {
                const fId = freezeFrame(id, time)
                if (fId) toast.success(t('Fotograma congelado insertado', 'Frozen frame inserted'))
              }}
              onAddTextClip={() => {
                addTextClip({ presetId: 'hormozi-karaoke', at: playhead })
                toast.success(t('Texto animado añadido en el cabezal', 'Animated text added at playhead'))
              }}
              onAddAdjustmentLayer={() => {
                addAdjustmentLayer(playhead)
                toast.success(t('Capa FX añadida en el cabezal', 'FX Layer added at playhead'))
              }}
              onAutoSubtitles={() => {
                void handleGenerateVideoSubtitles('hormozi-karaoke')
              }}
              onClearSubtitles={handleClearSubtitles}
              onPackClips={() => {
                const n = ripplePackTrack()
                if (n > 0) toast.success(t(`${n} clip(s) compactados sin huecos`, `${n} clip(s) packed without gaps`))
                else toast.info(t('No hay huecos que compactar', 'No gaps to pack'))
              }}
              onAutoMarkers={() => {
                const n = autoSceneMarkers()
                if (n > 0) toast.success(t(`${n} marcador(es) añadidos en cortes`, `${n} marker(s) added at cuts`))
                else toast.info(t('Ya existen marcadores en los cortes', 'There are already markers at the cuts'))
              }}
              onAutoAudio={() => {
                const n = autoAudioBalance()
                if (n > 0) toast.success(t(`Mezcla y fundidos aplicados a ${n} clip(s)`, `Mix and fades applied to ${n} clip(s)`))
                else toast.info(t('Añade clips para nivelar audio', 'Add clips to balance audio'))
              }}
              onAddMarker={addMarker}
              onRemoveMarker={removeMarker}
              onToggleSnap={toggleSnap}
              onToggleExpanded={toggleTimelineExpanded}
              onSetTool={setActiveTool}
              onImportFiles={onImportFiles}
              onApplyTransition={(clipId, transition: TransitionRef) => {
                const clip = tracks.flatMap((tr) => tr.clips).find((item) => item.id === clipId)
                if (!clip) return
                updateClip(clipId, { transitionIn: transition })
                selectClip(clipId)
                setPlaying(false)
                setPlayhead(clip.start + Math.min(transition.duration * 0.25, clip.duration / 2))
                toast.success(t('Transición asignada y previsualizada en el corte', 'Transition applied and previewed at the cut'))
              }}
            />
          </Panel>
        </Group>
      </Panel>
      <Separator
        id="assistant-separator"
        className="panel-separator"
        aria-label={t('Redimensionar panel del asistente', 'Resize assistant panel')}
      />
      <Panel
        id="assistant"
        panelRef={assistantPanelRef}
        defaultSize="24%"
        minSize="260px"
        maxSize="40%"
        collapsedSize="0%"
        collapsible
        className="resize-panel-content assistant-workspace-panel"
      >
        <AssistantPanel
          open
          onClose={toggleAssistant}
          projectName={projectName}
          activeMode={assistantMode}
          onModeChange={setAssistantMode}
        />
      </Panel>
    </Group>
  )
}
