import { useEffect, useRef, useState } from 'react'
import { bootstrapApp } from './bootstrap'
import { useAppShellStore } from './app-shell-store'
import { HomeScreen } from '../features/projects/ui/HomeScreen'
import { NewProjectDialog } from '../features/projects/ui/NewProjectDialog'
import { App } from '../App'
import { defaultProjectRepository } from '../features/projects/infrastructure/idb-project-repository'
import { defaultProjectService } from '../features/projects/application/project-service'
import { ProjectAutosave } from '../features/projects/application/autosave'
import { getPersistable, setProjectSaveStatus, useEditorStore } from '../features/editor/editor-store'
import { generateProjectCover } from '../features/projects/application/cover-capture'
import { PreferencesSheet } from '../features/editor/components/PreferencesSheet'
import { t, useLanguage } from '../shared/i18n/locale'
import { toast } from '../shared/ui/toast-service'

export function AppRoot() {
  useLanguage()
  const view = useAppShellStore((state) => state.view)
  const currentProjectId = useAppShellStore((state) => state.currentProjectId)
  const openProjectAction = useAppShellStore((state) => state.openProject)
  const goHomeAction = useAppShellStore((state) => state.goHome)

  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const autosaveRef = useRef<ProjectAutosave | null>(null)

  useEffect(() => {
    void bootstrapApp()
  }, [])

  // Manage autosave instance for current project
  useEffect(() => {
    if (view === 'editor' && currentProjectId) {
      // 1. Create autosave for this project
      const autosave = new ProjectAutosave({
        projectId: currentProjectId,
        getState: () => getPersistable(),
        getWorkspace: () => {
          const st = useEditorStore.getState()
          return {
            playhead: st.playhead,
            zoom: st.zoom,
            selectedClipId: st.selectedClipId || null,
          }
        },
        debounceMs: 600,
        onStatusChange: (status) => setProjectSaveStatus(status),
      })

      autosaveRef.current = autosave

      // 2. Subscribe to store changes to schedule autosave
      const unsubscribeStore = useEditorStore.subscribe(() => {
        autosave.scheduleSave()
      })

      // 3. Flush on beforeunload
      const handleBeforeUnload = () => {
        void autosave.flush()
      }
      window.addEventListener('beforeunload', handleBeforeUnload)

      // 4. Listen for retry save event
      const handleRetry = () => {
        void autosave.performSave()
      }
      window.addEventListener('sparta-project-save-retry', handleRetry)

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        window.removeEventListener('sparta-project-save-retry', handleRetry)
        unsubscribeStore()
        void autosave.stop()
        autosaveRef.current = null
      }
    }
  }, [view, currentProjectId])

  const handleOpenProject = async (id: string) => {
    try {
      const record = await defaultProjectRepository.getProject(id)
      if (!record) {
        toast.error(t('No se encontró el proyecto', 'Project not found'))
        return
      }

      useEditorStore.getState().loadProject(record.state)

      if (record.workspace) {
        useEditorStore.setState({
          playhead: record.workspace.playhead ?? 0,
          zoom: record.workspace.zoom ?? 1,
          selectedClipId: record.workspace.selectedClipId ?? '',
        })
      }

      openProjectAction(id)
    } catch {
      toast.error(t('Error al cargar proyecto', 'Error loading project'))
    }
  }

  const handleGoHome = async () => {
    if (autosaveRef.current) {
      await autosaveRef.current.flush()
    }
    if (currentProjectId) {
      const state = getPersistable()
      try {
        await generateProjectCover(currentProjectId, state)
      } catch {
        /* continue home */
      }
    }
    goHomeAction()
  }

  const handleCreateNewProject = async (options: {
    name: string
    format: '16:9' | '9:16' | '1:1' | '4:5' | '21:9'
    fps: number
  }) => {
    try {
      if (autosaveRef.current) {
        await autosaveRef.current.flush()
      }

      const project = await defaultProjectService.createProject(options)
      await handleOpenProject(project.id)
    } catch {
      toast.error(t('Error al crear nuevo proyecto', 'Error creating new project'))
    }
  }

  if (view === 'editor') {
    return (
      <>
        <App
          onGoHome={() => void handleGoHome()}
          onNewProjectRequest={() => setNewProjectDialogOpen(true)}
        />
        <NewProjectDialog
          open={newProjectDialogOpen}
          onOpenChange={setNewProjectDialogOpen}
          onCreate={(opts) => void handleCreateNewProject(opts)}
        />
      </>
    )
  }

  return (
    <>
      <HomeScreen
        onOpenProject={(id) => void handleOpenProject(id)}
        onOpenPreferences={() => setPreferencesOpen(true)}
      />
      {preferencesOpen && (
        <PreferencesSheet
          open={preferencesOpen}
          onOpenChange={setPreferencesOpen}
          onResetLayout={() => {}}
          snapToFrames={true}
          onToggleSnap={() => {}}
          saveStatus="saved"
        />
      )}
    </>
  )
}
export default AppRoot
