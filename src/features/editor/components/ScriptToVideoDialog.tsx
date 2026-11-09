import { useState, useId } from 'react'
import { Clapperboard, Film, Sparkles, Clock, Layers, Plus, Minus } from 'lucide-react'
import {
  buildScriptStoryboard,
  parseScriptIntoScenes,
  type ScriptScene,
} from '../services/script-to-video'
import { useEditorStore } from '../editor-store'
import { formatDurationCompact } from '../../../shared/lib/format-time'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../shared/ui/dialog'

interface ScriptToVideoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScriptToVideoDialog({ open, onOpenChange }: ScriptToVideoDialogProps) {
  const [tab, setTab] = useState<'script' | 'storyboard'>('script')
  const [scriptText, setScriptText] = useState('')
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal')
  const [includeBRoll, setIncludeBRoll] = useState(true)
  const [presetId, setPresetId] = useState('hormozi-karaoke')
  const [customScenes, setCustomScenes] = useState<ScriptScene[]>([])

  const brollCheckboxId = useId()
  const assets = useEditorStore((s) => s.assets)

  const wpmMap = {
    slow: 110,
    normal: 140,
    fast: 175,
  }

  // Synchronize parsed scenes when user changes text or speed
  const handleTextChange = (text: string) => {
    setScriptText(text)
    const parsed = parseScriptIntoScenes(text, { wpm: wpmMap[speed] })
    setCustomScenes(parsed)
  }

  const handleSpeedChange = (newSpeed: 'slow' | 'normal' | 'fast') => {
    setSpeed(newSpeed)
    const parsed = parseScriptIntoScenes(scriptText, { wpm: wpmMap[newSpeed] })
    setCustomScenes(parsed)
  }

