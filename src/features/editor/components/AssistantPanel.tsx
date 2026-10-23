import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, ChevronRight, Clapperboard, Image, LockKeyhole, Music2, Plus, Send, Sparkles, WandSparkles } from 'lucide-react'
import { IconButton } from './controls'
import type { AIEditProposal } from '../services/contracts'

type Props = { open: boolean; onClose: () => void; projectName: string }
const suggestions = [
  { text: 'Dale un estilo más cinematográfico', icon: Clapperboard },
  { text: 'Encuentra las mejores tomas de costa', icon: Image },
  { text: 'Sugiere una pista musical', icon: Music2 },
]

export function AssistantPanel({ open, onClose, projectName }: Props) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<{ prompt: string; proposal: AIEditProposal }[]>([])
  const [requesting, setRequesting] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight }, [messages])
  const send = async () => {
    const clean = draft.trim()
    if (!clean || requesting) return
    setDraft('')
    setRequesting(true)
    try {
      const { mockAIProvider } = await import('../services/mock-services')
      const proposal = await mockAIProvider.proposeEdits({ projectName }, clean)
      setMessages((current) => [...current, { prompt: clean, proposal }])
    } finally { setRequesting(false) }
  }
  return <aside className={`assistant-panel ${open ? '' : 'hidden'}`}><div className="assistant-heading"><div className="assistant-badge"><WandSparkles size={16} /></div><div><strong>Sparta AI</strong><span>Asistente de edición · demo</span></div><button className="subtle-button" title="Cerrar asistente" aria-label="Cerrar asistente" onClick={onClose}><ChevronRight size={17} /></button></div><div className="assistant-context"><span className="context-dot" /> TRABAJANDO EN <strong title={projectName}>{projectName}</strong></div><div className="chat-content" ref={feedRef}><div className="chat-welcome"><div className="welcome-spark"><Sparkles size={18} /></div><h3>Demos forma a tu historia.</h3><p>Puedo ayudarte a organizar clips, refinar el montaje o encontrar el momento adecuado.</p></div><div className="suggestion-label">PRUEBA A PEDIR</div>{suggestions.map(({ text, icon: Icon }) => <button className="suggestion" key={text} onClick={() => setDraft(text)}><span><Icon size={15} /></span>{text}<ChevronRight size={14} /></button>)}{requesting && <p role="status">Preparando una propuesta de demostración…</p>}{messages.map(({ prompt, proposal }) => <div className="chat-message-pair" key={proposal.id}><div className="user-message">{prompt}</div><div className="assistant-reply"><div className="reply-icon"><Bot size={14} /></div><div><strong>Propuesta de muestra · solo lectura</strong><p>{proposal.summary}</p><small>{proposal.changes.length} cambios propuestos · ninguno aplicado</small></div></div></div>)}</div><div className="chat-compose"><textarea aria-label="Mensaje para Sparta AI" placeholder="Pregunta sobre tu edición…" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} /><div className="compose-bottom"><button className="model-selector" disabled title="Los proveedores de IA no están conectados en esta vista previa"><Sparkles size={12} /> Asistente demo <ChevronDown size={11} /></button><div><IconButton label="Adjuntar medio (no disponible en esta vista previa)" disabled><Plus size={16} /></IconButton><button className="send-button" aria-label="Enviar mensaje" onClick={() => void send()} disabled={requesting || !draft.trim()}><Send size={14} /></button></div></div></div><div className="assistant-disclaimer"><LockKeyhole size={11} /> Solo demo · no hay proveedor de IA conectado</div></aside>
}
