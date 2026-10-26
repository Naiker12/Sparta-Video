import { z } from 'zod'
import { invoke, isTauri } from '@tauri-apps/api/core'

export const PROVIDER_REGISTRY_KEY = 'sparta-ai-provider-registry-v1'
export const AI_TASKS = ['text', 'image', 'video', 'voice', 'audio'] as const
export type AITask = typeof AI_TASKS[number]
export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'compatible' | 'groq' | 'deepseek' | 'openrouter' | 'mistral' | 'elevenlabs'
export type ModelCapability = AITask | 'transcription'

export const providerKinds: { id: ProviderKind; name: string; defaultUrl: string; keyRequired: boolean }[] = [
  { id: 'openai', name: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', keyRequired: true },
  { id: 'anthropic', name: 'Anthropic · Claude', defaultUrl: 'https://api.anthropic.com/v1', keyRequired: true },
  { id: 'gemini', name: 'Google · Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta', keyRequired: true },
  { id: 'elevenlabs', name: 'ElevenLabs · Voz y efectos', defaultUrl: 'https://api.elevenlabs.io/v1', keyRequired: true },
  { id: 'openrouter', name: 'OpenRouter · Multimodal', defaultUrl: 'https://openrouter.ai/api/v1', keyRequired: true },
  { id: 'groq', name: 'Groq · Texto y voz', defaultUrl: 'https://api.groq.com/openai/v1', keyRequired: true },
  { id: 'mistral', name: 'Mistral AI', defaultUrl: 'https://api.mistral.ai/v1', keyRequired: true },
  { id: 'deepseek', name: 'DeepSeek', defaultUrl: 'https://api.deepseek.com', keyRequired: true },
  { id: 'compatible', name: 'Compatible con OpenAI', defaultUrl: 'http://localhost:11434/v1', keyRequired: false },
]

export const modelSchema = z.object({ id: z.string().min(1), name: z.string().min(1), capabilities: z.array(z.enum(['text', 'image', 'video', 'voice', 'audio', 'transcription'])) })
export const profileSchema = z.object({
  id: z.string().min(1), kind: z.enum(['openai', 'anthropic', 'gemini', 'compatible', 'groq', 'deepseek', 'openrouter', 'mistral', 'elevenlabs']), name: z.string().min(1), baseUrl: z.string().url(),
  status: z.enum(['pending', 'connected', 'error']), models: z.array(modelSchema), keyConfigured: z.boolean().optional(), lastChecked: z.string().optional(), error: z.string().optional(),
})
export const registrySchema = z.object({ profiles: z.array(profileSchema), assignments: z.record(z.string(), z.string()) })
export type AIModel = z.infer<typeof modelSchema>
export type ProviderProfile = z.infer<typeof profileSchema>
export type ProviderRegistry = z.infer<typeof registrySchema>

const emptyRegistry: ProviderRegistry = { profiles: [], assignments: {} }
const sessionKeys = new Map<string, string>()
const supportedCapabilities: ModelCapability[] = ['text', 'image', 'video', 'voice', 'audio', 'transcription']

export function readProviderRegistry(): ProviderRegistry {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PROVIDER_REGISTRY_KEY) || 'null')
    const parsed = registrySchema.safeParse(value)
    return parsed.success ? parsed.data : emptyRegistry
  } catch { return emptyRegistry }
}

export function writeProviderRegistry(value: ProviderRegistry) {
  const safe = registrySchema.parse(value)
  window.localStorage.setItem(PROVIDER_REGISTRY_KEY, JSON.stringify(safe))
}

export function setSessionKey(profileId: string, key: string) {
  if (key) sessionKeys.set(profileId, key)
  else sessionKeys.delete(profileId)
}

export function forgetSessionKey(profileId: string) { sessionKeys.delete(profileId) }
export function clearSessionKeys() { sessionKeys.clear() }
export function hasSessionKey(profileId: string) { return Boolean(sessionKeys.get(profileId)) }
export function getSessionKey(profileId: string) { return sessionKeys.get(profileId) ?? '' }

function responseError(body: unknown, status: number) {
  if (body && typeof body === 'object') {
    const obj = body as { error?: { message?: string }; message?: string }
    if (obj.error?.message) return obj.error.message
    if (obj.message) return obj.message
  }
  return `La solicitud falló (HTTP ${status}).`
}

async function requestJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(responseError(body, response.status))
  return body
}

function listFrom(body: unknown): unknown[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) return []
  return (body as { data: unknown[] }).data
}

function modelId(value: unknown) {
  return value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string' ? (value as { id: string }).id : ''
}

function inferredTextCapabilities(id: string): ModelCapability[] {
  const lowered = id.toLowerCase()
  if (/dall-e|gpt-image|stable-diffusion|flux|imagen|image-gen/.test(lowered)) return ['image']
  if (/tts|text-to-speech|speech|voice/.test(lowered)) return ['voice']
  if (/whisper|transcri/.test(lowered)) return ['transcription']
  if (/text-to-sound|sound-generation|sound-effects|stable-audio|music-gen|audio-gen|eleven_text_to_sound/.test(lowered)) return ['audio']
  if (/sora|veo|video/.test(lowered)) return ['video']
  return ['text']
}

