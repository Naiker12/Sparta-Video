const DATABASE = 'sparta-video-media-v1'
const STORE = 'files'
const PREVIEWS = 'previews'

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) return Promise.reject(new Error('El almacenamiento local de medios no está disponible.'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      if (!request.result.objectStoreNames.contains(PREVIEWS)) request.result.createObjectStore(PREVIEWS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el almacenamiento de medios.'))
  })
}

export async function storeMediaFile(id: string, file: File): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(file, id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar el medio.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Se canceló el guardado del medio.'))
  }).finally(() => database.close())
}

export const storeImageFile = storeMediaFile

export async function loadMediaBlob(id: string): Promise<Blob | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null
  const database = await openDatabase()
  try {
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(id)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error ?? new Error('No se pudo leer el medio original.'))
    })
    return blob ?? null
  } finally {
    database.close()
  }
}

export async function loadMediaSource(id: string): Promise<string | null> {
  const blob = await loadMediaBlob(id)
  return blob ? URL.createObjectURL(blob) : null
}

export async function storeMediaPreview(id: string, preview: Blob): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PREVIEWS, 'readwrite')
    transaction.objectStore(PREVIEWS).put(preview, id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar la miniatura.'))
  }).finally(() => database.close())
}

export async function loadMediaPreview(id: string): Promise<string | null> {
  const database = await openDatabase()
  try {
    const read = async (storeName: string) => new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(id)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error ?? new Error('No se pudo leer la miniatura.'))
    })
    const previewBlob = await read(PREVIEWS)
    if (previewBlob && previewBlob.size > 0) {
      return URL.createObjectURL(previewBlob)
    }

    // Si no hay miniatura guardada en PREVIEWS, verificar el archivo original en STORE
    const originalBlob = await read(STORE)
    if (!originalBlob) return null

    if (originalBlob.type.startsWith('image/')) {
      return URL.createObjectURL(originalBlob)
    }

    // Para archivos de vídeo: generar miniatura inteligente al vuelo y guardarla en caché
    if (originalBlob.type.startsWith('video/') || !originalBlob.type) {
      try {
        const file = new File([originalBlob], 'video-source.mp4', { type: originalBlob.type || 'video/mp4' })
        const generated = await captureVideoThumbnail(file)
        if (generated) {
          await storeMediaPreview(id, generated).catch(() => { })
          return URL.createObjectURL(generated)
        }
      } catch {
        /* fallback silencioso */
      }
    }

    return null
  } finally {
    database.close()
  }
}

export async function removeStoredMedia(id: string): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo quitar el archivo guardado.'))
  }).finally(() => database.close())
}

export async function pruneStoredMedia(keepIds: string[]): Promise<void> {
  const database = await openDatabase()
  const keep = new Set(keepIds)
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([STORE, PREVIEWS], 'readwrite')
    for (const name of [STORE, PREVIEWS]) {
      const store = transaction.objectStore(name)
      const request = store.getAllKeys()
      request.onsuccess = () => request.result.forEach((key) => { if (typeof key === 'string' && !keep.has(key)) store.delete(key) })
      request.onerror = () => reject(request.error ?? new Error('No se pudo limpiar la caché local.'))
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo limpiar la caché local.'))
  }).finally(() => database.close())
}

export async function captureVideoThumbnail(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  // Contenedor temporal en el DOM para que el compositor GPU decodifique cuadros en WebView2 / Chromium
  const container = typeof document !== 'undefined' ? document.createElement('div') : null
  if (container) {
    container.style.cssText = 'position:fixed;bottom:-9999px;right:-9999px;width:320px;height:180px;opacity:0.01;pointer-events:none;'
    container.appendChild(video)
    document.body.appendChild(container)
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('El video tardó demasiado en abrirse.')), 14_000)
      const finish = () => { window.clearTimeout(timeout); resolve() }
      video.onerror = () => { window.clearTimeout(timeout); reject(new Error('No se pudo leer un fotograma del video.')) }

      const onMetadata = () => {
        // Buscar un segundo representativo (evitar el fade-in negro de los primeros 0-1.5s)
        const dur = Number.isFinite(video.duration) ? video.duration : 0
        const targetTime = dur > 3 ? Math.min(Math.max(2.0, dur * 0.12), 6.0) : (dur > 0.5 ? 0.3 : 0)

        if (targetTime === 0) {
          video.onloadeddata = finish
        } else {
          video.onseeked = finish
          video.currentTime = targetTime
        }
      }

      if (video.readyState >= 1) {
        onMetadata()
      } else {
        video.onloadedmetadata = onMetadata
      }
      video.src = url
      video.load()
    })

    if (!video.videoWidth || !video.videoHeight) return null
    const width = Math.min(480, video.videoWidth)
    const height = Math.max(1, Math.round(width * video.videoHeight / video.videoWidth))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null

    context.drawImage(video, 0, 0, width, height)

    // Si el fotograma capturado resulta ser casi negro absoluto (fade-in inicial largo) y el video dura más, buscar más adelante
    try {
      const sampleW = Math.min(64, width)
      const sampleH = Math.min(36, height)
      const imgData = context.getImageData(0, 0, sampleW, sampleH)
      let totalLuma = 0
      const pixelCount = imgData.data.length / 4
      for (let i = 0; i < imgData.data.length; i += 4) {
        totalLuma += 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2]
      }
      const avgLuma = totalLuma / pixelCount

      if (avgLuma < 14 && Number.isFinite(video.duration) && video.duration > 8) {
        const altTime = Math.min(video.duration * 0.28, 12.0)
        await new Promise<void>((res) => {
          video.onseeked = () => res()
          setTimeout(res, 800)
          video.currentTime = altTime
        })
        context.clearRect(0, 0, width, height)
        context.drawImage(video, 0, 0, width, height)
      }
    } catch {
      /* análisis de luminancia opcional */
    }

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  } catch {
    return null
  } finally {
    video.pause()
    video.removeAttribute('src')
    try { video.load() } catch { /* ignore */ }
    if (container) container.remove()
    URL.revokeObjectURL(url)
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif', bmp: 'image/bmp', gif: 'image/gif', heic: 'image/heic', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', tif: 'image/tiff', tiff: 'image/tiff', webp: 'image/webp',
  aac: 'audio/aac', flac: 'audio/flac', m4a: 'audio/mp4', mp3: 'audio/mpeg', oga: 'audio/ogg', ogg: 'audio/ogg', wav: 'audio/wav',
  avi: 'video/x-msvideo', m4v: 'video/x-m4v', mkv: 'video/x-matroska', mov: 'video/quicktime', mp4: 'video/mp4', mpeg: 'video/mpeg', mpg: 'video/mpeg', webm: 'video/webm',
}

