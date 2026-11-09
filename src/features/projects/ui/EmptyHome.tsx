import { Plus, Upload, Zap } from 'lucide-react'
import { t } from '../../../shared/i18n/locale'

interface EmptyHomeProps {
  onNewProject: () => void
  onOpenProjectFile: () => void
}

export function EmptyHome({ onNewProject, onOpenProjectFile }: EmptyHomeProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-[#272a33] rounded-2xl bg-[#14161c]/50">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-inner">
        <Zap size={28} />
      </div>

      <h3 className="text-base font-semibold text-white mb-1">
        {t('Crea tu primer video con Sparta', 'Create your first video with Sparta')}
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm mb-6">
        {t(
          'Empieza un proyecto en blanco, importa un archivo .sparta o utiliza nuestras plantillas prediseñadas para automatizar tu contenido.',
          'Start a blank project, import a .sparta file, or use our predesigned templates to automate your content.',
        )}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onNewProject}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:brightness-110 shadow-sm transition-all cursor-pointer"
        >
          <Plus size={15} />
          <span>{t('Nuevo proyecto', 'New project')}</span>
        </button>
        <button
          type="button"
          onClick={onOpenProjectFile}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1e2129] hover:bg-[#252933] border border-[#2d313c] text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
        >
          <Upload size={14} />
          <span>{t('Abrir .sparta', 'Open .sparta')}</span>
        </button>
      </div>
    </div>
  )
}

