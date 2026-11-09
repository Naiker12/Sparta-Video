import type { Clip, ClipAnimation, ClipAnimationCombo, Keyframe } from '../model'

// ─── Catálogo de presets combinados ─────────────────────────────────────────

export type AnimPresetDef = {
  id: string
  label: string
  labelEn: string
  icon: string
  description?: string
  descriptionEn?: string
}

export const CLIP_ANIM_COMBO: AnimPresetDef[] = [
  {
    id: 'none',
    label: 'Ninguna',
    labelEn: 'None',
    icon: '—',
    description: 'Sin animación',
    descriptionEn: 'No animation',
  },
  {
    id: 'zoom-in',
    label: 'Zoom In',
    labelEn: 'Zoom In',
    icon: '⊕',
    description: 'Acercamiento progresivo durante el clip',
    descriptionEn: 'Gradual zoom in throughout the clip',
  },
  {
    id: 'zoom-out',
    label: 'Zoom Out',
    labelEn: 'Zoom Out',
    icon: '⊖',
    description: 'Alejamiento progresivo durante el clip',
    descriptionEn: 'Gradual zoom out throughout the clip',
  },
  {
    id: 'ken-burns-in',
    label: 'Ken Burns ↗',
    labelEn: 'Ken Burns In',
    icon: '⤡',
    description: 'Zoom suave de entrada estilo documental',
    descriptionEn: 'Slow documentary-style zoom in',
  },
  {
    id: 'ken-burns-out',
    label: 'Ken Burns ↙',
    labelEn: 'Ken Burns Out',
    icon: '⤢',
    description: 'Zoom suave de salida estilo documental',
    descriptionEn: 'Slow documentary-style zoom out',
  },
  {
    id: 'pan-left',
    label: 'Paneo ← izq.',
    labelEn: 'Pan Left',
    icon: '←',
    description: 'Desplazamiento de derecha a izquierda',
    descriptionEn: 'Pan from right to left',
  },
  {
    id: 'pan-right',
    label: 'Paneo → der.',
    labelEn: 'Pan Right',
    icon: '→',
    description: 'Desplazamiento de izquierda a derecha',
    descriptionEn: 'Pan from left to right',
  },
  {
    id: 'pan-up',
    label: 'Paneo ↑ arriba',
    labelEn: 'Pan Up',
    icon: '↑',
    description: 'Desplazamiento de abajo hacia arriba',
    descriptionEn: 'Pan from bottom to top',
  },
  {
    id: 'pan-down',
    label: 'Paneo ↓ abajo',
    labelEn: 'Pan Down',
    icon: '↓',
    description: 'Desplazamiento de arriba hacia abajo',
    descriptionEn: 'Pan from top to bottom',
  },
  {
    id: 'ken-burns-mix',
    label: 'Ken Burns Mix',
    labelEn: 'Ken Burns Mix',
    icon: '✦',
    description: 'Zoom + paneo diagonal combinados',
    descriptionEn: 'Zoom combined with diagonal pan',
  },
  {
    id: 'pulse',
    label: 'Pulso',
    labelEn: 'Pulse',
    icon: '♦',
    description: 'Latido suave: crece y vuelve al tamaño original',
    descriptionEn: 'Gentle heartbeat: grows and returns',
  },
  {
    id: 'float-up',
    label: 'Flotar',
    labelEn: 'Float Up',
    icon: '↕',
    description: 'Oscilación vertical suave durante el clip',
    descriptionEn: 'Gentle vertical oscillation',
  },
  {
    id: 'slow-rotate',
    label: 'Rotar suave',
    labelEn: 'Slow Rotate',
    icon: '↻',
    description: 'Rotación lenta de un lado al otro',
    descriptionEn: 'Slow tilt from side to side',
  },
  {
    id: 'drift-right',
    label: 'Deriva derecha',
    labelEn: 'Drift Right',
    icon: '⇒',
    description: 'Deriva suave hacia la derecha',
    descriptionEn: 'Gentle drift to the right',
  },
  {
    id: 'zoom-pulse',
    label: 'Zoom Pulso',
    labelEn: 'Zoom Pulse',
    icon: '◎',
    description: 'Pulsación de zoom en dos tiempos',
    descriptionEn: 'Two-beat zoom pulsation',
  },
]

