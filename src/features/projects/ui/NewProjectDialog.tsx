import { useState } from 'react'
import { Film, Sliders, X } from 'lucide-react'
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
  }) => void
}

export function NewProjectDialog({ open, onOpenChange, onCreate }: NewProjectDialogProps) {
  const [name, setName] = useState('Sin título')
  const [format, setFormat] = useState<ProjectPresetFormat>('16:9')
  const [customWidth, setCustomWidth] = useState(1920)
  const [customHeight, setCustomHeight] = useState(1080)
  const [isCustom, setIsCustom] = useState(false)
  const [fps, setFps] = useState(24)

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
    })
    onOpenChange(false)
  }

  const presets: {
    id: ProjectPresetFormat
    label: string
    desc: string
    aspectClass: string
  }[] = [
    { id: '16:9', label: '16:9', desc: 'YouTube, Web', aspectClass: 'w-7 h-[16px]' },
    { id: '9:16', label: '9:16', desc: 'TikTok, Shorts, Reels', aspectClass: 'w-[14px] h-[22px]' },
    { id: '1:1', label: '1:1', desc: 'Instagram, Feed', aspectClass: 'w-5 h-5' },
    { id: '4:5', label: '4:5', desc: 'Social Portrait', aspectClass: 'w-[16px] h-5' },
    { id: '21:9', label: '21:9', desc: 'UltraWide Cine', aspectClass: 'w-8 h-[14px]' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#12141a]/95 backdrop-blur-xl border border-white/10 text-foreground p-0 overflow-hidden shadow-2xl rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/8 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
              <Film size={16} />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-white tracking-tight">
                {t('Nuevo proyecto', 'New project')}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t('Configura el formato y resolución de tu video', 'Configure format and resolution for your video')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              {t('Nombre del proyecto', 'Project name')}
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#171922] border border-[#262a36] focus:border-primary/80 focus:ring-2 focus:ring-primary/20 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground transition-all"
              placeholder={t('Sin título', 'Untitled')}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                {t('Formato de secuencia', 'Aspect ratio')}
              </label>
              <span className="text-[11px] font-mono text-primary font-medium">
                {currentResolution.width} × {currentResolution.height}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
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
                    className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer ${
                      active
                        ? 'border-primary/80 bg-primary/10 text-white shadow-sm shadow-primary/10 ring-1 ring-primary/30'
                        : 'border-[#242834] bg-[#161821] text-muted-foreground hover:border-[#383e50] hover:text-slate-200 hover:bg-[#1a1d27]'
                    }`}
                  >
                    <div className="h-6 flex items-center justify-center mb-1.5">
                      <div
                        className={`${p.aspectClass} rounded-xs border-2 transition-colors ${
                          active
                            ? 'border-primary bg-primary/30'
                            : 'border-muted-foreground/40 group-hover:border-slate-300'
                        }`}
                      />
                    </div>
                    <span className="font-semibold text-xs tracking-tight">{p.label}</span>
                    <span className="text-[10px] opacity-70 mt-0.5 text-center line-clamp-1">{p.desc}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer ${
                  isCustom
                    ? 'border-primary/80 bg-primary/10 text-white shadow-sm shadow-primary/10 ring-1 ring-primary/30'
                    : 'border-[#242834] bg-[#161821] text-muted-foreground hover:border-[#383e50] hover:text-slate-200 hover:bg-[#1a1d27]'
                }`}
              >
                <div className="h-6 flex items-center justify-center mb-1.5">
                  <Sliders size={16} className={isCustom ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-slate-300'} />
                </div>
                <span className="font-semibold text-xs tracking-tight">{t('Personalizado', 'Custom')}</span>
                <span className="text-[10px] opacity-70 mt-0.5">{t('Manual', 'Manual')}</span>
              </button>
            </div>
          </div>

          {isCustom && (
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#14161f] rounded-xl border border-[#242834]">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{t('Ancho (px)', 'Width (px)')}</label>
                <input
                  type="number"
                  min={240}
                  max={7680}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="w-full bg-[#1b1e28] border border-[#2b3040] focus:border-primary/80 rounded-lg px-2.5 py-1.5 text-xs text-white"
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
                  className="w-full bg-[#1b1e28] border border-[#2b3040] focus:border-primary/80 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">{t('FPS', 'Frame rate')}</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full bg-[#171922] border border-[#262a36] focus:border-primary/80 rounded-xl px-3 py-2 text-xs text-white cursor-pointer"
              >
                <option value={24}>24 fps ({t('Cinematográfico', 'Cinematic')})</option>
                <option value={25}>25 fps ({t('PAL / Europa', 'PAL / Europe')})</option>
                <option value={30}>30 fps ({t('Estándar Web', 'Web Standard')})</option>
                <option value={60}>60 fps ({t('Fluido / Juegos', 'Smooth / Gaming')})</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                {t('Resolución', 'Resolution')}
              </label>
              <div className="w-full bg-[#151720] border border-[#242834] rounded-xl px-3 py-2 text-xs text-slate-300 font-mono flex items-center justify-between">
                <span>{currentResolution.width} × {currentResolution.height}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{format}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/8">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              {t('Cancelar', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              {t('Crear proyecto', 'Create project')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

