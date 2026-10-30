import { describe, expect, it } from 'vitest'
import { computeTransitionInState } from './transition-math'

describe('computeTransitionInState', () => {
  it('returns null when no transition or past duration', () => {
    expect(computeTransitionInState(undefined, 0, 1, 1920, 1080)).toBeNull()
    expect(computeTransitionInState({ effectId: 'trans-cross-dissolve', duration: 1 }, 0, 1.5, 1920, 1080)).toBeNull()
    expect(computeTransitionInState({ effectId: 'trans-cross-dissolve', duration: 1 }, 2, 1, 1920, 1080)).toBeNull()
  })

  it('computes opacity ramp for cross dissolve', () => {
    const res = computeTransitionInState({ effectId: 'trans-cross-dissolve', duration: 1 }, 0, 0.5, 1920, 1080)
    expect(res).not.toBeNull()
    expect(res!.progress).toBeCloseTo(0.5, 2)
    expect(res!.opacity).toBeGreaterThan(0.5) // eased
    expect(res!.offsetX).toBe(0)
    expect(res!.offsetY).toBe(0)
  })

  it('computes slide-left offset starting from sequence width to 0', () => {
    const start = computeTransitionInState({ effectId: 'trans-slide-left', duration: 1 }, 0, 0, 1920, 1080)
    expect(start!.offsetX).toBeCloseTo(1920, 0)
    expect(start!.opacity).toBe(1)

    const mid = computeTransitionInState({ effectId: 'trans-slide-left', duration: 1 }, 0, 0.5, 1920, 1080)
    expect(mid!.offsetX).toBeLessThan(1920)
    expect(mid!.offsetX).toBeGreaterThan(0)
  })

  it('computes zoom-in scale', () => {
    const res = computeTransitionInState({ effectId: 'trans-zoom-in', duration: 1 }, 0, 0.5, 1920, 1080)
    expect(res!.scale).toBeGreaterThan(0.4)
    expect(res!.scale).toBeLessThan(1.0)
  })

  it('computes clip path for linear wipe', () => {
    const res = computeTransitionInState({ effectId: 'trans-linear-wipe', duration: 1 }, 0, 0.5, 1920, 1080)
    expect(res!.clipPath).toContain('inset(0%')
  })
})

