import { describe, expect, it } from 'vitest';
import {
  analyseVoiceFrame,
  averageFrequencyRange,
  buildVoiceVisualizerBands,
  calculateRms,
  getVoiceVadThresholds,
  updateVoiceNoiseFloor,
} from '@/lib/audio/voiceAnalysis';

describe('voice analysis', () => {
  it('computes RMS from centered byte-domain samples', () => {
    expect(calculateRms(new Uint8Array([128, 128, 128, 128]))).toBe(0);
    expect(calculateRms(new Uint8Array([64, 192, 64, 192]))).toBeCloseTo(0.5, 5);
  });

  it('aggregates real frequency ranges instead of sampling one FFT bin', () => {
    const spectrum = new Uint8Array(64);
    spectrum.fill(22, 1, 8); // low: 100–700 Hz
    spectrum.fill(92, 8, 30); // mid: 800–2,900 Hz
    spectrum.fill(48, 30); // high: 3,000 Hz+

    const low = averageFrequencyRange(spectrum, 12_800, 128, 0, 750);
    const mid = averageFrequencyRange(spectrum, 12_800, 128, 750, 3_000);
    const high = averageFrequencyRange(spectrum, 12_800, 128, 3_000, 8_000);

    expect(mid).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(low);
  });

  it('returns explicit RMS, low/mid/high energy, and sixteen bounded visual bands', () => {
    const waveform = new Uint8Array(128);
    waveform.forEach((_, index) => {
      waveform[index] = index % 2 === 0 ? 112 : 144;
    });
    const spectrum = new Uint8Array(64).fill(70);

    const result = analyseVoiceFrame(waveform, spectrum, 12_800, 128, 0.008);

    expect(result.rms).toBeCloseTo(0.125, 5);
    expect(result.level).toBeGreaterThan(0);
    expect(result.low).toBeGreaterThan(0);
    expect(result.mid).toBeGreaterThan(0);
    expect(result.high).toBeGreaterThan(0);
    expect(result.bands).toHaveLength(16);
    expect(result.bands.every((band) => band >= 0 && band <= 1)).toBe(true);
  });

  it('uses adaptive attack and release thresholds with hysteresis headroom', () => {
    const quiet = getVoiceVadThresholds(0.008);
    const noisy = getVoiceVadThresholds(0.04);

    expect(quiet.activate).toBeGreaterThan(quiet.release);
    expect(noisy.activate).toBeGreaterThan(quiet.activate);
    expect(noisy.release).toBeGreaterThan(quiet.release);
    expect(updateVoiceNoiseFloor(0.008, 0.02)).toBeGreaterThan(0.008);
  });

  it('keeps visual band generation deterministic for empty input', () => {
    expect(buildVoiceVisualizerBands(new Uint8Array(), 4)).toEqual([0, 0, 0, 0]);
  });
});
