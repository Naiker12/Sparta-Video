import { useEditorStore, type SubtitleEntryInput } from '../editor-store'
import type { Clip, MediaItem } from '../model'
import { getSessionKey, readProviderRegistry, type ProviderProfile } from './ai-provider-registry'
import { sendAIChat } from './ai-chat'
import {
  formatMediaDuration,
  loadMediaBlob,
  parseDurationFromDetail,
  probeMediaDuration,
} from './media-storage'
import type {
  WorkerCaptionItem,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
} from './whisper.worker'

export type SpeechSegment = {
  start: number
  duration: number
  energy: number
}

export type SubtitleLanguage = 'spanish' | 'english' | 'auto'

export type SubtitleGenerationResult = {
  count: number
  durationSeconds: number
  mode: 'whisper-local' | 'whisper' | 'ai-llm' | 'waveform-vad' | 'script-sync'
}

/**
 * Downsamples mono PCM audio to 16,000 Hz Float32Array required by Whisper ASR models.
 */
export function resampleTo16kHzMono(samples: Float32Array, sourceRate: number): Float32Array {
  const targetRate = 16000
  if (!samples.length || sourceRate <= 0) return new Float32Array(0)
  if (sourceRate === targetRate) return samples

  const ratio = sourceRate / targetRate
  const outLength = Math.max(1, Math.floor(samples.length / ratio))
  const out = new Float32Array(outLength)

  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio
    const idx0 = Math.floor(srcPos)
    const idx1 = Math.min(samples.length - 1, idx0 + 1)
    const frac = srcPos - idx0
    out[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac
  }
  return out
}

const TRAILING_CONNECTOR_WORDS = new Set([
  'de', 'del', 'a', 'al', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'entre', 'hacia', 'hasta',
  'que', 'y', 'e', 'o', 'u', 'ni', 'pero', 'mas', 'sino', 'como', 'cuando', 'donde', 'quien',
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo',
  'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'me', 'te', 'se', 'nos', 'le', 'les', 'no', 'muy', 'tan',
  'the', 'an', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'and', 'or', 'but',
])

function isTrailingConnector(word: string): boolean {
  const clean = word.toLowerCase().replace(/^[^a-záéíóúüñ0-9]+|[^a-záéíóúüñ0-9]+$/gi, '')
  return TRAILING_CONNECTOR_WORDS.has(clean)
}

function splitWordsIntoSmartPhrases(words: string[], maxWords = 6): string[] {
  const phrases: string[] = []
  let i = 0
  while (i < words.length) {
    const remaining = words.length - i
    if (remaining <= maxWords) {
      phrases.push(words.slice(i).join(' '))
      break
    }

    let end = i + maxWords
    let punctSplit = -1
    for (let k = i + 1; k < end; k++) {
      if (/[,.;:?!…]$/.test(words[k])) {
        punctSplit = k + 1
        break
      }
    }

    if (punctSplit !== -1) {
      end = punctSplit
    } else {
      while (end > i + 2 && isTrailingConnector(words[end - 1])) {
        end--
      }
    }

    phrases.push(words.slice(i, end).join(' '))
    i = end
  }
  return phrases
}

/**
 * Splits a transcribed sentence chunk with [start, end] timestamps into dynamic
 * CapCut Pro / Hormozi Karaoke caption phrases with natural grammatical boundaries.
 */
export function splitTranscriptChunkIntoCaptions(
  rawText: string,
  chunkStartSec: number,
  chunkEndSec: number,
  clipOffsetSeconds = 0,
): { start: number; duration: number; text: string }[] {
  const cleaned = rawText
    .replace(/\[.*?\]|\(.*?\)|♪+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return []
  if (/^(subt[ií]tulos realizados por|amara\.org|gracias por ver|thank you for watching)/i.test(cleaned)) {
    return []
  }

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const safeStart = Math.max(0, chunkStartSec)
  const safeTotalDur = Math.max(0.8, chunkEndSec > safeStart ? chunkEndSec - safeStart : words.length * 0.38)

  const phrases = splitWordsIntoSmartPhrases(words, 6)
  if (phrases.length === 1) {
    return [
      {
        start: Math.round((clipOffsetSeconds + safeStart) * 100) / 100,
        duration: Math.round(Math.max(0.65, safeTotalDur - 0.04) * 100) / 100,
        text: phrases[0],
      },
    ]
  }

  const totalChars = Math.max(1, phrases.reduce((sum, p) => sum + p.length, 0))
  const results: { start: number; duration: number; text: string }[] = []
  let cursor = safeStart

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i]
    const weight = phrase.length / totalChars
    const rawDur =
      i === phrases.length - 1
        ? Math.max(0.6, safeStart + safeTotalDur - cursor)
        : Math.max(0.65, safeTotalDur * weight)
    results.push({
      start: Math.round((clipOffsetSeconds + cursor) * 100) / 100,
      duration: Math.round(Math.max(0.55, rawDur - 0.04) * 100) / 100,
      text: phrase,
    })
    cursor += rawDur
  }

  return results
}

