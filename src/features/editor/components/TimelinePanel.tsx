import { useEffect, useRef, useState } from 'react'
import { Clock3, Film, Gauge, LockKeyhole, Maximize2, MoreHorizontal, Plus, Scan, Scissors, Video, Volume2, VolumeX, ZoomIn, ZoomOut, AudioLines } from 'lucide-react'
import type { Clip, MediaItem, TimelineMarker, Track } from '../model'
import { IconButton } from './controls'
import { ActionMenu } from './ActionMenu'
import { formatRulerTime, formatTimecode } from '../timecode'

type Props = {
  tracks: Track[]; assets: MediaItem[]; markers: TimelineMarker[]; selected: string; playhead: number; zoom: number; frameRate: number; snap: boolean; expanded: boolean; tool: 'select' | 'razor'
  onSelect: (id: string) => void; onSeek: (time: number) => void; onZoom: (zoom: number) => void
  mutedTracks: string[]; lockedTracks: string[]; onMuteTrack: (id: string) => void; onLockTrack: (id: string) => void
  onAddTrack: (kind: 'video' | 'audio') => void; onAddMedia: (item: MediaItem, at: number, trackId?: string) => void
  onMoveClip: (clipId: string, start: number, duration?: number) => void; onSplitClip: (clipId: string, time: number) => void
  onAddMarker: (time: number) => void; onRemoveMarker: (id: string) => void; onToggleSnap: () => void; onToggleExpanded: () => void; onSetTool: (tool: 'select' | 'razor') => void
}
type Gesture = { id: string; startX: number; originalStart: number; originalDuration: number; mode: 'move' | 'trim-left' | 'trim-right' }

