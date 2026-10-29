import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { AudioLines, ChevronDown, ChevronRight, FolderOpen, Image as ImageIcon, Layers2, LayoutGrid, List, LoaderCircle, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2, Upload, Video, X } from 'lucide-react'
import { ActionMenu } from './ActionMenu'
import { IconNleCaptions, IconNleVoiceWave } from './StudioIcons'
import type { MediaItem } from '../model'
import { t } from '../services/locale'
import { formatMediaDuration, loadMediaPreview, parseDurationFromDetail, pruneStoredMedia } from '../services/media-storage'
import type { SubtitleLanguage } from '../services/subtitle-generator'
import { TEXT_STYLE_PRESETS, type TextPresetCategory } from '../services/text-presets'

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

export function MediaLibraryPanel({ assets, selectedMedia, projectName, isExtractingSubtitles = false, subtitleProgressText, importStatus, onSelect, onAdd, onAddTextClip, onAutoSubtitles, onApplySubtitlePreset, onClearSubtitles, onRename, onDelete, onRelink, onImport, onImportFiles, onOpenProject }: Props) {
  const [dockTab, setDockTab] = useState<'media' | 'text'>('media')
  const [textCategory, setTextCategory] = useState<'all' | TextPresetCategory>('all')
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
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t('PROYECTO', 'PROJECT')}</span>
          <h2>
            {t('Biblioteca de medios', 'Media library')}
          </h2>
        </div>
        <ActionMenu label={t('Opciones de biblioteca', 'Library options')} items={libraryMenuItems}>
          <MoreHorizontal size={17} />
        </ActionMenu>
      </div>

      <div className="library-dock-switcher" role="tablist" aria-label={t('Modo de biblioteca', 'Library mode')}>
        <button
          type="button"
          role="tab"
          aria-selected={dockTab === 'media'}
          className={`dock-switch-btn ${dockTab === 'media' ? 'active' : ''}`}
          onClick={() => setDockTab('media')}
        >
          <Video size={13} />
          <span>{t('Medios', 'Media')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={dockTab === 'text'}
          className={`dock-switch-btn ${dockTab === 'text' ? 'active' : ''}`}
          onClick={() => setDockTab('text')}
        >
          <IconNleCaptions size={13} />
          <span>{t('Texto y Subtítulos', 'Text & Captions')}</span>
        </button>
      </div>

      {dockTab === 'text' ? (
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
                        <span>{isExtractingSubtitles ? t('Extrayendo', 'Extracting') : t('Extraer', 'Extract')}</span>
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
                        padding: preset.style.backgroundOpacity > 0 ? '3px 8px' : '0',
                        borderRadius: `${Math.min(6, preset.style.backgroundRadius)}px`,
                        textShadow:
                          preset.style.strokeWidth > 0
                            ? `-1px -1px 0 ${preset.style.strokeColor}, 1px -1px 0 ${preset.style.strokeColor}, -1px 1px 0 ${preset.style.strokeColor}, 1px 1px 0 ${preset.style.strokeColor}`
                            : preset.style.shadowBlur > 0
                              ? `0 0 8px ${preset.style.shadowColor}`
                              : 'none',
                      }}
                    >
                      {(preset.id === 'hormozi-karaoke' ? 'VOZ EN VIVO' : preset.sampleText.slice(0, 22))
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
      ) : (
        <>
          <button
            type="button"
            className="project-card"
            onClick={onOpenProject}
            aria-label={`${t('Preferencias del proyecto', 'Project preferences')} ${projectName}`}
            title={t('Abrir preferencias del proyecto', 'Open project preferences')}
          >
            <span className="project-icon"><FolderOpen size={16} /></span>
            <span className="project-card-copy">
              <strong>{projectName}</strong>
              <span>{assets.length} {t('medios · Guardado local', 'items · Saved locally')}</span>
            </span>
          </button>

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

          <div className="search-box">
            <Search size={14} />
            <input
              placeholder={t('Buscar medios', 'Search media')}
              aria-label={t('Buscar medios', 'Search media')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <kbd>Ctrl K</kbd>
            {search && <button className="clear-search" onClick={() => setSearch('')} aria-label={t('Limpiar búsqueda', 'Clear search')}>×</button>}
          </div>

          <div className="library-filters" role="group" aria-label={t('Filtrar medios por tipo', 'Filter media by type')}>
            {(['all', 'video', 'audio', 'image'] as const).map((value) => (
              <button
                type="button"
                className={kind === value ? 'filter-chip active' : 'filter-chip'}
                aria-pressed={kind === value}
                key={value}
                onClick={() => setKind(value)}
              >
                {value === 'all' ? t('Todo', 'All') : value === 'video' ? t('Vídeo', 'Video') : value === 'audio' ? t('Audio', 'Audio') : t('Imagen', 'Image')}
                {value === kind && <span>{visible.length}</span>}
              </button>
            ))}
            <ActionMenu label={t('Filtrar medios', 'Filter media')} items={libraryMenuItems}>
              <SlidersHorizontal size={14} />
            </ActionMenu>
          </div>

          <div className={`media-grid ${listView ? 'media-list' : ''} ${!visible.length ? 'media-grid-empty' : ''}`}>
            {visible.map((item) => {
              const details = item.detail.split('·').map((part) => part.trim())
              const knownTime =
                (item.durationSeconds ? formatMediaDuration(item.durationSeconds) : null) ??
                item.detail.match(/(\d{1,2}:\d{2}:\d{2}|\d{2}:\d{2})/)?.[1]
              const status = item.status ?? 'unknown'
              const statusLabel = status === 'catalog-only' ? t('Solo catálogo', 'Catalog only') : status === 'ready' ? t('Disponible', 'Ready') : status === 'processing' ? t('Procesando', 'Processing') : status === 'missing' ? t('Sin archivo', 'Missing file') : status === 'error' ? t('Error', 'Error') : t('Sin estado', 'Unknown status')
              const errorDetail = details.slice(1).join(' · ') || t('No hay más información del error.', 'No further error details are available.')
              return (
                <div className={`media-entry status-${status}`} key={item.id}>
                  <button
                    className={`media-card ${selectedMedia === item.id ? 'media-selected' : ''}`}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('application/sparta-media', item.id)}
                    onDoubleClick={() => onAdd(item)}
                    onClick={() => onSelect(item)}
                    title={t('Arrastra o haz doble clic para añadir', 'Drag or double-click to add')}
                    aria-label={item.title}
                  >
                    <div className={`media-thumb ${item.thumb} ${imagePreviews[item.id] ? 'has-preview' : ''} ${status === 'processing' ? 'is-processing' : ''}`}>
                      {imagePreviews[item.id] && <img className="media-preview-image" src={imagePreviews[item.id]} alt="" draggable={false} />}
                      {status === 'processing' && (
                        <div className="media-processing-overlay" aria-live="polite">
                          <LoaderCircle size={18} className="spin text-cyan-400" />
                          <span className="media-processing-text">{t('Procesando…', 'Processing…')}</span>
                        </div>
                      )}
                      <span className="thumb-kind">
                        {item.type === 'audio' ? <AudioLines size={13} /> : item.type === 'image' ? <ImageIcon size={13} /> : <Video size={13} />}
                      </span>
                      <span className="duration" aria-label={knownTime ?? t('Duración no disponible', 'Duration unavailable')}>{knownTime ?? '—'}</span>
                      <span className="media-add"><Plus size={15} /></span>
                    </div>
                    <div className="media-title" title={item.title}>{item.title}</div>
                    <div className="media-detail">{details[0]}</div>
                  </button>
                  <div className="media-entry-footer">
                    {status !== 'ready' && <div className={`media-status-badge status-badge-${status}`} aria-label={`${t('Estado', 'Status')}: ${statusLabel}`} title={getStatusDescription(item.status)}>
                      {status === 'processing' ? <LoaderCircle size={12} className="spin" /> : <span />}{statusLabel}
                    </div>}
                    <div className="media-entry-actions">
                      <button type="button" className="media-entry-action" aria-label={t('Cambiar nombre', 'Rename')} title={t('Cambiar nombre', 'Rename')} onClick={() => { setRenameTarget(item); setRenameDraft(item.title) }}><Pencil size={13} /></button>
                      <button type="button" className="media-entry-action destructive" aria-label={t('Quitar del proyecto', 'Remove from project')} title={t('Quitar del proyecto', 'Remove from project')} onClick={() => setDeleteTarget(item)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {(status === 'catalog-only' || status === 'missing') && (
                    <button
                      type="button"
                      className="media-relink-action"
                      title={t('Selecciona el archivo original desde tu equipo para relocalizarlo', 'Select the original file from your computer to relink it')}
                      onClick={() => { relinkTargetId.current = item.id; relinkInputRef.current?.click() }}
                    >
                      <Upload size={11} />{status === 'missing' ? t('Relocalizar archivo', 'Relink file') : t('Vincular archivo', 'Link file')}
                    </button>
                  )}
                  {status === 'error' && <details className="media-error-detail"><summary>{t('Ver detalle', 'View details')}</summary><p>{item.detail || errorDetail}</p></details>}
                </div>
              )
            })}
            {!visible.length && (
              <div className="library-empty-card">
                <div className="library-empty-icon" aria-hidden="true">
                  <Upload size={18} />
                </div>
                <div className="library-empty">
                  {assets.length
                    ? t('No hay medios que coincidan con la búsqueda o el filtro.', 'No media matches the search or filter.')
                    : t('La biblioteca está vacía. Importa videos, audio o imágenes para comenzar.', 'The library is empty. Import videos, audio, or images to get started.')}
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

          <button className="import-box" onClick={onImport}>
            <div className="import-icon"><Upload size={15} /></div>
            <div>
              <strong>{t('Importar medios', 'Import media')}</strong>
              <span>{t('Explorar archivos locales', 'Browse local files')}</span>
            </div>
            <ChevronRight size={14} />
          </button>

          <div className="media-foot">
            <span><Layers2 size={13} /> {assets.length} {t('elementos', 'items')}</span>
            <span>{assets.some((a) => a.status === 'ready') ? `${assets.filter((a) => a.status === 'ready').length} ${t('disponibles', 'ready')}` : t('Solo catálogo', 'Catalog only')}</span>
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

function getStatusDescription(status: MediaItem['status']) {
  if (!status) return t('El modelo todavía no registra el estado de este medio.', 'The media status has not been recorded yet.')
  if (status === 'catalog-only') return t('Solo se guardaron metadatos; el archivo fuente no está vinculado.', 'Only metadata was saved; the source file is not linked.')
  if (status === 'ready') return t('El archivo original se guardó localmente y está listo para la vista previa.', 'The original file is saved locally and ready for preview.')
  if (status === 'processing') return t('El medio se está procesando.', 'The media is processing.')
  if (status === 'missing') return t('No se encontró una referencia válida al archivo fuente.', 'No valid source file reference was found.')
  return t('El medio tiene un error. La importación actual no conserva un diagnóstico de decodificación.', 'This media has an error. The current import does not retain decoder diagnostics.')
}
