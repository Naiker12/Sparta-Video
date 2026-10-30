import { getEffectDef, type EffectInstance } from './catalog'

/**
 * Generates a CSS filter string from active effects and tone adjustments.
 */
export function getEffectsCSSFilter(effects?: EffectInstance[]): string {
  if (!effects || effects.length === 0) return ''

  const filters: string[] = []

  for (const fx of effects) {
    if (!fx.enabled) continue
    const factor = (fx.intensity ?? 100) / 100

    if (fx.effectId.startsWith('filter-')) {
      const values = getEffectDef(fx.effectId)?.presetValues
      if (!values) {
        filters.push('saturate(1.18) contrast(1.06)')
        continue
      }
      const brightness = 1 + ((values.brightness ?? 0) / 100) * factor
      const contrast = 1 + ((values.contrast ?? 0) / 100) * factor
      const saturation = 1 + ((values.saturation ?? 0) / 100) * factor
      const temperature = (values.temperature ?? 0) * factor
      const tint = (values.tint ?? 0) * factor
      if (brightness !== 1) filters.push(`brightness(${Math.max(0.05, brightness).toFixed(2)})`)
      if (contrast !== 1) filters.push(`contrast(${Math.max(0.05, contrast).toFixed(2)})`)
      if (saturation !== 1) filters.push(`saturate(${Math.max(0.05, saturation).toFixed(2)})`)
      if (temperature > 0) filters.push(`sepia(${Math.min(100, temperature * 0.4).toFixed(0)}%)`)
      if (temperature < 0 || tint !== 0) filters.push(`hue-rotate(${(temperature * 0.3 + tint * 0.4).toFixed(1)}deg)`)
      continue
    }

    switch (fx.effectId) {
      case 'adjust-tone': {
        const p = fx.params
        const b = (p.brightness ?? 0) * factor
        const c = (p.contrast ?? 0) * factor
        const s = (p.saturation ?? 0) * factor
        const exp = (p.exposure ?? 0) * factor
        const temp = (p.temperature ?? 0) * factor
        const tint = (p.tint ?? 0) * factor

        if (b !== 0) filters.push(`brightness(${Math.max(0, 1 + b / 100).toFixed(2)})`)
        if (c !== 0) filters.push(`contrast(${Math.max(0, 1 + c / 100).toFixed(2)})`)
        if (s !== 0) filters.push(`saturate(${Math.max(0, 1 + s / 100).toFixed(2)})`)
        if (exp !== 0) filters.push(`brightness(${Math.max(0, Math.pow(2, exp / 100)).toFixed(2)})`)
        if (temp !== 0) {
          if (temp > 0) {
            filters.push(`sepia(${(temp * 0.4).toFixed(0)}%) saturate(${1 + temp * 0.002})`)
          } else {
            filters.push(`hue-rotate(${(temp * 0.3).toFixed(1)}deg)`)
          }
        }
        if (tint !== 0) filters.push(`hue-rotate(${(tint * 0.4).toFixed(1)}deg)`)
        break
      }
      case 'fx-gaussian-blur': {
        const radius = (fx.params.radius ?? 5) * factor
        if (radius > 0) filters.push(`blur(${radius.toFixed(1)}px)`)
        break
      }
      case 'fx-glow': {
        const radius = (fx.params.radius ?? 15) * factor
        if (radius > 0) filters.push(`drop-shadow(0 0 ${radius.toFixed(1)}px rgba(255,255,255,0.7))`)
        break
      }
      case 'fx-zoom-blur': {
        const blur = (fx.params.intensity ?? 40) * factor * 0.045
        filters.push(`blur(${blur.toFixed(1)}px) saturate(${(1 + 0.18 * factor).toFixed(2)})`)
        break
      }
      case 'fx-motion-blur': {
        const blur = (fx.params.distance ?? 15) * factor * 0.12
        filters.push(`blur(${blur.toFixed(1)}px)`)
        break
      }
      case 'fx-posterize': {
        const levels = Math.max(2, fx.params.levels ?? 4)
        filters.push(`contrast(${(1 + (16 / levels - 1) * 0.28 * factor).toFixed(2)}) saturate(${(1 + 0.22 * factor).toFixed(2)})`)
        break
      }
      case 'fx-sharpen': {
        filters.push(`contrast(${(1 + 0.35 * factor).toFixed(2)}) saturate(${(1 + 0.1 * factor).toFixed(2)})`)
        break
      }
      case 'fx-fisheye': {
        const curvature = fx.params.curvature ?? 45
        filters.push(`contrast(${(1 + Math.abs(curvature) / 250 * factor).toFixed(2)} ) saturate(${(1 + Math.abs(curvature) / 500 * factor).toFixed(2)})`)
        break
      }
      case 'fx-halftone': {
        filters.push(`grayscale(${(22 * factor).toFixed(0)}%) contrast(${(1 + 0.32 * factor).toFixed(2)})`)
        break
      }
      case 'fx-chroma-key': {
        filters.push(`saturate(${(1 - 0.18 * factor).toFixed(2)}) contrast(${(1 + 0.08 * factor).toFixed(2)})`)
        break
      }
      case 'fx-luma-key': {
        filters.push(`contrast(${(1 + 0.28 * factor).toFixed(2)} ) brightness(${(1 + 0.04 * factor).toFixed(2)})`)
        break
      }
      case 'fx-vhs-glitch': {
        filters.push(`contrast(${(1 + 0.12 * factor).toFixed(2)}) saturate(${(1 + 0.3 * factor).toFixed(2)}) hue-rotate(${-7 * factor}deg)`)
        break
      }
      case 'fx-swirl': {
        filters.push(`saturate(${(1 + 0.18 * factor).toFixed(2)}) contrast(${(1 + 0.08 * factor).toFixed(2)})`)
        break
      }
      case 'fx-chromatic-aberration': {
        const offset = (fx.params.offset ?? 8) * factor * 0.12
        filters.push(`drop-shadow(${offset.toFixed(1)}px 0 rgba(255,35,75,.55)) drop-shadow(${(-offset).toFixed(1)}px 0 rgba(45,190,255,.55))`)
        break
      }
      case 'fx-pixelate': {
        const pixelSize = fx.params.pixelSize ?? 16
        filters.push(`contrast(${(1 + Math.min(0.35, pixelSize / 100) * factor).toFixed(2)}) saturate(${(1 - 0.12 * factor).toFixed(2)})`)
        break
      }
    }
  }

  return filters.join(' ')
}

