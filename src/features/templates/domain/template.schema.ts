import { z } from 'zod'
import { persistedProjectStateSchema } from '../../projects/domain/project.schema'

export const templateCategorySchema = z.enum([
  'stickman',
  'social-media',
  'youtube',
  'business',
  'education',
  'cinematic',
  'general',
])

export const templateFormatSchema = z.enum(['16:9', '9:16', '1:1', '4:5', '21:9'])

export const slotTypeSchema = z.enum(['video', 'audio', 'image', 'text', 'color', 'number'])

export const templateSlotSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: slotTypeSchema,
  targetClipId: z.string(),
  targetProperty: z.enum(['text', 'color', 'fillColor', 'asset', 'fontSize']).optional(),
  description: z.string().optional(),
  defaultText: z.string().optional(),
  defaultValue: z.union([z.string(), z.number()]).optional(),
  recommendedDuration: z.number().positive().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
})

export const slotGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  slotIds: z.array(z.string()),
})

export const spartaTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  category: templateCategorySchema,
  format: templateFormatSchema,
  durationSeconds: z.number().nonnegative(),
  thumbnail: z.string().optional(),
  isBuiltIn: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  slots: z.array(templateSlotSchema).default([]),
  slotGroups: z.array(slotGroupSchema).optional(),
  state: persistedProjectStateSchema,
})

