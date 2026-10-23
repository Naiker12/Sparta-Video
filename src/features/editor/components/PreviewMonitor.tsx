import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Crosshair, Expand, Grid2X2, MoreHorizontal, Pause, Play, Repeat, SkipBack, SkipForward } from 'lucide-react'
import { IconButton } from './controls'
import { ActionMenu } from './ActionMenu'
import type { Clip, TimelineMarker } from '../model'
import { formatTimecode } from '../timecode'

type Props = { playhead: number; playing: boolean; loop: boolean; frameRate: number; duration: number; clip?: Clip; markers: TimelineMarker[]; sequenceSize?: { width: number; height: number }; onTogglePlay: () => void; onToggleLoop: () => void; onSeek: (time: number) => void }
type ZoomPreset = 'fit' | '50%' | '100%'

export function PreviewMonitor({ playhead, playing, loop, frameRate, duration, clip, markers, sequenceSize = { width: 1920, height: 1080 }, onTogglePlay, onToggleLoop, onSeek }: Props) {
  const [quality, setQuality] = useState('FULL')
  const [safeMargins, setSafeMargins] = useState(false)
  const [titleOverlay, setTitleOverlay] = useState(true)
  const [thirds, setThirds] = useState(false)
  const [zoom, setZoom] = useState<ZoomPreset>('fit')
  const stageRef = useRef<HTMLDivElement>(null)
  const timecode = formatTimecode(playhead, frameRate)
  const transform = clip?.transform ?? { x: sequenceSize.width / 2, y: sequenceSize.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }
  const offsetX = (transform.x / sequenceSize.width - 0.5) * 100
  const offsetY = (transform.y / sequenceSize.height - 0.5) * 100
  const aspectLabel = getAspectLabel(sequenceSize.width, sequenceSize.height)
  const zoomFactor = zoom === '50%' ? 0.5 : 1
  const toggleFullscreen = async () => {
    if (!stageRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await stageRef.current.requestFullscreen?.()
  }
  return <section className="preview-panel"><div className="section-label"><span>MONITOR DE PROGRAMA</span><div><ActionMenu label="Calidad de vista previa (solo etiqueta demo)" triggerClass="monitor-quality" items={['FULL', 'HALF', 'QUARTER'].map((value) => ({ label: `${value} · etiqueta de demostración`, checked: quality === value, onSelect: () => setQuality(value) }))}>{quality} · DEMO</ActionMenu><ActionMenu label="Superposiciones del monitor" items={[{ label: 'Márgenes seguros', icon: Crosshair, checked: safeMargins, onSelect: () => setSafeMargins((value) => !value) }, { label: 'Regla de tercios', icon: Grid2X2, checked: thirds, onSelect: () => setThirds((value) => !value) }, { label: 'Rótulo de título', checked: titleOverlay, onSelect: () => setTitleOverlay((value) => !value) }, { separator: true }, ...(['fit', '50%', '100%'] as const).map((value) => ({ label: `Zoom del monitor · ${value === 'fit' ? 'Ajustar' : value}`, checked: zoom === value, onSelect: () => setZoom(value) }))]}><MoreHorizontal size={16} /></ActionMenu><IconButton label="Monitor a pantalla completa" onClick={() => void toggleFullscreen()}><Expand size={14} /></IconButton></div></div>
    <div className="preview-stage" ref={stageRef}><div className="preview-image" style={{ aspectRatio: `${sequenceSize.width}/${sequenceSize.height}`, transform: `translate(${offsetX}%, ${offsetY}%) scale(${transform.scaleX / 100 * zoomFactor}, ${transform.scaleY / 100 * zoomFactor}) rotate(${transform.rotation}deg)`, opacity: (clip?.opacity ?? 100) / 100 }}><div className="preview-sun" /><div className="preview-horizon" /><div className="preview-cliffs" /><div className="preview-ocean" /><div className="preview-shore" />{titleOverlay && <div className="preview-overlay"><span>COASTAL FILM</span><i /></div>}{safeMargins && <div className="safe-margins" aria-hidden="true"><i /><i /></div>}{thirds && <div className="thirds-guides" aria-hidden="true"><i /><i /><i /><i /></div>}</div><span className="preview-demo-badge">Ilustración de muestra</span><div className="preview-corner">{aspectLabel} · {zoom} · etiqueta {quality.toLowerCase()}</div></div>
    <div className="monitor-scrub"><span className="timecode">{timecode}</span><div className="scrub-track"><div className="scrub-selection" style={{ left: `${duration && clip ? clip.start / duration * 100 : 0}%`, width: `${duration && clip ? clip.duration / duration * 100 : 0}%` }} />{markers.map((marker) => <i key={marker.id} title={`${marker.label} · ${formatTimecode(marker.time, frameRate)}`} style={{ left: `${duration ? marker.time / duration * 100 : 0}%` }} />)}<input aria-label="Buscar tiempo en la secuencia" type="range" min="0" max={Math.max(duration, 0.01)} step={1 / frameRate} value={Math.min(playhead, Math.max(duration, 0.01))} onChange={(event) => onSeek(Number(event.target.value))} /></div><span className="timecode total-time">{formatTimecode(duration, frameRate)}</span></div>
    <div className="preview-controls"><div className="transport"><IconButton label="Ir al inicio" onClick={() => onSeek(0)}><SkipBack size={15} /></IconButton><IconButton label="Fotograma anterior" onClick={() => onSeek(Math.max(0, playhead - 1 / frameRate))}><ChevronLeft size={17} /></IconButton><button className="play-button" aria-label={playing ? 'Pausar' : 'Reproducir'} onClick={onTogglePlay} title="Espacio para reproducir o pausar">{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><IconButton label="Fotograma siguiente" onClick={() => onSeek(Math.min(duration, playhead + 1 / frameRate))}><ChevronRight size={17} /></IconButton><IconButton label="Ir al final" onClick={() => onSeek(duration)}><SkipForward size={15} /></IconButton><IconButton label={loop ? 'Desactivar bucle' : 'Activar bucle'} active={loop} onClick={onToggleLoop}><Repeat size={14} /></IconButton></div></div></section>
}

function getAspectLabel(width: number, height: number) {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height) || 1
  return `${width / divisor}:${height / divisor}`
}
