import type { TemplateRepository } from './template-repository'
import { defaultTemplateRepository } from '../infrastructure/idb-template-repository'
import type { ProjectRepository } from '../../projects/application/project-repository'
import { defaultProjectRepository } from '../../projects/infrastructure/idb-project-repository'
import type { ProjectRecord, ProjectPresetFormat } from '../../projects/domain/project.types'
import type { SpartaTemplate, TemplateCategory, TemplateSlot, SlotFillValue } from '../domain/template.types'
import { instantiateTemplate } from '../domain/instantiate-template'

export class TemplateService {
  templateRepo: TemplateRepository
  projectRepo: ProjectRepository

  constructor(
    templateRepo: TemplateRepository = defaultTemplateRepository,
    projectRepo: ProjectRepository = defaultProjectRepository,
  ) {
    this.templateRepo = templateRepo
    this.projectRepo = projectRepo
  }

  async listTemplates(options: {
    category?: TemplateCategory
    format?: ProjectPresetFormat
    query?: string
  } = {}): Promise<SpartaTemplate[]> {
    let list = await this.templateRepo.listTemplates()

    if (options.category) {
      list = list.filter((t) => t.category === options.category)
    }

    if (options.format) {
      list = list.filter((t) => t.format === options.format)
    }

    if (options.query?.trim()) {
      const q = options.query.toLowerCase().trim()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
    }

    return list
  }

  async getTemplate(id: string): Promise<SpartaTemplate | null> {
    return this.templateRepo.getTemplate(id)
  }

  async createProjectFromTemplate(
    templateId: string,
    options: {
      projectName?: string
      slotFills?: Record<string, SlotFillValue>
    } = {},
  ): Promise<ProjectRecord> {
    const template = await this.templateRepo.getTemplate(templateId)
    if (!template) {
      throw new Error(`Plantilla no encontrada: ${templateId}`)
    }

    const state = instantiateTemplate(template, options)
    const newId = crypto.randomUUID()
    const now = new Date().toISOString()

    const project: ProjectRecord = {
      id: newId,
      schemaVersion: 2,
      createdAt: now,
      updatedAt: now,
      origin: {
        kind: 'template',
        templateId: template.id,
      },
      state,
      workspace: {
        playhead: 0,
        zoom: 1,
        selectedClipId: null,
      },
    }

    await this.projectRepo.saveProject(project)
    return project
  }

  async saveProjectAsTemplate(
    project: ProjectRecord,
    options: {
      name: string
      description: string
      category: TemplateCategory
      slots?: TemplateSlot[]
    },
  ): Promise<SpartaTemplate> {
    const format: ProjectPresetFormat =
      project.state.sequence.width < project.state.sequence.height
        ? '9:16'
        : project.state.sequence.width === project.state.sequence.height
        ? '1:1'
        : '16:9'

    let durationSeconds = 0
    project.state.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const end = clip.start + clip.duration
        if (end > durationSeconds) durationSeconds = end
      })
    })

    const template: SpartaTemplate = {
      id: `usr-template-${crypto.randomUUID()}`,
      name: options.name.trim() || project.state.projectName,
      description: options.description.trim(),
      category: options.category,
      format,
      durationSeconds: Math.ceil(durationSeconds),
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      slots: options.slots || [],
      state: {
        projectName: options.name.trim() || project.state.projectName,
        sequence: { ...project.state.sequence },
        tracks: project.state.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c })) })),
        assets: project.state.assets.map((a) => ({ ...a })),
        markers: project.state.markers.map((m) => ({ ...m })),
        snapToFrames: project.state.snapToFrames ?? true,
        mutedTracks: [...(project.state.mutedTracks ?? [])],
        lockedTracks: [...(project.state.lockedTracks ?? [])],
      },
    }

    await this.templateRepo.saveTemplate(template)
    return template
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.templateRepo.deleteTemplate(id)
  }
}

export const defaultTemplateService = new TemplateService()