// ─── Valores por defecto ─────────────────────────────────────────────────────

export function getDefaultClipAnimation(): ClipAnimation {
  return { combo: 'none', intensity: 100 }
}

// ─── Constructor de keyframes ─────────────────────────────────────────────────
//
// Genera Keyframe[] a partir del preset combinado y la intensidad.
// La intensidad (10–200, default 100) escala el delta de zoom/posición:
//   - 100 → valores por defecto
//   - 50  → movimiento sutil (la mitad)
//   - 200 → movimiento dramático (el doble)

export function buildAnimationKeyframes(
  clip: Clip,
  animation: Partial<ClipAnimation>,
  seqSize: { width: number; height: number },
): Keyframe[] {
  const comboType: ClipAnimationCombo = animation.combo ?? 'none'
  const intensity = Math.max(10, Math.min(200, animation.intensity ?? 100)) / 100

  const cx = clip.transform?.x ?? seqSize.width / 2
  const cy = clip.transform?.y ?? seqSize.height / 2
  const baseScaleX = clip.transform?.scaleX ?? 100
  const baseScaleY = clip.transform?.scaleY ?? 100

  const tStart = Math.round(clip.start * 1000) / 1000
  const tEnd = Math.round((clip.start + clip.duration) * 1000) / 1000

  // Si la duración es 0 o inválida, no generamos keyframes
  if (tEnd <= tStart || comboType === 'none') return []

  const kfs: Keyframe[] = []

  // Escala el delta aplicando la intensidad
  const sd = (base: number) => base * intensity   // scale delta
  const pd = (base: number) => base * intensity   // position delta

  switch (comboType) {
    // ── Zoom puro ──────────────────────────────────────────────────────────
    case 'zoom-in':
      kfs.push({ property: 'scale', time: tStart, valueX: baseScaleX,              valueY: baseScaleY              })
      kfs.push({ property: 'scale', time: tEnd,   valueX: baseScaleX + sd(22),     valueY: baseScaleY + sd(22)     })
      break

    case 'zoom-out':
      kfs.push({ property: 'scale', time: tStart, valueX: baseScaleX + sd(22),     valueY: baseScaleY + sd(22)     })
      kfs.push({ property: 'scale', time: tEnd,   valueX: baseScaleX,              valueY: baseScaleY              })
      break

    // ── Ken Burns ──────────────────────────────────────────────────────────
    case 'ken-burns-in':
      kfs.push({ property: 'scale', time: tStart, valueX: baseScaleX,              valueY: baseScaleY              })
      kfs.push({ property: 'scale', time: tEnd,   valueX: baseScaleX + sd(16),     valueY: baseScaleY + sd(16)     })
      break

    case 'ken-burns-out':
      kfs.push({ property: 'scale', time: tStart, valueX: baseScaleX + sd(16),     valueY: baseScaleY + sd(16)     })
      kfs.push({ property: 'scale', time: tEnd,   valueX: baseScaleX,              valueY: baseScaleY              })
      break

    // ── Paneos ────────────────────────────────────────────────────────────
    case 'pan-left':
      kfs.push({ property: 'position', time: tStart, valueX: cx + pd(90), valueY: cy })
      kfs.push({ property: 'position', time: tEnd,   valueX: cx - pd(90), valueY: cy })
      break

    case 'pan-right':
      kfs.push({ property: 'position', time: tStart, valueX: cx - pd(90), valueY: cy })
      kfs.push({ property: 'position', time: tEnd,   valueX: cx + pd(90), valueY: cy })
      break

    case 'pan-up':
      kfs.push({ property: 'position', time: tStart, valueX: cx, valueY: cy + pd(70) })
      kfs.push({ property: 'position', time: tEnd,   valueX: cx, valueY: cy - pd(70) })
      break

    case 'pan-down':
      kfs.push({ property: 'position', time: tStart, valueX: cx, valueY: cy - pd(70) })
      kfs.push({ property: 'position', time: tEnd,   valueX: cx, valueY: cy + pd(70) })
      break

    // ── Ken Burns Mix (zoom + paneo diagonal) ─────────────────────────────
    case 'ken-burns-mix':
      kfs.push({ property: 'scale',    time: tStart, valueX: baseScaleX,          valueY: baseScaleY          })
      kfs.push({ property: 'scale',    time: tEnd,   valueX: baseScaleX + sd(14), valueY: baseScaleY + sd(14) })
      kfs.push({ property: 'position', time: tStart, valueX: cx - pd(50), valueY: cy - pd(35) })
      kfs.push({ property: 'position', time: tEnd,   valueX: cx + pd(50), valueY: cy + pd(35) })
      break

    // ── Pulso (latido) ────────────────────────────────────────────────────
    case 'pulse': {
      const tMid = Math.round(((tStart + tEnd) / 2) * 1000) / 1000
      kfs.push({ property: 'scale', time: tStart, valueX: baseScaleX,          valueY: baseScaleY          })
      kfs.push({ property: 'scale', time: tMid,   valueX: baseScaleX + sd(8),  valueY: baseScaleY + sd(8)  })
      kfs.push({ property: 'scale', time: tEnd,   valueX: baseScaleX,          valueY: baseScaleY          })
      break
    }

    // ── Flotar (oscilación vertical) ──────────────────────────────────────
    case 'float-up': {
      const tMid = Math.round(((tStart + tEnd) / 2) * 1000) / 1000
      kfs.push({ property: 'position', time: tStart, valueX: cx, valueY: cy          })
      kfs.push({ property: 'position', time: tMid,   valueX: cx, valueY: cy - pd(28) })
      kfs.push({ property: 'position', time: tEnd,   valueX: cx, valueY: cy          })
      break
    }

    // ── Rotación lenta ────────────────────────────────────────────────────
    case 'slow-rotate':
      kfs.push({ property: 'rotation', time: tStart, value: -sd(4) })
      kfs.push({ property: 'rotation', time: tEnd,   value:  sd(4) })
      break

    // ── Deriva a la derecha ───────────────────────────────────────────────
    case 'drift-right':
      kfs.push({ property: 'position', time: tStart, valueX: cx - pd(70), valueY: cy })
      kfs.push({ property: 'position', time: tEnd,   valueX: cx + pd(70), valueY: cy })
      break

    // ── Zoom pulso (doble latido) ─────────────────────────────────────────
    case 'zoom-pulse': {
      const t1 = Math.round((tStart + (tEnd - tStart) * 0.33) * 1000) / 1000
      const t2 = Math.round((tStart + (tEnd - tStart) * 0.66) * 1000) / 1000
      kfs.push({ property: 'scale', time: tStart, valueX: baseScaleX,           valueY: baseScaleY           })
      kfs.push({ property: 'scale', time: t1,     valueX: baseScaleX + sd(11),  valueY: baseScaleY + sd(11)  })
      kfs.push({ property: 'scale', time: t2,     valueX: baseScaleX,           valueY: baseScaleY           })
      kfs.push({ property: 'scale', time: tEnd,   valueX: baseScaleX + sd(11),  valueY: baseScaleY + sd(11)  })
      break
    }

    default:
      break
  }

  return kfs
}

/** Devuelve la etiqueta del preset combinado */
export function getAnimComboLabel(id: string, lang: 'es' | 'en' = 'es'): string {
  const found = CLIP_ANIM_COMBO.find((a) => a.id === id)
  if (!found) return id
  return lang === 'en' ? found.labelEn : found.label
}
