import { MediaMetadataSchema } from './contracts'
import type { MediaMetadata } from './contracts'
import { getMediaMimeType } from './media-storage'

export async function inspectMediaFile(file: File): Promise<MediaMetadata> {
  if (!file.name.trim()) throw new Error('El archivo no tiene nombre.')
  const mimeType = getMediaMimeType(file)
  if (!/^(video|audio|image)\//i.test(mimeType)) throw new Error(`Tipo de archivo no compatible: ${file.name}`)
  return MediaMetadataSchema.parse({
    name: file.name,
    mimeType,
    sizeBytes: file.size,
    status: 'catalog-only',
  })
}
