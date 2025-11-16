import { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';

interface VideoSource {
  video: HTMLVideoElement;
  mediaId: string;
  ready: boolean;
}

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const videoSourcesRef = useRef<Map<string, VideoSource>>(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

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

    videoSourcesRef.current.forEach((source) => {
      if (!isPlaying) {
        // Immediately stop all audio/video when paused
        source.video.pause();
      }
    });

    // Force a render to update visual state
    if (!isPlaying) {
      renderFrame();
    }
  }, [isPlaying, project]);

  // Initialize video sources for all media
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

        // Optimize for quality - request high quality playback
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');

        // Handle codec issues gracefully
        video.onerror = () => {
          console.warn(`Video playback issue for ${media.name}. Using fallback.`);
          // Mark as ready even on error to show thumbnail
          videoSourcesRef.current.set(media.id, {
            video,
            mediaId: media.id,
            ready: false,
          });
        };

        video.onloadeddata = () => {
          videoSourcesRef.current.set(media.id, {
            video,
            mediaId: media.id,
            ready: true,
          });
        };

        videoSourcesRef.current.set(media.id, {
          video,
          mediaId: media.id,
          ready: false,
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

  // Render preview frame
  const renderFrame = useCallback(() => {
    if (!project || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) return;

    // Set canvas size based on project resolution
    canvas.width = project.resolution.width;
    canvas.height = project.resolution.height;

    // Enable high quality rendering
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
            if (source?.ready) {
              // Calculate position within source media
              const relativeTime = currentTime - clip.startTime;
              const sourceTime = clip.inPoint + relativeTime;

              // Seek video if needed
              if (Math.abs(source.video.currentTime - sourceTime) > 0.1) {
                source.video.currentTime = sourceTime;
              }

              // Ensure video is playing if we're in playback mode
              if (isPlaying && source.video.paused) {
                source.video.play().catch(() => {});
              } else if (!isPlaying && !source.video.paused) {
                source.video.pause();
              }

              // Draw video frame
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
  }, [project, currentTime]);

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
        {project.aspectRatio}
      </div>
    </div>
  );
}
