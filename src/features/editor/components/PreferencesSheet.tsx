import { useEffect, useId, useState } from 'react'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { invoke, isTauri } from '@tauri-apps/api/core'
import {
  Check,
  ChevronDown,
  HelpCircle,
  Keyboard,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sun,
  Sparkles,
  X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { Switch } from '../../../components/ui/switch'
import {
  AI_PREFS_KEY,
} from '../services/ai-preferences'
import { AIProviderSettings } from './AIProviderSettings'
import { clearSessionKeys, PROVIDER_REGISTRY_KEY, readProviderRegistry } from '../services/ai-provider-registry'
import {
  resetAppearanceColors,
  resetAppearancePreferences,
  setAppearanceColor,
  setAppearancePalette,
  setAppearanceTheme,
  getResolvedAppearanceTheme,
  type AppearanceMode,
  type AppearancePalette,
  type AppearanceTheme,
  useAppearancePreferences,
} from '../services/appearance-preferences'
import { setLanguage, t, useLanguage } from '../services/locale'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResetLayout: () => void
  snapToFrames: boolean
  onToggleSnap: () => void
  saveStatus: 'saving' | 'saved' | 'unsaved' | 'error'
}

const ANIMATIONS_KEY = 'sparta-ui-animations'
const PERMISSION_KEY = 'sparta-tool-permission-mode'
type PermissionMode = 'ask' | 'auto'
const readAnimations = () => {
  try {
    const stored = window.localStorage.getItem(ANIMATIONS_KEY)
    if (stored === 'on') return true
    if (stored === 'off') return false
  } catch {
    // Fall through to the operating system preference.
  }
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export type TabKey = 'General' | 'Apariencia' | 'IA' | 'Atajos' | 'Acerca de'

interface TabDefinition {
  key: TabKey
  label: string
  englishLabel: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabDefinition[] = [
  { key: 'General', label: 'General', englishLabel: 'General', icon: SlidersHorizontal },
  { key: 'Apariencia', label: 'Apariencia', englishLabel: 'Appearance', icon: Palette },
  { key: 'IA', label: 'IA y Proveedores', englishLabel: 'AI Providers', icon: Sparkles },
  { key: 'Acerca de', label: 'Acerca de', englishLabel: 'About', icon: HelpCircle },
  { key: 'Atajos', label: 'Atajos', englishLabel: 'Shortcuts', icon: Keyboard },
]

export function PreferencesSheet({
  open,
  onOpenChange,
  onResetLayout,
  snapToFrames,
  onToggleSnap,
  saveStatus,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('General')
  const [previousTab, setPreviousTab] = useState<TabKey>('General')
  const [search, setSearch] = useState('')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetError, setResetError] = useState('')
  const [animations, setAnimations] = useState(readAnimations)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(() => {
    try { return window.localStorage.getItem(PERMISSION_KEY) === 'auto' ? 'auto' : 'ask' } catch { return 'ask' }
  })
  const appearance = useAppearancePreferences()
  const language = useLanguage()
  const resolvedAppearanceTheme = getResolvedAppearanceTheme()
  const searchInputId = useId()

  useEffect(() => {
    document.documentElement.dataset.motion = animations ? 'on' : 'off'
    try {
      window.localStorage.setItem(ANIMATIONS_KEY, animations ? 'on' : 'off')
    } catch {
      /* ignore */
    }
  }, [animations])

  useEffect(() => {
    try {
      window.localStorage.setItem(PERMISSION_KEY, permissionMode)
    } catch {
      /* preferences stay available for the current session */
    }
  }, [permissionMode])

  const moveTabFocus = (event: React.KeyboardEvent<HTMLButtonElement>, current: TabKey) => {
    const visibleTabKeys = filteredTabs.map((t) => t.key)
    const index = visibleTabKeys.indexOf(current)
    let nextIndex = -1
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % visibleTabKeys.length
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index + visibleTabKeys.length - 1) % visibleTabKeys.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = visibleTabKeys.length - 1
    }
    if (nextIndex >= 0) {
      event.preventDefault()
      const nextKey = visibleTabKeys[nextIndex]
      setPreviousTab(current)
      setActiveTab(nextKey)
      document.getElementById(`preferences-tab-${nextKey.toLowerCase().replace(/\s+/g, '-')}`)?.focus()
    }
  }

  const query = search.trim().toLowerCase()
  const filteredTabs = TABS.filter((t) => {
    if (!query) return true
    if (t.label.toLowerCase().includes(query) || t.englishLabel.toLowerCase().includes(query)) return true
    if (t.key === 'General' && 'proyecto espacio almacenamiento fotogramas snap'.includes(query)) return true
    if (t.key === 'Apariencia' && 'tema apariencia color animaciones escala interfaz'.includes(query)) return true
    if (t.key === 'IA' && 'ia inteligencia artificial modelo api claude gpt openai gemini'.includes(query)) return true
    if (t.key === 'Atajos' && 'atajos teclado shortcuts comando tecla'.includes(query)) return true
    return false
  })

  const resetAllPrefs = () => { setResetError(''); setResetConfirmOpen(true) }
  const confirmResetAllPrefs = async () => {
    if (isTauri()) {
      try {
        await Promise.all(readProviderRegistry().profiles.map((profile) => invoke('delete_provider_api_key', { profileId: profile.id })))
      } catch (reason) {
        setResetError(typeof reason === 'string' ? reason : t('No se pudieron borrar las claves del llavero de Windows.', 'Could not remove API keys from the Windows Credential Manager.'))
        return
      }
    }
    try {
      window.localStorage.removeItem(ANIMATIONS_KEY)
      window.localStorage.removeItem(PERMISSION_KEY)
      window.localStorage.removeItem(AI_PREFS_KEY)
      window.localStorage.removeItem(PROVIDER_REGISTRY_KEY)
    } catch {
      /* ignore */
    }
    setAnimations(true)
    setPermissionMode('ask')
    clearSessionKeys()
    setLanguage('es')
    resetAppearancePreferences()
    onResetLayout()
    setResetConfirmOpen(false)
    onOpenChange(false)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen) setActiveTab('General'); onOpenChange(nextOpen) }}>
      <DialogContent
        hideClose={true}
        aria-labelledby="preferences-dialog-title"
        aria-describedby="preferences-dialog-desc"
      className="preferences-window !max-w-[min(980px,calc(100vw-2rem))] h-[min(760px,calc(100dvh-2rem))] w-[min(980px,calc(100vw-2rem))] p-0 overflow-hidden flex flex-col md:flex-row bg-[#17181c] border border-white/[0.08] shadow-2xl rounded-[20px]"
      >
        <DialogTitle id="preferences-dialog-title" className="sr-only">
          Preferencias / Preferences
        </DialogTitle>
        <DialogDescription id="preferences-dialog-desc" className="sr-only">
          Personaliza tu espacio de edición y preferencias de Spartan.
        </DialogDescription>

        {/* Sidebar matching Sparta Agent */}
        <aside className="preferences-sidebar w-full md:w-[240px] shrink-0 flex flex-col bg-[#121316] border-b md:border-b-0 md:border-r border-white/[0.06] p-3 select-none">
          {/* Search bar with round pill aesthetic */}
          <div className="relative mb-2 mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            <input
              id={searchInputId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Buscar en la configuración', 'Search settings')}
              aria-label={t('Buscar en la configuración', 'Search settings')}
              className="h-8 w-full rounded-full border border-white/[0.08] bg-white/[0.04] pl-8 pr-7 text-xs text-white/90 placeholder:text-white/35 outline-none transition-colors focus:border-white/20 focus:bg-white/[0.07]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
            {t('Configuración', 'SETTINGS')}
          </div>

          <nav className="preferences-nav flex flex-col gap-0.5" role="tablist" aria-label="Categorías de preferencias">
            {filteredTabs.map((t) => {
              const active = activeTab === t.key
              const Icon = t.icon
              const id = `preferences-tab-${t.key.toLowerCase().replace(/\s+/g, '-')}`
              return (
                <button
                  key={t.key}
                  id={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={language === 'en' ? t.englishLabel : t.label}
                  tabIndex={active ? 0 : -1}
                  onClick={() => { setPreviousTab(activeTab); setActiveTab(t.key) }}
                  onKeyDown={(e) => moveTabFocus(e, t.key)}
                  className={`group relative flex h-[32px] items-center gap-2.5 rounded-full px-3 text-xs font-medium transition-all ${
                    active
                      ? 'preferences-tab-active text-white shadow-sm'
                      : 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <Icon className={`relative z-10 size-4 shrink-0 transition-colors ${active ? 'text-white' : 'text-white/55 group-hover:text-white/85'}`} />
                  <span className="relative z-10 truncate">{language === 'en' ? t.englishLabel : t.label}</span>
                </button>
              )
            })}
            {filteredTabs.length === 0 && (
              <p className="px-3 py-3 text-xs text-white/40">Sin coincidencias</p>
            )}
          </nav>

        </aside>

        {/* Content area with modern Sparta Agent layout */}
        <main className="preferences-main relative flex-1 min-w-0 min-h-0 flex flex-col bg-[#17181c]">
          {/* Top-right close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar / Close"
            className="absolute right-4 top-4 z-10 inline-flex size-7 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          >
            <X className="size-4" />
          </button>

          <div key={activeTab} className={`preferences-page flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-7 ${activeTab === previousTab ? '' : TABS.findIndex((tab) => tab.key === activeTab) > TABS.findIndex((tab) => tab.key === previousTab) ? 'page-forward' : 'page-back'}`}>
            {activeTab === 'General' && (
              <div className="flex flex-col gap-6">
                <header className="flex flex-col gap-0.5">
                  <h1 className="text-xl font-semibold tracking-tight text-white">{t('General', 'General')}</h1>
                  <p className="text-xs text-white/45">{t('Preferencias globales de Spartan Video.', 'Global Sparta Video preferences.')}</p>
                </header>

                {/* Section Workspace */}
                <section className="flex flex-col">
                  <h2 className="text-sm font-semibold text-white/90 mb-1">{t('Espacio de trabajo', 'Workspace')}</h2>
                  <div className="flex flex-col divide-y divide-white/[0.04]">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-white/90">{t('Almacenamiento', 'Storage')}</span>
                        <span className="text-[11px] text-white/45">
                          {saveStatus === 'error'
                            ? t('Error al guardar los últimos cambios en el navegador.', 'Could not save the latest changes in this browser.')
                            : t('El proyecto se guarda localmente en este navegador.', 'The project is saved locally in this browser.')}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                          saveStatus === 'error'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${saveStatus === 'error' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                        {saveStatus === 'error' ? t('Error', 'Error') : saveStatus === 'saving' ? t('Guardando…', 'Saving…') : t('Guardado aquí', 'Saved here')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-white/90">{t('Ajuste a fotogramas', 'Snap to frames')}</span>
                        <span className="text-[11px] text-white/45">
                          {t('Alinea movimientos y recortes con la frecuencia de la secuencia.', 'Aligns moves and trims to the sequence frame rate.')}
                        </span>
                      </div>
                      <Switch
                        checked={snapToFrames}
                        onCheckedChange={onToggleSnap}
                        aria-label={t('Ajuste a fotogramas', 'Snap to frames')}
                      />
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-white/90">{t('Distribución de paneles', 'Panel layout')}</span>
                        <span className="text-[11px] text-white/45">{t('Volver a las proporciones iniciales del editor.', 'Restore the editor’s default panel sizes.')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={onResetLayout}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
                      >
                        <RotateCcw className="size-3" />
                        {t('Restablecer', 'Reset')}
                      </button>
                    </div>
                  </div>
                </section>

                {/* Section Permissions */}
                <section className="flex flex-col">
                  <h2 className="text-sm font-semibold text-white/90 mb-1">{t('Permisos', 'Permissions')}</h2>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-white/90">{t('Permisos de herramientas', 'Tool permissions')}</span>
                      <span className="text-[11px] text-white/45 max-w-sm">
                        {t('Cómo aprueba Spartan las llamadas a herramientas del chat y edición antes de ejecutarlas.', 'Choose how Sparta approves chat and editing tool calls before they run.')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPermissionMode((mode) => mode === 'ask' ? 'auto' : 'ask')}
                      aria-label={t('Cambiar modo de permisos de herramientas', 'Change tool permission mode')}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/[0.08]"
                    >
                      <Check className={`size-3.5 ${permissionMode === 'ask' ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <span>{permissionMode === 'ask' ? t('Aprobar por mí', 'Ask me') : t('Automático', 'Automatic')}</span>
                      <ChevronDown className="size-3 text-white/45" />
                    </button>
                  </div>
                </section>

                {/* Danger zone */}
                <section className="flex flex-col pt-2 border-t border-white/[0.06]">
                  <h2 className="text-sm font-semibold text-red-400 mb-1">{t('Zona de peligro', 'Danger zone')}</h2>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-white/90">{t('Restablecer todas las preferencias locales', 'Reset all local preferences')}</span>
                      <span className="text-[11px] text-white/45 max-w-sm">
                        {t('Borra las preferencias locales. Se conservan el catálogo y los ajustes de proyecto.', 'Clears local preferences. Your media catalog and project settings are kept.')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={resetAllPrefs}
                      className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 hover:border-red-500/50"
                    >
                      {t('Restablecer preferencias', 'Reset preferences')}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'Apariencia' && (
              <div className="flex flex-col gap-6">
                <header className="flex flex-col gap-0.5">
                  <h1 className="text-xl font-semibold tracking-tight text-white">{t('Apariencia', 'Appearance')}</h1>
                  <p className="text-xs text-white/45">{t('Cómo se ve Spartan Video en este dispositivo.', 'How Sparta Video looks on this device.')}</p>
                </header>

                <AppearanceSettingSection title={t('Idioma', 'Language')}>
                  <AppearanceSettingRow label={t('Idioma de la interfaz', 'Interface language')} description={t('Elige el idioma de Spartan Video.', 'Choose the language used in Sparta Video.') }>
                    <div className="appearance-segmented" role="group" aria-label={t('Idioma de la interfaz', 'Interface language')}>
                      <button type="button" aria-pressed={language === 'es'} onClick={() => setLanguage('es')}>Español</button>
                      <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
                    </div>
                  </AppearanceSettingRow>
                </AppearanceSettingSection>

                <AppearanceSettingSection title={t('Tema', 'Theme')}>
                  <AppearanceSettingRow label={t('Esquema de color', 'Color scheme')} description={t('Claro, oscuro o según tu sistema.', 'Light, dark, or follow your system')}>
                    <div className="appearance-segmented" role="group" aria-label={t('Esquema de color', 'Color scheme')}>
                      {([
                        ['light', t('Claro', 'Light'), Sun],
                        ['dark', t('Oscuro', 'Dark'), Moon],
                        ['system', t('Sistema', 'System'), Monitor],
                      ] as const).map(([value, label, Icon]) => (
                        <button key={value} type="button" aria-pressed={appearance.theme === value} onClick={() => setAppearanceTheme(value as AppearanceTheme)}>
                          <Icon size={14} />{label}
                        </button>
                      ))}
                    </div>
                  </AppearanceSettingRow>
                  <AppearanceSettingRow label={t('Paleta de colores', 'Color palette')} description={t('Colores usados en Spartan Video, en modo claro y oscuro.', 'Colors used in Sparta Video in light and dark mode.')} className="appearance-palette-row">
                    <div className="appearance-palette-grid">
                      {([
                        ['standard', t('Estándar', 'Standard'), '#a78bfa', '#6d28d9'],
                        ['classic', t('Clásica', 'Classic'), '#4dabff', '#339cff'],
                        ['minimal', t('Minimalista', 'Minimal'), '#ededed', '#171717'],
                      ] as const).map(([value, label, darkAccent, lightAccent]) => (
                        <button key={value} type="button" data-selected={appearance.palette === value} aria-pressed={appearance.palette === value} onClick={() => setAppearancePalette(value as AppearancePalette)}>
                          <span className="appearance-palette-preview" style={{ backgroundColor: resolvedAppearanceTheme === 'light' ? '#ffffff' : '#181818' }} aria-hidden="true">
                            <i style={{ backgroundColor: resolvedAppearanceTheme === 'light' ? '#f1f1ef' : '#262626' }} />
                            <span><i /><i /><b style={{ backgroundColor: resolvedAppearanceTheme === 'light' ? lightAccent : darkAccent }} /></span>
                          </span>
                          <strong>{label}</strong>
                        </button>
                      ))}
                    </div>
                  </AppearanceSettingRow>
                </AppearanceSettingSection>

                <AppearanceSettingSection title={resolvedAppearanceTheme === 'light' ? t('Tema claro', 'Light theme') : t('Tema oscuro', 'Dark theme')}>
                  {([
                    ['accent', t('Acento', 'Accent')],
                    ['background', t('Fondo', 'Background')],
                    ['foreground', t('Primer plano', 'Foreground')],
                  ] as const).map(([key, label]) => {
                    const mode: AppearanceMode = resolvedAppearanceTheme
                    const fallback = key === 'accent'
                      ? appearance.palette === 'standard' ? mode === 'dark' ? '#a78bfa' : '#6d28d9' : appearance.palette === 'classic' ? mode === 'dark' ? '#4dabff' : '#339cff' : mode === 'dark' ? '#ededed' : '#171717'
                      : key === 'background' ? mode === 'dark' ? '#181818' : '#ffffff' : mode === 'dark' ? '#ececec' : '#1a1c1f'
                    const value = appearance.colors[mode][key] ?? fallback
                    return (
                      <AppearanceSettingRow key={key} label={label}>
                        <div className="appearance-color-control">
                          <input aria-label={`${label}: ${value.toUpperCase()}`} type="color" value={value} onChange={(event) => setAppearanceColor(mode, key, event.target.value)} />
                          <code>{value.toUpperCase()}</code>
                          {appearance.colors[mode][key] && <button type="button" onClick={() => setAppearanceColor(mode, key, null)} aria-label={`Restablecer ${label}`}>Restablecer</button>}
                        </div>
                      </AppearanceSettingRow>
                    )
                  })}
                  <div className="appearance-reset-row">
                    <span>{t('Restablecer colores personalizados', 'Reset custom colors')}</span>
                    <button type="button" onClick={() => resetAppearanceColors(appearance.theme === 'light' ? 'light' : 'dark')}>{t('Restablecer', 'Reset')}</button>
                  </div>
                </AppearanceSettingSection>

                <AppearanceSettingSection title={t('Preferencias', 'Preferences')}>
                  <AppearanceSettingRow label={t('Animaciones de interfaz', 'Interface animations')} description={t('Movimiento sutil en menús, paneles y controles.', 'Subtle motion in menus, panels, and controls.')}>
                    <Switch
                      checked={animations}
                      onCheckedChange={() => setAnimations((v) => !v)}
                      aria-label={t('Animaciones de interfaz', 'Interface animations')}
                    />
                  </AppearanceSettingRow>
                  <AppearanceSettingRow label={t('Escala de interfaz', 'Interface scale')} description={t('Densidad tipográfica y de controles.', 'Typography and control density.')}>
                    <Select value="100" disabled>
                      <SelectTrigger aria-label={t('Escala de interfaz (próximamente)', 'Interface scale (coming soon)')} title={t('La escala de interfaz aún no está disponible', 'Interface scaling is not available yet')} className="h-8 w-32 rounded-full border border-white/10 bg-white/[0.04] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent><SelectItem value="100">100%</SelectItem></SelectContent>
                    </Select>
                  </AppearanceSettingRow>
                </AppearanceSettingSection>
              </div>
            )}

            {activeTab === 'IA' && (
              <AIProviderSettings />
            )}

            {activeTab === 'Atajos' && (
              <div className="flex flex-col gap-6">
                <header className="flex flex-col gap-0.5">
                  <h1 className="text-xl font-semibold tracking-tight text-white">{t('Atajos de teclado', 'Keyboard shortcuts')}</h1>
                  <p className="text-xs text-white/45">{t('Comandos rápidos para editar a máxima velocidad.', 'Quick commands to speed up editing.')}</p>
                </header>

                <section className="flex flex-col gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">
                    {t('Reproducción y navegación', 'Playback and navigation')}
                  </h2>
                  <div className="flex flex-col divide-y divide-white/[0.04]">
                    <ShortcutItem action={t('Reproducir o pausar', 'Play or pause')} keys={[t('Espacio', 'Space')]} />
                    <ShortcutItem action={t('Avanzar / retroceder un fotograma', 'Step one frame forward / back')} keys={['←', '→']} />
                    <ShortcutItem action={t('Avanzar / retroceder un segundo', 'Step one second forward / back')} keys={[t('Mayús', 'Shift'), '← / →']} />
                    <ShortcutItem action={t('Ir al inicio / final', 'Go to start / end')} keys={[t('Inicio', 'Home'), t('Fin', 'End')]} />
                    <ShortcutItem action={t('Navegar entre marcadores', 'Move between markers')} keys={['[', ']']} />
                  </div>
                </section>

                <section className="flex flex-col gap-2 pt-2 border-t border-white/[0.04]">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">{t('Edición', 'Editing')}</h2>
                  <div className="flex flex-col divide-y divide-white/[0.04]">
                    <ShortcutItem action={t('Deshacer / rehacer', 'Undo / redo')} keys={['Ctrl', 'Z', '/', 'Ctrl', t('Mayús', 'Shift'), 'Z']} />
                    <ShortcutItem action={t('Herramienta de selección / cuchilla', 'Select / razor tool')} keys={['V', 'C']} />
                    <ShortcutItem action={t('Añadir marcador', 'Add marker')} keys={['M']} />
                    <ShortcutItem action={t('Eliminar clip seleccionado', 'Delete selected clip')} keys={[t('Supr', 'Delete')]} />
                    <ShortcutItem action={t('Buscar medios', 'Search media')} keys={['Ctrl', 'K']} />
                    <ShortcutItem action={t('Cerrar menú o diálogo', 'Close menu or dialog')} keys={['Esc']} />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'Acerca de' && (
              <div className="flex flex-col gap-6">
                <header className="flex flex-col gap-0.5">
                  <h1 className="text-xl font-semibold tracking-tight text-white">{t('Acerca de Spartan Video', 'About Sparta Video')}</h1>
                  <p className="text-xs text-white/45">{t('Arquitectura de edición local con aceleración web.', 'Local editing architecture with web acceleration.')}</p>
                </header>

                <section className="flex flex-col divide-y divide-white/[0.04]">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-medium text-white/90">{t('Edición', 'Editing')}</span>
                    <span className="text-xs text-white/60">Spartan Video Studio</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-medium text-white/90">{t('Versión', 'Version')}</span>
                    <span className="text-xs font-mono text-white/60">v0.5.5-alpha</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-medium text-white/90">{t('Arquitectura de diseño', 'Design architecture')}</span>
                    <span className="text-xs text-white/60">Spartan Agent Design System</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-medium text-white/90">{t('Iconografía', 'Iconography')}</span>
                    <span className="text-xs text-white/60">Lucide Pro Clean</span>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </DialogContent>
    </Dialog>
    <BaseDialog.Root open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="modal-backdrop confirm-backdrop" />
        <BaseDialog.Popup className="confirm-dialog" aria-labelledby="reset-preferences-title" aria-describedby="reset-preferences-description">
          <span className="dialog-eyebrow">{t('PREFERENCIAS LOCALES', 'LOCAL PREFERENCES')}</span>
          <BaseDialog.Title id="reset-preferences-title" className="dialog-title">{t('Restablecer preferencias', 'Reset preferences')}</BaseDialog.Title>
          <BaseDialog.Description id="reset-preferences-description" className="dialog-description">{t('Se borrarán tus preferencias, proveedores y claves guardadas en el llavero del sistema. Esta acción no se puede deshacer.', 'Your preferences, providers, and keys saved in the system vault will be cleared. This action cannot be undone.')}</BaseDialog.Description>
          {resetError && <p role="alert" className="mt-3 text-xs text-red-300">{resetError}</p>}
          <div className="dialog-actions">
            <BaseDialog.Close className="secondary-button">{t('Cancelar', 'Cancel')}</BaseDialog.Close>
            <button className="danger-button" type="button" onClick={() => void confirmResetAllPrefs()}>{t('Restablecer', 'Reset')}</button>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
    </>
  )
}

function AppearanceSettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="appearance-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function AppearanceSettingRow({ label, description, children, className = '' }: { label: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`appearance-row ${className}`}>
      <div className="appearance-row-copy">
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className="appearance-row-control">{children}</div>
    </div>
  )
}

function ShortcutItem({ action, keys }: { action: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between py-2 text-xs">
      <span className="text-white/70">{action}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) =>
          k === '/' ? (
            <span key={i} className="text-white/30 text-[10px] px-0.5">
              /
            </span>
          ) : (
            <kbd
              key={i}
              className="inline-flex min-w-[20px] items-center justify-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-white/80 shadow-sm"
            >
              {k}
            </kbd>
          ),
        )}
      </div>
    </div>
  )
}
