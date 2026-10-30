export type FitMode = 'fit' | 'fill' | 'stretch'

export interface FitRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Computes destination rectangle for media fitting within a viewport or canvas.
 * - 'fit': contain (letterbox/pillarbox, no cropping, preserves aspect ratio)
 * - 'fill': cover (crops edges to fill entire destination, preserves aspect ratio)
 * - 'stretch': distorts media to match destination dimensions exactly
 */
export function computeFitRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  mode: FitMode = 'fit',
): FitRect {
  if (!srcW || !srcH || !dstW || !dstH || srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { x: 0, y: 0, w: Math.max(0, dstW || 0), h: Math.max(0, dstH || 0) }
  }

  if (mode === 'stretch') {
    return { x: 0, y: 0, w: dstW, h: dstH }
  }

  const s =
    mode === 'fit'
      ? Math.min(dstW / srcW, dstH / srcH)
      : Math.max(dstW / srcW, dstH / srcH)

  const w = srcW * s
  const h = srcH * s

  return {
    x: (dstW - w) / 2,
    y: (dstH - h) / 2,
    w,
    h,
  }
}

