export const AI_PREFS_KEY = 'sparta-ai-provider-preferences'
export const AI_PREFS_EVENT = 'sparta-ai-provider-preferences-changed'

export type AIProviderPrefs = { text: string; image: string; video: string; voice: string; audio: string }
export const defaultAIProviderPrefs: AIProviderPrefs = { text: '', image: '', video: '', voice: '', audio: '' }

export function readAIProviderPrefs(): AIProviderPrefs {
  try {
    const saved = JSON.parse(window.localStorage.getItem(AI_PREFS_KEY) || 'null') as Partial<AIProviderPrefs> | null
    if (!saved || typeof saved !== 'object') return defaultAIProviderPrefs
    return Object.fromEntries(Object.keys(defaultAIProviderPrefs).map((key) => {
      const name = key as keyof AIProviderPrefs
      return [name, typeof saved[name] === 'string' ? saved[name] : defaultAIProviderPrefs[name]]
    })) as AIProviderPrefs
  } catch { return defaultAIProviderPrefs }
}

export function getProviderLabel(_task: keyof AIProviderPrefs, providerId: string) {
  if (!providerId) return 'Sin proveedor'
  try {
    const saved = JSON.parse(window.localStorage.getItem('sparta-ai-provider-registry-v1') || 'null') as {
      profiles?: { id: string; name: string; models?: { id: string; name: string }[] }[]
    } | null
    const [profileId, modelId] = providerId.split('::')
    const profile = saved?.profiles?.find((item) => item.id === profileId)
    const model = profile?.models?.find((item) => item.id === modelId)
    return profile ? `${profile.name}${model ? ` · ${model.name}` : ''}` : providerId
  } catch { return providerId }
}
