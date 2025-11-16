import { useRef, useState, useEffect } from 'react';
import { Plus, Minus, Lock, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { cn, formatTime, timeToPixels, pixelsToTime, snapToGrid } from '@/lib/utils';

interface TimelineProps {
  simplified?: boolean;
}

export function Timeline({ simplified = false }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);

  const {
    project,
    zoom,
    setZoom,
    currentTime,
    setCurrentTime,
    scrollPosition,
    setScrollPosition,
    selectedClipIds,
    selectClip,
    deselectAllClips,
    updateClip,
    updateTrack,
    addTrack,
  } = useProjectStore();

  const pixelsPerSecond = 50;

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollPosition(container.scrollLeft);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [setScrollPosition]);

  // Handle click on timeline to set playhead
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || isDragging) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollPosition;
    const time = pixelsToTime(x, zoom, pixelsPerSecond);

    setCurrentTime(Math.max(0, time));
    deselectAllClips();
  };

  // Handle clip drag
  const handleClipMouseDown = (
    e: React.MouseEvent,
    trackId: string,
    clipId: string,
    clipStartTime: number
  ) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragClipId(clipId);
    setDragStartX(e.clientX);
    setDragStartTime(clipStartTime);
    selectClip(clipId, e.ctrlKey || e.metaKey);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !dragClipId || !project) return;

    const deltaX = e.clientX - dragStartX;
    const deltaTime = pixelsToTime(deltaX, zoom, pixelsPerSecond);
    let newTime = dragStartTime + deltaTime;

    // Snap to grid if enabled
    if (project.settings.snapToGrid) {
      newTime = snapToGrid(newTime, project.settings.gridSize);
    }

    newTime = Math.max(0, newTime);

    // Find and update the clip
    for (const track of project.tracks) {
      const clip = track.clips.find((c) => c.id === dragClipId);
      if (clip) {
        updateClip(track.id, clipId, { startTime: newTime });
        break;
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragClipId(null);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragClipId, dragStartX, dragStartTime]);

  if (!project) return null;

  const timelineWidth = Math.max(
    1000,
    timeToPixels(project.duration + 60, zoom, pixelsPerSecond)
  );

  const renderRuler = () => {
    const marks = [];
    const interval = zoom > 2 ? 1 : zoom > 0.5 ? 5 : 10;
    const duration = project.duration + 60;

    for (let i = 0; i <= duration; i += interval) {
      const x = timeToPixels(i, zoom, pixelsPerSecond);
      marks.push(
        <div
          key={i}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: x }}
        >
          <div className="h-3 w-px bg-border" />
          <span className="text-[10px] text-muted-foreground">
            {formatTime(i).split('.')[0]}
          </span>
        </div>
      );
    }

    return marks;
  };

  return (
    <div className="flex h-full flex-col border-t border-border">
      {/* Timeline toolbar */}
      <div className="flex h-10 items-center justify-between border-b border-border bg-muted/30 px-4">
        <div className="flex items-center gap-2">
          {!simplified && (
            <>
              <button
                onClick={() => addTrack('video')}
                className="rounded px-2 py-1 text-xs hover:bg-accent"
              >
                + Video Track
              </button>
              <button
                onClick={() => addTrack('audio')}
                className="rounded px-2 py-1 text-xs hover:bg-accent"
              >
                + Audio Track
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(0.1, zoom - 0.2))}
            className="rounded p-1 hover:bg-accent"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-xs">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(10, zoom + 0.2))}
            className="rounded p-1 hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track headers */}
        <div className="w-48 flex-shrink-0 border-r border-border bg-muted/20">
          {/* Ruler header */}
          <div className="h-6 border-b border-border" />

          {/* Track headers */}
          {project.tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between border-b border-border px-2"
              style={{ height: track.height }}
            >
              <span className="text-xs font-medium truncate">{track.name}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    updateTrack(track.id, { muted: !track.muted })
                  }
                  className={cn(
                    'rounded p-1 hover:bg-accent',
                    track.muted && 'text-destructive'
                  )}
                >
                  {track.muted ? (
                    <VolumeX className="h-3 w-3" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                </button>
                <button
                  onClick={() =>
                    updateTrack(track.id, { visible: !track.visible })
                  }
                  className={cn(
                    'rounded p-1 hover:bg-accent',
                    !track.visible && 'text-destructive'
                  )}
                >
                  {track.visible ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                </button>
                <button
                  onClick={() =>
                    updateTrack(track.id, { locked: !track.locked })
                  }
                  className={cn(
                    'rounded p-1 hover:bg-accent',
                    track.locked && 'text-yellow-500'
                  )}
                >
                  <Lock className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline tracks */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div
            ref={timelineRef}
            className="relative"
            style={{ width: timelineWidth }}
            onClick={handleTimelineClick}
          >
            {/* Ruler */}
            <div className="timeline-ruler sticky top-0 z-10">
              {renderRuler()}
            </div>

            {/* Tracks */}
            {project.tracks.map((track) => (
              <div
                key={track.id}
                className={cn(
                  'timeline-track border-b border-border',
                  track.locked && 'opacity-50'
                )}
                style={{ height: track.height }}
              >
                {/* Clips */}
                {track.clips.map((clip) => {
                  const media = project.media.find(
                    (m) => m.id === clip.mediaId
                  );
                  const left = timeToPixels(
                    clip.startTime,
                    zoom,
                    pixelsPerSecond
                  );
                  const width = timeToPixels(
                    clip.duration,
                    zoom,
                    pixelsPerSecond
                  );

                  return (
                    <div
                      key={clip.id}
                      className={cn(
                        'timeline-clip',
                        selectedClipIds.includes(clip.id) &&
                          'ring-2 ring-yellow-400',
                        track.type === 'audio' && 'bg-green-500/80',
                        track.type === 'caption' && 'bg-yellow-500/80'
                      )}
                      style={{ left, width }}
                      onMouseDown={(e) =>
                        handleClipMouseDown(
                          e,
                          track.id,
                          clip.id,
                          clip.startTime
                        )
                      }
                    >
                      <div className="flex h-full flex-col justify-between p-1">
                        <span className="truncate text-[10px] font-medium text-white">
                          {media?.name || 'Unknown'}
                        </span>
                        <span className="text-[9px] text-white/70">
                          {formatTime(clip.duration)}
                        </span>
                      </div>

                      {/* Resize handles */}
                      <div className="absolute left-0 top-0 h-full w-1 cursor-w-resize bg-white/20 hover:bg-white/40" />
                      <div className="absolute right-0 top-0 h-full w-1 cursor-e-resize bg-white/20 hover:bg-white/40" />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Playhead */}
            <div
              className="timeline-playhead"
              style={{
                left: timeToPixels(currentTime, zoom, pixelsPerSecond),
              }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
