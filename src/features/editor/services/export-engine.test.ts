import { describe, expect, it } from 'vitest'
import {
  EXPORT_PRESETS,
  audioBufferToWavBlob,
  drawClipToCanvas,
  getDefaultExportSettings,
  renderSequence,
} from './export-engine'
import type { ExportSettings } from './contracts'

describe('export engine', () => {
  it('provides comprehensive presets with valid dimensions and bitrates', () => {
    expect(EXPORT_PRESETS['web-1080p']).toMatchObject({
      width: 1920,
      height: 1080,
      frameRate: 30,
      format: 'mp4',
    })
    expect(EXPORT_PRESETS['social-vertical']).toMatchObject({
      width: 1080,
      height: 1920,
      frameRate: 30,
    })
    expect(EXPORT_PRESETS['uhd-4k'].width).toBe(3840)
    expect(EXPORT_PRESETS['audio-only'].format).toBe('wav')
  })

  it('generates sanitized default export settings from project name', () => {
    const settings = getDefaultExportSettings('Coastal Film 2026! @#$', 'web-1080p')
    expect(settings.fileName).toBe('Coastal_Film_2026.mp4')
    expect(settings.width).toBe(1920)
    expect(settings.height).toBe(1080)
    expect(settings.range).toBe('entire')
  })

  it('encodes an AudioBuffer into a valid 16-bit PCM stereo WAV blob', async () => {
    const sampleRate = 44100
    const length = 441 // 10ms of audio
    const left = new Float32Array(length).fill(0.5)
    const right = new Float32Array(length).fill(-0.5)

    const mockBuffer = {
      numberOfChannels: 2,
      sampleRate,
      length,
      duration: length / sampleRate,
      getChannelData: (ch: number) => (ch === 0 ? left : right),
    } as unknown as AudioBuffer

    const blob = audioBufferToWavBlob(mockBuffer)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + length * 2 * 2)

    const arrayBuffer = await blob.arrayBuffer()
    const view = new DataView(arrayBuffer)
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
    expect(riff).toBe('RIFF')
    expect(wave).toBe('WAVE')
  })

  it('aborts export immediately when signal is cancelled', async () => {
    const controller = new AbortController()
    controller.abort()

    const settings: ExportSettings = {
      preset: 'web-1080p',
      format: 'webm',
      width: 1920,
      height: 1080,
      frameRate: 30,
      bitrateMbps: 8,
      fileName: 'test.webm',
      range: 'entire',
    }

    await expect(
      renderSequence({
        tracks: [],
        assets: [],
        sequenceDuration: 5,
        settings,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancelada/i)
  })

  it('reports progress stages correctly for audio-only export', async () => {
    const progressReports: Array<{ stage: string; percent: number }> = []
    const settings: ExportSettings = {
      preset: 'audio-only',
      format: 'wav',
      width: 1920,
      height: 1080,
      frameRate: 30,
      bitrateMbps: 1.5,
      fileName: 'master_mix.wav',
      range: 'entire',
    }

    const result = await renderSequence({
      tracks: [],
      assets: [],
      sequenceDuration: 0.5,
      settings,
      onProgress: (p) => {
        progressReports.push({ stage: p.stage, percent: p.percent })
      },
    })

    expect(result.fileName).toBe('master_mix.wav')
    expect(result.sizeBytes).toBeGreaterThan(0)
    expect(progressReports.length).toBeGreaterThan(0)
    expect(progressReports.some((p) => p.stage === 'completed' && p.percent === 100)).toBe(true)
  })

  it('drawClipToCanvas centers clip when exporting 1920x1080 sequence to 3840x2160 (4K)', () => {
    const translateCalls: Array<[number, number]> = []
    const drawImageCalls: any[] = []

    const mockCtx = {
      save: () => {},
      restore: () => {},
      translate: (x: number, y: number) => translateCalls.push([x, y]),
      rotate: () => {},
      scale: () => {},
      drawImage: (...args: any[]) => drawImageCalls.push(args),
      fillRect: () => {},
      fillText: () => {},
      measureText: () => ({ width: 100 }),
    } as unknown as CanvasRenderingContext2D

    const clip = {
      id: 'clip-1',
      title: 'Clip 1',
      kind: 'video' as const,
      start: 0,
      duration: 5,
      color: 'blue',
      thumbnail: 'coast',
      transform: { x: 960, y: 540, scaleX: 100, scaleY: 100, rotation: 0 },
    }

    // Mock HTMLVideoElement (1920x1080)
    const mockVideo = {
      readyState: 4,
      videoWidth: 1920,
      videoHeight: 1080,
    } as unknown as HTMLVideoElement
    Object.setPrototypeOf(mockVideo, HTMLVideoElement.prototype)

    // Exporting 1920x1080 sequence to 3840x2160 canvas
    drawClipToCanvas(
      mockCtx,
      clip,
      mockVideo,
      0,
      3840,
      2160,
      { width: 1920, height: 1080 },
    )

    // Clip position 960, 540 scaled by 2 -> 1920, 1080 (exact center of 4K canvas!)
    expect(translateCalls).toHaveLength(1)
    expect(translateCalls[0][0]).toBe(1920)
    expect(translateCalls[0][1]).toBe(1080)

    // Image drawn centered: w=3840, h=2160, drawn at -1920, -1080
    expect(drawImageCalls).toHaveLength(1)
    const [_, dx, dy, dw, dh] = drawImageCalls[0]
    expect(dw).toBe(3840)
    expect(dh).toBe(2160)
    expect(dx).toBe(-1920)
    expect(dy).toBe(-1080)
  })

  it('drawClipToCanvas preserves aspect ratio using computeFitRect without stretching', () => {
    const drawImageCalls: any[] = []

    const mockCtx = {
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      drawImage: (...args: any[]) => drawImageCalls.push(args),
      fillRect: () => {},
      fillText: () => {},
      measureText: () => ({ width: 100 }),
    } as unknown as CanvasRenderingContext2D

    const clip = {
      id: 'clip-v',
      title: 'Vertical Clip',
      kind: 'video' as const,
      start: 0,
      duration: 5,
      color: 'blue',
      thumbnail: 'harbor',
      transform: { x: 540, y: 960, scaleX: 100, scaleY: 100, rotation: 0 },
      fit: 'fit' as const,
    }

    // 16:9 video element inside 9:16 vertical canvas (1080x1920)
    const mockVideo = {
      readyState: 4,
      videoWidth: 1920,
      videoHeight: 1080,
    } as unknown as HTMLVideoElement
    Object.setPrototypeOf(mockVideo, HTMLVideoElement.prototype)

    drawClipToCanvas(
      mockCtx,
      clip,
      mockVideo,
      0,
      1080,
      1920,
      { width: 1080, height: 1920 },
    )

    expect(drawImageCalls).toHaveLength(1)
    const [_, dx, dy, dw, dh] = drawImageCalls[0]
    // 16:9 into 1080x1920: width=1080, height=607.5
    expect(dw).toBe(1080)
    expect(dh).toBeCloseTo(607.5, 1)
    expect(dx).toBe(-540)
    expect(dy).toBeCloseTo(-303.75, 1)
  })
})
