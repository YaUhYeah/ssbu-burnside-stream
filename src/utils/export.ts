import type { Project, ExportPreset, Caption } from '@/types';

// Convert captions to SRT format
export function captionsToSRT(captions: Caption[]): string {
  return captions
    .map((caption, index) => {
      const startTime = formatSRTTime(caption.startTime);
      const endTime = formatSRTTime(caption.endTime);

      return `${index + 1}\n${startTime} --> ${endTime}\n${caption.text}\n`;
    })
    .join('\n');
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

function pad(num: number, size: number = 2): string {
  return num.toString().padStart(size, '0');
}

// Convert captions to VTT format
export function captionsToVTT(captions: Caption[]): string {
  const header = 'WEBVTT\n\n';
  const body = captions
    .map((caption) => {
      const startTime = formatVTTTime(caption.startTime);
      const endTime = formatVTTTime(caption.endTime);

      return `${startTime} --> ${endTime}\n${caption.text}\n`;
    })
    .join('\n');

  return header + body;
}

function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
}

// Generate FFmpeg command for export
export interface FFmpegExportConfig {
  args: string[];
  srtContent?: string;
  srtFilename?: string;
}

export function generateFFmpegCommand(
  project: Project,
  preset: ExportPreset,
  options: {
    includeAudio: boolean;
    burnCaptions: boolean;
    outputPath: string;
  }
): FFmpegExportConfig {
  const args: string[] = [];
  let srtContent: string | undefined;
  let srtFilename: string | undefined;

  // Input files
  project.tracks.forEach((track) => {
    track.clips.forEach((clip) => {
      const media = project.media.find((m) => m.id === clip.mediaId);
      if (media) {
        args.push('-i', media.path);
      }
    });
  });

  // Video filter chain
  const videoFilters: string[] = [];

  // Scale to target resolution
  videoFilters.push(
    `scale=${preset.resolution.width}:${preset.resolution.height}:force_original_aspect_ratio=decrease`
  );

  // Pad to exact size
  videoFilters.push(
    `pad=${preset.resolution.width}:${preset.resolution.height}:(ow-iw)/2:(oh-ih)/2:black`
  );

  // Burn captions if requested
  if (options.burnCaptions && project.captions.length > 0) {
    // Generate SRT content for subtitle burning
    srtContent = captionsToSRT(project.captions);
    srtFilename = 'subtitles.srt';
    // Add subtitle filter with styling
    videoFilters.push(
      `subtitles=${srtFilename}:force_style='FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3,Outline=2,Shadow=1'`
    );
  }

  if (videoFilters.length > 0) {
    args.push('-vf', videoFilters.join(','));
  }

  // Video codec settings
  args.push('-c:v', preset.codec);
  args.push('-b:v', `${preset.bitrate}k`);
  args.push('-r', preset.fps.toString());

  // Audio settings
  if (options.includeAudio) {
    args.push('-c:a', preset.audioCodec);
    args.push('-b:a', `${preset.audioBitrate}k`);
  } else {
    args.push('-an');
  }

  // Output format
  args.push('-f', preset.format);

  // Output file
  args.push(options.outputPath);

  return {
    args,
    srtContent,
    srtFilename,
  };
}

// Calculate estimated file size
export function estimateFileSize(
  durationSeconds: number,
  preset: ExportPreset
): number {
  const videoBits = preset.bitrate * 1000 * durationSeconds;
  const audioBits = preset.audioBitrate * 1000 * durationSeconds;
  const totalBits = videoBits + audioBits;
  return totalBits / 8; // Convert to bytes
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Generate metadata for export
export function generateMetadata(
  project: Project,
  preset: ExportPreset
): Record<string, string> {
  return {
    title: project.name,
    description: project.description,
    author: 'ClipFlow Studio',
    date: new Date().toISOString(),
    software: 'ClipFlow Studio v1.0.0',
    encoder: `${preset.codec} ${preset.bitrate}kbps`,
  };
}

// Platform-specific optimizations
export function getPlatformOptimizations(platform: string): Record<string, string> {
  const optimizations: Record<string, Record<string, string>> = {
    youtube: {
      '-movflags': '+faststart',
      '-pix_fmt': 'yuv420p',
      '-profile:v': 'high',
      '-level': '4.0',
    },
    tiktok: {
      '-movflags': '+faststart',
      '-pix_fmt': 'yuv420p',
      '-profile:v': 'baseline',
      '-level': '3.1',
    },
    'instagram-reels': {
      '-movflags': '+faststart',
      '-pix_fmt': 'yuv420p',
      '-profile:v': 'main',
      '-level': '3.1',
    },
    twitter: {
      '-movflags': '+faststart',
      '-pix_fmt': 'yuv420p',
      '-profile:v': 'high',
      '-level': '4.0',
    },
  };

  return optimizations[platform] || {};
}

// Create thumbnail from frame
export async function createThumbnail(
  canvas: HTMLCanvasElement,
  width: number = 1280,
  height: number = 720
): Promise<Blob> {
  const thumbnailCanvas = document.createElement('canvas');
  thumbnailCanvas.width = width;
  thumbnailCanvas.height = height;

  const ctx = thumbnailCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(canvas, 0, 0, width, height);

  return new Promise((resolve) => {
    thumbnailCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
    }, 'image/jpeg', 0.9);
  });
}

// Batch export configuration
export interface BatchExportJob {
  id: string;
  projectId: string;
  preset: ExportPreset;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputPath: string;
  error?: string;
}

export function createBatchExportQueue(
  projects: Project[],
  presets: ExportPreset[]
): BatchExportJob[] {
  const jobs: BatchExportJob[] = [];

  projects.forEach((project) => {
    presets.forEach((preset) => {
      jobs.push({
        id: `${project.id}-${preset.id}`,
        projectId: project.id,
        preset,
        status: 'queued',
        progress: 0,
        outputPath: `${project.name}_${preset.name}.${preset.format}`,
      });
    });
  });

  return jobs;
}
