import { zip, unzip, strToU8, strFromU8, type AsyncZippable } from 'fflate'
import { exportProjectData, parseProjectFile, type SpartaProjectFile } from './project-file'
import { loadMediaBlob, storeMediaFile, getMediaMimeTypeFromName } from './media-storage'
import { useEditorStore, type EditorState } from '../editor-store'

export const SPARTA_PACKAGE_EXTENSION = '.spartapack'

export interface ExportBundleResult {
  blob: Blob
  filename: string
  mediaCount: number
}

export interface ImportBundleResult {
  project: SpartaProjectFile
  mediaCount: number
}

/**
 * Checks if a given file or array buffer starts with ZIP magic bytes (PK\x03\x04).
 */
export async function isZipArchive(file: Blob): Promise<boolean> {
  try {
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    return header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04
  } catch {
    return false
  }
}

/**
 * Packs the active project along with all referenced video/audio/image binary media into a .spartapack archive.
 */
export async function exportProjectBundle(
  state?: EditorState,
  onProgress?: (progress: { step: string; percent: number }) => void,
): Promise<ExportBundleResult> {
  const current = state ?? useEditorStore.getState()
  const projectData = exportProjectData(current)
  const projName = projectData.project.name || projectData.project.projectName || 'proyecto'
  const safeName = String(projName).replace(/[^\p{L}\p{N}_-]+/gu, '_').trim() || 'proyecto'

  onProgress?.({ step: 'Preparando metadatos...', percent: 10 })

  const archiveFiles: AsyncZippable = {
    'project.sparta': [strToU8(JSON.stringify(projectData, null, 2)), { level: 6 }],
  }

  let bundledMediaCount = 0
  const assets = projectData.project.assets || []
  const totalAssets = assets.length

  for (let i = 0; i < totalAssets; i++) {
    const asset = assets[i]
    onProgress?.({
      step: `Empaquetando medio (${i + 1}/${totalAssets}): ${asset.title}...`,
      percent: 15 + Math.round(((i + 1) / totalAssets) * 70),
    })

    try {
      const blob = await loadMediaBlob(asset.id)
      if (blob && blob.size > 0) {
        const buffer = await blob.arrayBuffer()
        const extension = asset.title.split('.').at(-1)?.toLowerCase() || (asset.type === 'video' ? 'mp4' : asset.type === 'audio' ? 'mp3' : 'png')
        const archivePath = `media/${asset.id}.${extension}`
        // Use level: 0 (store without recompression) for high speed and minimal CPU usage since media is already compressed
        archiveFiles[archivePath] = [new Uint8Array(buffer), { level: 0 }]
        bundledMediaCount++
      }
    } catch {
      // If a specific asset blob is missing locally, continue packing the rest
    }
  }

  onProgress?.({ step: 'Comprimiendo archivo final...', percent: 90 })

  const zipBlob = await new Promise<Blob>((resolve, reject) => {
    zip(archiveFiles, (err, out) => {
      if (err) reject(err)
      else resolve(new Blob([out.buffer as ArrayBuffer], { type: 'application/octet-stream' }))
    })
  })

  onProgress?.({ step: 'Completado', percent: 100 })

  return {
    blob: zipBlob,
    filename: `${safeName}${SPARTA_PACKAGE_EXTENSION}`,
    mediaCount: bundledMediaCount,
  }
}

/**
 * Unpacks a .spartapack (or ZIP archive), extracts project.sparta and restores all media files into IndexedDB.
 */
export async function importProjectBundle(
  archiveBlob: Blob,
  onProgress?: (progress: { step: string; percent: number }) => void,
): Promise<ImportBundleResult> {
  onProgress?.({ step: 'Leyendo archivo de paquete...', percent: 15 })
  const arrayBuffer = await archiveBlob.arrayBuffer()
  const u8Data = new Uint8Array(arrayBuffer)

  onProgress?.({ step: 'Descomprimiendo archivos...', percent: 35 })

  const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(u8Data, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })

  // Locate project manifest
  const projectFileBytes = unzipped['project.sparta'] || unzipped['project.json']
  if (!projectFileBytes) {
    throw new Error('El paquete no contiene un archivo project.sparta válido.')
  }

  const projectJson = strFromU8(projectFileBytes)
  const project = parseProjectFile(projectJson)

  onProgress?.({ step: 'Restaurando archivos de medios...', percent: 60 })

  let restoredMediaCount = 0
  const mediaEntries = Object.entries(unzipped).filter(([path]) => path.startsWith('media/') && path.length > 6)
  const totalMedia = mediaEntries.length

  for (let i = 0; i < totalMedia; i++) {
    const [path, fileBytes] = mediaEntries[i]
    const filenameWithExt = path.replace(/^media\//, '')
    const parts = filenameWithExt.split('.')
    const assetId = parts[0]
    const ext = parts.slice(1).join('.').toLowerCase()

    if (assetId) {
      const matchingAsset = project.project.assets?.find((a) => a.id === assetId)
      const restoredName = matchingAsset?.title || filenameWithExt
      const mime = getMediaMimeTypeFromName(restoredName) || 'application/octet-stream'
      const file = new File([fileBytes.buffer as ArrayBuffer], restoredName, { type: mime })
      await storeMediaFile(assetId, file).catch(() => {})
      restoredMediaCount++
    }

    onProgress?.({
      step: `Restaurando medios (${i + 1}/${totalMedia})...`,
      percent: 60 + Math.round(((i + 1) / Math.max(1, totalMedia)) * 35),
    })
  }

  onProgress?.({ step: 'Listo', percent: 100 })

  return {
    project,
    mediaCount: restoredMediaCount,
  }
}

/**
 * Triggers a browser file download for a generic Blob with a given filename.
 */
export function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
