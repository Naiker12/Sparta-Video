import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Crosshair, Expand, Film, Grid2X2, LoaderCircle, MoreHorizontal, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { IconButton } from './controls'
import { ActionMenu } from './ActionMenu'
import type { Clip, MediaItem, TimelineMarker } from '../model'
import { formatTimecode } from '../timecode'
import { t } from '../services/locale'
import { loadMediaSource } from '../services/media-storage'
import { getInterpolatedOpacity, getInterpolatedTransform } from '../services/keyframe-interpolation'

type Props = {
  playhead: number
  frameRate: number
  duration: number
  clip?: Clip
  media?: MediaItem
  markers: TimelineMarker[]
  sequenceSize?: { width: number; height: number }
  playing: boolean
  onSeek: (time: number) => void
  onTogglePlay: () => void
}
type ZoomPreset = 'fit' | '50%' | '100%'

export function PreviewMonitor({ playhead, frameRate, duration, clip, media, markers, sequenceSize = { width: 1920, height: 1080 }, playing, onSeek, onTogglePlay }: Props) {
  const [safeMargins, setSafeMargins] = useState(false)
  const [thirds, setThirds] = useState(false)
  const [zoom, setZoom] = useState<ZoomPreset>('fit')
  const [sourceState, setSourceState] = useState<{ assetId: string; status: 'ready' | 'missing'; url?: string } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timecode = formatTimecode(playhead, frameRate)
  const transform = clip
    ? getInterpolatedTransform(clip, playhead, sequenceSize)
    : { x: sequenceSize.width / 2, y: sequenceSize.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }
  const clipOpacity = clip ? getInterpolatedOpacity(clip, playhead) / 100 : 1
  const offsetX = (transform.x / sequenceSize.width - 0.5) * 100
  const offsetY = (transform.y / sequenceSize.height - 0.5) * 100
  const aspectLabel = getAspectLabel(sequenceSize.width, sequenceSize.height)
  const zoomFactor = zoom === '50%' ? 0.5 : 1
  const sourceAssetId = clip?.sourceAssetId ?? media?.id
  const previewTitle = clip?.title ?? media?.title
  const isImage = clip ? clip.thumbnail === 'image-catalog' : media?.type === 'image'
  const isVideo = clip ? clip.kind === 'video' && !isImage : media?.type === 'video'
  const clipStart = clip?.start

  useEffect(() => {
    if (!sourceAssetId || (!isImage && !isVideo)) {
      return
    }
    let cancelled = false
    let nextUrl: string | null = null
    void loadMediaSource(sourceAssetId).then((url) => {
      nextUrl = url
      if (cancelled) { if (url) URL.revokeObjectURL(url); return }
      setSourceState({ assetId: sourceAssetId, status: url ? 'ready' : 'missing', ...(url ? { url } : {}) })
    }).catch(() => { if (!cancelled) setSourceState({ assetId: sourceAssetId, status: 'missing' }) })
    return () => { cancelled = true; if (nextUrl) URL.revokeObjectURL(nextUrl) }
  }, [sourceAssetId, isImage, isVideo])

  const sourceMatches = !!sourceAssetId && sourceState?.assetId === sourceAssetId
  const sourceUrl = sourceMatches && sourceState?.status === 'ready' ? sourceState.url : null
  const sourceLoading = !!sourceAssetId && !sourceMatches
  const sourceMissing = !!sourceAssetId && sourceMatches && sourceState?.status === 'missing'
  const isPlayable = !!sourceUrl || (duration > 0 && playing)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !sourceUrl || !isVideo || clipStart === undefined) return
    const sourceTime = Math.max(0, playhead - clipStart)
    if (video.readyState >= 1 && Math.abs(video.currentTime - sourceTime) > (playing ? 0.35 : 0.04)) {
      try { video.currentTime = sourceTime } catch { /* The media element will seek when metadata is ready. */ }
    }
    if (playing) void video.play().catch(() => {})
    else video.pause()
  }, [sourceUrl, isVideo, clipStart, clip?.id, playhead, playing])

  const toggleFullscreen = async () => {
    if (!stageRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await stageRef.current.requestFullscreen?.()
  }
  const mediaTransform = {
    aspectRatio: `${sequenceSize.width}/${sequenceSize.height}`,
    transform: `translate(${offsetX}%, ${offsetY}%) scale(${transform.scaleX / 100 * zoomFactor}, ${transform.scaleY / 100 * zoomFactor}) rotate(${transform.rotation}deg)`,
    opacity: clipOpacity,
  }

  return <section className="preview-panel">
    <div className="section-label"><span>{t('MONITOR DE PROGRAMA', 'PROGRAM MONITOR')}</span><div><span className="monitor-quality">{t('VISTA PREVIA', 'PREVIEW')}</span><ActionMenu label={t('Superposiciones del monitor', 'Monitor overlays')} items={[{ label: t('Márgenes seguros', 'Safe margins'), icon: Crosshair, checked: safeMargins, onSelect: () => setSafeMargins((value) => !value) }, { label: t('Regla de tercios', 'Rule of thirds'), icon: Grid2X2, checked: thirds, onSelect: () => setThirds((value) => !value) }, { separator: true }, ...(['fit', '50%', '100%'] as const).map((value) => ({ label: `Zoom del monitor · ${value === 'fit' ? 'Ajustar' : value}`, checked: zoom === value, onSelect: () => setZoom(value) }))]}><MoreHorizontal size={16} /></ActionMenu><IconButton label={t('Monitor a pantalla completa', 'Fullscreen monitor')} onClick={() => void toggleFullscreen()}><Expand size={14} /></IconButton></div></div>
    <div className="preview-stage" ref={stageRef}>
      <div className={`preview-image ${sourceUrl ? 'preview-image-loaded' : 'preview-empty-image'}`} style={mediaTransform}>
        {sourceUrl && isImage && <img className="preview-media-image" src={sourceUrl} alt={previewTitle ?? ''} />}
        {sourceUrl && isVideo && <video key={`${sourceAssetId}-${clip?.id ?? 'library'}`} ref={videoRef} className="preview-media-image" src={sourceUrl} muted playsInline preload="auto" onLoadedMetadata={(event) => { if (!clip) return; const video = event.currentTarget; try { video.currentTime = Math.max(0, playhead - clip.start) } catch { /* The browser will seek when metadata is ready. */ } if (playing) void video.play().catch(() => {}) }} onTimeUpdate={(event) => { if (playing && clip) { const next = clip.start + event.currentTarget.currentTime; if (Math.abs(next - playhead) > 0.12) onSeek(Math.min(duration, next)) } }} />}
        {!sourceUrl && <div className="preview-empty-copy">{sourceLoading ? <LoaderCircle size={22} className="spin" aria-hidden="true" /> : !clip && !media && <Film size={22} strokeWidth={1.6} aria-hidden="true" />}<strong>{previewTitle ?? t('La vista previa aparecerá aquí', 'Preview will appear here')}</strong><span>{sourceLoading ? t('Cargando medio…', 'Loading media…') : sourceMissing ? t('Vuelve a vincular el archivo para ver su contenido.', 'Relink the file to preview its contents.') : clip || media ? t('Este tipo de medio todavía no tiene vista previa.', 'This media type does not have preview support yet.') : t('Coloca un clip en la línea de tiempo o selecciona un medio.', 'Place a clip on the timeline or select media.')}</span></div>}
        {safeMargins && <div className="safe-margins" aria-hidden="true"><i /><i /></div>}
        {thirds && <div className="thirds-guides" aria-hidden="true"><i /><i /><i /><i /></div>}
      </div>
      <div className="preview-corner">{aspectLabel} · {zoom}</div>
    </div>
    <div className="monitor-scrub"><span className="timecode">{timecode}</span><div className="scrub-track"><div className="scrub-selection" style={{ left: `${duration && clip ? clip.start / duration * 100 : 0}%`, width: `${duration && clip ? clip.duration / duration * 100 : 0}%` }} />{markers.map((marker) => <i key={marker.id} title={`${marker.label} · ${formatTimecode(marker.time, frameRate)}`} style={{ left: `${duration ? marker.time / duration * 100 : 0}%` }} />)}<input aria-label={t('Buscar tiempo en la secuencia', 'Seek through sequence')} type="range" min="0" max={Math.max(duration, 0.01)} step={1 / frameRate} value={Math.min(playhead, Math.max(duration, 0.01))} onChange={(event) => onSeek(Number(event.target.value))} /></div><span className="timecode total-time">{formatTimecode(duration, frameRate)}</span></div>
    <div className="preview-controls"><div className="transport"><IconButton label={t('Ir al inicio', 'Go to start')} onClick={() => onSeek(0)}><SkipBack size={15} /></IconButton><IconButton label={t('Fotograma anterior', 'Previous frame')} onClick={() => onSeek(Math.max(0, playhead - 1 / frameRate))}><ChevronLeft size={17} /></IconButton>{isPlayable ? <button className={`play-button ${playing ? 'active' : ''}`} aria-label={playing ? t('Pausar', 'Pause') : t('Reproducir', 'Play')} title={playing ? t('Pausar reproducción (Espacio)', 'Pause playback (Space)') : t('Reproducir secuencia (Espacio)', 'Play sequence (Space)')} onClick={onTogglePlay}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button> : <button className="play-button" aria-label={t('Reproducción no disponible', 'Playback unavailable')} title={t('La reproducción estará disponible cuando se conecte el motor de medios.', 'Playback will be available when the media engine is connected.')} disabled><Play size={16} fill="currentColor" /></button>}<IconButton label={t('Fotograma siguiente', 'Next frame')} onClick={() => onSeek(Math.min(duration, playhead + 1 / frameRate))}><ChevronRight size={17} /></IconButton><IconButton label={t('Ir al final', 'Go to end')} onClick={() => onSeek(duration)}><SkipForward size={15} /></IconButton></div></div>
  </section>
}

function getAspectLabel(width: number, height: number) {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height) || 1
  return `${width / divisor}:${height / divisor}`
}
