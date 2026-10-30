import type {
  Clip,
  TextAnimation,
  TextAnimationIn,
  TextAnimationLoop,
  TextAnimationOut,
  TextStyle,
} from '../model'

export type TextPresetCategory = 'subtitles' | 'titles' | 'lower-thirds' | 'kinetic'

export interface TextPresetDefinition {
  id: string
  name: string
  nameEn: string
  category: TextPresetCategory
  badge: string
  sampleText: string
  defaultDuration: number
  style: TextStyle
  animation: TextAnimation
}

export const TEXT_FONT_FAMILIES: { id: string; label: string; css: string }[] = [
  { id: 'inter-black', label: 'Inter Display Black', css: '"Inter", "Segoe UI", system-ui, sans-serif' },
  { id: 'montserrat', label: 'Montserrat Heavy (Hormozi)', css: '"Montserrat", "Inter", "Arial Black", sans-serif' },
  { id: 'bebas', label: 'Impact / Bebas Titular', css: '"Impact", "Haettenschweiler", "Arial Narrow Bold", sans-serif' },
  { id: 'editorial', label: 'Instrument Serif Cine', css: '"Georgia", "Times New Roman", serif' },
  { id: 'jetbrains', label: 'JetBrains Mono Tech', css: '"JetBrains Mono", "Consolas", ui-monospace, monospace' },
]

export const TEXT_ANIMATIONS_IN: { id: TextAnimationIn; label: string; labelEn: string; tag: string }[] = [
  { id: 'none', label: 'Sin entrada', labelEn: 'None', tag: 'OFF' },
  { id: 'pop', label: 'Pop Elástico', labelEn: 'Spring Pop', tag: 'POP' },
  { id: 'karaoke', label: 'Karaoke Palabra', labelEn: 'Word Karaoke', tag: 'KARAOKE' },
  { id: 'typewriter', label: 'Máquina de Escribir', labelEn: 'Typewriter', tag: 'FX' },
  { id: 'fade-up', label: 'Fundido Ascendente', labelEn: 'Fade Up', tag: 'CINE' },
  { id: 'bounce', label: 'Rebote Dinámico', labelEn: 'Dynamic Bounce', tag: 'REBOTE' },
  { id: 'slide-left', label: 'Deslizar Lateral', labelEn: 'Slide Left', tag: 'TV' },
  { id: 'glitch', label: 'Glitch Digital', labelEn: 'Cyber Glitch', tag: 'FX' },
  { id: 'zoom-in', label: 'Impacto Zoom', labelEn: 'Impact Zoom', tag: 'HOOK' },
]

export const TEXT_ANIMATIONS_OUT: { id: TextAnimationOut; label: string; labelEn: string }[] = [
  { id: 'none', label: 'Sin salida', labelEn: 'None' },
  { id: 'fade-out', label: 'Fundido Suave', labelEn: 'Smooth Fade' },
  { id: 'pop-out', label: 'Contracción Pop', labelEn: 'Pop Out' },
  { id: 'slide-down', label: 'Caída Suave', labelEn: 'Slide Down' },
]

export const TEXT_ANIMATIONS_LOOP: { id: TextAnimationLoop; label: string; labelEn: string }[] = [
  { id: 'none', label: 'Estático', labelEn: 'Static' },
  { id: 'pulse', label: 'Pulso Rítmico', labelEn: 'Rhythm Pulse' },
  { id: 'float', label: 'Flotación Suave', labelEn: 'Cinema Float' },
  { id: 'neon-flicker', label: 'Destello Neón', labelEn: 'Neon Flicker' },
]

