import { useMemo, useState } from 'react'
import { AudioLines, ChevronRight, FolderOpen, Image as ImageIcon, Layers2, LayoutGrid, List, MoreHorizontal, Plus, Search, SlidersHorizontal, Upload, Video } from 'lucide-react'
import { ActionMenu } from './ActionMenu'
import type { MediaItem } from '../model'

type Props = {
  assets: MediaItem[]
  selectedMedia: string | null
  projectName: string
  onSelect: (asset: MediaItem) => void
  onAdd: (asset: MediaItem) => void
  onImport: () => void
  onImportFiles: (files: FileList | File[]) => void
  onOpenProject: () => void
}

export function MediaLibraryPanel({ assets, selectedMedia, projectName, onSelect, onAdd, onImport, onImportFiles, onOpenProject }: Props) {
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<'all' | 'video' | 'audio' | 'image'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'type' | 'duration'>('recent')
  const [listView, setListView] = useState(false)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const visible = useMemo(() => {
    const filtered = assets.filter((asset) => asset.title.toLowerCase().includes(search.toLowerCase()) && (kind === 'all' || asset.type === kind))
    const duration = (detail: string) => { const match = detail.match(/(\d{2}:\d{2})$/); if (!match) return Number.POSITIVE_INFINITY; const [minutes, seconds] = match[1].split(':').map(Number); return minutes * 60 + seconds }
    return sortBy === 'name' ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : sortBy === 'type' ? [...filtered].sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title)) : sortBy === 'duration' ? [...filtered].sort((a, b) => duration(a.detail) - duration(b.detail)) : filtered
  }, [assets, kind, search, sortBy])
  return <aside className={`media-panel ${draggingFiles ? 'media-panel-dragging' : ''}`} onDragEnter={(event) => { if (Array.from(event.dataTransfer.types).includes('Files')) { event.preventDefault(); setDraggingFiles(true) } }} onDragOver={(event) => { if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault() }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingFiles(false) }} onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); setDraggingFiles(false); onImportFiles(event.dataTransfer.files) } }}>
    <div className="panel-heading"><div><span className="eyebrow">PROYECTO</span><h2>Biblioteca de medios</h2></div><ActionMenu label="Opciones de biblioteca" items={[{ heading: 'Ordenar por' }, { label: 'Orden de incorporación', checked: sortBy === 'recent', onSelect: () => setSortBy('recent') }, { label: 'Nombre', checked: sortBy === 'name', onSelect: () => setSortBy('name') }, { label: 'Tipo', checked: sortBy === 'type', onSelect: () => setSortBy('type') }, { label: 'Duración conocida', checked: sortBy === 'duration', onSelect: () => setSortBy('duration') }, { separator: true }, { label: listView ? 'Mostrar cuadrícula' : 'Mostrar lista', icon: listView ? LayoutGrid : List, onSelect: () => setListView((value) => !value) }]}><MoreHorizontal size={18} /></ActionMenu></div>
    <button type="button" className="project-card" onClick={onOpenProject} aria-label={`Preferencias del proyecto ${projectName}`} title="Abrir preferencias del proyecto"><span className="project-icon"><FolderOpen size={17} /></span><span className="project-card-copy"><strong>{projectName}</strong><span>{assets.length} medios · Guardado local en navegador</span></span></button>
    <div className="search-box"><Search size={15} /><input placeholder="Buscar medios" aria-label="Buscar medios" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>Ctrl K</kbd>{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">×</button>}</div>
    <div className="library-filters" role="group" aria-label="Filtrar medios por tipo">{(['all', 'video', 'audio', 'image'] as const).map((value) => <button type="button" className={kind === value ? 'filter-chip active' : 'filter-chip'} aria-pressed={kind === value} key={value} onClick={() => setKind(value)}>{value === 'all' ? 'Todo' : value === 'video' ? 'Vídeo' : value === 'audio' ? 'Audio' : 'Imagen'}{value === kind && <span>{visible.length}</span>}</button>)}<ActionMenu label="Opciones de biblioteca" items={[{ label: 'Orden de incorporación', checked: sortBy === 'recent', onSelect: () => setSortBy('recent') }, { label: 'Nombre', checked: sortBy === 'name', onSelect: () => setSortBy('name') }, { label: 'Tipo', checked: sortBy === 'type', onSelect: () => setSortBy('type') }, { label: 'Duración conocida', checked: sortBy === 'duration', onSelect: () => setSortBy('duration') }, { separator: true }, { label: listView ? 'Mostrar cuadrícula' : 'Mostrar lista', icon: listView ? LayoutGrid : List, onSelect: () => setListView((value) => !value) }]}><SlidersHorizontal size={15} /></ActionMenu></div>
    <div className={`media-grid ${listView ? 'media-list' : ''}`}>{visible.map((item) => { const details = item.detail.split('·').map((part) => part.trim()); const hasMeasuredDuration = item.status === 'demo' && details.length > 1; const status = item.status ?? 'unknown'; const statusLabel = status === 'demo' ? 'Muestra' : status === 'catalog-only' ? 'Solo catálogo' : status === 'ready' ? 'Disponible' : status === 'processing' ? 'Procesando' : status === 'missing' ? 'Sin archivo' : status === 'error' ? 'Error' : 'Sin estado'; const errorDetail = details.slice(1).join(' · ') || 'No hay más información del error.'; return <div className={`media-entry status-${status}`} key={item.id}><button className={`media-card ${selectedMedia === item.id ? 'media-selected' : ''}`} draggable onDragStart={(event) => event.dataTransfer.setData('application/sparta-media', item.id)} onDoubleClick={() => onAdd(item)} onClick={() => onSelect(item)} title="Arrastra o haz doble clic para añadir"><div className={`media-thumb ${item.thumb}`}><span className="thumb-kind">{item.type === 'audio' ? <AudioLines size={14} /> : item.type === 'image' ? <ImageIcon size={13} /> : <Video size={13} />}</span><span className="duration" aria-label={hasMeasuredDuration ? `Duración ${details.at(-1)}` : 'Duración no disponible'}>{hasMeasuredDuration ? details.at(-1) : '—'}</span><span className="media-add"><Plus size={15} /></span></div><div className="media-title">{item.title}</div><div className="media-detail">{details[0]}</div></button><div className={`media-status-badge status-badge-${status}`} aria-label={`Estado: ${statusLabel}`} title={getStatusDescription(item.status)}><span />{statusLabel}</div>{status === 'missing' && <button className="media-relink" type="button" disabled title="La relocalización se habilitará cuando el proyecto conserve rutas de archivo">Relocalizar · pronto</button>}{status === 'error' && <details className="media-error-detail"><summary>Ver detalle</summary><p>{errorDetail}</p></details>}{status === 'processing' && <span className="media-processing-track" aria-label="Procesamiento simulado"><i /></span>}</div> })}</div>
    {draggingFiles && <div className="import-drop-overlay"><Upload size={22} /><strong>Suelta para importar</strong><span>Se añadirá una ficha de catálogo</span></div>}
    {!visible.length && <div className="library-empty">No hay medios que coincidan con la búsqueda o el filtro.</div>}
    <button className="import-box" onClick={onImport}><div className="import-icon"><Upload size={16} /></div><div><strong>Importar medios</strong><span>Explorar archivos locales</span></div><ChevronRight size={15} /></button>
    <div className="media-foot"><span><Layers2 size={14} /> {assets.length} elementos</span><span>Solo catálogo</span></div>
  </aside>
}

function getStatusDescription(status: MediaItem['status']) {
  if (!status) return 'El modelo todavía no registra el estado de este medio.'
  if (status === 'demo') return 'Medio de muestra incluido en la demostración.'
  if (status === 'catalog-only') return 'Solo se guardaron metadatos; el archivo fuente no está vinculado.'
  if (status === 'ready') return 'Medio disponible según los metadatos actuales.'
  if (status === 'processing') return 'El procesamiento aún no está conectado en esta demostración.'
  if (status === 'missing') return 'No se encontró una referencia válida al archivo fuente.'
  return 'El medio tiene un error. La importación actual no conserva un diagnóstico de decodificación.'
}

