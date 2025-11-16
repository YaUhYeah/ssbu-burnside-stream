// Web Worker for heavy video processing tasks
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

interface WorkerMessage {
  id: string;
  type: string;
  payload: unknown;
}

interface TranscodePayload {
  inputData: ArrayBuffer;
  inputName: string;
  outputName: string;
  args: string[];
}

interface ExtractFramesPayload {
  inputData: ArrayBuffer;
  inputName: string;
  fps: number;
  maxFrames: number;
}

interface AnalyzeAudioPayload {
  inputData: ArrayBuffer;
  inputName: string;
}

async function initFFmpeg(): Promise<void> {
  if (isLoaded) return;

  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    self.postMessage({
      type: 'progress',
      payload: Math.round(progress * 100),
    });
  });

  ffmpeg.on('log', ({ message }) => {
    self.postMessage({
      type: 'log',
      payload: message,
    });
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  isLoaded = true;
}

async function transcode(payload: TranscodePayload): Promise<ArrayBuffer> {
  if (!ffmpeg) throw new Error('FFmpeg not initialized');

  await ffmpeg.writeFile(
    payload.inputName,
    new Uint8Array(payload.inputData)
  );

  await ffmpeg.exec(['-i', payload.inputName, ...payload.args, payload.outputName]);

  const data = await ffmpeg.readFile(payload.outputName);

  await ffmpeg.deleteFile(payload.inputName);
  await ffmpeg.deleteFile(payload.outputName);

  return (data as Uint8Array).buffer;
}

async function extractFrames(payload: ExtractFramesPayload): Promise<ArrayBuffer[]> {
  if (!ffmpeg) throw new Error('FFmpeg not initialized');

  await ffmpeg.writeFile(
    payload.inputName,
    new Uint8Array(payload.inputData)
  );

  const frames: ArrayBuffer[] = [];

  // Extract frames at specified FPS
  await ffmpeg.exec([
    '-i',
    payload.inputName,
    '-vf',
    `fps=${payload.fps}`,
    '-vframes',
    payload.maxFrames.toString(),
    'frame_%04d.jpg',
  ]);

  // Read all extracted frames
  for (let i = 1; i <= payload.maxFrames; i++) {
    const frameName = `frame_${i.toString().padStart(4, '0')}.jpg`;
    try {
      const frameData = await ffmpeg.readFile(frameName);
      frames.push((frameData as Uint8Array).buffer);
      await ffmpeg.deleteFile(frameName);
    } catch {
      // No more frames
      break;
    }
  }

  await ffmpeg.deleteFile(payload.inputName);

  return frames;
}

async function analyzeAudio(payload: AnalyzeAudioPayload): Promise<{
  peaks: number[];
  silences: Array<{ start: number; end: number }>;
  loudness: number;
}> {
  if (!ffmpeg) throw new Error('FFmpeg not initialized');

  await ffmpeg.writeFile(
    payload.inputName,
    new Uint8Array(payload.inputData)
  );

  // Extract audio waveform data
  await ffmpeg.exec([
    '-i',
    payload.inputName,
    '-af',
    'astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=loudness.txt',
    '-f',
    'null',
    '-',
  ]);

  // Detect silences
  await ffmpeg.exec([
    '-i',
    payload.inputName,
    '-af',
    'silencedetect=noise=-30dB:d=0.5',
    '-f',
    'null',
    '-',
  ]);

  // Generate waveform peaks (simplified)
  const peaks: number[] = [];
  const silences: Array<{ start: number; end: number }> = [];

  // Read loudness data if available
  let loudness = -14; // Default LUFS
  try {
    const loudnessData = await ffmpeg.readFile('loudness.txt');
    const text = new TextDecoder().decode(loudnessData as Uint8Array);
    const match = text.match(/RMS_level=(-?\d+\.?\d*)/);
    if (match) {
      loudness = parseFloat(match[1]);
    }
    await ffmpeg.deleteFile('loudness.txt');
  } catch {
    // Use default
  }

  await ffmpeg.deleteFile(payload.inputName);

  return { peaks, silences, loudness };
}

async function generateWaveform(
  inputData: ArrayBuffer,
  inputName: string
): Promise<number[]> {
  if (!ffmpeg) throw new Error('FFmpeg not initialized');

  await ffmpeg.writeFile(inputName, new Uint8Array(inputData));

  // Generate waveform data
  await ffmpeg.exec([
    '-i',
    inputName,
    '-ac',
    '1', // Mono
    '-filter:a',
    'aresample=8000', // Resample to 8kHz
    '-f',
    'f32le',
    'waveform.raw',
  ]);

  const waveformData = await ffmpeg.readFile('waveform.raw');
  const floatArray = new Float32Array((waveformData as Uint8Array).buffer);

  // Downsample to reasonable number of peaks
  const targetPeaks = 200;
  const samplesPerPeak = Math.floor(floatArray.length / targetPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < targetPeaks; i++) {
    let max = 0;
    for (let j = 0; j < samplesPerPeak; j++) {
      const idx = i * samplesPerPeak + j;
      if (idx < floatArray.length) {
        max = Math.max(max, Math.abs(floatArray[idx]));
      }
    }
    peaks.push(max);
  }

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('waveform.raw');

  return peaks;
}

// Message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    // Initialize FFmpeg if needed
    if (!isLoaded && type !== 'init') {
      await initFFmpeg();
    }

    let result: unknown;

    switch (type) {
      case 'init':
        await initFFmpeg();
        result = { success: true };
        break;

      case 'transcode':
        result = await transcode(payload as TranscodePayload);
        break;

      case 'extractFrames':
        result = await extractFrames(payload as ExtractFramesPayload);
        break;

      case 'analyzeAudio':
        result = await analyzeAudio(payload as AnalyzeAudioPayload);
        break;

      case 'generateWaveform':
        const wfPayload = payload as { inputData: ArrayBuffer; inputName: string };
        result = await generateWaveform(wfPayload.inputData, wfPayload.inputName);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({
      id,
      type: 'result',
      payload: result,
    });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      payload: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export {};
