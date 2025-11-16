import { useRef, useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface WorkerMessage {
  id: string;
  type: string;
  payload: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export function useVideoWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Create worker
    const worker = new Worker(
      new URL('../workers/videoProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { id, type, payload } = event.data;

      if (type === 'progress') {
        setProgress(payload as number);
        return;
      }

      if (type === 'log') {
        console.log('[Worker]', payload);
        return;
      }

      const pending = pendingRequests.current.get(id);
      if (!pending) return;

      if (type === 'result') {
        pending.resolve(payload);
      } else if (type === 'error') {
        pending.reject(new Error(payload as string));
      }

      pendingRequests.current.delete(id);
    };

    worker.onerror = (error) => {
      console.error('Worker error:', error);
    };

    workerRef.current = worker;

    // Initialize FFmpeg in worker
    sendMessage('init', {}).then(() => {
      setIsReady(true);
    });

    return () => {
      worker.terminate();
    };
  }, []);

  const sendMessage = useCallback(
    (type: string, payload: unknown): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const id = uuidv4();
        pendingRequests.current.set(id, { resolve, reject });

        workerRef.current.postMessage({
          id,
          type,
          payload,
        });
      });
    },
    []
  );

  const transcode = useCallback(
    async (
      inputFile: File,
      outputName: string,
      args: string[]
    ): Promise<Blob> => {
      const inputData = await inputFile.arrayBuffer();
      const result = await sendMessage('transcode', {
        inputData,
        inputName: inputFile.name,
        outputName,
        args,
      });
      return new Blob([result as ArrayBuffer]);
    },
    [sendMessage]
  );

  const extractFrames = useCallback(
    async (videoFile: File, fps: number = 1, maxFrames: number = 100): Promise<Blob[]> => {
      const inputData = await videoFile.arrayBuffer();
      const result = await sendMessage('extractFrames', {
        inputData,
        inputName: videoFile.name,
        fps,
        maxFrames,
      });
      return (result as ArrayBuffer[]).map((buffer) => new Blob([buffer]));
    },
    [sendMessage]
  );

  const analyzeAudio = useCallback(
    async (
      audioFile: File
    ): Promise<{
      peaks: number[];
      silences: Array<{ start: number; end: number }>;
      loudness: number;
    }> => {
      const inputData = await audioFile.arrayBuffer();
      const result = await sendMessage('analyzeAudio', {
        inputData,
        inputName: audioFile.name,
      });
      return result as {
        peaks: number[];
        silences: Array<{ start: number; end: number }>;
        loudness: number;
      };
    },
    [sendMessage]
  );

  const generateWaveform = useCallback(
    async (audioFile: File): Promise<number[]> => {
      const inputData = await audioFile.arrayBuffer();
      const result = await sendMessage('generateWaveform', {
        inputData,
        inputName: audioFile.name,
      });
      return result as number[];
    },
    [sendMessage]
  );

  const trimVideo = useCallback(
    async (videoFile: File, startTime: number, endTime: number): Promise<Blob> => {
      const duration = endTime - startTime;
      return transcode(videoFile, 'trimmed.mp4', [
        '-ss',
        startTime.toString(),
        '-t',
        duration.toString(),
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
      ]);
    },
    [transcode]
  );

  const resizeVideo = useCallback(
    async (videoFile: File, width: number, height: number): Promise<Blob> => {
      return transcode(videoFile, 'resized.mp4', [
        '-vf',
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-c:a',
        'aac',
      ]);
    },
    [transcode]
  );

  const addSubtitles = useCallback(
    async (videoFile: File, srtContent: string): Promise<Blob> => {
      // For subtitles, we need special handling
      const inputData = await videoFile.arrayBuffer();

      // Create a temporary SRT file in the worker
      const encoder = new TextEncoder();
      const srtData = encoder.encode(srtContent);

      const result = await sendMessage('transcode', {
        inputData,
        inputName: videoFile.name,
        outputName: 'output.mp4',
        args: [
          '-vf',
          `drawtext=text='${srtContent.replace(/'/g, "\\'")}':fontsize=24:fontcolor=white:x=(w-text_w)/2:y=h-100`,
          '-c:a',
          'copy',
        ],
      });

      return new Blob([result as ArrayBuffer]);
    },
    [sendMessage]
  );

  const extractAudio = useCallback(
    async (videoFile: File): Promise<Blob> => {
      return transcode(videoFile, 'audio.mp3', [
        '-vn',
        '-acodec',
        'libmp3lame',
        '-q:a',
        '2',
      ]);
    },
    [transcode]
  );

  const normalizeAudio = useCallback(
    async (audioFile: File, targetLUFS: number = -14): Promise<Blob> => {
      return transcode(audioFile, 'normalized.mp3', [
        '-af',
        `loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11`,
        '-acodec',
        'libmp3lame',
        '-q:a',
        '2',
      ]);
    },
    [transcode]
  );

  const applyNoiseReduction = useCallback(
    async (audioFile: File): Promise<Blob> => {
      return transcode(audioFile, 'denoised.mp3', [
        '-af',
        'afftdn=nf=-25',
        '-acodec',
        'libmp3lame',
        '-q:a',
        '2',
      ]);
    },
    [transcode]
  );

  return {
    isReady,
    progress,
    transcode,
    extractFrames,
    analyzeAudio,
    generateWaveform,
    trimVideo,
    resizeVideo,
    addSubtitles,
    extractAudio,
    normalizeAudio,
    applyNoiseReduction,
  };
}
