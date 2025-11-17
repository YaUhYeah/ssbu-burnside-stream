import { useRef, useState, useEffect, useMemo } from 'react';
import { Plus, Minus, Lock, Eye, EyeOff, Volume2, VolumeX, Trash2, X, Magnet, Maximize, RotateCcw, Unlink, Scissors, Copy, SkipBack, SkipForward, ArrowLeftRight } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { cn, formatTime, timeToPixels, pixelsToTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface TimelineProps {
  simplified?: boolean;
}

type TimelineTool = 'select' | 'razor' | 'slip' | 'ripple';

export function Timeline({ simplified = false }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const [, setDragStartX] = useState(0);
  const [, setDragStartTime] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; trackId: string; clipId: string } | null>(null);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [, setResizeEdge] = useState<'left' | 'right' | null>(null);
  const [, setPendingDrag] = useState(false);
  const [, setDragThresholdMet] = useState(false);
  const [activeTool, setActiveTool] = useState<TimelineTool>('select');
  const [hoveredClip, setHoveredClip] = useState<{ id: string; info: string } | null>(null);
  const [rippleMode, setRippleMode] = useState(false);

  // Marquee selection state
  const [marqueeSelection, setMarqueeSelection] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
  } | null>(null);

  // Use refs for values that need to be current in event handlers
  const dragStateRef = useRef({
    dragClipId: null as string | null,
    dragStartX: 0,
    dragStartTime: 0,
    pendingDrag: false,
    isDragging: false,
    isResizing: false,
    resizeEdge: null as 'left' | 'right' | null,
    dragThresholdMet: false,
  });

  const marqueeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

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
    addClip,
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
    if (!timelineRef.current || isDragging || marqueeRef.current.active) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollPosition;
    const time = pixelsToTime(x, zoom, pixelsPerSecond);

    setCurrentTime(Math.max(0, time));

    // Deselect clips when clicking on empty timeline area
    if (selectedClipIds.length > 0) {
      deselectAllClips();
    }
  };

  // Handle marquee selection start
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;

    // Only start marquee on left click and not on a clip
    if (e.button !== 0) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollPosition;
    const y = e.clientY - rect.top;

    marqueeRef.current = {
      active: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    };

    setMarqueeSelection({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      active: true,
    });
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
    // Update both state and ref
    dragStateRef.current = {
      ...dragStateRef.current,
      dragClipId: clipId,
      dragStartX: e.clientX,
      dragStartTime: clipStartTime,
      pendingDrag: true,
      dragThresholdMet: false,
    };
    setPendingDrag(true);
    setDragThresholdMet(false);
    setDragClipId(clipId);
    setDragStartX(e.clientX);
    setDragStartTime(clipStartTime);
  };

  // Use a stable event handler that reads from refs
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle marquee selection
      if (marqueeRef.current.active && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollPosition;
        const y = e.clientY - rect.top;

        marqueeRef.current.currentX = x;
        marqueeRef.current.currentY = y;

        setMarqueeSelection({
          startX: marqueeRef.current.startX,
          startY: marqueeRef.current.startY,
          currentX: x,
          currentY: y,
          active: true,
        });
        return;
      }

      const state = dragStateRef.current;
      if (!state.dragClipId || !project) return;

      if (state.isResizing && state.resizeEdge) {
        // Handle clip resizing
        const deltaX = e.clientX - state.dragStartX;
        const deltaTime = pixelsToTime(deltaX, zoom, pixelsPerSecond);

        for (const track of project.tracks) {
          const clip = track.clips.find((c) => c.id === state.dragClipId);
          if (clip) {
            if (state.resizeEdge === 'left') {
              let newStartTime = state.dragStartTime + deltaTime;
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
              let newEndTime = state.dragStartTime + deltaTime;
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
      } else if (state.pendingDrag || state.isDragging) {
        // Check if drag threshold is met (5 pixels)
        const deltaX = e.clientX - state.dragStartX;

        if (!state.dragThresholdMet && Math.abs(deltaX) > 5) {
          dragStateRef.current.dragThresholdMet = true;
          dragStateRef.current.isDragging = true;
          dragStateRef.current.pendingDrag = false;
          setDragThresholdMet(true);
          setIsDragging(true);
          setPendingDrag(false);
        }

        if (state.isDragging || state.dragThresholdMet) {
          // Handle clip dragging
          const deltaTime = pixelsToTime(deltaX, zoom, pixelsPerSecond);
          let newTime = state.dragStartTime + deltaTime;

          // Snap to nearest clip edge or grid
          newTime = snapToNearestPoint(newTime);
          newTime = Math.max(0, newTime);

          // Find and update the clip
          for (const track of project.tracks) {
            const clip = track.clips.find((c) => c.id === state.dragClipId);
            if (clip) {
              updateClip(track.id, clip.id, { startTime: newTime });
              break;
            }
          }
        }
      }
    };

    const handleMouseUp = () => {
      // Finalize marquee selection
      if (marqueeRef.current.active) {
        const minX = Math.min(marqueeRef.current.startX, marqueeRef.current.currentX);
        const maxX = Math.max(marqueeRef.current.startX, marqueeRef.current.currentX);
        const minY = Math.min(marqueeRef.current.startY, marqueeRef.current.currentY);
        const maxY = Math.max(marqueeRef.current.startY, marqueeRef.current.currentY);

        // Only select if marquee has some size (avoid accidental clicks)
        const width = maxX - minX;
        const height = maxY - minY;

        if (width > 5 || height > 5) {
          // Calculate which clips are in the marquee
          const clipIds: string[] = [];
          let trackY = 24; // Start after ruler height

          if (project) {
            project.tracks.forEach((track) => {
              const trackTop = trackY;
              const trackBottom = trackY + track.height;

              // Check if marquee overlaps with track vertically
              if (minY <= trackBottom && maxY >= trackTop) {
                track.clips.forEach((clip) => {
                  const clipLeft = timeToPixels(clip.startTime, zoom, pixelsPerSecond);
                  const clipRight = timeToPixels(clip.startTime + clip.duration, zoom, pixelsPerSecond);

                  // Check if marquee overlaps with clip horizontally
                  if (minX <= clipRight && maxX >= clipLeft) {
                    clipIds.push(clip.id);
                  }
                });
              }

              trackY += track.height;
            });
          }

          // Select all clips in marquee
          if (clipIds.length > 0) {
            deselectAllClips();
            clipIds.forEach((id, index) => {
              selectClip(id, index > 0); // Add to selection for all but first
            });
            toast.success(`Selected ${clipIds.length} clip${clipIds.length > 1 ? 's' : ''}`);
          }
        }

        marqueeRef.current = {
          active: false,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
        };
        setMarqueeSelection(null);
      }

      dragStateRef.current = {
        dragClipId: null,
        dragStartX: 0,
        dragStartTime: 0,
        pendingDrag: false,
        isDragging: false,
        isResizing: false,
        resizeEdge: null,
        dragThresholdMet: false,
      };
      setIsDragging(false);
      setIsResizing(false);
      setResizeEdge(null);
      setDragClipId(null);
      setSnapGuideTime(null);
      setPendingDrag(false);
      setDragThresholdMet(false);
    };

    // Always attach these handlers - they check state internally
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [project, zoom, snapToNearestPoint, updateClip, scrollPosition, selectClip, deselectAllClips]);

  // Handle clip resize
  const handleResizeMouseDown = (
    e: React.MouseEvent,
    clipId: string,
    edge: 'left' | 'right',
    clipTime: number
  ) => {
    e.stopPropagation();

    // Update both state and ref for consistency
    dragStateRef.current = {
      ...dragStateRef.current,
      dragClipId: clipId,
      dragStartX: e.clientX,
      dragStartTime: clipTime,
      isResizing: true,
      resizeEdge: edge,
      pendingDrag: false,
      isDragging: false,
    };

    setIsResizing(true);
    setResizeEdge(edge);
    setDragClipId(clipId);
    setDragStartX(e.clientX);
    setDragStartTime(clipTime);
  };

  // Handle keyboard shortcuts for timeline operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Delete/Backspace - Remove clips (with ripple if enabled)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipIds.length > 0 && project) {
        e.preventDefault();
        // Inline ripple delete
        const deletionInfo: { trackId: string; clipId: string; startTime: number; duration: number }[] = [];
        selectedClipIds.forEach((clipId) => {
          for (const track of project.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              deletionInfo.push({ trackId: track.id, clipId: clip.id, startTime: clip.startTime, duration: clip.duration });
              break;
            }
          }
        });
        deletionInfo.forEach(({ trackId, clipId }) => removeClip(trackId, clipId));
        if (rippleMode) {
          deletionInfo.forEach(({ trackId, startTime, duration }) => {
            const track = project.tracks.find((t) => t.id === trackId);
            if (track) {
              track.clips.forEach((clip) => {
                if (clip.startTime > startTime) {
                  updateClip(trackId, clip.id, { startTime: clip.startTime - duration });
                }
              });
            }
          });
        }
        deselectAllClips();
        toast.success(`Removed ${deletionInfo.length} clip${deletionInfo.length > 1 ? 's' : ''}${rippleMode ? ' (ripple)' : ''}`);
        return;
      }

      // S - Split clip at playhead
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Inline split at playhead
        for (const track of project?.tracks || []) {
          for (const clip of track.clips) {
            if (currentTime > clip.startTime && currentTime < clip.startTime + clip.duration) {
              const splitTime = currentTime - clip.startTime;
              if (splitTime > 0.1 && splitTime < clip.duration - 0.1) {
                updateClip(track.id, clip.id, { duration: splitTime, outPoint: clip.inPoint + splitTime });
                addClip(track.id, {
                  mediaId: clip.mediaId,
                  trackId: track.id,
                  startTime: clip.startTime + splitTime,
                  duration: clip.duration - splitTime,
                  inPoint: clip.inPoint + splitTime,
                  outPoint: clip.outPoint,
                  opacity: clip.opacity,
                  volume: clip.volume,
                  effects: [...clip.effects],
                  transitions: [],
                  locked: false,
                });
                toast.success('Clip split at playhead');
              }
              return;
            }
          }
        }
        toast.error('No clip at playhead position');
        return;
      }

      // D - Duplicate selected clips
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (selectedClipIds.length === 0) {
          toast.error('No clips selected');
          return;
        }
        let count = 0;
        selectedClipIds.forEach((clipId) => {
          for (const track of project?.tracks || []) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              addClip(track.id, {
                mediaId: clip.mediaId,
                trackId: track.id,
                startTime: clip.startTime + clip.duration,
                duration: clip.duration,
                inPoint: clip.inPoint,
                outPoint: clip.outPoint,
                opacity: clip.opacity,
                volume: clip.volume,
                effects: [...clip.effects],
                transitions: [],
                locked: false,
              });
              count++;
              break;
            }
          }
        });
        if (count > 0) toast.success(`Duplicated ${count} clip${count > 1 ? 's' : ''}`);
        return;
      }

      // Arrow keys - Navigate clip edges
      if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        const edges = [0];
        project?.tracks.forEach((t) => t.clips.forEach((c) => { edges.push(c.startTime); edges.push(c.startTime + c.duration); }));
        const uniqueEdges = [...new Set(edges)].sort((a, b) => a - b);
        const prevEdges = uniqueEdges.filter((e) => e < currentTime - 0.01);
        if (prevEdges.length > 0) setCurrentTime(prevEdges[prevEdges.length - 1]);
        return;
      }

      if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        const edges = [0];
        project?.tracks.forEach((t) => t.clips.forEach((c) => { edges.push(c.startTime); edges.push(c.startTime + c.duration); }));
        const uniqueEdges = [...new Set(edges)].sort((a, b) => a - b);
        const nextEdge = uniqueEdges.find((e) => e > currentTime + 0.01);
        if (nextEdge !== undefined) setCurrentTime(nextEdge);
        return;
      }

      // Tool shortcuts
      if (e.key === 'v' || e.key === '1') {
        setActiveTool('select');
        toast.success('Selection tool');
      } else if (e.key === 'c' || e.key === '2') {
        setActiveTool('razor');
        toast.success('Razor tool');
      } else if (e.key === 'y' || e.key === '3') {
        setActiveTool('slip');
        toast.success('Slip tool');
      } else if (e.key === 'r') {
        setRippleMode(!rippleMode);
        toast.success(`Ripple mode ${!rippleMode ? 'enabled' : 'disabled'}`);
      }

      // Escape - Deselect all
      if (e.key === 'Escape') {
        deselectAllClips();
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, project, deselectAllClips, rippleMode, currentTime, removeClip, updateClip, addClip, setCurrentTime]);

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

  // Split clip at playhead position
  const handleSplitClip = (trackId?: string, clipId?: string) => {
    if (!project) return;

    // Find clip at playhead if not specified
    if (!trackId || !clipId) {
      for (const track of project.tracks) {
        for (const clip of track.clips) {
          if (currentTime > clip.startTime && currentTime < clip.startTime + clip.duration) {
            handleSplitClip(track.id, clip.id);
            return;
          }
        }
      }
      toast.error('No clip at playhead position');
      return;
    }

    const track = project.tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    if (!track || !clip) return;

    // Calculate split point relative to clip
    const splitTime = currentTime - clip.startTime;
    if (splitTime <= 0.1 || splitTime >= clip.duration - 0.1) {
      toast.error('Cannot split at clip edges');
      return;
    }

    // Create two clips from the original
    const firstClipDuration = splitTime;
    const secondClipDuration = clip.duration - splitTime;

    // Update original clip to be first half
    updateClip(trackId, clipId, {
      duration: firstClipDuration,
      outPoint: clip.inPoint + firstClipDuration,
    });

    // Create second half as new clip
    addClip(trackId, {
      mediaId: clip.mediaId,
      trackId: trackId,
      startTime: clip.startTime + firstClipDuration,
      duration: secondClipDuration,
      inPoint: clip.inPoint + firstClipDuration,
      outPoint: clip.outPoint,
      opacity: clip.opacity,
      volume: clip.volume,
      effects: [...clip.effects],
      transitions: [],
      locked: false,
    });

    toast.success('Clip split at playhead');
  };

  // Skip to next/previous clip edge
  const handleSkipToClipEdge = (direction: 'next' | 'prev') => {
    if (!project) return;

    const edges: number[] = [0];
    project.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        edges.push(clip.startTime);
        edges.push(clip.startTime + clip.duration);
      });
    });
    edges.push(project.duration);

    const uniqueEdges = [...new Set(edges)].sort((a, b) => a - b);

    if (direction === 'next') {
      const nextEdge = uniqueEdges.find((e) => e > currentTime + 0.01);
      if (nextEdge !== undefined) {
        setCurrentTime(nextEdge);
        toast.success(`Jumped to ${formatTime(nextEdge)}`);
      }
    } else {
      const prevEdges = uniqueEdges.filter((e) => e < currentTime - 0.01);
      if (prevEdges.length > 0) {
        const prevEdge = prevEdges[prevEdges.length - 1];
        setCurrentTime(prevEdge);
        toast.success(`Jumped to ${formatTime(prevEdge)}`);
      }
    }
  };

  // Duplicate selected clips
  const handleDuplicateClips = () => {
    if (!project || selectedClipIds.length === 0) {
      toast.error('No clips selected');
      return;
    }

    let duplicateCount = 0;
    selectedClipIds.forEach((clipId) => {
      for (const track of project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          addClip(track.id, {
            mediaId: clip.mediaId,
            trackId: track.id,
            startTime: clip.startTime + clip.duration,
            duration: clip.duration,
            inPoint: clip.inPoint,
            outPoint: clip.outPoint,
            opacity: clip.opacity,
            volume: clip.volume,
            effects: [...clip.effects],
            transitions: [],
            locked: false,
          });
          duplicateCount++;
          break;
        }
      }
    });

    if (duplicateCount > 0) {
      toast.success(`Duplicated ${duplicateCount} clip${duplicateCount > 1 ? 's' : ''}`);
    }
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
              {/* Tool selection */}
              <div className="flex items-center gap-1 rounded bg-muted p-1">
                <button
                  onClick={() => setActiveTool('select')}
                  className={cn(
                    'rounded p-1.5 text-xs',
                    activeTool === 'select' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  )}
                  title="Selection tool (V)"
                >
                  <ArrowLeftRight className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setActiveTool('razor')}
                  className={cn(
                    'rounded p-1.5 text-xs',
                    activeTool === 'razor' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  )}
                  title="Razor tool (C)"
                >
                  <Scissors className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setRippleMode(!rippleMode)}
                  className={cn(
                    'rounded p-1.5 text-xs',
                    rippleMode ? 'bg-orange-500 text-white' : 'hover:bg-accent'
                  )}
                  title="Ripple mode (R) - shift clips after delete"
                >
                  <ArrowLeftRight className="h-3 w-3 rotate-45" />
                </button>
              </div>

              <div className="mx-1 h-6 w-px bg-border" />

              {/* Quick actions */}
              <button
                onClick={() => handleSplitClip()}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-accent"
                title="Split clip at playhead (S)"
              >
                <Scissors className="h-3 w-3" />
                Split
              </button>
              <button
                onClick={handleDuplicateClips}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-accent"
                title="Duplicate selected clips (D)"
                disabled={selectedClipIds.length === 0}
              >
                <Copy className="h-3 w-3" />
                Duplicate
              </button>
              <button
                onClick={() => handleSkipToClipEdge('prev')}
                className="rounded p-1 text-xs hover:bg-accent"
                title="Previous clip edge (Alt+←)"
              >
                <SkipBack className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleSkipToClipEdge('next')}
                className="rounded p-1 text-xs hover:bg-accent"
                title="Next clip edge (Alt+→)"
              >
                <SkipForward className="h-3 w-3" />
              </button>

              <div className="mx-1 h-6 w-px bg-border" />

              <button
                onClick={() => addTrack('video')}
                className="rounded px-2 py-1 text-xs hover:bg-accent"
              >
                + Video
              </button>
              <button
                onClick={() => addTrack('audio')}
                className="rounded px-2 py-1 text-xs hover:bg-accent"
              >
                + Audio
              </button>

              <div className="mx-1 h-6 w-px bg-border" />

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
                setZoom(Math.max(0.01, Math.min(10, newZoom)));
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
            onClick={() => setZoom(Math.max(0.01, zoom - 0.2))}
            className="rounded p-1 hover:bg-accent"
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="range"
            min="1"
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
            onMouseDown={handleTimelineMouseDown}
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
                        (isDragging || isResizing) && dragClipId === clip.id && 'dragging',
                        activeTool === 'razor' && 'cursor-crosshair'
                      )}
                      style={{ left, width: Math.max(width, 20) }}
                      onMouseDown={(e) => {
                        if (activeTool === 'razor') {
                          e.stopPropagation();
                          handleSplitClip(track.id, clip.id);
                        } else {
                          handleClipMouseDown(
                            e,
                            track.id,
                            clip.id,
                            clip.startTime
                          );
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onContextMenu={(e) => handleClipContextMenu(e, track.id, clip.id)}
                      onMouseEnter={() => {
                        const info = `${media?.name || 'Unknown'}\nStart: ${formatTime(clip.startTime)}\nDuration: ${formatTime(clip.duration)}\nIn: ${formatTime(clip.inPoint)} | Out: ${formatTime(clip.outPoint)}`;
                        setHoveredClip({ id: clip.id, info });
                      }}
                      onMouseLeave={() => setHoveredClip(null)}
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
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white/70 drop-shadow-sm">
                            {formatTime(clip.duration)}
                          </span>
                          {clip.opacity < 1 && (
                            <span className="text-[8px] text-white/60 bg-black/30 px-1 rounded">
                              {Math.round(clip.opacity * 100)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Clip hover tooltip */}
                      {hoveredClip?.id === clip.id && (
                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] p-2 rounded shadow-lg z-50 whitespace-pre pointer-events-none min-w-32">
                          {hoveredClip.info}
                        </div>
                      )}

                      {/* Resize handles */}
                      <div
                        className="absolute left-0 top-0 h-full w-2 cursor-w-resize bg-white/0 hover:bg-white/30 group-hover/clip:bg-white/20 z-20"
                        onMouseDown={(e) =>
                          handleResizeMouseDown(e, clip.id, 'left', clip.startTime)
                        }
                        onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
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

            {/* Marquee selection box */}
            {marqueeSelection?.active && (
              <div
                className="absolute border-2 border-primary bg-primary/10 pointer-events-none z-30"
                style={{
                  left: Math.min(marqueeSelection.startX, marqueeSelection.currentX),
                  top: Math.min(marqueeSelection.startY, marqueeSelection.currentY),
                  width: Math.abs(marqueeSelection.currentX - marqueeSelection.startX),
                  height: Math.abs(marqueeSelection.currentY - marqueeSelection.startY),
                }}
              />
            )}
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
