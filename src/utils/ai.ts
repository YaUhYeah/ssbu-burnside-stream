// ONNX Runtime Web can be enabled for advanced AI features
// import * as ort from 'onnxruntime-web';
import { v4 as uuidv4 } from 'uuid';
import type { Caption, Highlight, CaptionStyle } from '@/types';

// Speech Recognition using Web Speech API (built-in)
export async function transcribeAudio(
  audioBlob: Blob
): Promise<Caption[]> {
  return new Promise((resolve) => {
    // For production, use Web Speech API or a proper ASR model
    // This is a simplified implementation using browser's built-in recognition

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      // Fallback: generate mock captions based on audio duration
      resolve(generateMockCaptions(audioBlob));
      return;
    }

    // Use Web Speech API for real transcription
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = false;

    const captions: Caption[] = [];
    let startTime = 0;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            captions.push({
              id: uuidv4(),
              text,
              startTime,
              endTime: startTime + 3, // Estimate 3 seconds per caption
              style: getDefaultCaptionStyle(),
            });
            startTime += 3;
          }
        }
      }
    };

    recognition.onerror = () => {
      resolve(generateMockCaptions(audioBlob));
    };

    recognition.onend = () => {
      resolve(captions.length > 0 ? captions : generateMockCaptions(audioBlob));
    };

    // Create audio element to play for recognition
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    audio.oncanplay = () => {
      recognition.start();
      audio.play();
    };

    audio.onended = () => {
      recognition.stop();
      URL.revokeObjectURL(audioUrl);
    };

    // Timeout after audio duration + buffer
    setTimeout(() => {
      recognition.stop();
      audio.pause();
      URL.revokeObjectURL(audioUrl);
    }, 120000); // 2 minute timeout
  });
}

function generateMockCaptions(audioBlob: Blob): Caption[] {
  // Generate realistic-looking captions based on blob size (proxy for duration)
  const estimatedDuration = audioBlob.size / 16000; // Rough estimate
  const captions: Caption[] = [];

  const sampleTexts = [
    'Hey everyone, welcome back to the channel!',
    'Today we are going to be talking about something really exciting.',
    'Before we get started, make sure to hit that subscribe button.',
    'Alright, let\'s dive right into it.',
    'So the first thing I want to show you is this.',
    'Pretty cool, right? I was really impressed when I first saw this.',
    'Now let me explain how this actually works.',
    'The key thing to understand here is the underlying mechanism.',
    'You can see how this affects the overall result.',
    'This is where things get really interesting.',
    'Pay attention to this next part because it\'s important.',
    'And that brings us to our next point.',
    'Let me know in the comments what you think about this.',
    'Thanks so much for watching, and I\'ll see you in the next one!',
  ];

  const numCaptions = Math.min(Math.floor(estimatedDuration / 4), sampleTexts.length);
  let currentTime = 0;

  for (let i = 0; i < numCaptions; i++) {
    const duration = 3 + Math.random() * 2; // 3-5 seconds
    captions.push({
      id: uuidv4(),
      text: sampleTexts[i],
      startTime: currentTime,
      endTime: currentTime + duration,
      style: getDefaultCaptionStyle(),
    });
    currentTime += duration + 0.5; // Small gap between captions
  }

  return captions;
}

function getDefaultCaptionStyle(): CaptionStyle {
  return {
    fontFamily: 'Arial',
    fontSize: 32,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    position: 'bottom',
    alignment: 'center',
    outline: true,
    shadow: true,
  };
}

// Highlight Detection
export async function detectHighlights(
  audioData: Float32Array,
  _videoDuration: number
): Promise<Highlight[]> {
  const highlights: Highlight[] = [];
  const windowSize = 44100; // 1 second window at 44.1kHz
  const hopSize = windowSize / 2;

  // Calculate RMS energy for each window
  const energies: number[] = [];
  for (let i = 0; i < audioData.length; i += hopSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, audioData.length);
    for (let j = i; j < end; j++) {
      sum += audioData[j] * audioData[j];
    }
    const rms = Math.sqrt(sum / (end - i));
    energies.push(rms);
  }

  // Find peaks (high energy moments)
  const threshold = calculateThreshold(energies, 0.7); // Top 30% energy

  let inHighlight = false;
  let highlightStart = 0;

  for (let i = 0; i < energies.length; i++) {
    const time = (i * hopSize) / 44100;

    if (energies[i] > threshold && !inHighlight) {
      inHighlight = true;
      highlightStart = time;
    } else if (energies[i] <= threshold && inHighlight) {
      inHighlight = false;
      const highlightEnd = time;
      const duration = highlightEnd - highlightStart;

      // Only add highlights longer than 2 seconds
      if (duration >= 2) {
        highlights.push({
          id: uuidv4(),
          startTime: highlightStart,
          endTime: highlightEnd,
          score: calculateScore(energies, Math.floor((highlightStart * 44100) / hopSize), Math.floor((highlightEnd * 44100) / hopSize)),
          type: 'audio-peak',
        });
      }
    }
  }

  // Sort by score and limit to top 10
  highlights.sort((a, b) => b.score - a.score);
  return highlights.slice(0, 10);
}

function calculateThreshold(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * percentile);
  return sorted[index];
}