  const handleUpdateSceneText = (index: number, newText: string) => {
    setCustomScenes((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, text: newText } : s)),
    )
  }

  const handleAdjustDuration = (index: number, delta: number) => {
    setCustomScenes((prev) => {
      const next = [...prev]
      const current = next[index]
      const newDuration = Math.max(1.5, Math.round((current.duration + delta) * 10) / 10)
      next[index] = { ...current, duration: newDuration }

      // Recompute subsequent start times
      let cursor = 0
      for (let i = 0; i < next.length; i++) {
        next[i] = { ...next[i], startTime: cursor }
        cursor += next[i].duration
      }
      return next
    })
  }

  const handleAssignAsset = (sceneIndex: number, assetId: string) => {
    setCustomScenes((prev) =>
      prev.map((s, idx) => (idx === sceneIndex ? { ...s, assignedAssetId: assetId || undefined } : s)),
    )
  }

  const activeScenes = customScenes.length > 0 ? customScenes : parseScriptIntoScenes(scriptText, { wpm: wpmMap[speed] })
  const estimatedDuration = activeScenes.reduce((sum, s) => sum + s.duration, 0)

  const handleGenerate = () => {
    if (!scriptText.trim() && activeScenes.length === 0) return

    const { sceneCount, totalDuration } = buildScriptStoryboard(scriptText, {
      wpm: wpmMap[speed],
      presetId,
      includeBRollTrack: includeBRoll,
      customScenes: activeScenes,
    })

    toast.success(
      t(
        `Storyboard insertado: ${sceneCount} escenas en ${formatDurationCompact(totalDuration)}`,
        `Storyboard inserted: ${sceneCount} scenes across ${formatDurationCompact(totalDuration)}`,
      ),
      {
        description: t(
          'Pistas de subtítulos, B-roll y marcadores creadas con éxito.',
          'Subtitle, B-roll, and scene markers successfully populated.',
        ),
      },
    )

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-[#12141a] border-[#232733] text-white p-6 rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <Clapperboard size={18} className="text-primary" />
            <span>{t('Guion a Video / Storyboard Profesional', 'Script to Video / Pro Storyboard')}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t(
              'Pega tu guion y Sparta organizará automáticamente las escenas, tiempos y marcadores en la línea de tiempo.',
              'Paste your script and Sparta will automatically organize scenes, timings, and markers on the timeline.',
            )}
          </DialogDescription>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-[#1a1d26] p-1 rounded-xl border border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setTab('script')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                tab === 'script' ? 'bg-primary text-black font-semibold' : 'text-white/70 hover:text-white'
              }`}
            >
              {t('1. Guion', '1. Script')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (customScenes.length === 0 && scriptText.trim()) {
                  setCustomScenes(parseScriptIntoScenes(scriptText, { wpm: wpmMap[speed] }))
                }
                setTab('storyboard')
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                tab === 'storyboard' ? 'bg-primary text-black font-semibold' : 'text-white/70 hover:text-white'
              }`}
            >
              {t('2. Escenas & B-Roll', '2. Scenes & B-Roll')} ({activeScenes.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Guion */}
        {tab === 'script' && (
          <div className="space-y-4 my-4 flex-1 overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-semibold text-white/80 block mb-1.5">
                {t('Pega tu guion (cada párrafo separado por doble espacio será una escena)', 'Paste your script (double linebreaks become scenes)')}
              </label>
              <textarea
                rows={8}
                value={scriptText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={t(
                  'Ejemplo:\nNadie creía que podíamos terminar este proyecto a tiempo.\n\nPero encontramos la herramienta que cambió nuestra forma de trabajar.\n\nAhora producimos videos en minutos.',
                  'Example:\nNobody believed we could finish this project on time.\n\nUntil we discovered the tool that changed our entire workflow.\n\nNow we produce videos in minutes.',
                )}
                className="w-full rounded-xl border border-white/10 bg-[#171922] p-3 text-xs text-white placeholder:text-white/30 outline-none focus:border-primary/50 resize-none font-sans leading-relaxed"
              />
            </div>

            {/* Controls Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pacing */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white block">
                    {t('Ritmo de locución', 'Narration pacing')}
                  </span>
                  <Clock size={13} className="text-primary" />
                </div>
                <div className="flex items-center gap-1 bg-[#14161f] p-1 rounded-lg border border-white/10">
                  {(['slow', 'normal', 'fast'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSpeedChange(mode)}
                      className={`flex-1 py-1 text-[11px] rounded font-medium transition-colors cursor-pointer text-center ${
                        speed === mode ? 'bg-primary text-black font-semibold' : 'text-muted-foreground hover:text-white'
                      }`}
                    >
                      {mode === 'slow' ? t('Pausado', 'Slow') : mode === 'normal' ? t('Normal', 'Normal') : t('Rápido', 'Fast')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtitle Preset */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white block">
                    {t('Estilo de subtítulos', 'Subtitle Style')}
                  </span>
                  <Sparkles size={13} className="text-primary" />
                </div>
                <select
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                  className="w-full h-8 rounded-lg border border-white/10 bg-[#14161f] px-2 text-xs text-white outline-none focus:border-primary/50"
                >
                  <option value="hormozi-karaoke">Hormozi Karaoke (Viral)</option>
                  <option value="pop-pill">Pop Pill (Minimalista)</option>
                  <option value="cine-4k">Cine 4K (Subtítulo Elegante)</option>
                  <option value="cyber-neon">Cyber Neon (Glow)</option>
                  <option value="impact-hook">Impact Hook (Gancho Grande)</option>
                </select>
              </div>
            </div>

            {/* B-Roll checkbox */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <input
                type="checkbox"
                id={brollCheckboxId}
                checked={includeBRoll}
                onChange={(e) => setIncludeBRoll(e.target.checked)}
                className="rounded border-white/20 text-primary focus:ring-primary/40 size-4 cursor-pointer"
              />
              <label htmlFor={brollCheckboxId} className="text-xs text-white cursor-pointer select-none">
                <span className="font-semibold block">{t('Generar pista de B-Roll / Tomas visuales', 'Generate B-Roll / Visual takes track')}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t('Inserta bloques de video con sugerencias de toma para cada escena', 'Places video blocks with shot suggestions for each scene')}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Tab 2: Storyboard / Escenas */}
        {tab === 'storyboard' && (
          <div className="space-y-3 my-4 flex-1 overflow-y-auto pr-1 max-h-[50vh]">
            {activeScenes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                {t('Pega primero tu guion en la pestaña 1 para ver el desglose de escenas.', 'Paste your script first in tab 1 to see the scene breakdown.')}
              </div>
            ) : (
              activeScenes.map((scene, idx) => (
                <div
                  key={scene.id || idx}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Layers size={13} />
                      {t(`Escena ${scene.index}`, `Scene ${scene.index}`)}
                    </span>

                    {/* Duration Controller */}
                    <div className="flex items-center gap-1 bg-[#181a24] px-2 py-0.5 rounded-lg border border-white/10 text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => handleAdjustDuration(idx, -0.5)}
                        className="p-1 hover:text-primary transition-colors cursor-pointer"
                        title={t('Reducir 0.5s', 'Decrease 0.5s')}
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-12 text-center text-white">{scene.duration.toFixed(1)}s</span>
                      <button
                        type="button"
                        onClick={() => handleAdjustDuration(idx, 0.5)}
                        className="p-1 hover:text-primary transition-colors cursor-pointer"
                        title={t('Aumentar 0.5s', 'Increase 0.5s')}
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Scene text */}
                  <textarea
                    rows={2}
                    value={scene.text}
                    onChange={(e) => handleUpdateSceneText(idx, e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#161822] p-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-primary/40 resize-none font-sans"
                  />

                  {/* Visual Suggestion / Asset picker */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                      <Film size={12} className="text-white/40 shrink-0" />
                      <span className="truncate">{scene.visualPrompt}</span>
                    </div>

                    {assets.length > 0 && (
                      <select
                        value={scene.assignedAssetId || ''}
                        onChange={(e) => handleAssignAsset(idx, e.target.value)}
                        className="h-6 rounded bg-[#161822] border border-white/10 px-2 text-[10px] text-white/90 outline-none"
                      >
                        <option value="">{t('Asset B-roll automático', 'Auto B-roll asset')}</option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <div className="text-xs text-muted-foreground font-mono">
            {activeScenes.length > 0 && (
              <span>
                {activeScenes.length} {t('escenas', 'scenes')} · {formatDurationCompact(estimatedDuration)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3.5 py-1.5 rounded-xl border border-white/10 text-xs font-medium text-white/70 hover:bg-white/5 transition-colors cursor-pointer"
            >
              {t('Cancelar', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={!scriptText.trim() && activeScenes.length === 0}
              onClick={handleGenerate}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-md shadow-primary/20 disabled:opacity-50"
            >
              <Film size={14} />
              <span>{t('Generar en línea de tiempo', 'Generate Timeline')}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
