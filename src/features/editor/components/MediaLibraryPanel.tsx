import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { AudioLines, ChevronRight, FolderOpen, Image as ImageIcon, Layers2, LayoutGrid, List, LoaderCircle, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2, Upload, Video, X } from 'lucide-react'
import { ActionMenu } from './ActionMenu'
import type { MediaItem } from '../model'
import { t } from '../services/locale'
import { loadMediaPreview, pruneStoredMedia } from '../services/media-storage'

type Props = {
  assets: MediaItem[]
  selectedMedia: string | null
  projectName: string
  onSelect: (asset: MediaItem) => void
  onAdd: (asset: MediaItem) => void
  onRename: (assetId: string, name: string) => void
  onDelete: (assetId: string) => void
  onRelink: (assetId: string, file: File) => void
  onImport: () => void
  onImportFiles: (files: FileList | File[]) => void
  onOpenProject: () => void
}

export function MediaLibraryPanel({ assets, selectedMedia, projectName, onSelect, onAdd, onRename, onDelete, onRelink, onImport, onImportFiles, onOpenProject }: Props) {
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
                <div className={`media-thumb ${item.thumb}`}>
                  {imagePreviews[item.id] && <img className="media-preview-image" src={imagePreviews[item.id]} alt="" draggable={false} />}
                  <span className="thumb-kind">
                    {item.type === 'audio' ? <AudioLines size={13} /> : item.type === 'image' ? <ImageIcon size={13} /> : <Video size={13} />}
                  </span>
                  <span className="duration" aria-label={t('Duración no disponible', 'Duration unavailable')}>—</span>
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
        {!visible.length && <div className="library-empty">{assets.length ? t('No hay medios que coincidan con la búsqueda o el filtro.', 'No media matches the search or filter.') : t('La biblioteca está vacía. Importa videos, audio o imágenes para comenzar.', 'The library is empty. Import videos, audio, or images to get started.')}</div>}
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
