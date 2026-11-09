import type { ClipMask } from '../model'

export const DEFAULT_CLIP_MASK: ClipMask = {
  type: 'none',
  x: 50,
  y: 50,
  width: 50,
  height: 50,
  rotation: 0,
  feather: 0,
  invert: false,
}

/**
 * Computes CSS clip-path string for DOM / Preview rendering.
 */
export function computeMaskClipPath(mask?: ClipMask): string | undefined {
  if (!mask || mask.type === 'none') return undefined

  const { type, x, y, width, height } = mask

  switch (type) {
    case 'circle': {
      const radius = Math.min(width, height) / 2
      return `circle(${radius}% at ${x}% ${y}%)`
    }
    case 'ellipse': {
      return `ellipse(${width / 2}% ${height / 2}% at ${x}% ${y}%)`
    }
    case 'rectangle': {
      const top = Math.max(0, y - height / 2)
      const bottom = Math.max(0, 100 - (y + height / 2))
      const left = Math.max(0, x - width / 2)
      const right = Math.max(0, 100 - (x + width / 2))
      return `inset(${top}% ${right}% ${bottom}% ${left}%)`
    }
    case 'linear': {
      return `polygon(0% 0%, 100% 0%, 100% ${y}%, 0% ${y}%)`
    }
    default:
      return undefined
  }
}

/**
 * Applies vector mask path to a Canvas 2D rendering context.
 */
export function applyMaskToCanvas(
  ctx: CanvasRenderingContext2D,
  mask: ClipMask,
  fitRect: { w: number; h: number },
): void {
  if (!mask || mask.type === 'none') return

  ctx.beginPath()
  const cx = ((mask.x - 50) / 100) * fitRect.w
  const cy = ((mask.y - 50) / 100) * fitRect.h
  const mw = (mask.width / 100) * fitRect.w
  const mh = (mask.height / 100) * fitRect.h

  if (mask.type === 'circle') {
    const r = Math.min(mw, mh) / 2
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
  } else if (mask.type === 'ellipse') {
    const rot = ((mask.rotation ?? 0) * Math.PI) / 180
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(cx, cy, mw / 2, mh / 2, rot, 0, Math.PI * 2)
    } else {
      ctx.arc(cx, cy, mw / 2, 0, Math.PI * 2)
    }
  } else if (mask.type === 'rectangle') {
    ctx.rect(cx - mw / 2, cy - mh / 2, mw, mh)
  } else if (mask.type === 'linear') {
    ctx.rect(-fitRect.w / 2, -fitRect.h / 2, fitRect.w, cy - (-fitRect.h / 2))
  }

  ctx.clip()
}

