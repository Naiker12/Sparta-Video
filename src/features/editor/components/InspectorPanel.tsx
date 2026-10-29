import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, CircleHelp, Copy, CopyPlus, Maximize2, MoreHorizontal, Plus, RotateCcw, Scissors, SlidersHorizontal, Type, Volume2 } from 'lucide-react'
import type { Clip, Keyframe, MediaItem, TextAnimation, TextStyle } from '../model'
import { ActionMenu } from './ActionMenu'
import { formatTimecode } from '../timecode'
import { t } from '../services/locale'
import {
  TEXT_ANIMATIONS_IN,
  TEXT_ANIMATIONS_LOOP,
  TEXT_ANIMATIONS_OUT,
  TEXT_FONT_FAMILIES,
  TEXT_STYLE_PRESETS,
  getDefaultTextAnimation,
  getDefaultTextStyle,
  getTextPreset,
} from '../services/text-presets'

type Props = {
  clip?: Clip
  selectedMedia?: MediaItem
  assets: MediaItem[]
  playhead: number
  sequenceSize: { width: number; height: number; frameRate?: number }
  readOnly?: boolean
  onAddSelected: () => void
  onAddTextClip?: (presetId?: string) => void
  onUpdateClip: (id: string, changes: Partial<Clip>) => void
  onSeek: (time: number) => void
  onResetClip: () => void
  onCopyClipName: (name: string) => void
  onSplitAtPlayhead?: () => void
  onDuplicateClip?: () => void
  onCalibrateAllSubtitles?: (sourceClipId: string) => void
  onNudgeAllSubtitlesTime?: (deltaSeconds: number) => void
}
type Tab = 'Clip' | 'Texto' | 'Audio' | 'Movimiento'
type Axis = 'x' | 'y'
type TransformKey = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation'

