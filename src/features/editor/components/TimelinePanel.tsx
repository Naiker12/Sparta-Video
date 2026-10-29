import { useEffect, useRef, useState } from 'react'
import { AudioLines, Clock3, CopyPlus, Film, Gauge, LockKeyhole, Maximize2, MoreHorizontal, Plus, Scan, Scissors, Trash2, Type, Video, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react'
import type { Clip, MediaItem, TimelineMarker, Track } from '../model'
import { IconButton } from './controls'
import { ActionMenu } from './ActionMenu'
import { IconNleCaptions, IconNleTitleHook } from './StudioIcons'
import { formatRulerTime, formatTimecode } from '../timecode'
import { t } from '../services/locale'

type Props = {
  tracks: Track[]; assets: MediaItem[]; markers: TimelineMarker[]; selected: string; playhead: number; zoom: number; frameRate: number; snap: boolean; expanded: boolean; tool: 'select' | 'razor'
  onSelect: (id: string) => void; onSeek: (time: number) => void; onZoom: (zoom: number) => void
  mutedTracks: string[]; lockedTracks: string[]; onMuteTrack: (id: string) => void; onLockTrack: (id: string) => void
  onAddTrack: (kind: 'video' | 'audio') => void; onAddMedia: (item: MediaItem, at: number, trackId?: string) => void
  onMoveClip: (clipId: string, start: number, duration?: number) => void; onMoveClipToNewTrack: (clipId: string) => void; onSplitClip: (clipId: string, time: number) => void
  onDeleteClip?: (clipId: string) => void; onDuplicateClip?: (clipId: string) => void
  onAddTextClip?: () => void; onAutoSubtitles?: () => void; onClearSubtitles?: () => void
  onPackClips?: () => void; onAutoMarkers?: () => void; onAutoAudio?: () => void
  onAddMarker: (time: number) => void; onRemoveMarker: (id: string) => void; onToggleSnap: () => void; onToggleExpanded: () => void; onSetTool: (tool: 'select' | 'razor') => void
  onImportFiles?: (files: FileList | File[]) => void
}
type Gesture = { id: string; startX: number; originalStart: number; originalDuration: number; mode: 'move' | 'trim-left' | 'trim-right' }
type GestureFeedback = { id: string; mode: Gesture['mode']; start: number; duration: number; originalStart: number; originalDuration: number }
type SnapFeedback = { time: number; target: string }

export function TimelinePanel({ tracks, assets, markers, selected, playhead, zoom, frameRate, snap, expanded, tool, mutedTracks, lockedTracks, onSelect, onSeek, onZoom, onMuteTrack, onLockTrack, onAddTrack, onAddMedia, onMoveClip, onMoveClipToNewTrack, onSplitClip, onDeleteClip, onDuplicateClip, onAddTextClip, onAutoSubtitles, onClearSubtitles, onPackClips, onAutoMarkers, onAutoAudio, onAddMarker, onRemoveMarker, onToggleSnap, onToggleExpanded, onSetTool, onImportFiles }: Props) {
  const scale = 31 * zoom
  const sequenceDuration = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)), ...markers.map((marker) => marker.time))
  const selectedClipObj = tracks.flatMap((track) => track.clips).find((clip) => clip.id === selected)
  const selectedTrackLocked = !!selectedClipObj && tracks.some((track) => lockedTracks.includes(track.id) && track.clips.some((clip) => clip.id === selected))
  const canSplitSelectedAtPlayhead = !!selectedClipObj && !selectedTrackLocked && playhead > selectedClipObj.start + 1 / frameRate && playhead < selectedClipObj.start + selectedClipObj.duration - 1 / frameRate
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
  const [waveforms, setWaveforms] = useState(true)
  const [clipLabels, setClipLabels] = useState(true)
  const [trackDensity, setTrackDensity] = useState<'compact' | 'normal' | 'expanded'>('normal')
  const [preview, setPreview] = useState<Record<string, { start: number; duration: number }>>({})
  const [gestureFeedback, setGestureFeedback] = useState<GestureFeedback | null>(null)
  const [snapFeedback, setSnapFeedback] = useState<SnapFeedback | null>(null)
  const [razorTime, setRazorTime] = useState<number | null>(null)
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null)
  const laneLayouts = new Map(tracks.map((track) => {
    const rows = new Map<string, number>()
    const rowEnds: number[] = []
    for (const clip of [...track.clips].sort((a, b) => a.start - b.start)) {
      let row = rowEnds.findIndex((end) => end <= clip.start)
      if (row < 0) row = rowEnds.length
      rows.set(clip.id, row)
      rowEnds[row] = clip.start + clip.duration
    }
    const rowHeight = trackDensity === 'compact' ? 32 : trackDensity === 'expanded' ? 56 : 42
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
  const [trackHeaderWidth, setTrackHeaderWidth] = useState(148)
  const resizingTrackHeaderRef = useRef(false)
  const trackHeaderStartRef = useRef({ x: 0, width: 148 })
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (scrubbingRef.current) seekFromClientX(event.clientX)
      if (resizingTrackHeaderRef.current) {
        const delta = event.clientX - trackHeaderStartRef.current.x
        setTrackHeaderWidth(Math.max(90, Math.min(260, trackHeaderStartRef.current.width + delta)))
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
  return <section className={`timeline-panel ${expanded ? 'timeline-expanded' : ''}`}>
    <div className="timeline-top">
      <div className="timeline-heading">
        <span className="section-kicker">{t('LÍNEA DE TIEMPO', 'TIMELINE')}</span>
        <span className="timeline-divider" />
        <span className="sequence-selector">{t('Secuencia 01', 'Sequence 01')}</span>
      </div>
      <div className="timeline-actions">
        <ActionMenu
          label={t('Añadir pista', 'Add track')}
          items={[
            { label: t('Añadir pista de vídeo', 'Add video track'), icon: Video, onSelect: () => onAddTrack('video') },
            { label: t('Añadir pista de audio', 'Add audio track'), icon: AudioLines, onSelect: () => onAddTrack('audio') },
            ...(onAddTextClip ? [{ separator: true as const }, { label: t('Insertar capa de texto en cabezal', 'Insert text layer at playhead'), icon: Type, onSelect: onAddTextClip }] : []),
            ...(onAutoSubtitles ? [{ label: t('Generar subtítulos sincronizados', 'Generate synced subtitles'), icon: Type, onSelect: onAutoSubtitles }] : []),
          ]}
        >
          <Plus size={15} />
        </ActionMenu>
        <ActionMenu
          label={t('Opciones de la línea de tiempo', 'Timeline options')}
          items={[
            { heading: t('Visualización de la línea de tiempo', 'Timeline display') },
            { label: t('Mostrar formas de onda', 'Show waveforms'), checked: waveforms, onSelect: () => setWaveforms((value) => !value) },
            { label: t('Mostrar nombres de clips', 'Show clip names'), checked: clipLabels, onSelect: () => setClipLabels((value) => !value) },
            { label: t('Pistas compactas', 'Compact tracks'), checked: trackDensity === 'compact', onSelect: () => setTrackDensity('compact') },
            { label: t('Altura normal de pistas', 'Normal track height'), checked: trackDensity === 'normal', onSelect: () => setTrackDensity('normal') },
            { label: t('Pistas expandidas', 'Expanded tracks'), checked: trackDensity === 'expanded', onSelect: () => setTrackDensity('expanded') },
            ...(onPackClips || onAutoMarkers || onAutoAudio ? [{ separator: true as const }, { heading: t('Edición de secuencia', 'Sequence editing') }] : []),
            ...(onPackClips ? [{ label: t('Cerrar huecos en pista', 'Pack track gaps'), onSelect: onPackClips }] : []),
            ...(onAutoMarkers ? [{ label: t('Detectar cortes de escena', 'Detect scene cuts'), onSelect: onAutoMarkers }] : []),
            ...(onAutoAudio ? [{ label: t('Nivelar mezcla de audio', 'Balance audio mix'), onSelect: onAutoAudio }] : []),
            { separator: true },
            { label: t('Restablecer zoom', 'Reset zoom'), icon: ZoomOut, onSelect: () => onZoom(1) },
            { label: t('Encajar secuencia', 'Fit sequence'), icon: ZoomIn, onSelect: fitSequence },
          ]}
        >
          <MoreHorizontal size={16} />
        </ActionMenu>
        <span className="timeline-divider" />
        <IconButton label={t('Encajar secuencia', 'Fit sequence')} onClick={fitSequence}><Scan size={15} /></IconButton>
        <IconButton label={t('Alejar', 'Zoom out')} onClick={() => onZoom(Math.max(0.25, zoom - 0.15))}><ZoomOut size={15} /></IconButton>
        <input aria-label={t('Zoom de la línea de tiempo', 'Timeline zoom')} className="zoom-slider" type="range" min="0.25" max="2.4" step="0.05" value={zoom} onChange={(event) => onZoom(Number(event.target.value))} />
        <IconButton label={t('Acercar', 'Zoom in')} onClick={() => onZoom(Math.min(2.4, zoom + 0.15))}><ZoomIn size={15} /></IconButton>
        <span className="zoom-value">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
    <div className="timeline-body">
      <div className="track-controls" ref={trackControlsRef} onScroll={() => syncVerticalScroll('tracks')} style={{ width: `${trackHeaderWidth}px` }}>
        <div className="ruler-spacer" style={{ width: `${trackHeaderWidth}px` }}><span aria-hidden="true">{t('PISTAS', 'TRACKS')}</span></div>
        {tracks.map((track) => (
          <div className={`track-control ${track.kind} track-density-${trackDensity} ${lockedTracks.includes(track.id) ? 'locked-track' : ''} ${mutedTracks.includes(track.id) ? 'muted-track' : ''}`} style={{ height: `${laneLayouts.get(track.id)?.height ?? 48}px` }} key={track.id}>
            <div className="track-color"><span /></div>
            <span className="track-name" title={track.name}>{track.name}</span>
            <button aria-label={`${mutedTracks.includes(track.id) ? t('Activar sonido de', 'Unmute') : t('Silenciar', 'Mute')} ${track.name}`} aria-pressed={mutedTracks.includes(track.id)} className={mutedTracks.includes(track.id) ? 'track-action pressed' : 'track-action'} title={mutedTracks.includes(track.id) ? t('Silencio guardado; todavía no afecta el sonido', 'Mute state saved; audio is not affected yet') : t('Silenciar pista', 'Mute track')} onClick={() => onMuteTrack(track.id)}>
              {mutedTracks.includes(track.id) ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <button aria-label={`${lockedTracks.includes(track.id) ? t('Desbloquear', 'Unlock') : t('Bloquear', 'Lock')} ${track.name}`} aria-pressed={lockedTracks.includes(track.id)} className={lockedTracks.includes(track.id) ? 'track-action pressed' : 'track-action'} title={lockedTracks.includes(track.id) ? t('Desbloquear pista', 'Unlock track') : t('Bloquear pista', 'Lock track')} onClick={() => onLockTrack(track.id)}>
              <LockKeyhole size={12} />
            </button>
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
          {tracks.map((track) => (
            <div className={`track-lane ${track.kind} track-density-${trackDensity} ${mutedTracks.includes(track.id) ? 'muted-lane' : ''} ${lockedTracks.includes(track.id) ? 'locked-lane' : ''}`} style={{ height: `${laneLayouts.get(track.id)?.height ?? 48}px`, backgroundSize: `${scale}px 100%` }} data-track-id={track.id} key={track.id}>
              {track.clips.map((clip) => {
                const position = preview[clip.id] ?? clip
                const isLocked = lockedTracks.includes(track.id)
                const pixelWidth = position.duration * scale
                const density = pixelWidth < 48 ? 'clip-tiny' : pixelWidth < 105 ? 'clip-compact' : 'clip-full'
                return (
                  <button key={clip.id} disabled={isLocked} className={`timeline-clip ${density} ${overlapIds.has(clip.id) ? 'overlap-warning' : ''} ${clip.color} ${selected === clip.id ? 'clip-selected' : ''} ${clip.kind === 'audio' ? 'audio-clip' : ''} ${tool === 'razor' ? 'razor-cursor' : ''}`} style={{ left: `${position.start * scale}px`, width: `${pixelWidth}px`, top: `${5 + (laneLayouts.get(track.id)?.rows.get(clip.id) ?? 0) * (laneLayouts.get(track.id)?.rowHeight ?? 42)}px`, zIndex: selected === clip.id ? 3 : 1 }} onPointerMove={(event) => { if (tool === 'razor') { const rect = event.currentTarget.getBoundingClientRect(); setRazorTime(position.start + Math.max(0, Math.min(position.duration, (event.clientX - rect.left) / scale))) } }} onPointerLeave={() => setRazorTime(null)} onPointerDown={(event) => { if (tool === 'razor') { event.preventDefault(); event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const cutTime = position.start + Math.max(0, Math.min(position.duration, (event.clientX - rect.left) / scale)); onSplitClip(clip.id, cutTime); setRazorTime(null); return } beginGesture(event, clip, 'move') }} onClick={() => { if (tool === 'select') onSelect(clip.id) }} title={tool === 'razor' ? `${clip.title} · corte en ${formatTimecode(razorTime ?? position.start, frameRate)} · haz clic en el punto de corte` : `${clip.title} · arrastra para mover · ←/→ mueve · Alt + ←/→ recorta borde derecho · Ctrl + Alt + ←/→ recorta borde izquierdo · Shift amplía el paso`} aria-label={`${clip.title}, inicio ${formatTimecode(position.start, frameRate)}, duración ${formatTimecode(position.duration, frameRate)}. Flechas para mover; Alt más flechas recorta el borde derecho; Ctrl más Alt recorta el izquierdo`}>
                    <span className={`clip-art ${clip.thumbnail}`} />
                    {clip.kind === 'audio' && waveforms && <span className="waveform">{Array.from({ length: 92 }, (_, i) => <i key={i} style={{ height: `${15 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.27)) * 65}%` }} />)}</span>}
                    {clip.fadeIn ? <span className="clip-fade-in" style={{ width: `${Math.min(50, clip.fadeIn / Math.max(position.duration, 0.1) * 100)}%` }} /> : null}
                    {clip.fadeOut ? <span className="clip-fade-out" style={{ width: `${Math.min(50, clip.fadeOut / Math.max(position.duration, 0.1) * 100)}%` }} /> : null}
                    {clip.kind === 'audio' && <span className="clip-volume-line" style={{ bottom: `${Math.min(100, clip.volume ?? 100)}%` }} />}
                    {clip.keyframes?.map((keyframe) => <span key={`${keyframe.property}-${keyframe.time}`} className="clip-keyframe" style={{ left: `${Math.max(0, Math.min(100, (keyframe.time - position.start) / Math.max(position.duration, 0.01) * 100))}%` }} title={`${keyframe.property} · ${formatTimecode(keyframe.time, frameRate)}`} />)}
                    {clip.kind === 'video' && clipLabels && pixelWidth >= 48 && (
                      <span className="clip-label">
                        {clip.text !== undefined || clip.thumbnail === 'text-overlay' ? <Type size={11} /> : <Film size={11} />}
                        <span>{clip.text ?? clip.title}</span>
                        {clip.textAnimation?.in && clip.textAnimation.in !== 'none' && pixelWidth >= 85 && (
                          <em className="clip-anim-tag">{clip.textAnimation.in.toUpperCase()}</em>
                        )}
                        {pixelWidth >= 115 && <small>{formatTimecode(position.duration, frameRate)}</small>}
                      </span>
                    )}
                    {clip.kind === 'audio' && clipLabels && pixelWidth >= 60 && <span className="clip-label audio-clip-label"><AudioLines size={10} /><span>{clip.title}</span>{pixelWidth >= 120 && <small>{formatTimecode(position.duration, frameRate)}</small>}</span>}
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
    <div className="timeline-bottom">
      <div>
        <IconButton label={t('Añadir marcador en el cabezal', 'Add marker at playhead')} onClick={() => onAddMarker(playhead)}><Plus size={14} /></IconButton>
        <button className="snap-control" role="switch" aria-checked={snap} onClick={onToggleSnap} aria-label={t('Ajuste a fotogramas', 'Snap to frames')}>{t('Ajuste', 'Snap')} <span className={`toggle small ${snap ? 'on' : ''}`}><i /></span></button>
        <span className="bottom-divider" />
        <button className={`timeline-tool ${tool === 'select' ? 'active' : ''}`} aria-pressed={tool === 'select'} onClick={() => onSetTool('select')}>{t('Selección', 'Select')} <span className="shortcut">V</span></button>
        <button className={`timeline-tool ${tool === 'razor' ? 'active' : ''}`} aria-label={t('Corte (Razor)', 'Razor tool')} aria-pressed={tool === 'razor'} onClick={() => onSetTool(tool === 'razor' ? 'select' : 'razor')}><Scissors size={13} /> {t('Cortar (Razor)', 'Razor')} <span className="shortcut">C</span></button>
        {onAddTextClip && (
          <button type="button" className="timeline-tool" onClick={onAddTextClip} title={t('Insertar texto o subtítulo en el cabezal', 'Insert text or subtitle at playhead')}>
            <IconNleTitleHook size={12} /> {t('Texto', 'Text')}
          </button>
        )}
        {onAutoSubtitles && (
          <button type="button" className="timeline-tool" onClick={onAutoSubtitles} title={t('Generar subtítulos sincronizados con el audio del video', 'Generate subtitles synced with video audio')}>
            <IconNleCaptions size={12} /> {t('Subtítulos', 'Subtitles')}
          </button>
        )}
        {onClearSubtitles && (
          <button
            type="button"
            className="timeline-tool destructive-tool"
            onClick={onClearSubtitles}
            title={t('Borrar todos los subtítulos de la secuencia para volver a crearlos (Alt + Supr)', 'Delete all sequence subtitles to recreate them (Alt + Delete)')}
          >
            <Trash2 size={12} /> {t('Borrar subtítulos', 'Clear subtitles')} <span className="shortcut">Alt+Supr</span>
          </button>
        )}
        {selectedClipObj && (
          <>
            <span className="bottom-divider" />
            <button
              type="button"
              className="timeline-tool"
              disabled={!canSplitSelectedAtPlayhead}
              onClick={() => { if (canSplitSelectedAtPlayhead) onSplitClip(selectedClipObj.id, playhead) }}
              title={t('Dividir clip seleccionado en el cabezal (S)', 'Split selected clip at playhead (S)')}
            >
              <Scissors size={12} /> {t('Dividir aquí', 'Split here')} <span className="shortcut">S</span>
            </button>
            {onDuplicateClip && (
              <button
                type="button"
                className="timeline-tool"
                disabled={selectedTrackLocked}
                onClick={() => onDuplicateClip(selectedClipObj.id)}
                title={t('Duplicar clip seleccionado (Ctrl+D)', 'Duplicate selected clip (Ctrl+D)')}
              >
                <CopyPlus size={12} /> {t('Duplicar', 'Duplicate')}
              </button>
            )}
            {onDeleteClip && (
              <button
                type="button"
                className="timeline-tool destructive-tool"
                disabled={selectedTrackLocked}
                onClick={() => onDeleteClip(selectedClipObj.id)}
                title={t('Eliminar clip seleccionado (Supr)', 'Delete selected clip (Del)')}
              >
                <Trash2 size={12} />
              </button>
            )}
          </>
        )}
      </div>
      <div>
        <span><Clock3 size={13} /> {frameRate} fps</span>
        <span><Gauge size={13} /> {formatTimecode(Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration))), frameRate)}</span>
        <IconButton label={expanded ? t('Restaurar tamaño de línea de tiempo', 'Restore timeline size') : t('Expandir línea de tiempo', 'Expand timeline')} active={expanded} onClick={onToggleExpanded}><Maximize2 size={14} /></IconButton>
      </div>
    </div>
  </section>
}

function getRulerStep(pixelsPerSecond: number) {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  return steps.find((step) => step * pixelsPerSecond >= 64) ?? 600
}
