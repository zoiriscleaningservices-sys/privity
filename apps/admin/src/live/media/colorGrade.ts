/**
 * Colour grade — the single definition of what a Privity filter does to a pixel.
 *
 * `COLOR_GRADE_FRAGMENT_SHADER` runs on the GPU for every camera frame (FilterPipeline).
 * `gradePixel` is a line-by-line TypeScript mirror used by unit tests and QA tooling to
 * predict the shader output. Change both together.
 *
 * All maths is in display (gamma-encoded) RGB, 0..1.
 */

import { FilterParams } from './filterTypes';

export type RGB = [number, number, number];

const LUMA: RGB = [0.2126, 0.7152, 0.0722];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/**
 * @param rgb       input colour, channels 0..1
 * @param p         filter parameters (already clamped)
 * @param intensity 0..1 blend between original and graded
 * @param uv        pixel position 0..1 (only affects vignette)
 */
export function gradePixel(rgb: RGB, p: FilterParams, intensity: number, uv: [number, number] = [0.5, 0.5]): RGB {
  let [r, g, b] = rgb;

  // 1. White balance: temperature (amber ↔ blue) and tint (green ↔ magenta).
  r += p.temperature * 0.1 + p.tint * 0.04;
  g += -p.tint * 0.08;
  b += -p.temperature * 0.1 + p.tint * 0.04;

  // 2. Exposure.
  r += p.brightness * 0.25;
  g += p.brightness * 0.25;
  b += p.brightness * 0.25;

  // 3. Contrast around mid grey.
  const k = 1 + p.contrast;
  r = (r - 0.5) * k + 0.5;
  g = (g - 0.5) * k + 0.5;
  b = (b - 0.5) * k + 0.5;

  // 4. Saturation against Rec.709 luma.
  const l = r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
  const s = 1 + p.saturation;
  r = l + (r - l) * s;
  g = l + (g - l) * s;
  b = l + (b - l) * s;

  // 5. Fade (matte): compress range and lift blacks.
  const fadeScale = 1 - 0.3 * p.fade;
  const fadeLift = 0.12 * p.fade;
  r = r * fadeScale + fadeLift;
  g = g * fadeScale + fadeLift;
  b = b * fadeScale + fadeLift;

  // 6. Vignette.
  const dx = uv[0] - 0.5;
  const dy = uv[1] - 0.5;
  const d = Math.sqrt(dx * dx + dy * dy) / 0.70710678;
  const v = 1 - p.vignette * 0.85 * smoothstep(0.35, 1.0, d);
  r *= v;
  g *= v;
  b *= v;

  r = clamp01(r);
  g = clamp01(g);
  b = clamp01(b);

  const t = clamp01(intensity);
  return [rgb[0] + (r - rgb[0]) * t, rgb[1] + (g - rgb[1]) * t, rgb[2] + (b - rgb[2]) * t];
}

/** Convenience for 0..255 channel values (as returned by readPixels / ImageData). */
export function gradePixel255(rgb: RGB, p: FilterParams, intensity: number, uv?: [number, number]): RGB {
  const out = gradePixel([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255], p, intensity, uv);
  return [Math.round(out[0] * 255), Math.round(out[1] * 255), Math.round(out[2] * 255)];
}

export const COLOR_GRADE_VERTEX_SHADER = `
attribute vec2 a_pos;
uniform float u_mirror;
varying vec2 v_uv;
void main() {
  vec2 uv = a_pos * 0.5 + 0.5;
  v_uv = vec2(mix(uv.x, 1.0 - uv.x, u_mirror), 1.0 - uv.y);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const COLOR_GRADE_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_frame;
uniform vec4 u_a;        // brightness, contrast, saturation, temperature
uniform vec4 u_b;        // tint, fade, vignette, unused
uniform float u_intensity;
uniform float u_bypass;  // 1.0 = output the untouched camera frame (before/after compare)

void main() {
  vec3 src = texture2D(u_frame, v_uv).rgb;
  vec3 c = src;
  float brightness = u_a.x;
  float contrast = u_a.y;
  float saturation = u_a.z;
  float temperature = u_a.w;
  float tint = u_b.x;
  float fade = u_b.y;
  float vignette = u_b.z;

  c += vec3(temperature * 0.1 + tint * 0.04, -tint * 0.08, -temperature * 0.1 + tint * 0.04);
  c += vec3(brightness * 0.25);
  c = (c - 0.5) * (1.0 + contrast) + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = vec3(l) + (c - vec3(l)) * (1.0 + saturation);
  c = c * (1.0 - 0.3 * fade) + vec3(0.12 * fade);
  // Vignette is radially symmetric, so mirroring does not affect it.
  float d = length(v_uv - 0.5) / 0.70710678;
  c *= 1.0 - vignette * 0.85 * smoothstep(0.35, 1.0, d);
  c = clamp(c, 0.0, 1.0);

  vec3 graded = mix(src, c, clamp(u_intensity, 0.0, 1.0));
  gl_FragColor = vec4(mix(graded, src, u_bypass), 1.0);
}
`;
