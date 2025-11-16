import { useState } from 'react';
import { X, Wand2, Sparkles, Clock, Zap } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { getHighlightDetector } from '@/utils/highlightDetection';
import { transcribeAudio } from '@/utils/speechRecognition';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import type { Track, TimelineClip } from '@/types';

export function ShortifyDialog() {
  const { setShowShortifyDialog, setProcessing, setProcessingProgress } = useUIStore();
  const { project, addCaption, updateProject } = useProjectStore();

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
    setProcessing(true, 'Analyzing your video...');

    try {
      setProcessingProgress(10);

      // Use streaming fetch for large files
      const response = await fetch(videoMedia.path);
      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

      let loadedSize = 0;
      const chunks: Uint8Array[] = [];
      const reader = response.body?.getReader();

      if (reader) {
        // Stream the file in chunks to avoid memory issues
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          loadedSize += value.length;

          // Update progress for file loading (10-20%)
          if (totalSize > 0) {
            const loadProgress = 10 + (loadedSize / totalSize) * 10;
            setProcessingProgress(Math.min(loadProgress, 20));
          }

          // Yield to UI to prevent blocking
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const mediaBlob = new Blob(chunks as BlobPart[]);

      setProcessingProgress(20);

      // Decode audio with optimized settings for performance
      const audioContext = new AudioContext({
        sampleRate: 22050, // Lower sample rate for faster processing
      });

      // Only decode a portion for very large files (>100MB)
      let audioBuffer: AudioBuffer;
      if (mediaBlob.size > 100 * 1024 * 1024) {
        // For large files, analyze first 5 minutes only
        const partialBlob = mediaBlob.slice(0, Math.min(mediaBlob.size, 50 * 1024 * 1024));
        const arrayBuffer = await partialBlob.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } else {
        const arrayBuffer = await mediaBlob.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      }

      setProcessingProgress(30);

      // Detect highlights based on style - use sampling for performance
      const detector = getHighlightDetector();
      const highlightOptions = {
        minDuration: duration / 4,
        maxHighlights: style === 'hook' ? 3 : style === 'highlights' ? 5 : 4,
        sensitivity: style === 'highlights' ? 0.8 : 0.6,
      };

      // Process in chunks to avoid blocking UI
      await new Promise((resolve) => setTimeout(resolve, 10));
      setProcessingProgress(40);

      const highlights = await detector.detectHighlights(audioBuffer, highlightOptions);

      setProcessingProgress(50);

      // Select clips based on duration
      let selectedClips: Array<{ start: number; end: number; score: number }> = [];
      let totalDuration = 0;

      if (style === 'hook') {
        // For hook style, take first segment + best highlight
        if (highlights.length > 0) {
          selectedClips.push({
            start: 0,
            end: Math.min(duration * 0.4, videoMedia.duration * 0.2),
            score: 1,
          });
          totalDuration += selectedClips[0].end;

          // Add best highlight
          const bestHighlight = highlights[0];
          const remainingDuration = duration - totalDuration;
          selectedClips.push({
            start: bestHighlight.startTime,
            end: Math.min(bestHighlight.endTime, bestHighlight.startTime + remainingDuration),
            score: bestHighlight.score,
          });
        }
      } else {
        // For highlights/summary, select top scoring segments
        const sortedHighlights = [...highlights].sort((a, b) => b.score - a.score);

        for (const highlight of sortedHighlights) {
          if (totalDuration >= duration) break;

          const clipDuration = Math.min(
            highlight.endTime - highlight.startTime,
            duration - totalDuration
          );

          if (clipDuration >= 2) { // Min 2 seconds per clip
            selectedClips.push({
              start: highlight.startTime,
              end: highlight.startTime + clipDuration,
              score: highlight.score,
            });
            totalDuration += clipDuration;
          }
        }
      }

      // If not enough highlights, fill with evenly distributed segments
      if (totalDuration < duration * 0.8) {
        const segmentCount = Math.ceil((duration - totalDuration) / 5);
        const segmentDuration = (duration - totalDuration) / segmentCount;
        const sourceStep = videoMedia.duration / (segmentCount + 1);

        for (let i = 0; i < segmentCount; i++) {
          const start = sourceStep * (i + 1);
          selectedClips.push({
            start,
            end: start + segmentDuration,
            score: 0.5,
          });
          totalDuration += segmentDuration;
        }
      }

      setProcessingProgress(60);

      // Sort clips by time for narrative flow (summary) or by score (highlights)
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

      // Generate captions if requested - optimize for performance
      if (addCaptions) {
        try {
          // For large files, only transcribe the selected portions
          if (mediaBlob.size > 50 * 1024 * 1024) {
            // Skip detailed transcription for very large files
            toast.success('Captions skipped for large file - add manually');
          } else {
            // Create a blob from selected segments for transcription
            const captions = await transcribeAudio(mediaBlob);

            // Adjust caption timing to match short timeline - batch for performance
            const adjustedCaptions: Array<Parameters<typeof addCaption>[0]> = [];

            captions.forEach((caption) => {
              // Find which clip this caption belongs to
              selectedClips.forEach((clip, index) => {
                if (caption.startTime >= clip.start && caption.startTime < clip.end) {
                  // Adjust to short timeline
                  const offsetInClip = caption.startTime - clip.start;
                  let shortStartTime = 0;
                  for (let i = 0; i < index; i++) {
                    shortStartTime += selectedClips[i].end - selectedClips[i].start;
                  }
                  shortStartTime += offsetInClip;

                  adjustedCaptions.push({
                    ...caption,
                    id: uuidv4(),
                    startTime: shortStartTime,
                    endTime: shortStartTime + (caption.endTime - caption.startTime),
                  });
                }
              });
            });

            // Add captions in batches to prevent UI freeze
            for (let i = 0; i < adjustedCaptions.length; i++) {
              addCaption(adjustedCaptions[i]);
              if (i % 5 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
              }
            }
          }
        } catch (err) {
          console.warn('Caption generation failed:', err);
        }
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

      await audioContext.close();

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
