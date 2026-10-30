import { useEffect, useRef, useState } from 'react'
import { AudioLines, Bookmark, Eye, Film, LockKeyhole, Magnet, MousePointer2, Plus, Scan, Scissors, Search, Snowflake, Sparkles, Trash2, Type, Video, Volume2, VolumeX } from 'lucide-react'
import type { Clip, MediaItem, TimelineMarker, Track } from '../model'
import { formatRulerTime, formatTimecode } from '../timecode'
import { t } from '../services/locale'
import { cn } from '../../../lib/utils'

type Props = {
  tracks: Track[]; assets: MediaItem[]; markers: TimelineMarker[]; selected: string; playhead: number; zoom: number; frameRate: number; snap: boolean; expanded: boolean; tool: 'select' | 'razor'
  onSelect: (id: string) => void; onSeek: (time: number) => void; onZoom: (zoom: number) => void
  mutedTracks: string[]; lockedTracks: string[]; onMuteTrack: (id: string) => void; onLockTrack: (id: string) => void
  onAddTrack?: (kind: 'video' | 'audio') => void; onAddMedia: (item: MediaItem, at: number, trackId?: string) => void
  onMoveClip: (clipId: string, start: number, duration?: number) => void; onMoveClipToNewTrack: (clipId: string) => void; onSplitClip: (clipId: string, time: number) => void
  onDeleteClip?: (clipId: string) => void; onDuplicateClip?: (clipId: string) => void
  onFreezeFrame?: (clipId: string, time: number) => void
  onAddTextClip?: () => void; onAddAdjustmentLayer?: () => void; onAutoSubtitles?: () => void; onClearSubtitles?: () => void
  onPackClips?: () => void; onAutoMarkers?: () => void; onAutoAudio?: () => void
  onAddMarker: (time: number) => void; onRemoveMarker: (id: string) => void; onToggleSnap: () => void; onToggleExpanded?: () => void; onSetTool: (tool: 'select' | 'razor') => void
  onImportFiles?: (files: FileList | File[]) => void
}
type Gesture = { id: string; startX: number; originalStart: number; originalDuration: number; mode: 'move' | 'trim-left' | 'trim-right' }
type GestureFeedback = { id: string; mode: Gesture['mode']; start: number; duration: number; originalStart: number; originalDuration: number }
type SnapFeedback = { time: number; target: string }

