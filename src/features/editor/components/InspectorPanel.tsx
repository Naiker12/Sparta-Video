import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, Copy, CopyPlus, Film, Maximize2, MoreHorizontal, Plus, RotateCcw, Scissors, Settings, SlidersHorizontal, Snowflake, Sparkles, Trash2, Type, Upload, Volume2 } from 'lucide-react'
import type { Clip, EffectInstance, Keyframe, MediaItem, TextAnimation, TextStyle } from '../model'
import { ADJUST_PARAMS, EFFECT_CATALOG, createEffectInstance, getEffectDef, registerCustomLutFilter } from '../effects/catalog'
import { parseCubeLUT } from '../effects/lut-parser'
import { toast } from '../../../components/ui/toast'
import { ActionMenu } from './ActionMenu'
import { formatTimecode } from '../timecode'
import { t } from '../services/locale'
import { Switch } from '../../../components/ui/switch'
import { Slider } from '../../../components/ui/slider'
import { Input } from '../../../components/ui/input'
import { AccordionSection } from '../../../components/ui/accordion'
import { cn } from '../../../lib/utils'
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
  onFreezeFrame?: (clipId: string, time: number) => void
  onCalibrateAllSubtitles?: (sourceClipId: string) => void
  onNudgeAllSubtitlesTime?: (deltaSeconds: number) => void
}
type Tab = 'Clip' | 'Texto' | 'Audio' | 'Movimiento' | 'Efectos' | 'Ajustar'
type TransformKey = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation'