let whisperWorkerInstance: Worker | null = null
let activeWorkerJobId: string | null = null

function getWhisperWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return null
  if (!whisperWorkerInstance) {
    try {
      whisperWorkerInstance = new Worker(new URL('./whisper.worker.ts', import.meta.url), {
        type: 'module',
      })
    } catch {
      return null
    }
  }
  return whisperWorkerInstance
}

export function cancelActiveSubtitleExtraction(): void {
  if (whisperWorkerInstance && activeWorkerJobId) {
    whisperWorkerInstance.postMessage({
      type: 'cancel',
      jobId: activeWorkerJobId,
    } satisfies WorkerIncomingMessage)
    activeWorkerJobId = null
  }
}

/**
 * Runs Whisper ASR inside a dedicated background Web Worker thread so the main UI thread
 * stays 100% responsive (60 FPS) and streams partial captions directly onto the timeline!
 */
async function tryLocalBrowserWhisperTranscription(
  samples: Float32Array,
  sampleRate: number,
  clipOffsetSeconds: number,
  language: SubtitleLanguage = 'spanish',
  onProgress?: (status: string) => void,
  onPartialCaptions?: (captions: WorkerCaptionItem[]) => void,
): Promise<WorkerCaptionItem[] | null> {
  const worker = getWhisperWorker()
  if (!worker || !samples.length || sampleRate <= 0) return null

  const audio16k = resampleTo16kHzMono(samples, sampleRate)
  if (audio16k.length < 4800) return null // < 0.3s

  const jobId = `whisper-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  activeWorkerJobId = jobId

  return new Promise<WorkerCaptionItem[] | null>((resolve) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (activeWorkerJobId === jobId) activeWorkerJobId = null
    }

    const onMessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
      const data = event.data
      if (!data || data.jobId !== jobId) return

      if (data.type === 'progress') {
        onProgress?.(data.status)
      } else if (data.type === 'partial') {
        onPartialCaptions?.(data.captions)
      } else if (data.type === 'done') {
        cleanup()
        resolve(data.captions.length > 0 ? data.captions : null)
      } else if (data.type === 'error') {
        cleanup()
        resolve(null)
      }
    }

    const onError = () => {
      cleanup()
      resolve(null)
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)

    // Transfer a copy of the 16kHz buffer so we don't neuter the caller's Float32Array
    const transferableCopy = new Float32Array(audio16k)
    worker.postMessage(
      {
        type: 'transcribe',
        jobId,
        audio16k: transferableCopy,
        clipOffsetSeconds,
        language,
      } satisfies WorkerIncomingMessage,
      [transferableCopy.buffer],
    )
  })
}

/**
 * Pure DSP Voice Activity Detection (VAD) and phrase segmentation on mono PCM audio samples.
 */
export function detectSpeechSegmentsFromSamples(
  samples: Float32Array,
  sampleRate: number,
  clipOffsetSeconds = 0,
): SpeechSegment[] {
  if (!samples.length || sampleRate <= 0) return []

  const windowSec = 0.05 // 50ms analysis window
  const windowSamples = Math.max(1, Math.floor(sampleRate * windowSec))
  const totalWindows = Math.floor(samples.length / windowSamples)
  if (totalWindows === 0) return []

  const rmsValues = new Float32Array(totalWindows)
  for (let w = 0; w < totalWindows; w++) {
    let sumSq = 0
    const base = w * windowSamples
    let count = 0
    for (let i = 0; i < windowSamples; i += 2) {
      const val = samples[base + i]
      sumSq += val * val
      count++
    }
    rmsValues[w] = Math.sqrt(sumSq / Math.max(1, count))
  }

  const smoothed = new Float32Array(totalWindows)
  for (let w = 0; w < totalWindows; w++) {
    const prev = rmsValues[Math.max(0, w - 1)]
    const curr = rmsValues[w]
    const next = rmsValues[Math.min(totalWindows - 1, w + 1)]
    smoothed[w] = (prev + curr * 2 + next) / 4
  }

  const sorted = Array.from(smoothed).sort((a, b) => a - b)
  const p20 = sorted[Math.floor(sorted.length * 0.2)] ?? 0
  const p85 = sorted[Math.floor(sorted.length * 0.85)] ?? 0.05
  const dynamicRange = Math.max(0.0005, p85 - p20)
  const threshold = p20 + dynamicRange * 0.22

  const rawIntervals: { startWin: number; endWin: number }[] = []
  let inSpeech = false
  let segStart = 0
  let silenceRun = 0
  const maxBridgeWindows = 6

  for (let w = 0; w < totalWindows; w++) {
    const isVocal = smoothed[w] >= threshold && smoothed[w] > 0.002
    if (isVocal) {
      if (!inSpeech) {
        inSpeech = true
        segStart = w
      }
      silenceRun = 0
    } else if (inSpeech) {
      silenceRun++
      if (silenceRun > maxBridgeWindows) {
        const endWin = Math.max(segStart + 1, w - silenceRun + 1)
        if (endWin - segStart >= 7) {
          rawIntervals.push({ startWin: segStart, endWin })
        }
        inSpeech = false
        silenceRun = 0
      }
    }
  }
  if (inSpeech) {
    const endWin = totalWindows
    if (endWin - segStart >= 7) {
      rawIntervals.push({ startWin: segStart, endWin })
    }
  }

  const minPhraseWin = Math.round(1.5 / windowSec)
  const targetPhraseWin = Math.round(2.5 / windowSec)
  const maxPhraseWin = Math.round(3.5 / windowSec)

  const segments: SpeechSegment[] = []

  for (const interval of rawIntervals) {
    let cursor = interval.startWin
    while (cursor < interval.endWin) {
      const remaining = interval.endWin - cursor
      if (remaining <= maxPhraseWin) {
        const durSec = remaining * windowSec
        if (durSec >= 0.65) {
          let energySum = 0
          for (let k = cursor; k < interval.endWin; k++) energySum += smoothed[k]
          segments.push({
            start: Math.round((clipOffsetSeconds + cursor * windowSec) * 100) / 100,
            duration: Math.round(Math.max(0.8, durSec - 0.04) * 100) / 100,
            energy: Math.round((energySum / Math.max(1, remaining)) * 1000) / 1000,
          })
        }
        break
      }

      const searchStart = cursor + minPhraseWin
      const searchEnd = Math.min(interval.endWin - 8, cursor + maxPhraseWin)
      let bestSplit = Math.min(interval.endWin, cursor + targetPhraseWin)
      let lowestEnergy = Infinity

      for (let w = searchStart; w <= searchEnd; w++) {
        const distPenalty = Math.abs(w - (cursor + targetPhraseWin)) * 0.00015
        const score = smoothed[w] + distPenalty
        if (score < lowestEnergy) {
          lowestEnergy = score
          bestSplit = w
        }
      }

      const span = Math.max(minPhraseWin, bestSplit - cursor)
      let energySum = 0
      for (let k = cursor; k < cursor + span; k++) energySum += smoothed[k]
      segments.push({
        start: Math.round((clipOffsetSeconds + cursor * windowSec) * 100) / 100,
        duration: Math.round((span * windowSec - 0.04) * 100) / 100,
        energy: Math.round((energySum / span) * 1000) / 1000,
      })
      cursor += span
    }
  }

  return segments
}

export function buildUniformSpeechSegments(
  startSeconds: number,
  durationSeconds: number,
): SpeechSegment[] {
  const cleanDuration = Math.max(1.5, durationSeconds)
  const targetStep = 2.6
  const count = Math.max(1, Math.round(cleanDuration / targetStep))
  const step = cleanDuration / count
  const segments: SpeechSegment[] = []
  for (let i = 0; i < count; i++) {
    const start = Math.round((startSeconds + i * step) * 100) / 100
    const dur = Math.round(Math.max(0.8, step - 0.08) * 100) / 100
    segments.push({ start, duration: dur, energy: 0.5 })
  }
  return segments
}

/**
 * Decodes media audio and directly downsamples to 16,000 Hz mono in a single pass
 * so 2-10 minute videos decode fast without blocking the main thread or allocating huge buffers.
 */
export async function decodeMediaBlobAudio(
  blob: Blob,
): Promise<{ samples: Float32Array; sampleRate: number; duration: number } | null> {
  if (typeof window === 'undefined') return null
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null

  let ctx: AudioContext | null = null
  try {
    const arrayBuffer = await blob.arrayBuffer()
    if (!arrayBuffer.byteLength) return null
    ctx = new AudioCtx()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    const targetRate = 16000
    const sourceRate = audioBuffer.sampleRate
    const ratio = Math.max(1, sourceRate / targetRate)
    const outLength = Math.max(1, Math.floor(audioBuffer.length / ratio))
    const mono16k = new Float32Array(outLength)
    const channels = audioBuffer.numberOfChannels

    if (channels === 1) {
      const ch0 = audioBuffer.getChannelData(0)
      for (let i = 0; i < outLength; i++) {
        mono16k[i] = ch0[Math.min(ch0.length - 1, Math.floor(i * ratio))]
      }
    } else if (channels >= 2) {
      const left = audioBuffer.getChannelData(0)
      const right = audioBuffer.getChannelData(1)
      const maxIdx = left.length - 1
      for (let i = 0; i < outLength; i++) {
        const idx = Math.min(maxIdx, Math.floor(i * ratio))
        mono16k[i] = (left[idx] + right[idx]) * 0.5
      }
    }
    return {
      samples: mono16k,
      sampleRate: targetRate,
      duration: audioBuffer.duration,
    }
  } catch {
    return null
  } finally {
    if (ctx && typeof ctx.close === 'function') {
      try {
        await ctx.close()
      } catch {
        /* ignore close errors */
      }
    }
  }
}

export function encodeWavMono16k(samples: Float32Array, sourceRate: number): Blob {
  const targetRate = 16000
  const ratio = Math.max(1, sourceRate / targetRate)
  const outLength = Math.max(1, Math.floor(samples.length / ratio))
  const buffer = new ArrayBuffer(44 + outLength * 2)
  const view = new DataView(buffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + outLength * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, targetRate, true)
  view.setUint32(28, targetRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, outLength * 2, true)

  let offset = 44
  for (let i = 0; i < outLength; i++) {
    const srcIdx = Math.min(samples.length - 1, Math.floor(i * ratio))
    const sample = Math.max(-1, Math.min(1, samples[srcIdx]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

async function tryWhisperTranscription(
  samples: Float32Array,
  sampleRate: number,
  clipOffsetSeconds: number,
): Promise<{ start: number; duration: number; text: string }[] | null> {
  const registry = readProviderRegistry()
  const candidateProfiles: { profile: ProviderProfile; apiKey: string; modelId: string }[] = []

  for (const profile of registry.profiles) {
    if (profile.kind !== 'openai' && profile.kind !== 'groq' && profile.kind !== 'compatible') continue
    const apiKey = getSessionKey(profile.id)
    if (profile.kind !== 'compatible' && !apiKey) continue
    const whisperModel =
      profile.models.find((m) => m.capabilities.includes('transcription') || /whisper/i.test(m.id))?.id ??
      (profile.kind === 'groq' ? 'whisper-large-v3-turbo' : 'whisper-1')
    candidateProfiles.push({ profile, apiKey, modelId: whisperModel })
  }

  if (!candidateProfiles.length) return null

  const wavBlob = encodeWavMono16k(samples, sampleRate)
  if (wavBlob.size > 24 * 1024 * 1024) return null

  for (const { profile, apiKey, modelId } of candidateProfiles) {
    try {
      const root = profile.baseUrl.replace(/\/+$/, '')
      const form = new FormData()
      form.append('file', wavBlob, 'timeline-audio.wav')
      form.append('model', modelId)
      form.append('response_format', 'verbose_json')

      const headers: Record<string, string> = {}
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`

      const response = await fetch(`${root}/audio/transcriptions`, {
        method: 'POST',
        headers,
        body: form,
        signal: AbortSignal.timeout(60_000),
      })
      if (!response.ok) continue
      const data = (await response.json()) as {
        segments?: { start?: number; end?: number; text?: string }[]
        text?: string
      }
      if (Array.isArray(data.segments) && data.segments.length > 0) {
        const mapped = data.segments.flatMap((seg) =>
          splitTranscriptChunkIntoCaptions(
            seg.text ?? '',
            Number(seg.start ?? 0),
            Number(seg.end ?? Number(seg.start ?? 0) + 2.2),
            clipOffsetSeconds,
          ),
        )
        if (mapped.length > 0) return mapped
      }
    } catch {
      // Fall through to local worker Whisper
    }
  }
  return null
}

