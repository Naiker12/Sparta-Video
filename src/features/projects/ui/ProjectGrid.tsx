import { ArrowUpDown, Grid, List, Search } from 'lucide-react'
import type { ProjectSummary } from '../domain/project.types'
import type { ProjectSortOption, ProjectViewMode } from '../hooks/use-projects'
import { ProjectCard } from './ProjectCard'
import { EmptyHome } from './EmptyHome'
import { t } from '../../../shared/i18n/locale'

interface ProjectGridProps {
  projects: ProjectSummary[]
  rawCount: number
  viewMode: ProjectViewMode
  sortBy: ProjectSortOption
  searchQuery: string
  onViewModeChange: (mode: ProjectViewMode) => void
  onSortChange: (sort: ProjectSortOption) => void
  onSearchChange: (query: string) => void
  onOpenProject: (id: string) => void
  onRenameProject: (id: string) => void
  onDuplicateProject: (id: string) => void
  onExportProject: (id: string) => void
  onDeleteProject: (id: string) => void
  onRestoreProject?: (id: string) => void
  onHistoryProject?: (id: string) => void
  onNewProject: () => void
  onOpenProjectFile: () => void
}

export function ProjectGrid({
  projects,
  rawCount,
  viewMode,
  sortBy,
  searchQuery,
  onViewModeChange,
  onSortChange,
  onSearchChange,
  onOpenProject,
  onRenameProject,
  onDuplicateProject,
  onExportProject,
  onDeleteProject,
  onRestoreProject,
  onHistoryProject,
  onNewProject,
  onOpenProjectFile,
}: ProjectGridProps) {
  if (rawCount === 0 && !searchQuery.trim()) {
    return <EmptyHome onNewProject={onNewProject} onOpenProjectFile={onOpenProjectFile} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#232630] pb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">
            {t('Proyectos recientes', 'Recent projects')}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-[#1e2129] border border-[#2b2f3a] text-[10px] font-mono text-muted-foreground">
            {projects.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('Buscar proyecto…', 'Search projects…')}
              className="w-36 sm:w-48 pl-7 pr-2.5 py-1 bg-[#181a21] border border-[#272a33] focus:border-primary focus:outline-none rounded-lg text-xs text-white placeholder-muted-foreground transition-all"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative flex items-center bg-[#181a21] border border-[#272a33] rounded-lg px-2 py-1 text-xs text-muted-foreground">
            <ArrowUpDown size={12} className="mr-1.5 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as ProjectSortOption)}
              className="bg-transparent text-white focus:outline-none cursor-pointer pr-1 text-xs"
              aria-label={t('Ordenar proyectos', 'Sort projects')}
            >
              <option value="recent">{t('Recientes', 'Recent')}</option>
              <option value="name">{t('Nombre', 'Name')}</option>
              <option value="duration">{t('Duración', 'Duration')}</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-[#181a21] border border-[#272a33] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1 rounded transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white'
              }`}
              title={t('Vista en cuadrícula', 'Grid view')}
            >
              <Grid size={13} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`p-1 rounded transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white'
              }`}
              title={t('Vista en lista', 'List view')}
            >
              <List size={13} />
            </button>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          {t('No se encontraron proyectos con ese criterio.', 'No projects found matching that query.')}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              viewMode="grid"
              onOpen={onOpenProject}
              onRename={onRenameProject}
              onDuplicate={onDuplicateProject}
              onExport={onExportProject}
              onDelete={onDeleteProject}
              onRestore={onRestoreProject}
              onHistory={onHistoryProject}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              viewMode="list"
              onOpen={onOpenProject}
              onRename={onRenameProject}
              onDuplicate={onDuplicateProject}
              onExport={onExportProject}
              onDelete={onDeleteProject}
              onRestore={onRestoreProject}
              onHistory={onHistoryProject}
            />
          ))}
        </div>
      )}
    </div>
  )
}

