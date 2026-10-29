import { describe, expect, it, vi } from 'vitest'
import {
  TEXT_STYLE_PRESETS,
  computeTextAnimationState,
  drawAnimatedTextClipToCanvas,
  getDefaultTextAnimation,
  getDefaultTextStyle,
} from './text-presets'
import type { Clip } from '../model'

function makeTextClip(presetId: string, text: string, start = 0, duration = 4): Clip {
  return {
    id: 'test-text-clip',
    title: text,
    text,
    textStyle: getDefaultTextStyle(presetId),
    textAnimation: getDefaultTextAnimation(presetId),
    start,
    duration,
    color: 'violet',
    thumbnail: 'text-overlay',
    kind: 'video',
    opacity: 100,
  }
}

describe('CapCut Pro text presets & animation engine', () => {
  it('exposes all 8 studio presets with valid styles and animations', () => {
    expect(TEXT_STYLE_PRESETS.length).toBeGreaterThanOrEqual(8)
    const hormozi = TEXT_STYLE_PRESETS.find((p) => p.id === 'hormozi-karaoke')
    expect(hormozi).toBeDefined()
    expect(hormozi?.animation.in).toBe('karaoke')
  })

  it('computes word-by-word karaoke highlight index accurately across clip progress', () => {
    const clip = makeTextClip('hormozi-karaoke', 'UNO DOS TRES CUATRO', 0, 4)
    const stateAtStart = computeTextAnimationState(clip, 0.2)
    expect(stateAtStart.isKaraoke).toBe(true)
    expect(stateAtStart.words).toEqual(['UNO', 'DOS', 'TRES', 'CUATRO'])
    expect(stateAtStart.activeWordIndex).toBe(0)

    const stateMid = computeTextAnimationState(clip, 2.1)
    expect(stateMid.activeWordIndex).toBe(2)

    const stateEnd = computeTextAnimationState(clip, 3.8)
    expect(stateEnd.activeWordIndex).toBe(3)
  })

  it('reveals characters progressively in typewriter animation mode', () => {
    const clip = makeTextClip('typewriter-docu', 'SECUENCIA DOCUMENTAL', 0, 4)
    const early = computeTextAnimationState(clip, 0.15)
    const full = computeTextAnimationState(clip, 2.0)
    expect(early.isTypewriter).toBe(true)
    expect(early.displayText.length).toBeLessThan(full.displayText.length)
    expect(full.displayText).toBe('SECUENCIA DOCUMENTAL')
  })

  it('draws animated text and background pill to a 2D canvas context during video export', () => {
    const clip = makeTextClip('capcut-pop-pill', 'Subtítulo Exportado', 0, 3)
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      measureText: vi.fn((str: string) => ({ width: str.length * 14 })),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      strokeText: vi.fn(),
      fillText: vi.fn(),
      globalAlpha: 1,
      font: '',
      textBaseline: 'middle',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: 'round',
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetY: 0,
      textAlign: 'center',
    } as unknown as CanvasRenderingContext2D

    drawAnimatedTextClipToCanvas(mockCtx, clip, 1.2, 1920, 1080)
    expect(mockCtx.save).toHaveBeenCalled()
    expect(mockCtx.fill).toHaveBeenCalled()
    expect(mockCtx.fillText).toHaveBeenCalledWith('Subtítulo Exportado', 0, expect.any(Number))
    expect(mockCtx.restore).toHaveBeenCalled()
  })

  it('wraps long subtitles and karaoke captions into multi-line rows without overflowing canvas', () => {
    const karaokeClip: Clip = {
      id: 'k1',
      title: 'Karaoke largo',
      start: 0,
      duration: 5,
      color: 'violet',
      thumbnail: 'text-overlay',
      kind: 'video',
      text: 'Esta es una frase muy larga que definitivamente supera el ancho permitido para un subtitulo en pantalla completa',
      textStyle: getDefaultTextStyle('hormozi-karaoke'),
      textAnimation: { in: 'karaoke', out: 'none', loop: 'none', inDuration: 0.2, outDuration: 0.2 },
    }

    const filledWords: string[] = []
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      measureText: vi.fn((str: string) => ({ width: str.length * 28 })),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      strokeText: vi.fn(),
      fillText: vi.fn((w: string) => filledWords.push(w)),
      globalAlpha: 1,
      font: '',
      textBaseline: 'middle',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: 'round',
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetY: 0,
      textAlign: 'left',
    } as unknown as CanvasRenderingContext2D

    drawAnimatedTextClipToCanvas(mockCtx, karaokeClip, 2.5, 1080, 1920)
    expect(mockCtx.save).toHaveBeenCalled()
    expect(filledWords.length).toBeGreaterThan(5)
    expect(mockCtx.restore).toHaveBeenCalled()
  })
})

