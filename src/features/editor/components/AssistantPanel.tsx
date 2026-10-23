import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, ChevronRight, Clapperboard, Image, LockKeyhole, Music2, Plus, Send, Sparkles, WandSparkles } from 'lucide-react'
import { IconButton } from './controls'
import type { AIEditProposal } from '../services/contracts'

type Props = { open: boolean; onClose: () => void; projectName: string }
const suggestions = [
  { text: 'Make this feel more cinematic', icon: Clapperboard },
  { text: 'Find the best coastline shots', icon: Image },
  { text: 'Suggest a music track', icon: Music2 },
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
  return <aside className={`assistant-panel ${open ? '' : 'hidden'}`}><div className="assistant-heading"><div className="assistant-badge"><WandSparkles size={16} /></div><div><strong>Sparta AI</strong><span>Editing assistant · demo</span></div><button className="subtle-button" title="Close assistant" onClick={onClose}><ChevronRight size={17} /></button></div><div className="assistant-context"><span className="context-dot" /> WORKING IN <strong title={projectName}>{projectName}</strong></div><div className="chat-content" ref={feedRef}><div className="chat-welcome"><div className="welcome-spark"><Sparkles size={18} /></div><h3>Let's shape your story.</h3><p>I can help you organize clips, refine your edit, or find the right moment.</p></div><div className="suggestion-label">TRY ASKING</div>{suggestions.map(({ text, icon: Icon }) => <button className="suggestion" key={text} onClick={() => setDraft(text)}><span><Icon size={15} /></span>{text}<ChevronRight size={14} /></button>)}{requesting && <p role="status">Preparing a demo proposal…</p>}{messages.map(({ prompt, proposal }) => <div className="chat-message-pair" key={proposal.id}><div className="user-message">{prompt}</div><div className="assistant-reply"><div className="reply-icon"><Bot size={14} /></div><div><strong>Mock proposal · review only</strong><p>{proposal.summary}</p><small>{proposal.changes.length} project changes · none applied</small></div></div></div>)}</div><div className="chat-compose"><textarea aria-label="Message Sparta AI" placeholder="Ask anything about your edit..." value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} /><div className="compose-bottom"><button className="model-selector" disabled title="AI providers are not connected in this preview"><Sparkles size={12} /> Assistant demo <ChevronDown size={11} /></button><div><IconButton label="Attach media (unavailable in preview)" disabled><Plus size={16} /></IconButton><button className="send-button" aria-label="Send message" onClick={() => void send()} disabled={requesting || !draft.trim()}><Send size={14} /></button></div></div></div><div className="assistant-disclaimer"><LockKeyhole size={11} /> Demo only · no AI provider connected</div></aside>
}