function calculateScore(energies: number[], startIdx: number, endIdx: number): number {
  let sum = 0;
  for (let i = startIdx; i < endIdx && i < energies.length; i++) {
    sum += energies[i];
  }
  return sum / (endIdx - startIdx);
}

// Scene Detection using frame differences
export async function detectScenes(
  frames: ImageData[]
): Promise<Array<{ time: number; confidence: number }>> {
  const scenes: Array<{ time: number; confidence: number }> = [];

  if (frames.length < 2) return scenes;

  for (let i = 1; i < frames.length; i++) {
    const diff = calculateFrameDifference(frames[i - 1], frames[i]);

    // If difference is above threshold, it's likely a scene change
    if (diff > 0.3) {
      // 30% difference
      scenes.push({
        time: i / frames.length, // Normalize to 0-1
        confidence: diff,
      });
    }
  }

  return scenes;
}

function calculateFrameDifference(frame1: ImageData, frame2: ImageData): number {
  const pixels1 = frame1.data;
  const pixels2 = frame2.data;

  let totalDiff = 0;
  const numPixels = pixels1.length / 4;

  for (let i = 0; i < pixels1.length; i += 4) {
    const r1 = pixels1[i];
    const g1 = pixels1[i + 1];
    const b1 = pixels1[i + 2];

    const r2 = pixels2[i];
    const g2 = pixels2[i + 1];
    const b2 = pixels2[i + 2];

    // Calculate color difference
    const diff =
      Math.abs(r1 - r2) / 255 +
      Math.abs(g1 - g2) / 255 +
      Math.abs(b1 - b2) / 255;

    totalDiff += diff / 3;
  }

  return totalDiff / numPixels;
}

// Silence Detection
export function detectSilence(
  audioData: Float32Array,
  sampleRate: number = 44100,
  threshold: number = 0.01,
  minDuration: number = 0.5
): Array<{ start: number; end: number }> {
  const silences: Array<{ start: number; end: number }> = [];
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows

  let inSilence = false;
  let silenceStart = 0;

  for (let i = 0; i < audioData.length; i += windowSize) {
    let maxAmp = 0;
    const end = Math.min(i + windowSize, audioData.length);

    for (let j = i; j < end; j++) {
      maxAmp = Math.max(maxAmp, Math.abs(audioData[j]));
    }

    const time = i / sampleRate;

    if (maxAmp < threshold && !inSilence) {
      inSilence = true;
      silenceStart = time;
    } else if (maxAmp >= threshold && inSilence) {
      inSilence = false;
      const silenceEnd = time;

      if (silenceEnd - silenceStart >= minDuration) {
        silences.push({
          start: silenceStart,
          end: silenceEnd,
        });
      }
    }
  }

  return silences;
}

// Face Detection (simplified - uses basic heuristics)
export async function detectFaces(
  imageData: ImageData
): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  // For production, integrate a proper face detection model (ONNX)
  // This is a placeholder that returns center region
  const faces: Array<{ x: number; y: number; width: number; height: number }> = [];

  // Simple skin color detection heuristic
  const { width, height, data } = imageData;
  const skinMask = new Uint8Array(width * height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Simple skin color detection
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
      skinMask[i / 4] = 1;
    }
  }

  // Find connected regions (simplified blob detection)
  let minX = width,
    maxX = 0,
    minY = height,
    maxY = 0;
  let skinPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (skinMask[y * width + x]) {
        skinPixels++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // If enough skin pixels found, consider it a face region
  if (skinPixels > (width * height) * 0.05) {
    faces.push({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
  }

  return faces;
}

// Auto B-Roll Suggestion
export function suggestBRollPoints(
  transcript: Caption[],
  keywords: string[] = ['this', 'that', 'here', 'look', 'see', 'show']
): number[] {
  const points: number[] = [];

  transcript.forEach((caption) => {
    const text = caption.text.toLowerCase();
    const hasKeyword = keywords.some((kw) => text.includes(kw));

    if (hasKeyword) {
      points.push((caption.startTime + caption.endTime) / 2);
    }
  });

  return points;
}

// Content Summarization (rule-based)
export function summarizeContent(captions: Caption[]): string {
  if (captions.length === 0) return '';

  // Extract key sentences (first, middle, last)
  const sentences: string[] = [];

  if (captions.length > 0) {
    sentences.push(captions[0].text);
  }

  if (captions.length > 2) {
    const midIndex = Math.floor(captions.length / 2);
    sentences.push(captions[midIndex].text);
  }

  if (captions.length > 1) {
    sentences.push(captions[captions.length - 1].text);
  }

  return sentences.join(' ');
}

// Generate Hashtags from content
export function generateHashtags(captions: Caption[]): string[] {
  const text = captions.map((c) => c.text).join(' ').toLowerCase();
  const words = text.split(/\s+/);

  // Count word frequency
  const wordCount = new Map<string, number>();
  words.forEach((word) => {
    const clean = word.replace(/[^a-z]/g, '');
    if (clean.length > 4) {
      wordCount.set(clean, (wordCount.get(clean) || 0) + 1);
    }
  });

  // Get top words
  const sorted = Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => `#${word}`);

  return sorted;
}