export function TimelinePanel({ tracks, assets, markers, selected, playhead, zoom, frameRate, snap, expanded, tool, mutedTracks, lockedTracks, onSelect, onSeek, onZoom, onMuteTrack, onLockTrack, onAddTrack: _onAddTrack, onAddMedia, onMoveClip, onMoveClipToNewTrack, onSplitClip, onDeleteClip, onDuplicateClip: _onDuplicateClip, onFreezeFrame: _onFreezeFrame, onAddTextClip, onAddAdjustmentLayer, onAutoSubtitles: _onAutoSubtitles, onClearSubtitles: _onClearSubtitles, onPackClips: _onPackClips, onAutoMarkers: _onAutoMarkers, onAutoAudio: _onAutoAudio, onAddMarker, onRemoveMarker, onToggleSnap, onToggleExpanded: _onToggleExpanded, onSetTool, onImportFiles }: Props) {
  const scale = 31 * zoom
  const sequenceDuration = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)), ...markers.map((marker) => marker.time))
  const rulerDuration = Math.max(10, sequenceDuration + 2)
  const rulerTickCount = Math.ceil(rulerDuration) + 1
  const rulerStep = getRulerStep(scale)
  const rulerMarks = Array.from({ length: Math.ceil(rulerDuration / rulerStep) + 1 }, (_, index) => index * rulerStep)
  const timelineRef = useRef<HTMLDivElement>(null)
  const trackControlsRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLDivElement>(null)
  const scrubbingRef = useRef(false)
  const syncVerticalScroll = (source: 'tracks' | 'timeline') => {
    const sourceElement = source === 'tracks' ? trackControlsRef.current : timelineRef.current
    const targetElement = source === 'tracks' ? timelineRef.current : trackControlsRef.current
    if (sourceElement && targetElement && targetElement.scrollTop !== sourceElement.scrollTop) targetElement.scrollTop = sourceElement.scrollTop
  }
  const fitSequence = () => onZoom(Math.max(0.25, Math.min(2.4, (timelineRef.current?.clientWidth ?? 880) / (rulerTickCount * 31))))
  const gestureRef = useRef<Gesture | null>(null)
  const pendingRef = useRef<{ start: number; duration: number } | null>(null)
  const [waveforms] = useState(true)
  const [clipLabels] = useState(true)
  const [preview, setPreview] = useState<Record<string, { start: number; duration: number }>>({})
  const [gestureFeedback, setGestureFeedback] = useState<GestureFeedback | null>(null)
  const [snapFeedback, setSnapFeedback] = useState<SnapFeedback | null>(null)
  const [razorTime, setRazorTime] = useState<number | null>(null)
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null)
  const visibleTracks = tracks.filter((track) => {
    const isFxTrack = track.name.toLowerCase().includes('fx') || track.name.toLowerCase().includes('efecto') || track.name.toLowerCase().includes('ajuste')
    if (isFxTrack) {
      return track.clips.length > 0
    }
    return true
  })
  const laneLayouts = new Map(tracks.map((track) => {
    const rows = new Map<string, number>()
    const rowEnds: number[] = []
    for (const clip of [...track.clips].sort((a, b) => a.start - b.start)) {
      let row = rowEnds.findIndex((end) => end <= clip.start)
      if (row < 0) row = rowEnds.length
      rows.set(clip.id, row)
      rowEnds[row] = clip.start + clip.duration
    }
    const rowHeight = 42
    return [track.id, { rows, height: Math.max(track.kind === 'audio' ? rowHeight + 3 : rowHeight + 6, rowEnds.length * rowHeight + 6), rowHeight }] as const
  }))
  const overlapIds = new Set<string>()
  tracks.forEach((track) => track.clips.forEach((clip, index) => {
    if (track.clips.some((other, otherIndex) => otherIndex !== index && clip.start < other.start + other.duration && clip.start + clip.duration > other.start)) overlapIds.add(clip.id)
  }))
  const beginGesture = (event: React.PointerEvent, clip: Clip, mode: Gesture['mode']) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); onSelect(clip.id)
    try {
      (event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId)
    } catch { /* ignore */ }
    gestureRef.current = { id: clip.id, startX: event.clientX, originalStart: clip.start, originalDuration: clip.duration, mode }
    const move = (moveEvent: PointerEvent) => {
      const active = gestureRef.current
      if (!active) return
      const delta = (moveEvent.clientX - active.startX) / scale
      let nextStart = active.originalStart
      let nextDuration = active.originalDuration
      if (active.mode === 'move') nextStart = Math.max(0, active.originalStart + delta)
      if (active.mode === 'trim-left') {
        const boundedDelta = Math.min(active.originalDuration - 1 / frameRate, Math.max(-active.originalStart, delta))
        nextStart = active.originalStart + boundedDelta
        nextDuration = active.originalDuration - boundedDelta
      }
      if (active.mode === 'trim-right') nextDuration = Math.max(1 / frameRate, active.originalDuration + delta)
      let closestTarget: SnapFeedback | null = null
      if (snap) {
        nextStart = Math.round(nextStart * frameRate) / frameRate
        if (active.mode !== 'move') nextDuration = Math.max(1 / frameRate, Math.round(nextDuration * frameRate) / frameRate)
        const candidates: { time: number; target: string }[] = [{ time: playhead, target: 'Cabezal' }, ...markers.map((marker) => ({ time: marker.time, target: `Marcador: ${marker.label}` })), ...tracks.flatMap((track) => track.clips.filter((other) => other.id !== active.id).flatMap((other) => [{ time: other.start, target: `Inicio: ${other.title}` }, { time: other.start + other.duration, target: `Final: ${other.title}` }]))]
        const movingPoints = active.mode === 'move' ? [{ time: nextStart, edge: 'start' as const }, { time: nextStart + nextDuration, edge: 'end' as const }] : [{ time: active.mode === 'trim-right' ? nextStart + nextDuration : nextStart, edge: active.mode === 'trim-right' ? 'end' as const : 'start' as const }]
        const match = candidates.flatMap((target) => movingPoints.map((movingPoint) => ({ target, edge: movingPoint.edge, distance: Math.abs(target.time - movingPoint.time) * scale }))).reduce<{ target: { time: number; target: string } | null; edge: 'start' | 'end'; distance: number }>((best, current) => current.distance <= 8 && current.distance < best.distance ? { target: current.target, edge: current.edge, distance: current.distance } : best, { target: null, edge: 'start', distance: Number.POSITIVE_INFINITY })
        if (match.target) {
          const targetTime = Math.max(0, Math.round(match.target.time * frameRate) / frameRate)
          closestTarget = { time: targetTime, target: match.target.target }
          if (active.mode === 'trim-right') nextDuration = Math.max(1 / frameRate, targetTime - nextStart)
          else if (active.mode === 'trim-left') { nextDuration = Math.max(1 / frameRate, active.originalStart + active.originalDuration - targetTime); nextStart = active.originalStart + active.originalDuration - nextDuration }
          else nextStart = Math.max(0, match.edge === 'end' ? targetTime - nextDuration : targetTime)
        }
      }
      pendingRef.current = { start: nextStart, duration: nextDuration }
      setSnapFeedback(closestTarget)
      setGestureFeedback({ id: active.id, mode: active.mode, start: nextStart, duration: nextDuration, originalStart: active.originalStart, originalDuration: active.originalDuration })
      setPreview((current) => ({ ...current, [active.id]: { start: nextStart, duration: nextDuration } }))
    }
    const end = (upEvent?: PointerEvent) => {
      if (upEvent) {
        try {
          (upEvent.target as HTMLElement)?.releasePointerCapture?.(upEvent.pointerId)
        } catch { /* ignore */ }
      }
      const active = gestureRef.current
      const pending = pendingRef.current
      if (active && pending) onMoveClip(active.id, pending.start, pending.duration)
      if (active) setPreview((current) => { const next = { ...current }; delete next[active.id]; return next })
      setGestureFeedback(null); setSnapFeedback(null)
      gestureRef.current = null; pendingRef.current = null
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }); window.addEventListener('pointercancel', end, { once: true })
  }
  const seekFromClientX = (clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return
    const time = Math.max(0, (clientX - rect.left + (timelineRef.current?.scrollLeft ?? 0)) / scale)
    onSeek(snap ? Math.round(time * frameRate) / frameRate : time)
  }
  const [trackHeaderWidth, setTrackHeaderWidth] = useState(180)
  const resizingTrackHeaderRef = useRef(false)
  const trackHeaderStartRef = useRef({ x: 0, width: 180 })
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (scrubbingRef.current) seekFromClientX(event.clientX)
      if (resizingTrackHeaderRef.current) {
        const delta = event.clientX - trackHeaderStartRef.current.x
        setTrackHeaderWidth(Math.max(140, Math.min(280, trackHeaderStartRef.current.width + delta)))
      }
    }
    const end = () => {
      scrubbingRef.current = false
      resizingTrackHeaderRef.current = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
  })
  return <section className={`timeline-panel ${expanded ? 'timeline-expanded' : ''} flex flex-col h-full bg-card overflow-hidden select-none`}>
    <div className="flex items-center justify-between px-3 h-9 bg-card border-b border-border select-none shrink-0">
      {/* Sequence Tabs */}
      <div className="flex items-center gap-1 h-full">
        <button type="button" className="h-full px-3 text-xs font-semibold text-foreground border-b-2 border-primary cursor-pointer flex items-center gap-1.5 select-none">
          <span className="sr-only">Sequence 01</span>
          <span>Core</span>
        </button>
        <button type="button" className="h-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer select-none">
          Secuencia 2
        </button>
        <button type="button" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer" title={t('Nueva secuencia', 'New sequence')}>
          <Plus size={14} />
        </button>
      </div>

      {/* Tools Cluster */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSetTool('select')}
          className={cn(
            'w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors cursor-pointer border-0',
            tool === 'select'
              ? 'bg-primary/18 text-primary font-medium shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-input'
          )}
          title={t('Selección (V)', 'Selection (V)')}
        >
          <MousePointer2 size={14} />
        </button>
        <button
          type="button"
          onClick={() => onSetTool(tool === 'razor' ? 'select' : 'razor')}
          aria-label={t('Cortar (Razor)', 'Razor tool')}
          className={cn(
            'w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors cursor-pointer border-0',
            tool === 'razor'
              ? 'bg-primary/18 text-primary font-medium shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-input'
          )}
          title={t('Corte / Cuchilla (C)', 'Razor cut (C)')}
        >
          <Scissors size={14} />
        </button>
        <button
          type="button"
          className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-input border-0 transition-colors cursor-pointer"
          title={t('Recortar / Deslizar', 'Trim / Slip')}
        >
          <Scan size={14} />
        </button>

        {/* Snap Button */}
        <button
          type="button"
          onClick={onToggleSnap}
          className={cn(
            'w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors cursor-pointer border-0',
            snap
              ? 'bg-primary/18 text-primary font-medium shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-input'
          )}
          title={t('Ajuste magnético (Snap)', 'Snap (S)')}
          aria-label={t('Ajuste magnético (Snap)', 'Snap (S)')}
        >
          <Magnet size={14} />
        </button>

        {onAddTextClip && (
          <button
            type="button"
            onClick={onAddTextClip}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-input border-0 transition-colors cursor-pointer"
            title={t('Insertar texto (T)', 'Insert text (T)')}
          >
            <Type size={14} />
          </button>
        )}
        {onAddAdjustmentLayer && (
          <button
            type="button"
            onClick={onAddAdjustmentLayer}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:text-[#a99cff] hover:bg-input border-0 transition-colors cursor-pointer"
            title={t('Insertar capa FX', 'Insert FX adjustment layer')}
          >
            <Sparkles size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onAddMarker(playhead)}
          className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-input border-0 transition-colors cursor-pointer"
          title={t('Añadir marcador (M)', 'Add marker (M)')}
        >
          <Bookmark size={14} />
        </button>
        {onDeleteClip && (
          <button
            type="button"
            onClick={() => { if (selected) onDeleteClip(selected) }}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-input border-0 transition-colors cursor-pointer"
            title={t('Eliminar clip seleccionado (Supr)', 'Delete selected clip (Del)')}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Zoom Cluster */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Search size={13} className="text-muted-foreground" />
        <input
          aria-label={t('Zoom de la línea de tiempo', 'Timeline zoom')}
          type="range"
          min="0.25"
          max="2.4"
          step="0.05"
          value={zoom}
          onChange={(event) => onZoom(Number(event.target.value))}
          className="w-20 h-1 accent-primary cursor-pointer"
        />
        <span className="text-[11px] font-mono tabular-nums text-muted-foreground w-8 text-right">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
    <div className="timeline-body">
      <div className="track-controls" ref={trackControlsRef} onScroll={() => syncVerticalScroll('tracks')} style={{ width: `${trackHeaderWidth}px` }}>
        <div className="ruler-spacer" style={{ width: `${trackHeaderWidth}px` }}><span aria-hidden="true">{t('PISTAS', 'TRACKS')}</span></div>
        {visibleTracks.map((track) => (
          <div
            className={cn(
              'flex items-center justify-between px-2.5 bg-card border-b border-border/80 border-r border-border text-xs text-foreground font-medium select-none',
              lockedTracks.includes(track.id) && 'opacity-60 bg-muted',
              mutedTracks.includes(track.id) && 'text-muted-foreground'
            )}
            style={{ height: `${laneLayouts.get(track.id)?.height ?? 48}px` }}
            key={track.id}
          >
            <div className="flex items-center gap-2 truncate">
              {track.kind === 'audio' ? (
                <AudioLines size={14} className="text-[#3fae68] shrink-0" />
              ) : track.name.toLowerCase().includes('text') || track.name.toLowerCase().includes('subtítulo') ? (
                <Type size={14} className="text-[#c0558f] shrink-0" />
              ) : track.name.toLowerCase().includes('fx') || track.name.toLowerCase().includes('efecto') ? (
                <Sparkles size={14} className="text-[#6c5ce0] shrink-0" />
              ) : (
                <Video size={14} className="text-[#3b6fd4] shrink-0" />
              )}
              <span className="truncate text-xs" title={track.name}>{track.name}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
              <button
                type="button"
                className={cn('w-6 h-6 flex items-center justify-center rounded hover:text-foreground hover:bg-input border-0 transition-colors cursor-pointer', lockedTracks.includes(track.id) && 'text-amber-400')}
                aria-label={lockedTracks.includes(track.id) ? `Unlock ${track.name}` : `Lock ${track.name}`}
                title={lockedTracks.includes(track.id) ? t('Desbloquear pista', 'Unlock track') : t('Bloquear pista', 'Lock track')}
                onClick={() => onLockTrack(track.id)}
              >
                <LockKeyhole size={13} />
              </button>
              <button
                type="button"
                className="w-6 h-6 flex items-center justify-center rounded hover:text-foreground hover:bg-input border-0 transition-colors cursor-pointer"
                title={t('Visibilidad de pista', 'Track visibility')}
              >
                <Eye size={13} />
              </button>
              <button
                type="button"
                className={cn('w-6 h-6 flex items-center justify-center rounded hover:text-foreground hover:bg-input border-0 transition-colors cursor-pointer', mutedTracks.includes(track.id) && 'text-destructive')}
                aria-label={mutedTracks.includes(track.id) ? `Unmute ${track.name}` : `Mute ${track.name}`}
                title={mutedTracks.includes(track.id) ? t('Activar sonido', 'Unmute') : t('Silenciar', 'Mute')}
                onClick={() => onMuteTrack(track.id)}
              >
                {mutedTracks.includes(track.id) ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="track-controls-resizer" onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); resizingTrackHeaderRef.current = true; trackHeaderStartRef.current = { x: event.clientX, width: trackHeaderWidth } }} title={t('Arrastra para calibrar ancho de pistas', 'Drag to resize track headers')} />
      <div className="timeline-scroll" ref={timelineRef} onScroll={() => syncVerticalScroll('timeline')} onWheel={(event) => { if (!event.ctrlKey) return; event.preventDefault(); const rect = timelineRef.current?.getBoundingClientRect(); if (!rect) return; const anchor = event.clientX - rect.left; const nextZoom = Math.max(0.25, Math.min(2.4, zoom * (event.deltaY < 0 ? 1.1 : 0.9))); onZoom(nextZoom); requestAnimationFrame(() => { if (timelineRef.current) timelineRef.current.scrollLeft = (timelineRef.current.scrollLeft + anchor) * nextZoom / zoom - anchor }) }} onKeyDown={(event) => { if (event.key === '\\') { event.preventDefault(); fitSequence(); return } if (event.key === '[' || event.key === ']') { const sorted = [...markers].sort((a, b) => a.time - b.time); if (!sorted.length) return; const index = sorted.findIndex((marker) => marker.id === activeMarkerId); const next = event.key === ']' ? sorted[(index + 1) % sorted.length] : sorted[(index <= 0 ? sorted.length : index) - 1]; event.preventDefault(); setActiveMarkerId(next.id); onSeek(next.time) } if (event.key === 'Escape') setActiveMarkerId(null) }} role="region" aria-label={t('Pistas de la línea de tiempo', 'Timeline tracks')} tabIndex={0}>
        <div
          className="timeline-canvas"
          style={{ width: `${Math.max(880, scale * rulerTickCount)}px`, backgroundSize: `${scale}px 100%` }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDragEnter={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(event) => {
            event.preventDefault()
            if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
              onImportFiles?.(event.dataTransfer.files)
              return
            }
            const id = event.dataTransfer.getData('application/sparta-media') || event.dataTransfer.getData('text/plain')
            const item = assets.find((asset) => asset.id === id)
            if (item) {
              const rect = timelineRef.current?.getBoundingClientRect()
              if (!rect) return
              const lane = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-track-id]') : null
              onAddMedia(item, Math.max(0, (event.clientX - rect.left + timelineRef.current!.scrollLeft) / scale), lane?.dataset.trackId)
            }
          }}
        >
          <div className="ruler" ref={rulerRef} onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); scrubbingRef.current = true; seekFromClientX(event.clientX) }}>{rulerMarks.map((time) => <div className="ruler-mark" key={time} style={{ left: `${time * scale}px` }}><span>{formatRulerTime(time)}</span><i /></div>)}</div>
          {markers.map((marker) => <button key={marker.id} className={`timeline-marker ${activeMarkerId === marker.id ? 'marker-active' : ''}`} style={{ left: `${marker.time * scale}px` }} title={`${marker.label} · ${formatTimecode(marker.time, frameRate)} · pulsa Supr para eliminar`} onClick={() => { setActiveMarkerId(marker.id); onSeek(marker.time) }} onKeyDown={(event) => { if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); setActiveMarkerId(null); onRemoveMarker(marker.id) } }} onContextMenu={(event) => { event.preventDefault(); setActiveMarkerId(null); onRemoveMarker(marker.id) }} aria-label={`${marker.label} en ${formatTimecode(marker.time, frameRate)}. Supr para eliminar`} />)}
          {markers.filter((marker) => marker.id === activeMarkerId).map((marker) => <div key={`popover-${marker.id}`} className="marker-popover" style={{ left: `${marker.time * scale}px` }}><strong>{marker.label}</strong><span>{formatTimecode(marker.time, frameRate)}</span><button type="button" onClick={() => { setActiveMarkerId(null); onRemoveMarker(marker.id) }}>{t('Eliminar', 'Delete')}</button></div>)}
          {visibleTracks.map((track) => (
            <div className={`track-lane ${track.kind} track-density-normal ${mutedTracks.includes(track.id) ? 'muted-lane' : ''} ${lockedTracks.includes(track.id) ? 'locked-lane' : ''}`} style={{ height: `${laneLayouts.get(track.id)?.height ?? 48}px`, backgroundSize: `${scale}px 100%` }} data-track-id={track.id} key={track.id}>
              {track.clips.map((clip) => {
                const position = preview[clip.id] ?? clip
                const isLocked = lockedTracks.includes(track.id)
                const pixelWidth = position.duration * scale
                const density = pixelWidth < 48 ? 'clip-tiny' : pixelWidth < 105 ? 'clip-compact' : 'clip-full'
                return (
                  <button key={clip.id} disabled={isLocked} className={`timeline-clip ${density} ${overlapIds.has(clip.id) ? 'overlap-warning' : ''} ${clip.color} ${selected === clip.id ? 'clip-selected' : ''} ${clip.kind === 'audio' ? 'audio-clip clip-kind-audio' : ''} ${clip.kind === 'adjustment' ? 'adjustment-clip clip-kind-fx' : ''} ${(clip.text !== undefined || clip.thumbnail === 'text-overlay') ? 'clip-kind-text' : ''} ${clip.kind === 'video' && !(clip.text !== undefined || clip.thumbnail === 'text-overlay') ? 'clip-kind-video' : ''} ${tool === 'razor' ? 'razor-cursor' : ''}`} style={{ left: `${position.start * scale}px`, width: `${pixelWidth}px`, top: `${5 + (laneLayouts.get(track.id)?.rows.get(clip.id) ?? 0) * (laneLayouts.get(track.id)?.rowHeight ?? 42)}px`, zIndex: selected === clip.id ? 3 : 1 }} onPointerMove={(event) => { if (tool === 'razor') { const rect = event.currentTarget.getBoundingClientRect(); setRazorTime(position.start + Math.max(0, Math.min(position.duration, (event.clientX - rect.left) / scale))) } }} onPointerLeave={() => setRazorTime(null)} onPointerDown={(event) => { if (tool === 'razor') { event.preventDefault(); event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const cutTime = position.start + Math.max(0, Math.min(position.duration, (event.clientX - rect.left) / scale)); onSplitClip(clip.id, cutTime); setRazorTime(null); return } beginGesture(event, clip, 'move') }} onClick={() => { if (tool === 'select') onSelect(clip.id) }} title={tool === 'razor' ? `${clip.title} · corte en ${formatTimecode(razorTime ?? position.start, frameRate)} · haz clic en el punto de corte` : `${clip.title} · arrastra para mover · ←/→ mueve · Alt + ←/→ recorta borde derecho · Ctrl + Alt + ←/→ recorta borde izquierdo · Shift amplía el paso`} aria-label={`${clip.title}, inicio ${formatTimecode(position.start, frameRate)}, duración ${formatTimecode(position.duration, frameRate)}. Flechas para mover; Alt más flechas recorta el borde derecho; Ctrl más Alt recorta el izquierdo`}>
                    <span className={`clip-art ${clip.thumbnail}`} />
                    {clip.kind === 'video' && !(clip.text !== undefined || clip.thumbnail === 'text-overlay') && <div className="video-filmstrip-strip" />}
                    {clip.transitionIn && <div className="timeline-transition-badge" title={`Transición: ${clip.transitionIn.effectId}`}>◪</div>}
                    {clip.kind === 'audio' && waveforms && <span className="waveform">{Array.from({ length: 92 }, (_, i) => <i key={i} style={{ height: `${15 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.27)) * 65}%` }} />)}</span>}
                    {clip.fadeIn ? <span className="clip-fade-in" style={{ width: `${Math.min(50, clip.fadeIn / Math.max(position.duration, 0.1) * 100)}%` }} /> : null}
                    {clip.fadeOut ? <span className="clip-fade-out" style={{ width: `${Math.min(50, clip.fadeOut / Math.max(position.duration, 0.1) * 100)}%` }} /> : null}
                    {clip.kind === 'audio' && <span className="clip-volume-line" style={{ bottom: `${Math.min(100, clip.volume ?? 100)}%` }} />}
                    {clip.keyframes?.map((keyframe) => <span key={`${keyframe.property}-${keyframe.time}`} className="clip-keyframe" style={{ left: `${Math.max(0, Math.min(100, (keyframe.time - position.start) / Math.max(position.duration, 0.01) * 100))}%` }} title={`${keyframe.property} · ${formatTimecode(keyframe.time, frameRate)}`} />)}
                    {clip.kind === 'adjustment' && clipLabels && pixelWidth >= 48 && (
                      <span className="clip-label adjustment-label">
                        <Sparkles size={11} />
                        <span className="fx-badge" style={{ background: '#7c3aed', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '1px 3px', borderRadius: '3px', marginRight: '3px' }}>FX</span>
                        <span>{clip.title}</span>
                        {clip.effects && clip.effects.length > 0 && <span className="effects-count-badge" style={{ background: 'rgba(255,255,255,0.2)', fontSize: '9px', padding: '1px 4px', borderRadius: '10px', marginLeft: '3px' }}>{clip.effects.length}</span>}
                        {pixelWidth >= 115 && <small>{formatTimecode(position.duration, frameRate)}</small>}
                      </span>
                    )}
                    {clip.kind === 'video' && clipLabels && pixelWidth >= 48 && (
                      <span className="clip-label video-clip-badge">
                        {clip.freezeTime !== undefined ? <Snowflake size={11} style={{ color: '#38bdf8' }} /> : clip.text !== undefined || clip.thumbnail === 'text-overlay' ? <Type size={11} className="text-[#c0558f]" /> : <Film size={11} className="text-[#3b6fd4]" />}
                        <span className="truncate">{clip.text ?? clip.title}</span>
                        {clip.speed && clip.speed !== 1.0 && pixelWidth >= 80 && (
                          <em className="clip-anim-tag" style={{ background: 'rgba(56, 189, 248, 0.25)', color: '#38bdf8' }}>{clip.speed}x</em>
                        )}
                        {clip.textAnimation?.in && clip.textAnimation.in !== 'none' && pixelWidth >= 85 && (
                          <em className="clip-anim-tag">{clip.textAnimation.in.toUpperCase()}</em>
                        )}
                        {pixelWidth >= 115 && <small>{formatTimecode(position.duration, frameRate)}</small>}
                      </span>
                    )}
                    {clip.kind === 'audio' && clipLabels && pixelWidth >= 60 && <span className="clip-label audio-clip-label"><AudioLines size={10} className="text-[#3fae68]" /><span>{clip.title}</span>{pixelWidth >= 120 && <small>{formatTimecode(position.duration, frameRate)}</small>}</span>}
                    {selected === clip.id && !isLocked && tool === 'select' && <><i className="trim-handle left" onPointerDown={(event) => beginGesture(event, clip, 'trim-left')} /><i className="trim-handle right" onPointerDown={(event) => beginGesture(event, clip, 'trim-right')} /></>}
                  </button>
                )
              })}
              {track.clips.filter((clip) => overlapIds.has(clip.id) && selected === clip.id && !lockedTracks.includes(track.id)).map((clip) => <button key={`move-${clip.id}`} className="overlap-move-button" style={{ left: `${Math.max(clip.start * scale, (clip.start + clip.duration) * scale - 100)}px`, top: `${7 + (laneLayouts.get(track.id)?.rows.get(clip.id) ?? 0) * (laneLayouts.get(track.id)?.rowHeight ?? 42)}px` }} onClick={() => onMoveClipToNewTrack(clip.id)}>{t('Mover a nueva pista', 'Move to new track')}</button>)}
            </div>
          ))}
          {snapFeedback && <div className="snap-guide" style={{ left: `${snapFeedback.time * scale}px` }} aria-hidden="true"><span>{snapFeedback.target} · {formatTimecode(snapFeedback.time, frameRate)}</span></div>}
          {gestureFeedback && <div className="gesture-feedback" style={{ left: `${(gestureFeedback.mode === 'trim-right' ? gestureFeedback.start + gestureFeedback.duration : gestureFeedback.start) * scale}px` }} role="status" aria-live="polite"><strong>{gestureFeedback.mode === 'move' ? t('Mover clip', 'Move clip') : t('Recortar clip', 'Trim clip')}</strong><span>{t('Inicio', 'Start')} {formatTimecode(gestureFeedback.start, frameRate)} · {t('duración', 'duration')} {formatTimecode(gestureFeedback.duration, frameRate)}</span><small>Δ {gestureFeedback.mode === 'move' ? (gestureFeedback.start >= gestureFeedback.originalStart ? '+' : '−') : (gestureFeedback.duration >= gestureFeedback.originalDuration ? '+' : '−')}{formatTimecode(Math.abs(gestureFeedback.mode === 'move' ? gestureFeedback.start - gestureFeedback.originalStart : gestureFeedback.duration - gestureFeedback.originalDuration), frameRate)}</small></div>}
          {tool === 'razor' && razorTime !== null && <div className="razor-guide" style={{ left: `${razorTime * scale}px` }}><span>{formatTimecode(razorTime, frameRate)}</span></div>}
          <div className="playhead" style={{ left: `${playhead * scale}px` }}><i /><span className="playhead-line" /><b className="playhead-time">{formatTimecode(playhead, frameRate)}</b></div>
        </div>
      </div>
    </div>
  </section>
}

function getRulerStep(pixelsPerSecond: number) {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  return steps.find((step) => step * pixelsPerSecond >= 64) ?? 600
}
