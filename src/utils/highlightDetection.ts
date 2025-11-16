import { v4 as uuidv4 } from 'uuid';
import type { Highlight } from '@/types';

interface AudioFeatures {
  rms: number[];
  zcr: number[];
  spectralCentroid: number[];
  timestamps: number[];
}

// Advanced highlight detection using multiple audio features
export class HighlightDetector {
  private sampleRate: number = 44100;
  private windowSize: number = 2048;
  private hopSize: number = 512;

  async detectHighlights(
    audioBuffer: AudioBuffer,
    options: {
      minDuration?: number;
      maxHighlights?: number;
      sensitivity?: number;
    } = {}
  ): Promise<Highlight[]> {
    const {
      minDuration = 3,
      maxHighlights = 10,
      sensitivity = 0.7,
    } = options;

    this.sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    // Extract audio features
    const features = this.extractFeatures(channelData);

    // Detect highlight candidates
    const candidates = this.findHighlightCandidates(features, sensitivity);

    // Merge overlapping highlights
    const merged = this.mergeHighlights(candidates, minDuration);

    // Score and rank highlights
    const scored = this.scoreHighlights(merged, features);

    // Return top highlights
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxHighlights)
      .sort((a, b) => a.startTime - b.startTime);
  }

  private extractFeatures(channelData: Float32Array): AudioFeatures {
    const rms: number[] = [];
    const zcr: number[] = [];
    const spectralCentroid: number[] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < channelData.length - this.windowSize; i += this.hopSize) {
      const window = channelData.slice(i, i + this.windowSize);
      const time = i / this.sampleRate;

      // RMS (Root Mean Square) - energy
      let sumSquares = 0;
      for (let j = 0; j < window.length; j++) {
        sumSquares += window[j] * window[j];
      }
      rms.push(Math.sqrt(sumSquares / window.length));

      // Zero Crossing Rate - speech vs music indicator
      let crossings = 0;
      for (let j = 1; j < window.length; j++) {
        if ((window[j] >= 0 && window[j - 1] < 0) || (window[j] < 0 && window[j - 1] >= 0)) {
          crossings++;
        }
      }
      zcr.push(crossings / window.length);

      // Spectral Centroid (simplified) - brightness
      const magnitude = this.computeMagnitudeSpectrum(window);
      let weightedSum = 0;
      let totalMagnitude = 0;
      for (let j = 0; j < magnitude.length; j++) {
        weightedSum += j * magnitude[j];
        totalMagnitude += magnitude[j];
      }
      spectralCentroid.push(totalMagnitude > 0 ? weightedSum / totalMagnitude : 0);

      timestamps.push(time);
    }

    return { rms, zcr, spectralCentroid, timestamps };
  }

  private computeMagnitudeSpectrum(signal: Float32Array): Float32Array {
    // Simplified DFT for first N/2 bins
    const N = signal.length;
    const halfN = Math.floor(N / 2);
    const magnitude = new Float32Array(halfN);

    for (let k = 0; k < halfN; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        real += signal[n] * Math.cos(angle);
        imag -= signal[n] * Math.sin(angle);
      }
      magnitude[k] = Math.sqrt(real * real + imag * imag);
    }

    return magnitude;
  }

  private findHighlightCandidates(
    features: AudioFeatures,
    sensitivity: number
  ): Array<{ start: number; end: number; score: number }> {
    const candidates: Array<{ start: number; end: number; score: number }> = [];

    // Normalize features
    const normalizedRMS = this.normalize(features.rms);
    const normalizedZCR = this.normalize(features.zcr);
    const normalizedSC = this.normalize(features.spectralCentroid);

    // Compute combined excitement score
    const excitement: number[] = [];
    for (let i = 0; i < normalizedRMS.length; i++) {
      // High energy + moderate ZCR (speech) + high spectral brightness = exciting
      const score =
        normalizedRMS[i] * 0.5 +
        (1 - Math.abs(normalizedZCR[i] - 0.5)) * 0.3 +
        normalizedSC[i] * 0.2;
      excitement.push(score);
    }

    // Find peaks above threshold
    const threshold = sensitivity;
    let inHighlight = false;
    let highlightStart = 0;
    let peakScore = 0;

    for (let i = 0; i < excitement.length; i++) {
      if (excitement[i] > threshold && !inHighlight) {
        inHighlight = true;
        highlightStart = features.timestamps[i];
        peakScore = excitement[i];
      } else if (excitement[i] > threshold && inHighlight) {
        peakScore = Math.max(peakScore, excitement[i]);
      } else if (excitement[i] <= threshold && inHighlight) {
        inHighlight = false;
        candidates.push({
          start: highlightStart,
          end: features.timestamps[i],
          score: peakScore,
        });
      }
    }

    // Handle last highlight
    if (inHighlight) {
      candidates.push({
        start: highlightStart,
        end: features.timestamps[features.timestamps.length - 1],
        score: peakScore,
      });
    }

    return candidates;
  }

  private normalize(values: number[]): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) return values.map(() => 0.5);

    return values.map((v) => (v - min) / range);
  }

  private mergeHighlights(
    candidates: Array<{ start: number; end: number; score: number }>,
    minDuration: number
  ): Array<{ start: number; end: number; score: number }> {
    if (candidates.length === 0) return [];

    const merged: Array<{ start: number; end: number; score: number }> = [];
    let current = { ...candidates[0] };

    for (let i = 1; i < candidates.length; i++) {
      const next = candidates[i];

      // Merge if overlap or very close
      if (next.start - current.end < 1) {
        current.end = next.end;
        current.score = Math.max(current.score, next.score);
      } else {
        // Save current if long enough
        if (current.end - current.start >= minDuration) {
          merged.push(current);
        }
        current = { ...next };
      }
    }

    // Add last highlight
    if (current.end - current.start >= minDuration) {
      merged.push(current);
    }

    return merged;
  }

  private scoreHighlights(
    highlights: Array<{ start: number; end: number; score: number }>,
    features: AudioFeatures
  ): Highlight[] {
    return highlights.map((h) => {
      // Calculate average features within highlight
      let avgRMS = 0;
      let avgZCR = 0;
      let count = 0;

      for (let i = 0; i < features.timestamps.length; i++) {
        const t = features.timestamps[i];
        if (t >= h.start && t <= h.end) {
          avgRMS += features.rms[i];
          avgZCR += features.zcr[i];
          count++;
        }
      }

      if (count > 0) {
        avgRMS /= count;
        avgZCR /= count;
      }

      // Determine highlight type
      let type: 'audio-peak' | 'motion' | 'face-emotion' | 'combined' = 'audio-peak';
      if (avgZCR > 0.1) {
        type = 'combined'; // High ZCR indicates rapid changes
      }

      return {
        id: uuidv4(),
        startTime: h.start,
        endTime: h.end,
        score: h.score,
        type,
      };
    });
  }
}

