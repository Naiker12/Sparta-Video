import { useEffect, useMemo, useState } from 'react'
import { AudioLines, Check, Download, LoaderCircle, Mic2, Music2, RefreshCw, Sparkles } from 'lucide-react'
import { t } from '../services/locale'
import { readProviderRegistry, type AITask, type ProviderRegistry } from '../services/ai-provider-registry'
import { generateElevenLabsAudio, listElevenLabsVoices, type ElevenLabsVoice } from '../services/audio-generation'

type AudioMode = 'voice' | 'audio'
type GeneratedResult = { url: string; filename: string; label: string }
const selectedProvider = (registry: ProviderRegistry, task: AITask) => {
  const value = registry.assignments[task] ?? ''
  const splitAt = value.indexOf('::')
  if (splitAt < 0) return null
  const profileId = value.slice(0, splitAt)
  const modelId = value.slice(splitAt + 2)
  const profile = registry.profiles.find((item) => item.id === profileId)
  const model = profile?.models.find((item) => item.id === modelId)
  return profile && model ? { profile, model } : null
}

export function AudioGenerationPanel() {
  const [registry] = useState<ProviderRegistry>(readProviderRegistry)
  const [mode, setMode] = useState<AudioMode>('voice')
  const [prompt, setPrompt] = useState('')
  const [durationSeconds, setDurationSeconds] = useState(8)
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [voiceId, setVoiceId] = useState('')
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [result, setResult] = useState<GeneratedResult | null>(null)
  const assignment = useMemo(() => selectedProvider(registry, mode), [registry, mode])
  const profile = assignment?.profile
  const isElevenLabs = profile?.kind === 'elevenlabs'

  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url) }, [result?.url])

  const loadVoices = async () => {
    if (!profile || profile.kind !== 'elevenlabs') return
    setLoadingVoices(true); setError(''); setNotice('')
    try {
      const available = await listElevenLabsVoices(profile)
      setVoices(available)
      setVoiceId((current) => available.some((voice) => voice.id === current) ? current : available[0]?.id ?? '')
      if (!available.length) setError(t('La cuenta no devolvió voces disponibles.', 'The account returned no available voices.'))
      else setNotice(t(`${available.length} voces disponibles.`, `${available.length} voices available.`))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally { setLoadingVoices(false) }
  }

  const generate = async () => {
    const clean = prompt.trim()
    if (!assignment || !isElevenLabs || !clean || generating) return
    if (mode === 'voice' && !voiceId) { setError(t('Carga y selecciona una voz antes de generar.', 'Load and select a voice before generating.')); return }
    setGenerating(true); setError(''); setNotice('')
    try {
      const encoded = await generateElevenLabsAudio({
        profile: assignment.profile, modelId: assignment.model.id, task: mode, text: clean,
        voiceId: mode === 'voice' ? voiceId : undefined,
        durationSeconds: mode === 'audio' ? durationSeconds : undefined,
      })
      const binary = atob(encoded)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
      const safeLabel = clean.slice(0, 36).replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '') || 'sparta-audio'
      const filename = `${mode === 'voice' ? 'narracion' : 'efecto'}-${safeLabel}.mp3`
      setResult({ url, filename, label: assignment.model.name })
      setNotice(t('Audio listo para escuchar o descargar.', 'Audio is ready to preview or download.'))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message.includes('Failed to fetch') || message.includes('NetworkError')
        ? t('No se pudo conectar desde el navegador. Usa la app Tauri para generar audio sin restricciones CORS.', 'The browser could not connect. Use the Tauri desktop app to generate audio without CORS restrictions.')
        : message)
    } finally { setGenerating(false) }
  }

  const switchMode = (next: AudioMode) => {
    setMode(next); setError(''); setNotice(''); setResult(null); setVoices([]); setVoiceId('')
  }

  return <section className="audio-generation-panel">
    <header className="audio-generation-heading">
      <span className="audio-generation-icon"><AudioLines size={17} /></span>
      <div><h3>{t('Generar audio', 'Generate audio')}</h3><p>{t('Crea una narración o un efecto sonoro para tu video.', 'Create narration or a sound effect for your video.')}</p></div>
    </header>
    <div className="audio-generation-tabs" role="tablist" aria-label={t('Tipo de audio', 'Audio type')}>
      <button type="button" role="tab" aria-selected={mode === 'voice'} className={mode === 'voice' ? 'active' : ''} onClick={() => switchMode('voice')}><Mic2 size={13} />{t('Voz y narración', 'Voice and narration')}</button>
      <button type="button" role="tab" aria-selected={mode === 'audio'} className={mode === 'audio' ? 'active' : ''} onClick={() => switchMode('audio')}><Music2 size={13} />{t('Efecto sonoro', 'Sound effect')}</button>
    </div>

    <div className="audio-provider-status">
      <div><span className={`audio-status-dot ${isElevenLabs ? 'ready' : ''}`} /><span>{assignment ? `${assignment.profile.name} · ${assignment.model.name}` : t('Sin modelo asignado', 'No model assigned')}</span></div>
      {!isElevenLabs && <p>{t('Asigna un modelo de ElevenLabs en Preferencias → IA y Proveedores para generar audio desde aquí.', 'Assign an ElevenLabs model in Preferences → AI Providers to generate audio here.')}</p>}
    </div>

    {mode === 'voice' && <div className="audio-form-row">
      <label htmlFor="audio-voice-select">{t('Voz', 'Voice')}</label>
      <div className="audio-voice-picker"><select id="audio-voice-select" value={voiceId} disabled={!voices.length} onChange={(event) => setVoiceId(event.target.value)}><option value="">{t('Carga las voces de tu cuenta', 'Load voices from your account')}</option>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}{voice.category ? ` · ${voice.category}` : ''}</option>)}</select><button type="button" disabled={!isElevenLabs || loadingVoices} onClick={() => void loadVoices()} aria-label={t('Cargar voces', 'Load voices')} title={t('Cargar voces', 'Load voices')}>{loadingVoices ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}</button></div>
    </div>}

    {mode === 'audio' && <div className="audio-form-row"><label htmlFor="audio-duration">{t('Duración estimada', 'Approximate duration')}</label><select id="audio-duration" value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))}><option value={4}>4 {t('segundos', 'seconds')}</option><option value={8}>8 {t('segundos', 'seconds')}</option><option value={15}>15 {t('segundos', 'seconds')}</option><option value={30}>30 {t('segundos', 'seconds')}</option></select></div>}

    <label className="audio-prompt-label" htmlFor="audio-generation-prompt">{mode === 'voice' ? t('Texto de narración', 'Narration text') : t('Describe el sonido', 'Describe the sound')}</label>
    <textarea id="audio-generation-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={10_000} placeholder={mode === 'voice' ? t('Escribe o pega aquí la narración que quieres escuchar…', 'Write or paste the narration you want to hear…') : t('Ej.: olas suaves en una costa con viento ligero y aves a lo lejos…', 'E.g. gentle waves on a coast, light wind, and distant seabirds…')} />
    <div className="audio-generation-footer"><span>{prompt.length.toLocaleString()} / 10 000 · {mode === 'voice' ? t('El proveedor cobra por caracteres.', 'Provider charges by characters.') : t('El proveedor cobra por generación.', 'Provider charges per generation.')}</span><button type="button" disabled={!isElevenLabs || !prompt.trim() || generating || (mode === 'voice' && !voiceId)} onClick={() => void generate()}>{generating ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}{generating ? t('Generando…', 'Generating…') : t('Generar audio', 'Generate audio')}</button></div>

    {(error || notice) && <p className={`audio-generation-message ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{error || notice}</p>}
    {result && <article className="generated-audio-card"><div><Check size={14} /><strong>{result.label}</strong><span>{result.filename}</span></div><audio controls preload="metadata" src={result.url}>{t('Tu navegador no puede reproducir este audio.', 'Your browser cannot play this audio.')}</audio><a href={result.url} download={result.filename}><Download size={13} />{t('Descargar MP3', 'Download MP3')}</a></article>}
    <p className="audio-generation-note">{t('La generación usa créditos de tu cuenta de ElevenLabs. El resultado se previsualiza aquí; aún no se inserta en la línea de tiempo.', 'Generation uses credits from your ElevenLabs account. Preview the result here; it is not inserted into the timeline yet.')}</p>
  </section>
}
