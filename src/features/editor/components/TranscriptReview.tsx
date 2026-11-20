import { useMemo, useState } from 'react'
import { AudioLines, Clock3, Scissors, Search, X } from 'lucide-react'
import type { SilenceSuggestion, TranscriptCue } from '../model'
import { formatTimecode } from '../timecode'
import { t } from '../../../shared/i18n/locale'

type Props = {
  cues: TranscriptCue[]
  pauses: SilenceSuggestion[]
  frameRate: number
  onClose: () => void
  onSeek: (time: number) => void
  onCut: (suggestion: SilenceSuggestion) => void
  onTranscribe: () => void
  busy: boolean
}

export function TranscriptReview({ cues, pauses, frameRate, onClose, onSeek, onCut, onTranscribe, busy }: Props) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => cues.filter((cue) => cue.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [cues, query])
  const suggestions = pauses.filter((pause) => pause.duration >= 0.8)
  const totalRemovableSeconds = suggestions.reduce((sum, item) => sum + item.duration, 0)
  return <section className="absolute inset-0 z-20 flex flex-col bg-[#10131a] text-white" aria-label={t('Transcripción del proyecto', 'Project transcript')}>
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-2"><AudioLines size={16} className="text-cyan-300" /><div><strong className="block text-sm">{t('Transcripción', 'Transcript')}</strong><span className="text-[10px] text-white/45">{t('Procesada localmente en este dispositivo', 'Processed locally on this device')}</span></div></div>
      <button type="button" onClick={onClose} aria-label={t('Cerrar', 'Close')} className="rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-white"><X size={16} /></button>
    </header>
    <div className="border-b border-white/10 p-3">
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2"><Search size={13} className="text-white/40" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Buscar en la transcripción', 'Search transcript')} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-white/30" /></label>
      {suggestions.length > 0 && <div className="mt-3 space-y-1.5">
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-amber-200/75"><span>{t('Pausas largas', 'Long pauses')} · {suggestions.length}</span><span>{t('Ahorro potencial', 'Potential trim')} {totalRemovableSeconds.toFixed(1)}s</span></div>
        {suggestions.map((pause) => <div key={pause.id} className="flex items-center gap-2 rounded-lg border border-amber-300/10 bg-amber-300/[0.04] px-2.5 py-2">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSeek(pause.start)}><Clock3 size={12} className="shrink-0 text-amber-200/70" /><span className="truncate text-[11px]">{formatTimecode(pause.start, frameRate)}–{formatTimecode(pause.end, frameRate)}</span><span className="ml-auto text-[10px] text-white/45">{pause.duration.toFixed(1)}s</span></button>
          <button type="button" onClick={() => onCut(pause)} className="flex shrink-0 items-center gap-1 rounded-md border border-amber-200/15 px-2 py-1 text-[10px] text-amber-100 hover:bg-amber-100/10"><Scissors size={11} />{t('Quitar', 'Cut')}</button>
        </div>)}
      </div>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {!cues.length ? <div className="flex h-full flex-col items-center justify-center px-5 text-center"><AudioLines size={26} className="mb-3 text-cyan-200/60" /><strong className="text-sm">{t('Genera la transcripción del video', 'Generate a video transcript')}</strong><p className="mb-4 mt-1 text-xs leading-relaxed text-white/45">{t('Whisper analiza el audio localmente. Luego podrás buscar frases, saltar a cada momento y revisar cortes sugeridos.', 'Whisper analyzes audio locally. Then search phrases, jump to each moment, and review suggested cuts.')}</p><button type="button" onClick={onTranscribe} disabled={busy} className="rounded-lg bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/25 disabled:opacity-50">{busy ? t('Analizando…', 'Analyzing…') : t('Transcribir gratis', 'Transcribe for free')}</button></div>
        : filtered.length ? <div className="space-y-1">{filtered.map((cue) => <button key={cue.id} type="button" onClick={() => onSeek(cue.start)} className="group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.06]"><span className="mt-0.5 shrink-0 font-mono text-[10px] text-cyan-200/70">{formatTimecode(cue.start, frameRate)}</span><span className="text-xs leading-relaxed text-white/85">{cue.text}</span></button>)}</div>
        : <p className="p-4 text-center text-xs text-white/45">{t('No hay frases que coincidan con la búsqueda.', 'No transcript lines match your search.')}</p>}
    </div>
  </section>
}
