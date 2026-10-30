import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Braces, Check, ChevronDown, ChevronRight, Eraser, ListChecks, LoaderCircle, LockKeyhole, PlayCircle, Send } from 'lucide-react'
import { IconButton } from './controls'
import { Badge } from '../../../components/ui/badge'
import { AudioGenerationPanel } from './AudioGenerationPanel'
import {
  IconNleAspectRatio,
  IconNleAssistant,
  IconNleAudioMix,
  IconNleCaptions,
  IconNleMontage,
  IconNleScript,
  IconNleVoiceWave,
} from './StudioIcons'
import { useEditorStore } from '../editor-store'
import { AI_PREFS_EVENT } from '../services/ai-preferences'
import { readProviderRegistry, type ProviderRegistry } from '../services/ai-provider-registry'
import { sendAIChat, type AnalysisDepth, type ChatMessage } from '../services/ai-chat'
import { applyAIOperations, extractAIProposal, formatOperationLabel } from '../services/ai-operations'
import { toast } from '../../../components/ui/toast-service'
import { t } from '../services/locale'

export type AssistantMode = 'create' | 'edit' | 'audio'
type Props = { open: boolean; onClose: () => void; projectName: string; activeMode?: AssistantMode; onModeChange?: (mode: AssistantMode) => void }
type Mode = AssistantMode
type ChatEntry = ChatMessage & { id: string }
const HISTORY_LIMIT = 40
const historyKey = (project: string) => `sparta-ai-chat:${encodeURIComponent(project)}`
const modelKey = (project: string) => `sparta-ai-chat-model:${encodeURIComponent(project)}`
function getVisibleAssistantText(content: string, proposal: ReturnType<typeof extractAIProposal>) {
  return proposal
    ? content.replace(/```(?:json)?\s*[\s\S]*?\s*```/gi, '').replace(/\n{3,}/g, '\n\n').trim()
    : content
}
function getAssistantPreview(content: string, proposal: ReturnType<typeof extractAIProposal>) {
  const plain = getVisibleAssistantText(content, proposal).replace(/```[\s\S]*?```/g, '').replace(/^\s{0,3}#{1,3}\s+/gm, '').replace(/[*`]/g, '').replace(/^\s*[-•]\s+/gm, '')
  const preview = plain.slice(0, 250).replace(/\s+\S*$/, '').trimEnd()
  return `${preview}${plain.length > 250 ? '…' : ''}`
}
function renderAssistantText(content: string, proposal: ReturnType<typeof extractAIProposal>) {
  const lines = getVisibleAssistantText(content, proposal).split(/\r?\n/)
  const blocks: { type: 'paragraph' | 'heading' | 'list' | 'code' | 'quote' | 'table'; text: string; level?: number; rows?: string[][] }[] = []
  let paragraph: string[] = []
  let list: string[] = []
  let code: string[] | null = null
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', text: list.join('\n') })
    list = []
  }
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    if (/^\s*```/.test(line)) {
      flushParagraph(); flushList()
      if (code) { blocks.push({ type: 'code', text: code.join('\n') }); code = null }
      else code = []
      continue
    }
    if (code) { code.push(line); continue }
    if (line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[lineIndex + 1] ?? '')) {
      flushParagraph(); flushList()
      const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
      const rows = [cells(line)]
      lineIndex += 2
      while (lineIndex < lines.length && lines[lineIndex].includes('|') && lines[lineIndex].trim()) {
        rows.push(cells(lines[lineIndex]))
        lineIndex += 1
      }
      lineIndex -= 1
      blocks.push({ type: 'table', text: '', rows })
      continue
    }
    const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/)
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: 'heading', text: heading[2], level: heading[1].length }); continue }
    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) { flushParagraph(); flushList(); blocks.push({ type: 'quote', text: quote[1] }); continue }
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/)
    if (item) { flushParagraph(); list.push(item[1]); continue }
    if (!line.trim()) { flushParagraph(); flushList(); continue }
    flushList()
    paragraph.push(line.trim())
  }
  flushParagraph(); flushList()
  if (code?.length && !proposal) blocks.push({ type: 'code', text: code.join('\n') })
  return blocks.map((block, index) => {
    if (block.type === 'heading') return <strong className={`assistant-markdown-heading level-${block.level}`} key={index}>{renderInline(block.text)}</strong>
    if (block.type === 'list') return <ul key={index}>{block.text.split('\n').map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>
    if (block.type === 'quote') return <blockquote key={index}>{renderInline(block.text)}</blockquote>
    if (block.type === 'table') return <div className="assistant-table-scroller" key={index}><table><thead><tr>{block.rows?.[0]?.map((cell, cellIndex) => <th key={cellIndex}>{renderInline(cell)}</th>)}</tr></thead><tbody>{block.rows?.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{block.rows?.[0]?.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] ?? '')}</td>)}</tr>)}</tbody></table></div>
    if (block.type === 'code') return <details className="assistant-code-details" key={index}>
      <summary><span><Braces size={13} /> {t('Ver detalles técnicos', 'View technical details')} <span className="assistant-code-language">{/^\s*(?:\{|\[)/.test(block.text) ? 'JSON' : 'CODE'}</span></span><ChevronDown size={13} /></summary>
      <pre><code>{block.text}</code></pre>
    </details>
    return <p key={index}>{renderInline(block.text)}</p>
  })
}
function renderInline(text: string) {
  return text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    return part
  })
}

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

function AssistantPanelSession({ open, onClose, projectName, activeMode, onModeChange }: Props) {
  const [internalMode, setInternalMode] = useState<Mode>('edit')
  const mode = activeMode ?? internalMode
  const setMode = (next: Mode) => {
    setInternalMode(next)
    onModeChange?.(next)
  }
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
  const followLatestRef = useRef(true)
  const initialHistoryAnchorRef = useRef(true)
  const [showLatestButton, setShowLatestButton] = useState(false)
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
  useEffect(() => {
    const feed = feedRef.current
    if (!feed) return
    if (initialHistoryAnchorRef.current) {
      initialHistoryAnchorRef.current = false
      const latestTurn = [...messages].reverse().find((message) => message.role === 'assistant') ?? messages.at(-1)
      if (latestTurn) {
        followLatestRef.current = false
        requestAnimationFrame(() => {
          const currentFeed = feedRef.current
          const target = currentFeed?.querySelector<HTMLElement>(`[data-message-id="${latestTurn.id}"]`)
          if (!currentFeed || !target) return
          const top = target.getBoundingClientRect().top - currentFeed.getBoundingClientRect().top + currentFeed.scrollTop - 8
          currentFeed.scrollTop = Math.max(0, top)
          setShowLatestButton(currentFeed.scrollHeight - currentFeed.scrollTop - currentFeed.clientHeight >= 56)
        })
        return
      }
    }
    if (!followLatestRef.current) return
    feed.scrollTo({ top: feed.scrollHeight, behavior: requesting ? 'auto' : 'smooth' })
  }, [messages, requesting, mode])

  const updateScrollFollow = () => {
    const feed = feedRef.current
    if (!feed) return
    const atLatest = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 56
    followLatestRef.current = atLatest
    setShowLatestButton(!atLatest)
  }

  const jumpToLatest = () => {
    followLatestRef.current = true
    setShowLatestButton(false)
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }

  const scrollToMessageStart = (id: string) => {
    requestAnimationFrame(() => {
      const feed = feedRef.current
      const message = feed?.querySelector<HTMLElement>(`[data-message-id="${id}"]`)
      if (!feed || !message) return
      const top = message.getBoundingClientRect().top - feed.getBoundingClientRect().top + feed.scrollTop - 8
      feed.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    })
  }

  const selectedClip = useMemo(
    () => tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId),
    [tracks, selectedClipId],
  )

  const projectContext = useMemo(() => {
    const duration = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)))
    const trackSummary = tracks.map((track) => `${track.name} [id=${track.id}] (${track.kind}): ${track.clips.map((clip) => `${clip.title} [id=${clip.id}] ${clip.start.toFixed(2)}s–${(clip.start + clip.duration).toFixed(2)}s (vol=${clip.volume ?? 100}%, op=${clip.opacity ?? 100}%)`).join('; ') || 'vacía'}`).join('\n')
    const mediaSummary = assets.map((asset) => `${asset.title} (${asset.type}${asset.detail ? `, ${asset.detail}` : ''})`).join(', ')
    return [
      `Proyecto: ${projectName}`,
      `Secuencia: ${sequence.width}×${sequence.height}, ${sequence.frameRate} fps, duración actual ${duration.toFixed(2)} s.`,
      `Cabezal: ${playhead.toFixed(2)} s. Clip seleccionado: ${selectedClip ? `${selectedClip.title} [id=${selectedClip.id}] en ${selectedClip.start.toFixed(2)} s, duración ${selectedClip.duration.toFixed(2)} s` : 'ninguno'}.`,
      `Pistas y clips:\n${trackSummary || 'Sin pistas.'}`,
      `Medios catalogados: ${mediaSummary || 'ninguno'}. Marcadores: ${markers.length}.`,
      'Este resumen no incluye rutas locales ni archivos fuente.',
    ].join('\n')
  }, [projectName, sequence, tracks, assets, markers.length, playhead, selectedClip])

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
    followLatestRef.current = false
    setShowLatestButton(false)
    persist(next)
    scrollToMessageStart(userMessage.id)
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
      const assistantMessage: ChatEntry = { id: crypto.randomUUID(), role: 'assistant', content: answer }
      persist([...next, assistantMessage])
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

  const promptSuggestions = useMemo(() => {
    if (mode === 'create') {
      return [
        {
          icon: IconNleScript,
          label: t('Estructura de guion', 'Script outline'),
          text: t('Genera una estructura de guion en 3 actos con tiempos estimados para este proyecto.', 'Generate a 3-act script outline with estimated timestamps for this project.'),
        },
        {
          icon: IconNleAspectRatio,
          label: t('Escaleta Vertical 9:16', '9:16 Vertical beat sheet'),
          text: t('Propón un gancho de 3 segundos y una estructura dinámica vertical de 30 segundos.', 'Propose a 3-second hook and a dynamic 30-second vertical structure.'),
        },
        {
          icon: IconNleVoiceWave,
          label: t('Texto de locución', 'Voiceover copy'),
          text: t('Escribe el texto de una narración cinematográfica para acompañar esta secuencia.', 'Write a cinematic voiceover narration to accompany this sequence.'),
        },
      ]
    }
    return [
      {
        icon: IconNleCaptions,
        label: t('Subtítulos dinámicos', 'Dynamic captions'),
        text: t('Genera una secuencia de subtítulos dinámicos estilo Hormozi Karaoke sincronizados con la duración del proyecto.', 'Generate a dynamic Hormozi Karaoke subtitle sequence synced with the project duration.'),
      },
      {
        icon: IconNleMontage,
        label: t('Analizar ritmo y corte', 'Analyze pacing & cuts'),
        text: t('Analiza el ritmo y la duración de los clips actuales y propón mejoras de montaje.', 'Analyze the rhythm and duration of current clips and propose montage improvements.'),
      },
      {
        icon: IconNleAudioMix,
        label: t('Nivelar mezcla de audio', 'Balance audio mix'),
        text: t('Revisa los clips de la secuencia y propón un balance de volumen equilibrado.', 'Review the sequence clips and propose a balanced volume mix.'),
      },
    ]
  }, [mode])

  return <aside className={`assistant-panel ${open ? '' : 'hidden'}`}>
    <div className="assistant-heading">
      <div className="assistant-badge"><IconNleAssistant size={14} /></div>
      <div className="assistant-heading-copy">
        <strong>Sparta AI</strong>
        <span>{selected ? `${selected.profile.name} · ${selected.model.name}` : t('Conecta un modelo de texto', 'Connect a text model')}</span>
      </div>
      <IconButton label={t('Borrar conversación de este proyecto', 'Clear this project chat')} disabled={!messages.length || requesting} onClick={clearHistory}><Eraser size={13} /></IconButton>
      <button className="subtle-button" title={t('Cerrar asistente', 'Close assistant')} aria-label={t('Cerrar asistente', 'Close assistant')} onClick={onClose}><ChevronRight size={16} /></button>
    </div>
    <div className="assistant-mode-tabs" role="tablist" aria-label={t('Modo del asistente', 'Assistant mode')}>
      <div className="assistant-mode-tabs-inner has-audio-tab">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'create'}
          aria-label={t('Crear video', 'Create video')}
          title={t('Crear video', 'Create video')}
          className={mode === 'create' ? 'active' : ''}
          onClick={() => setMode('create')}
        >
          <IconNleScript size={12} className="shrink-0" />
          <span className="truncate">{t('Crear', 'Create')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'edit'}
          aria-label={t('Editar proyecto', 'Edit project')}
          title={t('Editar proyecto', 'Edit project')}
          className={mode === 'edit' ? 'active' : ''}
          onClick={() => setMode('edit')}
        >
          <IconNleMontage size={12} className="shrink-0" />
          <span className="truncate">{t('Editar', 'Edit')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-label={t('Generador de audio', 'Audio generator')}
          title={t('Generador de audio', 'Audio generator')}
          aria-selected={mode === 'audio'}
          className={mode === 'audio' ? 'active' : ''}
          onClick={() => setMode('audio')}
        >
          <IconNleVoiceWave size={12} className="shrink-0" />
          <span className="truncate">{t('Audio', 'Audio')}</span>
        </button>
      </div>
    </div>
    <div className="chat-content" ref={feedRef} onScroll={updateScrollFollow}>
      {mode === 'audio' ? <AudioGenerationPanel /> : <>
        {!messages.length && !requesting && <div className="chat-welcome">
          <h3>{selected ? t('¿En qué trabajamos?', 'What are we working on?') : t('Configura un modelo para empezar', 'Set up a model to get started')}</h3>
          <p>{selected ? t('Consulta o aplica cambios directos sobre la secuencia actual.', 'Query or apply direct changes to the current sequence.') : t('Agrega un proveedor y carga un modelo con capacidad de texto desde Preferencias → IA y Proveedores.', 'Add a provider and load a text-capable model in Preferences → AI Providers.')}</p>
          <div className="assistant-quick-prompts">
            {promptSuggestions.map((item, idx) => {
              const Icon = item.icon
              return (
                <button key={idx} type="button" className="assistant-command-row" onClick={() => setDraft(item.text)}>
                  <span className="assistant-command-icon"><Icon size={13} /></span>
                  <span className="assistant-command-label">{item.label}</span>
                  <ChevronRight size={12} className="assistant-command-arrow" />
                </button>
              )
            })}
          </div>
        </div>}
        {messages.map((message) => {
          const proposal = message.role === 'assistant' ? extractAIProposal(message.content) : null
          const longAnswer = message.role === 'assistant' && getVisibleAssistantText(message.content, proposal).length > 560
          return <article className={`assistant-chat-message ${message.role}`} data-message-id={message.id} key={message.id}>
            <span className="assistant-message-icon">{message.role === 'assistant' ? <IconNleAssistant size={12} /> : null}</span>
            <div className="assistant-message-content">
              {longAnswer ? <details className="assistant-message-expand">
                <summary>
                  <span className="assistant-message-preview">{getAssistantPreview(message.content, proposal)}</span>
                  <span className="assistant-message-expand-label">{t('Leer respuesta completa', 'Read full response')}</span>
                </summary>
                <div className="assistant-markdown assistant-message-full">{renderAssistantText(message.content, proposal)}</div>
              </details> : <div className="assistant-markdown">{renderAssistantText(message.content, proposal)}</div>}
              {proposal && <div className="ai-proposal-card">
                <div className="ai-proposal-topline">
                  <span className="ai-proposal-icon-wrap"><PlayCircle size={16} className="ai-proposal-icon" /></span>
                  <div className="ai-proposal-heading-copy">
                    <span className="ai-proposal-eyebrow">{t('PROPUESTA DE EDICIÓN', 'EDITING PROPOSAL')}</span>
                    <strong>{proposal.title}</strong>
                  </div>
                  <Badge variant="outline" className="ai-proposal-count">{proposal.operations.length} {proposal.operations.length === 1 ? t('acción', 'action') : t('acciones', 'actions')}</Badge>
                </div>
                <p className="ai-proposal-summary">{proposal.summary}</p>
                {proposal.operations.length > 0 && <div className="ai-proposal-operation-list">
                  <span className="ai-proposal-operations-label"><ListChecks size={13} /> {t('Incluye', 'Includes')}</span>
                  {proposal.operations.length > 3 ? <details className="ai-proposal-more-operations">
                    <summary>{t('Ver acciones de la propuesta', 'View proposal actions')}<ChevronDown size={13} /></summary>
                    <ul className="ai-proposal-operations">
                      {proposal.operations.map((op, idx) => <li key={idx}><span aria-hidden="true" />{formatOperationLabel(op)}</li>)}
                    </ul>
                  </details> : <ul className="ai-proposal-operations">
                    {proposal.operations.map((op, idx) => <li key={idx}><span aria-hidden="true" />{formatOperationLabel(op)}</li>)}
                  </ul>}
                </div>}
                <button
                  type="button"
                  className="ai-proposal-apply-btn"
                  onClick={() => {
                    const result = applyAIOperations(proposal.operations)
                    if (result.applied > 0) {
                      toast.success(t(`${result.applied} cambio(s) aplicados al proyecto`, `${result.applied} change(s) applied to project`), {
                        description: proposal.title,
                      })
                    } else {
                      toast.warning(t('No se pudieron aplicar las operaciones', 'Could not apply operations'))
                    }
                  }}
                >
                  <Check size={14} /> {t('Aplicar propuesta', 'Apply proposal')} <ChevronRight size={14} className="ai-proposal-apply-arrow" />
                </button>
              </div>}
            </div>
          </article>
        })}
        {requesting && <div className="assistant-thinking" role="status" aria-live="polite">
          <span className="assistant-thinking-orbit"><LoaderCircle className="spin" size={14} /></span>
          <span className="assistant-thinking-copy"><strong>{t('Sparta está pensando', 'Sparta is thinking')}</strong><span>{t('Revisando el contexto de tu proyecto…', 'Reviewing your project context…')}</span></span>
          <span className="assistant-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
        </div>}
        {error && <p className="assistant-chat-error" role="alert">{error}</p>}
      </>}
    </div>
    {mode !== 'audio' && showLatestButton && <button type="button" className="assistant-jump-latest" onClick={jumpToLatest}><ArrowDown size={13} /> {t('Ir a la respuesta', 'Jump to latest')}</button>}
    {mode !== 'audio' && <div className="chat-compose">
      <div className="assistant-model-controls">
        <label><span className="sr-only">{t('Modelo de texto', 'Text model')}</span><select aria-label={t('Modelo de texto', 'Text model')} value={selectedKeyValue} onChange={(event) => selectModel(event.target.value)}><option value="">{t('Seleccionar modelo', 'Select a model')}</option>{options.map(({ key, profile, model }) => <option key={key} value={key}>{profile.name} · {model.name}</option>)}</select></label>
        <label><span className="sr-only">{t('Profundidad de análisis', 'Analysis depth')}</span><select aria-label={t('Profundidad de análisis', 'Analysis depth')} value={depth} onChange={(event) => selectDepth(event.target.value as AnalysisDepth)}><option value="concise">{t('Breve', 'Concise')}</option><option value="balanced">{t('Equilibrada', 'Balanced')}</option><option value="deep">{t('Profunda', 'Deep')}</option></select></label>
      </div>
      <textarea aria-label={t('Mensaje para Sparta AI', 'Message for Sparta AI')} placeholder={mode === 'create' ? t('Describe el video que quieres planear…', 'Describe the video you want to plan…') : t('Pregunta sobre este proyecto…', 'Ask about this project…')} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} />
      <div className="compose-bottom"><span className="assistant-memory-note">{t('Contexto de secuencia activo', 'Sequence context active')} <kbd className="assistant-kbd">Enter</kbd> · <kbd className="assistant-kbd">Shift</kbd>+<kbd className="assistant-kbd">Enter</kbd> {t('nueva línea', 'new line')}</span><button className="send-button" aria-label={t('Enviar mensaje', 'Send message')} title={!selected ? t('Selecciona un modelo de texto', 'Select a text model') : t('Enviar mensaje', 'Send message')} onClick={() => void send()} disabled={requesting || !draft.trim() || !selected}>{requesting ? <LoaderCircle className="spin" size={13} /> : <Send size={13} />}</button></div>
    </div>}
    <div className="assistant-disclaimer"><LockKeyhole size={10} /> {mode === 'audio' ? t('Generación externa · requiere clave y consume créditos', 'External generation · requires an API key and uses credits') : t('Las solicitudes se envían al proveedor del modelo seleccionado', 'Requests are sent to the selected model provider')}</div>
  </aside>
}
