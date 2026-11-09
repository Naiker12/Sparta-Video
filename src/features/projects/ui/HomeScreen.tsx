import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Home,
  LayoutGrid,
  LayoutTemplate,
  Plus,
  Settings,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'
import { useProjects } from '../hooks/use-projects'
import { ContinueBanner } from './ContinueBanner'
import { ProjectGrid } from './ProjectGrid'
import { NewProjectDialog } from './NewProjectDialog'
import { RenameProjectDialog } from '../../editor/components/RenameProjectDialog'
import { VersionHistoryDialog } from './VersionHistoryDialog'
import { TemplateGallery } from '../../templates/ui/TemplateGallery'
import type { ProjectPresetFormat } from '../domain/project-factory'
import { defaultProjectService } from '../application/project-service'
import { downloadProjectFile } from '../../editor/services/project-file'
import { loadMediaPreview } from '../../editor/services/media-storage'
import { generateProjectCover } from '../application/cover-capture'
import { setLanguage, t, useLanguage } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'
import { Toaster } from '../../../shared/ui/toast'

interface HomeScreenProps {
  onOpenProject: (id: string) => void
  onOpenTemplates?: () => void
  onOpenPreferences?: () => void
}

type HomeTab = 'home' | 'projects' | 'templates' | 'trash'