export function InspectorPanel({ clip, selectedMedia, assets, playhead, sequenceSize, readOnly = false, onAddSelected, onAddTextClip, onUpdateClip, onSeek, onResetClip, onCopyClipName, onSplitAtPlayhead, onDuplicateClip, onFreezeFrame, onCalibrateAllSubtitles, onNudgeAllSubtitlesTime }: Props) {
  const [tab, setTab] = useState<Tab>('Efectos')
  const [openTransform] = useState(true)
  const [openFit] = useState(true)
  const [openCrop] = useState(true)
  const [openOpacity] = useState(true)
  const fps = sequenceSize.frameRate ?? 24
  const isTextClip = !!clip && (clip.text !== undefined || clip.thumbnail === 'text-overlay')
  const textStyle: TextStyle = clip?.textStyle ?? getDefaultTextStyle()
  const textAnimation: TextAnimation = clip?.textAnimation ?? getDefaultTextAnimation(textStyle.presetId)
  const transform = clip?.transform ?? { x: sequenceSize.width / 2, y: sequenceSize.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }
  const clipMedia = clip ? assets.find((asset) => asset.title === clip.title || asset.id === clip.sourceAssetId) : selectedMedia
  const mediaDescription = isTextClip
    ? `${t('Texto Animado', 'Animated Text')} · ${(textAnimation.in || 'none').toUpperCase()}`
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
  const updateCrop = (edge: 'l' | 'r' | 't' | 'b', val: number) => {
    if (!clip || readOnly) return
    const currentCrop = clip.crop ?? { l: 0, r: 0, t: 0, b: 0 }
    onUpdateClip(clip.id, { crop: { ...currentCrop, [edge]: Math.max(0, val) } })
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
  return <aside className="inspector-panel flex flex-col h-full bg-card overflow-hidden select-none">
    <span className="sr-only">{t('INSPECTOR', 'INSPECTOR')}</span>
    <div className="h-9 px-2 flex items-center justify-between border-b border-border bg-card shrink-0 gap-1">
      <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar" role="tablist" aria-label={t('Secciones del inspector', 'Inspector sections')}>
        {(['Clip', 'Texto', 'Audio', 'Movimiento', 'Efectos'] as const).map((name) => {
          const label =
            name === 'Movimiento'
              ? t('Movimiento', 'Motion')
              : name === 'Texto'
                ? t('Texto', 'Text')
                : name === 'Efectos'
                  ? t('Efectos', 'Effects')
                  : name
          const isActive = tab === name
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={isActive}
              className={cn(
                'flex-1 py-1 px-2 rounded-[6px] text-xs font-medium transition-all text-center cursor-pointer select-none',
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )}
              onClick={() => setTab(name)}
            >
              {label}
            </button>
          )
        })}
      </div>
      <ActionMenu
        label={t('Opciones del inspector', 'Inspector options')}
        triggerClass="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer shrink-0"
        items={[
          { label: t('Restablecer controles del clip', 'Reset clip controls'), icon: RotateCcw, disabled: !clip || readOnly, onSelect: onResetClip },
          { label: t('Copiar nombre del clip', 'Copy clip name'), icon: Copy, disabled: !clip, onSelect: () => { if (clip) onCopyClipName(clip.title) } },
        ]}
      >
        <MoreHorizontal size={14} />
      </ActionMenu>
    </div>
    <div className="inspector-scroll-body flex-1 overflow-y-auto p-3 pb-14 space-y-3">
      {clip ? <>
        <span className="sr-only">{clip.title}</span>
        {readOnly && (
          <p className="text-xs px-3 py-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-[6px] mb-2">
            {t('Pista bloqueada · Desbloquéala en la línea de tiempo para editar este clip.', 'Track locked · Unlock it in the timeline to edit this clip.')}
          </p>
        )}
        {tab === 'Clip' && <>
          <div className="flex items-center gap-2.5 p-2 rounded-[6px] bg-secondary border border-border/50">
            <div className={cn(
              "w-10 h-10 rounded-[6px] flex items-center justify-center shrink-0",
              isTextClip ? "bg-[#c0558f]/20 text-[#c0558f]" :
              clipMedia?.type === 'audio' ? "bg-[#3fae68]/20 text-[#3fae68]" :
              clipMedia?.type === 'image' ? "bg-amber-500/20 text-amber-400" :
              "bg-[#3b6fd4]/20 text-[#3b6fd4]"
            )}>
              {isTextClip ? <Type size={18} /> : clipMedia?.type === 'audio' ? <Volume2 size={18} /> : <Film size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <strong className="block text-[13px] font-semibold text-foreground truncate">{clip.title}</strong>
              <span className="block text-[11px] text-muted-foreground truncate">{mediaDescription} · {formatTimecode(clip.duration, fps)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {onSplitAtPlayhead && (
              <button type="button" className="flex-1 h-7 rounded-[6px] bg-secondary border-0 text-xs text-foreground hover:bg-input flex items-center justify-center gap-1 cursor-pointer transition-colors" disabled={!canSplitHere} onClick={onSplitAtPlayhead} title={t('Dividir clip en la posición del cabezal', 'Split clip at playhead')}>
                <Scissors size={12} /> {t('Cortar aquí', 'Split here')}
              </button>
            )}
            {onDuplicateClip && (
              <button type="button" className="flex-1 h-7 rounded-[6px] bg-secondary border-0 text-xs text-foreground hover:bg-input flex items-center justify-center gap-1 cursor-pointer transition-colors" disabled={readOnly} onClick={onDuplicateClip} title={t('Duplicar clip en la pista', 'Duplicate clip on track')}>
                <CopyPlus size={12} /> {t('Duplicar', 'Duplicate')}
              </button>
            )}
            <button type="button" className="flex-1 h-7 rounded-[6px] bg-secondary border-0 text-xs text-foreground hover:bg-input flex items-center justify-center gap-1 cursor-pointer transition-colors" disabled={readOnly} onClick={onResetClip} title={t('Restablecer propiedades del clip', 'Reset clip properties')}>
              <Maximize2 size={12} /> {t('Centrar', 'Center')}
            </button>
          </div>
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
              <div className="subtitle-calib-actions flex flex-col gap-2 pt-2">
                {onCalibrateAllSubtitles && (
                  <button
                    type="button"
                    disabled={readOnly}
                    className="w-full py-1.5 px-3 rounded-[6px] bg-primary/18 text-primary hover:bg-primary/25 border-0 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    onClick={() => onCalibrateAllSubtitles(clip.id)}
                  >
                    {t('Aplicar posición y tamaño a todos los subtítulos', 'Apply position & size to all subtitles')}
                  </button>
                )}
                <button
                  type="button"
                  className="w-full py-1.5 px-3 rounded-[6px] bg-[#6c5ce0]/18 text-[#a99cff] hover:bg-[#6c5ce0]/25 border-0 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  onClick={() => setTab('Texto')}
                >
                  <Type size={12} /> {t('Tipografía, color y animación →', 'Font, color & animation →')}
                </button>
              </div>
            </InspectorSection>
          )}
          <AccordionSection title={t('Transformación', 'Transformation')} defaultOpen={openTransform}>
            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="w-[70px] text-muted-foreground shrink-0">{t('Posición', 'Position')}</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[11px] text-muted-foreground font-mono">X</span>
                    <Input
                      type="number"
                      step="0.5"
                      aria-label="Position X"
                      disabled={readOnly}
                      value={Math.round(transform.x * 10) / 10}
                      onChange={(e) => updateTransform('x', Number(e.target.value))}
                      className="h-[26px] text-xs bg-input border-border/70 tabular-nums text-center font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[11px] text-muted-foreground font-mono">Y</span>
                    <Input
                      type="number"
                      step="0.5"
                      aria-label="Position Y"
                      disabled={readOnly}
                      value={Math.round(transform.y * 10) / 10}
                      onChange={(e) => updateTransform('y', Number(e.target.value))}
                      className="h-[26px] text-xs bg-input border-border/70 tabular-nums text-center font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setKeyframe('position', Math.round(playhead * 1000) / 1000)}
                    className={cn(
                      "w-5 h-5 flex items-center justify-center text-[13px] transition-colors cursor-pointer select-none shrink-0",
                      clip.keyframes?.some((kf) => kf.property === 'position' && kf.time === Math.round(playhead * 1000) / 1000)
                        ? "text-primary font-bold"
                        : "text-muted-foreground hover:text-primary"
                    )}
                    title={t('Añadir fotograma clave', 'Add keyframe')}
                  >
                    ◇
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="w-[70px] text-muted-foreground shrink-0">{t('Escala', 'Scale')}</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative w-[72px] shrink-0">
                    <Input
                      type="number"
                      step="1"
                      disabled={readOnly}
                      value={Math.round((transform.scaleX ?? 100) * 10) / 10}
                      onChange={(e) => updateTransform('scaleX', Number(e.target.value))}
                      className="h-[26px] text-xs bg-input border-border/70 tabular-nums text-center pr-3.5 font-mono"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                  </div>
                  <Slider
                    min={10}
                    max={300}
                    step={1}
                    disabled={readOnly}
                    value={transform.scaleX ?? 100}
                    onValueChange={(val) => updateTransform('scaleX', val)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setKeyframe('scale', Math.round(playhead * 1000) / 1000)}
                    className={cn(
                      "w-5 h-5 flex items-center justify-center text-[13px] transition-colors cursor-pointer select-none shrink-0",
                      clip.keyframes?.some((kf) => kf.property === 'scale' && kf.time === Math.round(playhead * 1000) / 1000)
                        ? "text-primary font-bold"
                        : "text-muted-foreground hover:text-primary"
                    )}
                    title={t('Añadir fotograma clave', 'Add keyframe')}
                  >
                    ◇
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="w-[70px] text-muted-foreground shrink-0">{t('Rotación', 'Rotation')}</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative w-[72px] shrink-0">
                    <Input
                      type="number"
                      step="1"
                      disabled={readOnly}
                      value={Math.round((transform.rotation ?? 0) * 10) / 10}
                      onChange={(e) => updateTransform('rotation', Number(e.target.value))}
                      className="h-[26px] text-xs bg-input border-border/70 tabular-nums text-center pr-3 font-mono"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">°</span>
                  </div>
                  <Slider
                    min={-180}
                    max={180}
                    step={1}
                    disabled={readOnly}
                    value={transform.rotation ?? 0}
                    onValueChange={(val) => updateTransform('rotation', val)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setKeyframe('rotation', Math.round(playhead * 1000) / 1000)}
                    className={cn(
                      "w-5 h-5 flex items-center justify-center text-[13px] transition-colors cursor-pointer select-none shrink-0",
                      clip.keyframes?.some((kf) => kf.property === 'rotation' && kf.time === Math.round(playhead * 1000) / 1000)
                        ? "text-primary font-bold"
                        : "text-muted-foreground hover:text-primary"
                    )}
                    title={t('Añadir fotograma clave', 'Add keyframe')}
                  >
                    ◇
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-muted-foreground">{t('Escala uniforme', 'Uniform scale')}</span>
                <Switch
                  size="sm"
                  checked={clip.uniformScale ?? true}
                  disabled={readOnly}
                  onCheckedChange={(checked) => onUpdateClip(clip.id, { uniformScale: checked })}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground">{t('Voltear imagen', 'Flip image')}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className={cn(
                      "px-2.5 py-1 rounded-[4px] text-xs font-medium border transition-colors cursor-pointer",
                      clip.flipH ? "bg-primary text-primary-foreground border-primary" : "bg-input text-foreground border-border/60 hover:bg-input-hover"
                    )}
                    disabled={readOnly}
                    onClick={() => onUpdateClip(clip.id, { flipH: !clip.flipH })}
                    title={t('Voltear horizontalmente', 'Flip horizontal')}
                  >
                    {t('Horizontal', 'Horizontal')}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-2.5 py-1 rounded-[4px] text-xs font-medium border transition-colors cursor-pointer",
                      clip.flipV ? "bg-primary text-primary-foreground border-primary" : "bg-input text-foreground border-border/60 hover:bg-input-hover"
                    )}
                    disabled={readOnly}
                    onClick={() => onUpdateClip(clip.id, { flipV: !clip.flipV })}
                    title={t('Voltear verticalmente', 'Flip vertical')}
                  >
                    {t('Vertical', 'Vertical')}
                  </button>
                </div>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title={t('Encuadre', 'Framing')} defaultOpen={openFit}>
            <div className="flex items-center w-full bg-[#0d121c] p-0.5 rounded-[6px] border border-border/70">
              {(['fit', 'fill', 'stretch'] as const).map((m) => {
                const isSelected = (clip.fit ?? 'fit') === m
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onUpdateClip(clip.id, { fit: m })}
                    className={cn(
                      'flex-1 h-[26px] rounded-[4px] text-xs transition-all text-center cursor-pointer select-none',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground font-medium'
                    )}
                  >
                    {m === 'fit' ? t('Ajustar', 'Fit') : m === 'fill' ? t('Rellenar', 'Fill') : t('Estirar', 'Stretch')}
                  </button>
                );
              })}
            </div>
          </AccordionSection>

          <AccordionSection title={t('Recorte', 'Crop')} defaultOpen={openCrop}>
            <div className="space-y-2 pt-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-muted-foreground">{t('Izquierda', 'Left')}</span>
                  <Input
                    type="number"
                    step="0.5"
                    disabled={readOnly}
                    className="w-16 h-[26px] text-xs bg-input border-border/70 text-center tabular-nums font-mono"
                    value={clip.crop?.l ?? 0}
                    onChange={(e) => updateCrop('l', Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-muted-foreground">{t('Derecha', 'Right')}</span>
                  <Input
                    type="number"
                    step="0.5"
                    disabled={readOnly}
                    className="w-16 h-[26px] text-xs bg-input border-border/70 text-center tabular-nums font-mono"
                    value={clip.crop?.r ?? 0}
                    onChange={(e) => updateCrop('r', Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-muted-foreground">{t('Arriba', 'Top')}</span>
                  <Input
                    type="number"
                    step="0.5"
                    disabled={readOnly}
                    className="w-16 h-[26px] text-xs bg-input border-border/70 text-center tabular-nums font-mono"
                    value={clip.crop?.t ?? 0}
                    onChange={(e) => updateCrop('t', Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-muted-foreground">{t('Abajo', 'Bottom')}</span>
                  <Input
                    type="number"
                    step="0.5"
                    disabled={readOnly}
                    className="w-16 h-[26px] text-xs bg-input border-border/70 text-center tabular-nums font-mono"
                    value={clip.crop?.b ?? 0}
                    onChange={(e) => updateCrop('b', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title={t('Opacidad', 'Opacity')} defaultOpen={openOpacity}>
            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center justify-between gap-3">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={clip.opacity ?? 100}
                  disabled={readOnly}
                  onValueChange={(val) => onUpdateClip(clip.id, { opacity: val })}
                  className="flex-1"
                />
                <div className="w-16 h-[26px] flex items-center justify-center bg-input border border-border/70 rounded-[6px] text-xs font-mono tabular-nums text-foreground shrink-0">
                  {(clip.opacity ?? 100).toFixed(1)} %
                </div>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="w-[90px] text-muted-foreground shrink-0">{t('Modo de mezcla', 'Blend mode')}</span>
                <select
                  aria-label={t('Modo de mezcla', 'Blend mode')}
                  className="h-7 rounded-[6px] border border-border/70 bg-input px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer flex-1"
                  value={clip.blendMode ?? 'normal'}
                  disabled={readOnly}
                  onChange={(e) => onUpdateClip(clip.id, { blendMode: e.target.value as Clip['blendMode'] })}
                >
                  <option value="normal">{t('Normal', 'Normal')}</option>
                  <option value="multiply">{t('Multiplicar', 'Multiply')}</option>
                  <option value="screen">{t('Trama', 'Screen')}</option>
                  <option value="overlay">{t('Superponer', 'Overlay')}</option>
                  <option value="darken">{t('Oscurecer', 'Darken')}</option>
                  <option value="lighten">{t('Aclarar', 'Lighten')}</option>
                  <option value="soft-light">{t('Luz suave', 'Soft light')}</option>
                  <option value="add">{t('Añadir', 'Add')}</option>
                </select>
              </div>
            </div>
          </AccordionSection>
          {clip.kind === 'adjustment' && (
            <div style={{ padding: '10px 12px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '6px', margin: '8px 0' }}>
              <strong style={{ fontSize: '12px', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={13} /> {t('Capa de Ajuste (FX)', 'Adjustment Layer (FX)')}
              </strong>
              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', margin: '4px 0 8px' }}>
                {t('Los filtros y efectos de esta capa afectan a todos los clips situados por debajo en la línea de tiempo.', 'Filters and effects on this layer affect all clips located below it on the timeline.')}
              </p>
              <button type="button" className="inspector-goto-text-btn" onClick={() => setTab('Efectos')}>
                <Sparkles size={12} /> {t('Configurar Efectos y Filtros →', 'Configure Effects & Filters →')}
              </button>
            </div>
          )}
          {clip.kind !== 'adjustment' && (
            <InspectorSection title={t('VELOCIDAD Y TIEMPO', 'SPEED & TIME')}>
              <div className="slider-row">
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t('Velocidad', 'Speed')}</span>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={clip.speed ?? 1.0}
                  disabled={readOnly}
                  onChange={(e) => onUpdateClip(clip.id, { speed: Number(e.target.value) })}
                />
                <span className="slider-value-badge">{(clip.speed ?? 1.0).toFixed(1)}×</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', margin: '6px 0' }}>
                {[0.5, 1.0, 2.0, 4.0, 8.0].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    disabled={readOnly}
                    className={`inspector-chip-btn ${(clip.speed ?? 1.0) === rate ? 'active' : ''}`}
                    onClick={() => onUpdateClip(clip.id, { speed: rate })}
                  >
                    {rate}×
                  </button>
                ))}
              </div>
              <button
                className="toggle-row inspector-toggle"
                role="switch"
                aria-checked={clip.preservePitch ?? true}
                disabled={readOnly}
                onClick={() => onUpdateClip(clip.id, { preservePitch: !(clip.preservePitch ?? true) })}
              >
                <span>{t('Preservar tono de voz', 'Preserve voice pitch')}</span>
                <span className={`toggle ${(clip.preservePitch ?? true) ? 'on' : ''}`}><i /></span>
              </button>
              {onFreezeFrame && clip.kind === 'video' && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    disabled={readOnly}
                    className="keyframe-button"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => onFreezeFrame(clip.id, playhead)}
                    title={t('Congela el fotograma del cabezal durante 3 segundos (F)', 'Freezes playhead frame for 3 seconds (F)')}
                  >
                    <Snowflake size={13} /> {t('Congelar fotograma en cabezal (F)', 'Freeze frame at playhead (F)')}
                  </button>
                </div>
              )}
            </InspectorSection>
          )}
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
            <InspectorSection title={t('TEXTO Y PLANTILLAS', 'TEXT & PRESETS')}>
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

            <InspectorSection title={t('ANIMACIONES DE TEXTO', 'TEXT ANIMATIONS')}>
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
        {tab === 'Efectos' && (
          <div className="space-y-2">
            <AccordionSection
              title={t('Efectos aplicados', 'Applied effects')}
              defaultOpen={true}
              action={
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                    {(clip.effects ?? []).length} {t('activos', 'active')}
                  </span>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      const current = clip.effects ?? []
                      const presets = [
                        { id: 'vivid', intensity: 75 },
                        { id: 'blur', intensity: 40 },
                        { id: 'vignette', intensity: 25 },
                      ]
                      const nextPreset = presets.find((p) => !current.some((e) => e.effectId === p.id)) ?? presets[0]
                      onUpdateClip(clip.id, {
                        effects: [...current, { id: `eff-${nextPreset.id}-${Date.now()}`, effectId: nextPreset.id, enabled: true, intensity: nextPreset.intensity, params: {} }]
                      })
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    title={t('Añadir efecto', 'Add effect')}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              }
            >
              <div className="space-y-1.5 pt-1">
                {(clip.effects && clip.effects.length > 0) ? (
                  clip.effects.map((eff) => {
                    const def = getEffectDef(eff.effectId)
                    const name =
                      eff.effectId === 'vivid' || eff.effectId === 'filter-vivid'
                        ? 'Vivid'
                        : eff.effectId === 'blur' || eff.effectId === 'fx-gaussian-blur'
                          ? 'Desenfoque'
                          : eff.effectId === 'vignette' || eff.effectId === 'fx-vignette'
                            ? 'Viñeta'
                            : def?.name ?? eff.effectId.toUpperCase()
                    return (
                      <div
                        key={eff.id}
                        className="h-8 flex items-center gap-2 px-2.5 rounded-[6px] bg-secondary border border-border/60 hover:border-border transition-colors"
                      >
                        <Switch
                          size="sm"
                          checked={eff.enabled}
                          disabled={readOnly}
                          onCheckedChange={(checked) => {
                            const currentEffects = clip.effects ?? []
                            const next = currentEffects.map((item) => (item.id === eff.id ? { ...item, enabled: checked } : item))
                            onUpdateClip(clip.id, { effects: next })
                          }}
                        />
                        <span className="text-xs font-medium text-foreground w-[84px] truncate shrink-0" title={name}>
                          {name}
                        </span>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={eff.intensity}
                          disabled={readOnly || !eff.enabled}
                          onValueChange={(val) => {
                            const currentEffects = clip.effects ?? []
                            const next = currentEffects.map((item) => (item.id === eff.id ? { ...item, intensity: val } : item))
                            onUpdateClip(clip.id, { effects: next })
                          }}
                          className="flex-1"
                        />
                        <span className="w-6 text-right text-xs font-mono tabular-nums text-foreground/90 shrink-0">
                          {eff.intensity}
                        </span>
                        <button
                          type="button"
                          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer shrink-0"
                          title={t('Ajustes del efecto', 'Effect settings')}
                        >
                          <Settings size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={readOnly}
                          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-destructive rounded transition-colors cursor-pointer shrink-0"
                          title={t('Eliminar efecto', 'Delete effect')}
                          onClick={() => {
                            const currentEffects = clip.effects ?? []
                            const next = currentEffects.filter((item) => item.id !== eff.id)
                            onUpdateClip(clip.id, { effects: next })
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-2.5 px-3 flex flex-col items-center justify-center gap-2 text-center bg-secondary/30 rounded-[6px] border border-dashed border-border/70">
                    <span className="text-xs text-muted-foreground">{t('Sin efectos aplicados', 'No effects applied')}</span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-center pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const current = clip.effects ?? []
                          onUpdateClip(clip.id, { effects: [...current, { id: `eff-vivid-${Date.now()}`, effectId: 'vivid', enabled: true, intensity: 75, params: {} }] })
                        }}
                        className="px-2 py-0.5 rounded-[4px] bg-primary/18 text-primary hover:bg-primary/25 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        + Vivid
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = clip.effects ?? []
                          onUpdateClip(clip.id, { effects: [...current, { id: `eff-blur-${Date.now()}`, effectId: 'blur', enabled: true, intensity: 40, params: {} }] })
                        }}
                        className="px-2 py-0.5 rounded-[4px] bg-primary/18 text-primary hover:bg-primary/25 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        + Desenfoque
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = clip.effects ?? []
                          onUpdateClip(clip.id, { effects: [...current, { id: `eff-vignette-${Date.now()}`, effectId: 'vignette', enabled: true, intensity: 25, params: {} }] })
                        }}
                        className="px-2 py-0.5 rounded-[4px] bg-primary/18 text-primary hover:bg-primary/25 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        + Viñeta
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </AccordionSection>

            <AccordionSection title={t('Transformación', 'Transformation')} defaultOpen={openTransform}>
              <div className="space-y-2 pt-1 text-xs">
                {/* Posición Row */}
                <div className="flex items-center justify-between">
                  <span className="w-[70px] text-muted-foreground shrink-0">{t('Posición', 'Position')}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-[11px] text-muted-foreground font-mono">X</span>
                      <Input
                        type="number"
                        step="0.5"
                        aria-label="Position X"
                        disabled={readOnly}
                        value={Math.round(transform.x * 10) / 10}
                        onChange={(e) => updateTransform('x', Number(e.target.value))}
                        className="h-[26px] text-xs bg-input border-border/70 tabular-nums text-center font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-[11px] text-muted-foreground font-mono">Y</span>
                      <Input
                        type="number"
                        step="0.5"
                        aria-label="Position Y"
                        disabled={readOnly}
                        value={Math.round(transform.y * 10) / 10}
                        onChange={(e) => updateTransform('y', Number(e.target.value))}
                        className="h-[26px] text-xs bg-input border-border/70 tabular-nums text-center font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setKeyframe('position', Math.round(playhead * 1000) / 1000)}
                      className={cn(
                        "w-5 h-5 flex items-center justify-center text-[13px] transition-colors cursor-pointer select-none shrink-0",
                        clip.keyframes?.some((kf) => kf.property === 'position' && kf.time === Math.round(playhead * 1000) / 1000)
                          ? "text-primary font-bold"
                          : "text-muted-foreground hover:text-primary"
                      )}
                      title={t('Añadir fotograma clave', 'Add keyframe')}
                    >
                      ◇
                    </button>
                  </div>
                </div>

                {/* Escala Row */}
                <div className="flex items-center justify-between">
                  <span className="w-[70px] text-muted-foreground shrink-0">{t('Escala', 'Scale')}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="relative w-[72px] shrink-0">
                      <Input
                        type="number"
                        step="1"
                        disabled={readOnly}
                        value={Math.round((transform.scaleX ?? 100) * 10) / 10}
                        onChange={(e) => updateTransform('scaleX', Number(e.target.value))}
                        className="h-[26px] text-xs bg-input border-border/70 tabular-nums text-center pr-3.5 font-mono"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                    </div>
                    <Slider
                      min={10}
                      max={300}
                      step={1}
                      disabled={readOnly}
                      value={transform.scaleX ?? 100}
                      onValueChange={(val) => updateTransform('scaleX', val)}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setKeyframe('scale', Math.round(playhead * 1000) / 1000)}
                      className={cn(
                        "w-5 h-5 flex items-center justify-center text-[13px] transition-colors cursor-pointer select-none shrink-0",
                        clip.keyframes?.some((kf) => kf.property === 'scale' && kf.time === Math.round(playhead * 1000) / 1000)
                          ? "text-primary font-bold"
                          : "text-muted-foreground hover:text-primary"
                      )}
                      title={t('Añadir fotograma clave', 'Add keyframe')}
                    >
                      ◇
                    </button>
                  </div>
                </div>

                {/* Rotación Row */}
                <div className="flex items-center justify-between">
                  <span className="w-[70px] text-muted-foreground shrink-0">{t('Rotación', 'Rotation')}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="relative w-[72px] shrink-0">
                      <Input
                        type="number"
                        step="1"
                        disabled={readOnly}
                        value={Math.round((transform.rotation ?? 0) * 10) / 10}
                        onChange={(e) => updateTransform('rotation', Number(e.target.value))}
                        className="h-[26px] text-xs bg-input border-border/70 tabular-nums text-center pr-3 font-mono"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">°</span>
                    </div>
                    <Slider
                      min={-180}
                      max={180}
                      step={1}
                      disabled={readOnly}
                      value={transform.rotation ?? 0}
                      onValueChange={(val) => updateTransform('rotation', val)}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setKeyframe('rotation', Math.round(playhead * 1000) / 1000)}
                      className={cn(
                        "w-5 h-5 flex items-center justify-center text-[13px] transition-colors cursor-pointer select-none shrink-0",
                        clip.keyframes?.some((kf) => kf.property === 'rotation' && kf.time === Math.round(playhead * 1000) / 1000)
                          ? "text-primary font-bold"
                          : "text-muted-foreground hover:text-primary"
                      )}
                      title={t('Añadir fotograma clave', 'Add keyframe')}
                    >
                      ◇
                    </button>
                  </div>
                </div>
              </div>
            </AccordionSection>

            <AccordionSection title={t('Encuadre', 'Framing')} defaultOpen={openFit}>
              <div className="flex items-center w-full bg-[#0d121c] p-0.5 rounded-[6px] border border-border/70">
                {(['fit', 'fill', 'stretch'] as const).map((m) => {
                  const isSelected = (clip.fit ?? 'fit') === m
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={readOnly}
                      onClick={() => onUpdateClip(clip.id, { fit: m })}
                      className={cn(
                        'flex-1 h-[26px] rounded-[4px] text-xs transition-all text-center cursor-pointer select-none',
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground font-medium'
                      )}
                    >
                      {m === 'fit' ? t('Ajustar', 'Fit') : m === 'fill' ? t('Rellenar', 'Fill') : t('Estirar', 'Stretch')}
                    </button>
                  )
                })}
              </div>
            </AccordionSection>

            <AccordionSection title={t('Recorte', 'Crop')} defaultOpen={openCrop}>
              <div className="space-y-2 pt-1 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-muted-foreground">{t('Izquierda', 'Left')}</span>
                    <Input
                      type="number"
                      step="0.5"
                      disabled={readOnly}
                      className="w-16 h-[26px] text-xs bg-input border-border/70 text-center tabular-nums font-mono"
                      value={clip.crop?.l ?? 0}
                      onChange={(e) => updateCrop('l', Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-muted-foreground">{t('Derecha', 'Right')}</span>
                    <Input
                      type="number"
                      step="0.5"
                      disabled={readOnly}
                      className="w-16 h-[26px] text-xs bg-input border-border/70 text-center tabular-nums font-mono"
                      value={clip.crop?.r ?? 0}
                      onChange={(e) => updateCrop('r', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-muted-foreground">{t('Arriba', 'Top')}</span>
                    <Input
                      type="number"
                      step="0.5"
                      disabled={readOnly}
                      className="w-16 h-[26px] text-xs bg-input border-border/70 text-center tabular-nums font-mono"
                      value={clip.crop?.t ?? 0}
                      onChange={(e) => updateCrop('t', Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-muted-foreground">{t('Abajo', 'Bottom')}</span>
                    <Input
                      type="number"
                      step="0.5"
                      disabled={readOnly}
                      className="w-16 h-[26px] text-xs bg-input border-border/70 text-center tabular-nums font-mono"
                      value={clip.crop?.b ?? 0}
                      onChange={(e) => updateCrop('b', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </AccordionSection>

            <AccordionSection title={t('Opacidad', 'Opacity')} defaultOpen={openOpacity}>
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={clip.opacity ?? 100}
                    disabled={readOnly}
                    onValueChange={(val) => onUpdateClip(clip.id, { opacity: val })}
                    className="flex-1"
                  />
                  <div className="w-16 h-[26px] flex items-center justify-center bg-input border border-border/70 rounded-[6px] text-xs font-mono tabular-nums text-foreground shrink-0">
                    {(clip.opacity ?? 100).toFixed(1)} %
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="w-[90px] text-muted-foreground shrink-0">{t('Modo de mezcla', 'Blend mode')}</span>
                  <select
                    aria-label={t('Modo de mezcla', 'Blend mode')}
                    className="h-7 rounded-[6px] border border-border/70 bg-input px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer flex-1"
                    value={clip.blendMode ?? 'normal'}
                    disabled={readOnly}
                    onChange={(e) => onUpdateClip(clip.id, { blendMode: e.target.value as Clip['blendMode'] })}
                  >
                    <option value="normal">{t('Normal', 'Normal')}</option>
                    <option value="multiply">{t('Multiplicar', 'Multiply')}</option>
                    <option value="screen">{t('Trama', 'Screen')}</option>
                    <option value="overlay">{t('Superponer', 'Overlay')}</option>
                    <option value="darken">{t('Oscurecer', 'Darken')}</option>
                    <option value="lighten">{t('Aclarar', 'Lighten')}</option>
                    <option value="soft-light">{t('Luz suave', 'Soft light')}</option>
                    <option value="add">{t('Añadir', 'Add')}</option>
                  </select>
                </div>
              </div>
            </AccordionSection>

            <div className="pt-2">
              <InspectorSection title={t('FILTROS DE COLOR', 'COLOR FILTERS')}>
                <label className="keyframe-button" style={{ width: '100%', margin: '4px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
                  <Upload size={13} /> {t('Importar LUT (.cube)', 'Import LUT (.cube)')}
                  <input
                    type="file"
                    accept=".cube"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        const text = await file.text()
                        const lut = parseCubeLUT(text, file.name.replace(/\.cube$/i, ''))
                        const def = registerCustomLutFilter(lut.title, lut.size)
                        const inst = createEffectInstance(def.id)
                        if (inst) {
                          const withoutFilters = (clip.effects ?? []).filter((eff) => getEffectDef(eff.effectId)?.kind !== 'filter')
                          onUpdateClip(clip.id, { effects: [...withoutFilters, inst] })
                        }
                        toast.success(t(`LUT importada y aplicada: ${lut.title}`, `LUT imported and applied: ${lut.title}`))
                      } catch {
                        toast.error(t('Error al importar archivo LUT .cube', 'Error importing .cube LUT file'))
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
                <div className="inspector-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', margin: '4px 0' }}>
                  {EFFECT_CATALOG.filter((e) => e.kind === 'filter').map((filter) => {
                    const isActive = (clip.effects ?? []).some((e) => e.effectId === filter.id && e.enabled)
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        disabled={readOnly}
                        className={`inspector-chip-btn ${isActive ? 'active' : ''}`}
                        style={{ padding: '6px 5px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', textAlign: 'left' }}
                        onClick={() => {
                          const existing = clip.effects ?? []
                          if (isActive) {
                            onUpdateClip(clip.id, { effects: existing.filter((e) => e.effectId !== filter.id) })
                          } else {
                            const inst = createEffectInstance(filter.id)
                            if (inst) {
                              const withoutFilters = existing.filter((e) => getEffectDef(e.effectId)?.kind !== 'filter')
                              onUpdateClip(clip.id, { effects: [...withoutFilters, inst] })
                            }
                          }
                        }}
                      >
                        <strong style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={10} /> {filter.name}
                        </strong>
                        <small style={{ fontSize: '9px', opacity: 0.7 }}>{filter.category}</small>
                      </button>
                    )
                  })}
                </div>
              </InspectorSection>
            </div>
          </div>
        )}
        {tab === 'Ajustar' && (
          <>
            {(() => {
              const adjustInst = (clip.effects ?? []).find((e) => e.effectId === 'adjust-tone')
              const params = adjustInst?.params ?? {}
              const updateParam = (key: string, val: number) => {
                const nextParams = { ...params, [key]: val }
                let nextEffects: EffectInstance[]
                if (adjustInst) {
                  nextEffects = (clip.effects ?? []).map((e) => e.id === adjustInst.id ? { ...e, params: nextParams } : e)
                } else {
                  nextEffects = [
                    ...(clip.effects ?? []),
                    {
                      id: `adj-tone-${clip.id}`,
                      effectId: 'adjust-tone',
                      enabled: true,
                      intensity: 100,
                      params: nextParams,
                    },
                  ]
                }
                onUpdateClip(clip.id, { effects: nextEffects })
              }
              const resetParam = (key: string) => {
                updateParam(key, 0)
              }
              const resetAll = () => {
                const nextEffects = (clip.effects ?? []).filter((e) => e.effectId !== 'adjust-tone')
                onUpdateClip(clip.id, { effects: nextEffects })
                toast.info(t('Ajustes de tono restablecidos', 'Tone adjustments reset'))
              }

              const groups = [
                { name: t('TONO', 'TONE'), items: ADJUST_PARAMS.filter((p) => p.group === 'Tono') },
                { name: t('COLOR', 'COLOR'), items: ADJUST_PARAMS.filter((p) => p.group === 'Color') },
                { name: t('DETALLE', 'DETAIL'), items: ADJUST_PARAMS.filter((p) => p.group === 'Detalle') },
              ]

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 8px' }}>
                    <button
                      type="button"
                      disabled={readOnly || !adjustInst}
                      className="keyframe-button"
                      style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={resetAll}
                    >
                      <RotateCcw size={11} /> {t('Restablecer todo', 'Reset all')}
                    </button>
                  </div>
                  {groups.map((group) => (
                    <InspectorSection key={group.name} title={group.name}>
                      {group.items.map((param) => {
                        const val = params[param.key] ?? param.default
                        return (
                          <div key={param.key} className="slider-row" style={{ alignItems: 'center', margin: '6px 0' }}>
                            <span style={{ fontSize: '11px', width: '85px', flexShrink: 0 }}>{t(param.label, param.label)}</span>
                            <input
                              type="range"
                              min={param.min}
                              max={param.max}
                              step={param.step}
                              value={val}
                              disabled={readOnly}
                              onChange={(e) => updateParam(param.key, Number(e.target.value))}
                            />
                            <span className="slider-value-badge" style={{ minWidth: '38px', textAlign: 'right' }}>
                              {val > 0 && param.min < 0 ? `+${val}` : val}{param.unit ?? ''}
                            </span>
                            <button
                              type="button"
                              disabled={readOnly || val === param.default}
                              className="property-reset"
                              style={{ marginLeft: '4px', opacity: val === param.default ? 0.3 : 1 }}
                              title={t('Restablecer', 'Reset')}
                              onClick={() => resetParam(param.key)}
                            >
                              <RotateCcw size={11} />
                            </button>
                          </div>
                        )
                      })}
                    </InspectorSection>
                  ))}
                </>
              )
            })()}
          </>
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
  </aside>
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  const id = `inspector-${title.toLowerCase().replaceAll(' ', '-')}`
  return <section className="inspector-section"><button type="button" className="inspector-section-title" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>{title}<ChevronDown size={13} /></button>{open && <div id={id}>{children}</div>}</section>
}
