import { useEffect, useMemo, useState } from 'react'
import { Check, CircleAlert, KeyRound, LoaderCircle, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { t } from '../services/locale'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import { invoke, isTauri } from '@tauri-apps/api/core'
import {
  AI_TASKS, discoverModels, forgetSessionKey, getSessionKey, hasSessionKey, makeProviderId, providerKinds, readProviderRegistry,
  setSessionKey, writeProviderRegistry, type AIModel, type AITask, type ModelCapability, type ProviderKind,
  type ProviderProfile, type ProviderRegistry,
} from '../services/ai-provider-registry'
import { AI_PREFS_EVENT, AI_PREFS_KEY } from '../services/ai-preferences'

const taskNames: Record<AITask, [string, string]> = {
  text: ['Guion y análisis', 'Script and analysis'], image: ['Imágenes', 'Images'], video: ['Video', 'Video'],
  voice: ['Voz y narración', 'Voice and narration'], audio: ['Música y efectos', 'Music and effects'],
}
const capabilityNames: Record<ModelCapability, [string, string]> = {
  text: ['Texto', 'Text'], image: ['Imagen', 'Image'], video: ['Video', 'Video'], voice: ['Voz', 'Speech'], audio: ['Audio', 'Audio'], transcription: ['Transcripción', 'Transcription'],
}
const taskCapability: Record<AITask, ModelCapability> = { text: 'text', image: 'image', video: 'video', voice: 'voice', audio: 'audio' }
const modelKey = (providerId: string, modelId: string) => `${providerId}::${modelId}`
const splitModelKey = (value: string) => {
  const index = value.indexOf('::')
  return index < 0 ? ['', ''] : [value.slice(0, index), value.slice(index + 2)]
}
const compatibleWith = (profiles: ProviderProfile[], task: AITask, value: string) => {
  const [profileId, modelId] = splitModelKey(value)
  return profiles.find((profile) => profile.id === profileId)?.models.find((model) => model.id === modelId)?.capabilities.includes(taskCapability[task]) ?? false
}

export function AIProviderSettings() {
  const [registry, setRegistry] = useState<ProviderRegistry>(readProviderRegistry)
  const [editing, setEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [kind, setKind] = useState<ProviderKind>('openai')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState(providerKinds[0].defaultUrl)
  const [apiKey, setApiKey] = useState('')
  const [loadedModels, setLoadedModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectedKind = providerKinds.find((provider) => provider.id === kind)!

  useEffect(() => {
    if (!isTauri()) return
    let active = true
    const initialProfiles = readProviderRegistry().profiles
    void Promise.all(initialProfiles.map(async (profile) => {
      try { return [profile.id, await invoke<boolean>('provider_api_key_configured', { profileId: profile.id })] as const }
      catch { return [profile.id, undefined] as const }
    })).then((statuses) => {
      if (!active) return
      const statusById = new Map(statuses)
      setRegistry((current) => ({
        ...current,
        profiles: current.profiles.map((profile) => statusById.has(profile.id) && statusById.get(profile.id) !== undefined
          ? { ...profile, keyConfigured: statusById.get(profile.id) }
          : profile),
      }))
    })
    return () => { active = false }
  }, [])

  const modelOptions = useMemo(() => registry.profiles.flatMap((profile) => profile.models.map((model) => ({
    value: modelKey(profile.id, model.id), label: `${profile.name} · ${model.name}`,
  }))), [registry.profiles])

  const commit = (next: ProviderRegistry) => {
    try {
      writeProviderRegistry(next)
      setRegistry(next)
      try { window.localStorage.setItem(AI_PREFS_KEY, JSON.stringify(next.assignments)) } catch { /* registry remains the source of truth */ }
      window.dispatchEvent(new CustomEvent(AI_PREFS_EVENT))
      setNotice(t('Configuración guardada en este equipo.', 'Configuration saved on this device.'))
      window.setTimeout(() => setNotice(''), 2800)
      return true
    } catch {
      setError(t('No se pudo guardar la configuración local.', 'Could not save the local configuration.'))
      return false
    }
  }

  const startNew = () => {
    setEditingId(null); setKind('openai'); setName(''); setBaseUrl(providerKinds[0].defaultUrl)
    setApiKey(''); setLoadedModels([]); setError(''); setNotice(''); setEditing(true)
  }

  const startEdit = (profile: ProviderProfile) => {
    setEditingId(profile.id); setKind(profile.kind); setName(profile.name); setBaseUrl(profile.baseUrl)
    setApiKey(''); setLoadedModels(profile.models); setError(''); setNotice(''); setEditing(true)
  }

  const cancelEdit = () => {
    if (editingId && (apiKey || !registry.profiles.some((profile) => profile.id === editingId))) forgetSessionKey(editingId)
    setEditing(false)
  }

  const chooseKind = (nextKind: ProviderKind) => {
    if (editingId && !registry.profiles.some((profile) => profile.id === editingId)) forgetSessionKey(editingId)
    if (editingId && !registry.profiles.some((profile) => profile.id === editingId)) setEditingId(null)
    setKind(nextKind)
    const provider = providerKinds.find((item) => item.id === nextKind)!
    setBaseUrl(provider.defaultUrl)
    setName(provider.name)
    setLoadedModels([])
  }

  const loadModels = async () => {
    setError(''); setNotice('')
    const savedProfile = editingId ? registry.profiles.find((profile) => profile.id === editingId) : undefined
    const endpointChanged = savedProfile && (savedProfile.kind !== kind || savedProfile.baseUrl.replace(/\/+$/, '') !== baseUrl.replace(/\/+$/, ''))
    if (selectedKind.keyRequired && !apiKey && !(editingId && (hasSessionKey(editingId) || (isTauri() && !endpointChanged)))) {
      setError(t('Escribe la clave API antes de consultar los modelos.', 'Enter the API key before loading models.'))
      return
    }
    if (endpointChanged && !apiKey && (savedProfile?.keyConfigured || (editingId && hasSessionKey(editingId)))) {
      setError(t('La URL cambió. Vuelve a escribir la clave para no enviar la credencial guardada a otro servidor.', 'The URL changed. Re-enter the key so the saved credential is not sent to a different server.'))
      return
    }
    try { new URL(baseUrl) } catch {
      setError(t('La URL base no es válida.', 'The base URL is invalid.')); return
    }
    setLoading(true)
    const id = editingId ?? makeProviderId()
    try {
      const models = await discoverModels({ id, kind, baseUrl }, apiKey || (editingId ? getSessionKey(editingId) : ''))
      if (!models.length) {
        setLoadedModels([])
        setError(t('El proveedor respondió, pero no devolvió modelos.', 'The provider responded but returned no models.'))
      } else {
        setEditingId(id)
        setLoadedModels(models)
        if (apiKey) setSessionKey(id, apiKey)
        setNotice(t(`${models.length} modelos cargados. Revisa sus capacidades y guarda el proveedor.`, `${models.length} models loaded. Review capabilities and save the provider.`))
      }
    } catch (reason) {
      setLoadedModels([])
      const message = typeof reason === 'string'
        ? reason
        : reason instanceof Error && reason.name === 'TypeError'
        ? t('No se pudo conectar desde el navegador. Usa Tauri de escritorio para consultar el catálogo sin restricciones CORS.', 'The browser could not connect. Use the Tauri desktop build to load models without CORS restrictions.')
        : reason instanceof Error && reason.name === 'TimeoutError'
          ? t('El proveedor tardó demasiado en responder.', 'The provider took too long to respond.')
          : t('No se pudieron cargar los modelos. Verifica la clave, la URL y los permisos de la cuenta.', 'Could not load models. Check the key, URL, and account permissions.')
      setError(message)
    } finally { setLoading(false) }
  }

  const toggleCapability = (modelId: string, capability: ModelCapability) => {
    setLoadedModels((models) => models.map((model) => model.id !== modelId ? model : {
      ...model, capabilities: model.capabilities.includes(capability)
        ? model.capabilities.filter((item) => item !== capability)
        : [...model.capabilities, capability],
    }))
  }

  const saveProvider = async () => {
    const id = editingId ?? makeProviderId()
    if (isTauri() && apiKey) {
      try { await invoke('store_provider_api_key', { profileId: id, apiKey }) }
      catch (reason) { setError(typeof reason === 'string' ? reason : t('No se pudo guardar la clave en el llavero de Windows.', 'Could not store the key in the Windows Credential Manager.')); return }
    }
    const previousProfile = registry.profiles.find((item) => item.id === id)
    const profile: ProviderProfile = {
      id, kind, name: name.trim() || selectedKind.name, baseUrl: baseUrl.replace(/\/+$/, ''), status: 'connected', models: loadedModels,
      keyConfigured: isTauri() ? Boolean(apiKey || previousProfile?.keyConfigured || (editingId && selectedKind.keyRequired)) : false, lastChecked: new Date().toISOString(),
    }
    const profiles = [...registry.profiles.filter((item) => item.id !== id), profile]
    const assignments = { ...registry.assignments }
    for (const task of AI_TASKS) {
      if (assignments[task] && compatibleWith(profiles, task, assignments[task])) continue
      delete assignments[task]
      const model = loadedModels.find((item) => item.capabilities.includes(taskCapability[task]))
      if (model) assignments[task] = modelKey(id, model.id)
    }
    if (apiKey) setSessionKey(id, apiKey)
    if (commit({ profiles, assignments })) {
      if (isTauri() && apiKey) forgetSessionKey(id)
      setEditing(false)
    }
  }

  const removeProvider = async (profile: ProviderProfile) => {
    if (isTauri()) {
      try { await invoke('delete_provider_api_key', { profileId: profile.id }) }
      catch (reason) { setError(typeof reason === 'string' ? reason : t('No se pudo quitar la clave del llavero.', 'Could not remove the key from the system credential store.')); return }
    }
    forgetSessionKey(profile.id)
    const assignments = { ...registry.assignments }
    for (const task of AI_TASKS) if (splitModelKey(assignments[task] ?? '')[0] === profile.id) delete assignments[task]
    commit({ profiles: registry.profiles.filter((item) => item.id !== profile.id), assignments })
  }

  const updateTask = (task: AITask, value: string) => commit({ ...registry, assignments: { ...registry.assignments, [task]: value } })
  const patchModelCapabilities = (profileId: string, modelId: string, capability: ModelCapability) => {
    const profiles = registry.profiles.map((profile) => profile.id !== profileId ? profile : {
      ...profile, models: profile.models.map((model) => model.id !== modelId ? model : {
        ...model, capabilities: model.capabilities.includes(capability)
          ? model.capabilities.filter((item) => item !== capability)
          : [...model.capabilities, capability],
      }),
    })
    const assignments = { ...registry.assignments }
    for (const task of AI_TASKS) if (assignments[task] && !compatibleWith(profiles, task, assignments[task])) delete assignments[task]
    commit({ profiles, assignments })
  }

  const assignmentIsCompatible = (task: AITask, value: string) => compatibleWith(registry.profiles, task, value)

  return (
    <div className="ai-provider-settings flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-white">{t('Proveedores de IA', 'AI providers')}</h1>
        <p className="text-xs text-white/50">{t('Conecta un servicio, carga su catálogo y asigna modelos por tarea.', 'Connect a service, load its catalog, and assign models by task.')}</p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-white/90">{t('Proveedores conectados', 'Connected providers')}</h2><p className="mt-1 text-[11px] text-white/45">{t('Cada catálogo pertenece únicamente al proveedor que lo entrega.', 'Each catalog belongs only to the provider that returned it.')}</p></div>
          <button type="button" onClick={startNew} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-blue-500 px-3 text-xs font-semibold text-white hover:bg-blue-400"><Plus size={14} />{t('Agregar', 'Add provider')}</button>
        </div>

        {!registry.profiles.length && <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center text-xs text-white/50">{t('Todavía no hay proveedores. Agrega uno para consultar sus modelos.', 'No providers yet. Add one to load its models.')}</div>}
        <div className="flex flex-col gap-2">
          {registry.profiles.map((profile) => <article key={profile.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><strong className="text-xs text-white/90">{profile.name}</strong><span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2 py-0.5 text-[10px] text-emerald-300"><Check size={11} />{profile.keyConfigured ? t('Clave en llavero', 'Key in system vault') : t('Catálogo cargado', 'Catalog loaded')}</span></div>
                <p className="mt-1 truncate text-[10px] text-white/40">{providerKinds.find((item) => item.id === profile.kind)?.name} · {profile.models.length} {t('modelos', 'models')}</p>
              </div>
              <div className="flex shrink-0 gap-1"><button type="button" title={t('Editar y actualizar', 'Edit and refresh')} aria-label={t('Editar proveedor', 'Edit provider')} onClick={() => startEdit(profile)} className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"><RefreshCw size={14} /></button><button type="button" title={t('Eliminar proveedor', 'Remove provider')} aria-label={t('Eliminar proveedor', 'Remove provider')} onClick={() => removeProvider(profile)} className="rounded-md p-1.5 text-white/55 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={14} /></button></div>
            </div>
            <div className="mt-3 max-h-44 overflow-auto rounded-lg border border-white/[0.06]">
              {profile.models.slice(0, 60).map((model) => <div key={model.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] px-2.5 py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/75" title={model.id}>{model.name}</span>
                <div className="flex flex-wrap gap-1">{AI_TASKS.map((capability) => <button key={capability} type="button" aria-pressed={model.capabilities.includes(capability)} onClick={() => patchModelCapabilities(profile.id, model.id, capability)} className={`rounded-md border px-1.5 py-0.5 text-[9px] transition-colors ${model.capabilities.includes(capability) ? 'border-blue-400/35 bg-blue-400/10 text-blue-200' : 'border-white/[0.07] text-white/35 hover:text-white/70'}`}>{t(...capabilityNames[capability])}</button>)}</div>
              </div>)}
              {profile.models.length > 60 && <p className="px-2.5 py-1.5 text-[10px] text-white/40">{t(`Se muestran 60 de ${profile.models.length}.`, `Showing 60 of ${profile.models.length}.`)}</p>}
            </div>
          </article>)}
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-white/[0.07] pt-5">
        <div><h2 className="text-sm font-semibold text-white/90">{t('Modelo por tarea', 'Model per task')}</h2><p className="mt-1 text-[11px] text-white/45">{t('Al guardar un proveedor, se proponen sus modelos compatibles en tareas vacías.', 'When saving a provider, compatible models are suggested for unassigned tasks.')}</p></div>
        {AI_TASKS.map((task) => {
          const value = registry.assignments[task] ?? ''
          const options = modelOptions.filter((option) => assignmentIsCompatible(task, option.value))
          return <label key={task} className="grid grid-cols-[minmax(115px,.8fr)_minmax(0,1.5fr)] items-center gap-3 border-b border-white/[0.05] pb-2.5 last:border-0">
            <span className="text-xs font-medium text-white/75">{t(...taskNames[task])}</span>
            <select aria-label={t(...taskNames[task])} value={value} onChange={(event) => updateTask(task, event.target.value)} className="ai-task-select h-9 min-w-0 rounded-lg border px-2.5 text-xs outline-none focus:border-blue-400/60" style={{ backgroundColor: 'var(--panel-raised)', color: 'var(--text)', borderColor: 'var(--line)' }}>
              <option value="" style={{ backgroundColor: 'var(--panel-raised)', color: 'var(--text)' }}>{t('Sin asignar', 'Unassigned')}</option>{options.map((option) => <option key={option.value} value={option.value} style={{ backgroundColor: 'var(--panel-raised)', color: 'var(--text)' }}>{option.label}</option>)}
            </select>
          </label>
        })}
      </section>

      {(notice || error) && <div role={error ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[11px] ${error ? 'border-amber-400/20 bg-amber-400/[0.06] text-amber-200/85' : 'border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-200/85'}`}>{error ? <CircleAlert size={14} className="mt-0.5 shrink-0" /> : <Check size={14} className="mt-0.5 shrink-0" />}{error || notice}</div>}

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/15 bg-amber-400/[0.045] p-3 text-[11px] leading-relaxed text-white/55"><KeyRound size={14} className="mt-0.5 shrink-0 text-amber-300/80" /><p>{isTauri() ? t('Las claves se guardan en el llavero de Windows. La lista de modelos y asignaciones queda en este equipo; quitar un proveedor elimina también su credencial.', 'Keys are stored in the Windows Credential Manager. Model lists and assignments stay on this device; removing a provider also deletes its credential.') : t('En la vista web las claves solo permanecen en memoria hasta cerrar o recargar. Para guardar claves con protección del sistema y evitar restricciones CORS, abre la versión Tauri de escritorio.', 'In the web preview, keys stay in memory only until the app closes or reloads. Open the Tauri desktop build to store keys in the system vault and avoid CORS restrictions.')}</p></div>

      <Dialog open={editing} onOpenChange={(open) => { if (open) setEditing(true); else cancelEdit() }}>
        <DialogContent hideClose overlayClassName="ai-provider-overlay" className="ai-provider-modal flex max-h-[min(82vh,760px)] w-[min(92vw,672px)] max-w-2xl flex-col bg-[#191a1d] p-0 text-white">
          <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4"><div><DialogTitle id="ai-provider-title" className="text-base font-semibold text-white">{editingId ? t('Configurar proveedor', 'Configure provider') : t('Agregar proveedor', 'Add provider')}</DialogTitle><DialogDescription className="mt-1 text-[11px] text-white/45">{t('Carga los modelos primero; después guarda el perfil.', 'Load models first, then save the provider.')}</DialogDescription></div><button type="button" aria-label={t('Cerrar', 'Close')} onClick={cancelEdit} className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"><X size={17} /></button></header>
          <div className="flex flex-col gap-4 overflow-auto px-5 py-4">
            <label className="dialog-field">{t('Proveedor', 'Provider')}<select disabled={Boolean(editingId && registry.profiles.some((profile) => profile.id === editingId))} value={kind} onChange={(event) => chooseKind(event.target.value as ProviderKind)} className="ai-provider-field-select h-9 rounded-lg border border-white/10 bg-[#121316] px-2.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60">{providerKinds.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
            <label className="dialog-field">{t('Nombre visible', 'Display name')}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={selectedKind.name} /></label>
            <label className="dialog-field">{t('URL base', 'Base URL')}<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} /></label>
            <label className="dialog-field">{t('Clave API', 'API key')} {selectedKind.keyRequired && <span className="text-white/35">{t('(requerida)', '(required)')}</span>}<input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={editingId && hasSessionKey(editingId) ? t('Clave disponible en esta sesión', 'Key available in this session') : selectedKind.keyRequired ? 'sk-…' : t('Opcional para servicios locales', 'Optional for local services')} /></label>
            <button type="button" disabled={loading} onClick={() => void loadModels()} className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-blue-400/25 bg-blue-400/10 px-3 text-xs font-semibold text-blue-100 hover:bg-blue-400/15 disabled:opacity-50">{loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}{loading ? t('Consultando catálogo…', 'Loading catalog…') : t('Cargar modelos', 'Load models')}</button>
            {error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
            {loadedModels.length > 0 && <div className="flex min-h-0 flex-col gap-2"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-white/85">{t('Modelos y capacidades', 'Models and capabilities')}</h3><span className="text-[10px] text-white/40">{loadedModels.length} {t('encontrados', 'found')}</span></div><p className="text-[10px] leading-relaxed text-white/45">{t('Los catálogos no siempre publican capacidades. Confirma los usos disponibles con tu cuenta y marca los adecuados.', 'Catalogs do not always publish capabilities. Confirm availability with your account and mark the supported uses.')}</p><div className="max-h-64 overflow-auto rounded-lg border border-white/[0.08]">{loadedModels.slice(0, 100).map((model) => <div key={model.id} className="flex flex-col gap-2 border-b border-white/[0.06] px-3 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><strong className="block truncate text-[11px] text-white/85">{model.name}</strong><span className="block truncate font-mono text-[9px] text-white/35">{model.id}</span></div><div className="flex flex-wrap gap-1">{AI_TASKS.map((capability) => <button key={capability} type="button" aria-pressed={model.capabilities.includes(capability)} onClick={() => toggleCapability(model.id, capability)} className={`rounded-md border px-1.5 py-0.5 text-[9px] ${model.capabilities.includes(capability) ? 'border-blue-400/35 bg-blue-400/10 text-blue-200' : 'border-white/[0.07] text-white/35 hover:text-white/70'}`}>{t(...capabilityNames[capability])}</button>)}</div></div>)}</div></div>}
          </div>
          <footer className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3"><button type="button" onClick={cancelEdit} className="h-8 rounded-lg px-3 text-xs text-white/60 hover:bg-white/[0.06]">{t('Cancelar', 'Cancel')}</button><button type="button" disabled={!loadedModels.length || loading} onClick={() => void saveProvider()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-500 px-3 text-xs font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"><Save size={13} />{t('Guardar proveedor', 'Save provider')}</button></footer>
        </DialogContent>
      </Dialog>
    </div>
  )
}
