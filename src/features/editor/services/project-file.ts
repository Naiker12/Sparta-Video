import { z } from 'zod'
import type { EditorState, PersistedProjectState } from '../editor-store'
import { useEditorStore } from '../editor-store'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'
import {
  clipSchema,
  mediaItemSchema,
  markerSchema,
  sequenceSchema,
  SPARTA_PROJECT_EXTENSION,
  SPARTA_PROJECT_FORMAT,
  SPARTA_PROJECT_VERSION_V1,
  SPARTA_PROJECT_VERSION_V2,
  trackSchema,
} from '../../projects/domain/project.schema'

export { clipSchema, mediaItemSchema, markerSchema, sequenceSchema, trackSchema, SPARTA_PROJECT_EXTENSION, SPARTA_PROJECT_FORMAT }
export const SPARTA_PROJECT_VERSION = SPARTA_PROJECT_VERSION_V2

export const spartaProjectFileV1Schema = z.object({
  format: z.literal(SPARTA_PROJECT_FORMAT),
  version: z.literal(SPARTA_PROJECT_VERSION_V1),
  createdAt: z.string(),
  modifiedAt: z.string().optional(),
  project: z.object({
    name: z.string().min(1),
    sequence: sequenceSchema,
    tracks: z.array(trackSchema),
    assets: z.array(mediaItemSchema),
    markers: z.array(markerSchema).default([]),
    snapToFrames: z.boolean().default(true),
    mutedTracks: z.array(z.string()).default([]),
    lockedTracks: z.array(z.string()).default([]),
  }),
})

export const spartaProjectFileV2Schema = z.object({
  format: z.literal(SPARTA_PROJECT_FORMAT),
  version: z.literal(SPARTA_PROJECT_VERSION_V2),
  id: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string().optional(),
  project: z.object({
    name: z.string().min(1).optional(),
    projectName: z.string().min(1).optional(),
    sequence: sequenceSchema,
    tracks: z.array(trackSchema),
    assets: z.array(mediaItemSchema),
    markers: z.array(markerSchema).default([]),
    snapToFrames: z.boolean().default(true),
    mutedTracks: z.array(z.string()).default([]),
    lockedTracks: z.array(z.string()).default([]),
  }).refine((p) => !!(p.name || p.projectName), { message: 'Project name is required' }),
})

export const spartaProjectFileSchema = z.union([spartaProjectFileV2Schema, spartaProjectFileV1Schema])

export type SpartaProjectFileV1 = z.infer<typeof spartaProjectFileV1Schema>
export type SpartaProjectFile = z.infer<typeof spartaProjectFileV2Schema>

export function exportProjectData(state?: EditorState): SpartaProjectFile {
  const current = state ?? useEditorStore.getState()
  return {
    format: SPARTA_PROJECT_FORMAT,
    version: SPARTA_PROJECT_VERSION_V2,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    project: {
      name: current.projectName,
      projectName: current.projectName,
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

export type SpartaDownloadableProject =
  | SpartaProjectFile
  | SpartaProjectFileV1
  | {
      project: {
        name?: string
        projectName?: string
      }
    }

export function downloadProjectFile(fileContent: SpartaDownloadableProject) {
  const json = JSON.stringify(fileContent, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const projName =
    ('projectName' in fileContent.project && fileContent.project.projectName) ||
    ('name' in fileContent.project && fileContent.project.name) ||
    'proyecto'
  const safeName = String(projName).replace(/[^\p{L}\p{N}_-]+/gu, '_').trim() || 'proyecto'
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
  const parsed = spartaProjectFileSchema.parse(raw)
  if (parsed.version === 1) {
    return {
      format: SPARTA_PROJECT_FORMAT,
      version: SPARTA_PROJECT_VERSION_V2,
      id: crypto.randomUUID(),
      createdAt: parsed.createdAt,
      modifiedAt: parsed.modifiedAt,
      project: {
        name: parsed.project.name,
        projectName: parsed.project.name,
        sequence: parsed.project.sequence,
        tracks: parsed.project.tracks,
        assets: parsed.project.assets,
        markers: parsed.project.markers ?? [],
        snapToFrames: parsed.project.snapToFrames ?? true,
        mutedTracks: parsed.project.mutedTracks ?? [],
        lockedTracks: parsed.project.lockedTracks ?? [],
      },
    }
  }
  return parsed
}

export function loadProjectFromFile(fileData: SpartaProjectFile) {
  const p = fileData.project
  const name = p.name || p.projectName || 'Sin título'
  const state: PersistedProjectState = {
    projectName: name,
    sequence: p.sequence,
    tracks: p.tracks,
    assets: p.assets,
    markers: p.markers ?? [],
    snapToFrames: p.snapToFrames ?? true,
    mutedTracks: p.mutedTracks ?? [],
    lockedTracks: p.lockedTracks ?? [],
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
      description: message.includes('JSON')
        ? t('El archivo está dañado o no es un JSON válido.', 'The file is corrupt or invalid JSON.')
        : message,
    })
    return false
  }
}
