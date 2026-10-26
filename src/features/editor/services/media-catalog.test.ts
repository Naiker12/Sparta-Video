import { describe, expect, it } from 'vitest'
import { MediaMetadataSchema } from './contracts'
import { inspectMediaFile } from './media-catalog'

describe('media catalog', () => {
  it('catalogs supported files and reports that only metadata is retained', async () => {
    const file = new File(['media'], 'coast.mp4', { type: 'video/mp4' })
    await expect(inspectMediaFile(file)).resolves.toMatchObject({ name: 'coast.mp4', status: 'catalog-only', sizeBytes: 5 })
    expect(MediaMetadataSchema.safeParse({ name: '', mimeType: 'video/mp4', sizeBytes: -1, status: 'ready' }).success).toBe(false)
  })

  it('rejects unsupported files instead of misclassifying them as video', async () => {
    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' })
    await expect(inspectMediaFile(file)).rejects.toThrow(/no compatible/i)
  })
})
