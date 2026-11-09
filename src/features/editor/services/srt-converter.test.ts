import { describe, expect, it } from 'vitest'
import {
  exportTracksToSrt,
  formatSrtTimestamp,
  parseSrtContent,
  parseSrtTimestamp,
} from './srt-converter'
import type { Track } from '../model'

describe('SRT Converter (Subtitles import/export)', () => {
  it('formats seconds into SRT timestamp correctly', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000')
    expect(formatSrtTimestamp(1.5)).toBe('00:00:01,500')
    expect(formatSrtTimestamp(65.25)).toBe('00:01:05,250')
    expect(formatSrtTimestamp(3661.05)).toBe('01:01:01,050')
  })

  it('parses SRT timestamp back to seconds', () => {
    expect(parseSrtTimestamp('00:00:01,500')).toBe(1.5)
    expect(parseSrtTimestamp('00:01:05,250')).toBe(65.25)
    expect(parseSrtTimestamp('01:01:01,050')).toBe(3661.05)
  })

  it('exports timeline tracks with subtitles to standard SRT format', () => {
    const tracks: Track[] = [
      {
        id: 'v1',
        name: 'Video',
        kind: 'video',
        clips: [
          {
            id: 'c1',
            title: 'Sub 1',
            start: 0,
            duration: 2.5,
            color: '',
            thumbnail: 'text-overlay',
            kind: 'video',
            text: '¡Hola a todos!',
          },
          {
            id: 'c2',
            title: 'Sub 2',
            start: 3.0,
            duration: 2.0,
            color: '',
            thumbnail: 'text-overlay',
            kind: 'video',
            text: 'Bienvenidos a Sparta Video.',
          },
        ],
      },
    ]

    const srt = exportTracksToSrt(tracks)
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\n¡Hola a todos!')
    expect(srt).toContain('2\n00:00:03,000 --> 00:00:05,000\nBienvenidos a Sparta Video.')
  })

  it('parses SRT string content into timeline subtitle entries', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,500
Este es un subtítulo importado.

2
00:00:04,200 --> 00:00:07,000
Segunda línea de diálogo.`

    const entries = parseSrtContent(srt)
    expect(entries).toHaveLength(2)
    expect(entries[0].text).toBe('Este es un subtítulo importado.')
    expect(entries[0].start).toBe(1.0)
    expect(entries[0].duration).toBe(2.5)
    expect(entries[1].text).toBe('Segunda línea de diálogo.')
    expect(entries[1].start).toBe(4.2)
  })
})

