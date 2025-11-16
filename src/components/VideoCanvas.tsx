import { useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';

interface VideoSource {
  video: HTMLVideoElement;
  mediaId: string;
  ready: boolean;
}

export function VideoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoSourcesRef = useRef<Map<string, VideoSource>>(new Map());
  const animationFrameRef = useRef<number>();
  const _lastTimeRef = useRef<number>(0);

  const { project, currentTime, isPlaying, setCurrentTime, pause } = useProjectStore();

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
        video.muted = true; // Mute to allow programmatic seeking
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

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

    // Cleanup removed media
    const currentIds = new Set(videoMedia.map((m) => m.id));
    videoSourcesRef.current.forEach((source, id) => {
      if (!currentIds.has(id)) {
        source.video.remove();
        videoSourcesRef.current.delete(id);
      }
    });

    return () => {
      videoSourcesRef.current.forEach((source) => {
        source.video.pause();
        source.video.remove();
      });
      videoSourcesRef.current.clear();
    };
  }, [project?.media]);

  // Seek all videos to current time
  const seekVideos = useCallback(() => {
    if (!project) return;

    project.tracks.forEach((track) => {
      if (track.type !== 'video') return;

      track.clips.forEach((clip) => {
        const source = videoSourcesRef.current.get(clip.mediaId);
        if (!source?.ready) return;

        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        if (currentTime >= clipStart && currentTime < clipEnd) {
          // Calculate position within source media
          const relativeTime = currentTime - clipStart;
          const sourceTime = clip.inPoint + relativeTime;

          // Only seek if significantly different
          if (Math.abs(source.video.currentTime - sourceTime) > 0.1) {
            source.video.currentTime = sourceTime;
          }
        }
      });
    });
  }, [project, currentTime]);

  // Render frame to canvas
  const renderFrame = useCallback(() => {
    if (!canvasRef.current || !project) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Set canvas size
    canvas.width = project.resolution.width;
    canvas.height = project.resolution.height;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find active video clips
    const activeClips: Array<{
      clip: typeof project.tracks[0]['clips'][0];
      source: VideoSource;
      track: typeof project.tracks[0];
    }> = [];

    project.tracks.forEach((track) => {
      if (!track.visible || track.type !== 'video') return;

      track.clips.forEach((clip) => {
        const source = videoSourcesRef.current.get(clip.mediaId);
        if (!source?.ready) return;

        if (
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          activeClips.push({ clip, source, track });
        }
      });
    });

    // Render video tracks (first to last, so later tracks overlay)
    activeClips.forEach(({ clip, source }) => {
      ctx.save();

      // Apply opacity
      ctx.globalAlpha = clip.opacity;

      // Calculate source position
      const relativeTime = currentTime - clip.startTime;
      const sourceTime = clip.inPoint + relativeTime;

      // Ensure video is at correct time
      if (Math.abs(source.video.currentTime - sourceTime) > 0.05) {
        source.video.currentTime = sourceTime;
      }

      // Draw video frame
      try {
        const videoAspect = source.video.videoWidth / source.video.videoHeight;
        const canvasAspect = canvas.width / canvas.height;

        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let drawX = 0;
        let drawY = 0;

        if (videoAspect > canvasAspect) {
          // Video is wider
          drawHeight = canvas.width / videoAspect;
          drawY = (canvas.height - drawHeight) / 2;
        } else {
          // Video is taller
          drawWidth = canvas.height * videoAspect;
          drawX = (canvas.width - drawWidth) / 2;
        }

        ctx.drawImage(source.video, drawX, drawY, drawWidth, drawHeight);
      } catch (err) {
        // Video not ready yet
      }

      ctx.restore();
    });

    // Render images
    project.tracks.forEach((track) => {
      if (!track.visible || track.type !== 'video') return;

      track.clips.forEach((clip) => {
        const media = project.media.find((m) => m.id === clip.mediaId);
        if (!media || media.type !== 'image') return;

        if (
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          const img = new Image();
          img.src = media.path;
          ctx.globalAlpha = clip.opacity;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
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
      ctx.textBaseline = 'middle';

      const textWidth = ctx.measureText(caption.text).width;
      let x = canvas.width / 2;
      let y = canvas.height - 80;

      if (style.position === 'top') {
        y = 80;
      } else if (style.position === 'center') {
        y = canvas.height / 2;
      }

      if (style.alignment === 'left') {
        x = 40;
      } else if (style.alignment === 'right') {
        x = canvas.width - 40;
      }

      // Background box
      if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        const padding = 12;
        const bgX = style.alignment === 'center' ? x - textWidth / 2 - padding : x - padding;
        const bgWidth = textWidth + padding * 2;
        const bgHeight = style.fontSize + padding;

        ctx.fillStyle = style.backgroundColor;
        ctx.roundRect(bgX, y - bgHeight / 2, bgWidth, bgHeight, 6);
        ctx.fill();
      }

      // Text shadow
      if (style.shadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // Text outline
      if (style.outline) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(caption.text, x, y);
      }

      // Text fill
      ctx.fillStyle = style.color;
      ctx.shadowColor = 'transparent';
      ctx.fillText(caption.text, x, y);
    });
  }, [project, currentTime]);

  // Animation loop for playback
  useEffect(() => {
    let lastTimestamp = performance.now();

    const animate = (timestamp: number) => {
      if (!isPlaying || !project) return;

      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const newTime = currentTime + delta;

      if (newTime >= project.duration) {
        pause();
        setCurrentTime(0);
      } else {
        setCurrentTime(newTime);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, project, currentTime, setCurrentTime, pause]);

  // Render on time change
  useEffect(() => {
    seekVideos();
    renderFrame();
  }, [currentTime, seekVideos, renderFrame]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="text-muted-foreground">No project loaded</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="max-h-full max-w-full bg-black"
      style={{
        aspectRatio: `${project.resolution.width} / ${project.resolution.height}`,
      }}
    />
  );
}
