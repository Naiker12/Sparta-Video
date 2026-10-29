import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

/**
 * Bespoke 1.5px technical vector iconography engineered for Sparta Video NLE.
 * Designed with broadcast/editorial geometry (DaVinci / Linear / FCP craft)
 * to avoid generic AI-template sparkles, magic wands, robots, or OS emojis.
 */

export function IconNleBrandMark({ size = 15, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="1.75" y="2.5" width="12.5" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.25 5.25H6M4.25 5.25V7M11.75 5.25H10M11.75 5.25V7M4.25 10.75H6M4.25 10.75V9M11.75 10.75H10M11.75 10.75V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      <polygon points="6.75,6.1 10.1,8 6.75,9.9" fill="currentColor" />
    </svg>
  )
}

export function IconNleCaptions({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.35" />
      <rect x="3.5" y="9" width="4.2" height="2" rx="0.7" fill="currentColor" />
      <path d="M9.2 10H12.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 5.5H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.38" />
    </svg>
  )
}

export function IconNleTitleHook({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M2 4.5V3C2 2.45 2.45 2 3 2H4.5M11.5 2H13C13.55 2 14 2.45 14 3V4.5M14 11.5V13C14 13.55 13.55 14 13 14H11.5M4.5 14H3C2.45 14 2 13.55 2 13V11.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.5" />
      <path d="M5.25 5.25H10.75M8 5.25V11.25M6.5 11.25H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconNleRipplePack({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="1.5" y="3.5" width="4.25" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.35" />
      <rect x="10.25" y="3.5" width="4.25" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.35" />
      <path d="M6.75 8H9.25M7.6 6.5L6.25 8L7.6 9.5M8.4 6.5L9.75 8L8.4 9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  )
}

export function IconNleSceneCut({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M8 1.75L9.6 3.35L8 4.95L6.4 3.35L8 1.75Z" fill="currentColor" />
      <path d="M8 5.2V14.25" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeDasharray="1.8 1.8" />
      <path d="M5.5 6.5H2.5C1.95 6.5 1.5 6.95 1.5 7.5V12C1.5 12.55 1.95 13 2.5 13H5.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.7" />
      <path d="M10.5 6.5H13.5C14.05 6.5 14.5 6.95 14.5 7.5V12C14.5 12.55 14.05 13 13.5 13H10.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

export function IconNleAudioMix({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M3.5 2.5V13.5M8 2.5V13.5M12.5 2.5V13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4" />
      <rect x="2" y="5" width="3" height="2.2" rx="0.6" fill="currentColor" />
      <rect x="6.5" y="8.8" width="3" height="2.2" rx="0.6" fill="currentColor" />
      <rect x="11" y="4" width="3" height="2.2" rx="0.6" fill="currentColor" />
    </svg>
  )
}

export function IconNleAspectRatio({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="1.5" y="3" width="13" height="10" rx="1.8" stroke="currentColor" strokeWidth="1.3" opacity="0.45" />
      <rect x="5.25" y="2" width="5.5" height="12" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function IconNleAssistant({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.5" stroke="currentColor" strokeWidth="1.3" opacity="0.42" />
      <path d="M8 4.25L11.75 8L8 11.75L4.25 8L8 4.25Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function IconNleScript({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="2.25" width="12" height="11.5" rx="1.8" stroke="currentColor" strokeWidth="1.35" />
      <path d="M5.5 2.5V13.5" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M7.5 5.5H11.5M7.5 8H11.5M7.5 10.5H10" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="3.75" cy="5.5" r="0.75" fill="currentColor" />
      <circle cx="3.75" cy="8" r="0.75" fill="currentColor" />
      <circle cx="3.75" cy="10.5" r="0.75" fill="currentColor" />
    </svg>
  )
}

export function IconNleVoiceWave({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M2.25 6.5V9.5M5 4.25V11.75M8 2.25V13.75M11 4.75V11.25M13.75 6.25V9.75" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  )
}

export function IconNlePanelRight({ size = 15, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="1.75" y="2.5" width="12.5" height="11" rx="2" stroke="currentColor" strokeWidth="1.35" />
      <path d="M10.25 2.75V13.25" stroke="currentColor" strokeWidth="1.3" />
      <rect x="11.35" y="4.25" width="1.6" height="7.5" rx="0.6" fill="currentColor" opacity="0.65" />
    </svg>
  )
}

export function IconNleMontage({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="1.5" y="3" width="6.5" height="3.8" rx="1" stroke="currentColor" strokeWidth="1.35" />
      <rect x="6" y="9.2" width="8.5" height="3.8" rx="1" stroke="currentColor" strokeWidth="1.35" />
      <path d="M10.25 3V6.8M1.5 11.1H4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}
