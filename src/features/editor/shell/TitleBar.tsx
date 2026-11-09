import { ChevronDown, Columns2, CopyPlus, FolderOpen, Home, Pencil, Redo2, RefreshCw, Settings2, Undo2, Upload, Zap } from 'lucide-react'
import { ActionMenu } from '../components/ActionMenu'
import { FileMenu } from './FileMenu'
import { retryProjectSave } from '../editor-store'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'

interface TitleBarProps {
  projectName: string
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'
  pastLength: number
  futureLength: number
  canExport: boolean
  selectedClipId: string | null
  playhead: number
  undo: () => void
  redo: () => void
  splitClip: (id: string, at: number) => void
  duplicateClip: (id: string) => void
  deleteClip: (id: string) => void
  toggleAssistant: () => void
  onGoHome?: () => void
  onNewProject: () => void
  onOpenProjectFile: () => void
  onOpenHistory?: () => void
  onSaveAsTemplate?: () => void
  onOpenScriptToVideo?: () => void
  onExportSrt?: () => void
  onImportSrt?: () => void
  onImportMedia: () => void
  onExportVideo: () => void
  onOpenSettings: () => void
  onOpenRename: () => void
  onToggleTimelineExpanded: () => void
}

export function TitleBar({
  projectName,
  saveStatus,
  pastLength,
  futureLength,
  canExport,
  selectedClipId,
  playhead,
  undo,
  redo,
  splitClip,
  duplicateClip,
  deleteClip,
  toggleAssistant,
  onGoHome,
  onNewProject,
  onOpenProjectFile,
  onOpenHistory,
  onSaveAsTemplate,
  onOpenScriptToVideo,
  onExportSrt,
  onImportSrt,
  onImportMedia,
  onExportVideo,
  onOpenSettings,
  onOpenRename,
  onToggleTimelineExpanded,
}: TitleBarProps) {
  const renderSaveStatusIndicator = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span>{t('Guardando…', 'Saving…')}</span>
          </span>
        )
      case 'unsaved':
        return (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
            <span>{t('Sin guardar', 'Unsaved')}</span>
          </span>
        )
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-red-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
            <span>{t('Error al guardar', 'Save error')}</span>
            <button
              type="button"
              onClick={() => retryProjectSave()}
              className="ml-1 p-0.5 hover:text-white hover:bg-red-500/20 rounded cursor-pointer transition-colors"
              title={t('Reintentar guardado', 'Retry save')}
            >
              <RefreshCw size={11} className="inline" />
            </button>
          </span>
        )
      case 'saved':
      default:
        return (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span>{t('Guardado', 'Saved')}</span>
          </span>
        )
    }
  }

  return (
    <header className="titlebar">
      <div className="titlebar-left flex items-center gap-6 shrink-0 whitespace-nowrap">
        {onGoHome && (
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-[4px] transition-colors cursor-pointer"
            title={t('Volver a Inicio (Ctrl+H)', 'Return to Home (Ctrl+H)')}
            aria-label={t('Volver a Inicio', 'Return to Home')}
          >
            <Home size={14} />
            <span>{t('Inicio', 'Home')}</span>
          </button>
        )}
        <div className="sparta-logo-wrap flex items-center gap-2 select-none shrink-0 whitespace-nowrap">
          <Zap size={16} fill="var(--primary)" stroke="var(--primary)" className="zap-icon shrink-0" />
          <span className="font-semibold text-[14px] text-foreground tracking-wide whitespace-nowrap">
            SPARTA VIDEO
          </span>
        </div>

        <FileMenu
          pastLength={pastLength}
          futureLength={futureLength}
          selectedClipId={selectedClipId}
          playhead={playhead}
          undo={undo}
          redo={redo}
          splitClip={splitClip}
          duplicateClip={duplicateClip}
          deleteClip={deleteClip}
          onNewProject={onNewProject}
          onOpenProjectFile={onOpenProjectFile}
          onOpenHistory={onOpenHistory}
          onSaveAsTemplate={onSaveAsTemplate}
          onOpenScriptToVideo={onOpenScriptToVideo}
          onExportSrt={onExportSrt}
          onImportSrt={onImportSrt}
          onImportMedia={onImportMedia}
          onExportVideo={onExportVideo}
          onOpenSettings={onOpenSettings}
          onToggleTimelineExpanded={onToggleTimelineExpanded}
        />
      </div>

      <div className="titlebar-center text-xs text-muted-foreground tabular-nums flex items-center gap-1.5">
        <ActionMenu
          label="Project actions"
          triggerClass="project-menu-trigger font-medium text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer bg-transparent border-none"
          items={[
            { heading: 'PROJECT' },
            {
              label: t('Cambiar nombre del proyecto', 'Rename project'),
              icon: Pencil,
              onSelect: onOpenRename,
            },
            {
              label: t('Duplicar proyecto (.sparta)…', 'Duplicate project (.sparta)…'),
              icon: CopyPlus,
              onSelect: () => {
                void import('../services/project-file').then(({ exportProjectData, downloadProjectFile }) => {
                  const fileData = exportProjectData()
                  fileData.project.name = fileData.project.name + ' - copia'
                  downloadProjectFile(fileData)
                  toast.success(t('Copia del proyecto guardada', 'Project copy saved'), {
                    description: t(
                      'Los medios vinculados conservan sus ubicaciones actuales.',
                      'Linked media keeps its current locations.',
                    ),
                  })
                })
              },
            },
            { separator: true },
            {
              label: t('Preferencias del proyecto', 'Project preferences'),
              icon: FolderOpen,
              onSelect: onOpenSettings,
            },
          ]}
        >
          <span>{!projectName || projectName === 'Sin título' ? t('Proyecto sin título', 'Untitled project') : projectName}</span>
          <ChevronDown size={11} className="text-muted-foreground" />
        </ActionMenu>
        <span>·</span>
        {renderSaveStatusIndicator()}
      </div>

      <div className="titlebar-right flex items-center gap-1.5">
        <button
          type="button"
          className="titlebar-icon-btn w-7 h-7 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center justify-center transition-colors cursor-pointer"
          aria-label={t('Deshacer', 'Undo')}
          title={t('Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)')}
          onClick={undo}
          disabled={!pastLength}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="titlebar-icon-btn w-7 h-7 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center justify-center transition-colors cursor-pointer"
          aria-label={t('Rehacer', 'Redo')}
          title={t('Rehacer (Ctrl+Shift+Z)', 'Redo (Ctrl+Shift+Z)')}
          onClick={redo}
          disabled={!futureLength}
        >
          <Redo2 size={15} />
        </button>
        <button
          type="button"
          className="titlebar-icon-btn w-7 h-7 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center justify-center transition-colors cursor-pointer"
          aria-label={t('Paneles / Asistente', 'Panels / Assistant')}
          title={t('Paneles / Asistente', 'Panels / Assistant')}
          onClick={toggleAssistant}
        >
          <Columns2 size={15} />
        </button>
        <button
          type="button"
          className="titlebar-icon-btn w-7 h-7 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Open preferences"
          title={t('Preferencias', 'Preferences')}
          onClick={onOpenSettings}
        >
          <Settings2 size={15} />
        </button>
        <button
          type="button"
          className="btn-export-primary h-8 px-3 rounded-[6px] bg-primary text-primary-foreground font-semibold text-xs hover:brightness-110 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:pointer-events-none"
          disabled={!canExport}
          aria-label={canExport ? t('Exportar vídeo', 'Export video') : t('Exportación no disponible', 'Export unavailable')}
          title={
            canExport
              ? t('Exportar vídeo', 'Export video')
              : t('El motor de exportación aún no está conectado', 'The export engine is not connected yet')
          }
          onClick={() => {
            if (canExport) onExportVideo()
          }}
        >
          <Upload size={13} strokeWidth={2.4} /> {t('Exportar', 'Export')}
        </button>
      </div>
    </header>
  )
}

