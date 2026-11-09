import { describe, expect, it } from 'vitest'
import { spartaTemplateSchema } from '../domain/template.schema'
import { instantiateTemplate } from '../domain/instantiate-template'
import {
  BUILTIN_TEMPLATES,
  STICKMAN_TEMPLATES,
  SOCIAL_TEMPLATES,
  YOUTUBE_TEMPLATES,
  BUSINESS_TEMPLATES,
  EDUCATION_TEMPLATES,
  CINEMATIC_TEMPLATES,
} from './index'

describe('Template Catalog v2 (24 modular templates)', () => {
  it('contains exactly 24 templates across 6 categories', () => {
    expect(BUILTIN_TEMPLATES.length).toBe(24)
    expect(STICKMAN_TEMPLATES.length).toBe(4)
    expect(SOCIAL_TEMPLATES.length).toBe(4)
    expect(YOUTUBE_TEMPLATES.length).toBe(4)
    expect(BUSINESS_TEMPLATES.length).toBe(4)
    expect(EDUCATION_TEMPLATES.length).toBe(4)
    expect(CINEMATIC_TEMPLATES.length).toBe(4)
  })

  it('guarantees unique IDs for all templates', () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('validates every template against the canonical Zod schema', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const result = spartaTemplateSchema.safeParse(template)
      expect(result.success, `Template "${template.id}" failed schema validation: ${result.error?.message}`).toBe(true)
    }
  })

  it('verifies that every slot has a target clip in the tracks', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const clipIds = new Set(template.state.tracks.flatMap((track) => track.clips.map((clip) => clip.id)))
      for (const slot of template.slots) {
        expect(
          clipIds.has(slot.targetClipId),
          `Template "${template.id}" has slot "${slot.id}" targeting nonexistent clip "${slot.targetClipId}"`,
        ).toBe(true)
      }
    }
  })

  it('instantiates each of the 24 templates cleanly with custom fills', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const instantiated = instantiateTemplate(template, {
        projectName: `Custom ${template.name}`,
      })
      expect(instantiated.projectName).toBe(`Custom ${template.name}`)
      expect(instantiated.tracks.length).toBeGreaterThan(0)
      expect(instantiated.sequence.width).toBeGreaterThan(0)
      expect(instantiated.sequence.height).toBeGreaterThan(0)
    }
  })
})

