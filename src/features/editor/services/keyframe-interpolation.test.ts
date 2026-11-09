import { describe, expect, it } from 'vitest'
import {
  getInterpolatedOpacity,
  getInterpolatedTransform,
} from './keyframe-interpolation'
import type { Clip } from '../model'

describe('keyframe interpolation engine', () => {
  const baseClip: Clip = {
    id: 'clip-1',
    title: 'Drone shot.mp4',
    start: 2,
    duration: 10,
    color: 'olive',
    thumbnail: 'video-catalog',
    kind: 'video',
    transform: { x: 960, y: 540, scaleX: 100, scaleY: 100, rotation: 0 },
    opacity: 100,
  }

  it('returns base transform when no keyframes are defined', () => {
    const transform = getInterpolatedTransform(baseClip, 5)
    expect(transform).toEqual({
      x: 960,
      y: 540,
      scaleX: 100,
      scaleY: 100,
      rotation: 0,
    })
  })

  it('interpolates position smoothly between keyframes', () => {
    const clipWithPosKeyframes: Clip = {
      ...baseClip,
      keyframes: [
        { property: 'position', time: 2, valueX: 0, valueY: 0 },
        { property: 'position', time: 6, valueX: 1000, valueY: 500 },
      ],
    }

    // At or before start
    expect(getInterpolatedTransform(clipWithPosKeyframes, 1).x).toBe(0)
    expect(getInterpolatedTransform(clipWithPosKeyframes, 2).x).toBe(0)

    // Midpoint (t=4s, exactly halfway between 2s and 6s)
    const midTransform = getInterpolatedTransform(clipWithPosKeyframes, 4)
    expect(midTransform.x).toBe(500)
    expect(midTransform.y).toBe(250)

    // At or after end
    expect(getInterpolatedTransform(clipWithPosKeyframes, 6).x).toBe(1000)
    expect(getInterpolatedTransform(clipWithPosKeyframes, 10).x).toBe(1000)
  })

  it('interpolates scale and rotation across time', () => {
    const clipWithMotion: Clip = {
      ...baseClip,
      keyframes: [
        { property: 'scale', time: 2, valueX: 50, valueY: 50 },
        { property: 'scale', time: 8, valueX: 150, valueY: 150 },
        { property: 'rotation', time: 2, value: 0 },
        { property: 'rotation', time: 8, value: 180 },
      ],
    }

    const mid = getInterpolatedTransform(clipWithMotion, 5)
    expect(mid.scaleX).toBe(100)
    expect(mid.scaleY).toBe(100)
    expect(mid.rotation).toBe(90)
  })

  it('interpolates opacity with fade-in and fade-out ramps', () => {
    const clipWithFades: Clip = {
      ...baseClip,
      start: 0,
      duration: 10,
      fadeIn: 2,
      fadeOut: 2,
      opacity: 100,
    }

    // At start, fade factor is 0
    expect(getInterpolatedOpacity(clipWithFades, 0)).toBe(0)

    // Halfway through fade-in (1s of 2s)
    expect(getInterpolatedOpacity(clipWithFades, 1)).toBe(50)

    // In the middle (fully visible)
    expect(getInterpolatedOpacity(clipWithFades, 5)).toBe(100)

    // Halfway through fade-out (9s is 1s remaining of 2s fadeOut)
    expect(getInterpolatedOpacity(clipWithFades, 9)).toBe(50)

    // At end
    expect(getInterpolatedOpacity(clipWithFades, 10)).toBe(0)
  })

  it('respects linear easing curve', () => {
    const clipWithLinear: Clip = {
      ...baseClip,
      keyframes: [
        { property: 'position', time: 0, valueX: 0, valueY: 0, easing: 'linear' },
        { property: 'position', time: 10, valueX: 100, valueY: 200 },
      ],
    }

    const t25 = getInterpolatedTransform(clipWithLinear, 2.5)
    expect(t25.x).toBe(25)
    expect(t25.y).toBe(50)

    const t75 = getInterpolatedTransform(clipWithLinear, 7.5)
    expect(t75.x).toBe(75)
    expect(t75.y).toBe(150)
  })

  it('respects ease-in and ease-out curves differing from linear midpoint', () => {
    const clipEaseIn: Clip = {
      ...baseClip,
      keyframes: [
        { property: 'position', time: 0, valueX: 0, valueY: 0, easing: 'ease-in' },
        { property: 'position', time: 10, valueX: 100, valueY: 100 },
      ],
    }

    const clipEaseOut: Clip = {
      ...baseClip,
      keyframes: [
        { property: 'position', time: 0, valueX: 0, valueY: 0, easing: 'ease-out' },
        { property: 'position', time: 10, valueX: 100, valueY: 100 },
      ],
    }

    // At 30% time (t=3s)
    const valEaseIn = getInterpolatedTransform(clipEaseIn, 3).x
    const valEaseOut = getInterpolatedTransform(clipEaseOut, 3).x

    // Ease-in starts slow: value at 30% time is less than linear 30
    expect(valEaseIn).toBeLessThan(30)
    // Ease-out starts fast: value at 30% time is greater than linear 30
    expect(valEaseOut).toBeGreaterThan(30)
    expect(valEaseOut).toBeGreaterThan(valEaseIn)
  })

  it('evaluates custom cubic bezier control points', () => {
    const clipBezier: Clip = {
      ...baseClip,
      keyframes: [
        {
          property: 'rotation',
          time: 0,
          value: 0,
          easing: 'bezier',
          bezierControlPoints: [0.1, 0.9, 0.2, 1.0], // very steep ease-out
        },
        { property: 'rotation', time: 10, value: 100 },
      ],
    }

    // Steep ease-out should already have completed most rotation by halfway
    const val = getInterpolatedTransform(clipBezier, 5).rotation
    expect(val).toBeGreaterThan(75)
  })
})
