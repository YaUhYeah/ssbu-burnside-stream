import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import {
  Film,
  Music,
  Type,
  Sparkles,
  Upload,
  Trash2,
  Play,
  LayoutTemplate,
  TextCursor,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { cn, formatFileSize, formatDuration, getMediaType } from '@/lib/utils';
import type { MediaFile, AspectRatio, EffectType, TransitionType, Effect, Transition } from '@/types';
import toast from 'react-hot-toast';
import { ResolutionMatchDialog } from './dialogs/ResolutionMatchDialog';
import { TextPanel } from './TextPanel';

type PanelType = 'media' | 'effects' | 'text' | 'captions' | 'templates' | 'export';

const PANEL_ICONS: Record<PanelType, typeof Film> = {
  media: Film,
  effects: Sparkles,
  text: TextCursor,
  captions: Type,
  templates: LayoutTemplate,
  export: Upload,
};

export function Sidebar() {
  const { currentPanel, setCurrentPanel } = useUIStore();
  const { addMedia, project, updateProject } = useProjectStore();

  // Resolution matching state
  const [pendingMedia, setPendingMedia] = useState<MediaFile | null>(null);
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        const mediaType = getMediaType(file.name);
        if (mediaType === 'unknown') {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }

        // Create object URL for preview
        const url = URL.createObjectURL(file);

        // Get media duration and dimensions
        let duration = 0;
        let width = 0;
        let height = 0;
        let thumbnail = '';

        if (mediaType === 'video') {
          const video = document.createElement('video');
          video.src = url;
          video.preload = 'metadata';

          await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => {
              duration = video.duration;
              width = video.videoWidth;
              height = video.videoHeight;

              // Generate thumbnail at higher quality
              video.currentTime = Math.min(1, video.duration * 0.1);
              video.onseeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 180;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  // Preserve aspect ratio for thumbnail
                  const videoAspect = video.videoWidth / video.videoHeight;
                  const canvasAspect = canvas.width / canvas.height;
                  let drawW = canvas.width;
                  let drawH = canvas.height;
                  let drawX = 0;
                  let drawY = 0;

                  if (videoAspect > canvasAspect) {
                    drawH = canvas.width / videoAspect;
                    drawY = (canvas.height - drawH) / 2;
                  } else {
                    drawW = canvas.height * videoAspect;
                    drawX = (canvas.width - drawW) / 2;
                  }

                  ctx.fillStyle = '#000';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(video, drawX, drawY, drawW, drawH);
                  thumbnail = canvas.toDataURL('image/jpeg', 0.85);
                }
                resolve();
              };
            };
          });
        } else if (mediaType === 'audio') {
          const audio = document.createElement('audio');
          audio.src = url;
          await new Promise<void>((resolve) => {
            audio.onloadedmetadata = () => {
              duration = audio.duration;
              resolve();
            };
          });
        } else if (mediaType === 'image') {
          duration = 5; // Default image duration
          const img = new Image();
          img.src = url;
          await new Promise<void>((resolve) => {
            img.onload = () => {
              width = img.naturalWidth;
              height = img.naturalHeight;
              thumbnail = url;
              resolve();
            };
          });
        }

        const media: MediaFile = {
          id: uuidv4(),
          name: file.name,
          path: url,
          type: mediaType,
          duration,
          size: file.size,
          width,
          height,
          thumbnail,
          createdAt: new Date(),
        };

        // Check for resolution mismatch on first video import
        if (
          project &&
          mediaType === 'video' &&
          width > 0 &&
          height > 0 &&
          (Math.abs(width - project.resolution.width) > 10 ||
            Math.abs(height - project.resolution.height) > 10)
        ) {
          // Show resolution matching dialog
          setPendingMedia(media);
          setShowResolutionDialog(true);
        } else {
          addMedia(media);
          toast.success(`Added ${file.name}`);
        }
      }
    },
    [addMedia, project]
  );

  const handleMatchToMedia = () => {
    if (pendingMedia && project && pendingMedia.width && pendingMedia.height) {
      // Update project resolution to match media
      const mediaWidth = pendingMedia.width;
      const mediaHeight = pendingMedia.height;

      // Determine closest standard aspect ratio
      const mediaAspect = mediaWidth / mediaHeight;
      let aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '4:3' = '16:9';

      if (Math.abs(mediaAspect - 16/9) < 0.1) aspectRatio = '16:9';
      else if (Math.abs(mediaAspect - 9/16) < 0.1) aspectRatio = '9:16';
      else if (Math.abs(mediaAspect - 1) < 0.1) aspectRatio = '1:1';
      else if (Math.abs(mediaAspect - 4/5) < 0.1) aspectRatio = '4:5';
      else if (Math.abs(mediaAspect - 4/3) < 0.1) aspectRatio = '4:3';
      else if (mediaWidth > mediaHeight) aspectRatio = '16:9';
      else aspectRatio = '9:16';

      updateProject({
        resolution: {
          width: mediaWidth,
          height: mediaHeight,
          label: `${mediaWidth}x${mediaHeight}`,
        },
        aspectRatio,
      });

      addMedia(pendingMedia);
      toast.success(`Project resolution updated to ${mediaWidth}x${mediaHeight}`);
    }
    setPendingMedia(null);
    setShowResolutionDialog(false);
  };

  const handleKeepProjectResolution = () => {
    if (pendingMedia) {
      addMedia(pendingMedia);
      toast.success(`Added ${pendingMedia.name} (auto-scaled to project resolution)`);
    }
    setPendingMedia(null);
    setShowResolutionDialog(false);
  };

  const handleCancelImport = () => {
    if (pendingMedia) {
      URL.revokeObjectURL(pendingMedia.path);
    }
    setPendingMedia(null);
    setShowResolutionDialog(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
      'audio/*': ['.mp3', '.wav', '.ogg', '.flac', '.aac'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    },
  });

  const renderPanelContent = () => {
    switch (currentPanel) {
      case 'media':
        return <MediaPanel onDrop={onDrop} isDragActive={isDragActive} getRootProps={getRootProps} getInputProps={getInputProps} />;
      case 'effects':
        return <EffectsPanel />;
      case 'text':
        return <TextPanel />;
      case 'captions':
        return <CaptionsPanel />;
      case 'templates':
        return <TemplatesPanel />;
      default:
        return <MediaPanel onDrop={onDrop} isDragActive={isDragActive} getRootProps={getRootProps} getInputProps={getInputProps} />;
    }
  };

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Panel tabs */}
        <div className="flex border-b border-border">
          {(Object.keys(PANEL_ICONS) as PanelType[]).map((panel) => {
            const Icon = PANEL_ICONS[panel];
            return (
              <button
                key={panel}
                onClick={() => setCurrentPanel(panel)}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs transition-colors',
                  currentPanel === panel
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="capitalize">{panel}</span>
              </button>
            );
          })}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-4">{renderPanelContent()}</div>
      </div>

      {/* Resolution matching dialog */}
      {showResolutionDialog && pendingMedia && project && pendingMedia.width && pendingMedia.height && (
        <ResolutionMatchDialog
          mediaName={pendingMedia.name}
          mediaWidth={pendingMedia.width}
          mediaHeight={pendingMedia.height}
          projectWidth={project.resolution.width}
          projectHeight={project.resolution.height}
          onMatchToMedia={handleMatchToMedia}
          onKeepProject={handleKeepProjectResolution}
          onCancel={handleCancelImport}
        />
      )}
    </>
  );
}

