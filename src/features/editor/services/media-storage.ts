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

export async function loadMediaSource(id: string): Promise<string | null> {
  const database = await openDatabase()
  try {
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(id)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error ?? new Error('No se pudo leer el medio original.'))
    })
    return blob ? URL.createObjectURL(blob) : null
  } finally {
    database.close()
  }
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
    const blob = await read(PREVIEWS) ?? await read(STORE)
    return blob ? URL.createObjectURL(blob) : null
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
  video.preload = 'metadata'
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('El video tardó demasiado en abrirse.')), 12_000)
      const finish = () => { window.clearTimeout(timeout); resolve() }
      video.onerror = () => { window.clearTimeout(timeout); reject(new Error('No se pudo leer un fotograma del video.')) }
      video.onloadedmetadata = () => {
        const time = Number.isFinite(video.duration) && video.duration > 0.1 ? Math.min(1, video.duration / 3) : 0
        if (time === 0) video.onloadeddata = finish
        else { video.onseeked = finish; video.currentTime = time }
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
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(video, 0, 0, width, height)
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  } catch {
    return null
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
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
