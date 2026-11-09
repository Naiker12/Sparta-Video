import { useEffect, useState } from 'react'
import { AlertTriangle, Film, Play } from 'lucide-react'
import type { ProjectSummary } from '../domain/project.types'
import { ProjectContextMenu } from './ProjectContextMenu'
import { formatDurationCompact, formatRelativeTime } from '../../../shared/lib/format-time'
import { loadMediaPreview } from '../../editor/services/media-storage'
import { defaultProjectService } from '../application/project-service'
import { generateProjectCover } from '../application/cover-capture'
import { t } from '../../../shared/i18n/locale'

interface ProjectCardProps {
  project: ProjectSummary
  viewMode?: 'grid' | 'list'
  onOpen: (id: string) => void
  onRename: (id: string) => void
  onDuplicate: (id: string) => void
  onExport: (id: string) => void
  onDelete: (id: string) => void
  onRestore?: (id: string) => void
  onHistory?: (id: string) => void
}

export function ProjectCard({
  project,
  viewMode = 'grid',
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
  onRestore,
  onHistory,
}: ProjectCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isDeleted = Boolean(project.deletedAt)

  useEffect(() => {
    let active = true

    async function resolvePreview() {
      // 1. Try project's rendered cover (cover-${project.id})
      if (project.coverBlobKey) {
        try {
          const url = await loadMediaPreview(project.coverBlobKey)
          if (active && url) {
            setPreviewUrl(url)
            return
          }
        } catch {
          /* fallback */
        }
      }

      // 2. Try first visual asset's preview thumbnail
      if (project.coverAssetId) {
        try {
          const url = await loadMediaPreview(project.coverAssetId)
          if (active && url) {
            setPreviewUrl(url)
            return
          }
        } catch {
          /* fallback */
        }
      }

      // 3. Fallback: generate project cover directly and display it!
      try {
        const record = await defaultProjectService.getProject(project.id)
        if (record && active) {
          const url = await generateProjectCover(project.id, record.state)
          if (active && url) {
            setPreviewUrl(url)
          }
        }
      } catch {
        /* fallback */
      }
    }

    void resolvePreview()

    return () => {
      active = false
    }
  }, [project.id, project.coverBlobKey, project.coverAssetId])

  const aspectLabel =
    project.sequence.width === 1080 && project.sequence.height === 1920
      ? '9:16'
      : project.sequence.width === 1920 && project.sequence.height === 1080
        ? '16:9'
        : project.sequence.width === project.sequence.height
          ? '1:1'
          : `${project.sequence.width}×${project.sequence.height}`

  if (viewMode === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => (isDeleted ? onRestore?.(project.id) : onOpen(project.id))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (isDeleted) {
              onRestore?.(project.id)
            } else {
              onOpen(project.id)
            }
          }
          if (e.key === 'Delete') onDelete(project.id)
        }}
        className={`group flex items-center justify-between p-3 bg-[#171920] hover:bg-[#1f222b] border rounded-xl transition-all cursor-pointer select-none ${
          isDeleted ? 'border-red-950/40 hover:border-red-800/50' : 'border-[#272a33]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-16 h-10 bg-[#121418] rounded-md overflow-hidden relative shrink-0 flex items-center justify-center border border-[#272a33]">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Film size={16} className="text-muted-foreground/60" />
            )}
            <span className="absolute bottom-0.5 right-0.5 px-1 bg-black/80 text-[9px] font-mono rounded text-white/90">
              {formatDurationCompact(project.durationSeconds)}
            </span>
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white truncate group-hover:text-primary transition-colors flex items-center gap-2">
              <span>{project.name}</span>
              {isDeleted && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/40 font-mono">
                  {t('Papelera', 'Trash')}
                </span>
              )}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span>{aspectLabel}</span>
              <span>·</span>
              <span>{formatRelativeTime(project.updatedAt)}</span>
              {project.hasMissingMedia && (
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle size={11} /> {t('Medios faltantes', 'Missing media')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <ProjectContextMenu
            project={project}
            onOpen={() => onOpen(project.id)}
            onRename={() => onRename(project.id)}
            onDuplicate={() => onDuplicate(project.id)}
            onExport={() => onExport(project.id)}
            onDelete={() => onDelete(project.id)}
            onRestore={() => onRestore?.(project.id)}
            onHistory={() => onHistory?.(project.id)}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => (isDeleted ? onRestore?.(project.id) : onOpen(project.id))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (isDeleted) {
            onRestore?.(project.id)
          } else {
            onOpen(project.id)
          }
        }
        if (e.key === 'Delete') onDelete(project.id)
      }}
      className={`group relative flex flex-col bg-[#16181f] hover:bg-[#1d2028] border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md select-none ${
        isDeleted ? 'border-red-950/50 hover:border-red-800/60' : 'border-[#262933] hover:border-[#383d4c]'
      }`}
    >
      <div className="w-full aspect-video bg-[#111317] relative flex items-center justify-center overflow-hidden border-b border-[#232630]">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Film size={26} className="text-muted-foreground/35 group-hover:text-primary/60 transition-colors" />
        )}

        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-9 h-9 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
            <Play size={16} fill="currentColor" className="ml-0.5" />
          </div>
        </div>

        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/85 text-[10px] font-mono rounded text-white/95 backdrop-blur-xs">
          {formatDurationCompact(project.durationSeconds)}
        </span>

        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/75 text-[9px] font-semibold tracking-wider rounded text-white/80 uppercase">
          {aspectLabel}
        </span>

        {project.hasMissingMedia && (
          <span
            className="absolute top-1.5 right-1.5 p-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded"
            title={t('Faltan algunos archivos de medios', 'Some media files are missing')}
          >
            <AlertTriangle size={12} />
          </span>
        )}
      </div>

      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-white/95 truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
            <span>{project.name}</span>
            {isDeleted && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-950/60 text-red-400 border border-red-800/40 font-mono">
                {t('Papelera', 'Trash')}
              </span>
            )}
          </h4>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
            {formatRelativeTime(project.updatedAt)}
          </p>
        </div>

        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <ProjectContextMenu
            project={project}
            onOpen={() => onOpen(project.id)}
            onRename={() => onRename(project.id)}
            onDuplicate={() => onDuplicate(project.id)}
            onExport={() => onExport(project.id)}
            onDelete={() => onDelete(project.id)}
            onRestore={() => onRestore?.(project.id)}
            onHistory={() => onHistory?.(project.id)}
          />
        </div>
      </div>
    </div>
  )
}