const CORE_TEXT_STYLE_PRESETS: TextPresetDefinition[] = [
  {
    id: 'hormozi-karaoke',
    name: 'Hormozi Karaoke',
    nameEn: 'Hormozi Karaoke',
    category: 'subtitles',
    badge: 'KARAOKE',
    sampleText: 'EL SECRETO ESTÁ EN EL RITMO VISUAL',
    defaultDuration: 3.2,
    style: {
      presetId: 'hormozi-karaoke',
      fontFamily: '"Montserrat", "Inter", "Arial Black", sans-serif',
      fontSize: 54,
      fontWeight: 900,
      color: '#ffffff',
      accentColor: '#facc15',
      strokeColor: '#000000',
      strokeWidth: 7,
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      backgroundRadius: 10,
      shadowColor: 'rgba(0,0,0,0.85)',
      shadowBlur: 14,
      align: 'center',
      positionY: 78,
      uppercase: true,
      italic: false,
      letterSpacing: 1,
    },
    animation: {
      in: 'karaoke',
      out: 'fade-out',
      loop: 'none',
      inDuration: 0.35,
      outDuration: 0.25,
    },
  },
  {
    id: 'capcut-pop-pill',
    name: 'Pop Pill Dinámico',
    nameEn: 'Dynamic Pop Pill',
    category: 'subtitles',
    badge: 'POP',
    sampleText: 'Subtítulo dinámico con impacto inmediato',
    defaultDuration: 3.0,
    style: {
      presetId: 'capcut-pop-pill',
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      fontSize: 44,
      fontWeight: 800,
      color: '#ffffff',
      accentColor: '#38bdf8',
      strokeColor: '#090d16',
      strokeWidth: 0,
      backgroundColor: '#2563eb',
      backgroundOpacity: 92,
      backgroundRadius: 14,
      shadowColor: 'rgba(15, 23, 42, 0.7)',
      shadowBlur: 18,
      align: 'center',
      positionY: 80,
      uppercase: false,
      italic: false,
      letterSpacing: 0,
    },
    animation: {
      in: 'pop',
      out: 'pop-out',
      loop: 'none',
      inDuration: 0.32,
      outDuration: 0.22,
    },
  },
  {
    id: 'cine-sub-minimal',
    name: 'Cine Subtítulo 4K',
    nameEn: 'Cinema Subtitle 4K',
    category: 'subtitles',
    badge: 'CINE',
    sampleText: 'Cada fotograma cuenta una historia distinta.',
    defaultDuration: 3.5,
    style: {
      presetId: 'cine-sub-minimal',
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      fontSize: 38,
      fontWeight: 600,
      color: '#fef08a',
      accentColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 3,
      backgroundColor: '#090a0f',
      backgroundOpacity: 64,
      backgroundRadius: 8,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 10,
      align: 'center',
      positionY: 86,
      uppercase: false,
      italic: false,
      letterSpacing: 0.5,
    },
    animation: {
      in: 'fade-up',
      out: 'fade-out',
      loop: 'none',
      inDuration: 0.35,
      outDuration: 0.3,
    },
  },
  {
    id: 'editorial-hook',
    name: 'Titular Impact Hook',
    nameEn: 'Impact Hook Title',
    category: 'titles',
    badge: 'TITULAR',
    sampleText: 'CAPÍTULO 01 · EL ORIGEN',
    defaultDuration: 4.0,
    style: {
      presetId: 'editorial-hook',
      fontFamily: '"Impact", "Haettenschweiler", "Arial Narrow Bold", sans-serif',
      fontSize: 74,
      fontWeight: 900,
      color: '#ffffff',
      accentColor: '#f97316',
      strokeColor: '#000000',
      strokeWidth: 5,
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      backgroundRadius: 12,
      shadowColor: 'rgba(0,0,0,0.9)',
      shadowBlur: 22,
      align: 'center',
      positionY: 48,
      uppercase: true,
      italic: false,
      letterSpacing: 3,
    },
    animation: {
      in: 'zoom-in',
      out: 'fade-out',
      loop: 'float',
      inDuration: 0.45,
      outDuration: 0.35,
    },
  },
  {
    id: 'kinetic-neon-glow',
    name: 'Cyber Neón Cinético',
    nameEn: 'Kinetic Cyber Neon',
    category: 'kinetic',
    badge: 'NEÓN FX',
    sampleText: 'EDICIÓN DE ALTO CALIBRE',
    defaultDuration: 3.5,
    style: {
      presetId: 'kinetic-neon-glow',
      fontFamily: '"Montserrat", "Inter", "Arial Black", sans-serif',
      fontSize: 58,
      fontWeight: 900,
      color: '#e0f2fe',
      accentColor: '#38bdf8',
      strokeColor: '#0284c7',
      strokeWidth: 3,
      backgroundColor: '#082f49',
      backgroundOpacity: 35,
      backgroundRadius: 12,
      shadowColor: '#0ea5e9',
      shadowBlur: 26,
      align: 'center',
      positionY: 24,
      uppercase: true,
      italic: true,
      letterSpacing: 2,
    },
    animation: {
      in: 'glitch',
      out: 'pop-out',
      loop: 'neon-flicker',
      inDuration: 0.4,
      outDuration: 0.25,
    },
  },
  {
    id: 'lower-third-studio',
    name: 'Lower Third Broadcast',
    nameEn: 'Broadcast Lower Third',
    category: 'lower-thirds',
    badge: 'LOWER 3RD',
    sampleText: 'DIRECCIÓN CREATIVA · ESTUDIO PRINCIPAL',
    defaultDuration: 4.2,
    style: {
      presetId: 'lower-third-studio',
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      fontSize: 34,
      fontWeight: 700,
      color: '#f8fafc',
      accentColor: '#38bdf8',
      strokeColor: '#000000',
      strokeWidth: 0,
      backgroundColor: '#0f172a',
      backgroundOpacity: 88,
      backgroundRadius: 8,
      shadowColor: 'rgba(0,0,0,0.65)',
      shadowBlur: 16,
      align: 'left',
      positionY: 82,
      uppercase: true,
      italic: false,
      letterSpacing: 1.5,
    },
    animation: {
      in: 'slide-left',
      out: 'fade-out',
      loop: 'none',
      inDuration: 0.4,
      outDuration: 0.3,
    },
  },
  {
    id: 'typewriter-docu',
    name: 'Documental Timecode',
    nameEn: 'Documentary Typewriter',
    category: 'kinetic',
    badge: 'TYPEWRITER',
    sampleText: '[ARCHIVO 04] · SECUENCIA VERIFICADA EN CAMPO',
    defaultDuration: 3.8,
    style: {
      presetId: 'typewriter-docu',
      fontFamily: '"JetBrains Mono", "Consolas", ui-monospace, monospace',
      fontSize: 36,
      fontWeight: 700,
      color: '#4ade80',
      accentColor: '#bbf7d0',
      strokeColor: '#052e16',
      strokeWidth: 2,
      backgroundColor: '#051910',
      backgroundOpacity: 84,
      backgroundRadius: 6,
      shadowColor: 'rgba(34, 197, 94, 0.35)',
      shadowBlur: 12,
      align: 'center',
      positionY: 82,
      uppercase: false,
      italic: false,
      letterSpacing: 1,
    },
    animation: {
      in: 'typewriter',
      out: 'fade-out',
      loop: 'none',
      inDuration: 0.9,
      outDuration: 0.25,
    },
  },
  {
    id: 'bounce-viral',
    name: 'Reels Bounce Energía',
    nameEn: 'Viral Reels Bounce',
    category: 'subtitles',
    badge: 'VIRAL',
    sampleText: '¡NO PASES ESTE VIDEO SIN VER ESTO!',
    defaultDuration: 2.8,
    style: {
      presetId: 'bounce-viral',
      fontFamily: '"Montserrat", "Inter", "Arial Black", sans-serif',
      fontSize: 50,
      fontWeight: 900,
      color: '#ffffff',
      accentColor: '#fde047',
      strokeColor: '#881337',
      strokeWidth: 4,
      backgroundColor: '#e11d48',
      backgroundOpacity: 92,
      backgroundRadius: 14,
      shadowColor: 'rgba(136, 19, 55, 0.8)',
      shadowBlur: 18,
      align: 'center',
      positionY: 75,
      uppercase: true,
      italic: false,
      letterSpacing: 1,
    },
    animation: {
      in: 'bounce',
      out: 'pop-out',
      loop: 'pulse',
      inDuration: 0.42,
      outDuration: 0.22,
    },
  },
]