export function getMediaMimeType(file: File): string {
  return getMediaMimeTypeFromName(file.name) || file.type
}

export function getMediaMimeTypeFromName(name: string): string {
  const extension = name.split('.').at(-1)?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ?? ''
}

export function getMediaTypeFromName(name: string): 'video' | 'audio' | 'image' | null {
  const mime = getMediaMimeTypeFromName(name)
  return mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : null
}

export function formatMediaDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'
  const totalSeconds = Math.max(1, Math.round(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function parseDurationFromDetail(detail?: string): number | null {
  if (!detail) return null
  const hmsMatch = detail.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/)
  if (hmsMatch) {
    const h = Number(hmsMatch[1])
    const m = Number(hmsMatch[2])
    const s = Number(hmsMatch[3])
    const total = h * 3600 + m * 60 + s
    return total > 0 ? total : null
  }
  const msMatch = detail.match(/\b(\d{1,2}):(\d{2})\b/)
  if (msMatch) {
    const m = Number(msMatch[1])
    const s = Number(msMatch[2])
    const total = m * 60 + s
    return total > 0 ? total : null
  }
  return null
}

export type ProbedMediaMetadata = {
  duration: number | null
  width?: number
  height?: number
}

export async function probeMediaMetadata(
  fileOrBlob: Blob,
  type?: 'video' | 'audio' | 'image',
): Promise<ProbedMediaMetadata> {
  const resolvedType =
    type ??
    (fileOrBlob.type.startsWith('image/')
      ? 'image'
      : fileOrBlob.type.startsWith('audio/')
        ? 'audio'
        : 'video')

  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return { duration: null }
  }

  if (resolvedType === 'image') {
    const url = URL.createObjectURL(fileOrBlob)
    try {
      const dim = await new Promise<{ width: number; height: number } | null>((res) => {
        const img = new Image()
        img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => res(null)
        img.src = url
      })
      return { duration: null, width: dim?.width, height: dim?.height }
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const url = URL.createObjectURL(fileOrBlob)
  const element = document.createElement(resolvedType === 'audio' ? 'audio' : 'video')
  element.muted = true
  element.preload = 'metadata'
  if (element instanceof HTMLVideoElement) {
    element.playsInline = true
  }

  const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
  const timeoutMs = isJsdom ? 60 : 10_000

  try {
    let capturedWidth: number | undefined
    let capturedHeight: number | undefined

    const duration = await new Promise<number | null>((resolve) => {
      let settled = false
      const finish = (value: number | null) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(value && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null)
      }
      const timer = window.setTimeout(() => finish(null), timeoutMs)
      element.onerror = () => finish(null)
      element.onloadedmetadata = () => {
        if (element instanceof HTMLVideoElement && element.videoWidth && element.videoHeight) {
          capturedWidth = element.videoWidth
          capturedHeight = element.videoHeight
        }
        if (Number.isFinite(element.duration) && element.duration > 0) {
          finish(element.duration)
          return
        }
        if (element.duration === Infinity) {
          element.ontimeupdate = () => {
            element.ontimeupdate = null
            const resolved = element.duration
            try { element.currentTime = 0 } catch { /* ignore */ }
            finish(resolved)
          }
          element.ondurationchange = () => {
            if (Number.isFinite(element.duration) && element.duration > 0) {
              finish(element.duration)
            }
          }
          try {
            element.currentTime = 1e101
          } catch {
            finish(null)
          }
          return
        }
        finish(null)
      }
      element.src = url
      try { element.load() } catch { finish(null) }
    })
    return { duration, width: capturedWidth, height: capturedHeight }
  } finally {
    try {
      element.pause()
      element.removeAttribute('src')
      element.load()
    } catch { /* ignore */ }
    URL.revokeObjectURL(url)
  }
}

export async function probeMediaDuration(
  fileOrBlob: Blob,
  type?: 'video' | 'audio' | 'image',
): Promise<number | null> {
  const result = await probeMediaMetadata(fileOrBlob, type)
  return result.duration
}
