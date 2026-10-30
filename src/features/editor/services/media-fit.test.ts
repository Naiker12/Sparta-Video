import { describe, expect, it } from 'vitest'
import { computeFitRect } from './media-fit'

describe('computeFitRect', () => {
  it('16:9 source in 9:16 target with fit mode preserves ratio and adds letterbox (top/bottom bars)', () => {
    // 1920x1080 into 1080x1920
    const rect = computeFitRect(1920, 1080, 1080, 1920, 'fit')
    expect(rect.w).toBe(1080)
    expect(rect.h).toBeCloseTo(607.5, 1)
    expect(rect.x).toBe(0)
    expect(rect.y).toBeCloseTo((1920 - 607.5) / 2, 1)
    // Verify aspect ratio matches source (16:9)
    expect(rect.w / rect.h).toBeCloseTo(1920 / 1080, 4)
  })

  it('16:9 source in 9:16 target with fill mode covers canvas and crops sides', () => {
    // 1920x1080 into 1080x1920
    const rect = computeFitRect(1920, 1080, 1080, 1920, 'fill')
    expect(rect.h).toBe(1920)
    expect(rect.w).toBeCloseTo(3413.33, 1)
    expect(rect.x).toBeLessThan(0) // cropped on left and right
    expect(rect.y).toBe(0)
    expect(rect.w / rect.h).toBeCloseTo(1920 / 1080, 4)
  })

  it('stretch mode matches target dimensions exactly', () => {
    const rect = computeFitRect(1920, 1080, 1080, 1920, 'stretch')
    expect(rect.x).toBe(0)
    expect(rect.y).toBe(0)
    expect(rect.w).toBe(1080)
    expect(rect.h).toBe(1920)
  })

  it('9:16 vertical source in 16:9 target with fit mode preserves ratio and adds pillarbox (left/right bars)', () => {
    // 1080x1920 into 1920x1080
    const rect = computeFitRect(1080, 1920, 1920, 1080, 'fit')
    expect(rect.h).toBe(1080)
    expect(rect.w).toBeCloseTo(607.5, 1)
    expect(rect.y).toBe(0)
    expect(rect.x).toBeCloseTo((1920 - 607.5) / 2, 1)
    expect(rect.w / rect.h).toBeCloseTo(1080 / 1920, 4)
  })

  it('same aspect ratio source and target produces exact full rectangle', () => {
    const rect = computeFitRect(1920, 1080, 1920, 1080, 'fit')
    expect(rect.x).toBe(0)
    expect(rect.y).toBe(0)
    expect(rect.w).toBe(1920)
    expect(rect.h).toBe(1080)
  })

  it('handles invalid or zero dimensions gracefully', () => {
    const rect = computeFitRect(0, 0, 1920, 1080, 'fit')
    expect(rect.w).toBe(1920)
    expect(rect.h).toBe(1080)
    expect(rect.x).toBe(0)
    expect(rect.y).toBe(0)
  })
})

