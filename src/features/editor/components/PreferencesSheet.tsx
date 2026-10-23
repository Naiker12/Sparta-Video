import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Check, ChevronRight, GripVertical, Monitor, Palette, RotateCcw, SlidersHorizontal, X } from 'lucide-react'

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onResetLayout: () => void; snapToFrames: boolean; onToggleSnap: () => void; saveStatus: 'saving' | 'saved' | 'unsaved' | 'error' }
const ANIMATIONS_KEY = 'sparta-ui-animations'
const readAnimations = () => {
  try { return window.localStorage.getItem(ANIMATIONS_KEY) !== 'off' } catch { return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }
}

export function PreferencesSheet({ open, onOpenChange, onResetLayout, snapToFrames, onToggleSnap, saveStatus }: Props) {
  const [width, setWidth] = useState(430)
  const [activeTab, setActiveTab] = useState<'General' | 'Appearance' | 'Shortcuts'>('General')
  const [animations, setAnimations] = useState(readAnimations)
  const drag = useRef<{ x: number; width: number } | null>(null)
  const moveTabFocus = (event: React.KeyboardEvent<HTMLButtonElement>, current: 'General' | 'Appearance' | 'Shortcuts') => {
    const tabs = ['General', 'Appearance', 'Shortcuts'] as const
    const index = tabs.indexOf(current)
    const next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    setActiveTab(tabs[next])
    document.getElementById(`preferences-tab-${tabs[next].toLowerCase()}`)?.focus()
  }
  const resizeStart = (event: React.PointerEvent) => {
    event.preventDefault()
    drag.current = { x: event.clientX, width }
    const move = (moveEvent: PointerEvent) => { if (drag.current) setWidth(Math.min(Math.min(640, window.innerWidth - 24), Math.max(Math.min(340, window.innerWidth - 24), drag.current.width + drag.current.x - moveEvent.clientX))) }
    const end = () => { drag.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }); window.addEventListener('pointercancel', end, { once: true })
  }
  const changeWidth = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setWidth((current) => Math.max(Math.min(340, window.innerWidth - 24), current - 20)) }
    if (event.key === 'ArrowRight') { event.preventDefault(); setWidth((current) => Math.min(Math.min(640, window.innerWidth - 24), current + 20)) }
  }
  useEffect(() => {
    document.documentElement.dataset.motion = animations ? 'on' : 'off'
    try { window.localStorage.setItem(ANIMATIONS_KEY, animations ? 'on' : 'off') } catch { /* session preference still applies */ }
  }, [animations])
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Backdrop className="settings-backdrop" /><Dialog.Popup className="settings-sheet" style={{ width: `min(${width}px, calc(100vw - 12px))` }} aria-labelledby="preferences-title" aria-describedby="preferences-description">
    <div className="sheet-resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize preferences panel" tabIndex={0} onPointerDown={resizeStart} onKeyDown={changeWidth}><GripVertical size={15} /></div>
    <header className="sheet-header"><div className="sheet-app-icon"><SlidersHorizontal size={16} /></div><div><h2 id="preferences-title">Preferences</h2><p id="preferences-description">Personaliza tu espacio de edición.</p></div><Dialog.Close className="sheet-close" aria-label="Close preferences"><X size={17} /></Dialog.Close></header>
    <div className="sheet-body"><nav className="settings-nav" role="tablist" aria-label="Preference categories" aria-orientation="vertical">{([{ label: 'General', icon: SlidersHorizontal }, { label: 'Appearance', icon: Palette }, { label: 'Shortcuts', icon: Monitor }] as const).map(({ label, icon: Icon }) => <button key={label} id={`preferences-tab-${label.toLowerCase()}`} type="button" role="tab" aria-selected={activeTab === label} aria-controls="preferences-panel" tabIndex={activeTab === label ? 0 : -1} className={activeTab === label ? 'active' : ''} onClick={() => setActiveTab(label)} onKeyDown={(event) => moveTabFocus(event, label)}><Icon size={15} />{label}<ChevronRight size={13} /></button>)}</nav>
      <section className="settings-content" id="preferences-panel" role="tabpanel" aria-labelledby={`preferences-tab-${activeTab.toLowerCase()}`} tabIndex={0}>{activeTab === 'General' && <><div className="settings-eyebrow">WORKSPACE</div><h3>Editor preferences</h3><p>Controls for your local editing workspace.</p><div className="settings-row"><div><strong>Project storage</strong><span>{saveStatus === 'error' ? 'The browser could not save the latest project changes.' : 'Project changes are stored in this browser, not in a portable project file.'}</span></div><span className={`preference-status ${saveStatus === 'error' ? 'storage-error' : ''}`} role="status">{saveStatus === 'error' ? 'Save failed' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved here' : 'Demo · not saved'}</span></div><PreferenceToggle title="Timeline snapping" description="Align clip moves and trims to the sequence frame rate." value={snapToFrames} onChange={onToggleSnap} /><div className="settings-row"><div><strong>Workspace layout</strong><span>Restore the original panel proportions.</span></div><button className="settings-reset" onClick={onResetLayout}><RotateCcw size={13} /> Reset layout</button></div></>}{activeTab === 'Appearance' && <><div className="settings-eyebrow">THEME</div><h3>Appearance</h3><p>Adjust the look and motion of the editor.</p><div className="theme-choice"><span className="theme-swatch dark-swatch" /><div><strong>Sparta dark</strong><span>Dim workspace with lime action color</span></div><Check size={15} /></div><PreferenceToggle title="Interface animations" description="Subtle motion for menus, panels and playback." value={animations} onChange={() => setAnimations((value) => !value)} /><div className="settings-row"><div><strong>UI scale</strong><span>Scale controls are not available in this preview.</span></div><select aria-label="UI scale unavailable" disabled defaultValue="100"><option value="100">100%</option></select></div></>}{activeTab === 'Shortcuts' && <><div className="settings-eyebrow">KEYBOARD</div><h3>Keyboard shortcuts</h3><p>Common editing actions.</p><ShortcutRow action="Play / pause" keys={['Space']} /><ShortcutRow action="Step one frame" keys={['←', '→']} /><ShortcutRow action="Undo / redo" keys={['Ctrl', 'Z']} /><ShortcutRow action="Search media" keys={['Ctrl', 'K']} /><ShortcutRow action="Close menu or dialog" keys={['Esc']} /></>}</section></div>
  </Dialog.Popup></Dialog.Portal></Dialog.Root>
}

function PreferenceToggle({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: () => void }) { return <button className="settings-row settings-toggle-row" role="switch" aria-checked={value} onClick={onChange}><span><strong>{title}</strong><span>{description}</span></span><span className={`toggle ${value ? 'on' : ''}`}><i /></span></button> }
function ShortcutRow({ action, keys }: { action: string; keys: string[] }) { return <div className="shortcut-row"><span>{action}</span><span>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</span></div> }
