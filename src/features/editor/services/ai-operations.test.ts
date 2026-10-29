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
    expect(formatOperationLabel({ type: 'set_clip_fades', clipId: 'c1', fadeIn: 0.5, fadeOut: 0.5 })).toContain('c1')
    expect(formatOperationLabel({ type: 'set_sequence', width: 1080, height: 1920, frameRate: 30 })).toContain('1080×1920')
  })

  it('applies extended AI studio operations (fades, transform, sequence, pack_clips)', () => {
    const result = applyAIOperations([
      { type: 'set_clip_fades', clipId: 'c1', fadeIn: 0.6, fadeOut: 0.8 },
      { type: 'set_clip_transform', clipId: 'c1', scaleX: 115, scaleY: 115 },
      { type: 'set_clip_blend', clipId: 'c1', blendMode: 'screen' },
      { type: 'duplicate_clip', clipId: 'c1' },
      { type: 'pack_clips', trackId: 'v1' },
      { type: 'set_sequence', width: 1080, height: 1920, frameRate: 30 },
    ])
    expect(result.applied).toBe(6)
    expect(result.failed).toBe(0)
    const state = useEditorStore.getState()
    const c1 = state.tracks[0].clips.find((c) => c.id === 'c1')
    expect(c1?.fadeIn).toBe(0.6)
    expect(c1?.fadeOut).toBe(0.8)
    expect(c1?.transform?.scaleX).toBe(115)
    expect(c1?.blendMode).toBe('screen')
    expect(state.sequence).toEqual({ width: 1080, height: 1920, frameRate: 30 })
  })

  it('applies add_text_clip and generate_subtitles AI operations onto the timeline', () => {
    const result = applyAIOperations([
      {
        type: 'add_text_clip',
        text: 'GANCHO INICIAL PRO',
        start: 0,
        duration: 2.5,
        presetId: 'editorial-hook',
      },
      {
        type: 'generate_subtitles',
        presetId: 'hormozi-karaoke',
        entries: [
          { text: 'Uno dos tres probando', start: 3, duration: 2 },
          { text: 'Subtítulos con karaoke activo', start: 5.2, duration: 2.4 },
        ],
      },
    ])
    expect(result.applied).toBe(2)
    expect(result.failed).toBe(0)
    const allClips = useEditorStore.getState().tracks.flatMap((t) => t.clips)
    expect(allClips.some((c) => c.text === 'GANCHO INICIAL PRO')).toBe(true)
    expect(allClips.some((c) => c.text === 'Subtítulos con karaoke activo')).toBe(true)
    expect(formatOperationLabel({ type: 'add_text_clip', text: 'HOLA', start: 1 })).toContain('HOLA')
  })
})
