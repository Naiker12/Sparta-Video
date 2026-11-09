import { describe, expect, it } from 'vitest'
import { instantiateTemplate } from './instantiate-template'
import { spartaTemplateSchema } from './template.schema'
import { BUILTIN_TEMPLATES } from '../catalog/builtin-templates'

describe('Template domain and instantiation (Phase 3)', () => {
  it('all 10 builtin templates conform to spartaTemplateSchema', () => {
    expect(BUILTIN_TEMPLATES.length).toBe(10)
    for (const t of BUILTIN_TEMPLATES) {
      const parsed = spartaTemplateSchema.safeParse(t)
      expect(parsed.success, `Template ${t.id} failed validation: ${parsed.error?.message}`).toBe(true)
    }
  })

  it('instantiateTemplate clones state without mutating template', () => {
    const template = BUILTIN_TEMPLATES[0] // stickman-story-vertical
    const instantiated = instantiateTemplate(template, {
      projectName: 'Mi Historia de Éxito',
      slotFills: {
        'slot-hook-title': {
          type: 'text',
          text: '¡ESTO CAMBIÓ MI VIDA!',
        },
      },
    })

    expect(instantiated.projectName).toBe('Mi Historia de Éxito')
    expect(instantiated.sequence.width).toBe(1080)
    expect(instantiated.sequence.height).toBe(1920)

    // Verify slot replacement took effect
    const hookClip = instantiated.tracks[0].clips.find((c) => c.slotId === 'slot-hook-title')
    expect(hookClip).toBeDefined()
    expect(hookClip?.text).toBe('¡ESTO CAMBIÓ MI VIDA!')

    // Verify original template was NOT mutated
    const originalHook = template.state.tracks[0].clips.find((c) => c.slotId === 'slot-hook-title')
    expect(originalHook?.text).toBe('NADIE CREÍA QUE PODÍA LOGRARLO...')
  })

  it('instantiateTemplate generates default copy name when no name given', () => {
    const template = BUILTIN_TEMPLATES[1] // stickman-explainer
    const instantiated = instantiateTemplate(template)

    expect(instantiated.projectName).toBe(`${template.name} - Copia`)
  })
})

