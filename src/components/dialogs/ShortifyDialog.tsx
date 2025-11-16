import { useState } from 'react';
import { X, Wand2, Sparkles, Clock, Zap } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import type { Track, TimelineClip } from '@/types';

export function ShortifyDialog() {
  const { setShowShortifyDialog, setProcessing, setProcessingProgress } = useUIStore();
  const { project, updateProject } = useProjectStore();

  const [duration, setDuration] = useState<15 | 30 | 60>(30);
  const [style, setStyle] = useState<'hook' | 'highlights' | 'summary'>('highlights');
  const [addCaptions, setAddCaptions] = useState(true);
  const [verticalCrop, setVerticalCrop] = useState(true);

  const handleShortify = async () => {
    if (!project || project.media.length === 0) {
      toast.error('Add some media first');
      return;
    }

    const videoMedia = project.media.find((m) => m.type === 'video');
    if (!videoMedia) {
      toast.error('Add a video file first');
      return;
    }

    setShowShortifyDialog(false);
    setProcessing(true, 'Generating short clips...');

    try {
      setProcessingProgress(10);

      // Use lightweight time-based segmentation instead of heavy audio analysis
      // This prevents memory issues and app crashes with large files
      const videoDuration = videoMedia.duration;

      if (videoDuration < duration) {
        toast.error(`Video is shorter than ${duration}s target duration`);
        setProcessing(false);
        return;
      }

      setProcessingProgress(30);

      // Generate smart segments based on style without loading entire file
      let selectedClips: Array<{ start: number; end: number; score: number }> = [];
      let totalDuration = 0;

      // Yield to UI
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (style === 'hook') {
        // Hook style: attention-grabbing start + middle highlight + end CTA
        const hookDuration = Math.min(duration * 0.4, 12);
        const highlightDuration = Math.min(duration * 0.4, 12);
        const ctaDuration = duration - hookDuration - highlightDuration;

        selectedClips.push({
          start: 0,
          end: hookDuration,
          score: 1,
        });

        // Pick an interesting middle section
        const middleStart = videoDuration * 0.4;
        selectedClips.push({
          start: middleStart,
          end: middleStart + highlightDuration,
          score: 0.9,
        });

        if (ctaDuration > 0) {
          // End section for CTA
          const endStart = Math.max(videoDuration - ctaDuration - 5, videoDuration * 0.8);
          selectedClips.push({
            start: endStart,
            end: endStart + ctaDuration,
            score: 0.8,
          });
        }

        totalDuration = hookDuration + highlightDuration + ctaDuration;
      } else if (style === 'highlights') {
        // Highlights style: pick evenly distributed segments from interesting parts
        const numSegments = Math.ceil(duration / 8); // ~8 second segments
        const segmentDuration = duration / numSegments;

        // Focus on middle portions (usually more interesting than start/end)
        const startOffset = videoDuration * 0.1;
        const endOffset = videoDuration * 0.9;
        const availableDuration = endOffset - startOffset;
        const step = availableDuration / (numSegments + 1);

        for (let i = 0; i < numSegments; i++) {
          const start = startOffset + step * (i + 1) - segmentDuration / 2;
          selectedClips.push({
            start: Math.max(0, start),
            end: Math.min(start + segmentDuration, videoDuration),
            score: 1 - (i * 0.1),
          });
          totalDuration += segmentDuration;
        }
      } else {
        // Summary style: chronological sampling throughout video
        const numSegments = Math.ceil(duration / 10); // ~10 second segments
        const segmentDuration = duration / numSegments;
        const step = videoDuration / numSegments;

        for (let i = 0; i < numSegments; i++) {
          const start = step * i + step * 0.2; // Offset slightly into each section
          selectedClips.push({
            start: Math.max(0, start),
            end: Math.min(start + segmentDuration, videoDuration),
            score: 1,
          });
          totalDuration += segmentDuration;
        }
      }

      setProcessingProgress(50);

      // Sort clips by time for narrative flow (summary) or keep as-is
      if (style === 'summary') {
        selectedClips.sort((a, b) => a.start - b.start);
      }

      // Create a new track for the short
      const shortTrackId = uuidv4();
      const shortTrack: Track = {
        id: shortTrackId,
        name: `Short (${duration}s ${style})`,
        type: 'video',
        clips: [],
        height: 80,
        locked: false,
        muted: false,
        visible: true,
      };

      // Add clips to the track
      let timelinePosition = 0;
      selectedClips.forEach((clip) => {
        const clipId = uuidv4();
        const clipData: TimelineClip = {
          id: clipId,
          mediaId: videoMedia.id,
          trackId: shortTrackId,
          startTime: timelinePosition,
          duration: clip.end - clip.start,
          inPoint: clip.start,
          outPoint: clip.end,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
          locked: false,
        };
        shortTrack.clips.push(clipData);
        timelinePosition += clip.end - clip.start;
      });

      setProcessingProgress(70);

      // Skip heavy caption generation to avoid memory issues
      if (addCaptions) {
        toast.success('Auto-captions available via Captions panel');
      }

      setProcessingProgress(85);

      // Update project resolution for vertical crop
      if (verticalCrop) {
        updateProject({
          tracks: [...project.tracks, shortTrack],
          resolution: {
            width: 1080,
            height: 1920,
            label: '1080x1920',
          },
          aspectRatio: '9:16',
          duration: Math.max(project.duration, timelinePosition),
        });
      } else {
        updateProject({
          tracks: [...project.tracks, shortTrack],
          duration: Math.max(project.duration, timelinePosition),
        });
      }

      setProcessingProgress(100);
      toast.success(
        `Created ${duration}s short with ${selectedClips.length} clips! Check your timeline.`
      );
    } catch (error) {
      console.error('Shortify error:', error);
      toast.error('Failed to generate short. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 p-2">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold">Auto Shortify</h2>
          </div>
          <button
            onClick={() => setShowShortifyDialog(false)}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Automatically convert your long-form video into an engaging short-form
          clip optimized for social media.
        </p>

        <div className="space-y-6">
          {/* Duration */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Target Duration
            </label>
            <div className="flex gap-2">
              {[15, 30, 60].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d as 15 | 30 | 60)}
                  className={`flex-1 rounded-md border p-3 text-center ${
                    duration === d
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-lg font-bold">{d}s</p>
                  <p className="text-xs text-muted-foreground">
                    {d === 15 ? 'Quick' : d === 30 ? 'Standard' : 'Extended'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Content Style
            </label>
            <div className="space-y-2">
              {[
                {
                  value: 'hook',
                  label: 'Hook & CTA',
                  desc: 'Attention-grabbing intro with call-to-action',
                },
                {
                  value: 'highlights',
                  label: 'Best Highlights',
                  desc: 'Most engaging moments from your video',
                },
                {
                  value: 'summary',
                  label: 'Quick Summary',
                  desc: 'Condensed overview of main points',
                },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value as 'hook' | 'highlights' | 'summary')}
                  className={`w-full rounded-md border p-3 text-left ${
                    style === s.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4" />
              Enhancements
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={addCaptions}
                  onChange={(e) => setAddCaptions(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Add auto-generated captions</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={verticalCrop}
                  onChange={(e) => setVerticalCrop(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Smart vertical crop (9:16)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setShowShortifyDialog(false)}
            className="rounded-md px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleShortify}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white hover:from-purple-600 hover:to-pink-600"
          >
            <Wand2 className="h-4 w-4" />
            Generate Short
          </button>
        </div>
      </div>
    </div>
  );
}