const EXTRA_TEXT_PRESETS: Array<{
  id: string
  name: string
  category: TextPresetCategory
  badge: string
  sampleText: string
  base: string
  style: Partial<Omit<TextStyle, 'presetId'>>
  animation: TextAnimation
}> = [
  {
    id: 'impact-stamp-title', name: 'Sello de Impacto', category: 'titles', badge: 'IMPACTO', sampleText: 'IDEA CENTRAL', base: 'editorial-hook',
    style: { fontFamily: '"Montserrat", "Inter", sans-serif', fontSize: 78, color: '#fff7ed', accentColor: '#fb923c', strokeWidth: 5, strokeColor: '#431407', backgroundOpacity: 0, letterSpacing: 1.2 },
    animation: { in: 'zoom-in', out: 'pop-out', loop: 'pulse', inDuration: 0.38, outDuration: 0.22 },
  },
  {
    id: 'neon-outline-title', name: 'Contorno Neón', category: 'titles', badge: 'NEÓN', sampleText: 'MODO NOCHE', base: 'kinetic-neon-glow',
    style: { fontFamily: '"Bebas Neue", Impact, sans-serif', fontSize: 82, color: '#ecfeff', accentColor: '#22d3ee', strokeWidth: 4, strokeColor: '#155e75', backgroundOpacity: 0, letterSpacing: 2.2 },
    animation: { in: 'glitch', out: 'fade-out', loop: 'neon-flicker', inDuration: 0.44, outDuration: 0.28 },
  },
  {
    id: 'minimal-name-lower-third', name: 'Nombre Editorial', category: 'lower-thirds', badge: 'EDITORIAL', sampleText: 'SOFÍA · DIRECTORA', base: 'lower-third-studio',
    style: { fontFamily: '"Georgia", "Times New Roman", serif', fontSize: 38, color: '#fff7ed', accentColor: '#d6b36a', backgroundColor: '#131820', backgroundOpacity: 78, backgroundRadius: 4, italic: true, letterSpacing: 0.7 },
    animation: { in: 'fade-up', out: 'fade-out', loop: 'float', inDuration: 0.55, outDuration: 0.32 },
  },
  {
    id: 'punchy-highlight-captions', name: 'Subtítulo Enfático', category: 'subtitles', badge: 'ÉNFASIS', sampleText: 'MIRA ESTO', base: 'capcut-pop-pill',
    style: { fontFamily: '"Inter", "Segoe UI", sans-serif', fontSize: 52, color: '#ffffff', accentColor: '#a3e635', backgroundColor: '#172554', backgroundOpacity: 94, backgroundRadius: 10, strokeWidth: 2, strokeColor: '#020617', letterSpacing: 0.5 },
    animation: { in: 'bounce', out: 'pop-out', loop: 'pulse', inDuration: 0.4, outDuration: 0.2 },
  },
]

