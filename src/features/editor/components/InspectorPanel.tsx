import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, CircleHelp, Copy, MoreHorizontal, RotateCcw, SlidersHorizontal, Volume2 } from 'lucide-react'
import type { Clip, MediaItem } from '../model'
import { ActionMenu } from './ActionMenu'

type Props = { clip?: Clip; selectedMedia?: MediaItem; assets: MediaItem[]; playhead: number; sequenceSize: { width: number; height: number }; readOnly?: boolean; onAddSelected: () => void; onUpdateClip: (id: string, changes: Partial<Clip>) => void; onSeek: (time: number) => void; onResetClip: () => void; onCopyClipName: (name: string) => void }
type Tab = 'Clip' | 'Audio' | 'Movimiento'
type Axis = 'x' | 'y'
const transformDefault = { x: 960, y: 540, scaleX: 100, scaleY: 100, rotation: 0 }

export function InspectorPanel({ clip, selectedMedia, assets, playhead, sequenceSize, readOnly = false, onAddSelected, onUpdateClip, onSeek, onResetClip, onCopyClipName }: Props) {
  const [tab, setTab] = useState<Tab>('Clip')
  const transform = clip?.transform ?? transformDefault
  const clipMedia = clip ? assets.find((asset) => asset.title === clip.title) : selectedMedia
  const mediaDetails = clipMedia?.detail.split('·').map((part) => part.trim()) ?? []
  const mediaDescription = clipMedia ? `${clipMedia.type === 'audio' ? 'Audio' : clipMedia.type === 'image' ? 'Imagen' : 'Vídeo'} · ${clipMedia.status === 'demo' ? mediaDetails[0] ?? 'Muestra' : clipMedia.status === 'catalog-only' ? 'Solo catálogo' : 'Datos limitados'}` : 'Sin metadatos del medio'
  const updateTransform = (key: keyof typeof transform, value: number) => {
    if (!clip) return
    const next = { ...transform, [key]: value }
    if (clip.uniformScale && (key === 'scaleX' || key === 'scaleY')) next[key === 'scaleX' ? 'scaleY' : 'scaleX'] = value
    onUpdateClip(clip.id, { transform: next })
  }
  const setKeyframe = (property: 'position' | 'scale', time: number) => {
    if (!clip) return
    const keyframes = clip.keyframes ?? []
    const exists = keyframes.some((keyframe) => keyframe.property === property && keyframe.time === time)
    onUpdateClip(clip.id, { keyframes: exists ? keyframes.filter((keyframe) => !(keyframe.property === property && keyframe.time === time)) : [...keyframes, { property, time }] })
  }
  return <aside className="inspector-panel"><div className="section-label"><span>INSPECTOR</span><ActionMenu label="Opciones del inspector" items={[{ label: 'Restablecer controles del clip', icon: RotateCcw, disabled: !clip || readOnly, onSelect: onResetClip }, { label: 'Copiar nombre del clip', icon: Copy, disabled: !clip, onSelect: () => { if (clip) onCopyClipName(clip.title) } }]}><MoreHorizontal size={16} /></ActionMenu></div>
    <div className="inspector-tabs" role="tablist" aria-label="Secciones del inspector">{(['Clip', 'Audio', 'Movimiento'] as const).map((name) => <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? 'selected-tab' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
    {clip ? <><div className="inspector-clip"><div className={`inspector-thumb ${clip.thumbnail}`} /><div><strong>{clip.title}</strong><span>{mediaDescription}</span></div></div>{readOnly && <p className="inspector-hint">La pista está bloqueada. Desbloquéala en la línea de tiempo para editar este clip.</p>}
      {tab === 'Clip' && <><InspectorSection title="TRANSFORMACIÓN"><Property label="Posición" x={transform.x} y={transform.y} defaultX={sequenceSize.width / 2} defaultY={sequenceSize.height / 2} disabled={readOnly} onChange={(axis, value) => updateTransform(axis, value)} /><Property label="Escala" x={transform.scaleX} y={transform.scaleY} defaultX={100} defaultY={100} suffix="%" disabled={readOnly} onChange={(axis, value) => updateTransform(axis === 'x' ? 'scaleX' : 'scaleY', value)} /><Property label="Rotación" x={transform.rotation} defaultX={0} suffix="°" disabled={readOnly} onChange={(_axis, value) => updateTransform('rotation', value)} /><button className="toggle-row inspector-toggle" role="switch" aria-checked={clip.uniformScale ?? true} disabled={readOnly} onClick={() => onUpdateClip(clip.id, { uniformScale: !(clip.uniformScale ?? true) })}><span>Escala uniforme</span><span className={`toggle ${(clip.uniformScale ?? true) ? 'on' : ''}`}><i /></span></button></InspectorSection><InspectorSection title="OPACIDAD"><div className="slider-row"><input aria-label="Opacidad" type="range" min="0" max="100" value={clip.opacity ?? 100} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { opacity: Number(event.target.value) })} /><span>{clip.opacity ?? 100}%</span></div><div className="toggle-row"><span>Modo de mezcla</span><select aria-label="Modo de mezcla" className="select-button" value={clip.blendMode ?? 'normal'} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { blendMode: event.target.value as Clip['blendMode'] })}><option value="normal">Normal</option><option value="multiply">Multiplicar</option><option value="screen">Trama</option><option value="overlay">Superponer</option></select></div></InspectorSection></>}
      {tab === 'Audio' && <InspectorSection title="MEZCLADOR DE AUDIO"><div className="slider-row"><Volume2 size={14} /><input aria-label="Volumen del clip" type="range" min="0" max="150" value={clip.volume ?? 100} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { volume: Number(event.target.value) })} /><span>{clip.volume ?? 100}%</span></div><div className="decorative-meter" aria-label="Medidor decorativo, sin análisis de audio"><i style={{ width: `${Math.min(100, clip.volume ?? 100)}%` }} /></div><label className="toggle-row">Fundido de entrada <input aria-label="Fundido de entrada" type="range" min="0" max="5" step="0.1" value={clip.fadeIn ?? 0} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { fadeIn: Number(event.target.value) })} /></label><div className="fade-preview"><i className="fade-in-ramp" style={{ width: `${Math.min(50, (clip.fadeIn ?? 0) / Math.max(clip.duration, 0.1) * 100)}%` }} /><i className="fade-out-ramp" style={{ width: `${Math.min(50, (clip.fadeOut ?? 0) / Math.max(clip.duration, 0.1) * 100)}%` }} /></div><label className="toggle-row">Fundido de salida <input aria-label="Fundido de salida" type="range" min="0" max="5" step="0.1" value={clip.fadeOut ?? 0} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { fadeOut: Number(event.target.value) })} /></label><p className="inspector-hint">El medidor y los fundidos son representaciones visuales; estos valores aún no procesan el sonido.</p></InspectorSection>}
      {tab === 'Movimiento' && <InspectorSection title="MOVIMIENTO">{(['position', 'scale'] as const).map((property) => { const active = (clip.keyframes ?? []).some((keyframe) => keyframe.property === property && keyframe.time === Math.round(playhead * 1000) / 1000); return <div className="toggle-row" key={property}><span>{property === 'position' ? 'Posición' : 'Escala'}</span><button className="keyframe-button" disabled={readOnly} onClick={() => setKeyframe(property, Math.round(playhead * 1000) / 1000)}>{active ? '◇ Quitar fotograma clave' : '◇ Añadir fotograma clave'}</button></div> })}<div className="keyframe-navigation"><button disabled={!clip.keyframes?.some((keyframe) => keyframe.time < playhead)} onClick={() => { const previous = [...(clip.keyframes ?? [])].filter((keyframe) => keyframe.time < playhead).sort((a, b) => b.time - a.time)[0]; if (previous) onSeek(previous.time) }}>Anterior</button><button disabled={!clip.keyframes?.some((keyframe) => keyframe.time > playhead)} onClick={() => { const next = [...(clip.keyframes ?? [])].filter((keyframe) => keyframe.time > playhead).sort((a, b) => a.time - b.time)[0]; if (next) onSeek(next.time) }}>Siguiente</button></div><div className="keyframe-list">{[...(clip.keyframes ?? [])].sort((a, b) => a.time - b.time).map((keyframe) => <div key={`${keyframe.property}-${keyframe.time}`}><span>◇ {keyframe.property === 'position' ? 'Posición' : 'Escala'}</span><button onClick={() => onSeek(keyframe.time)}>{keyframe.time.toFixed(2)} s</button><button aria-label={`Eliminar fotograma clave ${keyframe.time}`} disabled={readOnly} onClick={() => setKeyframe(keyframe.property, keyframe.time)}>×</button></div>)}</div><p className="inspector-hint">Los fotogramas clave se guardan, pero aún no se interpolan.</p></InspectorSection>}
    </> : <div className="inspector-empty"><SlidersHorizontal size={22} /><span>{selectedMedia?.title ?? 'Selecciona un clip para editar sus propiedades'}</span>{selectedMedia && <><small>{mediaDescription}</small><button className="keyframe-button" onClick={onAddSelected}>＋ Añadir a la línea de tiempo</button></>}</div>}
    <div className="inspector-footer"><CircleHelp size={13} /> {clip ? `Editando propiedades de ${clip.kind === 'audio' ? 'audio' : 'vídeo'}` : 'Selecciona un clip para editar sus propiedades'}</div>
  </aside>
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  const id = `inspector-${title.toLowerCase().replaceAll(' ', '-')}`
  return <section className="inspector-section"><button type="button" className="inspector-section-title" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>{title}<ChevronDown size={13} /></button>{open && <div id={id}>{children}</div>}</section>
}

