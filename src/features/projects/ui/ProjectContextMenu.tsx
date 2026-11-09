import { CopyPlus, Download, FolderOpen, History, MoreVertical, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import type { ProjectSummary } from '../domain/project.types'
import { ActionMenu, type MenuEntry } from '../../editor/components/ActionMenu'
import { t } from '../../../shared/i18n/locale'

interface ProjectContextMenuProps {
  project: ProjectSummary
  onOpen: () => void
  onRename: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
  onRestore?: () => void
  onHistory?: () => void
}

export function ProjectContextMenu({
  project,
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
  onRestore,
  onHistory,
}: ProjectContextMenuProps) {
  const isDeleted = Boolean(project.deletedAt)

  const items: MenuEntry[] = isDeleted
    ? [
        ...(onRestore ? [{ label: t('Restaurar proyecto', 'Restore project'), icon: RotateCcw, onSelect: onRestore }] : []),
        { separator: true },
        { label: t('Eliminar definitivamente', 'Delete permanently'), icon: Trash2, onSelect: onDelete },
      ]
    : [
        { label: t('Abrir proyecto', 'Open project'), icon: FolderOpen, onSelect: onOpen },
        ...(onHistory ? [{ label: t('Historial de versiones…', 'Version history…'), icon: History, onSelect: onHistory }] : []),
        { label: t('Cambiar nombre', 'Rename'), icon: Pencil, onSelect: onRename },
        { label: t('Duplicar', 'Duplicate'), icon: CopyPlus, onSelect: onDuplicate },
        { label: t('Exportar .sparta…', 'Export .sparta…'), icon: Download, onSelect: onExport },
        { separator: true },
        { label: t('Mover a la papelera', 'Move to trash'), icon: Trash2, onSelect: onDelete },
      ]

  return (
    <ActionMenu
      label={`Acciones para ${project.name}`}
      triggerClass="p-1 text-muted-foreground hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
      items={items}
    >
      <MoreVertical size={15} />
    </ActionMenu>
  )
}

