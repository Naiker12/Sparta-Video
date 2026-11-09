import type { SpartaTemplate } from '../domain/template.types'

export interface TemplateRepository {
  listTemplates(): Promise<SpartaTemplate[]>
  getTemplate(id: string): Promise<SpartaTemplate | null>
  saveTemplate(template: SpartaTemplate): Promise<void>
  deleteTemplate(id: string): Promise<void>
}

