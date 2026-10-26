import { useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines, Bot, ChevronRight, Eraser, LoaderCircle, LockKeyhole, MessageSquareText, Send, Sparkles, WandSparkles } from 'lucide-react'
import { IconButton } from './controls'
import { AudioGenerationPanel } from './AudioGenerationPanel'
import { useEditorStore } from '../editor-store'
import { AI_PREFS_EVENT } from '../services/ai-preferences'
import { readProviderRegistry, type ProviderRegistry } from '../services/ai-provider-registry'
import { sendAIChat, type AnalysisDepth, type ChatMessage } from '../services/ai-chat'
import { t } from '../services/locale'

type Props = { open: boolean; onClose: () => void; projectName: string }
type Mode = 'create' | 'edit' | 'audio'
type ChatEntry = ChatMessage & { id: string }
const HISTORY_LIMIT = 40
const historyKey = (project: string) => `sparta-ai-chat:${encodeURIComponent(project)}`
const modelKey = (project: string) => `sparta-ai-chat-model:${encodeURIComponent(project)}`
function readHistory(project: string): ChatEntry[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(historyKey(project)) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is ChatEntry => Boolean(item && typeof item === 'object' && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string' && typeof item.id === 'string')).slice(-HISTORY_LIMIT)
  } catch { return [] }
}
function getAssignedModel(registry: ProviderRegistry, key: string) {
  const [profileId, ...modelParts] = key.split('::')
  const id = modelParts.join('::')
  const profile = registry.profiles.find((item) => item.id === profileId)
  const model = profile?.models.find((item) => item.id === id && item.capabilities.includes('text'))
  return profile && model ? { profile, model } : null
}

export function AssistantPanel(props: Props) {
  return <AssistantPanelSession key={props.projectName} {...props} />
}

