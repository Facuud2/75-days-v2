import { describe, expect, it } from 'vitest';
import {
  clampOffset,
  computeSourceCropArea,
  getCoverScale,
  getMaxOffset,
} from '@/lib/utils/cropImage';

describe('cropImage utilities', () => {
  it('calculates cover scale so the image always fills the crop box', () => {
    // Portrait 800x1600 inside 300x100 banner (3:1): limited by width
    expect(getCoverScale(800, 1600, 300, 100)).toBeCloseTo(300 / 800);
    // Wide 2400x400 inside 300x100 banner: limited by height
    expect(getCoverScale(2400, 400, 300, 100)).toBeCloseTo(100 / 400);
    // Square 1000x1000 inside 200x200 avatar
    expect(getCoverScale(1000, 1000, 200, 200)).toBeCloseTo(0.2);
  });

  it('clamps pan offsets within the rendered image bounds', () => {
    // Portrait 1000x2000 in 300x100 banner at zoom 1:
    // baseScale = 0.3 -> renderedWidth = 300 (maxOffsetX = 0), renderedHeight = 600 (maxOffsetY = 250)
    const bounds = getMaxOffset({
      imageWidth: 1000,
      imageHeight: 2000,
      cropWidth: 300,
      cropHeight: 100,
      zoom: 1,
    });
    expect(bounds.maxOffsetX).toBeCloseTo(0);
    expect(bounds.maxOffsetY).toBeCloseTo(250);

    const clamped = clampOffset(120, -999, {
      imageWidth: 1000,
      imageHeight: 2000,
      cropWidth: 300,
      cropHeight: 100,
      zoom: 1,
    });
    expect(clamped.offsetX).toBeCloseTo(0);
    expect(clamped.offsetY).toBeCloseTo(-250);
  });

  it('computes exact source crop coordinates for centered, panned, and zoomed states', () => {
    // 1000x2000 portrait image in 300x100 (3:1) banner at zoom 1
    // At zoom 1, sWidth = 1000, sHeight = 333.333...
    const centered = computeSourceCropArea({
      imageWidth: 1000,
      imageHeight: 2000,
      cropWidth: 300,
      cropHeight: 100,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
    expect(centered.sx).toBeCloseTo(0);
    expect(centered.sWidth).toBeCloseTo(1000);
    expect(centered.sHeight).toBeCloseTo(1000 / 3);
    expect(centered.sy).toBeCloseTo((2000 - 1000 / 3) / 2);

    // Dragging image down (+offsetY = +250) reveals the very top of the image (sy = 0)
    const topEdge = computeSourceCropArea({
      imageWidth: 1000,
      imageHeight: 2000,
      cropWidth: 300,
      cropHeight: 100,
      zoom: 1,
      offsetX: 0,
      offsetY: 250,
    });
    expect(topEdge.sy).toBeCloseTo(0);

    // Dragging image up (-offsetY = -250) reveals the very bottom (sy + sHeight = 2000)
    const bottomEdge = computeSourceCropArea({
      imageWidth: 1000,
      imageHeight: 2000,
      cropWidth: 300,
      cropHeight: 100,
      zoom: 1,
      offsetX: 0,
      offsetY: -250,
    });
    expect(bottomEdge.sy + bottomEdge.sHeight).toBeCloseTo(2000);

    // Zoom 2x halves source crop dimensions while preserving 3:1 aspect ratio
    const zoomed = computeSourceCropArea({
      imageWidth: 1000,
      imageHeight: 2000,
      cropWidth: 300,
      cropHeight: 100,
      zoom: 2,
      offsetX: 0,
      offsetY: 0,
    });
    expect(zoomed.sWidth).toBeCloseTo(500);
    expect(zoomed.sHeight).toBeCloseTo(500 / 3);
  });
});
