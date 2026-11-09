import { useMemo, useState, useEffect } from 'react'
import { Filter, LayoutTemplate, Search, X } from 'lucide-react'
import type { SpartaTemplate, TemplateCategory } from '../domain/template.types'
import type { ProjectPresetFormat } from '../../projects/domain/project-factory'
import { defaultTemplateService } from '../application/template-service'
import { TemplateCard } from './TemplateCard'
import { t } from '../../../shared/i18n/locale'
import { toast } from '../../../shared/ui/toast-service'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'

interface TemplateGalleryProps {
  onOpenProject: (id: string) => void
  onClose?: () => void
}

export function TemplateGallery({ onOpenProject, onClose }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<SpartaTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [selectedFormat, setSelectedFormat] = useState<ProjectPresetFormat | 'all'>('all')

  // Selected template for instant creation / slot customization dialog
  const [activeTemplate, setActiveTemplate] = useState<SpartaTemplate | null>(null)
  const [customProjectName, setCustomProjectName] = useState('')
  const [slotValues, setSlotValues] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await defaultTemplateService.listTemplates()
        if (!cancelled) {
          setTemplates(list)
        }
      } catch {
        if (!cancelled) {
          toast.error(t('Error al cargar plantillas', 'Error loading templates'))
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
  }, [])

  const categories: Array<{ id: TemplateCategory | 'all'; label: string }> = [
    { id: 'all', label: t('Todas', 'All') },
    { id: 'stickman', label: 'Stickman' },
    { id: 'social-media', label: t('Redes Sociales', 'Social Media') },
    { id: 'youtube', label: 'YouTube' },
    { id: 'business', label: t('Negocios', 'Business') },
    { id: 'education', label: t('Educación', 'Education') },
  ]

  const formats: Array<{ id: ProjectPresetFormat | 'all'; label: string }> = [
    { id: 'all', label: t('Cualquier formato', 'Any format') },
    { id: '9:16', label: '9:16 (Vertical)' },
    { id: '16:9', label: '16:9 (Horizontal)' },
    { id: '1:1', label: '1:1 (Cuadrado)' },
  ]

  const filteredTemplates = useMemo(() => {
    let list = templates

    if (selectedCategory !== 'all') {
      list = list.filter((t) => t.category === selectedCategory)
    }

    if (selectedFormat !== 'all') {
      list = list.filter((t) => t.format === selectedFormat)
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
    }

    return list
  }, [templates, selectedCategory, selectedFormat, search])

  const handleSelectTemplate = (tmpl: SpartaTemplate) => {
    setActiveTemplate(tmpl)
    setCustomProjectName(`${tmpl.name}`)
    const initialSlots: Record<string, string> = {}
    tmpl.slots.forEach((s) => {
      if (s.defaultText) {
        initialSlots[s.id] = s.defaultText
      }
    })
    setSlotValues(initialSlots)
  }

  const handleCreateFromActiveTemplate = async () => {
    if (!activeTemplate) return
    try {
      setCreating(true)
      const slotFills: Record<string, { type: 'text'; text: string }> = {}
      for (const [slotId, val] of Object.entries(slotValues)) {
        if (val.trim()) {
          slotFills[slotId] = { type: 'text', text: val.trim() }
        }
      }

      const project = await defaultTemplateService.createProjectFromTemplate(activeTemplate.id, {
        projectName: customProjectName.trim() || activeTemplate.name,
        slotFills,
      })

      toast.success(t('Proyecto creado desde plantilla', 'Project created from template'), {
        description: project.state.projectName,
      })

      setActiveTemplate(null)
      onOpenProject(project.id)
    } catch {
      toast.error(t('Error al crear proyecto desde plantilla', 'Error creating project from template'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0e1014] p-6 text-foreground">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#232733]">
        <div>
          <div className="flex items-center gap-2">
            <LayoutTemplate className="text-primary size-5" />
            <h1 className="text-xl font-bold tracking-tight text-white">
              {t('Galería de Plantillas', 'Template Gallery')}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              'Inicia tus proyectos en segundos con estructuras narrativas y formatos probados.',
              'Kickstart your projects in seconds with proven narrative structures and formats.',
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Buscar plantilla…', 'Search template…')}
              className="h-9 w-full rounded-full border border-white/10 bg-[#161820] pl-8 pr-7 text-xs text-white placeholder:text-white/35 outline-none focus:border-primary/50 focus:bg-[#1a1d26]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title={t('Cerrar galería', 'Close gallery')}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        {/* Categories */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => {
            const active = selectedCategory === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-primary text-black font-semibold shadow-xs'
                    : 'bg-[#181a24] text-muted-foreground hover:bg-[#202330] hover:text-white'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Format Select */}
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-muted-foreground" />
          <div className="flex items-center rounded-lg bg-[#14161f] border border-[#232733] p-0.5">
            {formats.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFormat(f.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  selectedFormat === f.id
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-[#14161f] animate-pulse border border-[#232733]" />
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <LayoutTemplate size={32} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-white/70">
              {t('No se encontraron plantillas', 'No templates found')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('Prueba ajustando los filtros de categoría o búsqueda.', 'Try adjusting the search or category filters.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-2 pb-12">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={handleSelectTemplate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Template Quick Customization & Creation Dialog */}
      {activeTemplate && (
        <Dialog open={!!activeTemplate} onOpenChange={(open) => !open && setActiveTemplate(null)}>
          <DialogContent className="max-w-md bg-[#13151b] border-[#252936] text-white p-6 rounded-2xl">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <LayoutTemplate size={16} className="text-primary" />
              <span>{activeTemplate.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {activeTemplate.description}
            </DialogDescription>

            <div className="space-y-4 my-4">
              <div>
                <label className="text-xs font-semibold text-white/80 block mb-1.5">
                  {t('Nombre del proyecto', 'Project Name')}
                </label>
                <input
                  type="text"
                  value={customProjectName}
                  onChange={(e) => setCustomProjectName(e.target.value)}
                  className="w-full h-9 rounded-xl border border-white/10 bg-[#1c1f2a] px-3 text-xs text-white outline-none focus:border-primary/50"
                />
              </div>

              {activeTemplate.slots.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">
                    {t('Personalizar textos iniciales (opcional)', 'Customize Initial Texts (Optional)')}
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {activeTemplate.slots
                      .filter((s) => s.type === 'text')
                      .map((slot) => (
                        <div key={slot.id}>
                          <span className="text-[11px] text-muted-foreground block mb-1">
                            {slot.label}
                          </span>
                          <input
                            type="text"
                            value={slotValues[slot.id] ?? ''}
                            onChange={(e) =>
                              setSlotValues((prev) => ({ ...prev, [slot.id]: e.target.value }))
                            }
                            placeholder={slot.defaultText}
                            className="w-full h-8 rounded-lg border border-white/10 bg-[#181a24] px-2.5 text-xs text-white outline-none focus:border-primary/40"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setActiveTemplate(null)}
                className="px-3.5 py-1.5 rounded-xl border border-white/10 text-xs font-medium text-white/70 hover:bg-white/5 transition-colors cursor-pointer"
              >
                {t('Cancelar', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => void handleCreateFromActiveTemplate()}
                className="px-4 py-1.5 rounded-xl bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-md shadow-primary/20"
              >
                {creating ? t('Creando…', 'Creating…') : t('Crear proyecto', 'Create Project')}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