interface MediaPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDrop: any;
  isDragActive: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRootProps: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getInputProps: any;
}

function MediaPanel({ isDragActive, getRootProps, getInputProps }: MediaPanelProps) {
  const { project, removeMedia, addClip } = useProjectStore();

  if (!project) return null;

  const handleAddToTimeline = (media: MediaFile) => {
    const trackType = media.type === 'audio' ? 'audio' : 'video';
    const track = project.tracks.find((t) => t.type === trackType);

    if (track) {
      // Find the end of the last clip in the track
      const lastClipEnd = track.clips.reduce(
        (max, clip) => Math.max(max, clip.startTime + clip.duration),
        0
      );

      addClip(track.id, {
        mediaId: media.id,
        trackId: track.id,
        startTime: lastClipEnd,
        duration: media.duration,
        inPoint: 0,
        outPoint: media.duration,
        volume: 1,
        opacity: 1,
        effects: [],
        transitions: [],
        locked: false,
      });

      toast.success(`Added ${media.name} to timeline`);
    }
  };

  return (
    <div className="space-y-4" data-onboarding="import">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'dropzone flex cursor-pointer flex-col items-center justify-center rounded-lg p-6 text-center',
          isDragActive && 'dropzone-active'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here</p>
        <p className="text-xs text-muted-foreground">or click to browse</p>
      </div>

      {/* Media library */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Media Library</h3>
        {project.media.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No media imported yet. Drag and drop files above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {project.media.map((media) => (
              <div
                key={media.id}
                className="group relative flex items-center gap-3 rounded-md bg-muted/50 p-2 hover:bg-muted"
              >
                {/* Thumbnail */}
                <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded bg-black">
                  {media.thumbnail ? (
                    <img
                      src={media.thumbnail}
                      alt={media.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {media.type === 'audio' ? (
                        <Music className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <Film className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-xs font-medium">{media.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(media.duration)} • {formatFileSize(media.size)}
                  </p>
                </div>

                {/* Actions */}
                <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                  <button
                    onClick={() => handleAddToTimeline(media)}
                    className="rounded bg-primary p-1 text-primary-foreground hover:bg-primary/90"
                    title="Add to timeline"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => {
                      removeMedia(media.id);
                      toast.success('Media removed');
                    }}
                    className="rounded bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
                    title="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EffectsPanel() {
  const { project, selectedClipIds, updateClip } = useProjectStore();
  const [draggingEffect, setDraggingEffect] = useState<string | null>(null);

  const effects = [
    { id: 'brightness', name: 'Brightness', icon: '☀️', value: 1.2 },
    { id: 'contrast', name: 'Contrast', icon: '◐', value: 1.3 },
    { id: 'saturation', name: 'Saturation', icon: '🎨', value: 1.5 },
    { id: 'blur', name: 'Blur', icon: '💨', value: 2 },
    { id: 'sharpen', name: 'Sharpen', icon: '🔍', value: 1.5 },
    { id: 'grayscale', name: 'Grayscale', icon: '⚫', value: 1 },
    { id: 'sepia', name: 'Sepia', icon: '🟤', value: 0.8 },
    { id: 'invert', name: 'Invert', icon: '🔄', value: 1 },
    { id: 'vignette', name: 'Vignette', icon: '🎯', value: 0.5 },
    { id: 'chromatic', name: 'Chromatic', icon: '🌈', value: 3 },
    { id: 'noise', name: 'Film Grain', icon: '📺', value: 0.1 },
    { id: 'glow', name: 'Glow', icon: '✨', value: 10 },
    { id: 'chroma-key', name: 'Chroma Key', icon: '🟩', value: 0.4 },
  ];

  const transitions = [
    { id: 'fade', name: 'Fade', icon: '🌅', duration: 0.5 },
    { id: 'dissolve', name: 'Dissolve', icon: '💫', duration: 0.8 },
    { id: 'wipe-left', name: 'Wipe Left', icon: '👈', duration: 0.6 },
    { id: 'wipe-right', name: 'Wipe Right', icon: '👉', duration: 0.6 },
    { id: 'wipe-up', name: 'Wipe Up', icon: '👆', duration: 0.6 },
    { id: 'wipe-down', name: 'Wipe Down', icon: '👇', duration: 0.6 },
    { id: 'slide-left', name: 'Slide Left', icon: '⬅️', duration: 0.5 },
    { id: 'slide-right', name: 'Slide Right', icon: '➡️', duration: 0.5 },
    { id: 'zoom-in', name: 'Zoom In', icon: '🔎', duration: 0.7 },
    { id: 'zoom-out', name: 'Zoom Out', icon: '🔍', duration: 0.7 },
    { id: 'spin', name: 'Spin', icon: '🔄', duration: 0.8 },
    { id: 'whip', name: 'Whip Pan', icon: '💨', duration: 0.3 },
    { id: 'glitch', name: 'Glitch', icon: '📺', duration: 0.4 },
    { id: 'flash', name: 'Flash', icon: '⚡', duration: 0.2 },
  ];

  const applyEffectToSelected = (effectType: EffectType, value: number) => {
    if (selectedClipIds.length === 0) {
      toast.error('Select a clip first');
      return;
    }

    if (!project) return;

    let applied = 0;
    for (const clipId of selectedClipIds) {
      for (const track of project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          const existingEffects = clip.effects || [];
          const newEffect: Effect = {
            id: uuidv4(),
            type: effectType,
            params: { value, enabled: true },
          };
          updateClip(track.id, clipId, {
            effects: [...existingEffects.filter((e) => e.type !== effectType), newEffect],
          });
          applied++;
          break;
        }
      }
    }

    if (applied > 0) {
      toast.success(`Applied ${effectType} to ${applied} clip${applied > 1 ? 's' : ''}`);
    }
  };

  const applyTransitionToSelected = (transitionType: TransitionType, duration: number) => {
    if (selectedClipIds.length === 0) {
      toast.error('Select a clip first');
      return;
    }

    if (!project) return;

    let applied = 0;
    for (const clipId of selectedClipIds) {
      for (const track of project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          const newTransition: Transition = {
            id: uuidv4(),
            type: transitionType,
            duration,
            position: 'end',
            params: {},
          };
          updateClip(track.id, clipId, {
            transitions: [newTransition],
          });
          applied++;
          break;
        }
      }
    }

    if (applied > 0) {
      toast.success(`Applied ${transitionType} transition to ${applied} clip${applied > 1 ? 's' : ''}`);
    }
  };

  const handleDragStart = (e: React.DragEvent, type: string, id: string) => {
    e.dataTransfer.setData('application/effect-type', type);
    e.dataTransfer.setData('application/effect-id', id);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingEffect(id);
  };

  const handleDragEnd = () => {
    setDraggingEffect(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Video Effects</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Click to apply to selected clip{selectedClipIds.length > 0 ? ` (${selectedClipIds.length} selected)` : ''}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {effects.map((effect) => (
            <button
              key={effect.id}
              draggable
              onDragStart={(e) => handleDragStart(e, 'effect', effect.id)}
              onDragEnd={handleDragEnd}
              onClick={() => applyEffectToSelected(effect.id as EffectType, effect.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-md bg-muted/50 p-3 text-xs transition-all cursor-grab active:cursor-grabbing',
                draggingEffect === effect.id
                  ? 'ring-2 ring-primary opacity-50 scale-95'
                  : 'hover:bg-muted hover:scale-105',
                selectedClipIds.length > 0 && 'hover:ring-2 hover:ring-primary/50'
              )}
            >
              <span className="text-xl">{effect.icon}</span>
              <span className="font-medium">{effect.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Transitions</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Click to add transition to selected clip
        </p>
        <div className="grid grid-cols-2 gap-2">
          {transitions.map((transition) => (
            <button
              key={transition.id}
              draggable
              onDragStart={(e) => handleDragStart(e, 'transition', transition.id)}
              onDragEnd={handleDragEnd}
              onClick={() => applyTransitionToSelected(transition.id as TransitionType, transition.duration)}
              className={cn(
                'flex items-center gap-2 rounded-md bg-muted/50 p-2 text-xs transition-all cursor-grab active:cursor-grabbing',
                draggingEffect === transition.id
                  ? 'ring-2 ring-primary opacity-50 scale-95'
                  : 'hover:bg-muted hover:scale-105',
                selectedClipIds.length > 0 && 'hover:ring-2 hover:ring-primary/50'
              )}
            >
              <span>{transition.icon}</span>
              <span className="font-medium">{transition.name}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedClipIds.length > 0 && (
        <div className="rounded-md bg-primary/10 p-3 text-xs">
          <p className="font-medium text-primary">
            {selectedClipIds.length} clip{selectedClipIds.length > 1 ? 's' : ''} selected
          </p>
          <p className="text-muted-foreground mt-1">
            Click any effect or transition to apply it
          </p>
        </div>
      )}
    </div>
  );
}

function CaptionsPanel() {
  const { project, addCaption } = useProjectStore();
  const { setProcessing, setProcessingProgress } = useUIStore();

  const handleAutoCaption = async () => {
    if (!project || project.media.length === 0) {
      toast.error('No media to generate captions from');
      return;
    }

    setProcessing(true, 'Generating captions...');

    // Simulate AI caption generation
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setProcessingProgress(i);
    }

    // Add sample captions
    const sampleCaptions = [
      { text: 'Welcome to this video!', start: 0, end: 3 },
      { text: 'Today we are going to learn something amazing.', start: 3, end: 7 },
      { text: 'Let me show you how it works.', start: 7, end: 10 },
      { text: 'This is really cool, right?', start: 10, end: 13 },
      { text: 'Thanks for watching!', start: 13, end: 16 },
    ];

    sampleCaptions.forEach((cap) => {
      addCaption({
        id: uuidv4(),
        text: cap.text,
        startTime: cap.start,
        endTime: cap.end,
        style: project.settings.defaultCaptionStyle,
      });
    });

    setProcessing(false);
    toast.success('Generated 5 captions');
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Captions</h3>

      <button
        onClick={handleAutoCaption}
        className="w-full rounded-md bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-purple-600"
      >
        Auto-Generate Captions
      </button>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">Current Captions</h4>
        {project?.captions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No captions yet. Click above to auto-generate or add manually.
          </p>
        ) : (
          project?.captions.map((caption) => (
            <div
              key={caption.id}
              className="rounded-md bg-muted/50 p-2 text-xs"
            >
              <p className="font-medium">{caption.text}</p>
              <p className="text-muted-foreground">
                {caption.startTime.toFixed(1)}s - {caption.endTime.toFixed(1)}s
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TemplatesPanel() {
  const { project, updateProject } = useProjectStore();

  const templates = [
    {
      id: 'gaming-highlight',
      name: 'Gaming Highlight',
      category: 'Gaming',
      duration: 30,
      description: 'Fast-paced cuts with zoom transitions',
      aspectRatio: '16:9' as AspectRatio,
      effects: ['contrast', 'saturation'],
      transitions: ['zoom-in', 'whip'],
    },
    {
      id: 'vlog-intro',
      name: 'Vlog Intro',
      category: 'Vlog',
      duration: 15,
      description: 'Smooth fades with warm color grading',
      aspectRatio: '16:9' as AspectRatio,
      effects: ['brightness', 'sepia'],
      transitions: ['fade', 'dissolve'],
    },
    {
      id: 'product-showcase',
      name: 'Product Showcase',
      category: 'Product',
      duration: 60,
      description: 'Clean slides with professional look',
      aspectRatio: '16:9' as AspectRatio,
      effects: ['sharpen', 'contrast'],
      transitions: ['slide-left', 'slide-right'],
    },
    {
      id: 'tiktok-vertical',
      name: 'TikTok Vertical',
      category: 'Social',
      duration: 30,
      description: 'Vertical 9:16 with trendy effects',
      aspectRatio: '9:16' as AspectRatio,
      effects: ['chromatic', 'vignette'],
      transitions: ['glitch', 'flash'],
    },
    {
      id: 'instagram-square',
      name: 'Instagram Square',
      category: 'Social',
      duration: 15,
      description: 'Square format with vibrant colors',
      aspectRatio: '1:1' as AspectRatio,
      effects: ['saturation', 'glow'],
      transitions: ['fade', 'zoom-out'],
    },
    {
      id: 'cinematic-widescreen',
      name: 'Cinematic Widescreen',
      category: 'Film',
      duration: 120,
      description: 'Movie-style with letterbox',
      aspectRatio: '16:9' as AspectRatio,
      effects: ['contrast', 'vignette', 'grayscale'],
      transitions: ['dissolve', 'fade'],
    },
    {
      id: 'tutorial-chapter',
      name: 'Tutorial Chapter',
      category: 'Tutorial',
      duration: 120,
      description: 'Clean cuts with focus on clarity',
      aspectRatio: '16:9' as AspectRatio,
      effects: ['sharpen', 'brightness'],
      transitions: ['wipe-left', 'wipe-right'],
    },
    {
      id: 'podcast-clip',
      name: 'Podcast Clip',
      category: 'Podcast',
      duration: 45,
      description: 'Audio-focused with subtle visuals',
      aspectRatio: '1:1' as AspectRatio,
      effects: ['noise', 'sepia'],
      transitions: ['fade', 'dissolve'],
    },
  ];

  const applyTemplate = (template: typeof templates[0]) => {
    if (!project) {
      toast.error('Create a project first');
      return;
    }

    const resolutions: Record<AspectRatio, { width: number; height: number; label: string }> = {
      '16:9': { width: 1920, height: 1080, label: '1080p' },
      '9:16': { width: 1080, height: 1920, label: '1080p Vertical' },
      '1:1': { width: 1080, height: 1080, label: '1080x1080' },
      '4:5': { width: 1080, height: 1350, label: '1080x1350' },
      '4:3': { width: 1440, height: 1080, label: '1440x1080' },
    };

    updateProject({
      aspectRatio: template.aspectRatio,
      resolution: resolutions[template.aspectRatio],
      settings: {
        ...project.settings,
        defaultTransitionDuration: template.transitions.length > 0 ? 0.5 : 0,
      },
    });

    toast.success(
      `Applied "${template.name}" template - ${template.aspectRatio} format with ${template.effects.join(', ')} effects`
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Project Templates</h3>
      <p className="text-xs text-muted-foreground">
        Apply preset configurations to your project
      </p>
      <div className="space-y-2">
        {templates.map((template) => (
          <button
            key={template.id}
            className="w-full rounded-md bg-muted/50 p-3 text-left hover:bg-muted transition-colors group"
            onClick={() => applyTemplate(template)}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                {template.name}
              </p>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                {template.aspectRatio}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {template.description}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {template.category}
              </span>
              <span className="text-xs text-muted-foreground">
                {template.duration}s
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