export const TEXT_STYLE_PRESETS: TextPresetDefinition[] = [
  ...CORE_TEXT_STYLE_PRESETS,
  ...EXTRA_TEXT_PRESETS.map((preset): TextPresetDefinition => {
    const base = CORE_TEXT_STYLE_PRESETS.find((item) => item.id === preset.base) ?? CORE_TEXT_STYLE_PRESETS[0]
    return {
      ...base,
      id: preset.id,
      name: preset.name,
      nameEn: preset.name,
      category: preset.category,
      badge: preset.badge,
      sampleText: preset.sampleText,
      style: { ...base.style, ...preset.style, presetId: preset.id },
      animation: { ...preset.animation },
    }
  }),
]

export function getTextPreset(presetId?: string): TextPresetDefinition {
  return TEXT_STYLE_PRESETS.find((p) => p.id === presetId) ?? TEXT_STYLE_PRESETS[0]
}

export function getDefaultTextStyle(presetId = 'hormozi-karaoke'): TextStyle {
  return { ...getTextPreset(presetId).style }
}

export function getDefaultTextAnimation(presetId = 'hormozi-karaoke'): TextAnimation {
  return { ...getTextPreset(presetId).animation }
}

export interface ComputedTextAnimationFrame {
  opacity: number
  scaleX: number
  scaleY: number
  translateXPx: number
  translateYPx: number
  rotationDeg: number
  glitchShiftPx: number
  displayText: string
  words: string[]
  activeWordIndex: number
  isKaraoke: boolean
  isTypewriter: boolean
}

/**
 * Computes frame-accurate CapCut Pro entry, exit, continuous loop, typewriter, and word-karaoke state
 * for both the live DOM preview monitor and the Canvas 2D video exporter.
 */
