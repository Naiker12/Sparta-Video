/**
 * WebGL2 GLSL Shaders for Sparta Video rendering engine
 */

export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;

uniform mat3 u_matrix;
uniform vec2 u_resolution;

out vec2 v_texCoord;

void main() {
  // Multiply local quad position by transformation matrix (in sequence pixel space)
  vec3 pixelPos = u_matrix * vec3(a_position, 1.0);

  // Convert pixel space [0, resolution] to NDC [-1, 1], flipping Y so top-left is (0, 0)
  vec2 zeroToOne = pixelPos.xy / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  clipSpace.y = -clipSpace.y;

  gl_Position = vec4(clipSpace, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`

export const CLIP_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;

uniform float u_opacity;
uniform vec4 u_crop; // left, top, right, bottom (normalized 0.0 to 1.0)
uniform float u_brightness; // -1.0 to 1.0 (default 0.0)
uniform float u_contrast;   // 0.0 to 2.0 (default 1.0)
uniform float u_saturation; // 0.0 to 2.0 (default 1.0)
uniform float u_temperature;// -1.0 to 1.0 (default 0.0)
uniform float u_tint;       // -1.0 to 1.0 (default 0.0)

out vec4 fragColor;

void main() {
  // Crop discard check
  if (v_texCoord.x < u_crop.x || v_texCoord.x > (1.0 - u_crop.z) ||
      v_texCoord.y < u_crop.y || v_texCoord.y > (1.0 - u_crop.w)) {
    discard;
  }

  vec4 color = texture(u_texture, v_texCoord);
  if (color.a <= 0.001) {
    discard;
  }

  // 1. Brightness
  vec3 rgb = color.rgb + vec3(u_brightness);

  // 2. Contrast
  rgb = (rgb - 0.5) * max(u_contrast, 0.0) + 0.5;

  // 3. Saturation (standard Rec.709 luma weights)
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(luma), rgb, max(u_saturation, 0.0));

  // 4. White balance (temperature: blue-amber, tint: green-magenta)
  if (abs(u_temperature) > 0.001) {
    rgb.r += u_temperature * 0.12;
    rgb.b -= u_temperature * 0.12;
  }
  if (abs(u_tint) > 0.001) {
    rgb.g -= u_tint * 0.10;
    rgb.r += u_tint * 0.05;
    rgb.b += u_tint * 0.05;
  }

  rgb = clamp(rgb, 0.0, 1.0);
  fragColor = vec4(rgb * color.a, color.a * u_opacity);
}
`

export const BLEND_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_background;
uniform sampler2D u_foreground;
uniform int u_blendMode; // 0=normal, 1=multiply, 2=screen, 3=overlay, 4=darken, 5=lighten, 6=soft-light, 7=add
uniform float u_opacity;

out vec4 fragColor;

void main() {
  vec4 base = texture(u_background, v_texCoord);
  vec4 blend = texture(u_foreground, v_texCoord);

  if (blend.a <= 0.001) {
    fragColor = base;
    return;
  }

  vec3 baseRgb = base.a > 0.0 ? base.rgb / base.a : vec3(0.0);
  vec3 blendRgb = blend.a > 0.0 ? blend.rgb / blend.a : vec3(0.0);
  vec3 result = blendRgb;

  if (u_blendMode == 1) {
    // Multiply
    result = baseRgb * blendRgb;
  } else if (u_blendMode == 2) {
    // Screen
    result = 1.0 - (1.0 - baseRgb) * (1.0 - blendRgb);
  } else if (u_blendMode == 3) {
    // Overlay
    for (int i = 0; i < 3; i++) {
      result[i] = baseRgb[i] < 0.5
        ? (2.0 * baseRgb[i] * blendRgb[i])
        : (1.0 - 2.0 * (1.0 - baseRgb[i]) * (1.0 - blendRgb[i]));
    }
  } else if (u_blendMode == 4) {
    // Darken
    result = min(baseRgb, blendRgb);
  } else if (u_blendMode == 5) {
    // Lighten
    result = max(baseRgb, blendRgb);
  } else if (u_blendMode == 6) {
    // Soft Light
    for (int i = 0; i < 3; i++) {
      result[i] = (1.0 - 2.0 * blendRgb[i]) * baseRgb[i] * baseRgb[i] + 2.0 * blendRgb[i] * baseRgb[i];
    }
  } else if (u_blendMode == 7) {
    // Add / Linear Dodge
    result = min(vec3(1.0), baseRgb + blendRgb);
  }

  // Alpha composition
  float srcA = blend.a * u_opacity;
  float outA = srcA + base.a * (1.0 - srcA);
  vec3 outRgb = vec3(0.0);
  if (outA > 0.0) {
    outRgb = (result * srcA + baseRgb * base.a * (1.0 - srcA)) / outA;
  }

  fragColor = vec4(clamp(outRgb, 0.0, 1.0) * outA, outA);
}
`

export const BLIT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;

out vec4 fragColor;

void main() {
  fragColor = texture(u_texture, v_texCoord);
}
`

