export type EffectKind = 'adjust' | 'filter' | 'effect' | 'transition'

export interface EffectParamDef {
  key: string
  label: string
  min: number
  max: number
  default: number
  step: number
  unit?: '%' | 'K' | '°' | 'px' | 's'
  group?: string
}

export interface EffectDef {
  id: string
  name: string
  kind: EffectKind
  category: string
  description: string
  params: EffectParamDef[]
  presetValues?: Record<string, number>
}

export interface EffectInstance {
  id: string
  effectId: string
  enabled: boolean
  intensity: number // 0–100
  params: Record<string, number>
}

export interface TransitionRef {
  effectId: string
  duration: number // seconds
  params?: Record<string, number>
}

// 13 standard color grading parameters from Panel Ajustar (§6.4)
export const ADJUST_PARAMS: EffectParamDef[] = [
  { key: 'brightness', label: 'Brillo', min: -100, max: 100, default: 0, step: 1, unit: '%', group: 'Tono' },
  { key: 'contrast', label: 'Contraste', min: -100, max: 100, default: 0, step: 1, unit: '%', group: 'Tono' },
  { key: 'exposure', label: 'Exposición', min: -100, max: 100, default: 0, step: 1, unit: '%', group: 'Tono' },
  { key: 'highlights', label: 'Luces altas', min: -100, max: 100, default: 0, step: 1, unit: '%', group: 'Tono' },
  { key: 'shadows', label: 'Sombras', min: -100, max: 100, default: 0, step: 1, unit: '%', group: 'Tono' },
  { key: 'whites', label: 'Blancos', min: -100, max: 100, default: 0, step: 1, unit: '%', group: 'Tono' },
  { key: 'blacks', label: 'Negros', min: -100, max: 100, default: 0, step: 1, unit: '%', group: 'Tono' },
  { key: 'saturation', label: 'Saturación', min: -100, max: 100, default: 0, step: 1, unit: '%', group: 'Color' },
  { key: 'temperature', label: 'Temperatura', min: -100, max: 100, default: 0, step: 1, unit: 'K', group: 'Color' },
  { key: 'tint', label: 'Tinte', min: -100, max: 100, default: 0, step: 1, unit: '%', group: 'Color' },
  { key: 'sharpen', label: 'Nitidez', min: 0, max: 100, default: 0, step: 1, unit: '%', group: 'Detalle' },
  { key: 'fade', label: 'Desvanecido', min: 0, max: 100, default: 0, step: 1, unit: '%', group: 'Detalle' },
  { key: 'vignette', label: 'Viñeta', min: 0, max: 100, default: 0, step: 1, unit: '%', group: 'Detalle' },
]