export function InspectorPanel({ clip, selectedMedia, assets, playhead, sequenceSize, readOnly = false, onAddSelected, onAddTextClip, onUpdateClip, onSeek, onResetClip, onCopyClipName, onSplitAtPlayhead, onDuplicateClip, onCalibrateAllSubtitles, onNudgeAllSubtitlesTime }: Props) {
  const [tab, setTab] = useState<Tab>('Clip')
  const fps = sequenceSize.frameRate ?? 24
  const isTextClip = !!clip && (clip.text !== undefined || clip.thumbnail === 'text-overlay')
  const textStyle: TextStyle = clip?.textStyle ?? getDefaultTextStyle()
  const textAnimation: TextAnimation = clip?.textAnimation ?? getDefaultTextAnimation(textStyle.presetId)
  const transform = clip?.transform ?? { x: sequenceSize.width / 2, y: sequenceSize.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }
  const clipMedia = clip ? assets.find((asset) => asset.title === clip.title || asset.id === clip.sourceAssetId) : selectedMedia
  const mediaDescription = isTextClip
    ? `${t('Texto Animado Pro', 'Pro Animated Text')} · ${(textAnimation.in || 'none').toUpperCase()}`
    : clipMedia
      ? `${clipMedia.type === 'audio' ? t('Audio', 'Audio') : clipMedia.type === 'image' ? t('Imagen', 'Image') : t('Vídeo', 'Video')} · ${clipMedia.status === 'ready' ? t('Listo', 'Ready') : clipMedia.status === 'catalog-only' ? t('Solo catálogo', 'Catalog only') : t('Datos limitados', 'Limited data')}`
      : t('Sin metadatos del medio', 'No media metadata')
  const canSplitHere = !!clip && !readOnly && playhead > clip.start + 1 / fps && playhead < clip.start + clip.duration - 1 / fps

  const updateTextStyle = (patch: Partial<TextStyle>) => {
    if (!clip || readOnly) return
    onUpdateClip(clip.id, {
      text: clip.text ?? clip.title,
      textStyle: { ...textStyle, ...patch },
    })
  }

  const updateTextAnimation = (patch: Partial<TextAnimation>) => {
    if (!clip || readOnly) return
    onUpdateClip(clip.id, {
      text: clip.text ?? clip.title,
      textAnimation: { ...textAnimation, ...patch },
    })
  }

  const applyTextPresetToClip = (presetId: string) => {
    if (!clip || readOnly) return
    const preset = getTextPreset(presetId)
    onUpdateClip(clip.id, {
      text: clip.text ?? preset.sampleText,
      textStyle: {
        ...preset.style,
        positionY: textStyle.positionY ?? preset.style.positionY,
        fontSize: textStyle.fontSize ?? preset.style.fontSize,
      },
      textAnimation: { ...preset.animation },
    })
  }
  const updateTransform = (key: TransformKey, value: number) => {
    if (!clip) return
    const next = { ...transform, [key]: value }
    if (clip.uniformScale && (key === 'scaleX' || key === 'scaleY')) next[key === 'scaleX' ? 'scaleY' : 'scaleX'] = value
    const roundedTime = Math.round(playhead * 1000) / 1000
    const keyframes = clip.keyframes
    const nextKeyframes = keyframes?.map((kf) => {
      if (kf.time === roundedTime) {
        if (kf.property === 'position' && (key === 'x' || key === 'y')) {
          return { ...kf, valueX: next.x, valueY: next.y }
        }
        if (kf.property === 'scale' && (key === 'scaleX' || key === 'scaleY')) {
          return { ...kf, valueX: next.scaleX, valueY: next.scaleY }
        }
      }
      return kf
    })
    const nextTextStyle =
      isTextClip && key === 'y'
        ? {
            ...textStyle,
            positionY: Math.max(6, Math.min(94, Math.round((value / Math.max(1, sequenceSize.height)) * 100))),
          }
        : undefined
    onUpdateClip(clip.id, {
      transform: next,
      ...(nextTextStyle ? { textStyle: nextTextStyle } : {}),
      ...(nextKeyframes ? { keyframes: nextKeyframes } : {}),
    })
  }
  const setKeyframe = (property: Keyframe['property'], time: number) => {
    if (!clip) return
    const keyframes = clip.keyframes ?? []
    const exists = keyframes.some((keyframe) => keyframe.property === property && keyframe.time === time)
    if (exists) {
      onUpdateClip(clip.id, { keyframes: keyframes.filter((keyframe) => !(keyframe.property === property && keyframe.time === time)) })
    } else {
      let newKeyframe: Keyframe
      if (property === 'position') {
        newKeyframe = { property, time, valueX: transform.x, valueY: transform.y }
      } else if (property === 'scale') {
        newKeyframe = { property, time, valueX: transform.scaleX, valueY: transform.scaleY }
      } else if (property === 'rotation') {
        newKeyframe = { property, time, value: transform.rotation }
      } else {
        newKeyframe = { property, time, value: clip.opacity ?? 100 }
      }
      onUpdateClip(clip.id, { keyframes: [...keyframes, newKeyframe] })
    }
  }
  const applyZoomPreset = (fromScale: number, toScale: number) => {
    if (!clip || readOnly) return
    const startT = Math.round(clip.start * 1000) / 1000
    const endT = Math.round((clip.start + clip.duration) * 1000) / 1000
    const others = (clip.keyframes ?? []).filter((kf) => kf.property !== 'scale')
    onUpdateClip(clip.id, {
      transform: { ...transform, scaleX: fromScale, scaleY: fromScale },
      keyframes: [
        ...others,
        { property: 'scale', time: startT, valueX: fromScale, valueY: fromScale },
        { property: 'scale', time: endT, valueX: toScale, valueY: toScale },
      ],
    })
  }
  return <aside className="inspector-panel">
    <div className="section-label">
      <span>{t('INSPECTOR', 'INSPECTOR')}</span>
      <ActionMenu label={t('Opciones del inspector', 'Inspector options')} items={[{ label: t('Restablecer controles del clip', 'Reset clip controls'), icon: RotateCcw, disabled: !clip || readOnly, onSelect: onResetClip }, { label: t('Copiar nombre del clip', 'Copy clip name'), icon: Copy, disabled: !clip, onSelect: () => { if (clip) onCopyClipName(clip.title) } }]}>
        <MoreHorizontal size={16} />
      </ActionMenu>
    </div>
    <div className="inspector-tabs" role="tablist" aria-label={t('Secciones del inspector', 'Inspector sections')}>
      {(['Clip', 'Texto', 'Audio', 'Movimiento'] as const).map((name) => {
        const label = name === 'Movimiento' ? t('Movimiento', 'Motion') : name === 'Texto' ? t('Texto', 'Text') : name
        return (
          <button key={name} role="tab" aria-label={label} aria-selected={tab === name} className={tab === name ? 'selected-tab' : ''} onClick={() => setTab(name)}>
            {label}
          </button>
        )
      })}
    </div>
    <div className="inspector-scroll-body">
      {clip ? <>
        <div className="inspector-clip">
          <div className={`inspector-thumb ${clip.thumbnail}`}>{isTextClip && <Type size={13} />}</div>
          <div className="inspector-clip-meta">
            <strong>{clip.title}</strong>
            <span>{mediaDescription} · {formatTimecode(clip.duration, fps)}</span>
          </div>
        </div>
        {readOnly && <p className="inspector-hint inspector-warning-hint">{t('Pista bloqueada · Desbloquéala en la línea de tiempo para editar este clip.', 'Track locked · Unlock it in the timeline to edit this clip.')}</p>}
        <div className="inspector-quick-actions">
          {onSplitAtPlayhead && (
            <button type="button" className="inspector-action-pill" disabled={!canSplitHere} onClick={onSplitAtPlayhead} title={t('Dividir clip en la posición del cabezal', 'Split clip at playhead')}>
              <Scissors size={12} /> {t('Cortar aquí', 'Split here')}
            </button>
          )}
          {onDuplicateClip && (
            <button type="button" className="inspector-action-pill" disabled={readOnly} onClick={onDuplicateClip} title={t('Duplicar clip en la pista', 'Duplicate clip on track')}>
              <CopyPlus size={12} /> {t('Duplicar', 'Duplicate')}
            </button>
          )}
          <button type="button" className="inspector-action-pill" disabled={readOnly} onClick={onResetClip} title={t('Restablecer propiedades del clip', 'Reset clip properties')}>
            <Maximize2 size={12} /> {t('Centrar', 'Center')}
          </button>
        </div>
        {tab === 'Clip' && <>
          {isTextClip && (
            <InspectorSection title={t('CALIBRACIÓN DE SUBTÍTULO', 'SUBTITLE CALIBRATION')}>
              <textarea
                aria-label={t('Texto en pantalla', 'On-screen text')}
                className="inspector-text-editor"
                rows={2}
                disabled={readOnly}
                value={clip.text ?? clip.title}
                onChange={(e) => {
                  const val = e.target.value
                  onUpdateClip(clip.id, {
                    text: val,
                    title: val.trim().length > 26 ? `${val.trim().slice(0, 26)}…` : (val.trim() || t('Subtítulo', 'Subtitle')),
                  })
                }}
              />
              <div className="subtitle-calib-grid">
                <div className="calib-slider-card">
                  <div className="calib-slider-header">
                    <span>{t('Altura Y', 'Vertical Y')}</span>
                    <span className="calib-slider-badge">{textStyle.positionY}%</span>
                  </div>
                  <input
                    aria-label={t('Altura vertical del subtítulo', 'Subtitle vertical height')}
                    type="range"
                    className="calib-range-input"
                    min="8"
                    max="92"
                    step="1"
                    disabled={readOnly}
                    value={textStyle.positionY}
                    onChange={(e) => {
                      const posY = Number(e.target.value)
                      onUpdateClip(clip.id, {
                        textStyle: { ...textStyle, positionY: posY },
                        transform: { ...transform, y: Math.round((posY / 100) * sequenceSize.height) },
                      })
                    }}
                  />
                </div>
                <div className="calib-slider-card">
                  <div className="calib-slider-header">
                    <span>{t('Tamaño letra', 'Font size')}</span>
                    <span className="calib-slider-badge">{textStyle.fontSize}px</span>
                  </div>
                  <input
                    aria-label={t('Tamaño de letra del subtítulo', 'Subtitle font size')}
                    type="range"
                    className="calib-range-input"
                    min="20"
                    max="96"
                    step="2"
                    disabled={readOnly}
                    value={textStyle.fontSize}
                    onChange={(e) => updateTextStyle({ fontSize: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="subtitle-timing-calib">
                <div className="subtitle-timing-item">
                  <div className="subtitle-timing-header">
                    <span>{t('Tiempo clip', 'Clip timing')}</span>
                    <span className="calib-time-readout">{clip.start.toFixed(2)}s</span>
                  </div>
                  <div className="subtitle-nudge-group-split">
                    <button
                      type="button"
                      disabled={readOnly}
                      className="calib-nudge-btn"
                      onClick={() => onUpdateClip(clip.id, { start: Math.max(0, Math.round((clip.start - 0.1) * 100) / 100) })}
                      title={t('Adelantar este subtítulo 0.1s', 'Move this subtitle 0.1s earlier')}
                    >
                      −0.1s
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      className="calib-nudge-btn"
                      onClick={() => onUpdateClip(clip.id, { start: Math.round((clip.start + 0.1) * 100) / 100 })}
                      title={t('Retrasar este subtítulo 0.1s', 'Delay this subtitle 0.1s')}
                    >
                      +0.1s
                    </button>
                  </div>
                </div>
                {onNudgeAllSubtitlesTime && (
                  <div className="subtitle-timing-item">
                    <div className="subtitle-timing-header">
                      <span>{t('Sincronizar pista', 'Sync track')}</span>
                    </div>
                    <div className="subtitle-nudge-grid-4">
                      <button type="button" disabled={readOnly} className="calib-nudge-btn" onClick={() => onNudgeAllSubtitlesTime(-0.2)} title="-0.20s">−0.2s</button>
                      <button type="button" disabled={readOnly} className="calib-nudge-btn" onClick={() => onNudgeAllSubtitlesTime(-0.05)} title="-0.05s">−0.05s</button>
                      <button type="button" disabled={readOnly} className="calib-nudge-btn" onClick={() => onNudgeAllSubtitlesTime(0.05)} title="+0.05s">+0.05s</button>
                      <button type="button" disabled={readOnly} className="calib-nudge-btn" onClick={() => onNudgeAllSubtitlesTime(0.2)} title="+0.20s">+0.2s</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="subtitle-calib-actions">
                {onCalibrateAllSubtitles && (
                  <button
                    type="button"
                    disabled={readOnly}
                    className="inspector-calibrate-all-btn"
                    onClick={() => onCalibrateAllSubtitles(clip.id)}
                  >
                    {t('Aplicar posición y tamaño a todos los subtítulos', 'Apply position & size to all subtitles')}
                  </button>
                )}
                <button
                  type="button"
                  className="inspector-goto-text-btn"
                  onClick={() => setTab('Texto')}
                >
                  <Type size={12} /> {t('Tipografía, color y animación →', 'Font, color & animation →')}
                </button>
              </div>
            </InspectorSection>
          )}
          <InspectorSection title={t('TRANSFORMACIÓN', 'TRANSFORM')}>
            <Property label={t('Posición', 'Position')} x={transform.x} y={transform.y} defaultX={sequenceSize.width / 2} defaultY={sequenceSize.height / 2} disabled={readOnly} onChange={(axis, value) => updateTransform(axis, value)} />
            <Property label={t('Escala', 'Scale')} x={transform.scaleX} y={transform.scaleY} defaultX={100} defaultY={100} suffix="%" disabled={readOnly} onChange={(axis, value) => updateTransform(axis === 'x' ? 'scaleX' : 'scaleY', value)} />
            <Property label={t('Rotación', 'Rotation')} x={transform.rotation} defaultX={0} suffix="°" disabled={readOnly} onChange={(_axis, value) => updateTransform('rotation', value)} />
            <button className="toggle-row inspector-toggle" role="switch" aria-checked={clip.uniformScale ?? true} disabled={readOnly} onClick={() => onUpdateClip(clip.id, { uniformScale: !(clip.uniformScale ?? true) })}>
              <span>{t('Escala uniforme', 'Uniform scale')}</span>
              <span className={`toggle ${(clip.uniformScale ?? true) ? 'on' : ''}`}><i /></span>
            </button>
          </InspectorSection>
          <InspectorSection title={t('OPACIDAD', 'OPACITY')}>
            <div className="slider-row">
              <input aria-label={t('Opacidad', 'Opacity')} type="range" min="0" max="100" value={clip.opacity ?? 100} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { opacity: Number(event.target.value) })} />
              <span className="slider-value-badge">{clip.opacity ?? 100}%</span>
            </div>
            <div className="toggle-row">
              <span>{t('Modo de mezcla', 'Blend mode')}</span>
              <select aria-label={t('Modo de mezcla', 'Blend mode')} className="select-button" value={clip.blendMode ?? 'normal'} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { blendMode: event.target.value as Clip['blendMode'] })}>
                <option value="normal">{t('Normal', 'Normal')}</option>
                <option value="multiply">{t('Multiplicar', 'Multiply')}</option>
                <option value="screen">{t('Trama', 'Screen')}</option>
                <option value="overlay">{t('Superponer', 'Overlay')}</option>
              </select>
            </div>
          </InspectorSection>
        </>}
        {tab === 'Texto' && (
          <>
            {!isTextClip && (
              <div className="inspector-convert-banner">
                <p>{t('Este es un clip de medio. Puedes superponerle texto o insertar una capa dedicada en el cabezal.', 'This is a media clip. You can overlay text on it or insert a dedicated text layer at playhead.')}</p>
                <div className="inspector-preset-pills">
                  {onAddTextClip && (
                    <button type="button" onClick={() => onAddTextClip('hormozi-karaoke')}>
                      <Plus size={11} /> {t('Nueva capa de subtítulo', 'New subtitle layer')}
                    </button>
                  )}
                  <button type="button" disabled={readOnly} onClick={() => applyTextPresetToClip('hormozi-karaoke')}>
                    <Type size={11} /> {t('Activar texto en este clip', 'Enable text on this clip')}
                  </button>
                </div>
              </div>
            )}
            <InspectorSection title={t('TEXTO Y PLANTILLAS PRO', 'PRO TEXT & PRESETS')}>
              <textarea
                aria-label={t('Contenido del subtítulo o título', 'Subtitle or title content')}
                className="inspector-text-editor"
                rows={2}
                disabled={readOnly}
                placeholder={t('Escribe el texto o subtítulo aquí…', 'Type text or subtitle here…')}
                value={clip.text ?? clip.title}
                onChange={(e) => {
                  const val = e.target.value
                  onUpdateClip(clip.id, {
                    text: val,
                    title: val.trim().length > 26 ? `${val.trim().slice(0, 26)}…` : (val.trim() || t('Subtítulo', 'Subtitle')),
                    textStyle,
                    textAnimation,
                  })
                }}
              />
              {isTextClip && onCalibrateAllSubtitles && (
                <button
                  type="button"
                  disabled={readOnly}
                  className="inspector-calibrate-all-btn"
                  onClick={() => onCalibrateAllSubtitles(clip.id)}
                >
                  {t('Aplicar estilo y calibración a todos los subtítulos', 'Apply style & calibration to all subtitles')}
                </button>
              )}
              <div className="inspector-preset-chips-grid">
                {TEXT_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={readOnly}
                    className={`inspector-preset-mini-card ${textStyle.presetId === preset.id ? 'active' : ''}`}
                    onClick={() => applyTextPresetToClip(preset.id)}
                  >
                    <span className="preset-mini-tag">{preset.badge}</span>
                    <strong>{t(preset.name, preset.nameEn)}</strong>
                  </button>
                ))}
              </div>
            </InspectorSection>

            <InspectorSection title={t('TIPOGRAFÍA Y DISEÑO', 'TYPOGRAPHY & LAYOUT')}>
              <div className="toggle-row">
                <span>{t('Fuente', 'Font')}</span>
                <select
                  aria-label={t('Familia tipográfica', 'Font family')}
                  className="select-button"
                  disabled={readOnly}
                  value={textStyle.fontFamily}
                  onChange={(e) => updateTextStyle({ fontFamily: e.target.value })}
                >
                  {TEXT_FONT_FAMILIES.map((f) => (
                    <option key={f.id} value={f.css}>{f.label}</option>
                  ))}
                </select>
              </div>
              <label className="toggle-row">
                <span>{t('Tamaño', 'Size')} <small className="fade-val">{textStyle.fontSize}px</small></span>
                <input
                  aria-label={t('Tamaño de fuente', 'Font size')}
                  type="range"
                  min="20"
                  max="110"
                  step="2"
                  disabled={readOnly}
                  value={textStyle.fontSize}
                  onChange={(e) => updateTextStyle({ fontSize: Number(e.target.value) })}
                />
              </label>
              <label className="toggle-row">
                <span>{t('Altura Y', 'Vertical Y')} <small className="fade-val">{textStyle.positionY}%</small></span>
                <input
                  aria-label={t('Posición vertical del texto', 'Text vertical position')}
                  type="range"
                  min="10"
                  max="90"
                  step="1"
                  disabled={readOnly}
                  value={textStyle.positionY}
                  onChange={(e) => updateTextStyle({ positionY: Number(e.target.value) })}
                />
              </label>
              <div className="inspector-align-bar">
                <div className="align-group" role="group" aria-label={t('Alineación de texto', 'Text alignment')}>
                  {(['left', 'center', 'right'] as const).map((alignVal) => (
                    <button
                      key={alignVal}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={textStyle.align === alignVal}
                      className={`align-btn ${textStyle.align === alignVal ? 'active' : ''}`}
                      onClick={() => updateTextStyle({ align: alignVal })}
                      title={alignVal}
                    >
                      {alignVal === 'left' ? <AlignLeft size={13} /> : alignVal === 'center' ? <AlignCenter size={13} /> : <AlignRight size={13} />}
                    </button>
                  ))}
                </div>
                <div className="align-group">
                  <button
                    type="button"
                    disabled={readOnly}
                    aria-pressed={textStyle.uppercase}
                    className={`align-btn text-style-btn ${textStyle.uppercase ? 'active' : ''}`}
                    onClick={() => updateTextStyle({ uppercase: !textStyle.uppercase })}
                    title={t('Mayúsculas', 'Uppercase')}
                  >
                    AA
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    aria-pressed={textStyle.italic}
                    className={`align-btn text-style-btn ${textStyle.italic ? 'active' : ''}`}
                    onClick={() => updateTextStyle({ italic: !textStyle.italic })}
                    title={t('Cursiva', 'Italic')}
                  >
                    <em>I</em>
                  </button>
                </div>
                <div className="align-group">
                  <button type="button" disabled={readOnly} className="align-btn text-pos-chip" onClick={() => updateTextStyle({ positionY: 18 })}>Top</button>
                  <button type="button" disabled={readOnly} className="align-btn text-pos-chip" onClick={() => updateTextStyle({ positionY: 50 })}>Mid</button>
                  <button type="button" disabled={readOnly} className="align-btn text-pos-chip" onClick={() => updateTextStyle({ positionY: 80 })}>Sub</button>
                </div>
              </div>
            </InspectorSection>

            <InspectorSection title={t('COLOR, TRAZO Y CAJA', 'COLOR, STROKE & PILL')}>
              <div className="inspector-color-grid">
                <label className="color-swatch-field">
                  <span>{t('Texto', 'Text')}</span>
                  <input type="color" disabled={readOnly} value={textStyle.color} onChange={(e) => updateTextStyle({ color: e.target.value })} />
                </label>
                <label className="color-swatch-field">
                  <span>{t('Karaoke / Acento', 'Highlight')}</span>
                  <input type="color" disabled={readOnly} value={textStyle.accentColor} onChange={(e) => updateTextStyle({ accentColor: e.target.value })} />
                </label>
                <label className="color-swatch-field">
                  <span>{t('Borde', 'Stroke')}</span>
                  <input type="color" disabled={readOnly} value={textStyle.strokeColor} onChange={(e) => updateTextStyle({ strokeColor: e.target.value })} />
                </label>
                <label className="color-swatch-field">
                  <span>{t('Caja', 'Box')}</span>
                  <input type="color" disabled={readOnly} value={textStyle.backgroundColor} onChange={(e) => updateTextStyle({ backgroundColor: e.target.value })} />
                </label>
              </div>
              <label className="toggle-row">
                <span>{t('Grosor borde', 'Stroke width')} <small className="fade-val">{textStyle.strokeWidth}px</small></span>
                <input
                  aria-label={t('Grosor de borde', 'Stroke width')}
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  disabled={readOnly}
                  value={textStyle.strokeWidth}
                  onChange={(e) => updateTextStyle({ strokeWidth: Number(e.target.value) })}
                />
              </label>
              <label className="toggle-row">
                <span>{t('Fondo pastilla', 'Pill opacity')} <small className="fade-val">{textStyle.backgroundOpacity}%</small></span>
                <input
                  aria-label={t('Opacidad de fondo de texto', 'Text background opacity')}
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  disabled={readOnly}
                  value={textStyle.backgroundOpacity}
                  onChange={(e) => updateTextStyle({ backgroundOpacity: Number(e.target.value) })}
                />
              </label>
            </InspectorSection>

            <InspectorSection title={t('ANIMACIÓN CAPCUT PRO', 'CAPCUT PRO ANIMATION')}>
              <span className="inspector-sub-kicker">{t('ANIMACIÓN DE ENTRADA / DINÁMICA', 'IN / KINETIC ANIMATION')}</span>
              <div className="inspector-anim-grid" role="group" aria-label={t('Animación de entrada', 'Entry animation')}>
                {TEXT_ANIMATIONS_IN.map((anim) => (
                  <button
                    key={anim.id}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={textAnimation.in === anim.id}
                    className={`inspector-anim-card ${textAnimation.in === anim.id ? 'active' : ''}`}
                    onClick={() => updateTextAnimation({ in: anim.id })}
                  >
                    <span className="anim-card-tag">{anim.tag}</span>
                    <strong>{t(anim.label, anim.labelEn)}</strong>
                  </button>
                ))}
              </div>
              <label className="toggle-row">
                <span>{t('Velocidad entrada', 'In speed')} <small className="fade-val">{textAnimation.inDuration.toFixed(2)}s</small></span>
                <input
                  aria-label={t('Duración de entrada', 'In animation duration')}
                  type="range"
                  min="0.15"
                  max="1.5"
                  step="0.05"
                  disabled={readOnly}
                  value={textAnimation.inDuration}
                  onChange={(e) => updateTextAnimation({ inDuration: Number(e.target.value) })}
                />
              </label>
              <div className="toggle-row">
                <span>{t('Salida', 'Out animation')}</span>
                <select
                  aria-label={t('Animación de salida', 'Out animation')}
                  className="select-button"
                  disabled={readOnly}
                  value={textAnimation.out}
                  onChange={(e) => updateTextAnimation({ out: e.target.value as TextAnimation['out'] })}
                >
                  {TEXT_ANIMATIONS_OUT.map((a) => (
                    <option key={a.id} value={a.id}>{t(a.label, a.labelEn)}</option>
                  ))}
                </select>
              </div>
              <div className="toggle-row">
                <span>{t('Bucle continuo', 'Loop FX')}</span>
                <select
                  aria-label={t('Animación de bucle', 'Loop animation')}
                  className="select-button"
                  disabled={readOnly}
                  value={textAnimation.loop}
                  onChange={(e) => updateTextAnimation({ loop: e.target.value as TextAnimation['loop'] })}
                >
                  {TEXT_ANIMATIONS_LOOP.map((a) => (
                    <option key={a.id} value={a.id}>{t(a.label, a.labelEn)}</option>
                  ))}
                </select>
              </div>
            </InspectorSection>
          </>
        )}
        {tab === 'Audio' && (
          <InspectorSection title={t('MEZCLADOR DE AUDIO','AUDIO MIXER')}>
            <div className="slider-row">
              <Volume2 size={14} />
              <input aria-label={t('Volumen del clip','Clip volume')} type="range" min="0" max="150" value={clip.volume ?? 100} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { volume: Number(event.target.value) })} />
              <span className="slider-value-badge">{clip.volume ?? 100}%</span>
            </div>
            <div className="decorative-meter" aria-label={t('Medidor decorativo de nivel de audio','Audio level visual meter')}>
              <i style={{ width: `${Math.min(100, clip.volume ?? 100)}%` }} />
            </div>
            <label className="toggle-row">
              <span>{t('Fundido de entrada','Fade in')} <small className="fade-val">{(clip.fadeIn ?? 0).toFixed(1)}s</small></span>
              <input aria-label={t('Fundido de entrada','Fade in')} type="range" min="0" max="5" step="0.1" value={clip.fadeIn ?? 0} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { fadeIn: Number(event.target.value) })} />
            </label>
            <div className="fade-preview">
              <i className="fade-in-ramp" style={{ width: `${Math.min(50, (clip.fadeIn ?? 0) / Math.max(clip.duration, 0.1) * 100)}%` }} />
              <i className="fade-out-ramp" style={{ width: `${Math.min(50, (clip.fadeOut ?? 0) / Math.max(clip.duration, 0.1) * 100)}%` }} />
            </div>
            <label className="toggle-row">
              <span>{t('Fundido de salida','Fade out')} <small className="fade-val">{(clip.fadeOut ?? 0).toFixed(1)}s</small></span>
              <input aria-label={t('Fundido de salida','Fade out')} type="range" min="0" max="5" step="0.1" value={clip.fadeOut ?? 0} disabled={readOnly} onChange={(event) => onUpdateClip(clip.id, { fadeOut: Number(event.target.value) })} />
            </label>
            <div className="inspector-preset-pills">
              <button type="button" disabled={readOnly} onClick={() => onUpdateClip(clip.id, { volume: 100, fadeIn: 0.2, fadeOut: 0.2 })}>{t('Voz 100%', 'Voice 100%')}</button>
              <button type="button" disabled={readOnly} onClick={() => onUpdateClip(clip.id, { volume: 35, fadeIn: 0.8, fadeOut: 0.8 })}>{t('Fondo 35%', 'Bed 35%')}</button>
              <button type="button" disabled={readOnly} onClick={() => onUpdateClip(clip.id, { fadeIn: 0.5, fadeOut: 0.5 })}>{t('Fundido 0.5s', 'Fade 0.5s')}</button>
            </div>
            <p className="inspector-hint">{t('El volumen y fundidos se aplican en la reproducción y en la mezcla final exportada.','Volume and fades are applied during playback and in the exported mixdown.')}</p>
          </InspectorSection>
        )}
        {tab === 'Movimiento' && (
          <InspectorSection title={t('MOVIMIENTO','MOTION')}>
            {(['position', 'scale'] as const).map((property) => {
              const active = (clip.keyframes ?? []).some((keyframe) => keyframe.property === property && keyframe.time === Math.round(playhead * 1000) / 1000)
              return (
                <div className="toggle-row" key={property}>
                  <span>{property === 'position' ? t('Posición','Position') : t('Escala','Scale')}</span>
                  <button className={`keyframe-button ${active ? 'active' : ''}`} disabled={readOnly} onClick={() => setKeyframe(property, Math.round(playhead * 1000) / 1000)}>
                    {active ? t('◇ Quitar fotograma clave','◇ Remove keyframe') : <>◇ {t('Añadir fotograma clave','Add keyframe')}</>}
                  </button>
                </div>
              )
            })}
            <div className="inspector-preset-pills">
              <button type="button" disabled={readOnly} onClick={() => applyZoomPreset(100, 118)}>
                <Maximize2 size={11} /> {t('Zoom In suave', 'Smooth Zoom In')}
              </button>
              <button type="button" disabled={readOnly} onClick={() => applyZoomPreset(118, 100)}>
                <Maximize2 size={11} /> {t('Zoom Out suave', 'Smooth Zoom Out')}
              </button>
            </div>
            <div className="keyframe-navigation">
              <button disabled={!clip.keyframes?.some((keyframe) => keyframe.time < playhead)} onClick={() => { const previous = [...(clip.keyframes ?? [])].filter((keyframe) => keyframe.time < playhead).sort((a, b) => b.time - a.time)[0]; if (previous) onSeek(previous.time) }}>{t('Anterior','Previous')}</button>
              <button disabled={!clip.keyframes?.some((keyframe) => keyframe.time > playhead)} onClick={() => { const next = [...(clip.keyframes ?? [])].filter((keyframe) => keyframe.time > playhead).sort((a, b) => a.time - b.time)[0]; if (next) onSeek(next.time) }}>{t('Siguiente','Next')}</button>
            </div>
            <div className="keyframe-list">
              {[...(clip.keyframes ?? [])].sort((a, b) => a.time - b.time).map((keyframe) => (
                <div className="keyframe-item" key={`${keyframe.property}-${keyframe.time}`}>
                  <span>◇ {keyframe.property === 'position' ? t('Posición','Position') : t('Escala','Scale')}</span>
                  <button type="button" className="keyframe-time-btn" onClick={() => onSeek(keyframe.time)}>{keyframe.time.toFixed(2)} s</button>
                  <button type="button" className="keyframe-del-btn" aria-label={`Eliminar fotograma clave ${keyframe.time}`} disabled={readOnly} onClick={() => setKeyframe(keyframe.property, keyframe.time)}>×</button>
                </div>
              ))}
            </div>
            <p className="inspector-hint">{t('Los fotogramas clave interpolan suavemente posición y escala en tiempo real y en la exportación.','Keyframes smoothly interpolate position and scale in real-time and export.')}</p>
          </InspectorSection>
        )}
      </> : (
        <div className="inspector-empty">
          <SlidersHorizontal size={20} />
          <span>{selectedMedia?.title ?? t('Selecciona un clip para editar sus propiedades','Select a clip to edit its properties')}</span>
          {selectedMedia && (
            <>
              <small>{mediaDescription}</small>
              <button className="keyframe-button primary-pill" onClick={onAddSelected}>{t('＋ Añadir a la línea de tiempo','＋ Add to timeline')}</button>
            </>
          )}
        </div>
      )}
    </div>
    <div className="inspector-footer">
      <CircleHelp size={13} />
      <span>
        {clip
          ? isTextClip
            ? `${t('Calibrando subtítulo', 'Calibrating subtitle')} · ${formatTimecode(clip.start, fps)}`
            : `${t('Editando propiedades de', 'Editing properties of')} ${clip.kind === 'audio' ? 'audio' : t('vídeo', 'video')}`
          : `${sequenceSize.width} × ${sequenceSize.height} · ${fps} fps`}
      </span>
    </div>
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
  return <div className="property-row"><span className="property-drag-label" title={t('Arrastra para ajustar; doble clic para restablecer','Drag to adjust; double-click to reset')} onPointerDown={startDrag} onDoubleClick={reset}>{label}</span><div className="property-values">{y !== undefined && <small>X</small>}<label><input aria-label={y === undefined ? label : (label === t('Posición','Position') ? 'Position X' : `${label} X`)} type="number" value={x} disabled={disabled} onChange={(event) => onChange('x', Number(event.target.value))} /><i>{suffix}</i></label>{y !== undefined && <><small>Y</small><label><input aria-label={label === t('Posición','Position') ? 'Position Y' : `${label} Y`} type="number" value={y} disabled={disabled} onChange={(event) => onChange('y', Number(event.target.value))} /><i>{suffix}</i></label></>}</div><button type="button" className="property-reset" title={`Restablecer ${label}`} aria-label={`Restablecer ${label}`} disabled={disabled} onClick={reset}><RotateCcw size={11} /></button></div>
}
