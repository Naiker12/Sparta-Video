import { z } from 'zod'
import type { EditorState, PersistedProjectState } from '../editor-store'
import { useEditorStore } from '../editor-store'
import { t } from './locale'
import { toast } from '../../../components/ui/toast-service'

export const SPARTA_PROJECT_FORMAT = 'sparta-video-project'
export const SPARTA_PROJECT_VERSION = 1
export const SPARTA_PROJECT_EXTENSION = '.sparta'

const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
  rotation: z.number(),
}).optional()

const clipSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceAssetId: z.string().optional(),
  start: z.number(),
  duration: z.number(),
  color: z.string(),
  thumbnail: z.string(),
  kind: z.enum(['video', 'audio', 'adjustment']),
  transform: transformSchema,
  uniformScale: z.boolean().optional(),
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
  keyframes: z.array(z.object({
    property: z.enum(['position', 'scale', 'rotation', 'opacity']),
    time: z.number(),
    value: z.number().optional(),
    valueX: z.number().optional(),
    valueY: z.number().optional(),
  })).optional(),
})

const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['video', 'audio']),
  clips: z.array(clipSchema),
})

const mediaItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  thumb: z.string(),
  type: z.enum(['video', 'audio', 'image']),
  sourcePath: z.string().optional(),
  status: z.enum(['catalog-only', 'ready', 'processing', 'missing', 'error']).optional(),
})

const markerSchema = z.object({
  id: z.string(),
  time: z.number(),
  label: z.string(),
  color: z.string().optional(),
})

const sequenceSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frameRate: z.number().positive(),
})

export const spartaProjectFileSchema = z.object({
  format: z.literal(SPARTA_PROJECT_FORMAT),
  version: z.number().int().positive(),
  createdAt: z.string(),
  modifiedAt: z.string(),
  project: z.object({
    name: z.string().min(1),
    sequence: sequenceSchema,
    tracks: z.array(trackSchema),
    assets: z.array(mediaItemSchema),
    markers: z.array(markerSchema),
    snapToFrames: z.boolean().default(true),
    mutedTracks: z.array(z.string()).default([]),
    lockedTracks: z.array(z.string()).default([]),
  }),
})

export type SpartaProjectFile = z.infer<typeof spartaProjectFileSchema>

export function exportProjectData(state?: EditorState): SpartaProjectFile {
  const current = state ?? useEditorStore.getState()
  return {
    format: SPARTA_PROJECT_FORMAT,
    version: SPARTA_PROJECT_VERSION,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    project: {
      name: current.projectName,
      sequence: current.sequence,
      tracks: current.tracks,
      assets: current.assets,
      markers: current.markers,
      snapToFrames: current.snapToFrames,
      mutedTracks: current.mutedTracks,
      lockedTracks: current.lockedTracks,
    },
  }
}

export function downloadProjectFile(fileContent: SpartaProjectFile) {
  const json = JSON.stringify(fileContent, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const safeName = fileContent.project.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').trim() || 'proyecto'
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeName}${SPARTA_PROJECT_EXTENSION}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseProjectFile(rawJson: string): SpartaProjectFile {
  const raw = JSON.parse(rawJson)
  return spartaProjectFileSchema.parse(raw)
}

export function loadProjectFromFile(fileData: SpartaProjectFile) {
  const p = fileData.project
  const state: PersistedProjectState = {
    projectName: p.name,
    sequence: p.sequence,
    tracks: p.tracks,
    assets: p.assets,
    markers: p.markers,
    snapToFrames: p.snapToFrames,
    mutedTracks: p.mutedTracks,
    lockedTracks: p.lockedTracks,
  }
  useEditorStore.getState().loadProject(state)
}

export async function openProjectFromFile(file: File): Promise<boolean> {
  try {
    const text = await file.text()
    const parsed = parseProjectFile(text)
    loadProjectFromFile(parsed)
    toast.success(t('Proyecto abierto', 'Project opened'), { description: parsed.project.name })
    return true
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    toast.error(t('No se pudo abrir el archivo de proyecto', 'Could not open project file'), {
      description: message.includes('JSON') ? t('El archivo está dañado o no es un JSON válido.', 'The file is corrupt or invalid JSON.') : message,
    })
    return false
  }
}
