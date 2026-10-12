import { describe, expect, it } from 'vitest';
import { computeDualLayout, coverCrop } from '../media/DualCompositor';

describe('Dual camera compositor layout', () => {
  it('keeps portrait sources at native size up to 1280 px and places the PiP inside the frame', () => {
    const l = computeDualLayout(720, 1280);
    expect(l.canvas).toEqual({ w: 720, h: 1280 });
    expect(l.pip.x).toBeGreaterThan(0);
    expect(l.pip.x + l.pip.w).toBeLessThan(l.canvas.w);
    expect(l.pip.y + l.pip.h).toBeLessThan(l.canvas.h);
    expect(l.pip.w).toBe(Math.round(720 * 0.3));
  });

  it('downscales large sources so the longest side is at most 1280 px (even dimensions)', () => {
    const l = computeDualLayout(1920, 1080);
    expect(Math.max(l.canvas.w, l.canvas.h)).toBe(1280);
    expect(l.canvas.w % 2).toBe(0);
    expect(l.canvas.h % 2).toBe(0);
  });

  it('keeps the PiP inside the centre 9:16 region of landscape frames so portrait viewers see it', () => {
    const l = computeDualLayout(1280, 720);
    const safeW = Math.round((720 * 9) / 16);
    const safeX = (1280 - safeW) / 2;
    expect(l.pip.x).toBeGreaterThanOrEqual(safeX);
    expect(l.pip.x + l.pip.w).toBeLessThanOrEqual(safeX + safeW);
  });

  it('cover-crops without distortion', () => {
    const c = coverCrop(1920, 1080, 720, 1280);
    expect(c.h).toBe(1080);
    expect(c.w / c.h).toBeCloseTo(720 / 1280, 5);
    expect(c.x).toBeCloseTo((1920 - c.w) / 2, 5);
  });
});
