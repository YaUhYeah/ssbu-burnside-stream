import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/lib/utils';

export function Preview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const {
    project,
    currentTime,
    isPlaying,
    setCurrentTime,
    pause,
  } = useProjectStore();

  // Handle playback
  useEffect(() => {
    if (!project) return;

    const updateTime = () => {
      if (isPlaying) {
        setCurrentTime(currentTime + 1 / 60); // 60fps update

        // Stop at end
        if (currentTime >= project.duration) {
          pause();
          setCurrentTime(0);
        }

        animationRef.current = requestAnimationFrame(updateTime);
      }
    };

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentTime, project, setCurrentTime, pause]);

  // Render preview
  useEffect(() => {
    if (!project || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on project resolution
    canvas.width = project.resolution.width;
    canvas.height = project.resolution.height;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find active clips at current time
    const activeClips: Array<{
      clip: typeof project.tracks[0]['clips'][0];
      media: typeof project.media[0];
      track: typeof project.tracks[0];
    }> = [];

    project.tracks.forEach((track) => {
      if (!track.visible || track.muted) return;

      track.clips.forEach((clip) => {
        if (
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration
        ) {
          const media = project.media.find((m) => m.id === clip.mediaId);
          if (media) {
            activeClips.push({ clip, media, track });
          }
        }
      });
    });

    // Render video tracks (bottom to top)
    const videoClips = activeClips.filter((c) => c.track.type === 'video');
    videoClips.forEach(({ clip, media }) => {
      if (media.thumbnail) {
        const img = new Image();
        img.src = media.thumbnail;
        img.onload = () => {
          ctx.globalAlpha = clip.opacity;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
        };
      }
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

        {/* Hidden video element for actual playback */}
        <video ref={videoRef} className="hidden" muted={isMuted} />
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