export function computeTextAnimationState(clip: Clip, playhead: number): ComputedTextAnimationFrame {
  const rawText = clip.text ?? clip.title ?? ''
  const style = clip.textStyle ?? getDefaultTextStyle()
  const anim = clip.textAnimation ?? getDefaultTextAnimation(style.presetId)
  const formattedText = style.uppercase ? rawText.toUpperCase() : rawText

  const duration = Math.max(0.1, clip.duration)
  const elapsed = Math.max(0, Math.min(duration, playhead - clip.start))
  const remaining = Math.max(0, duration - elapsed)
  const progress = Math.max(0, Math.min(1, elapsed / duration))

  const inDur = Math.max(0.08, Math.min(duration * 0.65, anim.inDuration || 0.35))
  const outDur = Math.max(0.08, Math.min(duration * 0.45, anim.outDuration || 0.25))
  const inT = anim.in === 'none' ? 1 : Math.max(0, Math.min(1, elapsed / inDur))
  const outT = anim.out === 'none' ? 1 : Math.max(0, Math.min(1, remaining / outDur))

  let opacity = (clip.opacity ?? 100) / 100
  let scaleX = 1
  let scaleY = 1
  let translateXPx = 0
  let translateYPx = 0
  const rotationDeg = 0
  let glitchShiftPx = 0

  // Entry animations
  switch (anim.in) {
    case 'pop': {
      // Overshoot spring curve
      const easeOutBack = 1 + 2.2 * Math.pow(inT - 1, 3) + 1.2 * Math.pow(inT - 1, 2)
      const s = Math.max(0.2, inT < 1 ? easeOutBack : 1)
      scaleX *= s
      scaleY *= s
      opacity *= Math.min(1, inT * 2.5)
      break
    }
    case 'fade-up': {
      const ease = 1 - Math.pow(1 - inT, 3)
      opacity *= ease
      translateYPx += (1 - ease) * 26
      break
    }
    case 'slide-left': {
      const ease = 1 - Math.pow(1 - inT, 3)
      opacity *= ease
      translateXPx -= (1 - ease) * 64
      break
    }
    case 'bounce': {
      const bounce = inT < 1 ? 1 - Math.abs(Math.cos(inT * Math.PI * 2.5)) * (1 - inT) * 0.55 : 1
      scaleX *= bounce
      scaleY *= bounce
      translateYPx -= inT < 1 ? Math.abs(Math.sin(inT * Math.PI * 2)) * (1 - inT) * 28 : 0
      opacity *= Math.min(1, inT * 3)
      break
    }
    case 'zoom-in': {
      const ease = 1 - Math.pow(1 - inT, 3)
      const s = 1.45 - 0.45 * ease
      scaleX *= s
      scaleY *= s
      opacity *= ease
      break
    }
    case 'glitch': {
      if (inT < 1) {
        const wave = Math.sin(elapsed * 55)
        glitchShiftPx = wave * (1 - inT) * 14
        scaleX *= 1 + Math.cos(elapsed * 40) * (1 - inT) * 0.08
        opacity *= inT > 0.15 ? 1 : 0.45
      }
      break
    }
    case 'typewriter':
    case 'karaoke': {
      opacity *= Math.min(1, inT * 4)
      break
    }
    case 'none':
    default:
      break
  }

  // Exit animations
  if (anim.out !== 'none' && outT < 1) {
    const easeOut = outT * outT
    switch (anim.out) {
      case 'fade-out':
        opacity *= easeOut
        break
      case 'pop-out':
        opacity *= easeOut
        scaleX *= 0.65 + 0.35 * easeOut
        scaleY *= 0.65 + 0.35 * easeOut
        break
      case 'slide-down':
        opacity *= easeOut
        translateYPx += (1 - easeOut) * 24
        break
    }
  }

  // Continuous loop animations
  if (anim.loop === 'pulse') {
    const pulse = 1 + Math.sin(elapsed * Math.PI * 2.4) * 0.045
    scaleX *= pulse
    scaleY *= pulse
  } else if (anim.loop === 'float') {
    translateYPx += Math.sin(elapsed * Math.PI * 1.5) * 5
  } else if (anim.loop === 'neon-flicker') {
    const flicker = Math.sin(elapsed * 29) * Math.cos(elapsed * 13)
    if (flicker > 0.72) opacity *= 0.78
  }

  // Typewriter character reveal
  const isTypewriter = anim.in === 'typewriter'
  let displayText = formattedText
  if (isTypewriter) {
    const revealWindow = Math.max(0.2, Math.min(duration * 0.75, anim.inDuration || 0.85))
    const charProgress = Math.max(0, Math.min(1, elapsed / revealWindow))
    const charCount = Math.max(1, Math.ceil(formattedText.length * charProgress))
    displayText = formattedText.slice(0, charCount)
  }

  // Word-by-word Karaoke calculation
  const words = displayText.split(/\s+/).filter(Boolean)
  const isKaraoke = anim.in === 'karaoke' && words.length > 0
  const activeWordIndex = isKaraoke
    ? Math.min(words.length - 1, Math.floor(progress * words.length))
    : -1

  return {
    opacity: Math.max(0, Math.min(1, opacity)),
    scaleX,
    scaleY,
    translateXPx,
    translateYPx,
    rotationDeg,
    glitchShiftPx,
    displayText,
    words,
    activeWordIndex,
    isKaraoke,
    isTypewriter,
  }
}