function AssistantPanelSession({ open, onClose, projectName }: Props) {
  const [mode, setMode] = useState<Mode>('edit')
  const [draft, setDraft] = useState('')
  const [registry, setRegistry] = useState<ProviderRegistry>(readProviderRegistry)
  const options = useMemo(() => registry.profiles.flatMap((profile) => profile.models
    .filter((model) => model.capabilities.includes('text'))
    .map((model) => ({ key: `${profile.id}::${model.id}`, profile, model }))), [registry])
  const assignedKey = registry.assignments.text ?? ''
  const [selectedKey, setSelectedKey] = useState(() => {
    try { return window.localStorage.getItem(modelKey(projectName)) || '' } catch { return '' }
  })
  const selected = getAssignedModel(registry, selectedKey) ?? getAssignedModel(registry, assignedKey)
  const selectedKeyValue = selected ? `${selected.profile.id}::${selected.model.id}` : ''
  const [depth, setDepth] = useState<AnalysisDepth>(() => {
    try { const saved = window.localStorage.getItem('sparta-ai-analysis-depth'); return saved === 'concise' || saved === 'deep' ? saved : 'balanced' } catch { return 'balanced' }
  })
  const [messages, setMessages] = useState<ChatEntry[]>(() => readHistory(projectName))
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const sequence = useEditorStore((state) => state.sequence)
  const tracks = useEditorStore((state) => state.tracks)
  const assets = useEditorStore((state) => state.assets)
  const markers = useEditorStore((state) => state.markers)
  const playhead = useEditorStore((state) => state.playhead)
  const selectedClipId = useEditorStore((state) => state.selectedClipId)

  useEffect(() => {
    const refresh = () => setRegistry(readProviderRegistry())
    window.addEventListener(AI_PREFS_EVENT, refresh)
    return () => window.removeEventListener(AI_PREFS_EVENT, refresh)
  }, [])
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight }, [messages, requesting, mode])

  const projectContext = useMemo(() => {
    const duration = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)))
    const trackSummary = tracks.map((track) => `${track.name} (${track.kind}): ${track.clips.map((clip) => `${clip.title} ${clip.start.toFixed(2)}s–${(clip.start + clip.duration).toFixed(2)}s`).join('; ') || 'vacía'}`).join('\n')
    const mediaSummary = assets.map((asset) => `${asset.title} (${asset.type}${asset.detail ? `, ${asset.detail}` : ''})`).join(', ')
    const selectedClip = tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId)
    return [
      `Proyecto: ${projectName}`,
      `Secuencia: ${sequence.width}×${sequence.height}, ${sequence.frameRate} fps, duración actual ${duration.toFixed(2)} s.`,
      `Cabezal: ${playhead.toFixed(2)} s. Clip seleccionado: ${selectedClip ? `${selectedClip.title} en ${selectedClip.start.toFixed(2)} s, duración ${selectedClip.duration.toFixed(2)} s` : 'ninguno'}.`,
      `Pistas y clips:\n${trackSummary || 'Sin pistas.'}`,
      `Medios catalogados: ${mediaSummary || 'ninguno'}. Marcadores: ${markers.length}.`,
      'Este resumen no incluye rutas locales ni archivos fuente.',
    ].join('\n')
  }, [projectName, sequence, tracks, assets, markers.length, playhead, selectedClipId])

  const persist = (next: ChatEntry[]) => {
    const bounded = next.slice(-HISTORY_LIMIT)
    setMessages(bounded)
    try { window.localStorage.setItem(historyKey(projectName), JSON.stringify(bounded)) } catch { setError(t('No se pudo guardar el historial en este equipo.', 'Could not save chat history on this device.')) }
  }

  const send = async () => {
    const clean = draft.trim()
    if (!clean || requesting || !selected) return
    setDraft(''); setError('')
    const userMessage: ChatEntry = { id: crypto.randomUUID(), role: 'user', content: clean }
    const next = [...messages, userMessage].slice(-HISTORY_LIMIT)
    persist(next)
    setRequesting(true)
    try {
      const answer = await sendAIChat({
        profile: selected.profile,
        modelId: selected.model.id,
        messages: next.map(({ role, content }) => ({ role, content })),
        projectContext,
        mode: mode === 'create' ? 'create' : 'edit',
        depth,
      })
      persist([...next, { id: crypto.randomUUID(), role: 'assistant', content: answer }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally { setRequesting(false) }
  }

  const clearHistory = () => {
    if (requesting) return
    setMessages([]); setError('')
    try { window.localStorage.removeItem(historyKey(projectName)) } catch { /* keep the cleared session in memory */ }
  }
  const selectModel = (value: string) => {
    setSelectedKey(value)
    try { window.localStorage.setItem(modelKey(projectName), value) } catch { /* selection remains for this session */ }
  }
  const selectDepth = (value: AnalysisDepth) => {
    setDepth(value)
    try { window.localStorage.setItem('sparta-ai-analysis-depth', value) } catch { /* selection remains for this session */ }
  }

  return <aside className={`assistant-panel ${open ? '' : 'hidden'}`}>
    <div className="assistant-heading">
      <div className="assistant-badge"><WandSparkles size={16} /></div>
      <div className="assistant-heading-copy"><strong>Sparta AI</strong><span>{selected ? `${selected.profile.name} · ${selected.model.name}` : t('Conecta un modelo de texto', 'Connect a text model')}</span></div>
      <IconButton label={t('Borrar conversación de este proyecto', 'Clear this project chat')} disabled={!messages.length || requesting} onClick={clearHistory}><Eraser size={14} /></IconButton>
      <button className="subtle-button" title={t('Cerrar asistente', 'Close assistant')} aria-label={t('Cerrar asistente', 'Close assistant')} onClick={onClose}><ChevronRight size={17} /></button>
    </div>
    <div className="assistant-mode-tabs" role="tablist" aria-label={t('Modo del asistente', 'Assistant mode')}>
      <div className="assistant-mode-tabs-inner has-audio-tab">
        <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}><Sparkles size={13} />{t('Crear video', 'Create video')}</button>
        <button type="button" role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}><MessageSquareText size={13} />{t('Editar proyecto', 'Edit project')}</button>
        <button type="button" role="tab" aria-label={t('Generador de audio', 'Audio generator')} aria-selected={mode === 'audio'} className={mode === 'audio' ? 'active' : ''} onClick={() => setMode('audio')}><AudioLines size={13} />{t('Audio', 'Audio')}</button>
      </div>
    </div>
    <div className="assistant-context"><span className="context-dot" /> {mode === 'create' ? t('PLANIFICAR VIDEO', 'PLAN VIDEO') : mode === 'audio' ? t('ESTUDIO DE AUDIO', 'AUDIO STUDIO') : <>{t('TRABAJANDO EN', 'WORKING ON')} <strong title={projectName}>{projectName}</strong></>}</div>
    <div className="chat-content" ref={feedRef}>
      {mode === 'audio' ? <AudioGenerationPanel /> : <>
        {!messages.length && !requesting && <div className="chat-welcome"><div className="welcome-spark"><Bot size={18} /></div><h3>{selected ? t('¿En qué trabajamos?', 'What are we working on?') : t('Configura un modelo para empezar', 'Set up a model to get started')}</h3><p>{selected ? t('El asistente recibirá el estado actual del proyecto y el historial reciente de esta conversación.', 'The assistant will receive the current project state and recent chat history.') : t('Agrega un proveedor y carga un modelo con capacidad de texto desde Preferencias → IA y Proveedores.', 'Add a provider and load a text-capable model in Preferences → AI Providers.')}</p></div>}
        {messages.map((message) => <article className={`assistant-chat-message ${message.role}`} key={message.id}><span className="assistant-message-icon">{message.role === 'assistant' ? <Bot size={13} /> : null}</span><div className="assistant-message-content">{message.content}</div></article>)}
        {requesting && <p className="assistant-thinking" role="status"><LoaderCircle className="spin" size={13} /> {t('Analizando el proyecto y preparando la respuesta…', 'Analyzing the project and preparing a response…')}</p>}
        {error && <p className="assistant-chat-error" role="alert">{error}</p>}
      </>}
    </div>
    {mode !== 'audio' && <div className="chat-compose">
      <div className="assistant-model-controls">
        <label><span className="sr-only">{t('Modelo de texto', 'Text model')}</span><select aria-label={t('Modelo de texto', 'Text model')} value={selectedKeyValue} onChange={(event) => selectModel(event.target.value)}><option value="">{t('Seleccionar modelo', 'Select a model')}</option>{options.map(({ key, profile, model }) => <option key={key} value={key}>{profile.name} · {model.name}</option>)}</select></label>
        <label><span className="sr-only">{t('Profundidad de análisis', 'Analysis depth')}</span><select aria-label={t('Profundidad de análisis', 'Analysis depth')} value={depth} onChange={(event) => selectDepth(event.target.value as AnalysisDepth)}><option value="concise">{t('Breve', 'Concise')}</option><option value="balanced">{t('Equilibrada', 'Balanced')}</option><option value="deep">{t('Profunda', 'Deep')}</option></select></label>
      </div>
      <textarea aria-label={t('Mensaje para Sparta AI', 'Message for Sparta AI')} placeholder={mode === 'create' ? t('Describe el video que quieres planear…', 'Describe the video you want to plan…') : t('Pregunta sobre este proyecto…', 'Ask about this project…')} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} />
      <div className="compose-bottom"><span className="assistant-memory-note"><LockKeyhole size={10} />{t('Historial local · contexto enviado al proveedor', 'Local history · context sent to provider')}</span><button className="send-button" aria-label={t('Enviar mensaje', 'Send message')} title={!selected ? t('Selecciona un modelo de texto', 'Select a text model') : t('Enviar mensaje', 'Send message')} onClick={() => void send()} disabled={requesting || !draft.trim() || !selected}>{requesting ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}</button></div>
    </div>}
    <div className="assistant-disclaimer"><LockKeyhole size={11} /> {mode === 'audio' ? t('Generación externa · requiere clave y consume créditos', 'External generation · requires an API key and uses credits') : t('Las solicitudes se envían al proveedor del modelo seleccionado', 'Requests are sent to the selected model provider')}</div>
  </aside>
}