export const EFFECT_CATALOG: EffectDef[] = [
  // =========================================================================
  // 1. FILTROS (~24)
  // =========================================================================
  {
    id: 'filter-vivid',
    name: 'Vivid',
    kind: 'filter',
    category: 'Estilo',
    description: 'Colores vibrantes con contraste punchy para redes sociales.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 80, step: 1, unit: '%' }],
    presetValues: { saturation: 35, contrast: 25, brightness: 5, highlights: 10 },
  },
  {
    id: 'filter-natural',
    name: 'Natural',
    kind: 'filter',
    category: 'Estilo',
    description: 'Balance orgánico suave y tonos de piel fieles.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 70, step: 1, unit: '%' }],
    presetValues: { saturation: 10, contrast: 10, temperature: 5 },
  },
  {
    id: 'filter-warm',
    name: 'Warm Sunset',
    kind: 'filter',
    category: 'Temperatura',
    description: 'Calidez dorada envolvente de hora mágica.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 75, step: 1, unit: '%' }],
    presetValues: { temperature: 40, tint: 10, brightness: 5, saturation: 15 },
  },
  {
    id: 'filter-cool',
    name: 'Nordic Cool',
    kind: 'filter',
    category: 'Temperatura',
    description: 'Tonos fríos azulados y atmósfera sobria nórdica.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 70, step: 1, unit: '%' }],
    presetValues: { temperature: -40, tint: -10, contrast: 15 },
  },
  {
    id: 'filter-fair',
    name: 'Fair Glow',
    kind: 'filter',
    category: 'Retrato',
    description: 'Suavizado de altas luces y tono de piel luminoso.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 75, step: 1, unit: '%' }],
    presetValues: { brightness: 12, contrast: -10, highlights: 15, whites: 10 },
  },
  {
    id: 'filter-fresh',
    name: 'Fresh Pop',
    kind: 'filter',
    category: 'Estilo',
    description: 'Verdes y azules limpios, ideal para naturaleza y exteriores.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 80, step: 1, unit: '%' }],
    presetValues: { saturation: 25, brightness: 6, tint: -15, contrast: 10 },
  },
  {
    id: 'filter-film-35mm',
    name: 'Film 35mm',
    kind: 'filter',
    category: 'Cinematográfico',
    description: 'Aspecto analógico de negativo 35mm con negros levantados.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 85, step: 1, unit: '%' }],
    presetValues: { contrast: -10, brightness: 8, temperature: 15, saturation: -15, fade: 20 },
  },
  {
    id: 'filter-vintage',
    name: 'Vintage 90s',
    kind: 'filter',
    category: 'Retro',
    description: 'Color deslavado y contraste suave de cámara compacta.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 75, step: 1, unit: '%' }],
    presetValues: { saturation: -25, temperature: 20, fade: 30, contrast: -15 },
  },
  {
    id: 'filter-retro-70s',
    name: 'Retro 70s',
    kind: 'filter',
    category: 'Retro',
    description: 'Tonos ocres, tinte ámbar y viñeteado nostálgico.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 80, step: 1, unit: '%' }],
    presetValues: { temperature: 35, tint: 15, saturation: -15, vignette: 40 },
  },
  {
    id: 'filter-noir',
    name: 'Noir Classic',
    kind: 'filter',
    category: 'B&N',
    description: 'Blanco y negro cinematográfico con sombras ricas.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 100, step: 1, unit: '%' }],
    presetValues: { saturation: -100, contrast: 35, brightness: -5, shadows: -15 },
  },
  {
    id: 'filter-high-mono',
    name: 'High-Contrast B&W',
    kind: 'filter',
    category: 'B&N',
    description: 'Monocromo extremo con blancos puros y sombras densas.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 100, step: 1, unit: '%' }],
    presetValues: { saturation: -100, contrast: 65, whites: 20, blacks: -20 },
  },
  {
    id: 'filter-teal-orange',
    name: 'Teal & Orange',
    kind: 'filter',
    category: 'Cinematográfico',
    description: 'El clásico look de Hollywood: sombras cian y pieles doradas.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 85, step: 1, unit: '%' }],
    presetValues: { temperature: 20, tint: -25, contrast: 30, saturation: 20 },
  },
  {
    id: 'filter-cyberpunk',
    name: 'Cyberpunk',
    kind: 'filter',
    category: 'Creativo',
    description: 'Neón futurista con sombras azul cian y luces magenta.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 90, step: 1, unit: '%' }],
    presetValues: { saturation: 50, contrast: 35, tint: 30, temperature: -20 },
  },
  {
    id: 'filter-neon-glow',
    name: 'Neon Night',
    kind: 'filter',
    category: 'Creativo',
    description: 'Contraste nocturno que hace brillar carteles y luces LED.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 85, step: 1, unit: '%' }],
    presetValues: { contrast: 40, brightness: -8, saturation: 40, highlights: 25 },
  },
  {
    id: 'filter-vaporwave',
    name: 'Vaporwave',
    kind: 'filter',
    category: 'Creativo',
    description: 'Estética estética retro pastel con tinte púrpura-rosa.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 80, step: 1, unit: '%' }],
    presetValues: { tint: 45, temperature: -15, brightness: 10, saturation: 20 },
  },
  {
    id: 'filter-golden-hour',
    name: 'Golden Hour',
    kind: 'filter',
    category: 'Temperatura',
    description: 'Luz de tarde dorada con sombras cálidas y suaves.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 80, step: 1, unit: '%' }],
    presetValues: { temperature: 50, contrast: 15, brightness: 4, saturation: 10 },
  },
  {
    id: 'filter-moody',
    name: 'Moody Olive',
    kind: 'filter',
    category: 'Cinematográfico',
    description: 'Sombras profundas oliva y verdes terrosos atenuados.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 80, step: 1, unit: '%' }],
    presetValues: { contrast: 25, brightness: -10, saturation: -20, tint: -20 },
  },
  {
    id: 'filter-midnight',
    name: 'Midnight Blue',
    kind: 'filter',
    category: 'Nocturno',
    description: 'Profundidad de medianoche con azules oscuros envolventes.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 85, step: 1, unit: '%' }],
    presetValues: { temperature: -55, brightness: -12, contrast: 20, saturation: -10 },
  },
  {
    id: 'filter-dreamy',
    name: 'Dreamy Pastel',
    kind: 'filter',
    category: 'Creativo',
    description: 'Neblina etérea con contraste atenuado y tonos pastel.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 70, step: 1, unit: '%' }],
    presetValues: { contrast: -25, brightness: 15, fade: 35, saturation: 10 },
  },
  {
    id: 'filter-polaroid',
    name: 'Polaroid 600',
    kind: 'filter',
    category: 'Retro',
    description: 'Química instantánea con viñeta y sombras verdosas.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 75, step: 1, unit: '%' }],
    presetValues: { tint: -15, temperature: 15, fade: 25, vignette: 30, contrast: -5 },
  },
  {
    id: 'filter-super-8',
    name: 'Super 8mm',
    kind: 'filter',
    category: 'Retro',
    description: 'Cine casero analógico de 8mm con bordes suaves.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 80, step: 1, unit: '%' }],
    presetValues: { temperature: 30, saturation: 15, contrast: 15, vignette: 45 },
  },
  {
    id: 'filter-vhs',
    name: 'VHS Tape',
    kind: 'filter',
    category: 'Retro',
    description: 'Saturación de cinta magnética y negros comprimidos.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 85, step: 1, unit: '%' }],
    presetValues: { saturation: 30, contrast: 20, brightness: -5, fade: 15 },
  },
  {
    id: 'filter-sci-fi',
    name: 'Sci-Fi Matrix',
    kind: 'filter',
    category: 'Creativo',
    description: 'Verde fósforo monocromático de interfaz cibernética.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 80, step: 1, unit: '%' }],
    presetValues: { tint: -50, temperature: -20, contrast: 30, saturation: -10 },
  },
  {
    id: 'filter-bleach',
    name: 'Bleach Bypass',
    kind: 'filter',
    category: 'Cinematográfico',
    description: 'Desaturación dura con grano de plata y alto contraste bélico.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 85, step: 1, unit: '%' }],
    presetValues: { saturation: -60, contrast: 50, whites: 25, blacks: -15 },
  },

  // =========================================================================
  // 2. EFECTOS VISUALES (~16)
  // =========================================================================
  {
    id: 'fx-gaussian-blur',
    name: 'Desenfoque Gaussiano',
    kind: 'effect',
    category: 'Básico',
    description: 'Desenfoque suave para fondos o desenfoque de foco.',
    params: [{ key: 'radius', label: 'Radio', min: 1, max: 50, default: 12, step: 1, unit: 'px' }],
  },
  {
    id: 'fx-zoom-blur',
    name: 'Desenfoque de Zoom',
    kind: 'effect',
    category: 'Movimiento',
    description: 'Líneas de velocidad radiales proyectadas desde el centro.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 1, max: 100, default: 40, step: 1, unit: '%' }],
  },
  {
    id: 'fx-motion-blur',
    name: 'Desenfoque de Movimiento',
    kind: 'effect',
    category: 'Movimiento',
    description: 'Rastro lineal direccional simulando velocidad cinematográfica.',
    params: [{ key: 'distance', label: 'Distancia', min: 1, max: 50, default: 15, step: 1, unit: 'px' }],
  },
  {
    id: 'fx-glow',
    name: 'Resplandor (Glow)',
    kind: 'effect',
    category: 'Luz',
    description: 'Difusión de altas luces estilo lente anamórfica.',
    params: [
      { key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 45, step: 1, unit: '%' },
      { key: 'threshold', label: 'Umbral', min: 40, max: 95, default: 70, step: 1, unit: '%' },
    ],
  },
  {
    id: 'fx-film-grain',
    name: 'Grano de Película',
    kind: 'effect',
    category: 'Textura',
    description: 'Textura orgánica viva que elimina la frialdad digital.',
    params: [
      { key: 'amount', label: 'Cantidad', min: 0, max: 100, default: 35, step: 1, unit: '%' },
      { key: 'size', label: 'Tamaño', min: 1, max: 4, default: 2, step: 1 },
    ],
  },
  {
    id: 'fx-chromatic-aberration',
    name: 'Aberración Cromática',
    kind: 'effect',
    category: 'Distorsión',
    description: 'Separación prismática de canales RGB en los bordes del plano.',
    params: [{ key: 'offset', label: 'Desplazamiento', min: 1, max: 30, default: 8, step: 1, unit: 'px' }],
  },
  {
    id: 'fx-pixelate',
    name: 'Pixelado',
    kind: 'effect',
    category: 'Estilizado',
    description: 'Mosaico retro estilo 8-bit o para censurar detalles.',
    params: [{ key: 'pixelSize', label: 'Tamaño pixel', min: 2, max: 64, default: 16, step: 2, unit: 'px' }],
  },
  {
    id: 'fx-posterize',
    name: 'Posterizado',
    kind: 'effect',
    category: 'Estilizado',
    description: 'Reduce la gradación continua a niveles de color plano.',
    params: [{ key: 'levels', label: 'Niveles', min: 2, max: 16, default: 4, step: 1 }],
  },
  {
    id: 'fx-vignette',
    name: 'Viñeta',
    kind: 'effect',
    category: 'Óptico',
    description: 'Oscurecimiento perimetral para centrar la mirada en el sujeto.',
    params: [
      { key: 'amount', label: 'Cantidad', min: 0, max: 100, default: 50, step: 1, unit: '%' },
      { key: 'feather', label: 'Suavizado', min: 10, max: 100, default: 60, step: 1, unit: '%' },
    ],
  },
  {
    id: 'fx-sharpen',
    name: 'Nitidez (Sharpen)',
    kind: 'effect',
    category: 'Detalle',
    description: 'Realza los bordes y texturas finas de la imagen.',
    params: [{ key: 'amount', label: 'Cantidad', min: 0, max: 100, default: 40, step: 1, unit: '%' }],
  },
  {
    id: 'fx-fisheye',
    name: 'Ojo de Pez',
    kind: 'effect',
    category: 'Óptico',
    description: 'Curvatura esférica ultra gran angular estilo cámara de acción.',
    params: [{ key: 'curvature', label: 'Curvatura', min: -100, max: 100, default: 45, step: 1, unit: '%' }],
  },
  {
    id: 'fx-halftone',
    name: 'Semitono Cómic',
    kind: 'effect',
    category: 'Estilizado',
    description: 'Puntos de impresión tipográfica estilo novela gráfica.',
    params: [{ key: 'dotSize', label: 'Tamaño punto', min: 2, max: 24, default: 8, step: 1, unit: 'px' }],
  },
  {
    id: 'fx-chroma-key',
    name: 'Croma (Pantalla Verde)',
    kind: 'effect',
    category: 'Composición',
    description: 'Eliminación selectiva de fondo verde o azul para componer capas.',
    params: [
      { key: 'tolerance', label: 'Tolerancia', min: 1, max: 100, default: 40, step: 1, unit: '%' },
      { key: 'smoothness', label: 'Suavizado', min: 0, max: 100, default: 20, step: 1, unit: '%' },
    ],
  },
  {
    id: 'fx-luma-key',
    name: 'Luma Key',
    kind: 'effect',
    category: 'Composición',
    description: 'Transparencia basada en luminancia (eliminar negros o blancos).',
    params: [
      { key: 'threshold', label: 'Umbral', min: 0, max: 100, default: 15, step: 1, unit: '%' },
      { key: 'feather', label: 'Pluma', min: 0, max: 100, default: 10, step: 1, unit: '%' },
    ],
  },
  {
    id: 'fx-vhs-glitch',
    name: 'VHS Glitch',
    kind: 'effect',
    category: 'Retro',
    description: 'Distorsión de tracking magnético y ruido de barrido.',
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 50, step: 1, unit: '%' }],
  },
  {
    id: 'fx-swirl',
    name: 'Remolino (Twirl)',
    kind: 'effect',
    category: 'Distorsión',
    description: 'Efecto de torsión en espiral centrado en el plano.',
    params: [{ key: 'angle', label: 'Ángulo', min: -360, max: 360, default: 120, step: 5, unit: '°' }],
  },

  // =========================================================================
  // 3. TRANSICIONES (~14)
  // =========================================================================
  {
    id: 'trans-cross-dissolve',
    name: 'Disolver',
    kind: 'transition',
    category: 'Disolución',
    description: 'Fundido suave y continuo entre dos clips.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 4.0, default: 0.8, step: 0.1, unit: 's' }],
  },
  {
    id: 'trans-fade-black',
    name: 'Fundido a Negro',
    kind: 'transition',
    category: 'Disolución',
    description: 'Transición pasando por negro completo.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 3.0, default: 0.6, step: 0.1, unit: 's' }],
  },
  {
    id: 'trans-fade-white',
    name: 'Flash Blanco',
    kind: 'transition',
    category: 'Disolución',
    description: 'Destello de sobreexposición blanca cinematográfico.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 2.0, default: 0.4, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-slide-left',
    name: 'Deslizar Izquierda',
    kind: 'transition',
    category: 'Movimiento',
    description: 'El nuevo clip entra deslizándose desde la derecha hacia la izquierda.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 2.0, default: 0.5, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-slide-right',
    name: 'Deslizar Derecha',
    kind: 'transition',
    category: 'Movimiento',
    description: 'El nuevo clip entra deslizándose desde la izquierda.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 2.0, default: 0.5, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-push-up',
    name: 'Empujar Arriba',
    kind: 'transition',
    category: 'Movimiento',
    description: 'El nuevo clip empuja verticalmente al anterior hacia arriba.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 2.0, default: 0.5, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-push-down',
    name: 'Empujar Abajo',
    kind: 'transition',
    category: 'Movimiento',
    description: 'El nuevo clip empuja verticalmente hacia abajo.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 2.0, default: 0.5, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-linear-wipe',
    name: 'Barrido Lineal',
    kind: 'transition',
    category: 'Barrido',
    description: 'Línea de corte suave que descubre progresivamente el nuevo plano.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 2.0, default: 0.6, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-iris-circle',
    name: 'Iris Circular',
    kind: 'transition',
    category: 'Barrido',
    description: 'Apertura de máscara circular desde el centro del fotograma.',
    params: [{ key: 'duration', label: 'Duración', min: 0.2, max: 2.5, default: 0.7, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-clock-wipe',
    name: 'Barrido de Reloj',
    kind: 'transition',
    category: 'Barrido',
    description: 'Rotación radial de 360 grados como una aguja de reloj.',
    params: [{ key: 'duration', label: 'Duración', min: 0.2, max: 3.0, default: 0.8, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-zoom-in',
    name: 'Zoom Dinámico',
    kind: 'transition',
    category: 'Dinámico',
    description: 'Impulso frontal con desenfoque de aceleración hacia la nueva toma.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 1.5, default: 0.5, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-spin-rotate',
    name: 'Giro Rápido (Spin)',
    kind: 'transition',
    category: 'Dinámico',
    description: 'Rotación centrada enérgica de 180° entre tomas.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 1.5, default: 0.45, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-glitch',
    name: 'Glitch Digital',
    kind: 'transition',
    category: 'Dinámico',
    description: 'Salto con artefactos digitales y cortes en ráfaga.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 1.0, default: 0.35, step: 0.05, unit: 's' }],
  },
  {
    id: 'trans-light-leak',
    name: 'Fuga de Luz',
    kind: 'transition',
    category: 'Óptico',
    description: 'Destello cálido lateral simulando entrada de luz en el chasis.',
    params: [{ key: 'duration', label: 'Duración', min: 0.1, max: 2.0, default: 0.55, step: 0.05, unit: 's' }],
  },
]

export function getEffectDef(id: string): EffectDef | undefined {
  if (id === 'adjust-tone') {
    return {
      id: 'adjust-tone',
      name: 'Ajuste de Tono y Color',
      kind: 'adjust',
      category: 'Tono',
      description: 'Panel de calibración de 13 parámetros de color y tono.',
      params: ADJUST_PARAMS,
    }
  }
  return EFFECT_CATALOG.find((e) => e.id === id)
}

export function registerCustomLutFilter(title: string, size: number): EffectDef {
  const id = `filter-lut-${Date.now()}`
  const def: EffectDef = {
    id,
    name: title || 'LUT 3D Personalizada',
    kind: 'filter',
    category: 'LUTs',
    description: `LUT 3D (.cube ${size}x${size}x${size})`,
    params: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100, default: 100, step: 1, unit: '%' }],
  }
  EFFECT_CATALOG.unshift(def)
  return def
}

export function createEffectInstance(effectId: string): EffectInstance | null {
  const def = getEffectDef(effectId)
  if (!def) return null

  const initialParams: Record<string, number> = {}
  for (const param of def.params) {
    initialParams[param.key] = param.default
  }

  return {
    id: `fx-${crypto.randomUUID().slice(0, 8)}`,
    effectId: def.id,
    enabled: true,
    intensity: 100,
    params: initialParams,
  }
}
