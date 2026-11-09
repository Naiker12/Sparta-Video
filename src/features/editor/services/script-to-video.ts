import type { SubtitleEntryInput } from '../editor-store'
import { useEditorStore } from '../editor-store'

export interface ScriptScene {
  index: number
  text: string
  duration: number
  startTime: number
}

export interface ScriptToVideoOptions {
  wpm?: number // Words per minute, default ~140
  minSceneDuration?: number // Minimum seconds per beat, default 2.5s
  presetId?: string
}

export function parseScriptIntoScenes(
  scriptText: string,
  options: ScriptToVideoOptions = {},
): ScriptScene[] {
  const wpm = options.wpm ?? 140
  const minDuration = options.minSceneDuration ?? 2.5

  // Split by double newline, or single newline if substantial paragraphs
  const rawParagraphs = scriptText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const scenes: ScriptScene[] = []
  let currentTime = 0

  rawParagraphs.forEach((paragraph, idx) => {
    // Calculate approximate duration based on word count
    const words = paragraph.split(/\s+/).filter(Boolean)
    const rawSeconds = (words.length / wpm) * 60
    const duration = Math.max(minDuration, Math.round(rawSeconds * 10) / 10)

    scenes.push({
      index: idx + 1,
      text: paragraph,
      duration,
      startTime: currentTime,
    })

    currentTime += duration
  })

  return scenes
}

export function buildScriptStoryboard(
  scriptText: string,
  options: ScriptToVideoOptions = {},
): { sceneCount: number; totalDuration: number } {
  const scenes = parseScriptIntoScenes(scriptText, options)
  if (scenes.length === 0) return { sceneCount: 0, totalDuration: 0 }

  const entries: SubtitleEntryInput[] = scenes.map((s) => ({
    text: s.text,
    start: s.startTime,
    duration: s.duration,
    presetId: options.presetId,
  }))

  const store = useEditorStore.getState()

  // 1. Add subtitle sequence
  const count = store.addSubtitleSequence(entries, { replaceExisting: false })

  // 2. Add scene markers for every scene
  scenes.forEach((s) => {
    store.addMarker(s.startTime, `Escena ${s.index}`)
  })

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0)
  return { sceneCount: count, totalDuration }
}

