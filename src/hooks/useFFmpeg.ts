import { useState, useRef, useCallback, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface FFmpegState {
  loaded: boolean;
  loading: boolean;
  progress: number;
  error: string | null;
}

export function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [state, setState] = useState<FFmpegState>({
    loaded: false,
    loading: false,
    progress: 0,
    error: null,
  });

  const load = useCallback(async () => {
    if (state.loaded || state.loading) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      ffmpeg.on('progress', ({ progress }) => {
        setState((prev) => ({ ...prev, progress: Math.round(progress * 100) }));
      });

      // Load FFmpeg core
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setState({
        loaded: true,
        loading: false,
        progress: 100,
        error: null,
      });
    } catch (err) {
      setState({
        loaded: false,
        loading: false,
        progress: 0,
        error: err instanceof Error ? err.message : 'Failed to load FFmpeg',
      });
    }
  }, [state.loaded, state.loading]);

  const transcode = useCallback(
    async (
      inputFile: File,
      outputName: string,
      args: string[]
    ): Promise<Uint8Array | null> => {
      if (!ffmpegRef.current || !state.loaded) {
        throw new Error('FFmpeg not loaded');
      }

      const ffmpeg = ffmpegRef.current;
      const inputName = inputFile.name;

      try {
        // Write input file
        await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

        // Execute FFmpeg command
        await ffmpeg.exec(['-i', inputName, ...args, outputName]);

        // Read output file
        const data = await ffmpeg.readFile(outputName);

        // Clean up
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);

        return data as Uint8Array;
      } catch (err) {
        console.error('Transcode error:', err);
        throw err;
      }
    },
    [state.loaded]
  );

  const extractAudio = useCallback(
    async (videoFile: File): Promise<Uint8Array | null> => {
      return transcode(videoFile, 'output.mp3', [
        '-vn', // No video
        '-acodec',
        'libmp3lame',
        '-q:a',
        '2', // High quality
      ]);
    },
    [transcode]
  );

  const generateThumbnail = useCallback(
    async (videoFile: File, time: number = 1): Promise<Uint8Array | null> => {
      return transcode(videoFile, 'thumbnail.jpg', [
        '-ss',
        time.toString(),
        '-vframes',
        '1',
        '-q:v',
        '2',
      ]);
    },
    [transcode]
  );

  const trimVideo = useCallback(
    async (
      videoFile: File,
      startTime: number,
      endTime: number
    ): Promise<Uint8Array | null> => {
      const duration = endTime - startTime;
      return transcode(videoFile, 'trimmed.mp4', [
        '-ss',
        startTime.toString(),
        '-t',
        duration.toString(),
        '-c',
        'copy', // Fast copy without re-encoding
      ]);
    },
    [transcode]
  );

  const addCaptions = useCallback(
    async (
      videoFile: File,
      srtContent: string
    ): Promise<Uint8Array | null> => {
      if (!ffmpegRef.current || !state.loaded) {
        throw new Error('FFmpeg not loaded');
      }

      const ffmpeg = ffmpegRef.current;
      const inputName = videoFile.name;

      // Write input files
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
      await ffmpeg.writeFile(
        'subtitles.srt',
        new TextEncoder().encode(srtContent)
      );

      // Burn subtitles into video
      await ffmpeg.exec([
        '-i',
        inputName,
        '-vf',
        'subtitles=subtitles.srt',
        '-c:a',
        'copy',
        'output.mp4',
      ]);

      const data = await ffmpeg.readFile('output.mp4');

      // Clean up
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile('subtitles.srt');
      await ffmpeg.deleteFile('output.mp4');

      return data as Uint8Array;
    },
    [state.loaded]
  );

  const changeAspectRatio = useCallback(
    async (
      videoFile: File,
      width: number,
      height: number
    ): Promise<Uint8Array | null> => {
      return transcode(videoFile, 'resized.mp4', [
        '-vf',
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        '-c:a',
        'copy',
      ]);
    },
    [transcode]
  );

  const applyFilter = useCallback(
    async (
      videoFile: File,
      filter: string
    ): Promise<Uint8Array | null> => {
      return transcode(videoFile, 'filtered.mp4', [
        '-vf',
        filter,
        '-c:a',
        'copy',
      ]);
    },
    [transcode]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ffmpegRef.current) {
        // FFmpeg cleanup if needed
      }
    };
  }, []);

  return {
    ...state,
    load,
    transcode,
    extractAudio,
    generateThumbnail,
    trimVideo,
    addCaptions,
    changeAspectRatio,
    applyFilter,
  };
}
