import { invoke, isTauri } from '@tauri-apps/api/core'
import type { ProviderProfile } from './ai-provider-registry'
import { getSessionKey } from './ai-provider-registry'

export type ElevenLabsVoice = { id: string; name: string; category?: string | null }
export type AudioTask = 'voice' | 'audio'

export async function listElevenLabsVoices(profile: ProviderProfile): Promise<ElevenLabsVoice[]> {
  if (isTauri()) return invoke<ElevenLabsVoice[]>('list_elevenlabs_voices', { profileId: profile.id, baseUrl: profile.baseUrl })
  const key = getSessionKey(profile.id)
  if (!key) throw new Error('Vuelve a cargar los modelos e introduce la clave API en esta sesión.')
  const root = profile.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
  const response = await fetch(`${root}/v2/voices?page_size=100`, { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`ElevenLabs respondió con HTTP ${response.status}.`)
  const body = await response.json() as { voices?: { voice_id: string; name: string; category?: string }[] }
  return (body.voices ?? []).map((voice) => ({ id: voice.voice_id, name: voice.name, category: voice.category }))
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const block = 0x8000
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + block, bytes.length)))
  }
  return btoa(binary)
}

export async function generateElevenLabsAudio(input: {
  profile: ProviderProfile
  modelId: string
  task: AudioTask
  text: string
  voiceId?: string
  durationSeconds?: number
}): Promise<string> {
  const { profile, modelId, task, text, voiceId, durationSeconds } = input
  if (isTauri()) return invoke<string>('generate_elevenlabs_audio', {
    request: { profileId: profile.id, baseUrl: profile.baseUrl, modelId, task, text, voiceId: voiceId ?? null, durationSeconds: durationSeconds ?? null },
  })

  const key = getSessionKey(profile.id)
  if (!key) throw new Error('Vuelve a cargar los modelos e introduce la clave API en esta sesión.')
  const base = profile.baseUrl.replace(/\/+$/, '')
  const endpoint = task === 'voice'
    ? `${base}/text-to-speech/${encodeURIComponent(voiceId ?? '')}?output_format=mp3_44100_128`
    : `${base}/sound-generation?output_format=mp3_44100_128`
  const payload: Record<string, unknown> = { text, model_id: modelId }
  if (task === 'audio' && durationSeconds) payload.duration_seconds = durationSeconds
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(90_000),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string; message?: string } | null
    throw new Error(body?.detail || body?.message || `ElevenLabs respondió con HTTP ${response.status}.`)
  }
  return bytesToBase64(new Uint8Array(await response.arrayBuffer()))
}
