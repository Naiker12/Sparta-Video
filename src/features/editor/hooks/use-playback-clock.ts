import { useEffect, useRef } from 'react'
import { TimelineAudioEngine } from '../services/audio-playback'
import { useEditorStore } from '../editor-store'
import type { MediaItem, Track } from '../model'

interface UsePlaybackClockOptions {
  playing: boolean
  effectiveDuration: number
  frameRate: number
  playhead: number
  tracks: Track[]
  assets: MediaItem[]
  mutedTracks: string[]
  setPlayhead: (time: number) => void
  setPlaying: (playing: boolean) => void
}

export function usePlaybackClock({
  playing,
  effectiveDuration,
  frameRate,
  playhead,
  tracks,
  assets,
  mutedTracks,
  setPlayhead,
  setPlaying,
}: UsePlaybackClockOptions) {
  const audioEngineRef = useRef<TimelineAudioEngine | null>(null)

  useEffect(() => {
    if (!playing || effectiveDuration <= 0) return
    let lastFrameAt = performance.now()
    let animationFrame = 0
    const advance = (now: number) => {
      const elapsed = (now - lastFrameAt) / 1000
      if (elapsed < 1 / frameRate) {
        animationFrame = requestAnimationFrame(advance)
        return
      }
      lastFrameAt = now
      const next = useEditorStore.getState().playhead + elapsed
      if (next >= effectiveDuration) {
        setPlayhead(effectiveDuration)
        setPlaying(false)
        return
      }
      setPlayhead(next)
      animationFrame = requestAnimationFrame(advance)
    }
    animationFrame = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(animationFrame)
  }, [playing, effectiveDuration, frameRate, setPlayhead, setPlaying])

  useEffect(() => {
    if (!audioEngineRef.current) audioEngineRef.current = new TimelineAudioEngine()
    const engine = audioEngineRef.current
    void engine.sync(playhead, playing, tracks, assets, mutedTracks)
    return () => {
      engine.pauseAll()
    }
  }, [playhead, playing, tracks, assets, mutedTracks])

  useEffect(() => {
    return () => {
      audioEngineRef.current?.destroy()
    }
  }, [])

  const togglePlayback = () => {
    if (!playing && effectiveDuration > 0 && playhead >= effectiveDuration) {
      setPlayhead(0)
    }
    setPlaying(!playing)
  }

  return { togglePlayback }
}

