import { defaultProjectRepository } from '../features/projects/infrastructure/idb-project-repository'
import { migrateLegacyProject } from '../features/projects/application/legacy-migration'
import { generateProjectCover } from '../features/projects/application/cover-capture'
import {
  readStoredLastProjectId,
  readStoredOpenBehavior,
  useAppShellStore,
} from './app-shell-store'
import { useEditorStore } from '../features/editor/editor-store'

let bootstrapRan = false

export async function bootstrapApp(): Promise<void> {
  if (bootstrapRan) return
  bootstrapRan = true

  // 1. Request persistent storage if supported
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist()
    } catch {
      /* ignore */
    }
  }

  // 2. Run legacy migration if needed
  try {
    const migrationResult = await migrateLegacyProject(defaultProjectRepository)
    if (migrationResult.migrated && migrationResult.projectId) {
      useAppShellStore.getState().setCurrentProjectId(migrationResult.projectId)
      try {
        const migratedProject = await defaultProjectRepository.getProject(migrationResult.projectId)
        if (migratedProject) {
          void generateProjectCover(migratedProject.id, migratedProject.state)
        }
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.error('Error during legacy migration:', err)
  }

  // 3. Respect user preference: Open on Home vs Last Project
  const behavior = readStoredOpenBehavior()
  const lastProjectId = readStoredLastProjectId()

  if (behavior === 'last-project' && lastProjectId) {
    try {
      const project = await defaultProjectRepository.getProject(lastProjectId)
      if (project) {
        useEditorStore.getState().loadProject(project.state)
        if (project.workspace) {
          useEditorStore.setState({
            playhead: project.workspace.playhead ?? 0,
            zoom: project.workspace.zoom ?? 1,
            selectedClipId: project.workspace.selectedClipId ?? '',
          })
        }
        useAppShellStore.getState().openProject(lastProjectId)
        return
      }
    } catch {
      /* fallback to home */
    }
  }

  // Default: show home view
  useAppShellStore.getState().setView('home')
}
