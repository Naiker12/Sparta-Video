import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Check, ChevronRight, GripVertical, Monitor, Palette, RotateCcw, SlidersHorizontal, X } from 'lucide-react'

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onResetLayout: () => void; snapToFrames: boolean; onToggleSnap: () => void; saveStatus: 'saving' | 'saved' | 'unsaved' | 'error' }
const ANIMATIONS_KEY = 'sparta-ui-animations'
const readAnimations = () => {
  try { return window.localStorage.getItem(ANIMATIONS_KEY) !== 'off' } catch { return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }
}

export function PreferencesSheet({ open, onOpenChange, onResetLayout, snapToFrames, onToggleSnap, saveStatus }: Props) {
  const [width, setWidth] = useState(() => Math.min(460, window.innerWidth - 48))
  const [activeTab, setActiveTab] = useState<'General' | 'Apariencia' | 'Atajos'>('General')
  const [animations, setAnimations] = useState(readAnimations)
  const drag = useRef<{ x: number; width: number } | null>(null)
  const moveTabFocus = (event: React.KeyboardEvent<HTMLButtonElement>, current: 'General' | 'Apariencia' | 'Atajos') => {
    const tabs = ['General', 'Apariencia', 'Atajos'] as const
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
    const move = (moveEvent: PointerEvent) => { if (drag.current) setWidth(Math.min(Math.min(560, window.innerWidth - 48), Math.max(Math.min(360, window.innerWidth - 48), drag.current.width + drag.current.x - moveEvent.clientX))) }
    const end = () => { drag.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }); window.addEventListener('pointercancel', end, { once: true })
  }
  const changeWidth = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setWidth((current) => Math.min(Math.min(560, window.innerWidth - 48), current + 20)) }
    if (event.key === 'ArrowRight') { event.preventDefault(); setWidth((current) => Math.max(Math.min(360, window.innerWidth - 48), current - 20)) }
  }
  useEffect(() => {
    document.documentElement.dataset.motion = animations ? 'on' : 'off'
    try { window.localStorage.setItem(ANIMATIONS_KEY, animations ? 'on' : 'off') } catch { /* session preference still applies */ }
  }, [animations])
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Backdrop className="settings-backdrop" /><Dialog.Popup className="settings-sheet" style={{ width: `min(${width}px, calc(100vw - 48px))` }} aria-labelledby="preferences-title" aria-describedby="preferences-description">
    <div className="sheet-resize-handle" role="separator" aria-orientation="vertical" aria-label="Cambiar ancho de preferencias" aria-valuemin={Math.min(360, window.innerWidth - 48)} aria-valuemax={Math.min(560, window.innerWidth - 48)} aria-valuenow={width} tabIndex={0} onPointerDown={resizeStart} onKeyDown={changeWidth}><GripVertical size={15} /></div>
    <header className="sheet-header"><div className="sheet-app-icon"><SlidersHorizontal size={16} /></div><div><h2 id="preferences-title">Preferencias</h2><p id="preferences-description">Personaliza tu espacio de edición.</p></div><Dialog.Close className="sheet-close" aria-label="Cerrar preferencias"><X size={17} /></Dialog.Close></header>
    <div className="sheet-body"><nav className="settings-nav" role="tablist" aria-label="Categorías de preferencias" aria-orientation="vertical">{([{ label: 'General', icon: SlidersHorizontal }, { label: 'Apariencia', icon: Palette }, { label: 'Atajos', icon: Monitor }] as const).map(({ label, icon: Icon }) => <button key={label} id={`preferences-tab-${label.toLowerCase()}`} type="button" role="tab" aria-selected={activeTab === label} aria-controls="preferences-panel" tabIndex={activeTab === label ? 0 : -1} className={activeTab === label ? 'active' : ''} onClick={() => setActiveTab(label)} onKeyDown={(event) => moveTabFocus(event, label)}><Icon size={15} />{label}<ChevronRight size={13} /></button>)}</nav>
      <section className="settings-content" id="preferences-panel" role="tabpanel" aria-labelledby={`preferences-tab-${activeTab.toLowerCase()}`} tabIndex={0}>{activeTab === 'General' && <><div className="settings-eyebrow">ESPACIO DE TRABAJO</div><h3>Preferencias del editor</h3><p>Configuración local de este espacio de edición.</p><div className="settings-row"><div><strong>Almacenamiento del proyecto</strong><span>{saveStatus === 'error' ? 'El navegador no pudo guardar los últimos cambios.' : 'Los cambios se guardan en este navegador, no en un archivo de proyecto portable.'}</span></div><span className={`preference-status ${saveStatus === 'error' ? 'storage-error' : ''}`} role="status">{saveStatus === 'error' ? 'Error al guardar' : saveStatus === 'saving' ? 'Guardando…' : saveStatus === 'saved' ? 'Guardado aquí' : 'Demo · sin guardar'}</span></div><PreferenceToggle title="Ajuste a fotogramas" description="Alinea los movimientos y recortes con la frecuencia de la secuencia." value={snapToFrames} onChange={onToggleSnap} /><div className="settings-row"><div><strong>Distribución del espacio</strong><span>Restablecer las proporciones iniciales de los paneles.</span></div><button className="settings-reset" onClick={onResetLayout}><RotateCcw size={13} /> Restablecer</button></div></>}{activeTab === 'Apariencia' && <><div className="settings-eyebrow">TEMA</div><h3>Apariencia</h3><p>Ajusta el aspecto y el movimiento del editor.</p><div className="theme-choice"><span className="theme-swatch dark-swatch" /><div><strong>Sparta oscuro</strong><span>Espacio oscuro con acento verde lima</span></div><Check size={15} /></div><PreferenceToggle title="Animaciones de interfaz" description="Movimiento sutil en menús, paneles y reproducción." value={animations} onChange={() => setAnimations((value) => !value)} /><div className="settings-row"><div><strong>Escala de interfaz</strong><span>El cambio de escala aún no está disponible en esta vista previa.</span></div><select aria-label="Escala de interfaz no disponible" disabled defaultValue="100"><option value="100">100%</option></select></div></>}{activeTab === 'Atajos' && <><div className="settings-eyebrow">TECLADO</div><h3>Atajos de teclado</h3><p>Acciones de edición disponibles en esta demostración.</p><ShortcutRow action="Reproducir / pausar" keys={['Espacio']} /><ShortcutRow action="Avanzar o retroceder un fotograma" keys={['←', '→']} /><ShortcutRow action="Avanzar o retroceder un segundo" keys={['Mayús', '← / →']} /><ShortcutRow action="Ir al inicio / final" keys={['Inicio', 'Fin']} /><ShortcutRow action="Deshacer / rehacer" keys={['Ctrl', 'Z', 'Ctrl', 'Mayús', 'Z']} /><ShortcutRow action="Buscar medios" keys={['Ctrl', 'K']} /><ShortcutRow action="Herramienta de selección / corte" keys={['V', 'C']} /><ShortcutRow action="Añadir marcador en el cabezal" keys={['M']} /><ShortcutRow action="Eliminar clip seleccionado" keys={['Supr']} /><ShortcutRow action="Navegar entre marcadores" keys={['[', ']']} /><ShortcutRow action="Encajar secuencia en la línea de tiempo" keys={['\\']} /><ShortcutRow action="Cerrar menú o diálogo" keys={['Esc']} /></>}</section></div>
  </Dialog.Popup></Dialog.Portal></Dialog.Root>
}

function PreferenceToggle({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: () => void }) { return <button className="settings-row settings-toggle-row" role="switch" aria-checked={value} onClick={onChange}><span><strong>{title}</strong><span>{description}</span></span><span className={`toggle ${value ? 'on' : ''}`}><i /></span></button> }
function ShortcutRow({ action, keys }: { action: string; keys: string[] }) { return <div className="shortcut-row"><span>{action}</span><span>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</span></div> }