// Video-based highlight detection
export async function detectMotionHighlights(
  frames: ImageData[],
  fps: number = 30
): Promise<Highlight[]> {
  if (frames.length < 2) return [];

  const highlights: Highlight[] = [];
  const motionScores: number[] = [];

  // Calculate motion between consecutive frames
  for (let i = 1; i < frames.length; i++) {
    const motion = calculateOpticalFlowMagnitude(frames[i - 1], frames[i]);
    motionScores.push(motion);
  }

  // Find high motion segments
  const threshold = calculateAdaptiveThreshold(motionScores, 0.8);
  let inHighlight = false;
  let highlightStart = 0;
  let peakMotion = 0;

  for (let i = 0; i < motionScores.length; i++) {
    const time = i / fps;

    if (motionScores[i] > threshold && !inHighlight) {
      inHighlight = true;
      highlightStart = time;
      peakMotion = motionScores[i];
    } else if (motionScores[i] > threshold && inHighlight) {
      peakMotion = Math.max(peakMotion, motionScores[i]);
    } else if (motionScores[i] <= threshold && inHighlight) {
      inHighlight = false;
      if (time - highlightStart >= 2) {
        highlights.push({
          id: uuidv4(),
          startTime: highlightStart,
          endTime: time,
          score: peakMotion,
          type: 'motion',
        });
      }
    }
  }

  return highlights;
}

function calculateOpticalFlowMagnitude(frame1: ImageData, frame2: ImageData): number {
  const width = frame1.width;
  const height = frame1.height;
  const blockSize = 16;

  let totalMotion = 0;
  let blocks = 0;

  for (let y = 0; y < height - blockSize; y += blockSize) {
    for (let x = 0; x < width - blockSize; x += blockSize) {
      const motion = computeBlockMotion(frame1, frame2, x, y, blockSize);
      totalMotion += motion;
      blocks++;
    }
  }

  return blocks > 0 ? totalMotion / blocks : 0;
}

function computeBlockMotion(
  frame1: ImageData,
  frame2: ImageData,
  x: number,
  y: number,
  blockSize: number
): number {
  let diff = 0;
  const width = frame1.width;

  for (let dy = 0; dy < blockSize; dy++) {
    for (let dx = 0; dx < blockSize; dx++) {
      const idx = ((y + dy) * width + (x + dx)) * 4;
      const gray1 = (frame1.data[idx] + frame1.data[idx + 1] + frame1.data[idx + 2]) / 3;
      const gray2 = (frame2.data[idx] + frame2.data[idx + 1] + frame2.data[idx + 2]) / 3;
      diff += Math.abs(gray1 - gray2);
    }
  }

  return diff / (blockSize * blockSize * 255);
}

function calculateAdaptiveThreshold(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * percentile);
  return sorted[Math.min(index, sorted.length - 1)];
}

// Combined highlight detection
export async function detectCombinedHighlights(
  audioBuffer: AudioBuffer,
  frames: ImageData[],
  fps: number = 30
): Promise<Highlight[]> {
  const audioDetector = new HighlightDetector();
  const audioHighlights = await audioDetector.detectHighlights(audioBuffer);
  const motionHighlights = await detectMotionHighlights(frames, fps);

  // Combine and merge overlapping highlights
  const allHighlights = [...audioHighlights, ...motionHighlights];

  // Sort by start time
  allHighlights.sort((a, b) => a.startTime - b.startTime);

  // Merge overlapping
  const merged: Highlight[] = [];
  let current = allHighlights[0];

  for (let i = 1; i < allHighlights.length; i++) {
    const next = allHighlights[i];

    if (next.startTime <= current.endTime) {
      // Overlapping - merge
      current = {
        id: uuidv4(),
        startTime: current.startTime,
        endTime: Math.max(current.endTime, next.endTime),
        score: (current.score + next.score) / 2,
        type: 'combined',
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  if (current) {
    merged.push(current);
  }

  // Score combined highlights higher
  return merged.map((h) => ({
    ...h,
    score: h.type === 'combined' ? h.score * 1.5 : h.score,
  }));
}

// Singleton instance
let highlightDetector: HighlightDetector | null = null;

export function getHighlightDetector(): HighlightDetector {
  if (!highlightDetector) {
    highlightDetector = new HighlightDetector();
  }
  return highlightDetector;
}
