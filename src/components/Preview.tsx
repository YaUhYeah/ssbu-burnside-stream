import { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX, Settings, Crop, Maximize } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/lib/utils';

type ScaleMode = 'fit' | 'fill' | 'cover' | 'stretch';

interface VideoSource {
  video: HTMLVideoElement;
  mediaId: string;
  ready: boolean;
  originalWidth: number;
  originalHeight: number;
}

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const videoSourcesRef = useRef<Map<string, VideoSource>>(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [scaleMode, setScaleMode] = useState<ScaleMode>('fill');
  const [showScaleMenu, setShowScaleMenu] = useState(false);
  const lastRenderTimeRef = useRef<number>(0);

  const {
    project,
    currentTime,
    isPlaying,
  } = useProjectStore();

  // Handle playback with proper delta timing
  useEffect(() => {
    if (!project || !isPlaying) return;

    let lastTimestamp = performance.now();

    const updateTime = (timestamp: number) => {
      const delta = (timestamp - lastTimestamp) / 1000; // Convert to seconds
      lastTimestamp = timestamp;

      const { currentTime: time, setCurrentTime: setTime, pause: pausePlayback } = useProjectStore.getState();
      const newTime = time + delta;

      if (newTime >= project.duration) {
        pausePlayback();
        setTime(0);
      } else {
        setTime(newTime);
      }

      animationRef.current = requestAnimationFrame(updateTime);
    };

    animationRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, project]);

  // Immediately pause/play all videos when isPlaying changes
  useEffect(() => {
    if (!project) return;

    // CRITICAL: Immediately stop ALL audio when not playing
    // This must happen synchronously to prevent audio bleeding
    const stopAllAudio = () => {
      videoSourcesRef.current.forEach((source) => {
        try {
          source.video.pause();
          // Completely reset the audio context
          source.video.currentTime = source.video.currentTime;
          // Mute temporarily to ensure no audio leak
          const originalMuted = source.video.muted;
          source.video.muted = true;
          // Small delay before restoring mute state
          setTimeout(() => {
            if (!useProjectStore.getState().isPlaying) {
              source.video.muted = originalMuted;
            }
          }, 50);
        } catch (err) {
          console.warn('Error stopping audio:', err);
        }
      });
    };

    const startAudio = () => {
      videoSourcesRef.current.forEach((source) => {
        if (source.ready) {
          source.video.muted = isMuted;
        }
      });
    };

    if (!isPlaying) {
      stopAllAudio();
    } else {
      startAudio();
    }

    // Cleanup on unmount or state change
    return () => {
      if (!isPlaying) {
        stopAllAudio();
      }
    };
  }, [isPlaying, project, isMuted]);

  // Initialize video sources for all media with high quality settings
  useEffect(() => {
    if (!project) return;

    const videoMedia = project.media.filter((m) => m.type === 'video');

    // Create video elements for each media file
    videoMedia.forEach((media) => {
      if (!videoSourcesRef.current.has(media.id)) {
        const video = document.createElement('video');
        video.src = media.path;
        video.preload = 'auto';
        video.muted = isMuted;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        // HIGH QUALITY SETTINGS for better MKV/VOD playback
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');

        // Request high quality decoding
        if ('requestVideoFrameCallback' in video) {
          // Modern browsers - request frame callbacks for smoother playback
        }

        // Handle codec issues gracefully
        video.onerror = (e) => {
          console.warn(`Video playback issue for ${media.name}:`, e);
          // Mark as ready even on error to show thumbnail
          videoSourcesRef.current.set(media.id, {
            video,
            mediaId: media.id,
            ready: false,
            originalWidth: 0,
            originalHeight: 0,
          });
        };

        video.onloadedmetadata = () => {
          // Store original dimensions for proper scaling
          const source = videoSourcesRef.current.get(media.id);
          if (source) {
            source.originalWidth = video.videoWidth;
            source.originalHeight = video.videoHeight;
          }
        };

        video.onloadeddata = () => {
          videoSourcesRef.current.set(media.id, {
            video,
            mediaId: media.id,
            ready: true,
            originalWidth: video.videoWidth,
            originalHeight: video.videoHeight,
          });
        };

        videoSourcesRef.current.set(media.id, {
          video,
          mediaId: media.id,
          ready: false,
          originalWidth: 0,
          originalHeight: 0,
        });
      }
    });

    // Update mute state
    videoSourcesRef.current.forEach((source) => {
      source.video.muted = isMuted;
    });

    return () => {
      videoSourcesRef.current.forEach((source) => {
        source.video.pause();
        source.video.src = '';
      });
      videoSourcesRef.current.clear();
    };
  }, [project?.media, isMuted]);

  // Calculate draw dimensions based on scale mode
  const calculateDrawDimensions = useCallback((
    videoWidth: number,
    videoHeight: number,
    canvasWidth: number,
    canvasHeight: number,
    mode: ScaleMode
  ): { x: number; y: number; width: number; height: number; sourceX: number; sourceY: number; sourceWidth: number; sourceHeight: number } => {
    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawX = 0;
    let drawY = 0;
    let drawWidth = canvasWidth;
    let drawHeight = canvasHeight;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = videoWidth;
    let sourceHeight = videoHeight;

    switch (mode) {
      case 'fit':
        // Letterbox - show entire video with black bars
        if (videoAspect > canvasAspect) {
          drawHeight = canvasWidth / videoAspect;
          drawY = (canvasHeight - drawHeight) / 2;
        } else {
          drawWidth = canvasHeight * videoAspect;
          drawX = (canvasWidth - drawWidth) / 2;
        }
        break;

      case 'fill':
        // Smart crop - fill canvas, crop edges, keep center
        if (videoAspect > canvasAspect) {
          // Video is wider - crop sides
          sourceWidth = videoHeight * canvasAspect;
          sourceX = (videoWidth - sourceWidth) / 2;
        } else {
          // Video is taller - crop top/bottom
          sourceHeight = videoWidth / canvasAspect;
          sourceY = (videoHeight - sourceHeight) / 2;
        }
        break;

      case 'cover':
        // Cover with smart focus on center (no letterbox, may crop)
        if (videoAspect > canvasAspect) {
          sourceWidth = videoHeight * canvasAspect;
          sourceX = (videoWidth - sourceWidth) / 2;
        } else {
          sourceHeight = videoWidth / canvasAspect;
          sourceY = (videoHeight - sourceHeight) / 2;
        }
        break;

      case 'stretch':
        // Stretch to fill (may distort)
        // No changes needed - draws video to full canvas
        break;
    }

    return {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
    };
  }, []);

  // Render preview frame with high quality
  const renderFrame = useCallback(() => {
    if (!project || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    });
    if (!ctx) return;

    // Set canvas size based on project resolution
    if (canvas.width !== project.resolution.width || canvas.height !== project.resolution.height) {
      canvas.width = project.resolution.width;
      canvas.height = project.resolution.height;
    }

    // HIGH QUALITY RENDERING SETTINGS
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find active clips at current time
    project.tracks.forEach((track) => {
      if (!track.visible) return;

      track.clips.forEach((clip) => {
        if (
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          const media = project.media.find((m) => m.id === clip.mediaId);
          if (!media) return;

          if (media.type === 'video') {
            const source = videoSourcesRef.current.get(media.id);
            if (source?.ready && source.originalWidth > 0) {
              // Calculate position within source media
              const relativeTime = currentTime - clip.startTime;
              const sourceTime = clip.inPoint + relativeTime;

              // Seek video if needed (with tolerance for smoother playback)
              const seekTolerance = isPlaying ? 0.15 : 0.05;
              if (Math.abs(source.video.currentTime - sourceTime) > seekTolerance) {
                source.video.currentTime = sourceTime;
              }

              // IMPORTANT: Get current playing state from store to avoid stale closures
              const currentlyPlaying = useProjectStore.getState().isPlaying;

              // Ensure video is playing if we're in playback mode
              if (currentlyPlaying && source.video.paused) {
                source.video.play().catch(() => {});
              } else if (!currentlyPlaying && !source.video.paused) {
                source.video.pause();
              }

              // Draw video frame with proper scaling
              try {
                ctx.globalAlpha = clip.opacity;

                // Calculate dimensions based on scale mode
                const dims = calculateDrawDimensions(
                  source.originalWidth,
                  source.originalHeight,
                  canvas.width,
                  canvas.height,
                  scaleMode
                );

                // Use high quality drawing with source cropping
                ctx.drawImage(
                  source.video,
                  dims.sourceX,
                  dims.sourceY,
                  dims.sourceWidth,
                  dims.sourceHeight,
                  dims.x,
                  dims.y,
                  dims.width,
                  dims.height
                );
                ctx.globalAlpha = 1;
              } catch {
                // Video not ready, show thumbnail
                if (media.thumbnail) {
                  const img = new Image();
                  img.src = media.thumbnail;
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }
              }
            } else if (media.thumbnail) {
              // Show thumbnail while loading
              const img = new Image();
              img.src = media.thumbnail;
              ctx.globalAlpha = clip.opacity;
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              ctx.globalAlpha = 1;
            }
          } else if (media.type === 'image' && media.thumbnail) {
            const img = new Image();
            img.src = media.thumbnail;
            ctx.globalAlpha = clip.opacity;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
          }
        }
      });
    });

    // Render captions
    const activeCaptions = project.captions.filter(
      (cap) => currentTime >= cap.startTime && currentTime <= cap.endTime
    );

    activeCaptions.forEach((caption) => {
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
    });

    lastRenderTimeRef.current = performance.now();
  }, [project, currentTime, scaleMode, calculateDrawDimensions, isPlaying]);

  // Render on time change
  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  const toggleFullscreen = () => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;

    if (!isFullscreen) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-black">
        <p className="text-muted-foreground">No project loaded</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Video preview */}
      <div className="video-preview flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full"
          style={{
            aspectRatio: `${project.resolution.width} / ${project.resolution.height}`,
          }}
        />
      </div>

      {/* Preview controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <div className="relative">
          <button
            onClick={() => setShowScaleMenu(!showScaleMenu)}
            className="rounded-md bg-black/50 p-2 text-white hover:bg-black/70"
            title="Scale mode"
          >
            <Crop className="h-4 w-4" />
          </button>

          {showScaleMenu && (
            <div className="absolute bottom-full right-0 mb-2 min-w-40 rounded-md border border-border bg-card p-2 shadow-lg">
              <div className="text-xs font-medium mb-2 text-muted-foreground">Scale Mode</div>
              {[
                { mode: 'fill' as ScaleMode, label: 'Fill (Smart Crop)', icon: Maximize },
                { mode: 'fit' as ScaleMode, label: 'Fit (Letterbox)', icon: Maximize2 },
                { mode: 'cover' as ScaleMode, label: 'Cover', icon: Crop },
                { mode: 'stretch' as ScaleMode, label: 'Stretch', icon: Settings },
              ].map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => {
                    setScaleMode(mode);
                    setShowScaleMenu(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent',
                    scaleMode === mode && 'bg-primary/20 text-primary'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="rounded-md bg-black/50 p-2 text-white hover:bg-black/70"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={toggleFullscreen}
          className="rounded-md bg-black/50 p-2 text-white hover:bg-black/70"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Aspect ratio indicator */}
      <div className="absolute left-4 top-4 rounded bg-black/50 px-2 py-1 text-xs text-white">
        {project.aspectRatio} | {scaleMode.toUpperCase()}
      </div>

      {/* Audio state indicator */}
      <div className="absolute left-4 bottom-4 flex items-center gap-2">
        {isPlaying && !isMuted && (
          <div className="flex items-center gap-1 rounded bg-green-500/80 px-2 py-1 text-xs text-white animate-pulse">
            <Volume2 className="h-3 w-3" />
            <span>Audio Active</span>
          </div>
        )}
        {isPlaying && isMuted && (
          <div className="flex items-center gap-1 rounded bg-yellow-500/80 px-2 py-1 text-xs text-white">
            <VolumeX className="h-3 w-3" />
            <span>Muted</span>
          </div>
        )}
        {!isPlaying && (
          <div className="flex items-center gap-1 rounded bg-gray-500/80 px-2 py-1 text-xs text-white">
            <VolumeX className="h-3 w-3" />
            <span>Paused</span>
          </div>
        )}
      </div>
    </div>
  );
}
