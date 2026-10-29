/// <reference lib="webworker" />

type WhisperChunk = {
  text: string
  timestamp: [number, number | null]
}

type WhisperOutput = {
  text?: string
  chunks?: WhisperChunk[]
}

type WhisperCallable = (
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<WhisperOutput | WhisperOutput[]>

export type WorkerTranscribeRequest = {
  type: 'transcribe'
  jobId: string
  audio16k: Float32Array
  clipOffsetSeconds: number
  language: 'spanish' | 'english' | 'auto'
}

export type WorkerCancelRequest = {
  type: 'cancel'
  jobId: string
}

export type WorkerIncomingMessage = WorkerTranscribeRequest | WorkerCancelRequest

export type WorkerCaptionItem = {
  start: number
  duration: number
  text: string
}

export type WorkerOutgoingMessage =
  | { type: 'progress'; jobId: string; status: string }
  | { type: 'partial'; jobId: string; captions: WorkerCaptionItem[] }
  | { type: 'done'; jobId: string; captions: WorkerCaptionItem[] }
  | { type: 'error'; jobId: string; message: string }

let transcriberPromise: Promise<WhisperCallable> | null = null
let cancelledJobId: string | null = null

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
    // 1. Check if there is a natural punctuation break (.,;?!:) between i+2 and i+maxWords
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
      // 2. Avoid ending a phrase on a dangling preposition/article/connector ("de", "que", "y", "el", etc.)
      while (end > i + 2 && isTrailingConnector(words[end - 1])) {
        end--
      }
    }

    phrases.push(words.slice(i, end).join(' '))
    i = end
  }
  return phrases
}

function splitChunkIntoCaptions(
  rawText: string,
  chunkStartSec: number,
  chunkEndSec: number,
  clipOffsetSeconds: number,
): WorkerCaptionItem[] {
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
  const results: WorkerCaptionItem[] = []
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

function formatSec(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function getTranscriber(jobId: string): Promise<WhisperCallable> {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.allowLocalModels = false
      env.useBrowserCache = true
      if (env.backends?.onnx?.wasm) {
        // Inside a dedicated Web Worker, 1 thread avoids nested SharedArrayBuffer lockups
        env.backends.onnx.wasm.numThreads = 1
      }

      const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator
      const createPipeline = async (device: 'webgpu' | 'wasm') =>
        pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
          dtype: 'q8',
          device,
          progress_callback: (info: { status?: string; progress?: number }) => {
            if (info.status === 'progress' && typeof info.progress === 'number') {
              self.postMessage({
                type: 'progress',
                jobId,
                status: `Descargando modelo Whisper IA (${Math.round(info.progress)}%)…`,
              } satisfies WorkerOutgoingMessage)
            }
          },
        })

      try {
        if (hasWebGpu) {
          return (await createPipeline('webgpu')) as unknown as WhisperCallable
        }
      } catch {
        // Fallback to WASM inside the worker
      }
      return (await createPipeline('wasm')) as unknown as WhisperCallable
    })().catch((err) => {
      transcriberPromise = null
      throw err
    })
  }
  return transcriberPromise
}

self.onmessage = async (event: MessageEvent<WorkerIncomingMessage>) => {
  const msg = event.data
  if (!msg) return

  if (msg.type === 'cancel') {
    cancelledJobId = msg.jobId
    return
  }

  if (msg.type === 'transcribe') {
    const { jobId, audio16k, clipOffsetSeconds, language } = msg
    cancelledJobId = null

    try {
      self.postMessage({
        type: 'progress',
        jobId,
        status: 'Iniciando motor de voz en segundo plano…',
      } satisfies WorkerOutgoingMessage)

      const transcriber = await getTranscriber(jobId)
      const totalSec = audio16k.length / 16000
      const windowSec = 15 // 15s windows for fast incremental streaming
      const windowSamples = windowSec * 16000
      const allCaptions: WorkerCaptionItem[] = []

      for (let offsetSample = 0; offsetSample < audio16k.length; offsetSample += windowSamples) {
        if (cancelledJobId === jobId) return

        const slice = audio16k.subarray(
          offsetSample,
          Math.min(audio16k.length, offsetSample + windowSamples),
        )
        const windowStartSec = offsetSample / 16000
        const windowDurSec = slice.length / 16000
        if (windowDurSec < 0.35) break

        // Fast energy check to skip silent windows in 0ms
        let sumSq = 0
        let count = 0
        for (let i = 0; i < slice.length; i += 32) {
          const v = slice[i]
          sumSq += v * v
          count++
        }
        const rms = Math.sqrt(sumSq / Math.max(1, count))
        if (rms < 0.0025) continue

        self.postMessage({
          type: 'progress',
          jobId,
          status: `Transcribiendo voz (${formatSec(windowStartSec)} / ${formatSec(totalSec)})…`,
        } satisfies WorkerOutgoingMessage)

        const rawResult = await transcriber(slice, {
          language: language === 'auto' ? undefined : language,
          task: 'transcribe',
          return_timestamps: true,
          chunk_length_s: 15,
          stride_length_s: 2,
        })

        if (cancelledJobId === jobId) return

        const result = Array.isArray(rawResult) ? rawResult[0] : rawResult
        const windowCaptions: WorkerCaptionItem[] = []

        if (result?.chunks && result.chunks.length > 0) {
          for (const chunk of result.chunks) {
            const cStart = Number(chunk.timestamp?.[0] ?? 0)
            const cEnd =
              chunk.timestamp?.[1] !== null && chunk.timestamp?.[1] !== undefined
                ? Number(chunk.timestamp[1])
                : Math.min(windowDurSec, cStart + 2.6)
            windowCaptions.push(
              ...splitChunkIntoCaptions(
                chunk.text,
                windowStartSec + cStart,
                windowStartSec + cEnd,
                clipOffsetSeconds,
              ),
            )
          }
        } else if (result?.text?.trim()) {
          windowCaptions.push(
            ...splitChunkIntoCaptions(
              result.text,
              windowStartSec,
              windowStartSec + windowDurSec,
              clipOffsetSeconds,
            ),
          )
        }

        if (windowCaptions.length > 0) {
          allCaptions.push(...windowCaptions)
          // Stream partial captions immediately so the timeline updates in real time!
          self.postMessage({
            type: 'partial',
            jobId,
            captions: [...allCaptions],
          } satisfies WorkerOutgoingMessage)
        }
      }

      self.postMessage({
        type: 'done',
        jobId,
        captions: allCaptions,
      } satisfies WorkerOutgoingMessage)
    } catch (error) {
      self.postMessage({
        type: 'error',
        jobId,
        message: error instanceof Error ? error.message : 'Error en el worker de transcripción',
      } satisfies WorkerOutgoingMessage)
    }
  }
}

