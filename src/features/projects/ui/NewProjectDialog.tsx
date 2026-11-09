import { useState } from 'react'
import { Film, LayoutTemplate, X } from 'lucide-react'
import { FORMAT_RESOLUTIONS, type ProjectPresetFormat } from '../domain/project-factory'
import { t } from '../../../shared/i18n/locale'
import { Dialog, DialogContent, DialogTitle } from '../../../shared/ui/dialog'

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (options: {
    name: string
    format: ProjectPresetFormat
    customResolution?: { width: number; height: number }
    fps: number
    openTemplates?: boolean
  }) => void
}

export function NewProjectDialog({ open, onOpenChange, onCreate }: NewProjectDialogProps) {
  const [name, setName] = useState('Sin título')
  const [format, setFormat] = useState<ProjectPresetFormat>('16:9')
  const [customWidth, setCustomWidth] = useState(1920)
  const [customHeight, setCustomHeight] = useState(1080)
  const [isCustom, setIsCustom] = useState(false)
  const [fps, setFps] = useState(24)
  const [startFromTemplate, setStartFromTemplate] = useState(false)

  const currentResolution = isCustom
    ? { width: customWidth, height: customHeight }
    : FORMAT_RESOLUTIONS[format]

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate({
      name: name.trim() || 'Sin título',
      format,
      customResolution: isCustom ? { width: customWidth, height: customHeight } : undefined,
      fps,
      openTemplates: startFromTemplate,
    })
    onOpenChange(false)
  }

  const presets: { id: ProjectPresetFormat; label: string; desc: string }[] = [
    { id: '16:9', label: '16:9', desc: 'YouTube, Web' },
    { id: '9:16', label: '9:16', desc: 'TikTok, Shorts, Reels' },
    { id: '1:1', label: '1:1', desc: 'Instagram, Feed' },
    { id: '4:5', label: '4:5', desc: 'Social Portrait' },
    { id: '21:9', label: '21:9', desc: 'UltraWide Cine' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-[#16181d] border-[#272a33] text-foreground p-0 overflow-hidden shadow-2xl rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#272a33]">
          <div className="flex items-center gap-2">
            <Film size={18} className="text-primary" />
            <DialogTitle className="text-base font-semibold text-white">
              {t('Nuevo proyecto', 'New project')}
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('Nombre del proyecto', 'Project name')}
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1e2129] border border-[#2d313c] focus:border-primary focus:outline-none rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground"
              placeholder={t('Sin título', 'Untitled')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t('Formato de secuencia', 'Aspect ratio')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {presets.map((p) => {
                const active = !isCustom && format === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setIsCustom(false)
                      setFormat(p.id)
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-[#272a33] bg-[#1a1d24] text-muted-foreground hover:border-[#383d49] hover:text-white'
                    }`}
                  >
                    <span className="font-semibold text-sm">{p.label}</span>
                    <span className="text-[10px] opacity-75">{p.desc}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                  isCustom
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-[#272a33] bg-[#1a1d24] text-muted-foreground hover:border-[#383d49] hover:text-white'
                }`}
              >
                <span className="font-semibold text-sm">{t('Personalizado', 'Custom')}</span>
                <span className="text-[10px] opacity-75">{t('Manual', 'Manual')}</span>
              </button>
            </div>
          </div>

          {isCustom && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-[#13151a] rounded-lg border border-[#272a33]">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{t('Ancho (px)', 'Width (px)')}</label>
                <input
                  type="number"
                  min={240}
                  max={7680}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="w-full bg-[#1e2129] border border-[#2d313c] rounded px-2 py-1 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{t('Alto (px)', 'Height (px)')}</label>
                <input
                  type="number"
                  min={240}
                  max={7680}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  className="w-full bg-[#1e2129] border border-[#2d313c] rounded px-2 py-1 text-xs text-white"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('FPS', 'Frame rate')}</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full bg-[#1e2129] border border-[#2d313c] rounded-lg px-2.5 py-1.5 text-xs text-white cursor-pointer"
              >
                <option value={24}>24 fps (Cinematográfico)</option>
                <option value={25}>25 fps (PAL / Europa)</option>
                <option value={30}>30 fps (Estándar Web)</option>
                <option value={60}>60 fps (Fluido / Juegos)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t('Resolución', 'Resolution')}
              </label>
              <div className="w-full bg-[#1a1d24] border border-[#272a33] rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground font-mono">
                {currentResolution.width} × {currentResolution.height}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={startFromTemplate}
              onChange={(e) => setStartFromTemplate(e.target.checked)}
              className="rounded border-[#2d313c] text-primary focus:ring-0 focus:outline-none"
            />
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <LayoutTemplate size={13} className="text-primary" />
              {t('Empezar desde una plantilla…', 'Start from a template…')}
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#272a33]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-secondary/60 transition-colors cursor-pointer"
            >
              {t('Cancelar', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-xs cursor-pointer"
            >
              {t('Crear proyecto', 'Create project')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

