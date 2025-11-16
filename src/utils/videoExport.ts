import type { Project, ExportPreset } from '@/types';

interface ExportOptions {
  project: Project;
  preset: ExportPreset;
  fileName: string;
  includeAudio: boolean;
  includeCaptions: boolean;
  qualityMultiplier: number;
  onProgress: (progress: number) => void;
}

interface VideoSource {
  video: HTMLVideoElement;
  mediaId: string;
  ready: boolean;
}

// Optimized export using Canvas and MediaRecorder
export async function exportVideo(options: ExportOptions): Promise<Blob> {
  const {
    project,
    preset,
    includeAudio,
    includeCaptions,
    qualityMultiplier,
    onProgress,
  } = options;

  // Create offscreen canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = preset.resolution.width;
  canvas.height = preset.resolution.height;

  const ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
    willReadFrequently: false,
  });

  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  // Enable high quality rendering based on device capability
  const isWeakDevice = detectWeakDevice();
  ctx.imageSmoothingEnabled = !isWeakDevice;
  ctx.imageSmoothingQuality = isWeakDevice ? 'low' : 'high';

  // Load all video sources
  const videoSources = new Map<string, VideoSource>();
  const audioTracks: AudioContext[] = [];

  onProgress(0);

  // Pre-load all media
  const mediaToLoad = project.media.filter((m) => m.type === 'video');
  let loadedCount = 0;

  for (const media of mediaToLoad) {
    const video = document.createElement('video');
    video.src = media.path;
    video.muted = true; // Mute during rendering
    video.preload = 'auto';
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    // Set playback rate for faster seeking
    video.playbackRate = 1;

    await new Promise<void>((resolve) => {
      video.onloadeddata = () => {
        videoSources.set(media.id, {
          video,
          mediaId: media.id,
          ready: true,
        });
        loadedCount++;
        onProgress((loadedCount / mediaToLoad.length) * 10); // 0-10% for loading
        resolve();
      };
      video.onerror = () => {
        console.warn(`Failed to load video: ${media.name}`);
        resolve(); // Continue even if one fails
      };

      // Set a timeout for loading
      setTimeout(() => resolve(), 10000);
    });
  }

  onProgress(10);

  // Calculate optimal frame rate and chunk size based on device
  const targetFps = isWeakDevice ? Math.min(preset.fps, 24) : preset.fps;
  const totalFrames = Math.ceil(project.duration * targetFps);
  const chunkSize = isWeakDevice ? 30 : 60; // Frames per chunk

  // Create MediaRecorder with optimal settings
  const stream = canvas.captureStream(targetFps);

  // Add audio tracks if requested
  if (includeAudio && !isWeakDevice) {
    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Mix all audio sources
      for (const track of project.tracks) {
        if (track.muted) continue;

        for (const clip of track.clips) {
          const source = videoSources.get(clip.mediaId);
          if (source?.video) {
            const audioSource = audioContext.createMediaElementSource(source.video);
            audioSource.connect(destination);
          }
        }
      }

      // Add audio track to stream
      destination.stream.getAudioTracks().forEach((track) => {
        stream.addTrack(track);
      });

      audioTracks.push(audioContext);
    } catch (err) {
      console.warn('Failed to setup audio:', err);
    }
  }

  // Configure MediaRecorder with adaptive bitrate
  const videoBitrate = Math.round(preset.bitrate * qualityMultiplier * 1000);
  const audioBitrate = includeAudio ? preset.audioBitrate * 1000 : 0;

  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: videoBitrate,
    audioBitsPerSecond: audioBitrate,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // Start recording
  recorder.start(100); // Collect data every 100ms

  // Render frames with chunking for memory management
  let frameIndex = 0;
  const startTime = performance.now();

  while (frameIndex < totalFrames) {
    const chunkEnd = Math.min(frameIndex + chunkSize, totalFrames);

    // Process chunk of frames
    for (let i = frameIndex; i < chunkEnd; i++) {
      const time = i / targetFps;

      // Render frame
      await renderFrame(
        ctx,
        canvas,
        project,
        videoSources,
        time,
        includeCaptions
      );

      // Update progress (10-90%)
      const progress = 10 + ((i / totalFrames) * 80);
      onProgress(progress);

      // Yield to browser to prevent blocking
      if (i % 10 === 0) {
        await yieldToMain();
      }
    }

    frameIndex = chunkEnd;

    // Force garbage collection opportunity between chunks
    await yieldToMain();
  }

  // Stop recording
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });

  onProgress(95);

  // Clean up
  videoSources.forEach((source) => {
    source.video.pause();
    source.video.src = '';
  });
  videoSources.clear();

  audioTracks.forEach((ctx) => ctx.close());

  // Combine chunks into final blob
  const finalBlob = new Blob(chunks, { type: mimeType });

  onProgress(100);

  const endTime = performance.now();
  console.log(`Export completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);

  return finalBlob;
}

// Render a single frame to canvas
async function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  project: Project,
  videoSources: Map<string, VideoSource>,
  time: number,
  includeCaptions: boolean
): Promise<void> {
  // Clear canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render each track
  for (const track of project.tracks) {
    if (!track.visible) continue;

    for (const clip of track.clips) {
      if (time >= clip.startTime && time < clip.startTime + clip.duration) {
        const media = project.media.find((m) => m.id === clip.mediaId);
        if (!media) continue;

        if (media.type === 'video') {
          const source = videoSources.get(media.id);
          if (source?.ready) {
            const relativeTime = time - clip.startTime;
            const sourceTime = clip.inPoint + relativeTime;

            // Seek video to correct time
            if (Math.abs(source.video.currentTime - sourceTime) > 0.05) {
              source.video.currentTime = sourceTime;
              // Wait for seek to complete
              await new Promise<void>((resolve) => {
                const onSeeked = () => {
                  source.video.removeEventListener('seeked', onSeeked);
                  resolve();
                };
                source.video.addEventListener('seeked', onSeeked);
                // Timeout fallback
                setTimeout(resolve, 100);
              });
            }

            // Draw video frame with aspect ratio preservation
            try {
              ctx.globalAlpha = clip.opacity;
              const videoAspect = source.video.videoWidth / source.video.videoHeight;
              const canvasAspect = canvas.width / canvas.height;

              let drawWidth = canvas.width;
              let drawHeight = canvas.height;
              let drawX = 0;
              let drawY = 0;

              if (videoAspect > canvasAspect) {
                drawHeight = canvas.width / videoAspect;
                drawY = (canvas.height - drawHeight) / 2;
              } else {
                drawWidth = canvas.height * videoAspect;
                drawX = (canvas.width - drawWidth) / 2;
              }

              ctx.drawImage(source.video, drawX, drawY, drawWidth, drawHeight);
              ctx.globalAlpha = 1;
            } catch {
              // Video not ready, skip frame
            }
          }
        } else if (media.type === 'image' && media.thumbnail) {
          const img = new Image();
          img.src = media.thumbnail;
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 50);
          });
          ctx.globalAlpha = clip.opacity;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // Render captions
  if (includeCaptions) {
    const activeCaptions = project.captions.filter(
      (cap) => time >= cap.startTime && time <= cap.endTime
    );

    for (const caption of activeCaptions) {
      const style = caption.style;
      ctx.font = `bold ${style.fontSize}px ${style.fontFamily}`;
      ctx.textAlign = style.alignment;

      const textWidth = ctx.measureText(caption.text).width;
      let x = canvas.width / 2;
      let y = canvas.height - 100;

      if (style.position === 'top') {
        y = 100;
      } else if (style.position === 'center') {
        y = canvas.height / 2;
      }

      // Background
      if (style.backgroundColor !== 'transparent') {
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(
          x - textWidth / 2 - 10,
          y - style.fontSize,
          textWidth + 20,
          style.fontSize + 10
        );
      }

      // Text outline
      if (style.outline) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(caption.text, x, y);
      }

      // Text
      ctx.fillStyle = style.color;
      ctx.fillText(caption.text, x, y);
    }
  }
}

// Detect if device is weak (mobile/old hardware)
function detectWeakDevice(): boolean {
  // Check for mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Check hardware concurrency (number of CPU cores)
  const cores = navigator.hardwareConcurrency || 2;

  // Check device memory (if available)
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;

  return isMobile || cores <= 2 || memory <= 2;
}

// Get supported MIME type for MediaRecorder
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'video/webm'; // Fallback
}

// Yield to main thread to prevent blocking
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if ('scheduler' in window && (window.scheduler as { yield?: () => Promise<void> }).yield) {
      (window.scheduler as { yield: () => Promise<void> }).yield().then(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

// Download the exported video
export function downloadVideo(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