/**
 * Removes a green/blue key color from ImageData pixels.
 * @param imageData Image buffer to mutate in place
 * @param keyColor [R, G, B] normalized 0..255 (default green [0, 255, 0])
 * @param tolerance 0..100 threshold
 * @param smoothness 0..100 softening
 */
export function applyChromaKey(
  imageData: ImageData,
  keyColor: [number, number, number] = [0, 255, 0],
  tolerance = 45,
  smoothness = 15,
): void {
  const data = imageData.data
  const len = data.length

  const [kr, kg, kb] = keyColor
  const tol = tolerance * 2.55
  const smooth = Math.max(1, smoothness * 2.55)

  for (let i = 0; i < len; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Euclidean color distance in RGB space
    const dr = r - kr
    const dg = g - kg
    const db = b - kb
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)

    if (dist < tol) {
      data[i + 3] = 0 // Fully transparent
    } else if (dist < tol + smooth) {
      const alphaFactor = (dist - tol) / smooth
      data[i + 3] = Math.round(data[i + 3] * alphaFactor)
    }
  }
}

/**
 * Applies pixelate mosaic effect to a Canvas rendering context.
 */
export function applyPixelate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blockSize: number,
): void {
  if (blockSize <= 1 || width <= 0 || height <= 0) return

  const smallW = Math.max(1, Math.floor(width / blockSize))
  const smallH = Math.max(1, Math.floor(height / blockSize))

  // Downsample onto an offscreen canvas or temporary region
  const offscreen = document.createElement('canvas')
  offscreen.width = smallW
  offscreen.height = smallH
  const offCtx = offscreen.getContext('2d')
  if (!offCtx) return

  offCtx.imageSmoothingEnabled = false
  offCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, smallW, smallH)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(offscreen, 0, 0, smallW, smallH, 0, 0, width, height)
  ctx.imageSmoothingEnabled = true
}

/**
 * Draws a photographic vignette around the canvas edges.
 */
export function applyVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius = 0.7,
  softness = 0.4,
  intensity = 1.0,
): void {
  if (intensity <= 0) return

  const cx = width / 2
  const cy = height / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)
  const innerR = Math.max(0, maxR * (1 - softness) * radius)
  const outerR = maxR * radius

  ctx.save()
  const gradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(1, `rgba(0, 0, 0, ${Math.min(1, 0.85 * intensity)})`)

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

/**
 * Adds monochromatic or chromatic film grain to ImageData.
 */
export function applyFilmGrain(
  imageData: ImageData,
  amount: number, // 0..100
  monochrome = true,
): void {
  if (amount <= 0) return
  const data = imageData.data
  const len = data.length
  const strength = (amount / 100) * 45

  for (let i = 0; i < len; i += 4) {
    if (data[i + 3] === 0) continue // Skip transparent pixels

    if (monochrome) {
      const noise = (Math.random() - 0.5) * strength
      data[i] = Math.max(0, Math.min(255, data[i] + noise))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
    } else {
      data[i] = Math.max(0, Math.min(255, data[i] + (Math.random() - 0.5) * strength))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (Math.random() - 0.5) * strength))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (Math.random() - 0.5) * strength))
    }
  }
}

/**
 * Simulates chromatic aberration by shifting red and blue color channels horizontally.
 */
export function applyChromaticAberration(
  imageData: ImageData,
  offsetPixels: number,
): void {
  const shift = Math.round(offsetPixels)
  if (shift === 0) return

  const { width, height, data } = imageData
  const copy = new Uint8ClampedArray(data)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      // Sample red from left
      const redX = Math.max(0, Math.min(width - 1, x - shift))
      const redIdx = (y * width + redX) * 4
      data[idx] = copy[redIdx]

      // Green stays centered: data[idx + 1] is untouched

      // Sample blue from right
      const blueX = Math.max(0, Math.min(width - 1, x + shift))
      const blueIdx = (y * width + blueX) * 4
      data[idx + 2] = copy[blueIdx + 2]
    }
  }
}
