import { z } from 'zod'

export const SPARTA_PROJECT_FORMAT = 'sparta-video-project'
export const SPARTA_PROJECT_VERSION_V1 = 1
export const SPARTA_PROJECT_VERSION_V2 = 2
export const SPARTA_PROJECT_EXTENSION = '.sparta'

export const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
  rotation: z.number(),
})

export const keyframeSchema = z.object({
  property: z.enum(['position', 'scale', 'rotation', 'opacity']),
  time: z.number(),
  value: z.number().optional(),
  valueX: z.number().optional(),
  valueY: z.number().optional(),
})

export const textStyleSchema = z.object({
  presetId: z.string(),
  fontFamily: z.string(),
  fontSize: z.number(),
  fontWeight: z.number(),
  color: z.string(),
  accentColor: z.string(),
  strokeColor: z.string(),
  strokeWidth: z.number(),
  backgroundColor: z.string(),
  backgroundOpacity: z.number(),
  backgroundRadius: z.number(),
  shadowColor: z.string(),
  shadowBlur: z.number(),
  align: z.enum(['left', 'center', 'right']),
  positionY: z.number(),
  uppercase: z.boolean(),
  italic: z.boolean(),
  letterSpacing: z.number(),
})

export const textAnimationSchema = z.object({
  in: z.enum(['none', 'pop', 'fade-up', 'typewriter', 'karaoke', 'slide-left', 'bounce', 'glitch', 'zoom-in']),
  out: z.enum(['none', 'fade-out', 'pop-out', 'slide-down']),
  loop: z.enum(['none', 'pulse', 'float', 'neon-flicker']),
  inDuration: z.number(),
  outDuration: z.number(),
})

export const clipAnimationSchema = z.object({
  combo: z.enum([
    'none',
    'zoom-in',
    'zoom-out',
    'ken-burns-in',
    'ken-burns-out',
    'pan-left',
    'pan-right',
    'pan-up',
    'pan-down',
    'ken-burns-mix',
    'pulse',
    'float-up',
    'slow-rotate',
    'drift-right',
    'zoom-pulse',
  ]),
  intensity: z.number(),
})

export const clipSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceAssetId: z.string().optional(),
  start: z.number(),
  duration: z.number(),
  color: z.string(),
  thumbnail: z.string(),
  kind: z.enum(['video', 'audio', 'adjustment']),
  transform: transformSchema.optional(),
  uniformScale: z.boolean().optional(),
  opacity: z.number().min(0).max(100).optional(),
  blendMode: z.enum(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'soft-light', 'add']).optional(),
  fit: z.enum(['fit', 'fill', 'stretch']).optional(),
  crop: z.object({ l: z.number(), t: z.number(), r: z.number(), b: z.number() }).optional(),
  flipH: z.boolean().optional(),
  flipV: z.boolean().optional(),
  speed: z.number().optional(),
  preservePitch: z.boolean().optional(),
  freezeTime: z.number().optional(),
  effects: z.array(z.object({
    id: z.string(),
    effectId: z.string(),
    enabled: z.boolean(),
    intensity: z.number(),
    params: z.record(z.string(), z.number()),
  })).optional(),
  transitionIn: z.object({
    effectId: z.string(),
    duration: z.number(),
    params: z.record(z.string(), z.number()).optional(),
  }).optional(),
  transitionOut: z.object({
    effectId: z.string(),
    duration: z.number(),
    params: z.record(z.string(), z.number()).optional(),
  }).optional(),
  volume: z.number().optional(),
  fadeIn: z.number().optional(),
  fadeOut: z.number().optional(),
  keyframes: z.array(keyframeSchema).optional(),
  text: z.string().optional(),
  textStyle: textStyleSchema.optional(),
  textAnimation: textAnimationSchema.optional(),
  clipAnimation: clipAnimationSchema.optional(),
  slotId: z.string().optional(),
})

export const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['video', 'audio']),
  clips: z.array(clipSchema),
})

export const mediaItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  thumb: z.string(),
  type: z.enum(['video', 'audio', 'image']),
  durationSeconds: z.number().optional(),
  sourcePath: z.string().optional(),
  status: z.enum(['catalog-only', 'ready', 'processing', 'missing', 'error']).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
})

export const markerSchema = z.object({
  id: z.string(),
  time: z.number(),
  label: z.string(),
  color: z.string().optional(),
})

export const sequenceSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frameRate: z.number().positive(),
})

export const persistedProjectStateSchema = z.object({
  projectName: z.string(),
  sequence: sequenceSchema,
  tracks: z.array(trackSchema),
  assets: z.array(mediaItemSchema),
  markers: z.array(markerSchema).default([]),
  snapToFrames: z.boolean().default(true),
  mutedTracks: z.array(z.string()).default([]),
  lockedTracks: z.array(z.string()).default([]),
})

export const projectWorkspaceSchema = z.object({
  playhead: z.number().default(0),
  zoom: z.number().default(1),
  selectedClipId: z.string().nullable().default(null),
})

export const projectOriginSchema = z.object({
  kind: z.enum(['blank', 'template', 'import']),
  templateId: z.string().optional(),
})

export const projectRecordSchema = z.object({
  id: z.string(),
  schemaVersion: z.literal(2).default(2),
  createdAt: z.string(),
  updatedAt: z.string(),
  origin: projectOriginSchema.optional(),
  state: persistedProjectStateSchema,
  workspace: projectWorkspaceSchema.optional(),
})

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  durationSeconds: z.number(),
  clipCount: z.number(),
  sequence: sequenceSchema,
  coverBlobKey: z.string().optional(),
  coverAssetId: z.string().optional(),
  hasMissingMedia: z.boolean().default(false),
  deletedAt: z.string().optional(),
})

export const spartaProjectFileV1Schema = z.object({
  format: z.literal(SPARTA_PROJECT_FORMAT),
  version: z.literal(SPARTA_PROJECT_VERSION_V1),
  createdAt: z.string(),
  project: z.object({
    name: z.string(),
    sequence: sequenceSchema,
    tracks: z.array(trackSchema),
    assets: z.array(mediaItemSchema),
    markers: z.array(markerSchema).optional(),
    snapToFrames: z.boolean().optional(),
  }),
})

export const spartaProjectFileV2Schema = z.object({
  format: z.literal(SPARTA_PROJECT_FORMAT),
  version: z.literal(SPARTA_PROJECT_VERSION_V2),
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  project: persistedProjectStateSchema,
  workspace: projectWorkspaceSchema.optional(),
})

export type SpartaProjectFileV1 = z.infer<typeof spartaProjectFileV1Schema>
export type SpartaProjectFileV2 = z.infer<typeof spartaProjectFileV2Schema>
export type SpartaProjectFile = SpartaProjectFileV2

