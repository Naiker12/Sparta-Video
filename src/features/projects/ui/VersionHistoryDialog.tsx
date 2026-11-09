import { useCallback, useEffect, useState } from 'react'
import { Check, Clock, History, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { ProjectSnapshot } from '../domain/snapshot.types'
import { defaultProjectService } from '../application/project-service'
import { formatDurationCompact, formatRelativeTime } from '../../../shared/lib/format-time'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'
import { Dialog, DialogContent, DialogTitle } from '../../../shared/ui/dialog'

interface VersionHistoryDialogProps {
  open: boolean
  projectId: string
  projectName: string
  onOpenChange: (open: boolean) => void
  onRestore?: (snapshot: ProjectSnapshot) => void
}

export function VersionHistoryDialog({
  open,
  projectId,
  projectName,
  onOpenChange,
  onRestore,
}: VersionHistoryDialogProps) {
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const loadSnapshots = useCallback(async () => {
    if (!projectId) return
    try {
      const list = await defaultProjectService.listSnapshots(projectId)
      setSnapshots(list)
    } catch {
      toast.error(t('Error al cargar historial de versiones', 'Error loading version history'))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!open || !projectId) return
    let cancelled = false
    void (async () => {
      try {
        const list = await defaultProjectService.listSnapshots(projectId)
        if (!cancelled) {
          setSnapshots(list)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          toast.error(t('Error al cargar historial de versiones', 'Error loading version history'))
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim()) return
    try {
      setCreating(true)
      await defaultProjectService.createSnapshot(projectId, newLabel.trim())
      setNewLabel('')
      toast.success(t('Punto de restauración creado', 'Restore point created'))
      await loadSnapshots()
    } catch {
      toast.error(t('Error al crear punto de restauración', 'Error creating restore point'))
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (snapshot: ProjectSnapshot) => {
    try {
      setRestoringId(snapshot.id)
      await defaultProjectService.restoreSnapshot(projectId, snapshot.id)
      toast.success(t('Versión restaurada con éxito', 'Version restored successfully'), {
        description: `${snapshot.label} (${formatRelativeTime(snapshot.createdAt)})`,
      })
      onRestore?.(snapshot)
      onOpenChange(false)
    } catch {
      toast.error(t('Error al restaurar la versión', 'Error restoring version'))
    } finally {
      setRestoringId(null)
    }
  }

  const handleDelete = async (snapshotId: string) => {
    try {
      await defaultProjectService.deleteSnapshot(snapshotId)
      toast.success(t('Punto de restauración eliminado', 'Restore point removed'))
      await loadSnapshots()
    } catch {
      toast.error(t('Error al eliminar el punto', 'Error removing restore point'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-[#16181f] border border-[#2a2e3a] p-0 text-white overflow-hidden shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#252936] bg-[#121419]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <History size={18} />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
                {t('Historial de versiones', 'Version History')}
                <span className="text-[11px] font-normal text-muted-foreground">({projectName})</span>
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t('Restaura estados anteriores del proyecto o crea nuevos puntos', 'Restore previous project states or save new checkpoints')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Create new checkpoint form */}
          <form onSubmit={handleCreateSnapshot} className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t('Nombre del nuevo punto (ej: Antes de cortar audio)', 'Checkpoint name (e.g., Before audio trimming)')}
              className="flex-1 px-3 py-1.5 bg-[#101217] border border-[#2c3140] focus:border-primary focus:outline-none rounded-xl text-xs text-white placeholder-muted-foreground"
            />
            <button
              type="submit"
              disabled={creating || !newLabel.trim()}
              className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus size={14} />
              <span>{t('Crear punto', 'Save point')}</span>
            </button>
          </form>

          {/* Snapshots list */}
          <div className="space-y-2">
            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {t('Cargando versiones…', 'Loading versions…')}
              </div>
            ) : snapshots.length === 0 ? (
              <div className="py-8 text-center space-y-1.5 bg-[#121419] rounded-xl border border-[#232732] p-6">
                <Clock size={24} className="mx-auto text-muted-foreground/40" />
                <p className="text-xs font-medium text-white/80">
                  {t('No hay puntos de restauración', 'No restore points yet')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'Se guardará automáticamente un punto al exportar, o puedes crearlo arriba.',
                    'A checkpoint will be automatically saved on export, or you can create one above.',
                  )}
                </p>
              </div>
            ) : (
              snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between p-3.5 bg-[#13151b] hover:bg-[#181b22] border border-[#242834] rounded-xl transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-white truncate">{snap.label}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e222d] border border-[#2b303e] text-muted-foreground font-mono shrink-0">
                        {snap.clipCount} {snap.clipCount === 1 ? 'clip' : 'clips'} · {formatDurationCompact(snap.durationSeconds)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatRelativeTime(snap.createdAt)} ·{' '}
                      {new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleRestore(snap)}
                      disabled={restoringId === snap.id}
                      className="px-2.5 py-1.5 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {restoringId === snap.id ? (
                        <Check size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      <span>{t('Restaurar', 'Restore')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(snap.id)}
                      className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title={t('Eliminar punto', 'Delete checkpoint')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
