import { invoke, isTauri } from '@tauri-apps/api/core'
import { getSessionKey, type ProviderProfile } from './ai-provider-registry'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type AnalysisDepth = 'concise' | 'balanced' | 'deep'

export async function sendAIChat(input: {
  profile: ProviderProfile
  modelId: string
  messages: ChatMessage[]
  projectContext: string
  mode: 'create' | 'edit'
  depth: AnalysisDepth
}): Promise<string> {
  const { profile, modelId, messages, projectContext, mode, depth } = input
  if (isTauri()) return invoke<string>('chat_with_provider', {
    request: {
      profileId: profile.id, kind: profile.kind, baseUrl: profile.baseUrl, modelId,
      messages, projectContext, mode, depth,
    },
  })

  const apiKey = getSessionKey(profile.id)
  const base = profile.baseUrl.replace(/\/+$/, '')
  const modeInstruction = mode === 'create'
    ? 'Ayuda a planear un video nuevo. Entrega ideas concretas para guion, escenas y recursos; no afirmes que generaste medios ni que cambiaste el proyecto.'
    : 'Ayuda a analizar y mejorar la edición actual. Propón acciones concretas, pero no afirmes que modificaste el proyecto.'
  const depthInstruction = depth === 'deep'
    ? 'Haz un análisis cuidadoso y profundo. Comprueba supuestos, señala riesgos y termina con una recomendación concreta. Expón una explicación breve, no razonamiento interno privado.'
    : depth === 'concise'
      ? 'Responde de forma breve y directa, priorizando la acción más útil.'
      : 'Da una respuesta equilibrada, con los pasos y detalles necesarios. No reveles razonamiento interno privado.'
  const system = `Eres Sparta AI, asistente de edición de video. Responde en español salvo que la persona escriba en inglés. ${modeInstruction} ${depthInstruction}\n\nContexto actual del proyecto (datos locales seleccionados para esta solicitud):\n${projectContext}`
  const url = profile.kind === 'anthropic'
    ? `${base}/messages`
    : profile.kind === 'gemini'
      ? `${base}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`
      : `${base}/chat/completions`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (profile.kind === 'anthropic') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else if (profile.kind !== 'gemini' && apiKey) headers.Authorization = `Bearer ${apiKey}`
  const history = messages.slice(-20)
  const body: Record<string, unknown> = profile.kind === 'anthropic'
    ? { model: modelId, max_tokens: 2048, system, messages: history }
    : profile.kind === 'gemini'
      ? { systemInstruction: { parts: [{ text: system }] }, contents: history.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })), generationConfig: { maxOutputTokens: 2048 } }
      : { model: modelId, messages: [{ role: 'system', content: system }, ...history], temperature: 0.6, max_tokens: 2048 }
  const isOpenAIReasoningModel = profile.kind === 'openai' && /^(o1|o3|o4|gpt-5)/i.test(modelId)
  if (isOpenAIReasoningModel) {
    delete body.temperature
    delete body.max_tokens
    body.max_completion_tokens = 2048
    body.reasoning_effort = depth === 'deep' ? 'high' : depth === 'concise' ? 'low' : 'medium'
  }
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload as { error?: { message?: string }; message?: string } : {}
    throw new Error(error.error?.message || error.message || `El proveedor respondió con HTTP ${response.status}.`)
  }
  const result = payload as {
    choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[]
    content?: { type?: string; text?: string }[]
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const content = profile.kind === 'anthropic'
    ? result.content?.map((part) => part.text ?? '').join('')
    : profile.kind === 'gemini'
      ? result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
      : typeof result.choices?.[0]?.message?.content === 'string'
        ? result.choices[0].message.content
        : result.choices?.[0]?.message?.content?.map((part) => part.text ?? '').join('')
  if (!content?.trim()) throw new Error('El proveedor no devolvió texto. Revisa el modelo y los permisos de la cuenta.')
  return content.trim()
}
