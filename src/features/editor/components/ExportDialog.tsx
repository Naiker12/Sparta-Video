import { Dialog } from '@base-ui/react/dialog'
import {
  CheckCircle2,
  Download,
  Film,
  LoaderCircle,
  Music,
  Radio,
  Sliders,
  Sparkles,
  Tv,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from '../../../components/ui/toast'
import type { MediaItem, Track } from '../model'
import type { ExportPresetId, ExportSettings, RenderProgress } from '../services/contracts'
import {
  EXPORT_PRESETS,
  downloadRenderResult,
  getDefaultExportSettings,
  renderSequence,
} from '../services/export-engine'
import { t, useLanguage } from '../services/locale'
import { formatTimecode } from '../timecode'

type Props = {
  open: boolean
  projectName: string
  sequenceDuration: number
  sequenceSize: { width: number; height: number; frameRate: number }
  tracks: Track[]
  assets: MediaItem[]
  mutedTracks?: string[]
  onOpenChange: (open: boolean) => void
}

export function ExportDialog({
  open,
  projectName,
  sequenceDuration,
  sequenceSize,
  tracks,
  assets,
  mutedTracks = [],
  onOpenChange,
}: Props) {
  useLanguage()
  const [preset, setPreset] = useState<ExportPresetId>('web-1080p')
  const [settings, setSettings] = useState<ExportSettings>(() =>
    getDefaultExportSettings(projectName, 'web-1080p'),
  )
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handlePresetSelect = (id: ExportPresetId) => {
    setPreset(id)
    const p = EXPORT_PRESETS[id]
    setSettings((prev) => ({
      ...prev,
      preset: id,
      format: p.format,
      width: p.width,
      height: p.height,
      frameRate: p.frameRate,
      bitrateMbps: p.bitrateMbps,
      fileName: prev.fileName.replace(/\.[a-z0-9]+$/i, `.${p.format}`),
    }))
  }

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsExporting(false)
    setProgress(null)
    toast.info(t('Exportación cancelada', 'Export cancelled'))
  }

  const handleStartExport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isExporting) return

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsExporting(true)

    const exportToast = toast.loading(
      t('Iniciando exportación…', 'Starting export…'),
      {
        description: `${settings.fileName} (${settings.width}×${settings.height})`,
      },
    )

    try {
      const result = await renderSequence({
        tracks,
        assets,
        sequenceDuration,
        settings,
        mutedTracks,
        signal: controller.signal,
        onProgress: (prog) => {
          setProgress(prog)
          if (prog.stage === 'rendering' || prog.stage === 'encoding') {
            toast.loading(prog.message ?? t('Procesando secuencia…', 'Processing sequence…'), {
              id: exportToast,
            })
          }
        },
      })

      // Download file to disk
      downloadRenderResult(result)

      toast.success(t('Vídeo exportado con éxito', 'Video exported successfully'), {
        id: exportToast,
        description: `${result.fileName} · ${formatBytes(result.sizeBytes)}`,
        duration: 7000,
      })

      onOpenChange(false)
    } catch (error) {
      const isAbort = error instanceof Error && /cancelada/i.test(error.message)
      if (isAbort) {
        toast.info(t('Exportación cancelada', 'Export cancelled'), { id: exportToast })
      } else {
        const message = error instanceof Error ? error.message : t('Error desconocido durante la exportación.', 'Unknown export error.')
        toast.error(t('Fallo en la exportación', 'Export failed'), {
          id: exportToast,
          description: message,
          duration: 8000,
        })
      }
    } finally {
      setIsExporting(false)
      abortControllerRef.current = null
    }
  }

  const estSizeBytes = Math.round(
    ((sequenceDuration * settings.bitrateMbps * 1_000_000) / 8),
  )

  const presetIcons: Record<ExportPresetId, typeof Tv> = {
    'web-1080p': Tv,
    'social-vertical': Radio,
    'uhd-4k': Film,
    'fast-720p': Sparkles,
    'audio-only': Music,
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setSettings(getDefaultExportSettings(projectName, preset))
          setIsExporting(false)
          setProgress(null)
        } else if (isExporting) {
          handleCancelExport()
        }
        onOpenChange(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Popup
          className="export-dialog"
          aria-labelledby="export-dialog-title"
          aria-describedby="export-dialog-desc"
        >
          <header className="dialog-heading">
            <div>
              <span className="dialog-eyebrow">
                {t('MOTOR DE RENDERIZADO', 'RENDERING ENGINE')}
              </span>
              <Dialog.Title id="export-dialog-title" className="dialog-title">
                {t('Exportar secuencia de vídeo', 'Export video sequence')}
              </Dialog.Title>
              <Dialog.Description id="export-dialog-desc" className="dialog-description">
                {t(
                  'Elige un perfil optimizado o personaliza los parámetros de salida.',
                  'Choose an optimized preset or customize output parameters.',
                )}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="dialog-close"
              aria-label={t('Cerrar diálogo de exportación', 'Close export dialog')}
              disabled={isExporting}
            >
              <X size={16} />
            </Dialog.Close>
          </header>

          <form onSubmit={handleStartExport} className="export-form">
            <div className="export-body">
              {/* Preset selection grid */}
              <div className="export-section">
                <label className="export-section-label">
                  {t('Preajustes de exportación', 'Export presets')}
                </label>
                <div className="export-preset-grid" role="radiogroup" aria-label={t('Preajustes de exportación', 'Export presets')}>
                  {(Object.keys(EXPORT_PRESETS) as ExportPresetId[]).map((id) => {
                    const item = EXPORT_PRESETS[id]
                    const Icon = presetIcons[id]
                    const isSelected = preset === id
                    return (
                      <button
                        type="button"
                        key={id}
                        role="radio"
                        aria-checked={isSelected}
                        className={`export-preset-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handlePresetSelect(id)}
                        disabled={isExporting}
                      >
                        <div className="export-preset-header">
                          <Icon size={18} className="export-preset-icon" />
                          <span className="export-preset-title">{item.label}</span>
                          {isSelected && <CheckCircle2 size={16} className="export-preset-check" />}
                        </div>
                        <span className="export-preset-desc">{item.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Quick file name input */}
              <div className="export-section">
                <label htmlFor="export-filename-input" className="export-section-label">
                  {t('Nombre del archivo de salida', 'Output filename')}
                </label>
                <input
                  id="export-filename-input"
                  className="export-input"
                  value={settings.fileName}
                  disabled={isExporting}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, fileName: e.target.value }))
                  }
                  required
                />
              </div>

              {/* Advanced settings toggle */}
              <div className="export-advanced-toggle">
                <button
                  type="button"
                  className="export-toggle-button"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  disabled={isExporting}
                >
                  <Sliders size={14} />
                  <span>
                    {showAdvanced
                      ? t('Ocultar ajustes avanzados', 'Hide advanced settings')
                      : t('Mostrar ajustes avanzados (resolución, bitrate, fps)', 'Show advanced settings (resolution, bitrate, fps)')}
                  </span>
                </button>
              </div>

              {/* Advanced settings block */}
              {showAdvanced && (
                <div className="export-advanced-panel">
                  <div className="export-row">
                    <div className="export-field">
                      <label htmlFor="export-width">{t('Ancho (px)', 'Width (px)')}</label>
                      <input
                        id="export-width"
                        type="number"
                        min={128}
                        max={7680}
                        step={2}
                        value={settings.width}
                        disabled={isExporting}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            width: Math.max(128, parseInt(e.target.value, 10) || 128),
                          }))
                        }
                      />
                    </div>
                    <div className="export-field">
                      <label htmlFor="export-height">{t('Alto (px)', 'Height (px)')}</label>
                      <input
                        id="export-height"
                        type="number"
                        min={128}
                        max={4320}
                        step={2}
                        value={settings.height}
                        disabled={isExporting}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            height: Math.max(128, parseInt(e.target.value, 10) || 128),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="export-row">
                    <div className="export-field">
                      <label htmlFor="export-fps">{t('Fotogramas/seg', 'Frame rate')}</label>
                      <select
                        id="export-fps"
                        value={settings.frameRate}
                        disabled={isExporting}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            frameRate: parseInt(e.target.value, 10) || 30,
                          }))
                        }
                      >
                        <option value={24}>24 fps (Cinemático)</option>
                        <option value={30}>30 fps (Estándar)</option>
                        <option value={60}>60 fps (Fluido)</option>
                      </select>
                    </div>
                    <div className="export-field">
                      <label htmlFor="export-bitrate">
                        {t('Bitrate de vídeo', 'Video bitrate')}: {settings.bitrateMbps} Mbps
                      </label>
                      <input
                        id="export-bitrate"
                        type="range"
                        min={1}
                        max={50}
                        step={1}
                        value={settings.bitrateMbps}
                        disabled={isExporting}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            bitrateMbps: parseFloat(e.target.value) || 8,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Summary metadata card */}
              <div className="export-summary-card">
                <div className="export-summary-item">
                  <span className="export-summary-label">{t('Duración', 'Duration')}</span>
                  <span className="export-summary-value">
                    {formatTimecode(sequenceDuration, sequenceSize.frameRate)}
                  </span>
                </div>
                <div className="export-summary-item">
                  <span className="export-summary-label">{t('Resolución', 'Resolution')}</span>
                  <span className="export-summary-value">
                    {settings.width} × {settings.height} ({settings.frameRate} fps)
                  </span>
                </div>
                <div className="export-summary-item">
                  <span className="export-summary-label">{t('Formato', 'Format')}</span>
                  <span className="export-summary-value">
                    {settings.format.toUpperCase()} ({settings.bitrateMbps} Mbps)
                  </span>
                </div>
                <div className="export-summary-item">
                  <span className="export-summary-label">{t('Tamaño est.', 'Est. Size')}</span>
                  <span className="export-summary-value">{formatBytes(estSizeBytes)}</span>
                </div>
              </div>

              {/* Live progress indicator when rendering */}
              {isExporting && progress && (
                <div className="export-progress-panel" role="region" aria-live="polite">
                  <div className="export-progress-header">
                    <span className="export-progress-message">
                      <LoaderCircle size={15} className="spin" aria-hidden="true" />
                      {progress.message ?? t('Renderizando vídeo…', 'Rendering video…')}
                    </span>
                    <span className="export-progress-percent">{progress.percent}%</span>
                  </div>
                  <div className="export-progress-track">
                    <div
                      className="export-progress-bar"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <footer className="dialog-actions export-footer">
              {isExporting ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancelExport}
                >
                  {t('Cancelar exportación', 'Cancel export')}
                </button>
              ) : (
                <Dialog.Close className="secondary-button">
                  {t('Cancelar', 'Cancel')}
                </Dialog.Close>
              )}

              <button
                type="submit"
                className="primary-button export-submit-btn"
                disabled={isExporting || sequenceDuration <= 0}
              >
                {isExporting ? (
                  <>
                    <LoaderCircle size={15} className="spin" />
                    <span>{t('Exportando…', 'Exporting…')}</span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>{t('Comenzar exportación', 'Start export')}</span>
                  </>
                )}
              </button>
            </footer>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
