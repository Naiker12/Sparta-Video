import { useRef, useState, type MouseEvent } from 'react'
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
  const scrubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = Math.min(Math.max(x / rect.width, 0), 1)
    setScrubProgress(progress)

    // When mouse stops moving for 1200ms, seamlessly resume live 60fps auto-play
    if (scrubTimerRef.current) clearTimeout(scrubTimerRef.current)
    scrubTimerRef.current = setTimeout(() => {
      setScrubProgress(0)
    }, 1200)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setScrubProgress(0)
    if (scrubTimerRef.current) clearTimeout(scrubTimerRef.current)
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
      onMouseEnter={() => {
        setIsHovered(true)
        setScrubProgress(0)
      }}
      onMouseLeave={handleMouseLeave}
      className="group relative flex flex-col justify-between rounded-2xl border border-[#232733] bg-[#14161f] p-3.5 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/80 hover:bg-[#181b26] hover:shadow-[0_10px_30px_rgba(59,130,246,0.18)] cursor-pointer select-none"
    >
      <div>
        {/* Dynamic Aspect Ratio Interactive Preview Box with 60fps Live Playback & Hover Scrub */}
        <div
          onMouseMove={handleMouseMove}
          className="relative mb-3 flex items-center justify-center rounded-xl bg-[#0a0b10] overflow-hidden aspect-video border border-white/8 group-hover:border-primary/60 transition-colors shadow-inner"
        >
          {/* 60fps dynamic scene preview & kinetic animation */}
          <TemplatePreview
            template={template}
            isHovered={isHovered}
            scrubProgress={scrubProgress}
          />

          {/* Hover Play Button Overlay (Smoothly dissolves on hover) */}
          <div
            className={`absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none transition-all duration-300 ${
              isHovered ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
            }`}
          >
            <div className="w-11 h-11 rounded-full bg-primary/95 text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/30 border border-white/20 transform group-hover:scale-110 transition-transform">
              <Play size={16} fill="currentColor" className="ml-0.5" />
            </div>
          </div>

          {/* Live Preview Indicator on Hover */}
          {isHovered && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-black/70 border border-primary/40 px-2 py-0.5 text-[9px] font-semibold text-primary backdrop-blur-md shadow-xs animate-pulse pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>{t('EN VIVO', 'LIVE')}</span>
            </div>
          )}

          {/* Duration Badge */}
          {template.durationSeconds > 0 && (
            <div
              className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white/90 backdrop-blur-md border border-white/10 transition-opacity duration-200 ${
                isHovered ? 'opacity-85' : 'opacity-100'
              }`}
            >
              <Clock size={10} />
              <span>{formatTime(template.durationSeconds)}</span>
            </div>
          )}

          {/* Built-in / Official badge */}
          {template.isBuiltIn && (
            <div
              className={`absolute top-2 left-2 rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase tracking-wider backdrop-blur-md transition-opacity duration-200 ${
                isHovered ? 'opacity-70' : 'opacity-100'
              }`}
            >
              {t('Oficial', 'Official')}
            </div>
          )}

          {/* Format Badge Pill */}
          <div
            className={`absolute bottom-2 left-2 rounded bg-black/75 border border-white/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-white/80 uppercase backdrop-blur-md transition-opacity duration-200 ${
              isHovered ? 'opacity-85' : 'opacity-100'
            }`}
          >
            {template.format}
          </div>
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 group-hover:bg-primary text-primary group-hover:text-primary-foreground text-xs font-semibold transition-all shadow-xs cursor-pointer"
        >
          <span>{t('Usar plantilla', 'Use template')}</span>
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  )
}
