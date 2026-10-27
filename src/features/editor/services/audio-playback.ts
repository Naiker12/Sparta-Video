import type { Clip, MediaItem, Track } from '../model'
import { loadMediaSource } from './media-storage'

/**
 * Manages synchronized timeline audio playback for non-muted tracks and active clips.
 */
export class TimelineAudioEngine {
  private audioElements = new Map<string, { audio: HTMLAudioElement; assetId: string; url: string }>()
  private isDestroyed = false

  public async sync(
    playhead: number,
    playing: boolean,
    tracks: Track[],
    _assets: MediaItem[],
    mutedTracks: string[] = [],
  ): Promise<void> {
    if (this.isDestroyed) return

    if (!playing) {
      this.pauseAll()
      return
    }

    const audioTracks = tracks.filter((t) => t.kind === 'audio' && !mutedTracks.includes(t.id))
    const activeClips: { clip: Clip; trackId: string }[] = []

    for (const track of audioTracks) {
      for (const clip of track.clips) {
        if (playhead >= clip.start && playhead < clip.start + clip.duration && clip.sourceAssetId) {
          activeClips.push({ clip, trackId: track.id })
        }
      }
    }

    const activeClipIds = new Set(activeClips.map(({ clip }) => clip.id))

    // Pause and clean up clips that are no longer active
    for (const [clipId, entry] of this.audioElements.entries()) {
      if (!activeClipIds.has(clipId)) {
        entry.audio.pause()
        URL.revokeObjectURL(entry.url)
        this.audioElements.delete(clipId)
      }
    }

    // Play or sync active clips
    for (const { clip } of activeClips) {
      const assetId = clip.sourceAssetId!
      const targetTime = Math.max(0, playhead - clip.start)
      const volume = Math.max(0, Math.min(1, (clip.volume ?? 100) / 100))

      const existing = this.audioElements.get(clip.id)
      if (existing) {
        existing.audio.volume = volume
        if (Math.abs(existing.audio.currentTime - targetTime) > 0.25) {
          existing.audio.currentTime = targetTime
        }
        if (existing.audio.paused) {
          void existing.audio.play().catch(() => {})
        }
      } else {
        // Load asset source and create audio element
        const url = await loadMediaSource(assetId)
        if (!url || this.isDestroyed || !activeClipIds.has(clip.id)) {
          if (url) URL.revokeObjectURL(url)
          continue
        }

        const audio = new Audio(url)
        audio.currentTime = targetTime
        audio.volume = volume
        this.audioElements.set(clip.id, { audio, assetId, url })
        void audio.play().catch(() => {})
      }
    }
  }

  public pauseAll(): void {
    for (const entry of this.audioElements.values()) {
      entry.audio.pause()
    }
  }

  public destroy(): void {
    this.isDestroyed = true
    for (const entry of this.audioElements.values()) {
      entry.audio.pause()
      URL.revokeObjectURL(entry.url)
    }
    this.audioElements.clear()
  }
}
