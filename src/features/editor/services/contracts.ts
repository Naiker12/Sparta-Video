import { z } from 'zod'

export const MediaMetadataSchema = z.object({
  name: z.string().min(1), mimeType: z.string(), sizeBytes: z.number().nonnegative(), durationSeconds: z.number().nonnegative().optional(), width: z.number().positive().optional(), height: z.number().positive().optional(), status: z.enum(['catalog-only', 'ready', 'missing', 'processing', 'error']),
})
export type MediaMetadata = z.infer<typeof MediaMetadataSchema>

export const ExportOptionsSchema = z.object({
  projectName: z.string().min(1), fileName: z.string().min(1), format: z.enum(['mp4']), codec: z.enum(['h264']), width: z.number().int().positive(), height: z.number().int().positive(), frameRate: z.number().positive(), durationSeconds: z.number().nonnegative(),
})
export type ExportOptions = z.infer<typeof ExportOptionsSchema>

export const AIEditProposalSchema = z.object({
  id: z.string().min(1), provider: z.enum(['mock', 'local', 'remote']), status: z.enum(['proposal', 'applied', 'rejected']), prompt: z.string().min(1), summary: z.string().min(1), changes: z.array(z.object({ target: z.string(), description: z.string() })),
})
export type AIEditProposal = z.infer<typeof AIEditProposalSchema>

export type ProgressHandler = (progress: number) => void
export interface MediaService {
  inspect(file: File): Promise<MediaMetadata>
  createThumbnail(assetId: string, timeSeconds: number): Promise<string>
}
export interface ProjectService<TProject> {
  load(projectId: string): Promise<TProject | null>
  save(projectId: string, project: TProject): Promise<void>
}
export interface ExportService {
  start(options: ExportOptions, onProgress: ProgressHandler): Promise<{ jobId: string }>
  cancel(jobId: string): Promise<void>
}
export interface AIProvider<TProject> {
  proposeEdits(project: TProject, prompt: string): Promise<AIEditProposal>
}