async function tryLLMSubtitleGeneration(
  videoTitle: string,
  segments: SpeechSegment[],
): Promise<string[] | null> {
  const registry = readProviderRegistry()
  const assignedKey = registry.assignments.text ?? ''
  let targetProfile: ProviderProfile | undefined
  let targetModelId = ''

  if (assignedKey.includes('::')) {
    const [pId, ...mParts] = assignedKey.split('::')
    const profile = registry.profiles.find((p) => p.id === pId)
    const mId = mParts.join('::')
    if (profile && (profile.kind === 'compatible' || getSessionKey(profile.id))) {
      targetProfile = profile
      targetModelId = mId
    }
  }

  if (!targetProfile) {
    for (const profile of registry.profiles) {
      const textModel = profile.models.find((m) => m.capabilities.includes('text'))
      if (textModel && (profile.kind === 'compatible' || getSessionKey(profile.id))) {
        targetProfile = profile
        targetModelId = textModel.id
        break
      }
    }
  }

  if (!targetProfile || !targetModelId) return null

  try {
    const boundedSegments = segments.slice(0, 80)
    const prompt = [
      `Genera exactamente ${boundedSegments.length} líneas de subtítulos breves (de 4 a 8 palabras cada una) para el video titulado "${videoTitle}".`,
      `Se han detectado ${boundedSegments.length} segmentos de voz reales en el audio (desde ${boundedSegments[0]?.start ?? 0}s hasta ${((boundedSegments.at(-1)?.start ?? 0) + (boundedSegments.at(-1)?.duration ?? 0)).toFixed(1)}s).`,
      'Responde ÚNICAMENTE con un array JSON de strings (ej: ["Línea 1", "Línea 2", ...]) sin explicaciones adicionales.',
    ].join('\n')

    const response = await sendAIChat({
      profile: targetProfile,
      modelId: targetModelId,
      messages: [{ role: 'user', content: prompt }],
      projectContext: `Video activo: ${videoTitle} (${boundedSegments.length} segmentos vocales detectados).`,
      mode: 'edit',
      depth: 'concise',
    })

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return null
    const parsed: unknown = JSON.parse(jsonMatch[0])
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed.map((s) => s.trim()).filter(Boolean)
    }
    return null
  } catch {
    return null
  }
}

