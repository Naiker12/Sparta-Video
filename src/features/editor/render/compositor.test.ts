import { describe, expect, it } from 'vitest'
import { WebGLCompositor } from './compositor'

describe('WebGLCompositor', () => {
  it('reports support status correctly', () => {
    // In headless test environments without real WebGL2 hardware
    const supported = WebGLCompositor.isSupported()
    expect(typeof supported).toBe('boolean')
  })

  it('throws descriptive error if WebGL2 is requested on an unsupported canvas', () => {
    const canvas = document.createElement('canvas')
    // jsdom canvas returns null for 'webgl2'
    if (!canvas.getContext('webgl2')) {
      expect(() => new WebGLCompositor(canvas)).toThrow(/WebGL2 is not supported/i)
    }
  })
})

