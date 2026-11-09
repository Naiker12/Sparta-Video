import type { ProjectId, ProjectRecord, ProjectSummary } from '../domain/project.types'
import type { ProjectSnapshot } from '../domain/snapshot.types'

export interface ListSummariesOptions {
  includeDeleted?: boolean
}

export interface ProjectRepository {
  listSummaries(options?: ListSummariesOptions): Promise<ProjectSummary[]>
  getSummary(id: ProjectId): Promise<ProjectSummary | null>
  getProject(id: ProjectId): Promise<ProjectRecord | null>
  saveProject(record: ProjectRecord): Promise<void>
  saveSummary(summary: ProjectSummary): Promise<void>
  deleteProject(id: ProjectId, permanent?: boolean): Promise<void>
  restoreProject(id: ProjectId): Promise<void>
  emptyTrash(): Promise<void>
  getMeta<T>(key: string): Promise<T | null>
  setMeta<T>(key: string, value: T): Promise<void>
  getAllProjectIds(): Promise<ProjectId[]>
  getAllProjects(): Promise<ProjectRecord[]>

  // Snapshot / version history
  listSnapshots(projectId: ProjectId): Promise<ProjectSnapshot[]>
  getSnapshot(id: string): Promise<ProjectSnapshot | null>
  saveSnapshot(snapshot: ProjectSnapshot): Promise<void>
  deleteSnapshot(id: string): Promise<void>
}

