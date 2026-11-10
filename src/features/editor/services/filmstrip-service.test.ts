import { describe, it, expect, beforeEach } from 'vitest'
import {
  getFilmstripFramesForClip,
  clearFilmstripCache,
  type FilmstripData,
} from './filmstrip-service'

describe('filmstrip-service', () => {
  beforeEach(() => {
    clearFilmstripCache()
  })

  it('returns singlePreviewUrl repeated across slots when no multi-frame data exists', () => {
    const frames = getFilmstripFramesForClip(undefined, 0, 10, 4, 'http://preview.jpg')
    expect(frames).toEqual([
      'http://preview.jpg',
      'http://preview.jpg',
      'http://preview.jpg',
      'http://preview.jpg',
    ])
  })

  it('returns empty array when neither filmstrip nor singlePreviewUrl are provided', () => {
    const frames = getFilmstripFramesForClip(undefined, 0, 10, 4)
    expect(frames).toEqual([])
  })

  it('selects the closest chronological frame for each slot in the clip', () => {
    const mockFilmstrip: FilmstripData = {
      assetId: 'asset-1',
      duration: 20,
      frames: [
        { time: 0, url: 'frame-0.jpg' },
        { time: 5, url: 'frame-5.jpg' },
        { time: 10, url: 'frame-10.jpg' },
        { time: 15, url: 'frame-15.jpg' },
        { time: 20, url: 'frame-20.jpg' },
      ],
    }

    // Clip starting at 0s, lasting 10s, with 3 slots (t=0s, t=5s, t=10s)
    const clipFrames = getFilmstripFramesForClip(mockFilmstrip, 0, 10, 3)
    expect(clipFrames).toEqual([
      'frame-0.jpg',
      'frame-5.jpg',
      'frame-10.jpg',
    ])

    // Trimmed clip starting at offset 5s, lasting 10s (covers 5s to 15s) with 3 slots (5s, 10s, 15s)
    const trimmedFrames = getFilmstripFramesForClip(mockFilmstrip, 5, 10, 3)
    expect(trimmedFrames).toEqual([
      'frame-5.jpg',
      'frame-10.jpg',
      'frame-15.jpg',
    ])
  })

  it('handles a single slot gracefully', () => {
    const mockFilmstrip: FilmstripData = {
      assetId: 'asset-1',
      duration: 10,
      frames: [
        { time: 0, url: 'frame-0.jpg' },
        { time: 5, url: 'frame-5.jpg' },
        { time: 10, url: 'frame-10.jpg' },
      ],
    }

    // Single slot sampled at middle (t=5s)
    const frames = getFilmstripFramesForClip(mockFilmstrip, 0, 10, 1)
    expect(frames).toHaveLength(1)
    expect(frames[0]).toBe('frame-5.jpg')
  })
})