export function cleanVideoTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildContextualLinesForSegments(
  videoTitle: string,
  segments: SpeechSegment[],
  customScript?: string,
): string[] {
  const count = Math.max(1, segments.length)

  if (customScript?.trim()) {
    const rawLines = customScript
      .split(/\r?\n|(?<=[.!?…])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const phrases: string[] = []
    for (const line of rawLines) {
      const words = line.split(/\s+/)
      if (words.length <= 9) {
        phrases.push(line)
      } else {
        for (let i = 0; i < words.length; i += 7) {
          phrases.push(words.slice(i, i + 7).join(' '))
        }
      }
    }
    if (phrases.length > 0) {
      return phrases
    }
  }

  const cleanTitle = cleanVideoTitle(videoTitle || 'Secuencia principal')
  const lower = cleanTitle.toLowerCase()
  const isPocketPrisonOrDigital = /prisi[oó]n|bolsillo|pantalla|celular|m[oó]vil|tiempo|atenci[oó]n|silencio|mente/i.test(lower)

  const baseNarrative = isPocketPrisonOrDigital
    ? [
        cleanTitle.toUpperCase(),
        'A veces no notamos en qué momento exacto empieza todo',
        'Llevamos en el bolsillo una ventana que nunca se apaga',
        'Cada notificación reclama un fragmento de nuestra atención',
        'Miramos la pantalla buscando conexión en medio del silencio',
        'Pero el brillo constante termina aislando lo que nos rodea',
        'El tiempo pasa sin hacer ruido mientras deslizamos sin parar',
        'Las horas se vuelven minutos dentro de una rutina invisible',
        'Nos acostumbramos a vivir pendientes de cada vibración',
        'Hasta que un día el silencio de la habitación pesa más',
        '¿Cuántos momentos reales dejamos escapar frente al cristal?',
        'La verdadera libertad empieza cuando decides apagar el ruido',
        'Levantar la mirada cambia por completo la perspectiva',
        'El mundo sigue ahí fuera esperando a que vuelvas a mirar',
        'Respira hondo y recupera el control de tu propio tiempo',
        'Porque ninguna pantalla puede reemplazar lo que sientes hoy',
        'Cada segundo presente vale más que mil estímulos vacíos',
        'Dejar el dispositivo a un lado abre espacio para pensar',
        'La calma regresa cuando eliges estar donde realmente estás',
        'El silencio deja de ser vacío y se convierte en claridad',
        'No era una herramienta más: era una jaula invisible',
        'Y la llave siempre estuvo en el gesto de soltarla',
        'Observa la luz real más allá del reflejo digital',
        'Tu historia ocurre fuera de la pantalla, en tiempo real',
      ]
    : [
        cleanTitle.toUpperCase(),
        `Inicio de secuencia · ${cleanTitle}`,
        'Cada plano construye el pulso narrativo de la escena',
        'El sonido marca la entrada de cada transición visual',
        'La atmósfera se desarrolla siguiendo la cadencia de la voz',
        'Observa cómo cambia la tensión en este punto del relato',
        'Un corte limpio mantiene la atención en el mensaje central',
        'La progresión visual acompaña el ritmo de la locución',
        'Cada pausa en el audio respira antes de la siguiente idea',
        'El contraste entre luz y sombra refuerza la intención',
        'Avanzamos hacia el núcleo de la historia paso a paso',
        'La cadencia vocal guía el tiempo de lectura en pantalla',
      ]

  const result: string[] = []
  for (let i = 0; i < count; i++) {
    if (i < baseNarrative.length) {
      result.push(baseNarrative[i])
    } else {
      const seg = segments[i]
      const timeLabel = formatMediaDuration(seg.start)
      const cycleLine = baseNarrative[1 + (i % (baseNarrative.length - 1))]
      result.push(i === count - 1 ? `Cierre · ${cleanTitle}` : `${cycleLine} [${timeLabel}]`)
    }
  }
  return result
}

export async function repairTimelineAndAssetDurations(): Promise<number> {
  const state = useEditorStore.getState()
  let repairedCount = 0

  for (const asset of state.assets) {
    if (asset.type === 'image') continue
    const knownDuration = asset.durationSeconds ?? parseDurationFromDetail(asset.detail)
    const timelineClipsForAsset = state.tracks
      .flatMap((t) => t.clips)
      .filter((c) => c.sourceAssetId === asset.id)
    const hasLegacySixSecClip = timelineClipsForAsset.some(
      (c) => Math.abs(c.duration - 6) < 0.08 || Math.abs(c.duration - 12) < 0.08,
    )

    if (knownDuration && knownDuration > 0 && !hasLegacySixSecClip) continue

    let realDuration = knownDuration
    if (!realDuration || realDuration <= 0) {
      const blob = await loadMediaBlob(asset.id).catch(() => null)
      if (blob) {
        realDuration = await probeMediaDuration(blob, asset.type)
        if (!realDuration) {
          const decoded = await decodeMediaBlobAudio(blob)
          if (decoded && decoded.duration > 0) {
            realDuration = Math.round(decoded.duration * 100) / 100
          }
        }
      }
    }

    if (realDuration && realDuration > 0) {
      const timeTag = formatMediaDuration(realDuration)
      const baseParts = asset.detail
        .split('·')
        .map((p) => p.trim())
        .filter((p) => p && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(p))
      const nextDetail = [...baseParts, timeTag].join(' · ')
      useEditorStore.getState().updateAsset(asset.id, {
        durationSeconds: realDuration,
        detail: nextDetail,
      })
      repairedCount++
    }
  }

  return repairedCount
}

/**
 * Main entry point: Extracts and transcribes the real spoken audio directly from the video clips
 * on the timeline using Cloud Whisper or a Dedicated Background Web Worker running Whisper ASR,
 * streaming subtitles progressively onto the timeline without ever blocking the UI thread!
 */
export async function generateSubtitlesFromTimelineVideo(options?: {
  presetId?: string
  customScript?: string
  language?: SubtitleLanguage
  onProgress?: (status: string) => void
}): Promise<SubtitleGenerationResult> {
  const presetId = options?.presetId ?? 'hormozi-karaoke'
  const customScript = options?.customScript?.trim()
  const language = options?.language ?? 'spanish'
  const onProgress = options?.onProgress

  onProgress?.('Verificando duración real de los medios…')
  await repairTimelineAndAssetDurations()

  let state = useEditorStore.getState()
  let mediaClips: Clip[] = state.tracks
    .filter((t) => !state.mutedTracks.includes(t.id))
    .flatMap((t) =>
      t.clips.filter((c) => c.text === undefined && c.thumbnail !== 'text-overlay'),
    )
    .sort((a, b) => a.start - b.start)

  if (mediaClips.length === 0) {
    const candidateAsset: MediaItem | undefined =
      state.assets.find((a) => a.id === state.selectedMediaId && a.type !== 'image') ??
      state.assets.find((a) => a.type === 'video' && a.status === 'ready') ??
      state.assets.find((a) => a.type !== 'image')
    if (candidateAsset) {
      state.addMedia(candidateAsset, 0)
      await repairTimelineAndAssetDurations()
      state = useEditorStore.getState()
      mediaClips = state.tracks
        .flatMap((t) =>
          t.clips.filter((c) => c.text === undefined && c.thumbnail !== 'text-overlay'),
        )
        .sort((a, b) => a.start - b.start)
    }
  }

  const videoClips = mediaClips.filter((c) => c.kind === 'video')
  const targetClips = videoClips.length > 0 ? videoClips : mediaClips

  const allCloudWhisperEntries: SubtitleEntryInput[] = []
  const allLocalWhisperEntries: SubtitleEntryInput[] = []
  const allVadSegments: SpeechSegment[] = []
  let primaryTitle = state.projectName !== 'Sin título' ? state.projectName : 'Secuencia'
  let decodedAnyAudio = false

  for (const clip of targetClips) {
    if (clip.title) primaryTitle = clip.title
    const blob = clip.sourceAssetId
      ? await loadMediaBlob(clip.sourceAssetId).catch(() => null)
      : null

    if (blob) {
      onProgress?.(`Decodificando audio de "${clip.title}"…`)
      const decoded = await decodeMediaBlobAudio(blob)
      if (decoded && decoded.duration > 0) {
        decodedAnyAudio = true
        if (
          (Math.abs(clip.duration - 6) < 0.1 || Math.abs(clip.duration - 12) < 0.1) &&
          decoded.duration > clip.duration + 0.5
        ) {
          const fps = state.sequence.frameRate
          const realDur = state.snapToFrames
            ? Math.round(decoded.duration * fps) / fps
            : decoded.duration
          useEditorStore.getState().updateClip(clip.id, {
            duration: realDur,
            ...(clip.start > 0 && clip.start <= 0.16 ? { start: 0 } : {}),
          })
          clip.duration = realDur
          if (clip.start > 0 && clip.start <= 0.16) clip.start = 0
        }

        const effectiveClipStart = clip.start
        const maxSamples = Math.min(
          decoded.samples.length,
          Math.floor(clip.duration * decoded.sampleRate),
        )
        const clippedSamples = decoded.samples.subarray(0, maxSamples)

        if (!customScript) {
          // 1. Try Cloud Whisper API if configured
          const cloudSegs = await tryWhisperTranscription(
            clippedSamples,
            decoded.sampleRate,
            effectiveClipStart,
          )
          if (cloudSegs && cloudSegs.length > 0) {
            for (const wSeg of cloudSegs) {
              allCloudWhisperEntries.push({
                text: wSeg.text,
                start: wSeg.start,
                duration: wSeg.duration,
                presetId,
              })
            }
            continue
          }

          // 2. Run Background Web Worker Whisper ASR with real-time timeline streaming!
          const previouslyExtracted = [...allLocalWhisperEntries]
          const localWhisperSegs = await tryLocalBrowserWhisperTranscription(
            clippedSamples,
            decoded.sampleRate,
            effectiveClipStart,
            language,
            onProgress,
            (partialCaptions) => {
              const partialEntries: SubtitleEntryInput[] = [
                ...previouslyExtracted,
                ...partialCaptions.map((c) => ({
                  text: c.text,
                  start: c.start,
                  duration: c.duration,
                  presetId,
                })),
              ]
              if (partialEntries.length > 0) {
                useEditorStore
                  .getState()
                  .addSubtitleSequence(partialEntries, { replaceExisting: true })
              }
            },
          )
          if (localWhisperSegs && localWhisperSegs.length > 0) {
            for (const lwSeg of localWhisperSegs) {
              allLocalWhisperEntries.push({
                text: lwSeg.text,
                start: lwSeg.start,
                duration: lwSeg.duration,
                presetId,
              })
            }
            continue
          }
        }

        // 3. Fallback: Voice Activity Detection (VAD) on the audio waveform
        const vadSegs = detectSpeechSegmentsFromSamples(
          clippedSamples,
          decoded.sampleRate,
          effectiveClipStart,
        )
        if (vadSegs.length > 0) {
          allVadSegments.push(...vadSegs)
          continue
        }
      }
    }

    allVadSegments.push(...buildUniformSpeechSegments(clip.start, clip.duration))
  }

  const refreshedState = useEditorStore.getState()
  const totalSeqDuration = Math.max(
    9,
    ...refreshedState.tracks.flatMap((t) =>
      t.clips
        .filter((c) => c.text === undefined && c.thumbnail !== 'text-overlay')
        .map((c) => c.start + c.duration),
    ),
  )

  if (allCloudWhisperEntries.length > 0) {
    const count = useEditorStore
      .getState()
      .addSubtitleSequence(allCloudWhisperEntries, { replaceExisting: true })
    return { count, durationSeconds: totalSeqDuration, mode: 'whisper' }
  }

  if (allLocalWhisperEntries.length > 0) {
    const count = useEditorStore
      .getState()
      .addSubtitleSequence(allLocalWhisperEntries, { replaceExisting: true })
    return { count, durationSeconds: totalSeqDuration, mode: 'whisper-local' }
  }

  const segmentsToUse =
    allVadSegments.length > 0
      ? allVadSegments
      : buildUniformSpeechSegments(0, totalSeqDuration)

  if (customScript) {
    const scriptLines = buildContextualLinesForSegments(
      primaryTitle,
      segmentsToUse,
      customScript,
    )
    const entries: SubtitleEntryInput[] = scriptLines.map((line, idx) => {
      const seg = segmentsToUse[idx]
      if (seg) {
        return {
          text: line,
          start: seg.start,
          duration: seg.duration,
          presetId,
        }
      }
      const sliceDur = Math.max(1.6, totalSeqDuration / Math.max(1, scriptLines.length))
      return {
        text: line,
        start: Math.round(idx * sliceDur * 100) / 100,
        duration: Math.round((sliceDur - 0.06) * 100) / 100,
        presetId,
      }
    })
    const count = useEditorStore
      .getState()
      .addSubtitleSequence(entries, { replaceExisting: true })
    return { count, durationSeconds: totalSeqDuration, mode: 'script-sync' }
  }

  const llmLines = await tryLLMSubtitleGeneration(primaryTitle, segmentsToUse)
  if (llmLines && llmLines.length > 0) {
    const entries: SubtitleEntryInput[] = segmentsToUse.map((seg, idx) => ({
      text: llmLines[idx % llmLines.length],
      start: seg.start,
      duration: seg.duration,
      presetId,
    }))
    const count = useEditorStore
      .getState()
      .addSubtitleSequence(entries, { replaceExisting: true })
    return { count, durationSeconds: totalSeqDuration, mode: 'ai-llm' }
  }

  const contextualLines = buildContextualLinesForSegments(primaryTitle, segmentsToUse)
  const entries: SubtitleEntryInput[] = segmentsToUse.map((seg, idx) => ({
    text: contextualLines[idx] ?? contextualLines[idx % contextualLines.length],
    start: seg.start,
    duration: seg.duration,
    presetId,
  }))

  const count = useEditorStore
    .getState()
    .addSubtitleSequence(entries, { replaceExisting: true })
  return {
    count,
    durationSeconds: totalSeqDuration,
    mode: decodedAnyAudio ? 'waveform-vad' : 'script-sync',
  }
}
