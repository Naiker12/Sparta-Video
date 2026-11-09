import { describe, expect, it } from 'vitest'
import { parseScriptIntoScenes, buildScriptStoryboard } from './script-to-video'
import { useEditorStore } from '../editor-store'

describe('Script to Video / Storyboard generator', () => {
  it('parses paragraphs into timed scenes', () => {
    const script = `Había una vez un stickman que soñaba con crear videos virales.

Pero cada vez que abría su editor, se perdía entre menús complejos y botones confusos.

Hasta que descubrió Sparta Video y pudo automatizar todo su flujo en minutos.`

    const scenes = parseScriptIntoScenes(script, { wpm: 120 })
    expect(scenes).toHaveLength(3)
    expect(scenes[0].index).toBe(1)
    expect(scenes[0].startTime).toBe(0)
    expect(scenes[0].duration).toBeGreaterThanOrEqual(2.5)

    expect(scenes[1].index).toBe(2)
    expect(scenes[1].startTime).toBe(scenes[0].duration)

    expect(scenes[2].index).toBe(3)
  })

  it('builds storyboard into editor store and adds markers', () => {
    useEditorStore.getState().resetProject()

    const script = `Párrafo uno de prueba.

Párrafo dos con más información relevante.`

    const result = buildScriptStoryboard(script)
    expect(result.sceneCount).toBe(2)
    expect(result.totalDuration).toBeGreaterThan(0)

    const state = useEditorStore.getState()
    expect(state.markers.length).toBeGreaterThanOrEqual(2)
    expect(state.markers[0].label).toBe('Escena 1')
  })
})

