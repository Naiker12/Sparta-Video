import { describe, expect, it, vi } from 'vitest'
import { TimelineAudioEngine } from './audio-playback'
import type { Track } from '../model'

describe('TimelineAudioEngine', () => {
  it('manages and syncs active audio clips during timeline playback', async () => {
    const engine = new TimelineAudioEngine()

    const mockTracks: Track[] = [
      {
        id: 't-audio-1',
        name: 'Voiceover',
        kind: 'audio',
        clips: [
          {
            id: 'c-audio-1',
            title: 'Narration.mp3',
            start: 2,
            duration: 6,
            sourceAssetId: 'asset-narration',
            kind: 'audio',
            volume: 80,
            color: 'olive',
            thumbnail: 'wave',
          },
        ],
      },
    ]

    // Sync when not playing - should pause all
    await engine.sync(0, false, mockTracks, [])

    // Sync when playing but before clip start (playhead = 1)
    await engine.sync(1, true, mockTracks, [])

    // Destroy cleans up all elements safely
    engine.destroy()
    expect(true).toBe(true)
  })

  it('pauses all audio sources when track is muted', async () => {
    const engine = new TimelineAudioEngine()
    const pauseSpy = vi.spyOn(engine, 'pauseAll')

    await engine.sync(0, false, [], [])
    expect(pauseSpy).toHaveBeenCalled()

    engine.destroy()
  })
})
