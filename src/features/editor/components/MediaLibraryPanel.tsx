import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Check, ChevronDown, Layers, Layers2, LayoutGrid, List, LoaderCircle, MoreHorizontal, Palette, Pencil, Plus, Search, Shuffle, SlidersHorizontal, Sparkles, Trash2, Type, Upload, Video, X } from 'lucide-react'
import { ActionMenu } from './ActionMenu'
import { IconNleCaptions, IconNleVoiceWave } from './StudioIcons'
import type { MediaItem } from '../model'
import { t } from '../services/locale'
import { cn } from '../../../lib/utils'
import { ToggleGroup, ToggleGroupItem } from '../../../components/ui/toggle-group'
import { formatMediaDuration, loadMediaPreview, parseDurationFromDetail, pruneStoredMedia } from '../services/media-storage'
import type { SubtitleLanguage } from '../services/subtitle-generator'
import { TEXT_STYLE_PRESETS, type TextPresetCategory } from '../services/text-presets'
import { EFFECT_CATALOG, createEffectInstance, getEffectDef, registerCustomLutFilter } from '../effects/catalog'
import { parseCubeLUT } from '../effects/lut-parser'
import { useEditorStore } from '../editor-store'
import { toast } from '../../../components/ui/toast'

export type LibraryTab = 'media' | 'text' | 'filters' | 'effects' | 'transitions' | 'templates'

const PRESET_COMPACT_PREVIEW: Record<string, string> = {
  'hormozi-karaoke': 'VOZ EN VIVO',
  'capcut-pop-pill': 'POP DINÁMICO',
  'cine-sub-minimal': 'CINE 4K',
  'editorial-hook': 'CAPÍTULO 01',
  'kinetic-neon-glow': 'CYBER NEÓN',
  'lower-third-studio': 'DIRECCIÓN',
  'typewriter-docu': 'DOCU ARCHIVO',
  'bounce-viral': 'REELS VIRAL',
}

type Props = {
  assets: MediaItem[]
  selectedMedia: string | null
  projectName: string
  isExtractingSubtitles?: boolean
  subtitleProgressText?: string
  importStatus?: { isImporting: boolean; current: number; total: number; currentFileName: string } | null
  onSelect: (asset: MediaItem) => void
  onAdd: (asset: MediaItem) => void
  onAddTextClip?: (presetId: string, customText?: string) => void
  onAutoSubtitles?: (presetId: string, customScript?: string, language?: SubtitleLanguage) => void
  onApplySubtitlePreset?: (presetId: string, language?: SubtitleLanguage) => void
  onClearSubtitles?: () => void
  onRename: (assetId: string, name: string) => void
  onDelete: (assetId: string) => void
  onRelink: (assetId: string, file: File) => void
  onImport: () => void
  onImportFiles: (files: FileList | File[]) => void
  onOpenProject: () => void
}

