import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { useState } from 'react'
import { t, useLanguage } from '../services/locale'

type Props = { open: boolean; name: string; onOpenChange: (open: boolean) => void; onSave: (name: string) => void }

export function RenameProjectDialog({ open, name, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState(name)
  useLanguage()
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const clean = draft.trim()
    if (clean) { onSave(clean); onOpenChange(false) }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (next) setDraft(name); onOpenChange(next) }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Popup className="rename-dialog" aria-labelledby="rename-title" aria-describedby="rename-description">
          <header className="dialog-heading">
            <div>
              <span className="dialog-eyebrow">{t('PROYECTO', 'PROJECT')}</span>
              <Dialog.Title id="rename-title" className="dialog-title">{t('Cambiar nombre del proyecto', 'Rename project')}</Dialog.Title>
              <Dialog.Description id="rename-description" className="dialog-description">{t('El nombre se mostrará en la barra del editor.', 'This name appears in the editor title bar.')}</Dialog.Description>
            </div>
            <Dialog.Close className="dialog-close" aria-label={t('Cerrar diálogo', 'Close dialog')}><X size={16} /></Dialog.Close>
          </header>
          <form onSubmit={submit}>
            <label htmlFor="project-name-input">{t('Nombre del proyecto', 'Project name')}</label>
            <input id="project-name-input" autoFocus maxLength={60} value={draft} onChange={(event) => setDraft(event.target.value)} />
            <footer className="dialog-actions">
              <Dialog.Close className="secondary-button">{t('Cancelar', 'Cancel')}</Dialog.Close>
              <button className="primary-button" type="submit" disabled={!draft.trim()}>{t('Guardar nombre', 'Save name')}</button>
            </footer>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
