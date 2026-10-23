import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { useState } from 'react'

type Props = { open: boolean; name: string; onOpenChange: (open: boolean) => void; onSave: (name: string) => void }
export function RenameProjectDialog({ open, name, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState(name)
  const submit = (event: React.FormEvent) => { event.preventDefault(); const clean = draft.trim(); if (clean) { onSave(clean); onOpenChange(false) } }
  return <Dialog.Root open={open} onOpenChange={(next) => { if (next) setDraft(name); onOpenChange(next) }}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Popup className="rename-dialog" aria-labelledby="rename-title"><header><div><span className="settings-eyebrow">PROYECTO</span><Dialog.Title id="rename-title">Cambiar nombre del proyecto</Dialog.Title><Dialog.Description>El nombre se mostrará en la barra del editor.</Dialog.Description></div><Dialog.Close className="sheet-close" aria-label="Cerrar diálogo de nombre"><X size={16} /></Dialog.Close></header><form onSubmit={submit}><label htmlFor="project-name-input">Nombre del proyecto</label><input id="project-name-input" autoFocus maxLength={60} value={draft} onChange={(event) => setDraft(event.target.value)} /><footer><Dialog.Close className="secondary-button">Cancelar</Dialog.Close><button className="primary-button" type="submit" disabled={!draft.trim()}>Guardar nombre</button></footer></form></Dialog.Popup></Dialog.Portal></Dialog.Root>
}
