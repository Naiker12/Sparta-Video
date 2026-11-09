import { useEffect, useState } from 'react'
import { ArrowRight, Film, Play } from 'lucide-react'
import type { ProjectSummary } from '../domain/project.types'
import { formatDurationCompact, formatRelativeTime } from '../../../shared/lib/format-time'
import { loadMediaPreview } from '../../editor/services/media-storage'
import { defaultProjectService } from '../application/project-service'
import { generateProjectCover } from '../application/cover-capture'
import { t } from '../../../shared/i18n/locale'

interface ContinueBannerProps {
  project: ProjectSummary
  onContinue: (id: string) => void
}

export function ContinueBanner({ project, onContinue }: ContinueBannerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

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
        : `${project.sequence.width}×${project.sequence.height}`

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t('Continuar donde lo dejaste', 'Continue where you left off')}
      </h3>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onContinue(project.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onContinue(project.id)
        }}
        className="group relative flex items-center justify-between p-4 bg-gradient-to-r from-[#1a1d26] to-[#14161d] hover:from-[#202430] hover:to-[#171a22] border border-[#2b303d] hover:border-primary/50 rounded-2xl transition-all duration-300 cursor-pointer shadow-lg hover:shadow-primary/5 select-none"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-24 h-16 sm:w-32 sm:h-20 bg-[#101217] rounded-xl overflow-hidden relative shrink-0 flex items-center justify-center border border-[#282d38] group-hover:border-primary/40 transition-colors">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <Film size={22} className="text-muted-foreground/40" />
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="w-7 h-7 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-md">
                <Play size={12} fill="currentColor" className="ml-0.5" />
              </div>
            </div>
            <span className="absolute bottom-1 right-1 px-1 bg-black/85 text-[9px] font-mono rounded text-white/95">
              {formatDurationCompact(project.durationSeconds)}
            </span>
          </div>

          <div className="min-w-0 space-y-1">
            <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold tracking-wide uppercase">
              {t('Último editado', 'Last edited')}
            </span>
            <h4 className="text-sm sm:text-base font-semibold text-white group-hover:text-primary transition-colors truncate">
              {project.name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{aspectLabel}</span>
              <span>·</span>
              <span>{formatRelativeTime(project.updatedAt)}</span>
              <span>·</span>
              <span>{project.clipCount} {t('clips', 'clips')}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onContinue(project.id)
          }}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:brightness-110 shadow-sm transition-all cursor-pointer"
        >
          <span>{t('Continuar', 'Continue')}</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