export function MediaLibraryPanel({ assets, selectedMedia, projectName: _projectName, isExtractingSubtitles = false, subtitleProgressText, importStatus, onSelect, onAdd, onAddTextClip, onAutoSubtitles, onApplySubtitlePreset, onClearSubtitles, onRename, onDelete, onRelink, onImport, onImportFiles, onOpenProject: _onOpenProject }: Props) {
  const [dockTab, setDockTab] = useState<LibraryTab>('media')
  const [textCategory, setTextCategory] = useState<'all' | TextPresetCategory>('all')

  const applyEffectToSelectedClip = (effectId: string) => {
    const state = useEditorStore.getState()
    const selectedClipId = state.selectedClipId
    const def = getEffectDef(effectId)
    if (!def) return

    if (!selectedClipId) {
      toast.info(t('Selecciona un clip en la línea de tiempo para aplicar este efecto.', 'Select a clip on the timeline to apply this effect.'))
      return
    }

    const clip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    if (!clip) return

    const inst = createEffectInstance(effectId)
    if (!inst) return

    const existing = clip.effects ?? []
    const nextEffects = def.kind === 'filter'
      ? [...existing.filter((e) => getEffectDef(e.effectId)?.kind !== 'filter'), inst]
      : [...existing, inst]

    state.updateClip(clip.id, { effects: nextEffects })
    toast.success(t(`"${def.name}" aplicado a "${clip.title}"`, `"${def.name}" applied to "${clip.title}"`))
  }

  const applyTransitionToSelectedClip = (transId: string) => {
    const state = useEditorStore.getState()
    const selectedClipId = state.selectedClipId
    const def = getEffectDef(transId)
    if (!def) return

    if (!selectedClipId) {
      toast.info(t('Selecciona un clip para asignarle una transición de entrada.', 'Select a clip to assign an in-transition.'))
      return
    }

    state.updateClip(selectedClipId, {
      transitionIn: {
        effectId: transId,
        duration: 0.6,
      },
    })
    toast.success(t(`Transición "${def.name}" asignada al clip`, `Transition "${def.name}" assigned to clip`))
  }
  const [captionLanguage, setCaptionLanguage] = useState<SubtitleLanguage>('spanish')
  const [captionsCollapsed, setCaptionsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sparta.captionsCardCollapsed') === '1'
    } catch {
      return false
    }
  })
  const toggleCaptionsCollapsed = () => {
    setCaptionsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sparta.captionsCardCollapsed', next ? '1' : '0')
      } catch {
        /* almacenamiento no disponible */
      }
      return next
    })
  }
  const [captionPresetId, setCaptionPresetId] = useState('hormozi-karaoke')
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<'all' | 'video' | 'audio' | 'image'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'type' | 'duration'>('recent')
  const [listView, setListView] = useState(false)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({})
  const [renameTarget, setRenameTarget] = useState<MediaItem | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null)
  const relinkInputRef = useRef<HTMLInputElement>(null)
  const relinkTargetId = useRef<string | null>(null)
  const initialAssetIds = useRef(assets.map((asset) => asset.id))
  useEffect(() => { void pruneStoredMedia(initialAssetIds.current).catch(() => {}) }, [])
  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    void Promise.all(assets.filter((asset) => (asset.type === 'image' && asset.status === 'ready') || (asset.type === 'video' && (asset.status === 'ready' || asset.status === 'catalog-only'))).map(async (asset) => {
      try {
        const url = await loadMediaPreview(asset.id)
        if (url) urls.push(url)
        return [asset.id, url] as const
      } catch { return [asset.id, null] as const }
    })).then((entries) => {
      if (cancelled) { urls.forEach(URL.revokeObjectURL); return }
      setImagePreviews(Object.fromEntries(entries.flatMap(([id, url]) => url ? [[id, url]] : [])))
    })
    return () => { cancelled = true; urls.forEach(URL.revokeObjectURL) }
  }, [assets])
  const visible = useMemo(() => {
    const filtered = assets.filter((asset) => asset.title.toLowerCase().includes(search.toLowerCase()) && (kind === 'all' || asset.type === kind))
    const duration = (detail: string) => { const match = detail.match(/(\d{2}:\d{2})$/); if (!match) return Number.POSITIVE_INFINITY; const [minutes, seconds] = match[1].split(':').map(Number); return minutes * 60 + seconds }
    return sortBy === 'name' ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : sortBy === 'type' ? [...filtered].sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title)) : sortBy === 'duration' ? [...filtered].sort((a, b) => duration(a.detail) - duration(b.detail)) : filtered
  }, [assets, kind, search, sortBy])

  const libraryMenuItems = [
    { heading: t('FILTRAR MEDIOS', 'FILTER MEDIA') },
    { label: t('Todos los medios', 'All media'), checked: kind === 'all', onSelect: () => setKind('all') },
    { label: t('Vídeos', 'Videos'), checked: kind === 'video', onSelect: () => setKind('video') },
    { label: t('Audio', 'Audio'), checked: kind === 'audio', onSelect: () => setKind('audio') },
    { label: t('Imágenes', 'Images'), checked: kind === 'image', onSelect: () => setKind('image') },
    { separator: true as const },
    { heading: t('ORDENAR POR', 'SORT BY') },
    { label: t('Orden de incorporación', 'Recently added'), checked: sortBy === 'recent', onSelect: () => setSortBy('recent') },
    { label: t('Nombre', 'Name'), checked: sortBy === 'name', onSelect: () => setSortBy('name') },
    { label: t('Tipo', 'Type'), checked: sortBy === 'type', onSelect: () => setSortBy('type') },
    { label: t('Duración conocida', 'Known duration'), checked: sortBy === 'duration', onSelect: () => setSortBy('duration') },
    { separator: true as const },
    { label: listView ? t('Mostrar cuadrícula', 'Show grid') : t('Mostrar lista', 'Show list'), icon: listView ? LayoutGrid : List, onSelect: () => setListView((value) => !value) },
  ]

  return (
    <aside
      className={`media-panel ${draggingFiles ? 'media-panel-dragging' : ''}`}
      onDragEnter={(event) => { if (Array.from(event.dataTransfer.types).includes('Files')) { event.preventDefault(); setDraggingFiles(true) } }}
      onDragOver={(event) => { if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault() }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingFiles(false) }}
      onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); setDraggingFiles(false); onImportFiles(event.dataTransfer.files) } }}
    >
      <div className="sr-only">
        <span className="eyebrow">{t('PROYECTO', 'PROJECT')}</span>
        <h2>
          {t('Biblioteca de medios', 'Media library')}
        </h2>
        <div className="flex items-center gap-1">
          <ActionMenu
            label={t('Filtrar medios', 'Filter media')}
            triggerClass="panel-icon-btn text-slate-400 hover:text-white p-1"
            items={[
              { label: t('Todos los medios', 'All media'), checked: kind === 'all', onSelect: () => setKind('all') },
              { label: t('Vídeos', 'Videos'), checked: kind === 'video', onSelect: () => setKind('video') },
              { label: t('Audio', 'Audio'), checked: kind === 'audio', onSelect: () => setKind('audio') },
              { label: t('Imágenes', 'Images'), checked: kind === 'image', onSelect: () => setKind('image') },
            ]}
          >
            <SlidersHorizontal size={15} />
          </ActionMenu>
          <ActionMenu label={t('Opciones de biblioteca', 'Library options')} items={libraryMenuItems}>
            <MoreHorizontal size={17} />
          </ActionMenu>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 p-1.5 bg-card border-b border-border select-none" role="tablist" aria-label={t('Modo de biblioteca', 'Library mode')}>
        <button
          type="button"
          role="tab"
          aria-selected={dockTab === 'media'}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer select-none min-w-0 overflow-hidden',
            dockTab === 'media' ? 'bg-primary/18 text-primary font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          )}
          onClick={() => setDockTab('media')}
        >
          <Video size={16} strokeWidth={1.5} className={dockTab === 'media' ? 'text-primary' : 'text-muted-foreground'} />
          <span className="truncate max-w-full text-center whitespace-nowrap block text-[11px]">{t('Medios', 'Media')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={dockTab === 'text'}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer select-none min-w-0 overflow-hidden',
            dockTab === 'text' ? 'bg-primary/18 text-primary font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          )}
          onClick={() => setDockTab('text')}
        >
          <Type size={16} strokeWidth={1.5} className={dockTab === 'text' ? 'text-primary' : 'text-muted-foreground'} />
          <span className="truncate max-w-full text-center whitespace-nowrap block text-[11px]">{t('Texto', 'Text')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={dockTab === 'transitions'}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer select-none min-w-0 overflow-hidden',
            dockTab === 'transitions' ? 'bg-primary/18 text-primary font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          )}
          onClick={() => setDockTab('transitions')}
        >
          <Shuffle size={16} strokeWidth={1.5} className={dockTab === 'transitions' ? 'text-primary' : 'text-muted-foreground'} />
          <span className="truncate max-w-full text-center whitespace-nowrap block text-[11px]">{t('Transiciones', 'Transitions')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={dockTab === 'effects'}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer select-none min-w-0 overflow-hidden',
            dockTab === 'effects' ? 'bg-primary/18 text-primary font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          )}
          onClick={() => setDockTab('effects')}
        >
          <Sparkles size={16} strokeWidth={1.5} className={dockTab === 'effects' ? 'text-primary' : 'text-muted-foreground'} />
          <span className="truncate max-w-full text-center whitespace-nowrap block text-[11px]">{t('Efectos', 'Effects')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={dockTab === 'filters'}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer select-none min-w-0 overflow-hidden',
            dockTab === 'filters' ? 'bg-primary/18 text-primary font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          )}
          onClick={() => setDockTab('filters')}
        >
          <Palette size={16} strokeWidth={1.5} className={dockTab === 'filters' ? 'text-primary' : 'text-muted-foreground'} />
          <span className="truncate max-w-full text-center whitespace-nowrap block text-[11px]">{t('Filtros', 'Filters')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={dockTab === 'templates'}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer select-none min-w-0 overflow-hidden',
            dockTab === 'templates' ? 'bg-primary/18 text-primary font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          )}
          onClick={() => setDockTab('templates')}
        >
          <Layers size={16} strokeWidth={1.5} className={dockTab === 'templates' ? 'text-primary' : 'text-muted-foreground'} />
          <span className="truncate max-w-full text-center whitespace-nowrap block text-[11px]">{t('Plantillas', 'Templates')}</span>
        </button>
      </div>

      {dockTab === 'text' && (
        <div className="text-studio-dock">
          {(() => {
            const activeSourceMedia =
              assets.find((a) => a.id === selectedMedia && a.type !== 'image') ??
              assets.find((a) => a.type === 'video') ??
              assets.find((a) => a.type === 'audio')
            const sourceDurSec =
              activeSourceMedia?.durationSeconds ??
              parseDurationFromDetail(activeSourceMedia?.detail)
            return (
              <div className={`auto-captions-card ${captionsCollapsed ? 'is-collapsed' : ''}`}>
                <div className="auto-captions-head">
                  <button
                    type="button"
                    className="auto-captions-toggle"
                    aria-expanded={!captionsCollapsed}
                    onClick={toggleCaptionsCollapsed}
                  >
                    <ChevronDown size={12} className="auto-captions-chevron" />
                    <IconNleVoiceWave size={12} />
                    <span className="auto-captions-title">{t('Voz a subtítulos', 'Speech to captions')}</span>
                    {isExtractingSubtitles ? (
                      <span className="auto-captions-status">
                        <LoaderCircle size={10} className="spin" />
                        {subtitleProgressText || t('Extrayendo…', 'Extracting…')}
                      </span>
                    ) : captionsCollapsed && activeSourceMedia ? (
                      <span className="auto-captions-status">
                        {activeSourceMedia.title}
                        {sourceDurSec ? ` · ${formatMediaDuration(sourceDurSec)}` : ''}
                      </span>
                    ) : null}
                  </button>
                  {captionsCollapsed && (
                    <button
                      type="button"
                      className="auto-captions-mini-btn"
                      disabled={isExtractingSubtitles || !activeSourceMedia}
                      aria-label={t('Extraer subtítulos del video', 'Extract subtitles from video')}
                      onClick={() => onAutoSubtitles?.(captionPresetId, undefined, captionLanguage)}
                    >
                      <IconNleCaptions size={12} />
                    </button>
                  )}
                </div>
                {!captionsCollapsed && (
                  <div className="auto-captions-body">
                    {activeSourceMedia ? (
                      <div className="auto-captions-source" title={activeSourceMedia.title}>
                        <span className="auto-captions-source-dot" aria-hidden="true" />
                        <span className="auto-captions-source-name">{activeSourceMedia.title}</span>
                        {sourceDurSec ? <span className="auto-captions-source-dur">{formatMediaDuration(sourceDurSec)}</span> : null}
                      </div>
                    ) : (
                      <p className="auto-captions-desc">
                        {t(
                          'Coloca un video en la secuencia para transcribir lo que se dice.',
                          'Place a video on the sequence to transcribe its speech.',
                        )}
                      </p>
                    )}
                    <div className="auto-captions-controls">
                      <div className="auto-captions-row">
                        <select
                          aria-label={t('Idioma hablado del video', 'Spoken video language')}
                          className="auto-captions-select is-lang"
                          value={captionLanguage}
                          disabled={isExtractingSubtitles}
                          onChange={(e) => setCaptionLanguage(e.target.value as SubtitleLanguage)}
                        >
                          <option value="spanish">{t('Español', 'Spanish')}</option>
                          <option value="english">{t('Inglés', 'English')}</option>
                          <option value="auto">{t('Auto', 'Auto')}</option>
                        </select>
                        <select
                          aria-label={t('Estilo de subtítulo automático', 'Auto-caption style')}
                          className="auto-captions-select"
                          value={captionPresetId}
                          disabled={isExtractingSubtitles}
                          onChange={(e) => {
                            const nextId = e.target.value
                            setCaptionPresetId(nextId)
                            onApplySubtitlePreset?.(nextId, captionLanguage)
                          }}
                        >
                          {TEXT_STYLE_PRESETS.filter((p) => p.category === 'subtitles').map((p) => (
                            <option key={p.id} value={p.id}>
                              {t(p.name, p.nameEn)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="auto-captions-row actions">
                        <button
                          type="button"
                          className="auto-captions-generate-btn"
                          disabled={isExtractingSubtitles || !activeSourceMedia}
                          onClick={() => {
                            onAutoSubtitles?.(captionPresetId, undefined, captionLanguage)
                          }}
                        >
                          {isExtractingSubtitles ? (
                            <LoaderCircle size={12} className="spin" />
                          ) : (
                            <IconNleCaptions size={12} />
                          )}
                          <span>{isExtractingSubtitles ? t('Extrayendo…', 'Extracting…') : t('Generar subtítulos', 'Generate captions')}</span>
                        </button>
                        {onClearSubtitles && (
                          <button
                            type="button"
                            className="auto-captions-clear-btn"
                            disabled={isExtractingSubtitles}
                            title={t('Borrar todos los subtítulos de la secuencia para volver a crearlos (Alt + Supr)', 'Clear all sequence subtitles to recreate them (Alt + Delete)')}
                            onClick={onClearSubtitles}
                          >
                            <Trash2 size={12} />
                            <span>{t('Limpiar', 'Clear')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          <div className="text-preset-filters" role="group" aria-label={t('Categorías de plantillas de texto', 'Text preset categories')}>
            {(
              [
                ['all', t('Todos', 'All')],
                ['subtitles', t('Subtítulos', 'Captions')],
                ['titles', t('Titulares', 'Titles')],
                ['lower-thirds', 'Lower 3rd'],
                ['kinetic', 'Cinéticos'],
              ] as const
            ).map(([catId, label]) => (
              <button
                key={catId}
                type="button"
                className={`filter-chip ${textCategory === catId ? 'active' : ''}`}
                onClick={() => setTextCategory(catId)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="text-presets-grid">
            {TEXT_STYLE_PRESETS.filter((p) => textCategory === 'all' || p.category === textCategory).map((preset) => {
              const isSubPreset = preset.category === 'subtitles'
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`text-preset-card ${isSubPreset && captionPresetId === preset.id ? 'active-preset-card' : ''}`}
                  onClick={() => {
                    if (isSubPreset) {
                      setCaptionPresetId(preset.id)
                      if (onApplySubtitlePreset) {
                        onApplySubtitlePreset(preset.id, captionLanguage)
                      } else {
                        onAutoSubtitles?.(preset.id, undefined, captionLanguage)
                      }
                    } else {
                      onAddTextClip?.(preset.id)
                    }
                  }}
                  data-anim={preset.animation.in}
                  aria-label={`${t(preset.name, preset.nameEn)} · ${preset.animation.in}`}
                  style={{ '--tp-accent': preset.style.accentColor } as CSSProperties}
                >
                  <div className="text-preset-stage">
                    <span className="text-preset-badge">{preset.badge}</span>
                    <span className="text-preset-hover-hint" aria-hidden="true">{t('Vista previa', 'Preview')}</span>
                    <span
                      className="text-preset-sample"
                      style={{
                        fontFamily: preset.style.fontFamily,
                        color: preset.style.color,
                        fontWeight: preset.style.fontWeight,
                        fontStyle: preset.style.italic ? 'italic' : 'normal',
                        backgroundColor:
                          preset.style.backgroundOpacity > 0
                            ? preset.style.backgroundColor
                            : 'transparent',
                        padding: preset.style.backgroundOpacity > 0 ? '2px 6px' : '0',
                        borderRadius: `${Math.min(6, preset.style.backgroundRadius)}px`,
                        textShadow:
                          preset.style.strokeWidth > 0
                            ? `-1px -1px 0 ${preset.style.strokeColor}, 1px -1px 0 ${preset.style.strokeColor}, -1px 1px 0 ${preset.style.strokeColor}, 1px 1px 0 ${preset.style.strokeColor}`
                            : preset.style.shadowBlur > 0
                              ? `0 0 8px ${preset.style.shadowColor}`
                              : 'none',
                      }}
                    >
                      {(PRESET_COMPACT_PREVIEW[preset.id] ?? preset.sampleText.split(/\s+/).slice(0, 2).join(' '))
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((word, idx, arr) => (
                          <span
                            key={`${word}-${idx}`}
                            className={`tp-word ${preset.id === 'hormozi-karaoke' && idx === 1 ? 'tp-word-accent' : ''}`}
                            style={{ '--i': idx, '--n': arr.length } as CSSProperties}
                          >
                            {word}
                            {idx < arr.length - 1 ? '\u00a0' : ''}
                          </span>
                        ))}
                    </span>
                  </div>
                  <div className="text-preset-meta">
                    <div>
                      <strong>{t(preset.name, preset.nameEn)}</strong>
                      <span>
                        {isSubPreset
                          ? t('AUTO-SYNC VIDEO', 'AUTO-SYNC VIDEO')
                          : `${preset.animation.in.toUpperCase()} · ${preset.defaultDuration}s`}
                      </span>
                    </div>
                    <span className="text-preset-add">
                      {isSubPreset ? <IconNleCaptions size={12} /> : <Plus size={13} />}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="media-foot">
            <span><IconNleCaptions size={13} /> {TEXT_STYLE_PRESETS.length} {t('plantillas', 'presets')}</span>
            <span>{t('Render en vivo + Export', 'Live + Export render')}</span>
          </div>
        </div>
      )}

      {dockTab === 'filters' && (
        <div className="text-studio-dock">
          <div className="text-studio-banner" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <strong style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Palette size={13} /> {t('Filtros de color cinematográficos', 'Cinematic color filters')}
            </strong>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>
              {t('Haz clic en un filtro para aplicarlo al clip seleccionado.', 'Click a filter to apply it to the selected clip.')}
            </p>
          </div>
          <label className="keyframe-button" style={{ width: '100%', margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
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
                  applyEffectToSelectedClip(def.id)
                  toast.success(t(`LUT importada y aplicada: ${lut.title}`, `LUT imported and applied: ${lut.title}`))
                } catch {
                  toast.error(t('Error al importar archivo LUT .cube', 'Error importing .cube LUT file'))
                }
                e.target.value = ''
              }}
            />
          </label>
          <div className="text-presets-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', padding: '8px 0' }}>
            {EFFECT_CATALOG.filter((e) => e.kind === 'filter').map((filter) => (
              <button
                key={filter.id}
                type="button"
                className="text-preset-card"
                onClick={() => applyEffectToSelectedClip(filter.id)}
                style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', textAlign: 'left', minHeight: '80px', justifyContent: 'space-between' }}
              >
                <div>
                  <span className="text-preset-badge" style={{ fontSize: '9px', marginBottom: '4px' }}>{filter.category}</span>
                  <strong style={{ fontSize: '12px', display: 'block', color: 'var(--text)' }}>{filter.name}</strong>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.3, display: 'block' }}>{filter.description}</span>
                </div>
                <span className="pill-action-tag" style={{ alignSelf: 'flex-end', fontSize: '9px' }}>{t('Aplicar', 'Apply')}</span>
              </button>
            ))}
          </div>
          <div className="media-foot">
            <span><Palette size={13} /> {EFFECT_CATALOG.filter((e) => e.kind === 'filter').length} {t('filtros', 'filters')}</span>
            <span>{t('Tiempo real WebGL2', 'Real-time WebGL2')}</span>
          </div>
        </div>
      )}

      {dockTab === 'effects' && (
        <div className="text-studio-dock">
          <div className="text-studio-banner" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <strong style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={13} /> {t('Efectos visuales y de shader', 'Visual & shader effects')}
            </strong>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>
              {t('Añade desenfoque, grano, resplandor o viñeta al clip.', 'Add blur, grain, glow, or vignette to the clip.')}
            </p>
          </div>
          <button
            type="button"
            className="keyframe-button primary-pill"
            style={{ width: '100%', margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={() => {
              useEditorStore.getState().addAdjustmentLayer()
              toast.success(t('Capa de ajuste FX añadida a la línea de tiempo', 'FX Adjustment layer added to timeline'))
            }}
          >
            <Sparkles size={13} /> {t('＋ Añadir Capa de Ajuste (FX)', '＋ Add Adjustment Layer (FX)')}
          </button>
          <div className="text-presets-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', padding: '8px 0' }}>
            {EFFECT_CATALOG.filter((e) => e.kind === 'effect').map((effect) => (
              <button
                key={effect.id}
                type="button"
                className="text-preset-card"
                onClick={() => applyEffectToSelectedClip(effect.id)}
                style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', textAlign: 'left', minHeight: '80px', justifyContent: 'space-between' }}
              >
                <div>
                  <span className="text-preset-badge" style={{ fontSize: '9px', marginBottom: '4px' }}>{effect.category}</span>
                  <strong style={{ fontSize: '12px', display: 'block', color: 'var(--text)' }}>{effect.name}</strong>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.3, display: 'block' }}>{effect.description}</span>
                </div>
                <span className="pill-action-tag" style={{ alignSelf: 'flex-end', fontSize: '9px' }}>{t('Añadir', 'Add')}</span>
              </button>
            ))}
          </div>
          <div className="media-foot">
            <span><Sparkles size={13} /> {EFFECT_CATALOG.filter((e) => e.kind === 'effect').length} {t('efectos', 'effects')}</span>
            <span>{t('Shader FBO Ping-pong', 'FBO Ping-pong Shader')}</span>
          </div>
        </div>
      )}

      {dockTab === 'transitions' && (
        <div className="text-studio-dock">
          <div className="text-studio-banner" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <strong style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shuffle size={13} /> {t('Transiciones de escena', 'Scene transitions')}
            </strong>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>
              {t('Selecciona un clip y elige cómo entra en escena.', 'Select a clip and choose its in-transition.')}
            </p>
          </div>
          <div className="text-presets-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', padding: '8px 0' }}>
            {EFFECT_CATALOG.filter((e) => e.kind === 'transition').map((trans) => (
              <button
                key={trans.id}
                type="button"
                className="text-preset-card"
                onClick={() => applyTransitionToSelectedClip(trans.id)}
                style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', textAlign: 'left', minHeight: '80px', justifyContent: 'space-between' }}
              >
                <div>
                  <span className="text-preset-badge" style={{ fontSize: '9px', marginBottom: '4px' }}>{trans.category}</span>
                  <strong style={{ fontSize: '12px', display: 'block', color: 'var(--text)' }}>{trans.name}</strong>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.3, display: 'block' }}>{trans.description}</span>
                </div>
                <span className="pill-action-tag" style={{ alignSelf: 'flex-end', fontSize: '9px' }}>{t('Asignar', 'Assign')}</span>
              </button>
            ))}
          </div>
          <div className="media-foot">
            <span><Shuffle size={13} /> {EFFECT_CATALOG.filter((e) => e.kind === 'transition').length} {t('transiciones', 'transitions')}</span>
            <span>{t('Disolución y cortes', 'Dissolves & cuts')}</span>
          </div>
        </div>
      )}

      {dockTab === 'templates' && (
        <div className="text-studio-dock">
          <div className="text-studio-banner" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <strong style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={13} /> {t('Plantillas de estilo integradas', 'Integrated style templates')}
            </strong>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>
              {t('Inserta títulos, subtítulos virales y tercios inferiores profesionales.', 'Insert titles, viral captions, and professional lower thirds.')}
            </p>
          </div>
          <div className="text-presets-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', padding: '8px 0' }}>
            {TEXT_STYLE_PRESETS.slice(0, 6).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="text-preset-card"
                onClick={() => onAddTextClip?.(preset.id)}
                style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', textAlign: 'left', minHeight: '80px', justifyContent: 'space-between' }}
              >
                <div>
                  <span className="text-preset-badge" style={{ fontSize: '9px', marginBottom: '4px' }}>{preset.badge}</span>
                  <strong style={{ fontSize: '12px', display: 'block', color: 'var(--text)' }}>{t(preset.name, preset.nameEn)}</strong>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.3, display: 'block' }}>{preset.animation.in} · {preset.defaultDuration}s</span>
                </div>
                <span className="pill-action-tag" style={{ alignSelf: 'flex-end', fontSize: '9px' }}>{t('Insertar', 'Insert')}</span>
              </button>
            ))}
          </div>
          <div className="media-foot">
            <span><Layers size={13} /> {TEXT_STYLE_PRESETS.length} {t('plantillas', 'templates')}</span>
            <span>{t('Listo para usar', 'Ready to use')}</span>
          </div>
        </div>
      )}

      {dockTab === 'media' && (
        <>
          {importStatus?.isImporting && (
            <div className="media-importing-card" role="status" aria-live="polite">
              <div className="media-importing-head">
                <span className="media-importing-title">
                  <LoaderCircle size={13} className="spin" aria-hidden="true" />
                  {t('Importando e indexando medios…', 'Importing and indexing media…')}
                </span>
                <span className="media-importing-count">
                  {importStatus.current} / {importStatus.total}
                </span>
              </div>
              <div className="media-importing-bar-track">
                <div
                  className="media-importing-bar-fill"
                  style={{
                    width: `${Math.max(10, Math.round((importStatus.current / Math.max(1, importStatus.total)) * 100))}%`,
                  }}
                />
              </div>
              {importStatus.currentFileName && (
                <div className="media-importing-filename" title={importStatus.currentFileName}>
                  {importStatus.currentFileName}
                </div>
              )}
            </div>
          )}

          <div className="px-2.5 py-2">
            <div className="relative flex items-center w-full h-8 px-2.5 rounded-[6px] bg-input border-0 text-xs focus-within:ring-2 focus-within:ring-primary hover:bg-input-hover transition-colors">
              <Search size={14} className="text-muted-foreground mr-2 shrink-0" />
              <input
                placeholder={t('Buscar medios', 'Search media')}
                aria-label={t('Buscar medios', 'Search media')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-xs"
              />
              <kbd className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono shrink-0 whitespace-nowrap ml-1.5">
                Ctrl K
              </kbd>
              {search && <button className="clear-search ml-1 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setSearch('')} aria-label={t('Limpiar búsqueda', 'Clear search')}>×</button>}
            </div>
          </div>

          <ToggleGroup
            value={kind}
            onValueChange={(val) => setKind((val || 'all') as typeof kind)}
            size="sm"
            className="flex items-center gap-1.5 px-2.5 pb-2 bg-transparent"
            aria-label={t('Filtrar medios por tipo', 'Filter media by type')}
          >
            {(['all', 'video', 'audio', 'image'] as const).map((value) => (
              <ToggleGroupItem
                key={value}
                value={value}
                aria-pressed={kind === value}
                className={cn(
                  'h-7 px-3 text-xs rounded-full font-medium transition-colors select-none cursor-pointer border-0',
                  kind === value
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-input text-muted-foreground hover:text-foreground hover:bg-input-hover'
                )}
              >
                {value === 'all' ? t('Todo', 'All') : value === 'video' ? t('Video', 'Video') : value === 'audio' ? t('Audio', 'Audio') : t('Imagen', 'Image')}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className={`media-grid ${listView ? 'media-list' : ''} ${!visible.length ? 'media-grid-empty' : ''} px-2.5`}>
            {visible.map((item) => {
              const knownTime =
                (item.durationSeconds ? formatMediaDuration(item.durationSeconds) : null) ??
                item.detail.match(/(\d{1,2}:\d{2}:\d{2}|\d{2}:\d{2})/)?.[1]
              const status = item.status ?? 'ready'
              const isSelected = selectedMedia === item.id
              const subLabel = item.type === 'video' ? t('Video', 'Video') : item.type === 'audio' ? t('Audio', 'Audio') : t('Imagen', 'Image')

              return (
                <div className={`media-entry status-${status}`} key={item.id}>
                  <button
                    className={`media-card ${isSelected ? 'media-selected' : ''}`}
                    draggable
                    onPointerDown={() => onSelect(item)}
                    onDragStart={(event) => {
                      onSelect(item)
                      event.dataTransfer.effectAllowed = 'copyMove'
                      event.dataTransfer.setData('application/sparta-media', item.id)
                      event.dataTransfer.setData('text/plain', item.id)
                    }}
                    onDoubleClick={() => onAdd(item)}
                    onClick={() => onSelect(item)}
                    title={t('Arrastra o haz doble clic para añadir', 'Drag or double-click to add')}
                    aria-label={item.title}
                  >
                    <div className={`media-thumb ${item.thumb} ${imagePreviews[item.id] ? 'has-preview' : ''} ${status === 'processing' ? 'is-processing' : ''}`}>
                      {imagePreviews[item.id] && <img className="media-preview-image" src={imagePreviews[item.id]} alt="" draggable={false} />}
                      {item.type === 'audio' && !imagePreviews[item.id] && (
                        <div className="audio-card-wave-preview">
                          {Array.from({ length: 24 }, (_, i) => (
                            <span key={i} style={{ height: `${20 + Math.abs(Math.sin(i * 0.8)) * 60}%` }} />
                          ))}
                        </div>
                      )}
                      {isSelected && (
                        <span className="media-select-check" aria-hidden="true">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                      {status === 'processing' && (
                        <div className="media-processing-overlay" aria-live="polite">
                          <LoaderCircle size={18} className="spin text-cyan-400" />
                          <span className="media-processing-text">{t('Procesando…', 'Processing…')}</span>
                        </div>
                      )}
                      <span className="duration" aria-label={knownTime ?? t('Duración no disponible', 'Duration unavailable')}>{knownTime ?? '—'}</span>
                      <span
                        className="media-add"
                        role="button"
                        tabIndex={0}
                        title={t('Añadir a la línea de tiempo', 'Add to timeline')}
                        onClick={(event) => {
                          event.stopPropagation()
                          onAdd(item)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.stopPropagation()
                            event.preventDefault()
                            onAdd(item)
                          }
                        }}
                      >
                        <Plus size={15} />
                      </span>
                    </div>
                    <div className="media-title" title={item.title}>{item.title}</div>
                    <div className="media-detail">{subLabel}</div>
                  </button>
                  <div className="media-entry-footer">
                    <div className="media-entry-actions">
                      <button type="button" className="media-entry-action" aria-label={t('Cambiar nombre', 'Rename')} title={t('Cambiar nombre', 'Rename')} onClick={(e) => { e.stopPropagation(); setRenameTarget(item); setRenameDraft(item.title) }}><Pencil size={12} /></button>
                      <button type="button" className="media-entry-action destructive" aria-label={t('Quitar del proyecto', 'Remove from project')} title={t('Quitar del proyecto', 'Remove from project')} onClick={(e) => { e.stopPropagation(); setDeleteTarget(item) }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
            {!visible.length && (
              <div className="library-empty-card">
                <div className="library-empty-icon" aria-hidden="true">
                  <Upload size={22} className="text-muted-foreground/50" />
                </div>
                <div className="library-empty">
                  {assets.length
                    ? t('No hay medios que coincidan con la búsqueda o el filtro.', 'No media matches the search or filter.')
                    : t('Arrastra archivos aquí', 'Drag files here')}
                </div>
                {!assets.length && (
                  <span className="library-empty-sub" aria-hidden="true">
                    MP4 · MOV · WEBM · WAV · MP3 · PNG · JPG
                  </span>
                )}
              </div>
            )}
          </div>

          {draggingFiles && <div className="import-drop-overlay"><Upload size={22} /><strong>{t('Suelta para importar', 'Drop to import')}</strong><span>{t('Se añadirá una ficha de catálogo', 'A catalog entry will be added')}</span></div>}
          <input ref={relinkInputRef} className="visually-hidden" style={{ display: 'none' }} type="file" accept="video/*,audio/*,image/*" onChange={(event) => { const file = event.target.files?.[0]; const id = relinkTargetId.current; if (file && id) onRelink(id, file); relinkTargetId.current = null; event.target.value = '' }} />

          <button
            type="button"
            className="w-[calc(100%-20px)] mx-auto my-2.5 h-9 rounded-[8px] bg-primary text-primary-foreground font-semibold text-xs hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs border-0"
            onClick={onImport}
          >
            <Upload size={14} strokeWidth={2} />
            <span>{t('Importar medios', 'Import media')}</span>
          </button>

          <div className="sr-only" aria-live="polite">
            <span className="flex items-center gap-1.5">
              <Layers2 size={13} />
              <span>{assets.length} {assets.length === 1 ? t('elemento', 'item') : t('elementos', 'items')}</span>
            </span>
            <span>{assets.some((a) => a.status === 'ready') ? `${assets.filter((a) => a.status === 'ready').length} ${assets.filter((a) => a.status === 'ready').length === 1 ? t('disponible', 'ready') : t('disponibles', 'ready')}` : t('Solo catálogo', 'Catalog only')}</span>
          </div>
        </>
      )}
      <Dialog.Root open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="modal-backdrop" />
          <Dialog.Popup className="rename-dialog" aria-labelledby="rename-media-title" aria-describedby="rename-media-description">
            <header className="dialog-heading"><div><span className="dialog-eyebrow">{t('BIBLIOTECA DE MEDIOS', 'MEDIA LIBRARY')}</span><Dialog.Title id="rename-media-title" className="dialog-title">{t('Cambiar nombre del medio', 'Rename media')}</Dialog.Title><Dialog.Description id="rename-media-description" className="dialog-description">{t('El nombre se actualizará en la biblioteca y en sus clips de la secuencia.', 'The name will update in the library and its timeline clips.')}</Dialog.Description></div><Dialog.Close className="dialog-close" aria-label={t('Cerrar diálogo', 'Close dialog')}><X size={16} /></Dialog.Close></header>
            <form onSubmit={(event) => { event.preventDefault(); const name = renameDraft.trim(); if (renameTarget && name) { onRename(renameTarget.id, name); setRenameTarget(null) } }}>
              <label htmlFor="media-name-input">{t('Nombre del medio', 'Media name')}</label><input id="media-name-input" autoFocus maxLength={180} value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} />
              <footer className="dialog-actions"><Dialog.Close className="secondary-button">{t('Cancelar', 'Cancel')}</Dialog.Close><button className="primary-button" type="submit" disabled={!renameDraft.trim()}>{t('Guardar nombre', 'Save name')}</button></footer>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="modal-backdrop" />
          <Dialog.Popup className="confirm-dialog" aria-labelledby="delete-media-title" aria-describedby="delete-media-description">
            <Dialog.Title id="delete-media-title" className="dialog-title">{t('Quitar medio del proyecto', 'Remove media from project')}</Dialog.Title>
            <Dialog.Description id="delete-media-description" className="dialog-description">{t('Se quitará ', '“')}<span className="confirm-media-name">{deleteTarget?.title ?? ''}</span>{t(' y los clips que se crearon desde este medio. El archivo original no se borra de tu equipo.', '” and clips created from this media will be removed. The original file will stay on your computer.')}</Dialog.Description>
            <footer className="dialog-actions"><Dialog.Close className="secondary-button">{t('Cancelar', 'Cancel')}</Dialog.Close><button className="danger-button" type="button" onClick={() => { if (deleteTarget) onDelete(deleteTarget.id); setDeleteTarget(null) }}>{t('Quitar medio', 'Remove media')}</button></footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </aside>
  )
}
