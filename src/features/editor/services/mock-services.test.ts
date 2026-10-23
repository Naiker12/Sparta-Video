import { afterEach, describe, expect, it, vi } from 'vitest'
import { AIEditProposalSchema, ExportOptionsSchema, MediaMetadataSchema } from './contracts'
import { mockAIProvider, mockExportService, mockMediaService } from './mock-services'

afterEach(() => vi.useRealTimers())

describe('demo service contracts', () => {
  it('validates catalog-only media and rejects invalid export settings', async () => {
    const file = new File(['demo'], 'coast.mp4', { type: 'video/mp4' })
    await expect(mockMediaService.inspect(file)).resolves.toMatchObject({ name: 'coast.mp4', status: 'catalog-only', sizeBytes: 4 })
    expect(MediaMetadataSchema.safeParse({ name: '', mimeType: 'video/mp4', sizeBytes: -1, status: 'ready' }).success).toBe(false)
    expect(ExportOptionsSchema.safeParse({ projectName: '', fileName: '', format: 'mp4', codec: 'h264', width: 0, height: 1080, frameRate: 24, durationSeconds: 1 }).success).toBe(false)
  })

  it('rejects unsupported imports instead of classifying them as video', async () => {
    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' })
    await expect(mockMediaService.inspect(file)).rejects.toThrow(/no compatible/i)
  })

  it('returns an explicit review-only mock proposal without project changes', async () => {
    const proposal = await mockAIProvider.proposeEdits({ projectName: 'Coastal film' }, 'Make it calmer')
    expect(AIEditProposalSchema.parse(proposal)).toMatchObject({ provider: 'mock', status: 'proposal', prompt: 'Make it calmer', changes: [] })
  })

  it('reports mock export progress and supports cancellation', async () => {
    vi.useFakeTimers()
    const progress: number[] = []
    const { jobId } = await mockExportService.start({ projectName: 'Coastal film', fileName: 'coastal.mp4', format: 'mp4', codec: 'h264', width: 1920, height: 1080, frameRate: 24, durationSeconds: 23 }, (value) => progress.push(value))
    await vi.advanceTimersByTimeAsync(180)
    expect(progress).toEqual([10, 20])
    await mockExportService.cancel(jobId)
    await vi.advanceTimersByTimeAsync(1000)
    expect(progress).toEqual([10, 20])
  })
})