function hexToRgba(hex: string, alphaPercent: number): string {
  const clean = hex.replace('#', '').trim()
  const alpha = Math.max(0, Math.min(1, alphaPercent / 100))
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0
    const g = parseInt(clean[1] + clean[1], 16) || 0
    const b = parseInt(clean[2] + clean[2], 16) || 0
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const r = parseInt(clean.slice(0, 2), 16) || 0
  const g = parseInt(clean.slice(2, 4), 16) || 0
  const b = parseInt(clean.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Renders an animated text/subtitle clip directly onto a 2D Canvas during video export.
 */
export function drawAnimatedTextClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  time: number,
  canvasWidth: number,
  canvasHeight: number,
  sequenceSize?: { width: number; height: number } | number,
): void {
  const style = clip.textStyle ?? getDefaultTextStyle()
  const state = computeTextAnimationState(clip, time)
  if (!state.displayText.trim() || state.opacity <= 0.01) return

  ctx.save()
  const clipAlpha = Math.max(0, Math.min(1, (clip.opacity ?? 100) / 100))
  ctx.globalAlpha = state.opacity * clipAlpha

  const isVertical = canvasHeight > canvasWidth
  const seqW =
    typeof sequenceSize === 'object' && sequenceSize?.width
      ? sequenceSize.width
      : typeof sequenceSize === 'number'
        ? sequenceSize
        : isVertical
          ? 1080
          : 1920

  const seqH =
    typeof sequenceSize === 'object' && sequenceSize?.height
      ? sequenceSize.height
      : typeof sequenceSize === 'number'
        ? Math.round(sequenceSize * (canvasHeight / canvasWidth))
        : isVertical
          ? 1920
          : 1080

  // Calculate sequence viewport within export canvas (handles letterboxing/pillarboxing)
  const seqAspect = seqW / Math.max(1, seqH)
  const canvasAspect = canvasWidth / Math.max(1, canvasHeight)

  let viewW = canvasWidth
  let viewH = canvasHeight
  let viewX = 0
  let viewY = 0

  if (Math.abs(canvasAspect - seqAspect) > 0.01) {
    if (canvasAspect > seqAspect) {
      // Pillarbox (vertical video centered on widescreen horizontal export)
      viewH = canvasHeight
      viewW = viewH * seqAspect
      viewX = (canvasWidth - viewW) / 2
      viewY = 0
    } else {
      // Letterbox
      viewW = canvasWidth
      viewH = viewW / seqAspect
      viewX = 0
      viewY = (canvasHeight - viewH) / 2
    }
  }

  const exportTextUnit = viewH / Math.max(1, seqH)
  const isSubtitle =
    clip.thumbnail === 'text-overlay' ||
    (clip.textStyle?.presetId ?? '').includes('karaoke') ||
    (clip.textStyle?.presetId ?? '').includes('pop') ||
    (clip.textStyle?.presetId ?? '').includes('sub')

  const baseFontSize = style.fontSize || (isSubtitle ? 42 : 52)
  const scaledFontSize = Math.max(12, Math.round(baseFontSize * exportTextUnit))

  const fontStyle = style.italic ? 'italic ' : ''
  ctx.font = `${fontStyle}${style.fontWeight} ${scaledFontSize}px ${style.fontFamily}`
  ctx.textBaseline = 'middle'

  const lineHeight = scaledFontSize * 1.24
  const maxAllowedWidth = Math.round(viewW * 0.86)

  // Calibraciones del clip
  const calibScaleX = (clip.transform?.scaleX ?? 100) / 100
  const calibScaleY = (clip.transform?.scaleY ?? 100) / 100
  const calibRotation = clip.transform?.rotation ?? 0

  // Cálculo normalizado del anclaje horizontal relativo a la secuencia (0.0 a 1.0)
  let normX = 0.5
  if (clip.transform && typeof clip.transform.x === 'number') {
    const ratio = clip.transform.x / Math.max(1, seqW)
    if (Math.abs(ratio - 0.5) <= 0.02) {
      normX = 0.5
    } else {
      normX = Math.max(0.06, Math.min(0.94, ratio))
    }
  }

  // Cálculo normalizado del anclaje vertical relativo al viewport activo
  const defaultPosY = isSubtitle ? 78 : 50
  const posYPercent = Math.max(6, Math.min(94, style.positionY ?? defaultPosY))
  const targetY = viewY + (posYPercent / 100) * viewH

  if (state.isKaraoke && state.words.length > 0) {
    const spaceWidth = ctx.measureText(' ').width
    const wordWidths = state.words.map((w) => ctx.measureText(w).width)

    // Particionar palabras en renglones que quepan dentro de maxAllowedWidth
    type KaraokeLine = { words: string[]; wordIndices: number[]; lineWidth: number }
    const karaokeLines: KaraokeLine[] = []
    let curLineWords: string[] = []
    let curLineIndices: number[] = []
    let curLineWidth = 0

    for (let i = 0; i < state.words.length; i++) {
      const wWidth = wordWidths[i]
      const addedWidth = curLineWords.length > 0 ? spaceWidth + wWidth : wWidth
      if (curLineWords.length > 0 && curLineWidth + addedWidth > maxAllowedWidth) {
        karaokeLines.push({ words: curLineWords, wordIndices: curLineIndices, lineWidth: curLineWidth })
        curLineWords = [state.words[i]]
        curLineIndices = [i]
        curLineWidth = wWidth
      } else {
        curLineWords.push(state.words[i])
        curLineIndices.push(i)
        curLineWidth += addedWidth
      }
    }
    if (curLineWords.length > 0) {
      karaokeLines.push({ words: curLineWords, wordIndices: curLineIndices, lineWidth: curLineWidth })
    }

    const kTotalHeight = karaokeLines.length * lineHeight
    const maxKLineWidth = Math.max(...karaokeLines.map((l) => l.lineWidth), 0)

    let targetX = viewX + viewW * normX
    if (!isSubtitle && style.align === 'left' && normX === 0.5) {
      targetX = viewX + viewW * 0.08 + maxKLineWidth / 2
    } else if (!isSubtitle && style.align === 'right' && normX === 0.5) {
      targetX = viewX + viewW * 0.92 - maxKLineWidth / 2
    }

    // Anclaje horizontal seguro
    let safeAnchorX = targetX
    if (normX !== 0.5) {
      const halfWidth = (maxKLineWidth / 2) * calibScaleX
      const minX = viewX + viewW * 0.04 + halfWidth
      const maxX = viewX + viewW * 0.96 - halfWidth
      if (maxX >= minX) {
        safeAnchorX = Math.max(minX, Math.min(maxX, targetX))
      }
    }

    let safeAnchorY = targetY
    const halfHeight = (kTotalHeight / 2) * calibScaleY
    const minY = viewY + viewH * 0.04 + halfHeight
    const maxY = viewY + viewH * 0.96 - halfHeight
    if (maxY >= minY) {
      safeAnchorY = Math.max(minY, Math.min(maxY, targetY))
    }

    // Prevención de desborde si el texto es muy ancho para el viewport activo
    const effectiveWidth = maxKLineWidth * calibScaleX
    const overflowRatio = effectiveWidth > viewW * 0.88 ? (viewW * 0.88) / effectiveWidth : 1

    ctx.translate(
      safeAnchorX + (state.translateXPx + state.glitchShiftPx) * exportTextUnit,
      safeAnchorY + state.translateYPx * exportTextUnit,
    )
    const totalRotation = state.rotationDeg + calibRotation
    if (totalRotation) ctx.rotate((totalRotation * Math.PI) / 180)
    ctx.scale(state.scaleX * calibScaleX * overflowRatio, state.scaleY * calibScaleY * overflowRatio)

    // Dibujar caja de fondo redondeada si aplica
    if (style.backgroundOpacity > 0 && maxKLineWidth > 0) {
      const padX = Math.round(20 * exportTextUnit)
      const padY = Math.round(10 * exportTextUnit)
      const boxW = maxKLineWidth + padX * 2
      const boxH = kTotalHeight + padY * 2
      const boxX = -boxW / 2
      const boxY = -kTotalHeight / 2 - padY
      const radius = Math.min(boxH / 2, Math.round(style.backgroundRadius * exportTextUnit))

      ctx.fillStyle = hexToRgba(style.backgroundColor, style.backgroundOpacity)
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(boxX, boxY, boxW, boxH, radius)
      } else {
        ctx.rect(boxX, boxY, boxW, boxH)
      }
      ctx.fill()
    }

    if (style.shadowBlur > 0) {
      ctx.shadowColor = style.shadowColor
      ctx.shadowBlur = style.shadowBlur * exportTextUnit
      ctx.shadowOffsetY = 3 * exportTextUnit
    }

    ctx.textAlign = 'left'
    karaokeLines.forEach((lineObj, lIdx) => {
      const lineY = -kTotalHeight / 2 + lineHeight * (lIdx + 0.5)
      let cursorX = -lineObj.lineWidth / 2

      for (let k = 0; k < lineObj.words.length; k++) {
        const word = lineObj.words[k]
        const globalIdx = lineObj.wordIndices[k]
        const isCurrent = globalIdx === state.activeWordIndex
        const isPast = globalIdx < state.activeWordIndex
        const wWidth = wordWidths[globalIdx]

        if (style.strokeWidth > 0) {
          ctx.strokeStyle = style.strokeColor
          ctx.lineWidth = Math.min(5, style.strokeWidth) * exportTextUnit
          ctx.lineJoin = 'round'
          ctx.strokeText(word, cursorX, lineY)
        }

        ctx.fillStyle = isCurrent ? style.accentColor : isPast ? style.color : style.color
        ctx.fillText(word, cursorX, isCurrent ? lineY - 2 * exportTextUnit : lineY)
        cursorX += wWidth + spaceWidth
      }
    })
  } else {
    // Texto estándar / multilínea con ajuste inteligente
    const rawLines = state.displayText.split('\n')
    const lines: string[] = []
    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim()
      if (!trimmed) continue
      const words = trimmed.split(/\s+/)
      if (words.length <= 1) {
        lines.push(trimmed)
        continue
      }
      let currentLine = words[0]
      for (let i = 1; i < words.length; i++) {
        const candidate = `${currentLine} ${words[i]}`
        if (ctx.measureText(candidate).width > maxAllowedWidth) {
          lines.push(currentLine)
          currentLine = words[i]
        } else {
          currentLine = candidate
        }
      }
      if (currentLine) lines.push(currentLine)
    }
    if (!lines.length && state.displayText.trim()) {
      lines.push(state.displayText.trim())
    }
    const totalHeight = lines.length * lineHeight

    let maxLineWidth = 0
    for (const line of lines) {
      const m = ctx.measureText(line)
      if (m.width > maxLineWidth) maxLineWidth = m.width
    }

    let targetX = viewX + viewW * normX
    if (!isSubtitle && style.align === 'left' && normX === 0.5) {
      targetX = viewX + viewW * 0.08 + maxLineWidth / 2
    } else if (!isSubtitle && style.align === 'right' && normX === 0.5) {
      targetX = viewX + viewW * 0.92 - maxLineWidth / 2
    }

    let safeAnchorX = targetX
    if (normX !== 0.5) {
      const halfWidth = (maxLineWidth / 2) * calibScaleX
      const minX = viewX + viewW * 0.04 + halfWidth
      const maxX = viewX + viewW * 0.96 - halfWidth
      if (maxX >= minX) {
        safeAnchorX = Math.max(minX, Math.min(maxX, targetX))
      }
    }

    let safeAnchorY = targetY
    const halfHeight = (totalHeight / 2) * calibScaleY
    const minY = viewY + viewH * 0.04 + halfHeight
    const maxY = viewY + viewH * 0.96 - halfHeight
    if (maxY >= minY) {
      safeAnchorY = Math.max(minY, Math.min(maxY, targetY))
    }

    const effectiveWidth = maxLineWidth * calibScaleX
    const overflowRatio = effectiveWidth > viewW * 0.88 ? (viewW * 0.88) / effectiveWidth : 1

    ctx.translate(
      safeAnchorX + (state.translateXPx + state.glitchShiftPx) * exportTextUnit,
      safeAnchorY + state.translateYPx * exportTextUnit,
    )
    const totalRotation = state.rotationDeg + calibRotation
    if (totalRotation) ctx.rotate((totalRotation * Math.PI) / 180)
    ctx.scale(state.scaleX * calibScaleX * overflowRatio, state.scaleY * calibScaleY * overflowRatio)

    if (style.backgroundOpacity > 0 && maxLineWidth > 0) {
      const padX = Math.round(20 * exportTextUnit)
      const padY = Math.round(10 * exportTextUnit)
      const boxW = maxLineWidth + padX * 2
      const boxH = totalHeight + padY * 2
      const boxX = -boxW / 2
      const boxY = -totalHeight / 2 - padY
      const radius = Math.min(boxH / 2, Math.round(style.backgroundRadius * exportTextUnit))

      ctx.fillStyle = hexToRgba(style.backgroundColor, style.backgroundOpacity)
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(boxX, boxY, boxW, boxH, radius)
      } else {
        ctx.rect(boxX, boxY, boxW, boxH)
      }
      ctx.fill()
    }

    if (style.shadowBlur > 0) {
      ctx.shadowColor = style.shadowColor
      ctx.shadowBlur = style.shadowBlur * exportTextUnit
      ctx.shadowOffsetY = 3 * exportTextUnit
    }

    const isLeft = style.align === 'left'
    const isRight = style.align === 'right'
    ctx.textAlign = isLeft ? 'left' : isRight ? 'right' : 'center'
    const drawX = isLeft ? -maxLineWidth / 2 : isRight ? maxLineWidth / 2 : 0

    lines.forEach((line, idx) => {
      const y = -totalHeight / 2 + lineHeight * (idx + 0.5)
      if (style.strokeWidth > 0) {
        ctx.strokeStyle = style.strokeColor
        ctx.lineWidth = Math.min(5, style.strokeWidth) * exportTextUnit
        ctx.lineJoin = 'round'
        ctx.strokeText(line, drawX, y)
      }
      ctx.fillStyle = style.color
      ctx.fillText(line, drawX, y)
    })
  }

  ctx.restore()
}
