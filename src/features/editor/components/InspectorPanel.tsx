import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, CircleHelp, Copy, MoreHorizontal, RotateCcw, SlidersHorizontal, Volume2 } from 'lucide-react'
import type { Clip, MediaItem } from '../model'
import { ActionMenu } from './ActionMenu'

type Props = { clip?: Clip; selectedMedia?: MediaItem; playhead: number; readOnly?: boolean; onAddSelected: () => void; onUpdateClip: (id: string, changes: Partial<Clip>) => void; onResetClip: () => void; onCopyClipName: (name: string) => void }
type Tab = 'Clip' | 'Audio' | 'Motion'
type Axis = 'x' | 'y'
const transformDefault = { x: 960, y: 540, scaleX: 100, scaleY: 100, rotation: 0 }

export function InspectorPanel({ clip, selectedMedia, playhead, readOnly = false, onAddSelected, onUpdateClip, onResetClip, onCopyClipName }: Props) {
  const [tab, setTab] = useState<Tab>('Clip')
  const transform = clip?.transform ?? transformDefault
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
  return <aside className="inspector-panel"><div className="section-label"><span>INSPECTOR</span><ActionMenu label="Inspector options" items={[{ label: 'Reset clip controls', icon: RotateCcw, disabled: !clip || readOnly, onSelect: onResetClip }, { label: 'Copy clip name', icon: Copy, disabled: !clip, onSelect: () => { if (clip) onCopyClipName(clip.title) } }]}><MoreHorizontal size={16} /></ActionMenu></div>
    <div className="inspector-tabs" role="tablist" aria-label="Inspector sections">{(['Clip', 'Audio', 'Motion'] as const).map((name) => <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? 'selected-tab' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
    {clip ? <><div className="inspector-clip"><div className={`inspector-thumb ${clip.thumbnail}`} /><div><strong>{clip.title}</strong><span>{clip.kind === 'audio' ? 'Audio clip · WAV' : 'Video clip · 4K'}</span></div></div>{readOnly && <p className="inspector-hint">Track locked · unlock it in the timeline to edit this clip.</p>}
      {tab === 'Clip' && <><InspectorSection title="TRANSFORM"><Property label="Position" x={transform.x} y={transform.y} disabled={readOnly} onChange={(axis, value) => updateTransform(axis, value)} /><Property label="Scale" x={transform.scaleX} y={transform.scaleY} suffix="%" disabled={readOnly} onChange={(axis, value) => updateTransform(axis === 'x' ? 'scaleX' : 'scaleY', value)} /><Property label="Rotation" x={transform.rotation} suffix="°" disabled={readOnly} onChange={(_axis, value) => updateTransform('rotation', value)} /><button className="toggle-row inspector-toggle" role="switch" aria-checked={clip.uniformScale ?? true} disabled={readOnly} onClick={() => onUpdateClip(clip.id, { uniformScale: !(clip.uniformScale ?? true) })}><span>Uniform scale</span><span className={`toggle ${(clip.uniformScale ?? true) ? 'on' : ''}`}><i /></span></button></InspectorSection><InspectorSection title="OPACITY"><div className="slider-row"><input aria-label="Opacity" type="range" min="0" max="100" value={clip.opacity ?? 100} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { opacity: Number(event.target.value) })} /><span>{clip.opacity ?? 100}%</span></div><div className="toggle-row"><span>Blend mode</span><select aria-label="Blend mode" className="select-button" value={clip.blendMode ?? 'normal'} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { blendMode: event.target.value as Clip['blendMode'] })}><option value="normal">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select></div></InspectorSection></>}
      {tab === 'Audio' && <InspectorSection title="AUDIO MIXER"><div className="slider-row"><Volume2 size={14} /><input aria-label="Clip volume" type="range" min="0" max="150" value={clip.volume ?? 100} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { volume: Number(event.target.value) })} /><span>{clip.volume ?? 100}%</span></div><label className="toggle-row">Fade in <input aria-label="Fade in" type="range" min="0" max="5" step="0.1" value={clip.fadeIn ?? 0} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { fadeIn: Number(event.target.value) })} /></label><label className="toggle-row">Fade out <input aria-label="Fade out" type="range" min="0" max="5" step="0.1" value={clip.fadeOut ?? 0} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { fadeOut: Number(event.target.value) })} /></label><p className="inspector-hint">Los niveles se guardan en el proyecto; todavía no alteran el audio reproducido.</p></InspectorSection>}
      {tab === 'Motion' && <InspectorSection title="MOTION">{(['position', 'scale'] as const).map((property) => { const active = (clip.keyframes ?? []).some((keyframe) => keyframe.property === property && keyframe.time === Math.round(playhead * 1000) / 1000); return <div className="toggle-row" key={property}><span>{property === 'position' ? 'Position' : 'Scale'}</span><button className="keyframe-button" disabled={readOnly} onClick={() => setKeyframe(property, Math.round(playhead * 1000) / 1000)}>{active ? '◇ Remove keyframe' : '◇ Add keyframe'}</button></div> })}<p className="inspector-hint">Los keyframes se registran en el proyecto; interpolación aún no implementada.</p></InspectorSection>}
    </> : <div className="inspector-empty"><SlidersHorizontal size={22} /><span>{selectedMedia?.title ?? 'Select a clip to adjust its properties'}</span>{selectedMedia && <button className="keyframe-button" onClick={onAddSelected}>＋ Add to timeline</button>}</div>}
    <div className="inspector-footer"><CircleHelp size={13} /> {clip ? `Editing ${clip.kind} properties` : 'Select a clip to edit its properties'}</div>
  </aside>
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  const id = `inspector-${title.toLowerCase().replaceAll(' ', '-')}`
  return <section className="inspector-section"><button type="button" className="inspector-section-title" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>{title}<ChevronDown size={13} /></button>{open && <div id={id}>{children}</div>}</section>
}

function Property({ label, x, y, suffix = '', disabled = false, onChange }: { label: string; x: number; y?: number; suffix?: string; disabled?: boolean; onChange: (axis: Axis, value: number) => void }) {
  return <div className="property-row"><span>{label}</span><div className="property-values"><label><input aria-label={y === undefined ? label : `${label} X`} type="number" value={x} disabled={disabled} onChange={(event) => onChange('x', Number(event.target.value))} /><i>{suffix}</i></label>{y !== undefined && <label><input aria-label={`${label} Y`} type="number" value={y} disabled={disabled} onChange={(event) => onChange('y', Number(event.target.value))} /><i>{suffix}</i></label>}</div></div>
}
