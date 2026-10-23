import { AIEditProposalSchema, ExportOptionsSchema, MediaMetadataSchema } from './contracts'
import type { AIEditProposal, AIProvider, ExportOptions, ExportService, MediaMetadata, MediaService, ProgressHandler } from './contracts'

const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export const mockMediaService: MediaService = {
  async inspect(file) {
    if (!file.name.trim()) throw new Error('El archivo no tiene nombre.')
    if (!/^(video|audio|image)\//i.test(file.type)) throw new Error(`Tipo de archivo no compatible: ${file.name}`)
    return MediaMetadataSchema.parse({ name: file.name, mimeType: file.type, sizeBytes: file.size, status: 'catalog-only' })
  },
  async createThumbnail(assetId, timeSeconds) {
    const label = encodeURIComponent(`${assetId} · ${Math.max(0, timeSeconds).toFixed(2)}s`)
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="#22262a"/><text x="16" y="92" fill="#b4f36b" font-family="sans-serif" font-size="13">${label}</text></svg>`)}`
  },
}

export const mockAIProvider: AIProvider<{ projectName: string }> = {
  async proposeEdits(project, prompt): Promise<AIEditProposal> {
    await sleep(180)
    return AIEditProposalSchema.parse({ id: `proposal-${crypto.randomUUID()}`, provider: 'mock', status: 'proposal', prompt, summary: `Sugerencia para “${project.projectName}”: prueba un inicio más pausado y deja respirar el paisaje.`, changes: [] })
  },
}

type ExportJob = { timer: number; progress: number; onProgress: ProgressHandler }
const jobs = new Map<string, ExportJob>()
let jobSequence = 0

export const mockExportService: ExportService = {
  async start(rawOptions, onProgress) {
    const options = ExportOptionsSchema.parse(rawOptions)
    const jobId = `mock-export-${++jobSequence}`
    const job: ExportJob = { timer: 0, progress: 0, onProgress }
    job.timer = window.setInterval(() => {
      job.progress = Math.min(100, job.progress + 10)
      job.onProgress(job.progress)
      if (job.progress === 100) {
        window.clearInterval(job.timer)
        jobs.delete(jobId)
      }
    }, 90)
    jobs.set(jobId, job)
    void options
    return { jobId }
  },
  async cancel(jobId) {
    const job = jobs.get(jobId)
    if (!job) return
    window.clearInterval(job.timer)
    jobs.delete(jobId)
  },
}

export type { AIEditProposal, ExportOptions, MediaMetadata }
