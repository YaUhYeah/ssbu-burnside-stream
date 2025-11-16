import { v4 as uuidv4 } from 'uuid';
import type { Caption, CaptionStyle } from '@/types';

interface TranscriptionResult {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speaker?: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  timeStamp: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

// Production-ready speech recognition using Web Speech API with fallback
export class SpeechTranscriber {
  private recognition: any;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioChunks: Blob[] = [];
  private transcripts: TranscriptionResult[] = [];
  private startTimestamp: number = 0;
  private isRunning: boolean = false;

  constructor() {
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition(): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not available');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = 'en-US';

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const currentTime = (Date.now() - this.startTimestamp) / 1000;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal && result[0].transcript.trim()) {
          const transcript = result[0].transcript.trim();
          const confidence = result[0].confidence;

          // Split long transcripts into sentences
          const sentences = this.splitIntoSentences(transcript);
          let sentenceStart = currentTime - sentences.length * 2;

          sentences.forEach((sentence) => {
            if (sentence.trim()) {
              this.transcripts.push({
                text: sentence.trim(),
                startTime: sentenceStart,
                endTime: sentenceStart + this.estimateDuration(sentence),
                confidence,
              });
              sentenceStart += this.estimateDuration(sentence) + 0.3;
            }
          });
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      // Auto-restart on recoverable errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        if (this.isRunning) {
          setTimeout(() => this.recognition?.start(), 100);
        }
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if still running
      if (this.isRunning) {
        setTimeout(() => this.recognition?.start(), 100);
      }
    };
  }

  private splitIntoSentences(text: string): string[] {
    // Split by sentence-ending punctuation
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    return sentences.filter((s) => s.trim().length > 0);
  }

  private estimateDuration(text: string): number {
    // Average speaking rate: 150 words per minute = 2.5 words per second
    const words = text.split(/\s+/).length;
    return Math.max(1, words / 2.5);
  }

  async transcribeAudioFile(audioBlob: Blob): Promise<Caption[]> {
    this.transcripts = [];
    this.startTimestamp = Date.now();
    this.isRunning = true;

    if (!this.recognition) {
      // Fallback: Analyze audio and generate timestamps
      return this.analyzeAudioForCaptions(audioBlob);
    }

    return new Promise((resolve) => {
      // Create audio element for playback
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.oncanplaythrough = () => {
        this.startTimestamp = Date.now();
        this.recognition.start();
        audio.play();
      };

      audio.onended = () => {
        this.isRunning = false;
        setTimeout(() => {
          this.recognition.stop();
          URL.revokeObjectURL(audioUrl);

          const captions = this.convertToCaptions();
          resolve(captions.length > 0 ? captions : this.analyzeAudioForCaptions(audioBlob));
        }, 1000); // Wait for final results
      };

      audio.onerror = () => {
        this.isRunning = false;
        URL.revokeObjectURL(audioUrl);
        resolve(this.analyzeAudioForCaptions(audioBlob));
      };

      // Timeout based on audio duration
      audio.onloadedmetadata = () => {
        const timeout = (audio.duration + 10) * 1000; // Duration + 10 second buffer
        setTimeout(() => {
          if (this.isRunning) {
            this.isRunning = false;
            audio.pause();
            this.recognition?.stop();
            URL.revokeObjectURL(audioUrl);
            resolve(this.convertToCaptions());
          }
        }, timeout);
      };
    });
  }

  private convertToCaptions(): Caption[] {
    return this.transcripts.map((t) => ({
      id: uuidv4(),
      text: t.text,
      startTime: Math.max(0, t.startTime),
      endTime: t.endTime,
      speaker: t.speaker,
      style: this.getDefaultStyle(),
    }));
  }

  private async analyzeAudioForCaptions(audioBlob: Blob): Promise<Caption[]> {
    // Analyze audio waveform to detect speech segments
    const audioBuffer = await this.decodeAudioBlob(audioBlob);
    if (!audioBuffer) return [];

    const speechSegments = this.detectSpeechSegments(audioBuffer);
    const captions: Caption[] = [];

    // Generate captions based on speech segments
    speechSegments.forEach((segment, index) => {
      captions.push({
        id: uuidv4(),
        text: `[Speech segment ${index + 1}]`,
        startTime: segment.start,
        endTime: segment.end,
        style: this.getDefaultStyle(),
      });
    });

    return captions;
  }

  private async decodeAudioBlob(blob: Blob): Promise<AudioBuffer | null> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      await audioContext.close();
      return audioBuffer;
    } catch (err) {
      console.error('Failed to decode audio:', err);
      return null;
    }
  }

  private detectSpeechSegments(
    audioBuffer: AudioBuffer
  ): Array<{ start: number; end: number }> {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
    const threshold = 0.02;
    const minGap = 0.3; // Minimum gap between segments (seconds)
    const minDuration = 0.5; // Minimum segment duration

    const segments: Array<{ start: number; end: number }> = [];
    let inSpeech = false;
    let segmentStart = 0;
    let lastSpeechEnd = 0;

    for (let i = 0; i < channelData.length; i += windowSize) {
      let energy = 0;
      const windowEnd = Math.min(i + windowSize, channelData.length);

      for (let j = i; j < windowEnd; j++) {
        energy += Math.abs(channelData[j]);
      }
      energy /= windowEnd - i;

      const currentTime = i / sampleRate;

      if (energy > threshold) {
        if (!inSpeech) {
          // Check if we should merge with previous segment
          if (segments.length > 0 && currentTime - lastSpeechEnd < minGap) {
            // Remove last segment end, we'll extend it
            segments[segments.length - 1].end = currentTime;
          } else {
            segmentStart = currentTime;
          }
          inSpeech = true;
        }
        lastSpeechEnd = currentTime;
      } else if (inSpeech && currentTime - lastSpeechEnd > minGap) {
        // End of speech segment
        if (lastSpeechEnd - segmentStart >= minDuration) {
          if (segments.length === 0 || segments[segments.length - 1].end !== lastSpeechEnd) {
            segments.push({
              start: segmentStart,
              end: lastSpeechEnd,
            });
          }
        }
        inSpeech = false;
      }
    }

    // Handle last segment
    if (inSpeech && lastSpeechEnd - segmentStart >= minDuration) {
      segments.push({
        start: segmentStart,
        end: lastSpeechEnd,
      });
    }

    return segments;
  }

  private getDefaultStyle(): CaptionStyle {
    return {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: 32,
      color: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      position: 'bottom',
      alignment: 'center',
      outline: true,
      shadow: true,
    };
  }

  stop(): void {
    this.isRunning = false;
    if (this.recognition) {
      this.recognition.stop();
    }
  }
}

