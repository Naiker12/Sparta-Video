import { describe, expect, it } from 'vitest'
import {
  EXPORT_PRESETS,
  audioBufferToWavBlob,
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
      format: 'webm',
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
    expect(settings.fileName).toBe('Coastal_Film_2026.webm')
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
})
