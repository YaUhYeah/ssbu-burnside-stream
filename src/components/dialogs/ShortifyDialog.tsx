import { useState } from 'react';
import { X, Wand2, Sparkles, Clock, Zap, TrendingUp, BarChart3, Eye } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import type { Track, TimelineClip, Transition } from '@/types';

interface HighlightSegment {
  start: number;
  end: number;
  score: number;
  type: 'peak' | 'hook' | 'climax' | 'engagement';
  label: string;
}

export function ShortifyDialog() {
  const { setShowShortifyDialog, setProcessing, setProcessingProgress } = useUIStore();
  const { project, updateProject } = useProjectStore();

  const [duration, setDuration] = useState<15 | 30 | 60>(30);
  const [style, setStyle] = useState<'hook' | 'highlights' | 'summary'>('highlights');
  const [addCaptions, setAddCaptions] = useState(true);
  const [verticalCrop, setVerticalCrop] = useState(true);
  const [autoTransitions, setAutoTransitions] = useState(true);
  const [estimatedViews, setEstimatedViews] = useState<number | null>(null);
  const [engagementScore, setEngagementScore] = useState<number | null>(null);

  // Detect hype moments from audio waveform
  const detectHypeMoments = (waveform: number[], duration: number): HighlightSegment[] => {
    const segments: HighlightSegment[] = [];
    const samplesPerSecond = waveform.length / duration;

    // Find peaks in the waveform
    const windowSize = Math.floor(samplesPerSecond * 3); // 3 second windows
    const threshold = 0.6; // High energy threshold

    for (let i = 0; i < waveform.length - windowSize; i += Math.floor(windowSize / 2)) {
      let maxEnergy = 0;
      let avgEnergy = 0;

      for (let j = i; j < i + windowSize; j++) {
        maxEnergy = Math.max(maxEnergy, waveform[j]);
        avgEnergy += waveform[j];
      }
      avgEnergy /= windowSize;

      if (maxEnergy > threshold && avgEnergy > 0.3) {
        const startTime = (i / waveform.length) * duration;
        const endTime = ((i + windowSize) / waveform.length) * duration;

        segments.push({
          start: startTime,
          end: endTime,
          score: maxEnergy,
          type: maxEnergy > 0.8 ? 'climax' : 'peak',
          label: maxEnergy > 0.8 ? 'Hype Moment' : 'High Energy',
        });
      }
    }

    // Sort by score (highest first)
    segments.sort((a, b) => b.score - a.score);

    // Remove overlapping segments
    const filtered: HighlightSegment[] = [];
    for (const seg of segments) {
      const hasOverlap = filtered.some(
        (f) => !(seg.end < f.start || seg.start > f.end)
      );
      if (!hasOverlap) {
        filtered.push(seg);
      }
    }

    return filtered;
  };

  // Calculate estimated engagement metrics
  const calculateEngagementMetrics = (
    clips: HighlightSegment[],
    totalDuration: number,
    hasHook: boolean
  ) => {
    // Base engagement factors
    let baseScore = 50;

    // Boost for hype moments
    const hypeMoments = clips.filter((c) => c.type === 'climax' || c.type === 'peak').length;
    baseScore += hypeMoments * 10;

    // Boost for having a hook
    if (hasHook) baseScore += 15;

    // Penalty for too long
    if (totalDuration > 60) baseScore -= 10;
    if (totalDuration > 30 && totalDuration <= 60) baseScore -= 5;

    // Boost for vertical format
    if (verticalCrop) baseScore += 10;

    // Cap at 100
    const finalScore = Math.min(100, Math.max(0, baseScore));

    // Estimate views based on score (simplified viral coefficient)
    const baseViews = 500;
    const viralMultiplier = Math.pow(1.5, finalScore / 20);
    const estimatedImpressions = Math.round(baseViews * viralMultiplier);

    return { score: finalScore, views: estimatedImpressions };
  };

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
    setProcessing(true, 'Analyzing video for hype moments...');

    try {
      setProcessingProgress(10);

      const videoDuration = videoMedia.duration;

      if (videoDuration < duration) {
        toast.error(`Video is shorter than ${duration}s target duration`);
        setProcessing(false);
        return;
      }

      setProcessingProgress(20);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Detect hype moments if waveform data is available
      let hypeMoments: HighlightSegment[] = [];
      if (videoMedia.waveform && videoMedia.waveform.length > 0) {
        hypeMoments = detectHypeMoments(videoMedia.waveform, videoDuration);
      }

      setProcessingProgress(40);

      // Generate smart segments based on style with hype moment integration
      let selectedClips: HighlightSegment[] = [];

      if (style === 'hook') {
        // Hook style: attention-grabbing start + best hype moments + end CTA
        const hookDuration = Math.min(duration * 0.3, 10);
        const ctaDuration = Math.min(duration * 0.15, 6);
        const remainingDuration = duration - hookDuration - ctaDuration;

        // Strong hook at the beginning (first moment with action or skip intro)
        const hookStart = videoDuration * 0.05; // Skip first 5% (usually intro)
        selectedClips.push({
          start: hookStart,
          end: hookStart + hookDuration,
          score: 1,
          type: 'hook',
          label: 'Opening Hook',
        });

        // Use detected hype moments if available
        if (hypeMoments.length > 0) {
          let remainingTime = remainingDuration;
          for (const moment of hypeMoments) {
            if (remainingTime <= 0) break;
            const clipDuration = Math.min(moment.end - moment.start, remainingTime);
            selectedClips.push({
              ...moment,
              end: moment.start + clipDuration,
            });
            remainingTime -= clipDuration;
          }
        } else {
          // Fallback: pick interesting middle section
          const middleStart = videoDuration * 0.4;
          selectedClips.push({
            start: middleStart,
            end: middleStart + remainingDuration,
            score: 0.9,
            type: 'engagement',
            label: 'Key Moment',
          });
        }

        // End with CTA section
        const endStart = Math.max(videoDuration - ctaDuration - 2, videoDuration * 0.85);
        selectedClips.push({
          start: endStart,
          end: endStart + ctaDuration,
          score: 0.8,
          type: 'engagement',
          label: 'Call to Action',
        });
      } else if (style === 'highlights') {
        // Highlights style: prioritize detected hype moments
        if (hypeMoments.length >= 2) {
          let remainingTime = duration;

          // Use top hype moments
          for (const moment of hypeMoments) {
            if (remainingTime <= 0) break;

            const clipDuration = Math.min(moment.end - moment.start, remainingTime, 12);
            selectedClips.push({
              ...moment,
              end: moment.start + clipDuration,
            });
            remainingTime -= clipDuration;
          }

          // Fill remaining time with strategic picks
          if (remainingTime > 3) {
            const fillCount = Math.ceil(remainingTime / 8);
            const step = videoDuration / (fillCount + 1);
            for (let i = 0; i < fillCount && remainingTime > 0; i++) {
              const start = step * (i + 1);
              const clipDuration = Math.min(remainingTime, 6);

              // Skip if overlaps with existing clips
              const overlaps = selectedClips.some(
                (c) => !(start + clipDuration < c.start || start > c.end)
              );

              if (!overlaps) {
                selectedClips.push({
                  start,
                  end: start + clipDuration,
                  score: 0.7,
                  type: 'engagement',
                  label: 'Filler Moment',
                });
                remainingTime -= clipDuration;
              }
            }
          }
        } else {
          // Fallback: evenly distributed segments
          const numSegments = Math.ceil(duration / 8);
          const segmentDuration = duration / numSegments;
          const startOffset = videoDuration * 0.1;
          const endOffset = videoDuration * 0.9;
          const step = (endOffset - startOffset) / (numSegments + 1);

          for (let i = 0; i < numSegments; i++) {
            const start = startOffset + step * (i + 1) - segmentDuration / 2;
            selectedClips.push({
              start: Math.max(0, start),
              end: Math.min(start + segmentDuration, videoDuration),
              score: 1 - i * 0.1,
              type: 'engagement',
              label: `Highlight ${i + 1}`,
            });
          }
        }
      } else {
        // Summary style: chronological with strategic picks
        const numSegments = Math.ceil(duration / 10);
        const segmentDuration = duration / numSegments;
        const step = videoDuration / numSegments;

        for (let i = 0; i < numSegments; i++) {
          const start = step * i + step * 0.2;
          selectedClips.push({
            start: Math.max(0, start),
            end: Math.min(start + segmentDuration, videoDuration),
            score: 1,
            type: 'engagement',
            label: `Part ${i + 1}`,
          });
        }
      }

      setProcessingProgress(60);

      // Sort clips chronologically for better flow
      selectedClips.sort((a, b) => a.start - b.start);

      // Calculate engagement metrics
      const hasHook = selectedClips.some((c) => c.type === 'hook');
      const totalDuration = selectedClips.reduce((sum, c) => sum + (c.end - c.start), 0);
      const metrics = calculateEngagementMetrics(selectedClips, totalDuration, hasHook);
      setEngagementScore(metrics.score);
      setEstimatedViews(metrics.views);

      // Create a new track for the short
      const shortTrackId = uuidv4();
      const shortTrack: Track = {
        id: shortTrackId,
        name: `Short (${duration}s ${style}) - ${metrics.score}% engagement`,
        type: 'video',
        clips: [],
        height: 80,
        locked: false,
        muted: false,
        visible: true,
      };

      setProcessingProgress(70);

      // Add clips to the track with optional transitions
      let timelinePosition = 0;
      selectedClips.forEach((clip, index) => {
        const clipId = uuidv4();
        const transitions: Transition[] = [];

        // Add transitions between clips
        if (autoTransitions && index > 0) {
          const transitionTypes: Array<Transition['type']> = ['fade', 'dissolve', 'wipe-left', 'zoom-in'];
          const randomTransition = transitionTypes[Math.floor(Math.random() * transitionTypes.length)];
          transitions.push({
            id: uuidv4(),
            type: randomTransition,
            duration: 0.3,
            position: 'start',
            params: {},
          });
        }

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
          transitions,
          locked: false,
        };
        shortTrack.clips.push(clipData);
        timelinePosition += clip.end - clip.start;
      });

      setProcessingProgress(85);

      // Update project - keep original resolution centered, don't stretch
      if (verticalCrop) {
        // Create vertical canvas but DON'T stretch the video
        // The video will be rendered centered with letterboxing/pillarboxing
        // This maintains the original video quality and aspect ratio
        updateProject({
          tracks: [...project.tracks, shortTrack],
          resolution: {
            width: 1080,
            height: 1920,
            label: '1080x1920 (Vertical)',
          },
          aspectRatio: '9:16',
          duration: Math.max(project.duration, timelinePosition),
        });

        // Add a note about how the video will be rendered
        toast.success('Vertical format: Video will be centered (not stretched) on 9:16 canvas');
      } else {
        updateProject({
          tracks: [...project.tracks, shortTrack],
          duration: Math.max(project.duration, timelinePosition),
        });
      }

      setProcessingProgress(100);

      const hypeMomentCount = selectedClips.filter((c) => c.type === 'climax' || c.type === 'peak').length;
      toast.success(
        `Created ${Math.round(totalDuration)}s short with ${selectedClips.length} clips and ${hypeMomentCount} hype moments! Estimated ${metrics.views.toLocaleString()} impressions.`
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
                  checked={autoTransitions}
                  onChange={(e) => setAutoTransitions(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Auto-add transitions between clips</span>
              </label>
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
                <div className="text-sm">
                  <span>Vertical canvas (9:16)</span>
                  <p className="text-xs text-muted-foreground">Centers video without stretching</p>
                </div>
              </label>
            </div>
          </div>

          {/* Analytics Preview */}
          {engagementScore !== null && (
            <div className="rounded-md bg-gradient-to-r from-green-500/10 to-blue-500/10 p-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Estimated Performance
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Engagement</span>
                  </div>
                  <p className="text-2xl font-bold">{engagementScore}%</p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Est. Impressions</span>
                  </div>
                  <p className="text-2xl font-bold">{estimatedViews?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
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