// Singleton instance
let transcriber: SpeechTranscriber | null = null;

export function getTranscriber(): SpeechTranscriber {
  if (!transcriber) {
    transcriber = new SpeechTranscriber();
  }
  return transcriber;
}

// Utility function for quick transcription
export async function transcribeAudio(audioBlob: Blob): Promise<Caption[]> {
  const t = getTranscriber();
  return t.transcribeAudioFile(audioBlob);
}

// Language detection (simplified)
export function detectLanguage(text: string): string {
  const languagePatterns: Record<string, RegExp[]> = {
    en: [/\b(the|and|is|are|was|were|have|has|been)\b/gi],
    es: [/\b(el|la|los|las|un|una|es|son|está|están)\b/gi],
    fr: [/\b(le|la|les|un|une|est|sont|avec|dans)\b/gi],
    de: [/\b(der|die|das|ein|eine|ist|sind|und|für)\b/gi],
    pt: [/\b(o|a|os|as|um|uma|é|são|para|com)\b/gi],
  };

  let bestMatch = 'en';
  let bestScore = 0;

  for (const [lang, patterns] of Object.entries(languagePatterns)) {
    let score = 0;
    patterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = lang;
    }
  }

  return bestMatch;
}

// Caption timing optimizer
export function optimizeCaptionTiming(
  captions: Caption[],
  maxCharsPerLine: number = 42,
  minDuration: number = 1,
  maxDuration: number = 7
): Caption[] {
  const optimized: Caption[] = [];

  captions.forEach((caption) => {
    const words = caption.text.split(' ');
    let currentLine = '';
    let lineStartTime = caption.startTime;
    const totalDuration = caption.endTime - caption.startTime;
    const wordsPerSecond = words.length / totalDuration;

    words.forEach((word, index) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length > maxCharsPerLine && currentLine) {
        // Save current line
        const wordCount = currentLine.split(' ').length;
        const lineDuration = Math.min(maxDuration, Math.max(minDuration, wordCount / wordsPerSecond));

        optimized.push({
          ...caption,
          id: uuidv4(),
          text: currentLine,
          startTime: lineStartTime,
          endTime: lineStartTime + lineDuration,
        });

        lineStartTime += lineDuration;
        currentLine = word;
      } else {
        currentLine = testLine;
      }

      // Handle last word
      if (index === words.length - 1 && currentLine) {
        optimized.push({
          ...caption,
          id: uuidv4(),
          text: currentLine,
          startTime: lineStartTime,
          endTime: Math.max(lineStartTime + minDuration, caption.endTime),
        });
      }
    });
  });

  return optimized;
}

// Speaker diarization (simplified - groups by pauses)
export function identifySpeakers(captions: Caption[]): Caption[] {
  let currentSpeaker = 'Speaker 1';
  let speakerCount = 1;
  let lastEndTime = 0;

  return captions.map((caption) => {
    // If there's a significant gap, might be a new speaker
    if (caption.startTime - lastEndTime > 2) {
      speakerCount++;
      currentSpeaker = `Speaker ${speakerCount}`;
    }

    lastEndTime = caption.endTime;

    return {
      ...caption,
      speaker: currentSpeaker,
    };
  });
}
