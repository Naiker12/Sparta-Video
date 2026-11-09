import {
  SPARTA_PROJECT_FORMAT,
  SPARTA_PROJECT_VERSION_V2,
  spartaProjectFileV1Schema,
  spartaProjectFileV2Schema,
  type SpartaProjectFileV2,
} from '../domain/project.schema'
import type { ProjectId, ProjectRecord, ProjectSummary } from '../domain/project.types'
import type { ProjectSnapshot } from '../domain/snapshot.types'
import {
  createEmptyProject,
  type CreateProjectOptions,
} from '../domain/project-factory'
import type { ProjectRepository } from './project-repository'
import { defaultProjectRepository } from '../infrastructure/idb-project-repository'

export class ProjectService {
  private repo: ProjectRepository

  constructor(repo: ProjectRepository = defaultProjectRepository) {
    this.repo = repo
  }

  async listProjects(options?: { includeDeleted?: boolean }): Promise<ProjectSummary[]> {
    return this.repo.listSummaries(options)
  }

  async getProject(id: ProjectId): Promise<ProjectRecord | null> {
    return this.repo.getProject(id)
  }

  async createProject(options?: CreateProjectOptions): Promise<ProjectRecord> {
    const project = createEmptyProject(options)
    await this.repo.saveProject(project)
    return project
  }

  async duplicateProject(sourceId: ProjectId): Promise<ProjectRecord> {
    const source = await this.repo.getProject(sourceId)
    if (!source) {
      throw new Error(`Project with ID ${sourceId} not found`)
    }

    const newId = crypto.randomUUID()
    const now = new Date().toISOString()
    const newName = `${source.state.projectName} (2)`

    const duplicated: ProjectRecord = {
      ...source,
      id: newId,
      createdAt: now,
      updatedAt: now,
      origin: { kind: 'import' },
      state: {
        ...source.state,
        projectName: newName,
      },
      workspace: source.workspace ? { ...source.workspace } : undefined,
    }

    await this.repo.saveProject(duplicated)
    return duplicated
  }

  async renameProject(id: ProjectId, newName: string): Promise<void> {
    const project = await this.repo.getProject(id)
    if (!project) {
      throw new Error(`Project with ID ${id} not found`)
    }

    project.state.projectName = newName
    project.updatedAt = new Date().toISOString()
    await this.repo.saveProject(project)
  }

  async deleteProject(id: ProjectId, permanent = false): Promise<void> {
    await this.repo.deleteProject(id, permanent)
  }

  async restoreProject(id: ProjectId): Promise<void> {
    await this.repo.restoreProject(id)
  }

  async emptyTrash(): Promise<void> {
    await this.repo.emptyTrash()
  }

  async importProjectFromData(raw: unknown): Promise<ProjectRecord> {
    const now = new Date().toISOString()
    const newId = crypto.randomUUID()

    // Try V2 schema first
    const v2Parsed = spartaProjectFileV2Schema.safeParse(raw)
    if (v2Parsed.success) {
      const v2 = v2Parsed.data
      const record: ProjectRecord = {
        id: newId,
        schemaVersion: 2,
        createdAt: v2.createdAt || now,
        updatedAt: now,
        origin: { kind: 'import' },
        state: v2.project,
        workspace: v2.workspace,
      }
      await this.repo.saveProject(record)
      return record
    }

    // Fallback to V1 schema
    const v1Parsed = spartaProjectFileV1Schema.safeParse(raw)
    if (v1Parsed.success) {
      const v1 = v1Parsed.data
      const record: ProjectRecord = {
        id: newId,
        schemaVersion: 2,
        createdAt: v1.createdAt || now,
        updatedAt: now,
        origin: { kind: 'import' },
        state: {
          projectName: v1.project.name,
          sequence: v1.project.sequence,
          tracks: v1.project.tracks,
          assets: v1.project.assets,
          markers: v1.project.markers ?? [],
          snapToFrames: v1.project.snapToFrames ?? true,
          mutedTracks: [],
          lockedTracks: [],
        },
        workspace: {
          playhead: 0,
          zoom: 1,
          selectedClipId: null,
        },
      }
      await this.repo.saveProject(record)
      return record
    }

    throw new Error('Formato de archivo .sparta no válido o corrupto')
  }

  exportProjectToData(record: ProjectRecord): SpartaProjectFileV2 {
    return {
      format: SPARTA_PROJECT_FORMAT,
      version: SPARTA_PROJECT_VERSION_V2,
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      project: record.state,
      workspace: record.workspace,
    }
  }

  async listSnapshots(projectId: ProjectId): Promise<ProjectSnapshot[]> {
    return this.repo.listSnapshots(projectId)
  }

  async createSnapshot(projectId: ProjectId, label: string): Promise<ProjectSnapshot> {
    const project = await this.repo.getProject(projectId)
    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    const clipCount = project.state.tracks.reduce((sum, t) => sum + t.clips.length, 0)
    const maxTime = project.state.tracks.reduce((max, t) => {
      const trackEnd = t.clips.reduce((e, c) => Math.max(e, c.start + c.duration), 0)
      return Math.max(max, trackEnd)
    }, 0)

    const snapshot: ProjectSnapshot = {
      id: crypto.randomUUID(),
      projectId,
      createdAt: new Date().toISOString(),
      label: label.trim() || 'Snapshot',
      state: JSON.parse(JSON.stringify(project.state)) as ProjectRecord['state'],
      clipCount,
      durationSeconds: maxTime,
    }

    await this.repo.saveSnapshot(snapshot)
    return snapshot
  }

  async restoreSnapshot(projectId: ProjectId, snapshotId: string): Promise<ProjectRecord> {
    const snapshot = await this.repo.getSnapshot(snapshotId)
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`)
    }

    const project = await this.repo.getProject(projectId)
    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    project.state = JSON.parse(JSON.stringify(snapshot.state)) as ProjectRecord['state']
    project.updatedAt = new Date().toISOString()
    await this.repo.saveProject(project)
    return project
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.repo.deleteSnapshot(snapshotId)
  }
}

export const defaultProjectService = new ProjectService()

