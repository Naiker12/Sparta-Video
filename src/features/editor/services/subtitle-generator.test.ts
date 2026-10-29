import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor-store'
import { formatMediaDuration, parseDurationFromDetail } from './media-storage'
import {
  buildContextualLinesForSegments,
  detectSpeechSegmentsFromSamples,
  encodeWavMono16k,
  generateSubtitlesFromTimelineVideo,
  resampleTo16kHzMono,
  splitTranscriptChunkIntoCaptions,
} from './subtitle-generator'

describe('video duration & voice-synced subtitle generator', () => {
  beforeEach(() => {
    localStorage.removeItem('sparta-video-project-v1')
    useEditorStore.getState().resetProject()
  })

  it('formats and parses real video durations including 2+ minute and 1+ hour media', () => {
    expect(formatMediaDuration(135)).toBe('02:15')
    expect(formatMediaDuration(3725)).toBe('01:02:05')
    expect(parseDurationFromDetail('VIDEO · 24.5 MB · 02:15')).toBe(135)
    expect(parseDurationFromDetail('VIDEO · 120 MB · 01:02:05')).toBe(3725)
  })

  it('inserts a 2+ minute video at 00:00 with its full real duration and repairs legacy 6s clips', () => {
    const store = useEditorStore.getState()
    const asset = {
      id: 'local-prison-video',
      title: 'La prisión que llevaba en el bolsillo.mp4',
      detail: 'VIDEO · 18.4 MB · 02:18',
      durationSeconds: 138,
      thumb: 'video-catalog',
      type: 'video' as const,
      status: 'ready' as const,
    }
    store.addAssets([asset])
    const clipId = useEditorStore.getState().addMedia(asset)
    const clip = useEditorStore
      .getState()
      .tracks.flatMap((t) => t.clips)
      .find((c) => c.id === clipId)

    expect(clip?.start).toBe(0)
    expect(clip?.duration).toBe(138)

    // Simulate a legacy 6-second clip at 0.15s that gets repaired when durationSeconds is hydrated
    useEditorStore.getState().updateClip(clipId, { start: 0.15, duration: 6 })
    useEditorStore.getState().updateAsset(asset.id, { durationSeconds: 142, detail: 'VIDEO · 18.4 MB · 02:22' })
    const repairedClip = useEditorStore
      .getState()
      .tracks.flatMap((t) => t.clips)
      .find((c) => c.id === clipId)
    expect(repairedClip?.start).toBe(0)
    expect(repairedClip?.duration).toBe(142)
  })

  it('detects real speech intervals and skips silences in an audio waveform using VAD', () => {
    const sampleRate = 1000
    // 12 seconds of audio:
    // 0.0s - 1.0s: silence
    // 1.0s - 3.2s: speech burst 1 (2.2s)
    // 3.2s - 4.5s: silence pause (1.3s)
    // 4.5s - 9.5s: long speech burst 2 (5.0s -> should split into ~2 natural phrases)
    // 9.5s - 12.0s: silence outro
    const samples = new Float32Array(12 * sampleRate)
    for (let i = Math.floor(1.0 * sampleRate); i < Math.floor(3.2 * sampleRate); i++) {
      samples[i] = Math.sin(i * 0.25) * 0.35
    }
    for (let i = Math.floor(4.5 * sampleRate); i < Math.floor(9.5 * sampleRate); i++) {
      // Create a dip around 7.0s so the phrase splitter finds the natural pause
      const env = Math.abs(i / sampleRate - 7.0) < 0.15 ? 0.03 : 0.4
      samples[i] = Math.sin(i * 0.3) * env
    }

    const segments = detectSpeechSegmentsFromSamples(samples, sampleRate, 0)
    expect(segments.length).toBeGreaterThanOrEqual(3)
    // First segment should start near 1.0s (skipping the 1s intro silence)
    expect(segments[0].start).toBeGreaterThanOrEqual(0.9)
    expect(segments[0].start).toBeLessThanOrEqual(1.15)
    // Last segment should end near 9.5s (skipping the 9.5s-12s outro silence)
    const lastSeg = segments.at(-1)!
    expect(lastSeg.start + lastSeg.duration).toBeLessThanOrEqual(9.7)
  })

  it('encodes mono PCM into a valid 16kHz RIFF WAVE blob', () => {
    const samples = new Float32Array(16000)
    const wav = encodeWavMono16k(samples, 16000)
    expect(wav.type).toBe('audio/wav')
    expect(wav.size).toBe(44 + 16000 * 2)
  })

  it('generates contextual video-synced subtitles across the full duration of a 2+ minute video', async () => {
    const store = useEditorStore.getState()
    const asset = {
      id: 'local-prison-2min',
      title: 'La prisión que llevaba en el bolsillo.mp4',
      detail: 'VIDEO · 18.4 MB · 02:10',
      durationSeconds: 130,
      thumb: 'video-catalog',
      type: 'video' as const,
      status: 'ready' as const,
    }
    store.addAssets([asset])
    store.addMedia(asset, 0)

    const result = await generateSubtitlesFromTimelineVideo({ presetId: 'hormozi-karaoke' })
    expect(result.durationSeconds).toBe(130)
    expect(result.count).toBeGreaterThanOrEqual(35)

    const subTrack = useEditorStore
      .getState()
      .tracks.find((t) => t.name.toLowerCase().includes('sub'))
    expect(subTrack).toBeDefined()
    expect(subTrack!.clips.length).toBe(result.count)
    // First subtitle starts at 0s and last subtitle reaches the end of the 130s video
    expect(subTrack!.clips[0].start).toBe(0)
    const lastSub = subTrack!.clips.at(-1)!
    expect(lastSub.start + lastSub.duration).toBeGreaterThan(125)

    // Contextual lines match the video title theme
    const lines = buildContextualLinesForSegments(asset.title, [
      { start: 0, duration: 2.5, energy: 0.5 },
      { start: 2.5, duration: 2.5, energy: 0.5 },
    ])
    expect(lines[0]).toContain('LA PRISIÓN QUE LLEVABA EN EL BOLSILLO')

    // Applying a new style preset updates all subtitles on the track
    const updatedCount = useEditorStore.getState().applyPresetToAllSubtitles('capcut-pop-pill')
    expect(updatedCount).toBe(result.count)
    const updatedTrack = useEditorStore
      .getState()
      .tracks.find((t) => t.name.toLowerCase().includes('sub'))
    expect(updatedTrack!.clips[0].textStyle?.presetId).toBe('capcut-pop-pill')
  })

  it('resamples 48kHz audio to 16kHz and splits Whisper ASR chunks into dynamic captions', () => {
    const src48k = new Float32Array(48000)
    const out16k = resampleTo16kHzMono(src48k, 48000)
    expect(out16k.length).toBe(16000)

    const captions = splitTranscriptChunkIntoCaptions(
      'Llevamos en el bolsillo una ventana que nunca se apaga y reclama toda nuestra atención cada día',
      10,
      18,
      0,
    )
    expect(captions.length).toBe(3)
    expect(captions[0].start).toBe(10)
    expect(captions[0].text).toBe('Llevamos en el bolsillo una ventana')
    expect(captions[1].text).toBe('que nunca se apaga y reclama')
    expect(captions[2].text).toBe('toda nuestra atención cada día')
  })
})

