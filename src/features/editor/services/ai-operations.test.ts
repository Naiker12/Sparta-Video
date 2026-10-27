import { beforeEach, describe, expect, it } from 'vitest'
import { extractAIProposal, applyAIOperations, formatOperationLabel, type AIProposal } from './ai-operations'
import { useEditorStore } from '../editor-store'
import { demoTracks, demoMedia } from '../editor-store.fixtures'

describe('AI operations and proposal parser', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectName: 'Test Video',
      sequence: { width: 1920, height: 1080, frameRate: 24 },
      tracks: demoTracks,
      assets: demoMedia,
      markers: [],
      snapToFrames: true,
      mutedTracks: [],
      lockedTracks: [],
    })
  })

  it('extracts structured proposal from markdown json codeblock', () => {
    const raw = `Te sugiero esta estructura para mejorar el ritmo:
\`\`\`json
{
  "title": "Ajuste de ritmo y transiciones",
  "summary": "Corta la introducción y añade un marcador de clímax.",
  "operations": [
    { "type": "add_marker", "time": 10.5, "label": "Clímax" },
    { "type": "set_clip_volume", "clipId": "c2", "volume": 80 }
  ]
}
\`\`\`
¿Te parece bien?`

    const proposal = extractAIProposal(raw)
    expect(proposal).not.toBeNull()
    expect(proposal?.title).toBe('Ajuste de ritmo y transiciones')
    expect(proposal?.operations).toHaveLength(2)
    expect(proposal?.operations[0]).toEqual({ type: 'add_marker', time: 10.5, label: 'Clímax' })
  })

  it('applies operations safely to the editor store', () => {
    const proposal: AIProposal = {
      title: 'Mejoras automáticas',
      summary: 'Añadir marcador y ajustar volumen',
      operations: [
        { type: 'add_marker', time: 4.5, label: 'Punto de interés' },
        { type: 'set_clip_volume', clipId: 'c2', volume: 65 },
        { type: 'add_track', kind: 'audio' },
      ],
    }

    const result = applyAIOperations(proposal.operations)
    expect(result.applied).toBe(3)
    expect(result.failed).toBe(0)

    const state = useEditorStore.getState()
    expect(state.markers.some((m) => m.label === 'Punto de interés')).toBe(true)
    const clip2 = state.tracks.flatMap((t) => t.clips).find((c) => c.id === 'c2')
    expect(clip2?.volume).toBe(65)
  })

  it('formats human readable labels for each operation type', () => {
    expect(formatOperationLabel({ type: 'add_marker', time: 3, label: 'Test' })).toContain('Test')
    expect(formatOperationLabel({ type: 'delete_clip', clipId: 'c1' })).toContain('c1')
    expect(formatOperationLabel({ type: 'set_clip_volume', clipId: 'c2', volume: 50 })).toContain('50%')
  })
})
