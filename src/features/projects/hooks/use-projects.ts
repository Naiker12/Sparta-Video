import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjectId, ProjectSummary } from '../domain/project.types'
import { defaultProjectService, ProjectService } from '../application/project-service'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'

export type ProjectSortOption = 'recent' | 'name' | 'duration'
export type ProjectViewMode = 'grid' | 'list'

export function useProjects(service: ProjectService = defaultProjectService) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<ProjectSortOption>('recent')
  const [viewMode, setViewMode] = useState<ProjectViewMode>('grid')
  const [showTrash, setShowTrash] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const list = await service.listProjects({ includeDeleted: showTrash })
      setProjects(list)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [service, showTrash])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await service.listProjects({ includeDeleted: showTrash })
        if (!cancelled) {
          setProjects(list)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err)
          setError(msg)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [service, showTrash])

  const deleteProject = useCallback(
    async (id: ProjectId, permanent = false) => {
      const target = projects.find((p) => p.id === id)
      try {
        await service.deleteProject(id, permanent)
        await refresh()

        if (!permanent && target) {
          toast.info(t(`Proyecto "${target.name}" movido a la papelera`, `Project "${target.name}" moved to trash`), {
            action: {
              label: t('Deshacer', 'Undo'),
              onClick: () => {
                void (async () => {
                  await service.restoreProject(id)
                  await refresh()
                  toast.success(t('Proyecto restaurado', 'Project restored'))
                })()
              },
            },
            duration: 6000,
          })
        } else {
          toast.success(t('Proyecto eliminado permanentemente', 'Project permanently deleted'))
        }
      } catch {
        toast.error(t('Error al eliminar proyecto', 'Error deleting project'))
      }
    },
    [projects, refresh, service],
  )

  const duplicateProject = useCallback(
    async (id: ProjectId) => {
      try {
        const copy = await service.duplicateProject(id)
        await refresh()
        toast.success(t('Proyecto duplicado', 'Project duplicated'), {
          description: copy.state.projectName,
        })
        return copy
      } catch {
        toast.error(t('Error al duplicar proyecto', 'Error duplicating project'))
        return null
      }
    },
    [refresh, service],
  )

  const renameProject = useCallback(
    async (id: ProjectId, newName: string) => {
      try {
        await service.renameProject(id, newName)
        await refresh()
        toast.success(t('Proyecto renombrado', 'Project renamed'), {
          description: newName,
        })
      } catch {
        toast.error(t('Error al renombrar proyecto', 'Error renaming project'))
      }
    },
    [refresh, service],
  )

  const restoreProject = useCallback(
    async (id: ProjectId) => {
      try {
        await service.restoreProject(id)
        await refresh()
        toast.success(t('Proyecto restaurado', 'Project restored'))
      } catch {
        toast.error(t('Error al restaurar proyecto', 'Error restoring project'))
      }
    },
    [refresh, service],
  )

  const emptyTrash = useCallback(async () => {
    try {
      await service.emptyTrash()
      await refresh()
      toast.success(t('Papelera vaciada correctamente', 'Trash emptied successfully'))
    } catch {
      toast.error(t('Error al vaciar papelera', 'Error emptying trash'))
    }
  }, [refresh, service])

  const filteredProjects = useMemo(() => {
    let list = [...projects]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'duration') {
      list.sort((a, b) => b.durationSeconds - a.durationSeconds)
    } else {
      // 'recent'
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return list
  }, [projects, searchQuery, sortBy])

  const latestProject = useMemo(() => {
    if (projects.length === 0) return null
    // Most recently updated non-deleted project
    const nonDeleted = projects.filter((p) => !p.deletedAt)
    if (nonDeleted.length === 0) return null
    return [...nonDeleted].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]
  }, [projects])

  return {
    projects: filteredProjects,
    rawProjectsCount: projects.length,
    latestProject,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    showTrash,
    setShowTrash,
    refresh,
    deleteProject,
    duplicateProject,
    renameProject,
    restoreProject,
    emptyTrash,
  }
}
