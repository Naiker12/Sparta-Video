import { describe, expect, it } from 'vitest'
import {
  parseScriptIntoScenes,
  buildScriptStoryboard,
  suggestSceneVisual,
} from './script-to-video'
import { useEditorStore } from '../editor-store'

describe('Script to Video / Storyboard generator v2', () => {
  it('parses paragraphs into timed scenes with visual prompts', () => {
    const script = `Había una vez un stickman que soñaba con crear videos virales.

Pero cada vez que abría su editor, se perdía entre menús complejos y botones confusos.

Hasta que descubrió Sparta Video y pudo automatizar todo su flujo en minutos.`

    const scenes = parseScriptIntoScenes(script, { wpm: 120 })
    expect(scenes).toHaveLength(3)
    expect(scenes[0].index).toBe(1)
    expect(scenes[0].startTime).toBe(0)
    expect(scenes[0].duration).toBeGreaterThanOrEqual(2.5)
    expect(scenes[0].visualPrompt).toBeDefined()

    expect(scenes[1].index).toBe(2)
    expect(scenes[1].startTime).toBe(scenes[0].duration)

    expect(scenes[2].index).toBe(3)
    expect(scenes[2].visualPrompt).toMatch(/revelación/i)
  })

  it('suggestSceneVisual selects contextual shot types based on keywords', () => {
    expect(suggestSceneVisual('descubrí este método secreto', 1)).toMatch(/revelación/i)
    expect(suggestSceneVisual('un grave problema casi lo arruina todo', 2)).toMatch(/frustración|reto/i)
    expect(suggestSceneVisual('sígueme para ver la parte 2', 3)).toMatch(/llamada a la acción/i)
  })

  it('builds storyboard into editor store with subtitles, markers and b-roll track', () => {
    useEditorStore.getState().resetProject()

    const script = `Párrafo uno de prueba.

Párrafo dos con más información relevante.`

    const result = buildScriptStoryboard(script, {
      includeBRollTrack: true,
      presetId: 'hormozi-karaoke',
    })
    expect(result.sceneCount).toBe(2)
    expect(result.totalDuration).toBeGreaterThan(0)

    const state = useEditorStore.getState()
    expect(state.markers.length).toBeGreaterThanOrEqual(2)
    expect(state.markers[0].label).toBe('Escena 1')

    // Verify b-roll clips created on video track
    const mainVideoTrack = state.tracks.find((t) => t.kind === 'video' && t.id !== 'subtitles-track')
    expect(mainVideoTrack).toBeDefined()
    expect(mainVideoTrack?.clips.length).toBe(2)
    expect(mainVideoTrack?.clips[0].title).toMatch(/Toma 1/i)
  })

  it('supports customScenes with user-adjusted timings', () => {
    useEditorStore.getState().resetProject()

    const customScenes = [
      {
        id: 'c1',
        index: 1,
        text: 'Escena ajustada 1',
        duration: 8.0,
        startTime: 0,
        visualPrompt: 'Plano secuencia',
      },
      {
        id: 'c2',
        index: 2,
        text: 'Escena ajustada 2',
        duration: 4.5,
        startTime: 8.0,
        visualPrompt: 'Detalle',
      },
    ]

    const result = buildScriptStoryboard('', { customScenes })
    expect(result.sceneCount).toBe(2)
    expect(result.totalDuration).toBe(12.5)

    const state = useEditorStore.getState()
    expect(state.markers[1].time).toBe(8.0)
  })
})
