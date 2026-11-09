import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_CLIP_MASK,
  applyMaskToCanvas,
  computeMaskClipPath,
} from './mask-service'

describe('mask-service', () => {
  it('returns undefined for none or missing mask', () => {
    expect(computeMaskClipPath()).toBeUndefined()
    expect(computeMaskClipPath(DEFAULT_CLIP_MASK)).toBeUndefined()
    expect(computeMaskClipPath({ ...DEFAULT_CLIP_MASK, type: 'none' })).toBeUndefined()
  })

  it('computes circle clipPath accurately', () => {
    const css = computeMaskClipPath({
      type: 'circle',
      x: 50,
      y: 50,
      width: 40,
      height: 40,
    })
    expect(css).toBe('circle(20% at 50% 50%)')
  })

  it('computes ellipse clipPath accurately', () => {
    const css = computeMaskClipPath({
      type: 'ellipse',
      x: 60,
      y: 40,
      width: 50,
      height: 30,
    })
    expect(css).toBe('ellipse(25% 15% at 60% 40%)')
  })

  it('computes rectangle inset clipPath accurately', () => {
    const css = computeMaskClipPath({
      type: 'rectangle',
      x: 50,
      y: 50,
      width: 60,
      height: 40,
    })
    // top = 50 - 20 = 30%, bottom = 100 - (50+20) = 30%, left = 50 - 30 = 20%, right = 100 - (50+30) = 20%
    expect(css).toBe('inset(30% 20% 30% 20%)')
  })

  it('computes linear split polygon clipPath accurately', () => {
    const css = computeMaskClipPath({
      type: 'linear',
      x: 50,
      y: 65,
      width: 100,
      height: 100,
    })
    expect(css).toBe('polygon(0% 0%, 100% 0%, 100% 65%, 0% 65%)')
  })

  it('applies path commands to canvas context', () => {
    const ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    applyMaskToCanvas(ctx, { type: 'circle', x: 50, y: 50, width: 40, height: 40 }, { w: 1000, h: 500 })

    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.clip).toHaveBeenCalled()
  })
})
