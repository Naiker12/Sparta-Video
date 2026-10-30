import type { TransitionRef } from './catalog'

export interface TransitionState {
  progress: number // 0 to 1
  opacity: number // 0 to 1
  offsetX: number // in sequence pixels
  offsetY: number // in sequence pixels
  scale: number // scale multiplier (default 1)
  rotation: number // degrees (default 0)
  clipPath?: string // CSS clip-path syntax
  brightnessBoost?: number // multiplier / add
  glitchOffset?: number
}

/**
 * Computes transition state for a clip's entrance transition.
 * Returns null if no transition is configured or if currentTime is beyond the transition duration.
 */
export function computeTransitionInState(
  transition: TransitionRef | undefined,
  clipStart: number,
  currentTime: number,
  sequenceWidth: number,
  sequenceHeight: number,
): TransitionState | null {
  if (!transition || !transition.effectId || transition.duration <= 0) {
    return null
  }

  const elapsed = currentTime - clipStart
  if (elapsed < 0 || elapsed >= transition.duration) {
    return null
  }

  const rawProgress = Math.max(0, Math.min(1, elapsed / transition.duration))
  // Smooth cubic ease-out
  const easeOut = 1 - Math.pow(1 - rawProgress, 3)

  const id = transition.effectId

  switch (id) {
    case 'trans-cross-dissolve':
    case 'trans-fade-black':
    case 'trans-fade-white':
      return {
        progress: rawProgress,
        opacity: easeOut,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
      }

    case 'trans-slide-left':
      return {
        progress: rawProgress,
        opacity: 1,
        offsetX: (1 - easeOut) * sequenceWidth,
        offsetY: 0,
        scale: 1,
        rotation: 0,
      }

    case 'trans-slide-right':
      return {
        progress: rawProgress,
        opacity: 1,
        offsetX: -(1 - easeOut) * sequenceWidth,
        offsetY: 0,
        scale: 1,
        rotation: 0,
      }

    case 'trans-push-up':
      return {
        progress: rawProgress,
        opacity: 1,
        offsetX: 0,
        offsetY: (1 - easeOut) * sequenceHeight,
        scale: 1,
        rotation: 0,
      }

    case 'trans-push-down':
      return {
        progress: rawProgress,
        opacity: 1,
        offsetX: 0,
        offsetY: -(1 - easeOut) * sequenceHeight,
        scale: 1,
        rotation: 0,
      }

    case 'trans-zoom-in':
      return {
        progress: rawProgress,
        opacity: Math.min(1, rawProgress * 2),
        offsetX: 0,
        offsetY: 0,
        scale: 0.4 + 0.6 * easeOut,
        rotation: 0,
      }

    case 'trans-spin-rotate':
      return {
        progress: rawProgress,
        opacity: Math.min(1, rawProgress * 1.5),
        offsetX: 0,
        offsetY: 0,
        scale: 0.5 + 0.5 * easeOut,
        rotation: (1 - easeOut) * 180,
      }

    case 'trans-light-leak':
      return {
        progress: rawProgress,
        opacity: Math.min(1, rawProgress * 2),
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
        brightnessBoost: Math.sin(rawProgress * Math.PI) * 0.7,
      }

    case 'trans-glitch':
      return {
        progress: rawProgress,
        opacity: rawProgress > 0.1 ? 1 : rawProgress * 10,
        offsetX: Math.sin(rawProgress * 50) * (1 - easeOut) * 30,
        offsetY: Math.cos(rawProgress * 40) * (1 - easeOut) * 15,
        scale: 1,
        rotation: 0,
        glitchOffset: Math.sin(rawProgress * 60) * (1 - easeOut) * 20,
      }

    case 'trans-linear-wipe': {
      const rightInset = Math.max(0, (1 - easeOut) * 100)
      return {
        progress: rawProgress,
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
        clipPath: `inset(0% ${rightInset.toFixed(1)}% 0% 0%)`,
      }
    }

    case 'trans-iris-circle': {
      const radius = (easeOut * 75).toFixed(1)
      return {
        progress: rawProgress,
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
        clipPath: `circle(${radius}% at 50% 50%)`,
      }
    }

    case 'trans-clock-wipe': {
      const deg = (easeOut * 360).toFixed(1)
      return {
        progress: rawProgress,
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
        clipPath: `conic-gradient(from 0deg at 50% 50%, #fff ${deg}deg, transparent ${deg}deg)`,
      }
    }

    default:
      return {
        progress: rawProgress,
        opacity: easeOut,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
      }
  }
}

