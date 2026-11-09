import type { SpartaTemplate } from '../domain/template.types'
import { STICKMAN_TEMPLATES } from './stickman'
import { SOCIAL_TEMPLATES } from './social'
import { YOUTUBE_TEMPLATES } from './youtube'
import { BUSINESS_TEMPLATES } from './business'
import { EDUCATION_TEMPLATES } from './education'
import { CINEMATIC_TEMPLATES } from './cinematic'

export const BUILTIN_TEMPLATES: SpartaTemplate[] = [
  ...STICKMAN_TEMPLATES,
  ...SOCIAL_TEMPLATES,
  ...YOUTUBE_TEMPLATES,
  ...BUSINESS_TEMPLATES,
  ...EDUCATION_TEMPLATES,
  ...CINEMATIC_TEMPLATES,
]

export {
  STICKMAN_TEMPLATES,
  SOCIAL_TEMPLATES,
  YOUTUBE_TEMPLATES,
  BUSINESS_TEMPLATES,
  EDUCATION_TEMPLATES,
  CINEMATIC_TEMPLATES,
}

