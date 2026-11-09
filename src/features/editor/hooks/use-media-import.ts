import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../editor-store'
import type { MediaItem, SequenceSettings, Track } from '../model'
import {
  captureVideoThumbnail,
  formatMediaDuration,
  getMediaMimeType,
  probeMediaMetadata,
  storeMediaFile,
  storeMediaPreview,
} from '../services/media-storage'
import { t } from '../../../shared/i18n/locale'
import { errorMessage, toast } from '../../../shared/ui/toast-service'

export function formatFileSize(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`
}

interface UseMediaImportOptions {
  tracks: Track[]
  sequence: SequenceSettings
  addAssets: (assets: MediaItem[]) => void
  selectMedia: (assetId: string) => void
  updateAsset: (id: string, patch: Partial<MediaItem>) => void
  removeAsset: (id: string) => void
  addMedia: (asset: MediaItem, at?: number, trackId?: string) => string | null
  setSequence: (sequence: SequenceSettings) => void
  undo: () => void
}

export function useMediaImport({
  tracks,
  sequence,
  addAssets,
  selectMedia,
  updateAsset,
  removeAsset,
  addMedia,
  setSequence,
  undo,
}: UseMediaImportOptions) {
  const [importStatus, setImportStatus] = useState<{
    isImporting: boolean
    current: number
    total: number
    currentFileName: string
  } | null>(null)

  const importFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    const sourceFiles = Array.from(files)
    setImportStatus({
      isImporting: true,
      current: 0,
      total: sourceFiles.length,
      currentFileName: sourceFiles[0]?.name ?? '',
    })
    const pending = sourceFiles.map((file) => {
      const mime = getMediaMimeType(file)
      const type: MediaItem['type'] = mime.startsWith('image/')
        ? 'image'
        : mime.startsWith('audio/')
          ? 'audio'
          : 'video'
      const asset: MediaItem = {
        id: `local-${crypto.randomUUID()}`,
        title: file.name,
        detail: `${type.toUpperCase()} · ${formatFileSize(file.size)}`,
        thumb: type === 'audio' ? 'wave' : type === 'image' ? 'image-catalog' : 'video-catalog',
        type,
        status: 'processing',
      }
      return { file, asset }
    })
    addAssets(pending.map(({ asset }) => asset))
    if (pending[0].asset.type !== 'audio') selectMedia(pending[0].asset.id)
    const isSingle = sourceFiles.length === 1
    const importToast = toast.loading(
      isSingle
        ? t('Importando y procesando vídeo…', 'Importing and processing video…')
        : t(`Importando ${sourceFiles.length} archivos…`, `Importing ${sourceFiles.length} files…`),
      {
        description: isSingle
          ? t(`Indexando "${sourceFiles[0].name}" y generando miniatura…`, `Indexing "${sourceFiles[0].name}" and generating thumbnail…`)
          : t('Indexando metadatos y generando miniaturas…', 'Indexing metadata and generating thumbnails…'),
      },
    )
    const { inspectMediaFile } = await import('../services/media-catalog')
    let processedCount = 0
    const results = await Promise.allSettled(
      pending.map(async ({ file, asset }, idx) => {
        setImportStatus((prev) => (prev ? { ...prev, currentFileName: file.name } : null))
        if (!isSingle) {
          toast.loading(
            t(`Procesando archivo ${idx + 1} de ${sourceFiles.length}…`, `Processing file ${idx + 1} of ${sourceFiles.length}…`),
            { id: importToast, description: file.name },
          )
        }
        const metadata = await inspectMediaFile(file)
        await storeMediaFile(asset.id, file)
        const probed =
          asset.type !== 'image'
            ? await probeMediaMetadata(file, asset.type)
            : await probeMediaMetadata(file, 'image')
        if (asset.type === 'video') {
          const preview = await captureVideoThumbnail(file)
          if (preview) await storeMediaPreview(asset.id, preview)
        }
        const durationSuffix = probed.duration ? ` · ${formatMediaDuration(probed.duration)}` : ''
        const resSuffix = probed.width && probed.height ? ` · ${probed.width}×${probed.height}` : ''
        updateAsset(asset.id, {
          title: metadata.name,
          detail: `${asset.type.toUpperCase()} · ${formatFileSize(metadata.sizeBytes)}${resSuffix}${durationSuffix}`,
          ...(probed.duration ? { durationSeconds: probed.duration } : {}),
          ...(probed.width ? { width: probed.width } : {}),
          ...(probed.height ? { height: probed.height } : {}),
          status: 'ready',
        })
        processedCount++
        setImportStatus((prev) => (prev ? { ...prev, current: processedCount } : null))
        return asset.id
      }),
    )
    setImportStatus(null)
    const failedNames = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return []
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : t('No se pudo procesar el archivo.', 'Could not process the file.')
      updateAsset(pending[index].asset.id, { status: 'error', detail: message })
      return [sourceFiles[index].name]
    })
    const succeeded = results.length - failedNames.length
    if (succeeded && failedNames.length) {
      toast.warning(
        t(`${succeeded} importados, ${failedNames.length} con incidencias`, `${succeeded} imported, ${failedNames.length} with issues`),
        { id: importToast, description: failedNames.join(', '), duration: 7000 },
      )
    } else if (succeeded) {
      const firstName = sourceFiles[0]?.name ?? ''
      toast.success(
        isSingle
          ? t('Vídeo listo en la biblioteca', 'Video ready in library')
          : t(`${succeeded} archivos listos en la biblioteca`, `${succeeded} files ready in library`),
        {
          id: importToast,
          description: isSingle ? firstName : t('Listos para arrastrar a la línea de tiempo.', 'Ready to drag to the timeline.'),
          duration: 6000,
        },
      )
    } else {
      toast.error(
        t(`${failedNames.length} archivo(s) no se pudieron procesar`, `${failedNames.length} file(s) could not be processed`),
        {
          id: importToast,
          description: t('Revisa el estado en la biblioteca.', 'Check their status in the library.'),
          duration: 8000,
        },
      )
    }
  }

  const importFilesRef = useRef(importFiles)
  useEffect(() => {
    importFilesRef.current = importFiles
  })

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    const handleDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault()
        void importFilesRef.current(e.dataTransfer.files)
      }
    }
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  const deleteMedia = (assetId: string) => {
    const asset = useEditorStore.getState().assets.find((item) => item.id === assetId)
    removeAsset(assetId)
    if (!asset) return
    const historyDepth = useEditorStore.getState().past.length
    toast.info(t('Medio eliminado', 'Media removed'), {
      description: asset.title,
      duration: 6000,
      action: {
        label: t('Deshacer', 'Undo'),
        onClick: () => {
          if (useEditorStore.getState().past.length === historyDepth) undo()
        },
      },
    })
  }

  const relinkMedia = async (assetId: string, file: File) => {
    updateAsset(assetId, { status: 'processing' })
    try {
      const { inspectMediaFile } = await import('../services/media-catalog')
      const metadata = await inspectMediaFile(file)
      const type: MediaItem['type'] = metadata.mimeType.startsWith('image/')
        ? 'image'
        : metadata.mimeType.startsWith('audio/')
          ? 'audio'
          : 'video'
      await storeMediaFile(assetId, file)
      const probed =
        type !== 'image' ? await probeMediaMetadata(file, type) : await probeMediaMetadata(file, 'image')
      if (type === 'video') {
        const preview = await captureVideoThumbnail(file)
        if (preview) await storeMediaPreview(assetId, preview)
      }
      const durationSuffix = probed.duration ? ` · ${formatMediaDuration(probed.duration)}` : ''
      const resSuffix = probed.width && probed.height ? ` · ${probed.width}×${probed.height}` : ''
      updateAsset(assetId, {
        title: metadata.name,
        type,
        detail: `${type.toUpperCase()} · ${formatFileSize(metadata.sizeBytes)}${resSuffix}${durationSuffix}`,
        ...(probed.duration ? { durationSeconds: probed.duration } : {}),
        ...(probed.width ? { width: probed.width } : {}),
        ...(probed.height ? { height: probed.height } : {}),
        thumb: type === 'image' ? 'image-catalog' : type === 'audio' ? 'wave' : 'video-catalog',
        status: 'ready',
      })
      toast.success(t('Medio vinculado', 'Media linked'), { description: metadata.name })
    } catch (error) {
      const message = errorMessage(error, t('No se pudo vincular el archivo.', 'Could not link the file.'))
      updateAsset(assetId, { status: 'error', detail: message })
      toast.error(t('No se pudo vincular el medio', 'Could not link media'), { description: message })
    }
  }

  const addMediaToTimeline = (asset: MediaItem, at?: number, trackId?: string) => {
    const existingVideoClips = tracks.filter((t) => t.kind === 'video').flatMap((t) => t.clips)
    if (existingVideoClips.length === 0 && asset.type === 'video') {
      const isVertical = asset.height && asset.width ? asset.height > asset.width : false
      if (isVertical && sequence.width > sequence.height) {
        setSequence({ ...sequence, width: 1080, height: 1920 })
        toast.info(t('Secuencia adaptada a formato vertical 9:16 (1080×1920)', 'Sequence adapted to vertical 9:16 (1080×1920)'), {
          description: t('Adaptado automáticamente al formato del vídeo.', 'Adapted automatically to video format.'),
        })
      } else if (!isVertical && asset.width && asset.height && sequence.height > sequence.width) {
        setSequence({ ...sequence, width: 1920, height: 1080 })
        toast.info(t('Secuencia adaptada a formato horizontal 16:9 (1920×1080)', 'Sequence adapted to horizontal 16:9 (1920×1080)'))
      }
    }
    const id = addMedia(asset, at, trackId)
    if (!id) {
      toast.warning(
        asset.type === 'audio'
          ? t('Elige una pista de audio desbloqueada para insertar este medio.', 'Choose an unlocked audio track to insert this media.')
          : t('Elige una pista de vídeo desbloqueada para insertar este medio.', 'Choose an unlocked video track to insert this media.'),
      )
    }
    return id
  }

  const copyClipName = async (name: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(name)
      toast.success(t('Nombre del clip copiado.', 'Clip name copied.'))
    } catch {
      toast.error(t('No se pudo acceder al portapapeles en este navegador.', 'Clipboard access is unavailable in this browser.'))
    }
  }

  return {
    importStatus,
    importFiles,
    deleteMedia,
    relinkMedia,
    addMediaToTimeline,
    copyClipName,
  }
}

