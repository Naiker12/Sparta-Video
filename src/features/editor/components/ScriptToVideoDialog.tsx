import { useState } from 'react'
import { Clapperboard, Film } from 'lucide-react'
import { buildScriptStoryboard, parseScriptIntoScenes } from '../services/script-to-video'
import { formatDurationCompact } from '../../../shared/lib/format-time'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'

interface ScriptToVideoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScriptToVideoDialog({ open, onOpenChange }: ScriptToVideoDialogProps) {
  const [scriptText, setScriptText] = useState('')
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal')

  const wpmMap = {
    slow: 110,
    normal: 140,
    fast: 175,
  }

  const scenes = parseScriptIntoScenes(scriptText, { wpm: wpmMap[speed] })
  const estimatedDuration = scenes.reduce((sum, s) => sum + s.duration, 0)

  const handleGenerate = () => {
    if (!scriptText.trim()) return

    const { sceneCount, totalDuration } = buildScriptStoryboard(scriptText, {
      wpm: wpmMap[speed],
    })

    toast.success(
      t(
        `Storyboard generado: ${sceneCount} escenas (${formatDurationCompact(totalDuration)})`,
        `Storyboard generated: ${sceneCount} scenes (${formatDurationCompact(totalDuration)})`,
      ),
    )

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#13151b] border-[#252936] text-white p-6 rounded-2xl">
        <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
          <Clapperboard size={18} className="text-primary" />
          <span>{t('Guion a Vídeo / Storyboard', 'Script to Video / Storyboard')}</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          {t(
            'Pega tu guion y Sparta organizará automáticamente las escenas, tiempos y marcadores en la línea de tiempo.',
            'Paste your script and Sparta will automatically organize scenes, timings, and markers on the timeline.',
          )}
        </DialogDescription>

        <div className="space-y-4 my-4">
          <div>
            <label className="text-xs font-semibold text-white/80 block mb-1.5">
              {t('Guion o Guion por Escenas (separa los párrafos con Enter)', 'Script by Scenes (separate paragraphs with Enter)')}
            </label>
            <textarea
              rows={7}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder={t(
                'Ejemplo:\nNadie creía que podíamos terminar este proyecto a tiempo.\n\nPero encontramos la herramienta que cambió nuestra forma de trabajar.\n\nAhora producimos videos en minutos.',
                'Example:\nNobody believed we could finish this project on time.\n\nUntil we discovered the tool that changed our entire workflow.\n\nNow we produce videos in minutes.',
              )}
              className="w-full rounded-xl border border-white/10 bg-[#1c1f2a] p-3 text-xs text-white placeholder:text-white/30 outline-none focus:border-primary/50 resize-none font-sans leading-relaxed"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div>
              <span className="text-xs font-semibold text-white block">
                {t('Velocidad de locución', 'Narration pacing')}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t('Afecta el cálculo de duración de cada escena', 'Affects duration calculation per scene')}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#14161f] p-1 rounded-lg border border-white/10">
              {(['slow', 'normal', 'fast'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSpeed(mode)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                    speed === mode ? 'bg-primary text-black font-semibold' : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  {mode === 'slow' ? t('Pausado', 'Slow') : mode === 'normal' ? t('Normal', 'Normal') : t('Dinámico', 'Fast')}
                </button>
              ))}
            </div>
          </div>

          {scenes.length > 0 && (
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-mono">
              <span>{scenes.length} {t('escenas detectadas', 'scenes detected')}</span>
              <span>{t('Duración estimada:', 'Est. duration:')} {formatDurationCompact(estimatedDuration)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3.5 py-1.5 rounded-xl border border-white/10 text-xs font-medium text-white/70 hover:bg-white/5 transition-colors cursor-pointer"
          >
            {t('Cancelar', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={!scriptText.trim()}
            onClick={handleGenerate}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <Film size={14} />
            <span>{t('Generar en línea de tiempo', 'Generate Timeline')}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