export function HomeScreen({ onOpenProject, onOpenTemplates, onOpenPreferences }: HomeScreenProps) {
  const currentLang = useLanguage()
  const {
    projects,
    rawProjectsCount,
    latestProject,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    showTrash,
    setShowTrash,
    deleteProject,
    duplicateProject,
    renameProject,
    restoreProject,
    emptyTrash,
    refresh,
  } = useProjects()

  const [activeTab, setActiveTab] = useState<HomeTab>('home')
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameTargetName, setRenameTargetName] = useState('')
  const [historyTargetId, setHistoryTargetId] = useState<string | null>(null)
  const [historyTargetName, setHistoryTargetName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreateProject = async (options: {
    name: string
    format: ProjectPresetFormat
    customResolution?: { width: number; height: number }
    fps: number
  }) => {
    try {
      const record = await defaultProjectService.createProject(options)
      onOpenProject(record.id)
    } catch {
      toast.error(t('Error al crear el proyecto', 'Error creating project'))
    }
  }

  const handleQuickCreate = async (format: ProjectPresetFormat) => {
    try {
      const record = await defaultProjectService.createProject({
        name: t('Sin título', 'Untitled'),
        format,
      })
      onOpenProject(record.id)
    } catch {
      toast.error(t('Error al crear proyecto rápido', 'Error creating quick project'))
    }
  }

  const handleExportSparta = async (id: string) => {
    try {
      const project = await defaultProjectService.getProject(id)
      if (!project) return
      const fileData = defaultProjectService.exportProjectToData(project)
      downloadProjectFile(fileData)
      toast.success(t('Archivo de proyecto exportado', 'Project file exported'), {
        description: `${project.state.projectName}.sparta`,
      })
    } catch {
      toast.error(t('Error al exportar archivo .sparta', 'Error exporting .sparta file'))
    }
  }

  const handleImportSparta = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const record = await defaultProjectService.importProjectFromData(json)
        await refresh()
        toast.success(t('Proyecto importado con éxito', 'Project imported successfully'), {
          description: record.state.projectName,
        })
        onOpenProject(record.id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(t('No se pudo importar el archivo .sparta', 'Could not import .sparta file'), {
          description: msg,
        })
      }
    },
    [onOpenProject, refresh],
  )

  // Global drag-and-drop listener to import .sparta by dropping anywhere on home
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]
        if (file.name.endsWith('.sparta') || file.name.endsWith('.json')) {
          void handleImportSparta(e.dataTransfer.files)
        }
      }
    }
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleImportSparta])

  // Warm covers in the background for any project missing one
  useEffect(() => {
    let cancelled = false
    const warmCovers = async () => {
      for (const p of projects) {
        if (cancelled) break
        try {
          const cached = await loadMediaPreview(`cover-${p.id}`)
          if (!cached) {
            const full = await defaultProjectService.getProject(p.id)
            if (full && !cancelled) {
              await generateProjectCover(p.id, full.state)
            }
          }
        } catch {
          /* continue */
        }
      }
    }
    void warmCovers()
    return () => {
      cancelled = true
    }
  }, [projects])

  return (
    <div className="flex h-screen w-screen bg-[#0e1014] text-foreground overflow-hidden font-sans select-none">
      {/* Sidebar */}
      <aside className="w-56 bg-[#13151b] border-r border-[#20232c] flex flex-col justify-between shrink-0 p-3">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
              <Zap size={18} fill="currentColor" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wider text-white">SPARTA</h1>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block -mt-1">
                VIDEO
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('home')
                setShowTrash(false)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'home' && !showTrash
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-white hover:bg-[#1a1d25]'
              }`}
            >
              <Home size={16} />
              <span>{t('Inicio', 'Home')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('projects')
                setShowTrash(false)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'projects' && !showTrash
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-white hover:bg-[#1a1d25]'
              }`}
            >
              <LayoutGrid size={16} />
              <span>{t('Proyectos', 'Projects')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('templates')
                onOpenTemplates?.()
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-white hover:bg-[#1a1d25]'
              }`}
            >
              <LayoutTemplate size={16} />
              <span>{t('Plantillas', 'Templates')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('trash')
                setShowTrash(true)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                showTrash
                  ? 'bg-red-500/15 text-red-400 font-semibold'
                  : 'text-muted-foreground hover:text-white hover:bg-[#1a1d25]'
              }`}
            >
              <Trash2 size={16} />
              <span>{t('Papelera', 'Trash')}</span>
            </button>
          </nav>
        </div>

        {/* Footer controls */}
        <div className="pt-3 border-t border-[#20232c] flex items-center justify-between px-2">
          <button
            type="button"
            onClick={() => setLanguage(currentLang === 'es' ? 'en' : 'es')}
            className="text-[11px] font-semibold text-muted-foreground hover:text-white px-2 py-1 rounded bg-[#1a1d25] border border-[#272b36] transition-colors cursor-pointer"
            title={t('Cambiar idioma', 'Switch language')}
          >
            {currentLang.toUpperCase()}
          </button>

          {onOpenPreferences && (
            <button
              type="button"
              onClick={onOpenPreferences}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-[#1a1d25] transition-colors cursor-pointer"
              title={t('Preferencias', 'Preferences')}
            >
              <Settings size={15} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      {activeTab === 'templates' ? (
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <TemplateGallery
            onOpenProject={onOpenProject}
            onClose={() => setActiveTab('home')}
          />
        </main>
      ) : (
        <main className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0f1116] p-6 lg:p-8 space-y-8">
          {showTrash ? (
            /* Trash Dedicated Banner */
            <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#171418] border border-red-950/60 rounded-2xl shadow-lg">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/30 shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{t('Papelera de reciclaje', 'Recycle Bin')}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 font-mono border border-red-900/40">
                      {projects.length}
                    </span>
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t(
                      'Los proyectos eliminados se conservan aquí. Puedes restaurarlos o eliminarlos permanentemente.',
                      'Deleted projects are kept here. You can restore them or delete them permanently.',
                    )}
                  </p>
                </div>
              </div>

              {projects.length > 0 && (
                <button
                  type="button"
                  onClick={() => void emptyTrash()}
                  className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/35 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  <Trash2 size={14} />
                  <span>{t('Vaciar papelera', 'Empty trash')}</span>
                </button>
              )}
            </section>
          ) : (
            <>
              {/* Quick action buttons row */}
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* New Project CTA */}
                <button
                  type="button"
                  onClick={() => setNewProjectOpen(true)}
                  className="group flex items-center gap-4 p-5 bg-gradient-to-br from-primary/20 via-[#1e2330] to-[#161820] hover:from-primary/30 hover:to-[#1b1e28] border border-primary/30 hover:border-primary/60 rounded-2xl transition-all shadow-lg hover:shadow-primary/10 cursor-pointer text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                    <Plus size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                      {t('Nuevo proyecto', 'New project')}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('Comienza desde cero', 'Start from scratch')}
                    </p>
                  </div>
                </button>

                {/* Open .sparta CTA */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex items-center gap-4 p-5 bg-[#161820] hover:bg-[#1c1f29] border border-[#262a36] hover:border-[#383e4f] rounded-2xl transition-all cursor-pointer text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#222530] text-muted-foreground group-hover:text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Upload size={22} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                      {t('Abrir .sparta', 'Open .sparta')}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('Importa un archivo local', 'Import a local file')}
                    </p>
                  </div>
                </button>

                {/* Templates CTA */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('templates')
                    onOpenTemplates?.()
                  }}
                  className="group flex items-center gap-4 p-5 bg-[#161820] hover:bg-[#1c1f29] border border-[#262a36] hover:border-[#383e4f] rounded-2xl transition-all cursor-pointer text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#222530] text-muted-foreground group-hover:text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <LayoutTemplate size={22} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                      {t('Desde plantilla', 'From template')}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('Stickman, Shorts, YouTube…', 'Stickman, Shorts, YouTube…')}
                    </p>
                  </div>
                </button>
              </section>

              {/* Quick Format Shortcuts */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground mr-1">
                  {t('Formato rápido:', 'Quick format:')}
                </span>
                {(['16:9', '9:16', '1:1', '4:5', '21:9'] as ProjectPresetFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => void handleQuickCreate(fmt)}
                    className="px-3 py-1 bg-[#171a22] hover:bg-[#202530] border border-[#272c38] hover:border-primary/50 text-xs font-semibold rounded-lg text-white/90 hover:text-primary transition-all cursor-pointer"
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              {/* Continue where you left off (Banner) */}
              {latestProject && (
                <ContinueBanner project={latestProject} onContinue={onOpenProject} />
              )}
            </>
          )}

          {/* Project List / Grid */}
          <section>
            <ProjectGrid
              projects={projects}
              rawCount={rawProjectsCount}
              viewMode={viewMode}
              sortBy={sortBy}
              searchQuery={searchQuery}
              onViewModeChange={setViewMode}
              onSortChange={setSortBy}
              onSearchChange={setSearchQuery}
              onOpenProject={onOpenProject}
              onRenameProject={(id) => {
                const p = projects.find((item) => item.id === id)
                if (p) {
                  setRenameTargetId(id)
                  setRenameTargetName(p.name)
                }
              }}
              onDuplicateProject={duplicateProject}
              onExportProject={handleExportSparta}
              onDeleteProject={(id) => void deleteProject(id, showTrash)}
              onRestoreProject={restoreProject}
              onHistoryProject={(id) => {
                const p = projects.find((item) => item.id === id)
                if (p) {
                  setHistoryTargetId(id)
                  setHistoryTargetName(p.name)
                }
              }}
              onNewProject={() => setNewProjectOpen(true)}
              onOpenProjectFile={() => fileInputRef.current?.click()}
            />
          </section>
        </main>
      )}

      {/* Hidden file input for .sparta import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".sparta,.json"
        className="hidden"
        onChange={(e) => {
          void handleImportSparta(e.target.files)
          e.target.value = ''
        }}
      />

      {/* New Project Dialog */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreate={handleCreateProject}
      />

      {/* Rename Dialog */}
      {renameTargetId && (
        <RenameProjectDialog
          open={!!renameTargetId}
          name={renameTargetName}
          onOpenChange={(open) => {
            if (!open) setRenameTargetId(null)
          }}
          onSave={(newName) => {
            if (renameTargetId) {
              void renameProject(renameTargetId, newName)
              setRenameTargetId(null)
            }
          }}
        />
      )}

      {/* Version History Dialog */}
      {historyTargetId && (
        <VersionHistoryDialog
          open={!!historyTargetId}
          projectId={historyTargetId}
          projectName={historyTargetName}
          onOpenChange={(open) => {
            if (!open) setHistoryTargetId(null)
          }}
          onRestore={() => {
            void refresh()
          }}
        />
      )}

      <Toaster />
    </div>
  )
}
