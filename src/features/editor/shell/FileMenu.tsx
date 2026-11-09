import { BookmarkPlus, Clapperboard, CopyPlus, FileDown, FileText, FileUp, Film, History, Maximize2, PlusCircle, Redo2, Scissors, Trash2, Undo2, Video } from 'lucide-react'
import { ActionMenu } from '../components/ActionMenu'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'

interface FileMenuProps {
  pastLength: number
  futureLength: number
  selectedClipId: string | null
  playhead: number
  undo: () => void
  redo: () => void
  splitClip: (id: string, at: number) => void
  duplicateClip: (id: string) => void
  deleteClip: (id: string) => void
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
  onToggleTimelineExpanded: () => void
}

export function FileMenu({
  pastLength,
  futureLength,
  selectedClipId,
  playhead,
  undo,
  redo,
  splitClip,
  duplicateClip,
  deleteClip,
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
  onToggleTimelineExpanded,
}: FileMenuProps) {
  return (
    <nav className="sparta-menu-nav flex items-center gap-1.5 shrink-0 whitespace-nowrap">
      <ActionMenu
        label={t('Archivo', 'File')}
        triggerClass="sparta-menu-btn text-[13px] text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-[4px] hover:bg-secondary/60 transition-colors cursor-pointer"
        items={[
          {
            label: t('Nuevo proyecto', 'New project'),
            icon: PlusCircle,
            onSelect: onNewProject,
          },
          {
            label: t('Abrir proyecto (.sparta)…', 'Open project (.sparta)…'),
            icon: FileUp,
            onSelect: onOpenProjectFile,
          },
          {
            label: t('Guardar proyecto como (.sparta)…', 'Save project as (.sparta)…'),
            icon: FileDown,
            onSelect: () => {
              void import('../services/project-file').then(({ exportProjectData, downloadProjectFile }) => {
                const fileData = exportProjectData()
                downloadProjectFile(fileData)
                toast.success(t('Archivo de proyecto guardado', 'Project file saved'), {
                  description: fileData.project.name + '.sparta',
                })
              })
            },
          },
          ...(onOpenHistory
            ? [
                {
                  label: t('Historial de versiones…', 'Version history…'),
                  icon: History,
                  onSelect: onOpenHistory,
                },
              ]
            : []),
          ...(onSaveAsTemplate
            ? [
                {
                  label: t('Guardar como plantilla…', 'Save as template…'),
                  icon: BookmarkPlus,
                  onSelect: onSaveAsTemplate,
                },
              ]
            : []),
          ...(onOpenScriptToVideo
            ? [
                {
                  label: t('Guion a Vídeo / Storyboard…', 'Script to Video / Storyboard…'),
                  icon: Clapperboard,
                  onSelect: onOpenScriptToVideo,
                },
              ]
            : []),
          { separator: true },
          {
            label: t('Importar medios…', 'Import media…'),
            icon: FileUp,
            onSelect: onImportMedia,
          },
          ...(onImportSrt
            ? [
                {
                  label: t('Importar subtítulos (.srt)…', 'Import subtitles (.srt)…'),
                  icon: FileText,
                  onSelect: onImportSrt,
                },
              ]
            : []),
          {
            label: t('Exportar vídeo…', 'Export video…'),
            icon: Video,
            onSelect: onExportVideo,
          },
          ...(onExportSrt
            ? [
                {
                  label: t('Exportar subtítulos (.srt)…', 'Export subtitles (.srt)…'),
                  icon: FileDown,
                  onSelect: onExportSrt,
                },
              ]
            : []),
        ]}
      >
        <span>{t('Archivo', 'File')}</span>
      </ActionMenu>

      <ActionMenu
        label={t('Editar', 'Edit')}
        triggerClass="sparta-menu-btn text-[13px] text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-[4px] hover:bg-secondary/60 transition-colors cursor-pointer"
        items={[
          { label: t('Deshacer', 'Undo'), icon: Undo2, disabled: !pastLength, onSelect: undo },
          { label: t('Rehacer', 'Redo'), icon: Redo2, disabled: !futureLength, onSelect: redo },
          { separator: true },
          {
            label: t('Dividir clip en cabezal (S)', 'Split clip at playhead (S)'),
            icon: Scissors,
            disabled: !selectedClipId,
            onSelect: () => {
              if (selectedClipId) splitClip(selectedClipId, playhead)
            },
          },
          {
            label: t('Duplicar clip (Ctrl+D)', 'Duplicate clip (Ctrl+D)'),
            icon: CopyPlus,
            disabled: !selectedClipId,
            onSelect: () => {
              if (selectedClipId) duplicateClip(selectedClipId)
            },
          },
          {
            label: t('Eliminar clip (Supr)', 'Delete clip (Del)'),
            icon: Trash2,
            disabled: !selectedClipId,
            onSelect: () => {
              if (selectedClipId) deleteClip(selectedClipId)
            },
          },
        ]}
      >
        <span>{t('Editar', 'Edit')}</span>
      </ActionMenu>

      <ActionMenu
        label={t('Ver', 'View')}
        triggerClass="sparta-menu-btn text-[13px] text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-[4px] hover:bg-secondary/60 transition-colors cursor-pointer"
        items={[
          {
            label: t('Ajustes de secuencia…', 'Sequence settings…'),
            icon: Film,
            onSelect: onOpenSettings,
          },
          {
            label: t('Expandir línea de tiempo', 'Expand timeline'),
            icon: Maximize2,
            onSelect: onToggleTimelineExpanded,
          },
        ]}
      >
        <span>{t('Ver', 'View')}</span>
      </ActionMenu>
    </nav>
  )
}