export function TimelinePanel({ tracks, assets, markers, selected, playhead, zoom, frameRate, snap, expanded, tool, mutedTracks, lockedTracks, onSelect, onSeek, onZoom, onMuteTrack, onLockTrack, onAddTrack, onAddMedia, onMoveClip, onSplitClip, onAddMarker, onRemoveMarker, onToggleSnap, onToggleExpanded, onSetTool }: Props) {
  const scale = 31 * zoom
  const sequenceDuration = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)), ...markers.map((marker) => marker.time))
  const rulerDuration = Math.max(10, sequenceDuration + 2)
  const rulerTickCount = Math.ceil(rulerDuration) + 1
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
  const [preview, setPreview] = useState<Record<string, { start: number; duration: number }>>({})
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
    return [track.id, { rows, height: Math.max(track.kind === 'audio' ? 45 : 48, rowEnds.length * rowHeight + 6), rowHeight }] as const
  }))
  const beginGesture = (event: React.PointerEvent, clip: Clip, mode: Gesture['mode']) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); onSelect(clip.id)
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
      if (snap) {
        nextStart = Math.round(nextStart * frameRate) / frameRate
        if (active.mode !== 'move') nextDuration = Math.max(1 / frameRate, Math.round(nextDuration * frameRate) / frameRate)
      }
      pendingRef.current = { start: nextStart, duration: nextDuration }
      setPreview((current) => ({ ...current, [active.id]: { start: nextStart, duration: nextDuration } }))
    }
    const end = () => {
      const active = gestureRef.current
      const pending = pendingRef.current
      if (active && pending) onMoveClip(active.id, pending.start, pending.duration)
      if (active) setPreview((current) => { const next = { ...current }; delete next[active.id]; return next })
      gestureRef.current = null; pendingRef.current = null
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true })
  }
  const seekFromClientX = (clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return
    const time = Math.max(0, (clientX - rect.left + (timelineRef.current?.scrollLeft ?? 0)) / scale)
    onSeek(snap ? Math.round(time * frameRate) / frameRate : time)
  }
  useEffect(() => {
    const move = (event: PointerEvent) => { if (scrubbingRef.current) seekFromClientX(event.clientX) }
    const end = () => { scrubbingRef.current = false }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
  })
  return <section className={`timeline-panel ${expanded ? 'timeline-expanded' : ''}`}><div className="timeline-top"><div className="timeline-heading"><span className="section-kicker">TIMELINE</span><span className="timeline-divider" /><span className="sequence-selector">Sequence 01</span><span className="timeline-size">{formatTimecode(Math.max(0,...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration))), frameRate)}</span></div><div className="timeline-actions"><ActionMenu label="Add track" items={[{ label: 'Add video track', icon: Video, onSelect: () => onAddTrack('video') }, { label: 'Add audio track', icon: AudioLines, onSelect: () => onAddTrack('audio') }]}><Plus size={15} /></ActionMenu><ActionMenu label="Timeline options" items={[{ heading: 'Timeline display' }, { label: 'Show audio waveforms', checked: waveforms, onSelect: () => setWaveforms((value) => !value) }, { label: 'Show clip names', checked: clipLabels, onSelect: () => setClipLabels((value) => !value) }, { separator: true }, { label: 'Reset zoom', icon: ZoomOut, onSelect: () => onZoom(1) }, { label: 'Fit sequence', icon: ZoomIn, onSelect: fitSequence }]}><MoreHorizontal size={16} /></ActionMenu><span className="timeline-divider" /><IconButton label="Fit sequence" onClick={fitSequence}><Scan size={15} /></IconButton><IconButton label="Zoom out" onClick={() => onZoom(Math.max(0.25, zoom - 0.15))}><ZoomOut size={15} /></IconButton><input aria-label="Timeline zoom" className="zoom-slider" type="range" min="0.25" max="2.4" step="0.05" value={zoom} onChange={(event) => onZoom(Number(event.target.value))} /><IconButton label="Zoom in" onClick={() => onZoom(Math.min(2.4, zoom + 0.15))}><ZoomIn size={15} /></IconButton><span className="zoom-value">{Math.round(zoom * 100)}%</span></div></div>
    <div className="timeline-body"><div className="track-controls" ref={trackControlsRef} onScroll={() => syncVerticalScroll('tracks')}><div className="ruler-spacer"><span aria-hidden="true">TRACKS</span></div>{tracks.map((track) => <div className={`track-control ${track.kind}`} style={{ height: `${laneLayouts.get(track.id)?.height ?? 48}px` }} key={track.id}><div className="track-color"><span /></div><span className="track-name">{track.name}</span><button aria-label={`${mutedTracks.includes(track.id) ? 'Unmute' : 'Mute'} ${track.name}`} aria-pressed={mutedTracks.includes(track.id)} className={mutedTracks.includes(track.id) ? 'track-action pressed' : 'track-action'} title={mutedTracks.includes(track.id) ? 'Unmute track' : 'Mute track'} onClick={() => onMuteTrack(track.id)}>{mutedTracks.includes(track.id) ? <VolumeX size={13} /> : <Volume2 size={13} />}</button><button aria-label={`${lockedTracks.includes(track.id) ? 'Unlock' : 'Lock'} ${track.name}`} aria-pressed={lockedTracks.includes(track.id)} className={lockedTracks.includes(track.id) ? 'track-action pressed' : 'track-action'} title={lockedTracks.includes(track.id) ? 'Unlock track' : 'Lock track'} onClick={() => onLockTrack(track.id)}><LockKeyhole size={12} /></button></div>)}</div>
      <div className="timeline-scroll" ref={timelineRef} onScroll={() => syncVerticalScroll('timeline')} role="region" aria-label="Timeline tracks" tabIndex={0}><div className="timeline-canvas" style={{ width: `${Math.max(880, scale * rulerTickCount)}px`, backgroundSize: `${scale}px 100%` }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData('application/sparta-media'); const item = assets.find((asset) => asset.id === id); if (item) { const rect = timelineRef.current?.getBoundingClientRect(); if (!rect) return; const lane = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-track-id]') : null; onAddMedia(item, Math.max(0, (event.clientX - rect.left + timelineRef.current!.scrollLeft) / scale), lane?.dataset.trackId) } }}>
        <div className="ruler" ref={rulerRef} onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); scrubbingRef.current = true; seekFromClientX(event.clientX) }}>{Array.from({ length: rulerTickCount }, (_, index) => <div className="ruler-mark" key={index} style={{ left: `${index * scale}px` }}><span>{index % 2 === 0 ? formatRulerTime(index) : ''}</span><i /></div>)}</div>
        {markers.map((marker) => <button key={marker.id} className="timeline-marker" style={{ left: `${marker.time * scale}px` }} title={`${marker.label} · ${formatTimecode(marker.time, frameRate)}; clic para ir, clic derecho para quitar`} onClick={() => onSeek(marker.time)} onContextMenu={(event) => { event.preventDefault(); onRemoveMarker(marker.id) }} aria-label={`${marker.label} at ${formatTimecode(marker.time, frameRate)}`} />)}
        {tracks.map((track) => <div className={`track-lane ${track.kind} ${mutedTracks.includes(track.id) ? 'muted-lane' : ''}`} style={{ height: `${laneLayouts.get(track.id)?.height ?? 48}px`, backgroundSize: `${scale}px 100%` }} data-track-id={track.id} key={track.id}>{track.clips.map((clip) => { const position = preview[clip.id] ?? clip; const isLocked = lockedTracks.includes(track.id); return <button key={clip.id} disabled={isLocked} className={`timeline-clip ${clip.color} ${selected === clip.id ? 'clip-selected' : ''} ${clip.kind === 'audio' ? 'audio-clip' : ''} ${tool === 'razor' ? 'razor-cursor' : ''}`} style={{ left: `${position.start * scale}px`, width: `${position.duration * scale}px`, top: `${5 + (laneLayouts.get(track.id)?.rows.get(clip.id) ?? 0) * (laneLayouts.get(track.id)?.rowHeight ?? 42)}px`, zIndex: selected === clip.id ? 3 : 1 }} onPointerDown={(event) => { if (tool === 'razor') { event.preventDefault(); event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const cutTime = position.start + Math.max(0, Math.min(position.duration, (event.clientX - rect.left) / scale)); onSplitClip(clip.id, cutTime); return } beginGesture(event, clip, 'move') }} onClick={() => { if (tool === 'select') onSelect(clip.id) }} title={tool === 'razor' ? `${clip.title} · clic para cortar en ese punto` : `${clip.title} · arrastra para mover`}><span className={`clip-art ${clip.thumbnail}`} />{clip.kind === 'audio' && waveforms && <span className="waveform">{Array.from({ length: 92 }, (_, i) => <i key={i} style={{ height: `${15 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.27)) * 65}%` }} />)}</span>}{clip.kind === 'video' && clipLabels && <span className="clip-label"><Film size={11} />{clip.title}</span>}{selected === clip.id && !isLocked && tool === 'select' && <><i className="trim-handle left" onPointerDown={(event) => beginGesture(event, clip, 'trim-left')} /><i className="trim-handle right" onPointerDown={(event) => beginGesture(event, clip, 'trim-right')} /></>}</button> })}</div>)}
        <div className="playhead" style={{ left: `${playhead * scale}px` }}><i /><span /></div></div></div></div>
    <div className="timeline-bottom"><div><IconButton label="Add marker at playhead" onClick={() => onAddMarker(playhead)}><Plus size={14} /></IconButton><button className="snap-control" role="switch" aria-checked={snap} onClick={onToggleSnap}>Snap <span className={`toggle small ${snap ? 'on' : ''}`}><i /></span></button><span className="bottom-divider" /><button className={`timeline-tool ${tool === 'select' ? 'active' : ''}`} aria-pressed={tool === 'select'} onClick={() => onSetTool('select')}>Select <span className="shortcut">V</span></button><button className={`timeline-tool ${tool === 'razor' ? 'active' : ''}`} aria-pressed={tool === 'razor'} onClick={() => onSetTool(tool === 'razor' ? 'select' : 'razor')}><Scissors size={13} /> Razor <span className="shortcut">C</span></button></div><div><span><Clock3 size={13} /> {frameRate} fps</span><span><Gauge size={13} /> {formatTimecode(Math.max(0,...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration))), frameRate)}</span><IconButton label={expanded ? 'Restore timeline size' : 'Expand timeline'} active={expanded} onClick={onToggleExpanded}><Maximize2 size={14} /></IconButton></div></div>
  </section>
}


