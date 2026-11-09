import { useState, type MouseEvent } from 'react'
import { ArrowRight, Clock, Layers, Play } from 'lucide-react'
import type { SpartaTemplate } from '../domain/template.types'
import { TemplatePreview } from './TemplatePreview'
import { formatTime } from '../../../shared/lib/format-time'
import { t } from '../../../shared/i18n/locale'

interface TemplateCardProps {
  template: SpartaTemplate
  onSelect: (template: SpartaTemplate) => void
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [scrubProgress, setScrubProgress] = useState(0)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = Math.min(Math.max(x / rect.width, 0), 1)
    setScrubProgress(progress)
  }

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setScrubProgress(0)
      }}
      className="group relative flex flex-col justify-between rounded-2xl border border-[#232733] bg-[#14161f] p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-[#181b26] hover:shadow-2xl hover:shadow-primary/5 cursor-pointer select-none"
    >
      <div>
        {/* Dynamic Aspect Ratio Interactive Preview Box with Hover Scrub */}
        <div
          onMouseMove={handleMouseMove}
          className="relative mb-3 flex items-center justify-center rounded-xl bg-[#0c0d12] overflow-hidden aspect-video border border-white/8 group-hover:border-primary/40 transition-colors shadow-inner"
        >
          {/* 60fps dynamic scene preview & kinetic animation */}
          <TemplatePreview
            template={template}
            isHovered={isHovered}
            scrubProgress={scrubProgress}
          />

          {/* Hover Play Button Overlay */}
          <div
            className={`absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
              isHovered ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
              <Play size={15} fill="currentColor" className="ml-0.5" />
            </div>
          </div>

          {/* Duration Badge */}
          {template.durationSeconds > 0 && !isHovered && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white/90 backdrop-blur-xs border border-white/10">
              <Clock size={10} />
              <span>{formatTime(template.durationSeconds)}</span>
            </div>
          )}

          {/* Built-in / Official badge */}
          {template.isBuiltIn && !isHovered && (
            <div className="absolute top-2 left-2 rounded-full bg-primary/25 border border-primary/40 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase tracking-wider backdrop-blur-xs">
              {t('Oficial', 'Official')}
            </div>
          )}

          {/* Format Badge Pill */}
          {!isHovered && (
            <div className="absolute bottom-2 left-2 rounded bg-black/80 border border-white/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-white/80 uppercase backdrop-blur-xs">
              {template.format}
            </div>
          )}
        </div>

        {/* Category & Format metadata */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="rounded-md bg-white/5 border border-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {categoryLabels[template.category] || template.category}
          </span>
          <span className="text-[11px] text-muted-foreground/50">•</span>
          <span className="text-[11px] text-muted-foreground font-mono font-semibold">{template.format}</span>
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
              ? `${template.slots.length} ${t('slots editables', 'editable slots')}`
              : t('Listo para usar', 'Ready to use')}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(template)
          }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-semibold transition-all shadow-xs"
        >
          <span>{t('Usar plantilla', 'Use template')}</span>
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}

