import type { ClipBlendMode, FitMode, Transform } from '../model'
import { computeFitRect } from '../services/media-fit'
import {
  BLEND_FRAGMENT_SHADER,
  BLIT_FRAGMENT_SHADER,
  CLIP_FRAGMENT_SHADER,
  VERTEX_SHADER,
} from './shaders'

export interface RenderClipOptions {
  element: TexImageSource
  srcWidth: number
  srcHeight: number
  transform: Transform
  fit?: FitMode
  opacity?: number
  blendMode?: ClipBlendMode
  flipH?: boolean
  flipV?: boolean
  crop?: { l: number; t: number; r: number; b: number }
  adjustments?: {
    brightness?: number
    contrast?: number
    saturation?: number
    temperature?: number
    tint?: number
  }
}

const BLEND_MODE_MAP: Record<ClipBlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  darken: 4,
  lighten: 5,
  'soft-light': 6,
  add: 7,
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('WebGL shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, vertSrc)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  if (!vs || !fs) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('WebGL program link error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

/**
 * High-performance WebGL2 compositor for Sparta Video.
 * Unifies real-time monitor rendering and frame-by-frame export pipeline.
 */
export class WebGLCompositor {
  readonly gl: WebGL2RenderingContext
  private width: number
  private height: number

  private clipProgram: WebGLProgram | null = null
  private blendProgram: WebGLProgram | null = null
  private blitProgram: WebGLProgram | null = null

  private quadVao: WebGLVertexArrayObject | null = null
  private quadVbo: WebGLBuffer | null = null

  // Ping-pong Framebuffer Objects
  private fboA: WebGLFramebuffer | null = null
  private textureA: WebGLTexture | null = null
  private fboB: WebGLFramebuffer | null = null
  private textureB: WebGLTexture | null = null
  private activeFboIndex = 0 // 0 = A is output, 1 = B is output

  // Media texture cache
  private mediaTexture: WebGLTexture | null = null

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, width = 1920, height = 1080) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    }) as WebGL2RenderingContext | null

    if (!gl) {
      throw new Error('WebGL2 is not supported in this environment.')
    }

    this.gl = gl
    this.width = width
    this.height = height

    this.initGL()
    this.resize(width, height)
  }

  static isSupported(canvas?: HTMLCanvasElement): boolean {
    if (typeof document === 'undefined') return false
    try {
      const c = canvas ?? document.createElement('canvas')
      return Boolean(c.getContext('webgl2'))
    } catch {
      return false
    }
  }

  private initGL(): void {
    const gl = this.gl

    // Compile programs
    this.clipProgram = createProgram(gl, VERTEX_SHADER, CLIP_FRAGMENT_SHADER)
    this.blendProgram = createProgram(gl, VERTEX_SHADER, BLEND_FRAGMENT_SHADER)
    this.blitProgram = createProgram(gl, VERTEX_SHADER, BLIT_FRAGMENT_SHADER)

    // Standard unit quad [-0.5, 0.5] centered at origin
    // pos.x, pos.y, texCoord.u, texCoord.v
    // prettier-ignore
    const quadVertices = new Float32Array([
      -0.5, -0.5, 0.0, 0.0,
       0.5, -0.5, 1.0, 0.0,
      -0.5,  0.5, 0.0, 1.0,
      -0.5,  0.5, 0.0, 1.0,
       0.5, -0.5, 1.0, 0.0,
       0.5,  0.5, 1.0, 1.0,
    ])

    this.quadVao = gl.createVertexArray()
    this.quadVbo = gl.createBuffer()

    gl.bindVertexArray(this.quadVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo)
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW)

    // 0: a_position (vec2)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * 4, 0)

    // 1: a_texCoord (vec2)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * 4, 2 * 4)

    gl.bindVertexArray(null)

    // Setup reusable media texture
    this.mediaTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.mediaTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.width = width
    this.height = height

    const gl = this.gl
    gl.viewport(0, 0, width, height)

    // Recreate FBO textures at new resolution
    if (this.fboA) gl.deleteFramebuffer(this.fboA)
    if (this.textureA) gl.deleteTexture(this.textureA)
    if (this.fboB) gl.deleteFramebuffer(this.fboB)
    if (this.textureB) gl.deleteTexture(this.textureB)

    const createFbo = (): { fbo: WebGLFramebuffer; tex: WebGLTexture } => {
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

      const fbo = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      return { fbo, tex }
    }

    const a = createFbo()
    this.fboA = a.fbo
    this.textureA = a.tex

    const b = createFbo()
    this.fboB = b.fbo
    this.textureB = b.tex

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  clear(r = 0, g = 0, b = 0, a = 1): void {
    const gl = this.gl
    // Clear both ping-pong framebuffers
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA)
    gl.clearColor(r, g, b, a)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB)
    gl.clearColor(r, g, b, a)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Clear main canvas buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.clearColor(r, g, b, a)
    gl.clear(gl.COLOR_BUFFER_BIT)

    this.activeFboIndex = 0
  }

  /**
   * Draws a media clip with full transform matrix, fit encuadre, crop, blend mode, and color grading.
   */
  drawClip(options: RenderClipOptions): void {
    const gl = this.gl
    if (!this.clipProgram || !this.blendProgram || !this.mediaTexture) return

    const {
      element,
      srcWidth,
      srcHeight,
      transform,
      fit = 'fit',
      opacity = 1,
      blendMode = 'normal',
      flipH = false,
      flipV = false,
      crop = { l: 0, t: 0, r: 0, b: 0 },
      adjustments = {},
    } = options

    if (srcWidth <= 0 || srcHeight <= 0) return

    // 1. Upload source element to media texture
    gl.bindTexture(gl.TEXTURE_2D, this.mediaTexture)
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, element)
    } catch {
      return
    }

    // 2. Compute fit rectangle
    const fitRect = computeFitRect(srcWidth, srcHeight, this.width, this.height, fit)
    const baseW = fitRect.w
    const baseH = fitRect.h

    // 3. Compute 2D transformation matrix in pixel space
    // Scale quad from 1x1 to (baseW * scaleX, baseH * scaleY)
    const userScaleX = ((transform.scaleX ?? 100) / 100) * (flipH ? -1 : 1)
    const userScaleY = ((transform.scaleY ?? 100) / 100) * (flipV ? -1 : 1)
    const totalW = baseW * userScaleX
    const totalH = baseH * userScaleY

    const rad = ((transform.rotation ?? 0) * Math.PI) / 180
    const cosR = Math.cos(rad)
    const sinR = Math.sin(rad)

    // Matrix M = Translation * Rotation * Scale
    // prettier-ignore
    const matrix = new Float32Array([
      cosR * totalW,  sinR * totalW, 0.0,
     -sinR * totalH,  cosR * totalH, 0.0,
      transform.x,    transform.y,   1.0,
    ])

    // Current background is in textureA (if activeFboIndex == 0) or textureB (if activeFboIndex == 1)
    const currentBgTex = this.activeFboIndex === 0 ? this.textureA : this.textureB
    const targetFbo = this.activeFboIndex === 0 ? this.fboB : this.fboA
    const targetTex = this.activeFboIndex === 0 ? this.textureB : this.textureA

    // 4. If blendMode is 'normal', we can directly draw the clip onto current background with alpha blending!
    if (blendMode === 'normal') {
      const activeFbo = this.activeFboIndex === 0 ? this.fboA : this.fboB
      gl.bindFramebuffer(gl.FRAMEBUFFER, activeFbo)
      gl.viewport(0, 0, this.width, this.height)

      gl.enable(gl.BLEND)
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

      gl.useProgram(this.clipProgram)
      gl.uniformMatrix3fv(gl.getUniformLocation(this.clipProgram, 'u_matrix'), false, matrix)
      gl.uniform2f(gl.getUniformLocation(this.clipProgram, 'u_resolution'), this.width, this.height)
      gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_opacity'), opacity)
      gl.uniform4f(
        gl.getUniformLocation(this.clipProgram, 'u_crop'),
        crop.l,
        crop.t,
        crop.r,
        crop.b,
      )
      gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_brightness'), adjustments.brightness ?? 0)
      gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_contrast'), adjustments.contrast ?? 1)
      gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_saturation'), adjustments.saturation ?? 1)
      gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_temperature'), adjustments.temperature ?? 0)
      gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_tint'), adjustments.tint ?? 0)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.mediaTexture)
      gl.uniform1i(gl.getUniformLocation(this.clipProgram, 'u_texture'), 0)

      gl.bindVertexArray(this.quadVao)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      gl.bindVertexArray(null)
      gl.disable(gl.BLEND)
      return
    }

    // 5. For other blend modes (multiply, screen, overlay, etc.), render clip to targetFbo then ping-pong blend
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.clipProgram)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.clipProgram, 'u_matrix'), false, matrix)
    gl.uniform2f(gl.getUniformLocation(this.clipProgram, 'u_resolution'), this.width, this.height)
    gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_opacity'), 1.0)
    gl.uniform4f(
      gl.getUniformLocation(this.clipProgram, 'u_crop'),
      crop.l,
      crop.t,
      crop.r,
      crop.b,
    )
    gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_brightness'), adjustments.brightness ?? 0)
    gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_contrast'), adjustments.contrast ?? 1)
    gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_saturation'), adjustments.saturation ?? 1)
    gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_temperature'), adjustments.temperature ?? 0)
    gl.uniform1f(gl.getUniformLocation(this.clipProgram, 'u_tint'), adjustments.tint ?? 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.mediaTexture)
    gl.uniform1i(gl.getUniformLocation(this.clipProgram, 'u_texture'), 0)

    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // Blend pass: currentBgTex + targetTex -> targetFbo (ping-pong switch)
    const nextFbo = this.activeFboIndex === 0 ? this.fboA : this.fboB
    gl.bindFramebuffer(gl.FRAMEBUFFER, nextFbo)

    gl.useProgram(this.blendProgram)
    const fullScreenMatrix = new Float32Array([
      this.width, 0, 0,
      0, this.height, 0,
      this.width / 2, this.height / 2, 1,
    ])
    gl.uniformMatrix3fv(gl.getUniformLocation(this.blendProgram, 'u_matrix'), false, fullScreenMatrix)
    gl.uniform2f(gl.getUniformLocation(this.blendProgram, 'u_resolution'), this.width, this.height)
    gl.uniform1i(
      gl.getUniformLocation(this.blendProgram, 'u_blendMode'),
      BLEND_MODE_MAP[blendMode] ?? 0,
    )
    gl.uniform1f(gl.getUniformLocation(this.blendProgram, 'u_opacity'), opacity)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, currentBgTex)
    gl.uniform1i(gl.getUniformLocation(this.blendProgram, 'u_background'), 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, targetTex)
    gl.uniform1i(gl.getUniformLocation(this.blendProgram, 'u_foreground'), 1)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)

    // Flip active FBO
    this.activeFboIndex = 1 - this.activeFboIndex
  }

  /**
   * Final step: blits the accumulated composition to the visible output canvas.
   */
  blitToCanvas(): void {
    const gl = this.gl
    if (!this.blitProgram) return

    const finalTex = this.activeFboIndex === 0 ? this.textureA : this.textureB

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)

    gl.useProgram(this.blitProgram)
    const fullScreenMatrix = new Float32Array([
      this.width, 0, 0,
      0, this.height, 0,
      this.width / 2, this.height / 2, 1,
    ])
    gl.uniformMatrix3fv(gl.getUniformLocation(this.blitProgram, 'u_matrix'), false, fullScreenMatrix)
    gl.uniform2f(gl.getUniformLocation(this.blitProgram, 'u_resolution'), this.width, this.height)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, finalTex)
    gl.uniform1i(gl.getUniformLocation(this.blitProgram, 'u_texture'), 0)

    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  dispose(): void {
    const gl = this.gl
    if (this.fboA) gl.deleteFramebuffer(this.fboA)
    if (this.textureA) gl.deleteTexture(this.textureA)
    if (this.fboB) gl.deleteFramebuffer(this.fboB)
    if (this.textureB) gl.deleteTexture(this.textureB)
    if (this.mediaTexture) gl.deleteTexture(this.mediaTexture)
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo)
    if (this.quadVao) gl.deleteVertexArray(this.quadVao)
    if (this.clipProgram) gl.deleteProgram(this.clipProgram)
    if (this.blendProgram) gl.deleteProgram(this.blendProgram)
    if (this.blitProgram) gl.deleteProgram(this.blitProgram)
  }
}