export async function discoverModels(profile: Pick<ProviderProfile, 'id' | 'kind' | 'baseUrl'>, apiKey: string): Promise<AIModel[]> {
  if (isTauri()) {
    return invoke<AIModel[]>('list_provider_models', {
      request: { profileId: profile.id, kind: profile.kind, baseUrl: profile.baseUrl, apiKey: apiKey || null },
    })
  }
  const root = profile.baseUrl.replace(/\/+$/, '')
  let body: unknown
  if (profile.kind === 'elevenlabs') {
    const headers: Record<string, string> = apiKey ? { 'xi-api-key': apiKey } : {}
    const result = await requestJson(`${root}/models`, headers)
    const raw = Array.isArray(result) ? result : []
    const models = raw.map((item) => {
      const row = item as { model_id?: string; name?: string; can_do_text_to_speech?: boolean; can_do_voice_conversion?: boolean }
      if (!row.model_id) return null
      const capabilities: ModelCapability[] = []
      if (row.can_do_text_to_speech) capabilities.push('voice')
      if (row.can_do_voice_conversion && !capabilities.includes('voice')) capabilities.push('voice')
      return { id: row.model_id, name: row.name || row.model_id, capabilities }
    }).filter((model): model is AIModel => model !== null)
    // The sound-effects API documents these two selectable model IDs separately from GET /models.
    models.push(
      { id: 'eleven_text_to_sound_v2', name: 'Eleven Text to Sound v2', capabilities: ['audio'] },
      { id: 'eleven_text_to_sound_v3', name: 'Eleven Text to Sound v3', capabilities: ['audio'] },
    )
    return models.sort((a, b) => a.name.localeCompare(b.name))
  }
  if (profile.kind === 'openai' || profile.kind === 'compatible' || profile.kind === 'groq' || profile.kind === 'deepseek' || profile.kind === 'openrouter' || profile.kind === 'mistral') {
    const path = profile.kind === 'openrouter' ? '/models?output_modalities=all' : '/models'
    const result = await requestJson(`${root}${path}`, apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    if (profile.kind === 'openrouter' && result && typeof result === 'object' && Array.isArray((result as { data?: unknown }).data)) {
      body = { data: (result as { data: Record<string, unknown>[] }).data.map((row) => {
        const architecture = row.architecture as { output_modalities?: unknown } | undefined
        const outputs = Array.isArray(architecture?.output_modalities) ? architecture.output_modalities.filter((value): value is string => typeof value === 'string') : []
        const capabilities: ModelCapability[] = []
        if (outputs.includes('text')) capabilities.push('text')
        if (outputs.includes('image')) capabilities.push('image')
        if (outputs.includes('audio')) capabilities.push('audio')
        if (outputs.includes('video')) capabilities.push('video')
        return { ...row, displayName: row.name, capabilities: capabilities.length ? capabilities : ['text'] }
      }) }
    } else body = result
  } else if (profile.kind === 'anthropic') {
    body = await requestJson(`${root}/models?limit=1000`, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' })
  } else {
    const headers: Record<string, string> = apiKey ? { 'x-goog-api-key': apiKey } : {}
    const result = await requestJson(`${root}/models`, headers)
    const raw = result && typeof result === 'object' && Array.isArray((result as { models?: unknown }).models) ? (result as { models: unknown[] }).models : []
    body = { data: raw.map((item) => {
      const row = item as { name?: string; displayName?: string; supportedGenerationMethods?: string[] }
      const id = row.name?.replace(/^models\//, '') ?? ''
      const supports = row.supportedGenerationMethods ?? []
      const capabilities: ModelCapability[] = supports.some((method) => /generateContent/i.test(method)) ? ['text'] : []
      if (supports.some((method) => /generateImages/i.test(method)) || /imagen|image/i.test(id)) capabilities.push('image')
      if (/veo|video/i.test(id)) capabilities.push('video')
      if (/tts|speech|voice/i.test(id)) capabilities.push('voice')
      if (/audio|transcri|percep/i.test(id)) capabilities.push('audio')
      if (/transcri/i.test(id)) capabilities.push('transcription')
      return { id, displayName: row.displayName, capabilities }
    }) }
  }
  const rows = listFrom(body)
  const models = rows.map((item) => {
    const id = modelId(item)
    if (!id) return null
    const customCapabilities = item && typeof item === 'object' && Array.isArray((item as { capabilities?: unknown }).capabilities)
      ? (item as { capabilities: unknown[] }).capabilities.filter((cap): cap is ModelCapability => supportedCapabilities.includes(cap as ModelCapability))
      : inferredTextCapabilities(id)
    const name = item && typeof item === 'object' && typeof (item as { displayName?: unknown }).displayName === 'string'
      ? (item as { displayName: string }).displayName : id
    return { id, name, capabilities: customCapabilities }
  }).filter((model): model is AIModel => model !== null)
  return models.sort((a, b) => a.name.localeCompare(b.name))
}

export function makeProviderId() {
  return crypto.randomUUID()
}

