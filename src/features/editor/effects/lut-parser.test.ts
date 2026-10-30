import { describe, expect, it } from 'vitest'
import { applyLUTToPixels, parseCubeLUT, sampleLUT3D } from './lut-parser'

describe('parseCubeLUT', () => {
  it('parses comments, title, size, and data from a .cube file', () => {
    const cubeText = `
# Sparta Video Test LUT
TITLE "Vintage Warmth"
LUT_3D_SIZE 2
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
`
    const lut = parseCubeLUT(cubeText)
    expect(lut.title).toBe('Vintage Warmth')
    expect(lut.type).toBe('3D')
    expect(lut.size).toBe(2)
    expect(lut.domainMin).toEqual([0, 0, 0])
    expect(lut.domainMax).toEqual([1, 1, 1])
    expect(lut.data.length).toBe(24) // 2^3 * 3
  })

  it('correctly samples an identity LUT', () => {
    // 2x2x2 identity LUT
    const cubeText = `
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
`
    const lut = parseCubeLUT(cubeText)
    const sampled = sampleLUT3D(lut, 0.5, 0.5, 0.5)
    expect(sampled[0]).toBeCloseTo(0.5, 2)
    expect(sampled[1]).toBeCloseTo(0.5, 2)
    expect(sampled[2]).toBeCloseTo(0.5, 2)
  })

  it('applies LUT transformation to pixel buffer', () => {
    // Red booster LUT: red is scaled up by 1.0, green and blue zeroed
    const cubeText = `
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.0 0.0
0.0 0.0 0.0
1.0 0.0 0.0
0.0 0.0 0.0
1.0 0.0 0.0
0.0 0.0 0.0
1.0 0.0 0.0
`
    const lut = parseCubeLUT(cubeText)
    const pixels = new Uint8ClampedArray([128, 128, 128, 255])
    applyLUTToPixels(pixels, lut, 1.0)

    // Red remains ~128, green and blue become ~0
    expect(pixels[0]).toBeGreaterThan(120)
    expect(pixels[1]).toBeLessThan(10)
    expect(pixels[2]).toBeLessThan(10)
    expect(pixels[3]).toBe(255)
  })

  it('respects intensity blending', () => {
    const cubeText = `
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.0 0.0
0.0 0.0 0.0
1.0 0.0 0.0
0.0 0.0 0.0
1.0 0.0 0.0
0.0 0.0 0.0
1.0 0.0 0.0
`
    const lut = parseCubeLUT(cubeText)
    const pixels = new Uint8ClampedArray([200, 200, 200, 255])
    // 50% intensity
    applyLUTToPixels(pixels, lut, 0.5)

    // Green was 200, becomes ~100 with 50% blend
    expect(pixels[1]).toBeCloseTo(100, -1)
  })
})

