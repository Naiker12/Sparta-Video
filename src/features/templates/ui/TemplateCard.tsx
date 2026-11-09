import { ArrowRight, Clock, Layers, LayoutTemplate } from 'lucide-react'
import type { SpartaTemplate } from '../domain/template.types'
import { formatTime } from '../../../shared/lib/format-time'
import { t } from '../../../shared/i18n/locale'

interface TemplateCardProps {
  template: SpartaTemplate
  onSelect: (template: SpartaTemplate) => void
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const isVertical = template.format === '9:16'
  const isSquare = template.format === '1:1'

  const categoryLabels: Record<string, string> = {
    stickman: 'Stickman',
    'social-media': t('Redes Sociales', 'Social Media'),
    youtube: 'YouTube',
    business: t('Negocios', 'Business'),
    education: t('Educación', 'Education'),
    general: t('General', 'General'),
  }

  return (
    <div
      onClick={() => onSelect(template)}
      className="group relative flex flex-col justify-between rounded-2xl border border-[#232733] bg-[#14161f] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:bg-[#181b26] hover:shadow-xl hover:shadow-black/40 cursor-pointer"
    >
      <div>
        {/* Aspect Ratio Preview box */}
        <div className="relative mb-3 flex items-center justify-center rounded-xl bg-[#0c0d12] overflow-hidden aspect-video border border-white/5">
          {/* Format badge indicator */}
          <div
            className={`border border-primary/40 rounded flex flex-col items-center justify-center bg-primary/10 shadow-xs transition-transform group-hover:scale-105 ${
              isVertical ? 'w-10 h-16' : isSquare ? 'w-14 h-14' : 'w-20 h-12'
            }`}
          >
            <LayoutTemplate size={14} className="text-primary mb-0.5" />
            <span className="text-[9px] font-bold text-primary tracking-wider">{template.format}</span>
          </div>

          {/* Duration Badge */}
          {template.durationSeconds > 0 && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-xs">
              <Clock size={10} />
              <span>{formatTime(template.durationSeconds)}</span>
            </div>
          )}

          {/* Built-in badge */}
          {template.isBuiltIn && (
            <div className="absolute top-2 left-2 rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase tracking-wider">
              {t('Oficial', 'Official')}
            </div>
          )}
        </div>

        {/* Category & Format */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {categoryLabels[template.category] || template.category}
          </span>
          <span className="text-[11px] text-muted-foreground">•</span>
          <span className="text-[11px] text-muted-foreground font-mono">{template.format}</span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm text-white group-hover:text-primary transition-colors line-clamp-1">
          {template.name}
        </h3>

        {/* Description */}
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {template.description}
        </p>
      </div>

      {/* Footer Info & Action */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Layers size={12} />
          <span>
            {template.slots.length > 0
              ? `${template.slots.length} ${t('slots', 'slots')}`
              : t('Listo para usar', 'Ready to use')}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(template)
          }}
          className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:text-primary/90 transition-colors"
        >
          <span>{t('Usar', 'Use')}</span>
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}

