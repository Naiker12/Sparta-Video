/**
 * Parser and processor for Adobe .cube LUT (Lookup Table) files.
 * Supports both 3D LUTs (standard for color grading) and 1D LUTs.
 */

export interface ParsedLUT {
  title: string
  type: '1D' | '3D'
  size: number
  domainMin: [number, number, number]
  domainMax: [number, number, number]
  /** Flattened RGB float32 array, normalized 0..1 */
  data: Float32Array
}

/**
 * Parses the text content of a .cube LUT file.
 */
export function parseCubeLUT(content: string, fallbackTitle = 'Custom LUT'): ParsedLUT {
  const lines = content.split(/\r?\n/)
  let title = fallbackTitle
  let type: '1D' | '3D' = '3D'
  let size = 0
  let domainMin: [number, number, number] = [0, 0, 0]
  let domainMax: [number, number, number] = [1, 1, 1]
  const dataValues: number[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine || rawLine.startsWith('#')) {
      continue
    }

    const parts = rawLine.split(/\s+/)
    const keyword = parts[0].toUpperCase()

    if (keyword === 'TITLE') {
      title = rawLine.substring(5).trim().replace(/^["']|["']$/g, '') || fallbackTitle
      continue
    }

    if (keyword === 'LUT_3D_SIZE') {
      type = '3D'
      size = parseInt(parts[1], 10)
      continue
    }

    if (keyword === 'LUT_1D_SIZE') {
      type = '1D'
      size = parseInt(parts[1], 10)
      continue
    }

    if (keyword === 'DOMAIN_MIN') {
      if (parts.length >= 4) {
        domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]
      }
      continue
    }

    if (keyword === 'DOMAIN_MAX') {
      if (parts.length >= 4) {
        domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]
      }
      continue
    }

    // Number lines
    if (parts.length >= 3) {
      const r = parseFloat(parts[0])
      const g = parseFloat(parts[1])
      const b = parseFloat(parts[2])
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        dataValues.push(r, g, b)
      }
    }
  }

  if (size <= 0) {
    // If size wasn't explicitly declared, guess from data count
    if (type === '3D') {
      const triplets = Math.floor(dataValues.length / 3)
      size = Math.round(Math.cbrt(triplets))
    } else {
      size = Math.floor(dataValues.length / 3)
    }
  }

  const floatData = new Float32Array(dataValues)
  return {
    title,
    type,
    size,
    domainMin,
    domainMax,
    data: floatData,
  }
}

/**
 * Trilinear interpolation on a 3D LUT for an RGB color input (0..1).
 */
export function sampleLUT3D(
  lut: ParsedLUT,
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const { size, domainMin, domainMax, data } = lut
  if (size <= 1) return [r, g, b]

  // Map from domain to 0..(size - 1)
  const normR = Math.max(0, Math.min(1, (r - domainMin[0]) / (domainMax[0] - domainMin[0] || 1)))
  const normG = Math.max(0, Math.min(1, (g - domainMin[1]) / (domainMax[1] - domainMin[1] || 1)))
  const normB = Math.max(0, Math.min(1, (b - domainMin[2]) / (domainMax[2] - domainMin[2] || 1)))

  const fr = normR * (size - 1)
  const fg = normG * (size - 1)
  const fb = normB * (size - 1)

  const i0 = Math.floor(fr)
  const j0 = Math.floor(fg)
  const k0 = Math.floor(fb)

  const i1 = Math.min(size - 1, i0 + 1)
  const j1 = Math.min(size - 1, j0 + 1)
  const k1 = Math.min(size - 1, k0 + 1)

  const dr = fr - i0
  const dg = fg - j0
  const db = fb - k0

  // Index calculation in standard .cube format:
  // index = (r + g * size + b * size * size) * 3
  const getIndex = (ir: number, ig: number, ib: number) => (ir + ig * size + ib * size * size) * 3

  const c000 = getIndex(i0, j0, k0)
  const c100 = getIndex(i1, j0, k0)
  const c010 = getIndex(i0, j1, k0)
  const c110 = getIndex(i1, j1, k0)
  const c001 = getIndex(i0, j0, k1)
  const c101 = getIndex(i1, j0, k1)
  const c011 = getIndex(i0, j1, k1)
  const c111 = getIndex(i1, j1, k1)

  const out: [number, number, number] = [0, 0, 0]

  for (let c = 0; c < 3; c++) {
    const c00 = data[c000 + c] * (1 - dr) + data[c100 + c] * dr
    const c10 = data[c010 + c] * (1 - dr) + data[c110 + c] * dr
    const c01 = data[c001 + c] * (1 - dr) + data[c101 + c] * dr
    const c11 = data[c011 + c] * (1 - dr) + data[c111 + c] * dr

    const c0 = c00 * (1 - dg) + c10 * dg
    const c1 = c01 * (1 - dg) + c11 * dg

    out[c] = c0 * (1 - db) + c1 * db
  }

  return out
}

/**
 * Applies a 3D LUT to an RGBA Uint8ClampedArray in place.
 * @param pixels Array of RGBA bytes (0..255)
 * @param lut Parsed LUT
 * @param intensity 0..1 blend factor between original and LUT output (default 1)
 */
export function applyLUTToPixels(
  pixels: Uint8ClampedArray,
  lut: ParsedLUT,
  intensity = 1.0,
): void {
  const len = pixels.length
  const blend = Math.max(0, Math.min(1, intensity))
  if (blend <= 0) return

  for (let i = 0; i < len; i += 4) {
    const r = pixels[i] / 255
    const g = pixels[i + 1] / 255
    const b = pixels[i + 2] / 255

    const [lr, lg, lb] = sampleLUT3D(lut, r, g, b)

    if (blend >= 1) {
      pixels[i] = Math.round(Math.max(0, Math.min(1, lr)) * 255)
      pixels[i + 1] = Math.round(Math.max(0, Math.min(1, lg)) * 255)
      pixels[i + 2] = Math.round(Math.max(0, Math.min(1, lb)) * 255)
    } else {
      pixels[i] = Math.round((r + (lr - r) * blend) * 255)
      pixels[i + 1] = Math.round((g + (lg - g) * blend) * 255)
      pixels[i + 2] = Math.round((b + (lb - b) * blend) * 255)
    }
  }
}

