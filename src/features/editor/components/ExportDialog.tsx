import { Dialog } from '@base-ui/react/dialog'
import { Check, X } from 'lucide-react'
import { formatTimecode } from '../timecode'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  fileName: string
  onFileNameChange: (value: string) => void
  resolution: string
  frameRate: number
  duration: number
  exporting: boolean
  progress: number
  complete: boolean
  onStart: () => void
  onCancel: () => void
  onEditSettings: () => void
}

export function ExportDialog({ open, onOpenChange, projectName, fileName, onFileNameChange, resolution, frameRate, duration, exporting, progress, complete, onStart, onCancel, onEditSettings }: Props) {
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next && exporting) onCancel(); onOpenChange(next) }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="modal-backdrop" />
      <Dialog.Popup className="export-dialog" aria-describedby="export-description">
        <div className="dialog-heading"><div><span className="eyebrow">ENTREGA · DEMO</span><Dialog.Title id="export-title">Exportar vídeo</Dialog.Title></div><Dialog.Close className="subtle-button" aria-label="Cerrar exportación"><X size={17} /></Dialog.Close></div>
        {complete ? <div className="export-result" role="status"><span className="export-result-icon"><Check size={18} /></span><h3>Simulación terminada</h3><p id="export-description">No se creó ningún archivo de vídeo. El flujo de exportación real aún no está conectado.</p><button className="secondary-button" onClick={onEditSettings}>Volver a los ajustes</button></div> : <>
          <Dialog.Description id="export-description">Prepara una exportación simulada de <strong>{projectName}</strong>.</Dialog.Description>
          <label>Nombre del archivo<input value={fileName} onChange={(event) => onFileNameChange(event.target.value)} disabled={exporting} /></label>
          <div className="export-settings"><span>Formato <strong>MP4 · H.264</strong></span><span>Resolución <strong>{resolution}</strong></span><span>Fotogramas por segundo <strong>{frameRate} fps</strong></span><span>Duración <strong>{formatTimecode(duration, frameRate)}</strong></span></div>
          {exporting && <div className="export-progress" role="progressbar" aria-label="Progreso de exportación de demostración" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>}
          <button className="export-button dialog-export" onClick={onStart} disabled={exporting}>{exporting ? `Procesando demo… ${progress}%` : 'Simular exportación'}</button>
          {exporting && <button className="secondary-button" onClick={onCancel}>Cancelar simulación</button>}
          <small>Esta demostración no genera ningún archivo de vídeo.</small>
        </>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
