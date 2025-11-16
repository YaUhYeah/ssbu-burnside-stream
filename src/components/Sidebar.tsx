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
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { cn, formatFileSize, formatDuration, getMediaType } from '@/lib/utils';
import type { MediaFile } from '@/types';
import toast from 'react-hot-toast';
import { ResolutionMatchDialog } from './dialogs/ResolutionMatchDialog';

type PanelType = 'media' | 'effects' | 'captions' | 'templates' | 'export';

const PANEL_ICONS: Record<PanelType, typeof Film> = {
  media: Film,
  effects: Sparkles,
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
    if (pendingMedia && project) {
      // Update project resolution to match media
      const aspectRatio =
        pendingMedia.width > pendingMedia.height
          ? `${Math.round((pendingMedia.width / pendingMedia.height) * 9)}:9`
          : `9:${Math.round((pendingMedia.height / pendingMedia.width) * 9)}`;

      updateProject({
        resolution: {
          width: pendingMedia.width,
          height: pendingMedia.height,
          label: `${pendingMedia.width}x${pendingMedia.height}`,
        },
        aspectRatio,
      });

      addMedia(pendingMedia);
      toast.success(`Project resolution updated to ${pendingMedia.width}x${pendingMedia.height}`);
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
      {showResolutionDialog && pendingMedia && project && (
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
  const effects = [
    { id: 'brightness', name: 'Brightness', icon: '☀️' },
    { id: 'contrast', name: 'Contrast', icon: '◐' },
    { id: 'saturation', name: 'Saturation', icon: '🎨' },
    { id: 'blur', name: 'Blur', icon: '💨' },
    { id: 'sharpen', name: 'Sharpen', icon: '🔍' },
    { id: 'noise-reduction', name: 'Noise Reduction', icon: '🔇' },
    { id: 'color-correction', name: 'Color Correction', icon: '🌈' },
    { id: 'stabilize', name: 'Stabilize', icon: '📐' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Effects</h3>
      <div className="grid grid-cols-2 gap-2">
        {effects.map((effect) => (
          <button
            key={effect.id}
            className="flex flex-col items-center gap-2 rounded-md bg-muted/50 p-3 text-xs hover:bg-muted"
            onClick={() => toast('Drag effect to clip on timeline')}
          >
            <span className="text-xl">{effect.icon}</span>
            <span>{effect.name}</span>
          </button>
        ))}
      </div>

      <h3 className="text-sm font-semibold">Transitions</h3>
      <div className="grid grid-cols-2 gap-2">
        {['Fade', 'Dissolve', 'Wipe', 'Slide', 'Zoom', 'Whip'].map((transition) => (
          <button
            key={transition}
            className="rounded-md bg-muted/50 p-2 text-xs hover:bg-muted"
            onClick={() => toast('Drag transition between clips')}
          >
            {transition}
          </button>
        ))}
      </div>
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
  const templates = [
    { id: 'gaming-highlight', name: 'Gaming Highlight', category: 'Gaming', duration: 30 },
    { id: 'vlog-intro', name: 'Vlog Intro', category: 'Vlog', duration: 15 },
    { id: 'product-showcase', name: 'Product Showcase', category: 'Product', duration: 60 },
    { id: 'tutorial-chapter', name: 'Tutorial Chapter', category: 'Tutorial', duration: 120 },
    { id: 'trending-hook', name: 'Trending Hook', category: 'Trending', duration: 10 },
    { id: 'podcast-clip', name: 'Podcast Clip', category: 'Podcast', duration: 45 },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Templates</h3>
      <div className="space-y-2">
        {templates.map((template) => (
          <button
            key={template.id}
            className="w-full rounded-md bg-muted/50 p-3 text-left hover:bg-muted"
            onClick={() => toast('Template applied')}
          >
            <p className="text-sm font-medium">{template.name}</p>
            <p className="text-xs text-muted-foreground">
              {template.category} • {template.duration}s
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
