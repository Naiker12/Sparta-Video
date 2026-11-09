import type { SubtitleEntryInput } from '../editor-store'
import { useEditorStore } from '../editor-store'

export interface ScriptScene {
  id: string
  index: number
  text: string
  duration: number
  startTime: number
  visualPrompt?: string
  assignedAssetId?: string
}

export interface ScriptToVideoOptions {
  wpm?: number // Words per minute, default ~140
  minSceneDuration?: number // Minimum seconds per beat, default 2.5s
  presetId?: string
  includeBRollTrack?: boolean
  customScenes?: ScriptScene[]
}

const SHOT_TYPES = [
  'Primer plano / Close-up emotivo',
  'Plano medio: creador interactuando',
  'Toma de detalle B-roll de alta velocidad',
  'Plano general / Establecimiento de contexto',
  'Tomas dinámicas de producto / demostración',
  'Corte rápido a pantalla / interfaz',
]

/**
 * Generates an inspiring visual shot suggestion based on keywords in the scene text.
 */
export function suggestSceneVisual(text: string, sceneIndex: number): string {
  const lower = text.toLowerCase()
  if (lower.includes('descubr') || lower.includes('secreto') || lower.includes('método') || lower.includes('herramienta')) {
    return 'Primer plano con iluminación de acento / Revelación impactante'
  }
  if (lower.includes('problema') || lower.includes('error') || lower.includes('perder') || lower.includes('difícil')) {
    return 'Plano medio: gesto de frustración o reto con sombras dramáticas'
  }
  if (lower.includes('dinero') || lower.includes('ventas') || lower.includes('crecer') || lower.includes('éxito')) {
    return 'Gráficos ascendentes / Toma B-roll de alta energía'
  }
  if (lower.includes('comenta') || lower.includes('sigue') || lower.includes('haz clic') || lower.includes('parte 2')) {
    return 'Primer plano a cámara con señalización hacia el botón de llamada a la acción'
  }
  return SHOT_TYPES[(sceneIndex - 1) % SHOT_TYPES.length]
}

export function parseScriptIntoScenes(
  scriptText: string,
  options: ScriptToVideoOptions = {},
): ScriptScene[] {
  const wpm = options.wpm ?? 140
  const minDuration = options.minSceneDuration ?? 2.5

  // Split by double newline, or single newline if paragraphs
  const rawParagraphs = scriptText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const scenes: ScriptScene[] = []
  let currentTime = 0

  rawParagraphs.forEach((paragraph, idx) => {
    const sceneIndex = idx + 1
    const words = paragraph.split(/\s+/).filter(Boolean)
    const rawSeconds = (words.length / wpm) * 60
    const duration = Math.max(minDuration, Math.round(rawSeconds * 10) / 10)

    scenes.push({
      id: `scene-${sceneIndex}-${Date.now()}`,
      index: sceneIndex,
      text: paragraph,
      duration,
      startTime: currentTime,
      visualPrompt: suggestSceneVisual(paragraph, sceneIndex),
    })

    currentTime += duration
  })

  return scenes
}

export function buildScriptStoryboard(
  scriptText: string,
  options: ScriptToVideoOptions = {},
): { sceneCount: number; totalDuration: number } {
  const scenes = options.customScenes && options.customScenes.length > 0
    ? options.customScenes
    : parseScriptIntoScenes(scriptText, options)

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

  // 3. If B-Roll track requested or assets assigned, place scene video blocks
  if (options.includeBRollTrack) {
    const videoTrack = store.tracks.find((t) => t.kind === 'video' && !t.name.toLowerCase().includes('sub'))
    if (videoTrack) {
      const brollColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
      const newClips = scenes.map((s, idx) => ({
        id: `c-broll-${s.index}-${idx}-${Date.now()}`,
        title: `Toma ${s.index}: ${s.visualPrompt?.slice(0, 24) || 'Escena'}`,
        start: s.startTime,
        duration: s.duration,
        color: brollColors[idx % brollColors.length],
        sourceAssetId: s.assignedAssetId,
        thumbnail: 'color-fill',
        kind: 'video' as const,
        transform: {
          x: store.sequence.width / 2,
          y: store.sequence.height / 2,
          scaleX: 100,
          scaleY: 100,
          rotation: 0,
        },
        opacity: 100,
        blendMode: 'normal' as const,
      }))

      useEditorStore.setState((state) => ({
        tracks: state.tracks.map((t) => (t.id === videoTrack.id ? { ...t, clips: [...t.clips, ...newClips] } : t)),
      }))
    }
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0)
  return { sceneCount: count, totalDuration }
}
