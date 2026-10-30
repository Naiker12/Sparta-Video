import { describe, expect, it } from 'vitest'
import {
  applyChromaKey,
  applyChromaticAberration,
  applyFilmGrain,
  getEffectsCSSFilter,
} from './pixel-effects'

describe('getEffectsCSSFilter', () => {
  it('returns empty string for empty effects list', () => {
    expect(getEffectsCSSFilter([])).toBe('')
    expect(getEffectsCSSFilter(undefined)).toBe('')
  })

  it('generates blur and drop-shadow css filters', () => {
    const filter = getEffectsCSSFilter([
      {
        id: '1',
        effectId: 'fx-gaussian-blur',
        enabled: true,
        intensity: 80,
        params: { radius: 10 },
      },
    ])
    expect(filter).toBe('blur(8.0px)')
  })

  it('ignores disabled effects', () => {
    const filter = getEffectsCSSFilter([
      {
        id: '1',
        effectId: 'fx-gaussian-blur',
        enabled: false,
        intensity: 80,
        params: { radius: 10 },
      },
    ])
    expect(filter).toBe('')
  })
})

describe('applyChromaKey', () => {
  it('makes green pixels transparent while leaving red intact', () => {
    // 2 pixels: first pure green [0, 255, 0, 255], second pure red [255, 0, 0, 255]
    const data = new Uint8ClampedArray([0, 255, 0, 255, 255, 0, 0, 255])
    const imgData = { width: 2, height: 1, data } as unknown as ImageData

    applyChromaKey(imgData, [0, 255, 0], 30, 10)

    // Green pixel alpha should be 0
    expect(data[3]).toBe(0)
    // Red pixel alpha should remain 255
    expect(data[7]).toBe(255)
  })
})

describe('applyChromaticAberration', () => {
  it('shifts red and blue channels horizontally', () => {
    // 3 pixels in a row: Pixel 0 is pure Red, Pixel 1 is black, Pixel 2 is pure Blue
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 255, 255,
    ])
    const imgData = { width: 3, height: 1, data } as unknown as ImageData

    applyChromaticAberration(imgData, 1)

    // With shift=1:
    // Pixel 1 (middle) should sample red from x=0 (red=255) and blue from x=2 (blue=255)
    expect(data[4]).toBe(255) // Red shifted into middle
    expect(data[6]).toBe(255) // Blue shifted into middle
  })
})

describe('applyFilmGrain', () => {
  it('adds noise variance to non-transparent pixels', () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255, 128, 128, 128, 255])
    const imgData = { width: 2, height: 1, data } as unknown as ImageData

    applyFilmGrain(imgData, 50, true)

    // Values should deviate from exactly 128
    const changed = data[0] !== 128 || data[4] !== 128
    expect(changed).toBe(true)
  })
})

