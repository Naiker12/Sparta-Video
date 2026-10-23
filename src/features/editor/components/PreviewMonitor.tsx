import { useState } from 'react'
import { ChevronLeft, ChevronRight, Crosshair, MoreHorizontal, Pause, Play } from 'lucide-react'
import { IconButton } from './controls'
import { ActionMenu } from './ActionMenu'
import type { Clip } from '../model'
import { formatTimecode } from '../timecode'

type Props = { playhead: number; playing: boolean; frameRate: number; duration: number; clip?: Clip; sequenceSize?: { width: number; height: number }; onTogglePlay: () => void; onSeek: (time: number) => void }

export function PreviewMonitor({ playhead, playing, frameRate, duration, clip, sequenceSize = { width: 1920, height: 1080 }, onTogglePlay, onSeek }: Props) {
  const [quality, setQuality] = useState('FULL')
  const [safeMargins, setSafeMargins] = useState(false)
  const [titleOverlay, setTitleOverlay] = useState(true)
  const timecode = formatTimecode(playhead, frameRate)
  const transform = clip?.transform ?? { x: sequenceSize.width / 2, y: sequenceSize.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }
  const offsetX = (transform.x / sequenceSize.width - 0.5) * 100
  const offsetY = (transform.y / sequenceSize.height - 0.5) * 100
  const aspectLabel = getAspectLabel(sequenceSize.width, sequenceSize.height)
  return <section className="preview-panel"><div className="section-label"><span>PROGRAM MONITOR</span><div><ActionMenu label="Preview quality" triggerClass="monitor-quality" items={['FULL', 'HALF', 'QUARTER'].map((value) => ({ label: `${value} resolution`, checked: quality === value, onSelect: () => setQuality(value) }))}>{quality}</ActionMenu><ActionMenu label="Preview overlays" items={[{ label: 'Safe margins', icon: Crosshair, checked: safeMargins, onSelect: () => setSafeMargins((value) => !value) }, { label: 'Title overlay', checked: titleOverlay, onSelect: () => setTitleOverlay((value) => !value) }]}><MoreHorizontal size={16} /></ActionMenu></div></div><div className="preview-stage"><div className="preview-image" style={{ aspectRatio: `${sequenceSize.width}/${sequenceSize.height}`, transform: `translate(${offsetX}%, ${offsetY}%) scale(${transform.scaleX / 100}, ${transform.scaleY / 100}) rotate(${transform.rotation}deg)`, opacity: (clip?.opacity ?? 100) / 100 }}><div className="preview-sun" /><div className="preview-horizon" /><div className="preview-cliffs" /><div className="preview-ocean" /><div className="preview-shore" />{titleOverlay && <div className="preview-overlay"><span>COASTAL FILM</span><i /></div>}{safeMargins && <div className="safe-margins" aria-hidden="true"><i /><i /></div>}</div><div className="preview-corner">{aspectLabel} · {quality.toLowerCase()}</div></div><div className="preview-controls"><span className="timecode">{timecode}</span><div className="transport"><IconButton label="Previous frame" onClick={() => onSeek(Math.max(0, playhead - 1 / frameRate))}><ChevronLeft size={17} /></IconButton><button className="play-button" aria-label={playing ? 'Pause' : 'Play'} onClick={onTogglePlay} title="Espacio para reproducir o pausar">{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><IconButton label="Next frame" onClick={() => onSeek(Math.min(duration, playhead + 1 / frameRate))}><ChevronRight size={17} /></IconButton></div><span className="timecode total-time">{formatTimecode(duration, frameRate)}</span></div></section>
}

function getAspectLabel(width: number, height: number) {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height) || 1
  return `${width / divisor}:${height / divisor}`
}
