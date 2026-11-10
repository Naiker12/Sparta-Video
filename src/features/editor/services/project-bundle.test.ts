import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isZipArchive, exportProjectBundle, importProjectBundle, SPARTA_PACKAGE_EXTENSION } from './project-bundle'
import * as mediaStorage from './media-storage'
import type { PersistedProjectState } from '../editor-store'

describe('project-bundle (.spartapack)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('correctly verifies ZIP magic bytes', async () => {
    const validZipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])
    const invalidHeader = new Uint8Array([0x7f, 0x45, 0x4c, 0x46])

    expect(await isZipArchive(new Blob([validZipHeader]))).toBe(true)
    expect(await isZipArchive(new Blob([invalidHeader]))).toBe(false)
    expect(await isZipArchive(new Blob([new Uint8Array(0)]))).toBe(false)
  })

  it('exports and imports a bundle round-trip with manifest and media files', async () => {
    const mockBlob = new Blob(['mock video binary data'], { type: 'video/mp4' })
    vi.spyOn(mediaStorage, 'loadMediaBlob').mockResolvedValue(mockBlob)
    const storedFiles: Record<string, File> = {}
    vi.spyOn(mediaStorage, 'storeMediaFile').mockImplementation(async (id, file) => {
      storedFiles[id] = file
    })

    const testState: PersistedProjectState = {
      projectName: 'Proyecto Prueba',
      sequence: { width: 1920, height: 1080, frameRate: 30 },
      tracks: [{ id: 'track-1', kind: 'video', name: 'Video 1', clips: [] }],
      assets: [
        {
          id: 'asset-123',
          title: 'clip1.mp4',
          detail: '10s · 1080p',
          thumb: '',
          type: 'video',
          durationSeconds: 10,
        },
      ],
      markers: [],
      snapToFrames: true,
      mutedTracks: [],
      lockedTracks: [],
    }

    const { blob, filename, mediaCount } = await exportProjectBundle(testState)

    expect(filename).toContain('Proyecto_Prueba')
    expect(filename).toContain(SPARTA_PACKAGE_EXTENSION)
    expect(mediaCount).toBe(1)
    expect(blob.size).toBeGreaterThan(0)
    expect(await isZipArchive(blob)).toBe(true)

    // Now test importing the bundle
    const result = await importProjectBundle(blob)

    expect(result.mediaCount).toBe(1)
    expect(result.project.project.name).toBe('Proyecto Prueba')
    expect(storedFiles['asset-123']).toBeDefined()
    expect(storedFiles['asset-123'].name).toBe('clip1.mp4')
  })
})
