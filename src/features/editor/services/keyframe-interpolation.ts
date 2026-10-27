import type { Clip, Keyframe, Transform } from '../model'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

/**
 * Finds bounding keyframes for a given property at the specified time.
 */
function getBoundingKeyframes(
  keyframes: Keyframe[],
  property: Keyframe['property'],
  time: number,
): { k1: Keyframe | null; k2: Keyframe | null } {
  const propertyKeyframes = keyframes
    .filter((k) => k.property === property)
    .sort((a, b) => a.time - b.time)

  if (propertyKeyframes.length === 0) return { k1: null, k2: null }
  if (propertyKeyframes.length === 1) return { k1: propertyKeyframes[0], k2: propertyKeyframes[0] }

  if (time <= propertyKeyframes[0].time) {
    return { k1: propertyKeyframes[0], k2: propertyKeyframes[0] }
  }

  const last = propertyKeyframes[propertyKeyframes.length - 1]
  if (time >= last.time) {
    return { k1: last, k2: last }
  }

  for (let i = 0; i < propertyKeyframes.length - 1; i++) {
    const k1 = propertyKeyframes[i]
    const k2 = propertyKeyframes[i + 1]
    if (time >= k1.time && time <= k2.time) {
      return { k1, k2 }
    }
  }

  return { k1: last, k2: last }
}

/**
 * Calculates the interpolated Transform (position x/y, scale x/y, rotation)
 * of a clip at a given sequence time.
 */
export function getInterpolatedTransform(
  clip: Clip,
  sequenceTime: number,
  sequenceSize = { width: 1920, height: 1080 },
): Transform {
  const base: Transform = clip.transform ?? {
    x: sequenceSize.width / 2,
    y: sequenceSize.height / 2,
    scaleX: 100,
    scaleY: 100,
    rotation: 0,
  }

  if (!clip.keyframes || clip.keyframes.length === 0) {
    return base
  }

  const result: Transform = { ...base }

  // 1. Position interpolation
  const posBounds = getBoundingKeyframes(clip.keyframes, 'position', sequenceTime)
  if (posBounds.k1 && posBounds.k2) {
    const k1 = posBounds.k1
    const k2 = posBounds.k2
    const v1X = k1.valueX ?? base.x
    const v1Y = k1.valueY ?? base.y
    const v2X = k2.valueX ?? base.x
    const v2Y = k2.valueY ?? base.y

    if (k1.time === k2.time) {
      result.x = v1X
      result.y = v1Y
    } else {
      const t = smoothstep((sequenceTime - k1.time) / (k2.time - k1.time))
      result.x = Math.round(lerp(v1X, v2X, t) * 10) / 10
      result.y = Math.round(lerp(v1Y, v2Y, t) * 10) / 10
    }
  }

  // 2. Scale interpolation
  const scaleBounds = getBoundingKeyframes(clip.keyframes, 'scale', sequenceTime)
  if (scaleBounds.k1 && scaleBounds.k2) {
    const k1 = scaleBounds.k1
    const k2 = scaleBounds.k2
    const v1X = k1.valueX ?? (k1.value !== undefined ? k1.value : base.scaleX)
    const v1Y = k1.valueY ?? (k1.value !== undefined ? k1.value : base.scaleY)
    const v2X = k2.valueX ?? (k2.value !== undefined ? k2.value : base.scaleX)
    const v2Y = k2.valueY ?? (k2.value !== undefined ? k2.value : base.scaleY)

    if (k1.time === k2.time) {
      result.scaleX = v1X
      result.scaleY = v1Y
    } else {
      const t = smoothstep((sequenceTime - k1.time) / (k2.time - k1.time))
      result.scaleX = Math.round(lerp(v1X, v2X, t) * 10) / 10
      result.scaleY = Math.round(lerp(v1Y, v2Y, t) * 10) / 10
    }
  }

  // 3. Rotation interpolation
  const rotBounds = getBoundingKeyframes(clip.keyframes, 'rotation', sequenceTime)
  if (rotBounds.k1 && rotBounds.k2) {
    const k1 = rotBounds.k1
    const k2 = rotBounds.k2
    const v1 = k1.value ?? base.rotation
    const v2 = k2.value ?? base.rotation

    if (k1.time === k2.time) {
      result.rotation = v1
    } else {
      const t = smoothstep((sequenceTime - k1.time) / (k2.time - k1.time))
      result.rotation = Math.round(lerp(v1, v2, t) * 10) / 10
    }
  }

  return result
}

/**
 * Calculates the interpolated opacity (0-100) of a clip at a given sequence time,
 * including keyframes and fade in/out ramps.
 */
export function getInterpolatedOpacity(clip: Clip, sequenceTime: number): number {
  let baseOpacity = clip.opacity ?? 100

  // Keyframed opacity
  if (clip.keyframes && clip.keyframes.length > 0) {
    const bounds = getBoundingKeyframes(clip.keyframes, 'opacity', sequenceTime)
    if (bounds.k1 && bounds.k2) {
      const v1 = bounds.k1.value ?? baseOpacity
      const v2 = bounds.k2.value ?? baseOpacity
      if (bounds.k1.time === bounds.k2.time) {
        baseOpacity = v1
      } else {
        const t = smoothstep((sequenceTime - bounds.k1.time) / (bounds.k2.time - bounds.k1.time))
        baseOpacity = lerp(v1, v2, t)
      }
    }
  }

  // Handle fade-in
  if (clip.fadeIn && clip.fadeIn > 0) {
    const elapsed = sequenceTime - clip.start
    if (elapsed < clip.fadeIn) {
      const fadeFactor = Math.max(0, Math.min(1, elapsed / clip.fadeIn))
      baseOpacity *= fadeFactor
    }
  }

  // Handle fade-out
  if (clip.fadeOut && clip.fadeOut > 0) {
    const remaining = clip.start + clip.duration - sequenceTime
    if (remaining < clip.fadeOut) {
      const fadeFactor = Math.max(0, Math.min(1, remaining / clip.fadeOut))
      baseOpacity *= fadeFactor
    }
  }

  return Math.max(0, Math.min(100, Math.round(baseOpacity * 10) / 10))
}
