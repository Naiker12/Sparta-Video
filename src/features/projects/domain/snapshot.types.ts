import type { PersistedProjectState, ProjectId } from './project.types'

export interface ProjectSnapshot {
  id: string
  projectId: ProjectId
  createdAt: string
  label: string
  state: PersistedProjectState
  clipCount: number
  durationSeconds: number
}

