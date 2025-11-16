import { useRef, useState, useEffect, useMemo } from 'react';
import { Plus, Minus, Lock, Eye, EyeOff, Volume2, VolumeX, Trash2, X, Magnet, Maximize, RotateCcw, Unlink } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { cn, formatTime, timeToPixels, pixelsToTime } from '@/lib/utils';
import toast from 'react-hot-toast';

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; trackId: string; clipId: string } | null>(null);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'left' | 'right' | null>(null);
  const [pendingDrag, setPendingDrag] = useState(false);
  const [dragThresholdMet, setDragThresholdMet] = useState(false);

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
    removeClip,
    removeTrack,
    updateProject,
    separateVideoAudio,
  } = useProjectStore();

  const pixelsPerSecond = 50;

  // Calculate snap points from all clip edges
  const snapPoints = useMemo(() => {
    if (!project) return [];
    const points = new Set<number>();
    points.add(0); // Start of timeline
    points.add(currentTime); // Playhead

    project.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.id !== dragClipId) {
          points.add(clip.startTime);
          points.add(clip.startTime + clip.duration);
        }
      });
    });

    return Array.from(points).sort((a, b) => a - b);
  }, [project, dragClipId, currentTime]);

  // Snap to nearest point (magnetic snap)
  const snapToNearestPoint = (time: number, threshold = 0.3): number => {
    if (!project?.settings.snapToGrid) return time;

    let nearestPoint = time;
    let nearestDistance = threshold;

    for (const point of snapPoints) {
      const distance = Math.abs(time - point);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = point;
      }
    }

    if (nearestPoint !== time) {
      setSnapGuideTime(nearestPoint);
    } else {
      setSnapGuideTime(null);
    }

    return nearestPoint;
  };

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
    _trackId: string,
    clipId: string,
    clipStartTime: number
  ) => {
    e.stopPropagation();
    // Select immediately on click (don't require drag)
    selectClip(clipId, e.ctrlKey || e.metaKey);
    // Set up potential drag (only start actual drag after threshold)
    setPendingDrag(true);
    setDragThresholdMet(false);
    setDragClipId(clipId);
    setDragStartX(e.clientX);
    setDragStartTime(clipStartTime);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragClipId || !project) return;

    if (isResizing && resizeEdge) {
      // Handle clip resizing
      const deltaX = e.clientX - dragStartX;
      const deltaTime = pixelsToTime(deltaX, zoom, pixelsPerSecond);

      for (const track of project.tracks) {
        const clip = track.clips.find((c) => c.id === dragClipId);
        if (clip) {
          if (resizeEdge === 'left') {
            let newStartTime = dragStartTime + deltaTime;
            newStartTime = snapToNearestPoint(newStartTime);
            newStartTime = Math.max(0, newStartTime);
            const maxStart = clip.startTime + clip.duration - 0.5;
            newStartTime = Math.min(newStartTime, maxStart);

            const durationDelta = clip.startTime - newStartTime;
            updateClip(track.id, clip.id, {
              startTime: newStartTime,
              duration: clip.duration + durationDelta,
              inPoint: Math.max(0, clip.inPoint - durationDelta),
            });
          } else {
            let newEndTime = dragStartTime + deltaTime;
            newEndTime = snapToNearestPoint(newEndTime);
            const newDuration = Math.max(0.5, newEndTime - clip.startTime);
            updateClip(track.id, clip.id, {
              duration: newDuration,
              outPoint: clip.inPoint + newDuration,
            });
          }
          break;
        }
      }
    } else if (pendingDrag || isDragging) {
      // Check if drag threshold is met (5 pixels)
      const deltaX = e.clientX - dragStartX;

      if (!dragThresholdMet && Math.abs(deltaX) > 5) {
        setDragThresholdMet(true);
        setIsDragging(true);
        setPendingDrag(false);
      }

      if (isDragging || dragThresholdMet) {
        // Handle clip dragging
        const deltaTime = pixelsToTime(deltaX, zoom, pixelsPerSecond);
        let newTime = dragStartTime + deltaTime;

        // Snap to nearest clip edge or grid
        newTime = snapToNearestPoint(newTime);
        newTime = Math.max(0, newTime);

        // Find and update the clip
        for (const track of project.tracks) {
          const clip = track.clips.find((c) => c.id === dragClipId);
          if (clip) {
            updateClip(track.id, clip.id, { startTime: newTime });
            break;
          }
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeEdge(null);
    setDragClipId(null);
    setSnapGuideTime(null);
    setPendingDrag(false);
    setDragThresholdMet(false);
  };

  // Handle clip resize
  const handleResizeMouseDown = (
    e: React.MouseEvent,
    clipId: string,
    edge: 'left' | 'right',
    clipTime: number
  ) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeEdge(edge);
    setDragClipId(clipId);
    setDragStartX(e.clientX);
    setDragStartTime(clipTime);
  };

  useEffect(() => {
    if (isDragging || isResizing || pendingDrag) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, pendingDrag, dragClipId, dragStartX, dragStartTime, resizeEdge, dragThresholdMet]);

  // Handle keyboard shortcuts for clip deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipIds.length > 0 && project) {
        e.preventDefault();
        // Find and remove selected clips
        for (const clipId of selectedClipIds) {
          for (const track of project.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              removeClip(track.id, clipId);
              break;
            }
          }
        }
        deselectAllClips();
        toast.success(`Removed ${selectedClipIds.length} clip${selectedClipIds.length > 1 ? 's' : ''}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, project, removeClip, deselectAllClips]);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleClipContextMenu = (e: React.MouseEvent, trackId: string, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, trackId, clipId });
  };

  const handleDeleteClip = (trackId: string, clipId: string) => {
    removeClip(trackId, clipId);
    deselectAllClips();
    setContextMenu(null);
    toast.success('Clip removed');
  };

  const handleDeleteTrack = (trackId: string, trackName: string) => {
    if (project && project.tracks.length <= 1) {
      toast.error('Cannot delete the last track');
      return;
    }
    removeTrack(trackId);
    toast.success(`Removed ${trackName}`);
  };

  const handleSeparateAudio = (trackId: string, clipId: string) => {
    const track = project?.tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    const media = project?.media.find((m) => m.id === clip?.mediaId);

    if (media?.type !== 'video') {
      toast.error('Only video clips can be separated');
      return;
    }

    separateVideoAudio(trackId, clipId);
    setContextMenu(null);
    toast.success('Audio separated from video');
  };

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
              <div className="mx-2 h-6 w-px bg-border" />
              <button
                onClick={() =>
                  updateProject({
                    settings: {
                      ...project.settings,
                      snapToGrid: !project.settings.snapToGrid,
                    },
                  })
                }
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-xs',
                  project.settings.snapToGrid
                    ? 'bg-primary/20 text-primary hover:bg-primary/30'
                    : 'hover:bg-accent'
                )}
                title={project.settings.snapToGrid ? 'Disable snap' : 'Enable snap'}
              >
                <Magnet className="h-3 w-3" />
                Snap
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // Fit timeline to view
              if (containerRef.current && project.duration > 0) {
                const viewWidth = containerRef.current.clientWidth - 48; // account for headers
                const newZoom = viewWidth / (project.duration * pixelsPerSecond);
                setZoom(Math.max(0.1, Math.min(10, newZoom)));
              }
            }}
            className="rounded p-1 hover:bg-accent"
            title="Fit to view"
          >
            <Maximize className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="rounded p-1 hover:bg-accent"
            title="Reset zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <div className="mx-1 h-6 w-px bg-border" />
          <button
            onClick={() => setZoom(Math.max(0.1, zoom - 0.2))}
            className="rounded p-1 hover:bg-accent"
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="range"
            min="10"
            max="500"
            value={zoom * 100}
            onChange={(e) => setZoom(parseInt(e.target.value) / 100)}
            className="h-1 w-24 appearance-none rounded-full bg-border"
            title={`Zoom: ${Math.round(zoom * 100)}%`}
          />
          <span className="w-12 text-xs text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(10, zoom + 0.2))}
            className="rounded p-1 hover:bg-accent"
            title="Zoom in"
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
              className="group flex items-center justify-between border-b border-border px-2"
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
                  title={track.muted ? 'Unmute' : 'Mute'}
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
                  title={track.visible ? 'Hide' : 'Show'}
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
                  title={track.locked ? 'Unlock' : 'Lock'}
                >
                  <Lock className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDeleteTrack(track.id, track.name)}
                  className="rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                  title="Delete track"
                >
                  <X className="h-3 w-3" />
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
                        'timeline-clip group/clip',
                        selectedClipIds.includes(clip.id) &&
                          'ring-2 ring-yellow-400',
                        track.type === 'audio' && 'bg-green-500/80',
                        track.type === 'caption' && 'bg-yellow-500/80',
                        (isDragging || isResizing) && dragClipId === clip.id && 'dragging'
                      )}
                      style={{ left, width: Math.max(width, 20) }}
                      onMouseDown={(e) =>
                        handleClipMouseDown(
                          e,
                          track.id,
                          clip.id,
                          clip.startTime
                        )
                      }
                      onContextMenu={(e) => handleClipContextMenu(e, track.id, clip.id)}
                    >
                      {/* Waveform visualization */}
                      {media?.waveform && media.waveform.length > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-40">
                          <svg
                            className="h-full w-full"
                            preserveAspectRatio="none"
                            viewBox={`0 0 ${media.waveform.length} 100`}
                          >
                            {media.waveform.map((value, i) => {
                              const height = Math.max(2, value * 80);
                              const y = (100 - height) / 2;
                              return (
                                <rect
                                  key={i}
                                  x={i}
                                  y={y}
                                  width="1"
                                  height={height}
                                  fill="currentColor"
                                  className="text-white"
                                />
                              );
                            })}
                          </svg>
                        </div>
                      )}

                      <div className="flex h-full flex-col justify-between p-1 pointer-events-none relative z-10">
                        <span className="truncate text-[10px] font-medium text-white drop-shadow-sm">
                          {media?.name || 'Unknown'}
                        </span>
                        <span className="text-[9px] text-white/70 drop-shadow-sm">
                          {formatTime(clip.duration)}
                        </span>
                      </div>

                      {/* Resize handles */}
                      <div
                        className="absolute left-0 top-0 h-full w-2 cursor-w-resize bg-white/0 hover:bg-white/30 group-hover/clip:bg-white/20 z-20"
                        onMouseDown={(e) =>
                          handleResizeMouseDown(e, clip.id, 'left', clip.startTime)
                        }
                      />
                      <div
                        className="absolute right-0 top-0 h-full w-2 cursor-e-resize bg-white/0 hover:bg-white/30 group-hover/clip:bg-white/20 z-20"
                        onMouseDown={(e) =>
                          handleResizeMouseDown(
                            e,
                            clip.id,
                            'right',
                            clip.startTime + clip.duration
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Snap guide line */}
            {snapGuideTime !== null && (
              <div
                className="absolute top-0 bottom-0 w-px bg-yellow-400 z-20 pointer-events-none"
                style={{
                  left: timeToPixels(snapGuideTime, zoom, pixelsPerSecond),
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full" />
              </div>
            )}

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

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-32 rounded-md border border-border bg-card py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const track = project.tracks.find((t) => t.id === contextMenu.trackId);
            const clip = track?.clips.find((c) => c.id === contextMenu.clipId);
            const media = project.media.find((m) => m.id === clip?.mediaId);
            const isVideoClip = media?.type === 'video';
            return (
              <>
                {isVideoClip && (
                  <button
                    onClick={() => handleSeparateAudio(contextMenu.trackId, contextMenu.clipId)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  >
                    <Unlink className="h-4 w-4" />
                    Separate Audio
                  </button>
                )}
                <button
                  onClick={() => handleDeleteClip(contextMenu.trackId, contextMenu.clipId)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Clip
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
