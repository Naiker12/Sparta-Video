import { z } from 'zod'
import { useEditorStore } from '../editor-store'
import { t } from './locale'

export const aiOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_marker'),
    time: z.number().nonnegative(),
    label: z.string().min(1),
  }),
  z.object({
    type: z.literal('split_clip'),
    clipId: z.string(),
    time: z.number().positive(),
  }),
  z.object({
    type: z.literal('delete_clip'),
    clipId: z.string(),
  }),
  z.object({
    type: z.literal('move_clip'),
    clipId: z.string(),
    start: z.number().nonnegative(),
    duration: z.number().positive().optional(),
  }),
  z.object({
    type: z.literal('set_clip_volume'),
    clipId: z.string(),
    volume: z.number().min(0).max(200),
  }),
  z.object({
    type: z.literal('set_clip_opacity'),
    clipId: z.string(),
    opacity: z.number().min(0).max(100),
  }),
  z.object({
    type: z.literal('add_track'),
    kind: z.enum(['video', 'audio']),
  }),
])

export type AIOperation = z.infer<typeof aiOperationSchema>

export const aiProposalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  operations: z.array(aiOperationSchema).min(1),
})

export type AIProposal = z.infer<typeof aiProposalSchema>

/**
 * Parses markdown code blocks with ```json or plain json looking for a structured proposal.
 */
export function extractAIProposal(text: string): AIProposal | null {
  const jsonBlocks = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/gi)
  const candidates: string[] = []
  if (jsonBlocks) {
    for (const block of jsonBlocks) {
      const match = block.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
      if (match?.[1]) candidates.push(match[1])
    }
  }
  // Also check if the raw text is JSON or starts with { "operations" ...
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1))
  }

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw)
      const valid = aiProposalSchema.safeParse(parsed)
      if (valid.success) return valid.data
    } catch {
      continue
    }
  }
  return null
}

/**
 * Applies a list of validated AI operations onto the editor store as a single undoable transaction.
 */
export function applyAIOperations(operations: AIOperation[]): { applied: number; failed: number } {
  const store = useEditorStore.getState()
  let applied = 0
  let failed = 0

  for (const op of operations) {
    try {
      switch (op.type) {
        case 'add_marker': {
          store.addMarker(op.time, op.label)
          applied += 1
          break
        }
        case 'split_clip': {
          const track = store.tracks.find((trk) => trk.clips.some((c) => c.id === op.clipId))
          const clip = track?.clips.find((c) => c.id === op.clipId)
          if (clip && op.time > clip.start && op.time < clip.start + clip.duration) {
            store.splitClip(op.clipId, op.time)
            applied += 1
          } else {
            failed += 1
          }
          break
        }
        case 'delete_clip': {
          const exists = store.tracks.some((trk) => trk.clips.some((c) => c.id === op.clipId))
          if (exists) {
            store.deleteClip(op.clipId)
            applied += 1
          } else {
            failed += 1
          }
          break
        }
        case 'move_clip': {
          const exists = store.tracks.some((trk) => trk.clips.some((c) => c.id === op.clipId))
          if (exists) {
            store.moveClip(op.clipId, op.start, op.duration)
            applied += 1
          } else {
            failed += 1
          }
          break
        }
        case 'set_clip_volume': {
          const exists = store.tracks.some((trk) => trk.clips.some((c) => c.id === op.clipId))
          if (exists) {
            store.updateClip(op.clipId, { volume: op.volume })
            applied += 1
          } else {
            failed += 1
          }
          break
        }
        case 'set_clip_opacity': {
          const exists = store.tracks.some((trk) => trk.clips.some((c) => c.id === op.clipId))
          if (exists) {
            store.updateClip(op.clipId, { opacity: op.opacity })
            applied += 1
          } else {
            failed += 1
          }
          break
        }
        case 'add_track': {
          store.addTrack(op.kind)
          applied += 1
          break
        }
      }
    } catch {
      failed += 1
    }
  }

  return { applied, failed }
}

export function formatOperationLabel(op: AIOperation): string {
  switch (op.type) {
    case 'add_marker': return `${t('Añadir marcador', 'Add marker')} "${op.label}" (${op.time}s)`
    case 'split_clip': return `${t('Cortar clip', 'Split clip')} [${op.clipId}] en ${op.time}s`
    case 'delete_clip': return `${t('Eliminar clip', 'Delete clip')} [${op.clipId}]`
    case 'move_clip': return `${t('Mover clip', 'Move clip')} [${op.clipId}] a ${op.start}s`
    case 'set_clip_volume': return `${t('Volumen de clip', 'Clip volume')} [${op.clipId}] = ${op.volume}%`
    case 'set_clip_opacity': return `${t('Opacidad de clip', 'Clip opacity')} [${op.clipId}] = ${op.opacity}%`
    case 'add_track': return `${t('Añadir pista de', 'Add track')} ${op.kind === 'video' ? t('video', 'video') : t('audio', 'audio')}`
  }
}
