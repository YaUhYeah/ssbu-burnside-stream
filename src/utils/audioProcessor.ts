// Production-ready audio processing utilities

export interface AudioAnalysisResult {
  waveform: number[];
  peaks: number[];
  silences: Array<{ start: number; end: number }>;
  loudness: {
    integrated: number; // LUFS
    range: number; // LU
    truePeak: number; // dBTP
  };
  duration: number;
  sampleRate: number;
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;

  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
  }

  async close(): Promise<void> {
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  async analyzeAudio(audioBlob: Blob): Promise<AudioAnalysisResult> {
    await this.initialize();
    if (!this.audioContext) throw new Error('AudioContext not initialized');

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Generate waveform
    const waveform = this.generateWaveform(channelData, 200);

    // Find peaks
    const peaks = this.findPeaks(channelData, sampleRate);

    // Detect silences
    const silences = this.detectSilences(channelData, sampleRate);

    // Calculate loudness (simplified LUFS calculation)
    const loudness = this.calculateLoudness(channelData, sampleRate);

    return {
      waveform,
      peaks,
      silences,
      loudness,
      duration,
      sampleRate,
    };
  }

  private generateWaveform(channelData: Float32Array, targetBars: number): number[] {
    const samplesPerBar = Math.floor(channelData.length / targetBars);
    const waveform: number[] = [];

    for (let i = 0; i < targetBars; i++) {
      let max = 0;
      const start = i * samplesPerBar;
      const end = Math.min(start + samplesPerBar, channelData.length);

      for (let j = start; j < end; j++) {
        max = Math.max(max, Math.abs(channelData[j]));
      }

      waveform.push(max);
    }

    return waveform;
  }

  private findPeaks(channelData: Float32Array, sampleRate: number): number[] {
    const windowSize = Math.floor(sampleRate * 0.5); // 500ms windows
    const hopSize = Math.floor(windowSize / 2);
    const peaks: number[] = [];

    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let max = 0;
      let maxIdx = i;

      for (let j = i; j < i + windowSize; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) {
          max = abs;
          maxIdx = j;
        }
      }

      if (max > 0.3) {
        // Significant peak
        const time = maxIdx / sampleRate;
        // Avoid duplicates
        if (peaks.length === 0 || time - peaks[peaks.length - 1] > 0.5) {
          peaks.push(time);
        }
      }
    }

    return peaks;
  }

  private detectSilences(
    channelData: Float32Array,
    sampleRate: number
  ): Array<{ start: number; end: number }> {
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
    const threshold = 0.01;
    const minSilenceDuration = 0.5; // seconds

    const silences: Array<{ start: number; end: number }> = [];
    let inSilence = false;
    let silenceStart = 0;

    for (let i = 0; i < channelData.length; i += windowSize) {
      let rms = 0;
      const end = Math.min(i + windowSize, channelData.length);

      for (let j = i; j < end; j++) {
        rms += channelData[j] * channelData[j];
      }
      rms = Math.sqrt(rms / (end - i));

      const currentTime = i / sampleRate;

      if (rms < threshold && !inSilence) {
        inSilence = true;
        silenceStart = currentTime;
      } else if (rms >= threshold && inSilence) {
        inSilence = false;
        const duration = currentTime - silenceStart;

        if (duration >= minSilenceDuration) {
          silences.push({
            start: silenceStart,
            end: currentTime,
          });
        }
      }
    }

    // Handle trailing silence
    if (inSilence) {
      const endTime = channelData.length / sampleRate;
      const duration = endTime - silenceStart;
      if (duration >= minSilenceDuration) {
        silences.push({
          start: silenceStart,
          end: endTime,
        });
      }
    }

    return silences;
  }

  private calculateLoudness(channelData: Float32Array, sampleRate: number): {
    integrated: number;
    range: number;
    truePeak: number;
  } {
    // Simplified LUFS calculation based on ITU-R BS.1770
    const blockSize = Math.floor(sampleRate * 0.4); // 400ms blocks
    const hopSize = Math.floor(sampleRate * 0.1); // 100ms hop

    const blockLoudness: number[] = [];

    for (let i = 0; i < channelData.length - blockSize; i += hopSize) {
      let sum = 0;
      for (let j = i; j < i + blockSize; j++) {
        sum += channelData[j] * channelData[j];
      }
      const meanSquare = sum / blockSize;
      const loudness = -0.691 + 10 * Math.log10(meanSquare + 1e-10);
      blockLoudness.push(loudness);
    }

    // Integrated loudness (mean of blocks above threshold)
    const threshold = -70; // dB
    const validBlocks = blockLoudness.filter((l) => l > threshold);
    const integrated =
      validBlocks.length > 0
        ? validBlocks.reduce((a, b) => a + b, 0) / validBlocks.length
        : -70;

    // Loudness range (simplified)
    validBlocks.sort((a, b) => a - b);
    const low = validBlocks[Math.floor(validBlocks.length * 0.1)] || -70;
    const high = validBlocks[Math.floor(validBlocks.length * 0.9)] || 0;
    const range = high - low;

    // True peak
    let truePeak = 0;
    for (let i = 0; i < channelData.length; i++) {
      truePeak = Math.max(truePeak, Math.abs(channelData[i]));
    }
    const truePeakDB = 20 * Math.log10(truePeak + 1e-10);

    return {
      integrated,
      range,
      truePeak: truePeakDB,
    };
  }

  async applyGain(audioBuffer: AudioBuffer, gainValue: number): Promise<AudioBuffer> {
    const newBuffer = this.audioContext!.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = newBuffer.getChannelData(channel);

      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i] * gainValue;
      }
    }

    return newBuffer;
  }

  async normalizeLoudness(audioBuffer: AudioBuffer, targetLUFS: number = -14): Promise<AudioBuffer> {
    const channelData = audioBuffer.getChannelData(0);
    const currentLoudness = this.calculateLoudness(channelData, audioBuffer.sampleRate);

    // Calculate gain needed
    const gainDB = targetLUFS - currentLoudness.integrated;
    const gainLinear = Math.pow(10, gainDB / 20);

    // Limit gain to prevent clipping
    const maxGain = 1.0 / (Math.abs(currentLoudness.truePeak) / 20 + 1e-10);
    const finalGain = Math.min(gainLinear, maxGain * 0.9);

    return this.applyGain(audioBuffer, finalGain);
  }

  async removeNoise(
    audioBuffer: AudioBuffer,
    noiseProfile?: Float32Array
  ): Promise<AudioBuffer> {
    // Spectral subtraction noise reduction
    const fftSize = 2048;
    const hopSize = fftSize / 4;
    const channelData = audioBuffer.getChannelData(0);

    // Estimate noise profile if not provided
    if (!noiseProfile) {
      noiseProfile = this.estimateNoiseProfile(channelData, fftSize);
    }

    // Apply spectral subtraction
    const outputData = new Float32Array(channelData.length);
    const window = this.createHannWindow(fftSize);

    for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
      const frame = channelData.slice(i, i + fftSize);
      const windowed = new Float32Array(fftSize);

      for (let j = 0; j < fftSize; j++) {
        windowed[j] = frame[j] * window[j];
      }

      // Simple noise reduction: reduce magnitude where noise is high
      const magnitude = this.computeMagnitude(windowed);
      const cleanedMagnitude = new Float32Array(magnitude.length);

      for (let j = 0; j < magnitude.length; j++) {
        cleanedMagnitude[j] = Math.max(0, magnitude[j] - noiseProfile[j] * 2);
      }

      // Convert back to time domain (simplified - phase not preserved perfectly)
      for (let j = 0; j < fftSize; j++) {
        const ratio = cleanedMagnitude[Math.floor(j / 2)] / (magnitude[Math.floor(j / 2)] + 1e-10);
        outputData[i + j] += windowed[j] * ratio * window[j];
      }
    }

    const newBuffer = this.audioContext!.createBuffer(
      1,
      outputData.length,
      audioBuffer.sampleRate
    );
    newBuffer.copyToChannel(outputData, 0);

    return newBuffer;
  }

  private estimateNoiseProfile(channelData: Float32Array, fftSize: number): Float32Array {
    // Use first 500ms as noise estimate
    const noiseLength = Math.min(channelData.length, 22050); // ~500ms at 44.1kHz
    const noiseData = channelData.slice(0, noiseLength);

    const profile = new Float32Array(fftSize / 2);
    let count = 0;

    for (let i = 0; i < noiseLength - fftSize; i += fftSize / 2) {
      const frame = noiseData.slice(i, i + fftSize);
      const magnitude = this.computeMagnitude(frame);

      for (let j = 0; j < magnitude.length; j++) {
        profile[j] += magnitude[j];
      }
      count++;
    }

    for (let j = 0; j < profile.length; j++) {
      profile[j] /= count;
    }

    return profile;
  }

  private computeMagnitude(signal: Float32Array): Float32Array {
    const N = signal.length;
    const magnitude = new Float32Array(N / 2);

    for (let k = 0; k < N / 2; k++) {
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

  private createHannWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return window;
  }

  async applyFade(
    audioBuffer: AudioBuffer,
    fadeInDuration: number,
    fadeOutDuration: number
  ): Promise<AudioBuffer> {
    const newBuffer = this.audioContext!.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const fadeInSamples = Math.floor(fadeInDuration * audioBuffer.sampleRate);
    const fadeOutSamples = Math.floor(fadeOutDuration * audioBuffer.sampleRate);

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = newBuffer.getChannelData(channel);

      for (let i = 0; i < inputData.length; i++) {
        let gain = 1;

        // Fade in
        if (i < fadeInSamples) {
          gain = i / fadeInSamples;
        }

        // Fade out
        if (i >= inputData.length - fadeOutSamples) {
          const fadeOutIndex = inputData.length - i;
          gain = fadeOutIndex / fadeOutSamples;
        }

        outputData[i] = inputData[i] * gain;
      }
    }

    return newBuffer;
  }

  async autoDuck(
    musicBuffer: AudioBuffer,
    voiceBuffer: AudioBuffer,
    duckAmount: number = 0.3
  ): Promise<AudioBuffer> {
    // Reduce music volume when voice is present
    const outputBuffer = this.audioContext!.createBuffer(
      musicBuffer.numberOfChannels,
      musicBuffer.length,
      musicBuffer.sampleRate
    );

    const voiceData = voiceBuffer.getChannelData(0);
    const voiceEnvelope = this.computeEnvelope(voiceData);

    for (let channel = 0; channel < musicBuffer.numberOfChannels; channel++) {
      const musicData = musicBuffer.getChannelData(channel);
      const outputData = outputBuffer.getChannelData(channel);

      for (let i = 0; i < musicData.length; i++) {
        const voiceIdx = Math.floor((i / musicData.length) * voiceEnvelope.length);
        const voiceLevel = voiceEnvelope[voiceIdx] || 0;

        // Duck music when voice is present
        const gain = 1 - voiceLevel * (1 - duckAmount);
        outputData[i] = musicData[i] * gain;
      }
    }

    return outputBuffer;
  }

  private computeEnvelope(channelData: Float32Array): Float32Array {
    const windowSize = 1024;
    const envelope = new Float32Array(Math.ceil(channelData.length / windowSize));

    for (let i = 0; i < envelope.length; i++) {
      let max = 0;
      const start = i * windowSize;
      const end = Math.min(start + windowSize, channelData.length);

      for (let j = start; j < end; j++) {
        max = Math.max(max, Math.abs(channelData[j]));
      }

      envelope[i] = max;
    }

    return envelope;
  }
}

// Singleton instance
let audioProcessor: AudioProcessor | null = null;

export function getAudioProcessor(): AudioProcessor {
  if (!audioProcessor) {
    audioProcessor = new AudioProcessor();
  }
  return audioProcessor;
}

export async function analyzeAudioFile(file: File): Promise<AudioAnalysisResult> {
  const processor = getAudioProcessor();
  return processor.analyzeAudio(file);
}