function Property({ label, x, y, defaultX, defaultY, suffix = '', disabled = false, onChange }: { label: string; x: number; y?: number; defaultX: number; defaultY?: number; suffix?: string; disabled?: boolean; onChange: (axis: Axis, value: number) => void }) {
  const drag = useRef<{ x: number; valueX: number; valueY?: number } | null>(null)
  const startDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || event.button !== 0) return
    event.preventDefault(); drag.current = { x: event.clientX, valueX: x, valueY: y }
    const move = (moveEvent: PointerEvent) => { if (!drag.current) return; const amount = Math.round((moveEvent.clientX - drag.current.x) / 2) * (moveEvent.shiftKey ? 10 : 1); onChange('x', drag.current.valueX + amount); if (drag.current.valueY !== undefined) onChange('y', drag.current.valueY + amount) }
    const end = () => { drag.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true })
  }
  const reset = () => { onChange('x', defaultX); if (defaultY !== undefined) onChange('y', defaultY) }
  return <div className="property-row"><span className="property-drag-label" title="Arrastra para ajustar; doble clic para restablecer" onPointerDown={startDrag} onDoubleClick={reset}>{label}</span><div className="property-values">{y !== undefined && <small>X</small>}<label><input aria-label={y === undefined ? label : `${label} X`} type="number" value={x} disabled={disabled} onChange={(event) => onChange('x', Number(event.target.value))} /><i>{suffix}</i></label>{y !== undefined && <><small>Y</small><label><input aria-label={`${label} Y`} type="number" value={y} disabled={disabled} onChange={(event) => onChange('y', Number(event.target.value))} /><i>{suffix}</i></label></>}</div><button type="button" className="property-reset" title={`Restablecer ${label}`} aria-label={`Restablecer ${label}`} disabled={disabled} onClick={reset}><RotateCcw size={11} /></button></div>
}
