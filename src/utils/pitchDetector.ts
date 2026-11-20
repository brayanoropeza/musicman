import { NotationSystem } from "../types/song";

const AMERICAN_CHROMATIC = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const LATIN_CHROMATIC = [
  "Do",
  "Do#",
  "Re",
  "Re#",
  "Mi",
  "Fa",
  "Fa#",
  "Sol",
  "Sol#",
  "La",
  "La#",
  "Si",
];

export interface DetectedPitch {
  frequency: number | null;
  noteName: string | null;
  pitchClassAmerican: string | null;
  clarity: number; // 0..1 periodicity (high = singing voice, low = percussive strum/noise)
}

/**
 * Fast normalized autocorrelation pitch detector tuned for human singing (85 Hz - 750 Hz).
 * Distinguishes clear monophonic singing notes from polyphonic guitar strums / room noise.
 */
export function detectVocalPitch(
  buffer: Float32Array,
  sampleRate: number,
  notation: NotationSystem
): DetectedPitch {
  const n = buffer.length;
  let rms = 0;
  for (let i = 0; i < n; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / n);

  if (rms < 0.008) {
    return {
      frequency: null,
      noteName: null,
      pitchClassAmerican: null,
      clarity: 0,
    };
  }

  const minLag = Math.max(16, Math.floor(sampleRate / 750));
  const maxLag = Math.min(Math.floor(n / 2), Math.floor(sampleRate / 85));

  let bestLag = -1;
  let bestCorr = 0;

  // Step by 2 first for speed, then refine locally
  const corrValues = new Float32Array(maxLag + 2);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let energyA = 0;
    let energyB = 0;
    const limit = n - lag;
    for (let i = 0; i < limit; i += 2) {
      const a = buffer[i];
      const b = buffer[i + lag];
      sum += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const denom = Math.sqrt(energyA * energyB);
    const corr = denom > 1e-8 ? sum / denom : 0;
    corrValues[lag] = corr;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Prefer the fundamental frequency (first local peak >= 88% of global max) to avoid octave errors
  if (bestCorr > 0.55) {
    const threshold = bestCorr * 0.88;
    for (let lag = minLag + 1; lag < maxLag - 1; lag++) {
      if (
        corrValues[lag] >= threshold &&
        corrValues[lag] >= corrValues[lag - 1] &&
        corrValues[lag] >= corrValues[lag + 1]
      ) {
        bestLag = lag;
        bestCorr = corrValues[lag];
        break;
      }
    }
  }

  if (bestLag <= 0 || bestCorr < 0.52) {
    return {
      frequency: null,
      noteName: null,
      pitchClassAmerican: null,
      clarity: Math.max(0, bestCorr),
    };
  }

  // Parabolic interpolation for sub-sample frequency accuracy
  const y1 = corrValues[bestLag - 1] ?? bestCorr;
  const y2 = bestCorr;
  const y3 = corrValues[bestLag + 1] ?? bestCorr;
  const shiftDenom = 2 * (y1 - 2 * y2 + y3);
  const shift =
    Math.abs(shiftDenom) > 1e-6 ? (y1 - y3) / shiftDenom : 0;
  const refinedLag = bestLag + Math.max(-0.5, Math.min(0.5, shift));

  const frequency = sampleRate / refinedLag;
  if (!Number.isFinite(frequency) || frequency < 80 || frequency > 800) {
    return {
      frequency: null,
      noteName: null,
      pitchClassAmerican: null,
      clarity: bestCorr,
    };
  }

  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const pitchIdx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const pitchClassAmerican = AMERICAN_CHROMATIC[pitchIdx];
  const label =
    notation === "latin"
      ? LATIN_CHROMATIC[pitchIdx]
      : AMERICAN_CHROMATIC[pitchIdx];

  return {
    frequency: Math.round(frequency),
    noteName: `${label}${octave}`,
    pitchClassAmerican,
    clarity: bestCorr,
  };
}
