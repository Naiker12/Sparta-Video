import { useState } from 'react'
import { BookmarkPlus, LayoutTemplate } from 'lucide-react'
import type { TemplateCategory, TemplateSlot } from '../domain/template.types'
import { defaultTemplateService } from '../application/template-service'
import { useEditorStore } from '../../editor/editor-store'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'

interface SaveAsTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  projectId = crypto.randomUUID(),
}: SaveAsTemplateDialogProps) {
  const currentProjectName = useEditorStore((state) => state.projectName)
  const tracks = useEditorStore((state) => state.tracks)
  const assets = useEditorStore((state) => state.assets)
  const sequence = useEditorStore((state) => state.sequence)
  const markers = useEditorStore((state) => state.markers)
  const snapToFrames = useEditorStore((state) => state.snapToFrames)
  const mutedTracks = useEditorStore((state) => state.mutedTracks)
  const lockedTracks = useEditorStore((state) => state.lockedTracks)

  const [name, setName] = useState(`${currentProjectName} - Plantilla`)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('social-media')
  const [saving, setSaving] = useState(false)

  // Find all text clips in the project to optionally mark as customizable slots
  const textClips = tracks
    .flatMap((t) => t.clips)
    .filter((c) => c.text !== undefined || c.thumbnail === 'text-overlay')

  const [selectedSlotClipIds, setSelectedSlotClipIds] = useState<Set<string>>(
    () => new Set(textClips.map((c) => c.id)),
  )

  const toggleSlotClip = (clipId: string) => {
    setSelectedSlotClipIds((prev) => {
      const next = new Set(prev)
      if (next.has(clipId)) next.delete(clipId)
      else next.add(clipId)
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) return
    try {
      setSaving(true)

      const slots: TemplateSlot[] = textClips
        .filter((c) => selectedSlotClipIds.has(c.id))
        .map((c) => ({
          id: `slot-${c.id}`,
          label: c.title || c.text?.slice(0, 20) || 'Texto editable',
          type: 'text',
          targetClipId: c.id,
          defaultText: c.text,
        }))

      // Clone project record
      const projectRecord = {
        id: projectId,
        schemaVersion: 2 as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        state: {
          projectName: name.trim(),
          sequence,
          tracks,
          assets,
          markers,
          snapToFrames,
          mutedTracks,
          lockedTracks,
        },
      }

      await defaultTemplateService.saveProjectAsTemplate(projectRecord, {
        name: name.trim(),
        description: description.trim(),
        category,
        slots,
      })

      toast.success(t('Plantilla guardada con éxito', 'Template saved successfully'), {
        description: name.trim(),
      })

      onOpenChange(false)
    } catch {
      toast.error(t('Error al guardar plantilla', 'Error saving template'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#13151b] border-[#252936] text-white p-6 rounded-2xl">
        <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
          <BookmarkPlus size={18} className="text-primary" />
          <span>{t('Guardar como plantilla', 'Save as Template')}</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          {t(
            'Convierte la estructura y estilo de este proyecto en una plantilla reutilizable.',
            'Turn this project’s structure and style into a reusable template.',
          )}
        </DialogDescription>

        <div className="space-y-4 my-4">
          <div>
            <label className="text-xs font-semibold text-white/80 block mb-1">
              {t('Nombre de la plantilla', 'Template Name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 rounded-xl border border-white/10 bg-[#1c1f2a] px-3 text-xs text-white outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-white/80 block mb-1">
              {t('Descripción', 'Description')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('Explica brevemente para qué sirve…', 'Briefly explain what this template is for…')}
              className="w-full rounded-xl border border-white/10 bg-[#1c1f2a] p-2.5 text-xs text-white outline-none focus:border-primary/50 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-white/80 block mb-1">
              {t('Categoría', 'Category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              className="w-full h-9 rounded-xl border border-white/10 bg-[#1c1f2a] px-2.5 text-xs text-white outline-none focus:border-primary/50"
            >
              <option value="stickman">Stickman</option>
              <option value="social-media">{t('Redes Sociales (TikTok, Reels)', 'Social Media (TikTok, Reels)')}</option>
              <option value="youtube">YouTube</option>
              <option value="business">{t('Negocios y Anuncios', 'Business & Ads')}</option>
              <option value="education">{t('Educativo y Tutoriales', 'Education & Tutorials')}</option>
              <option value="general">{t('General', 'General')}</option>
            </select>
          </div>

          {textClips.length > 0 && (
            <div className="pt-2 border-t border-white/5">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block mb-2">
                {t('Slots de texto editables al instanciar', 'Editable Text Slots on Instantiate')}
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {textClips.map((clip) => {
                  const checked = selectedSlotClipIds.has(clip.id)
                  return (
                    <label
                      key={clip.id}
                      className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-xs cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSlotClip(clip.id)}
                        className="rounded border-white/20 accent-primary size-3.5"
                      />
                      <span className="truncate text-white/90">
                        {clip.title || clip.text?.slice(0, 30)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3.5 py-1.5 rounded-xl border border-white/10 text-xs font-medium text-white/70 hover:bg-white/5 transition-colors cursor-pointer"
          >
            {t('Cancelar', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void handleSave()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <LayoutTemplate size={13} />
            <span>{saving ? t('Guardando…', 'Saving…') : t('Guardar plantilla', 'Save Template')}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
