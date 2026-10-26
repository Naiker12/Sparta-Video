import { z } from 'zod'

export const MediaMetadataSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  status: z.enum(['catalog-only', 'ready', 'missing', 'processing', 'error']),
})
export type MediaMetadata = z.infer<typeof MediaMetadataSchema>
