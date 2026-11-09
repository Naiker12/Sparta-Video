import type { Clip, Track } from '../model'
import type { SubtitleEntryInput } from '../editor-store'

/**
 * Formats seconds into SRT timestamp format: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const hrs = Math.floor(totalMs / 3600000)
  const mins = Math.floor((totalMs % 3600000) / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

/**
 * Parses an SRT timestamp string (HH:MM:SS,mmm or HH:MM:SS.mmm) into seconds.
 */
export function parseSrtTimestamp(timeStr: string): number {
  const clean = timeStr.trim().replace('.', ',')
  const parts = clean.split(':')
  if (parts.length < 3) return 0

  const hrs = parseInt(parts[0], 10) || 0
  const mins = parseInt(parts[1], 10) || 0
  const [secsPart, msPart] = parts[2].split(',')
  const secs = parseInt(secsPart, 10) || 0
  const ms = parseInt(msPart || '0', 10) || 0

  return hrs * 3600 + mins * 60 + secs + ms / 1000
}

/**
 * Exports all subtitle / text clips from timeline tracks into an SRT string.
 */
export function exportTracksToSrt(tracks: Track[]): string {
  const subtitleClips: Clip[] = []

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.text?.trim()) {
        subtitleClips.push(clip)
      }
    }
  }

  // Sort chronologically by start time
  subtitleClips.sort((a, b) => a.start - b.start)

  let srtOutput = ''
  subtitleClips.forEach((clip, index) => {
    const startTs = formatSrtTimestamp(clip.start)
    const endTs = formatSrtTimestamp(clip.start + clip.duration)
    const text = clip.text?.trim() || ''

    srtOutput += `${index + 1}\n${startTs} --> ${endTs}\n${text}\n\n`
  })

  return srtOutput.trimEnd() + '\n'
}

/**
 * Parses an SRT file string into subtitle entry inputs for adding to the timeline.
 */
export function parseSrtContent(srtText: string): SubtitleEntryInput[] {
  const entries: SubtitleEntryInput[] = []
  const blocks = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n')

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    // Find the line containing "-->"
    const timeIndex = lines.findIndex((l) => l.includes('-->'))
    if (timeIndex === -1) continue

    const timeLine = lines[timeIndex]
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim())
    if (!startStr || !endStr) continue

    const start = parseSrtTimestamp(startStr)
    const end = parseSrtTimestamp(endStr)
    const duration = Math.max(0.2, end - start)

    const textLines = lines.slice(timeIndex + 1).map((l) => l.trim()).filter(Boolean)
    const text = textLines.join(' ')

    if (text) {
      entries.push({
        text,
        start,
        duration,
      })
    }
  }

  return entries
}

/**
 * Downloads an SRT file directly to the user's browser.
 */
export function downloadSrtFile(projectName: string, tracks: Track[]): boolean {
  const srtContent = exportTracksToSrt(tracks)
  if (!srtContent.trim()) return false

  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const safeName = projectName.replace(/[^\p{L}\p{N}_-]+/gu, '_').trim() || 'subtitulos'
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeName}.srt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

/**
 * Formats seconds into WebVTT timestamp format: HH:MM:SS.mmm
 */
export function formatVttTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const hrs = Math.floor(totalMs / 3600000)
  const mins = Math.floor((totalMs % 3600000) / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

/**
 * Parses a WebVTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) into seconds.
 */
export function parseVttTimestamp(timeStr: string): number {
  const clean = timeStr.trim().replace(',', '.')
  const parts = clean.split(':')
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0
    const [secsPart, msPart] = parts[1].split('.')
    const secs = parseInt(secsPart, 10) || 0
    const ms = parseInt(msPart || '0', 10) || 0
    return mins * 60 + secs + ms / 1000
  }
  if (parts.length >= 3) {
    const hrs = parseInt(parts[0], 10) || 0
    const mins = parseInt(parts[1], 10) || 0
    const [secsPart, msPart] = parts[2].split('.')
    const secs = parseInt(secsPart, 10) || 0
    const ms = parseInt(msPart || '0', 10) || 0
    return hrs * 3600 + mins * 60 + secs + ms / 1000
  }
  return 0
}

/**
 * Exports all subtitle / text clips into standard WebVTT format string.
 */
export function exportTracksToVtt(tracks: Track[]): string {
  const subtitleClips: Clip[] = []

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.text?.trim()) {
        subtitleClips.push(clip)
      }
    }
  }

  subtitleClips.sort((a, b) => a.start - b.start)

  let vttOutput = 'WEBVTT\n\n'
  subtitleClips.forEach((clip, index) => {
    const startTs = formatVttTimestamp(clip.start)
    const endTs = formatVttTimestamp(clip.start + clip.duration)
    const text = clip.text?.trim() || ''

    vttOutput += `${index + 1}\n${startTs} --> ${endTs}\n${text}\n\n`
  })

  return vttOutput.trimEnd() + '\n'
}

/**
 * Parses WebVTT content string into subtitle entries.
 */
export function parseVttContent(vttText: string): SubtitleEntryInput[] {
  const entries: SubtitleEntryInput[] = []
  // Strip initial WEBVTT header and optional comments
  const cleanText = vttText.replace(/^WEBVTT[^\n]*\n+/i, '')
  const blocks = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n')

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 1) continue

    // Find the line containing "-->"
    const timeIndex = lines.findIndex((l) => l.includes('-->'))
    if (timeIndex === -1) continue

    const timeLine = lines[timeIndex]
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim())
    if (!startStr || !endStr) continue

    // Clean any cue settings after the timestamp (e.g. "00:01.000 line:0 position:20%")
    const cleanEndStr = endStr.split(/\s+/)[0]

    const start = parseVttTimestamp(startStr)
    const end = parseVttTimestamp(cleanEndStr)
    const duration = Math.max(0.2, end - start)

    const textLines = lines.slice(timeIndex + 1).map((l) => l.trim()).filter(Boolean)
    // Strip cue tags like <c>, <b>, <i>, <v Name>
    const text = textLines.join(' ').replace(/<\/?[^>]+(>|$)/g, '').trim()

    if (text) {
      entries.push({
        text,
        start,
        duration,
      })
    }
  }

  return entries
}

/**
 * Downloads a WebVTT file directly to the user's browser.
 */
export function downloadVttFile(projectName: string, tracks: Track[]): boolean {
  const vttContent = exportTracksToVtt(tracks)
  if (!vttContent.trim() || vttContent.trim() === 'WEBVTT') return false

  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const safeName = projectName.replace(/[^\p{L}\p{N}_-]+/gu, '_').trim() || 'subtitulos'
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeName}.vtt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

