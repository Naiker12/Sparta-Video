import { useMemo, useState } from 'react'
import { AudioLines, ChevronRight, FolderOpen, Image as ImageIcon, Layers2, MoreHorizontal, Plus, Search, SlidersHorizontal, Upload, Video } from 'lucide-react'
import { ActionMenu } from './ActionMenu'
import type { MediaItem } from '../model'

type Props = {
  assets: MediaItem[]
  selectedMedia: string | null
  projectName: string
  onSelect: (asset: MediaItem) => void
  onAdd: (asset: MediaItem) => void
  onImport: () => void
  onOpenProject: () => void
}

export function MediaLibraryPanel({ assets, selectedMedia, projectName, onSelect, onAdd, onImport, onOpenProject }: Props) {
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<'all' | 'video' | 'audio' | 'image'>('all')
  const [sortByName, setSortByName] = useState(false)
  const visible = useMemo(() => {
    const filtered = assets.filter((asset) => asset.title.toLowerCase().includes(search.toLowerCase()) && (kind === 'all' || asset.type === kind))
    return sortByName ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered
  }, [assets, kind, search, sortByName])
  return <aside className="media-panel">
    <div className="panel-heading"><div><span className="eyebrow">PROJECT</span><h2>Media library</h2></div><ActionMenu label="Library options" items={[{ heading: 'Library view' }, { label: 'Sort by name', checked: sortByName, onSelect: () => setSortByName((value) => !value) }, { label: 'Show all media', checked: kind === 'all', onSelect: () => setKind('all') }, { label: 'Show video only', checked: kind === 'video', onSelect: () => setKind('video') }, { label: 'Show audio only', checked: kind === 'audio', onSelect: () => setKind('audio') }, { label: 'Show images only', checked: kind === 'image', onSelect: () => setKind('image') }]}><MoreHorizontal size={18} /></ActionMenu></div>
    <button type="button" className="project-card" onClick={onOpenProject} aria-label={`Open preferences for ${projectName}`}><span className="project-icon"><FolderOpen size={17} /></span><span className="project-card-copy"><strong>{projectName}</strong><span>{assets.length} assets · Browser storage</span></span><ChevronRight size={15} /></button>
    <div className="search-box"><Search size={15} /><input placeholder="Search media" aria-label="Search media" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>Ctrl K</kbd>{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search">×</button>}</div>
    <div className="library-filters"><span className="filter-label">{kind.toUpperCase()} <span>{String(visible.length).padStart(2, '0')}</span></span><ActionMenu label="Filter media" items={[{ heading: 'Filter by type' }, { label: 'All media', checked: kind === 'all', onSelect: () => setKind('all') }, { label: 'Video', checked: kind === 'video', onSelect: () => setKind('video') }, { label: 'Audio', checked: kind === 'audio', onSelect: () => setKind('audio') }, { label: 'Images', checked: kind === 'image', onSelect: () => setKind('image') }]}><SlidersHorizontal size={15} /></ActionMenu></div>
    <div className="media-grid">{visible.map((item) => <button className={`media-card ${selectedMedia === item.id ? 'media-selected' : ''}`} key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData('application/sparta-media', item.id)} onDoubleClick={() => onAdd(item)} onClick={() => onSelect(item)} title="Arrastra o haz doble clic para añadir"><div className={`media-thumb ${item.thumb}`}><span className="thumb-kind">{item.type === 'audio' ? <AudioLines size={14} /> : item.type === 'image' ? <ImageIcon size={13} /> : <Video size={13} />}</span><span className="duration">{item.detail.split('·')[1]}</span><span className="media-add"><Plus size={15} /></span></div><div className="media-title">{item.title}</div><div className="media-detail">{item.detail.split('·')[0]}{item.status === 'catalog-only' ? ' · CATALOG ONLY' : item.status === 'demo' ? ' · DEMO' : ''}</div></button>)}</div>
    {!visible.length && <div className="library-empty">No hay medios con ese nombre.</div>}
    <button className="import-box" onClick={onImport}><div className="import-icon"><Upload size={16} /></div><div><strong>Import media</strong><span>Browse local files</span></div><ChevronRight size={15} /></button>
    <div className="media-foot"><span><Layers2 size={14} /> {assets.length} items</span><span>Catalog only</span></div>
  </aside>
}

