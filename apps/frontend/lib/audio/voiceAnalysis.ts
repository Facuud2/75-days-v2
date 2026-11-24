export type VoiceActivity = 'speaking' | 'silence';

export interface VoiceFrameAnalysis {
  /** Raw root mean square of the time-domain waveform, normalized to 0..1. */
  rms: number;
  /** Noise-gated visual level, normalized to 0..1. */
  level: number;
  /** Approximate 0–750 Hz energy, normalized to 0..1. */
  low: number;
  /** Approximate 750–3,000 Hz energy, normalized to 0..1. */
  mid: number;
  /** Approximate 3,000–8,000 Hz energy, normalized to 0..1. */
  high: number;
  /** Log-spaced spectrum buckets for the voice visualizer. */
  bands: readonly number[];
}

export interface VoiceVadThresholds {
  activate: number;
  release: number;
}

const BYTE_WAVEFORM_CENTER = 128;
const BYTE_WAVEFORM_RANGE = 128;
const FREQUENCY_NOISE_FLOOR = 6;
const FREQUENCY_VISUAL_RANGE = 164;

export const VOICE_VISUAL_BAND_COUNT = 16;
export const INITIAL_VOICE_NOISE_FLOOR = 0.008;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function calculateRms(samples: Uint8Array): number {
  if (samples.length === 0) return 0;

  let sumSquares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = (samples[index] - BYTE_WAVEFORM_CENTER) / BYTE_WAVEFORM_RANGE;
    sumSquares += centered * centered;
  }

  return clamp01(Math.sqrt(sumSquares / samples.length));
}

function normalizeFrequencyByte(value: number): number {
  return clamp01((value - FREQUENCY_NOISE_FLOOR) / FREQUENCY_VISUAL_RANGE);
}

export function averageFrequencyRange(
  frequencyData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  startHz: number,
  endHz: number
): number {
  if (frequencyData.length === 0 || sampleRate <= 0 || fftSize <= 0 || endHz <= startHz) {
    return 0;
  }

  const binWidth = sampleRate / fftSize;
  const firstUsableBin = frequencyData.length > 1 ? 1 : 0;
  const startIndex = Math.max(firstUsableBin, Math.ceil(startHz / binWidth));
  const endIndex = Math.min(
    frequencyData.length - 1,
    Math.max(startIndex, Math.ceil(endHz / binWidth) - 1)
  );

  if (startIndex >= frequencyData.length) return 0;

  let sum = 0;
  let count = 0;
  for (let index = startIndex; index <= endIndex; index += 1) {
    sum += normalizeFrequencyByte(frequencyData[index]);
    count += 1;
  }

  return count > 0 ? clamp01(sum / count) : 0;
}

export function buildVoiceVisualizerBands(
  frequencyData: Uint8Array,
  bandCount = VOICE_VISUAL_BAND_COUNT
): readonly number[] {
  if (bandCount <= 0) return [];
  if (frequencyData.length <= 1) return Array.from({ length: bandCount }, () => 0);

  const usableBins = frequencyData.length - 1;
  return Array.from({ length: bandCount }, (_, bandIndex) => {
    // Log spacing gives the speech-heavy lower spectrum enough visual resolution.
    const startRatio = bandIndex / bandCount;
    const endRatio = (bandIndex + 1) / bandCount;
    const startIndex = Math.max(1, Math.floor(Math.pow(usableBins, startRatio)));
    const endIndex = Math.min(
      frequencyData.length - 1,
      Math.max(startIndex, Math.ceil(Math.pow(usableBins, endRatio)))
    );

    let sum = 0;
    let count = 0;
    for (let index = startIndex; index <= endIndex; index += 1) {
      sum += normalizeFrequencyByte(frequencyData[index]);
      count += 1;
    }
    return count > 0 ? clamp01(sum / count) : 0;
  });
}

export function getVoiceVadThresholds(noiseFloor: number): VoiceVadThresholds {
  const safeNoiseFloor = clamp01(noiseFloor);
  return {
    activate: Math.min(0.18, Math.max(0.028, safeNoiseFloor * 2.4 + 0.008)),
    release: Math.min(0.12, Math.max(0.016, safeNoiseFloor * 1.6 + 0.004)),
  };
}

export function updateVoiceNoiseFloor(current: number, rms: number): number {
  // Ignore obvious speech while learning the room floor. The slow EMA adapts to
  // fans and street noise without chasing syllables.
  const boundedSample = Math.min(0.08, Math.max(0.002, rms));
  return current * 0.96 + boundedSample * 0.04;
}

export function analyseVoiceFrame(
  timeDomainData: Uint8Array,
  frequencyData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  noiseFloor: number
): VoiceFrameAnalysis {
  const rms = calculateRms(timeDomainData);
  const low = averageFrequencyRange(frequencyData, sampleRate, fftSize, 0, 750);
  const mid = averageFrequencyRange(frequencyData, sampleRate, fftSize, 750, 3_000);
  const high = averageFrequencyRange(frequencyData, sampleRate, fftSize, 3_000, 8_000);
  const visualFloor = Math.max(0.008, noiseFloor * 1.15);
  const level = clamp01((rms - visualFloor) / 0.24);

  return {
    rms,
    level,
    low,
    mid,
    high,
    bands: buildVoiceVisualizerBands(frequencyData),
  };
}
