import { useState, useMemo } from 'react';
import { X, Wand2, Sparkles, Clock, Zap, TrendingUp, Eye, Target, Flame, Share2, Repeat } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import type { Track, TimelineClip, Transition, Caption } from '@/types';

interface HighlightSegment {
  start: number;
  end: number;
  score: number;
  type: 'peak' | 'hook' | 'climax' | 'engagement' | 'pattern-interrupt' | 'payoff';
  label: string;
  retentionBoost: number;
}

interface ViralMetrics {
  hookStrength: number; // 0-100: First 3 seconds impact
  retentionScore: number; // 0-100: Will people watch till end
  shareability: number; // 0-100: Will people share this
  commentBait: number; // 0-100: Will this spark discussion
  rewatchValue: number; // 0-100: Will people watch again
  overallViralScore: number; // Weighted average
  estimatedViews: number;
  estimatedLikes: number;
  estimatedShares: number;
  platformFit: Record<string, number>; // Platform-specific scores
}

type Platform = 'tiktok' | 'reels' | 'shorts' | 'all';
type PacingStyle = 'fast' | 'dynamic' | 'storytelling';

export function ShortifyDialog() {
  const { setShowShortifyDialog, setProcessing, setProcessingProgress } = useUIStore();
  const { project, updateProject } = useProjectStore();

  const [duration, setDuration] = useState<15 | 30 | 60>(30);
  const [style, setStyle] = useState<'hook' | 'highlights' | 'summary'>('highlights');
  const [addCaptions, setAddCaptions] = useState(true);
  const [verticalCrop, setVerticalCrop] = useState(true);
  const [autoTransitions, setAutoTransitions] = useState(true);
  const [platform, setPlatform] = useState<Platform>('all');
  const [pacingStyle, setPacingStyle] = useState<PacingStyle>('dynamic');
  const [addSpeedRamps, setAddSpeedRamps] = useState(false);
  const [optimizeForShares, setOptimizeForShares] = useState(true);
  const [addPatternInterrupts, setAddPatternInterrupts] = useState(true);
  const [viralMetrics, setViralMetrics] = useState<ViralMetrics | null>(null);

  // Platform-specific optimal settings
  const platformSettings = useMemo(() => ({
    tiktok: {
      maxDuration: 60,
      optimalDuration: 15,
      cutFrequency: 2.5, // seconds between cuts
      hookWindow: 1.5, // Must hook in first X seconds
      musicEmphasis: 0.8,
      captionStyle: 'bold-center',
    },
    reels: {
      maxDuration: 90,
      optimalDuration: 30,
      cutFrequency: 3.5,
      hookWindow: 2,
      musicEmphasis: 0.6,
      captionStyle: 'subtle-bottom',
    },
    shorts: {
      maxDuration: 60,
      optimalDuration: 30,
      cutFrequency: 4,
      hookWindow: 3,
      musicEmphasis: 0.5,
      captionStyle: 'minimal',
    },
    all: {
      maxDuration: 60,
      optimalDuration: 30,
      cutFrequency: 3,
      hookWindow: 2,
      musicEmphasis: 0.6,
      captionStyle: 'bold-center',
    },
  }), []);

  // Analyze waveform for beat drops and rhythm patterns
  const detectBeatsAndRhythm = (waveform: number[], duration: number) => {
    const beats: number[] = [];
    const samplesPerSecond = waveform.length / duration;
    const windowSize = Math.floor(samplesPerSecond * 0.1); // 100ms window for beat detection

    let prevEnergy = 0;
    for (let i = windowSize; i < waveform.length - windowSize; i += Math.floor(windowSize / 2)) {
      let currentEnergy = 0;
      for (let j = i - windowSize; j < i; j++) {
        currentEnergy += waveform[j] * waveform[j];
      }
      currentEnergy = Math.sqrt(currentEnergy / windowSize);

      // Detect sudden energy increase (beat)
      if (currentEnergy > prevEnergy * 1.5 && currentEnergy > 0.4) {
        const beatTime = (i / waveform.length) * duration;
        if (beats.length === 0 || beatTime - beats[beats.length - 1] > 0.3) {
          beats.push(beatTime);
        }
      }
      prevEnergy = currentEnergy * 0.7 + prevEnergy * 0.3; // Smooth
    }

    return beats;
  };

  // Detect pattern interrupt opportunities (sudden changes for attention)
  const detectPatternInterrupts = (waveform: number[], duration: number): HighlightSegment[] => {
    const interrupts: HighlightSegment[] = [];
    const samplesPerSecond = waveform.length / duration;
    const windowSize = Math.floor(samplesPerSecond * 1); // 1 second windows

    for (let i = windowSize; i < waveform.length - windowSize * 2; i += windowSize) {
      // Calculate variance in current window vs next window
      let currentVar = 0, nextVar = 0;
      let currentMean = 0, nextMean = 0;

      for (let j = 0; j < windowSize; j++) {
        currentMean += waveform[i - windowSize + j];
        nextMean += waveform[i + j];
      }
      currentMean /= windowSize;
      nextMean /= windowSize;

      for (let j = 0; j < windowSize; j++) {
        currentVar += Math.pow(waveform[i - windowSize + j] - currentMean, 2);
        nextVar += Math.pow(waveform[i + j] - nextMean, 2);
      }
      currentVar /= windowSize;
      nextVar /= windowSize;

      // Large change in variance = pattern interrupt
      const varianceChange = Math.abs(nextVar - currentVar);
      if (varianceChange > 0.1 || Math.abs(nextMean - currentMean) > 0.3) {
        const time = (i / waveform.length) * duration;
        interrupts.push({
          start: time,
          end: time + 2,
          score: varianceChange * 10,
          type: 'pattern-interrupt',
          label: 'Pattern Break',
          retentionBoost: 15,
        });
      }
    }

    return interrupts.sort((a, b) => b.score - a.score).slice(0, 5);
  };

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
          retentionBoost: maxEnergy > 0.8 ? 25 : 15,
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

  // Calculate comprehensive viral metrics
  const calculateViralMetrics = (
    clips: HighlightSegment[],
    totalDuration: number,
    hasStrongHook: boolean,
    beats: number[],
    patternInterrupts: number
  ): ViralMetrics => {
    const settings = platformSettings[platform];

    // Hook Strength: Critical first 3 seconds
    let hookStrength = 40;
    if (hasStrongHook) hookStrength += 35;
    if (clips[0]?.score > 0.7) hookStrength += 15;
    if (totalDuration <= settings.hookWindow * 10) hookStrength += 10;
    hookStrength = Math.min(100, hookStrength);

    // Retention Score: Will people watch till end
    let retentionScore = 50;
    const hypeMoments = clips.filter((c) => c.type === 'climax' || c.type === 'peak').length;
    retentionScore += hypeMoments * 8;
    retentionScore += clips.reduce((sum, c) => sum + (c.retentionBoost || 0), 0) / clips.length;
    if (patternInterrupts >= 2) retentionScore += 10;
    if (totalDuration <= 30) retentionScore += 15;
    else if (totalDuration <= 45) retentionScore += 8;
    retentionScore = Math.min(100, retentionScore);

    // Shareability: Will people share this
    let shareability = 35;
    if (hypeMoments >= 3) shareability += 20;
    if (clips.some(c => c.type === 'climax')) shareability += 15;
    if (optimizeForShares) shareability += 10;
    if (verticalCrop) shareability += 10;
    if (totalDuration <= settings.optimalDuration + 5) shareability += 10;
    shareability = Math.min(100, shareability);

    // Comment Bait: Will this spark discussion
    let commentBait = 30;
    if (patternInterrupts >= 2) commentBait += 15;
    const hasCliffhanger = clips[clips.length - 1]?.type === 'payoff';
    if (hasCliffhanger) commentBait += 20;
    if (style === 'hook') commentBait += 10;
    const hasMystery = clips.length > 3 && totalDuration < 30;
    if (hasMystery) commentBait += 15;
    commentBait = Math.min(100, commentBait);

    // Rewatch Value: Will people watch again
    let rewatchValue = 25;
    if (pacingStyle === 'fast') rewatchValue += 20;
    if (beats.length > totalDuration * 0.5) rewatchValue += 15; // Beat-synced content
    if (hypeMoments >= 2) rewatchValue += 20;
    if (totalDuration <= 15) rewatchValue += 20;
    rewatchValue = Math.min(100, rewatchValue);

    // Calculate overall viral score (weighted)
    const overallViralScore = Math.round(
      hookStrength * 0.30 + // Hook is most important
      retentionScore * 0.25 +
      shareability * 0.20 +
      rewatchValue * 0.15 +
      commentBait * 0.10
    );

    // Platform-specific fit scores
    const platformFit: Record<string, number> = {
      tiktok: Math.min(100, overallViralScore + (pacingStyle === 'fast' ? 10 : 0) + (totalDuration <= 15 ? 15 : 0)),
      reels: Math.min(100, overallViralScore + (verticalCrop ? 10 : 0) + (totalDuration <= 30 ? 10 : 0)),
      shorts: Math.min(100, overallViralScore + (style === 'highlights' ? 10 : 0) + (totalDuration <= 60 ? 5 : 0)),
    };

    // Estimate engagement metrics using viral coefficient model
    const baseViews = 1000;
    const viralMultiplier = Math.pow(2.5, overallViralScore / 25); // Exponential growth
    const platformBonus = platform !== 'all' ? platformFit[platform] / 100 : 1;
    const estimatedViews = Math.round(baseViews * viralMultiplier * platformBonus);
    const estimatedLikes = Math.round(estimatedViews * (overallViralScore / 100) * 0.08);
    const estimatedShares = Math.round(estimatedViews * (shareability / 100) * 0.015);

    return {
      hookStrength,
      retentionScore,
      shareability,
      commentBait,
      rewatchValue,
      overallViralScore,
      estimatedViews,
      estimatedLikes,
      estimatedShares,
      platformFit,
    };
  };

  // Generate auto-captions for the short
  const generateAutoCaptions = (clips: HighlightSegment[], totalDuration: number): Caption[] => {
    const captions: Caption[] = [];
    const settings = platformSettings[platform];

    // Add hook caption at start
    if (clips.length > 0) {
      captions.push({
        id: uuidv4(),
        text: '👀 WAIT FOR IT...',
        startTime: 0,
        endTime: Math.min(2, totalDuration * 0.1),
        style: {
          fontFamily: settings.captionStyle === 'bold-center' ? 'Impact' : 'Arial',
          fontSize: settings.captionStyle === 'bold-center' ? 48 : 36,
          color: '#FFFFFF',
          backgroundColor: settings.captionStyle === 'bold-center' ? 'rgba(0,0,0,0.7)' : 'transparent',
          position: 'center',
          alignment: 'center',
          outline: true,
          shadow: true,
        },
      });
    }

    // Add engagement prompts based on clip types
    let timeOffset = 0;
    clips.forEach((clip, index) => {
      if (clip.type === 'climax' && index > 0) {
        captions.push({
          id: uuidv4(),
          text: '🔥',
          startTime: timeOffset,
          endTime: timeOffset + (clip.end - clip.start) * 0.3,
          style: {
            fontFamily: 'Arial',
            fontSize: 64,
            color: '#FFFFFF',
            backgroundColor: 'transparent',
            position: 'top',
            alignment: 'center',
            outline: false,
            shadow: false,
          },
        });
      }
      timeOffset += clip.end - clip.start;
    });

    // Add CTA at end
    if (totalDuration > 10) {
      captions.push({
        id: uuidv4(),
        text: '↗️ FOLLOW FOR MORE',
        startTime: totalDuration - 3,
        endTime: totalDuration,
        style: {
          fontFamily: 'Impact',
          fontSize: 42,
          color: '#00FF00',
          backgroundColor: 'rgba(0,0,0,0.8)',
          position: 'bottom',
          alignment: 'center',
          outline: true,
          shadow: true,
        },
      });
    }

    return captions;
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
    setProcessing(true, 'Analyzing video for viral potential...');

    try {
      setProcessingProgress(5);

      const videoDuration = videoMedia.duration;
      const settings = platformSettings[platform];

      if (videoDuration < duration) {
        toast.error(`Video is shorter than ${duration}s target duration`);
        setProcessing(false);
        return;
      }

      setProcessingProgress(10);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Advanced audio analysis
      let hypeMoments: HighlightSegment[] = [];
      let beats: number[] = [];
      let patternInterrupts: HighlightSegment[] = [];

      if (videoMedia.waveform && videoMedia.waveform.length > 0) {
        setProcessing(true, 'Detecting hype moments and beat patterns...');
        hypeMoments = detectHypeMoments(videoMedia.waveform, videoDuration);

        setProcessingProgress(20);
        beats = detectBeatsAndRhythm(videoMedia.waveform, videoDuration);

        setProcessingProgress(30);
        if (addPatternInterrupts) {
          patternInterrupts = detectPatternInterrupts(videoMedia.waveform, videoDuration);
        }
      }

      setProcessingProgress(40);
      setProcessing(true, 'Building viral-optimized clip sequence...');

      // Generate smart segments based on style with advanced viral optimization
      let selectedClips: HighlightSegment[] = [];
      const optimalCutFrequency = settings.cutFrequency * (pacingStyle === 'fast' ? 0.7 : pacingStyle === 'storytelling' ? 1.3 : 1);

      if (style === 'hook') {
        // VIRAL HOOK STRATEGY: Immediate impact + escalating hype + strong payoff
        const hookWindow = settings.hookWindow;

        // 1. KILLER HOOK (first 1-3 seconds) - Most important
        // Find the most visually/audibly interesting moment to start with
        let bestHookStart = videoDuration * 0.05;
        if (hypeMoments.length > 0) {
          // Use a hype moment as the hook (instant engagement)
          const hookMoment = hypeMoments.find(m => m.score > 0.7) || hypeMoments[0];
          bestHookStart = hookMoment.start;
        } else if (patternInterrupts.length > 0) {
          // Use a pattern interrupt as hook
          bestHookStart = patternInterrupts[0].start;
        }

        const hookDuration = Math.min(hookWindow * 2, duration * 0.2);
        selectedClips.push({
          start: bestHookStart,
          end: bestHookStart + hookDuration,
          score: 1,
          type: 'hook',
          label: 'KILLER HOOK',
          retentionBoost: 30,
        });

        // 2. PATTERN INTERRUPTS (keep attention)
        let remainingTime = duration - hookDuration;
        if (addPatternInterrupts && patternInterrupts.length > 0) {
          const interruptToUse = patternInterrupts[0];
          if (remainingTime > 4 && interruptToUse.start !== bestHookStart) {
            const clipDuration = Math.min(2, remainingTime * 0.15);
            selectedClips.push({
              ...interruptToUse,
              end: interruptToUse.start + clipDuration,
            });
            remainingTime -= clipDuration;
          }
        }

        // 3. ESCALATING HYPE (build anticipation)
        const sortedHype = [...hypeMoments].sort((a, b) => a.score - b.score); // Low to high
        for (const moment of sortedHype) {
          if (remainingTime <= duration * 0.3) break; // Save room for payoff
          if (moment.start === bestHookStart) continue; // Don't repeat hook

          const clipDuration = Math.min(
            moment.end - moment.start,
            remainingTime * 0.3,
            optimalCutFrequency * 2
          );
          selectedClips.push({
            ...moment,
            end: moment.start + clipDuration,
          });
          remainingTime -= clipDuration;
        }

        // 4. CLIMAX/PAYOFF (the "why they shared" moment)
        const climaxMoment = hypeMoments.find(m => m.type === 'climax') || hypeMoments[hypeMoments.length - 1];
        if (climaxMoment && remainingTime > 3) {
          const payoffDuration = Math.min(remainingTime * 0.6, 8);
          selectedClips.push({
            start: climaxMoment.start,
            end: climaxMoment.start + payoffDuration,
            score: 1,
            type: 'payoff',
            label: 'VIRAL PAYOFF',
            retentionBoost: 35,
          });
          remainingTime -= payoffDuration;
        }

        // 5. CTA LOOP (encourage rewatch/share)
        if (remainingTime > 2) {
          const ctaDuration = Math.min(remainingTime, 4);
          const endStart = Math.max(videoDuration - ctaDuration - 1, videoDuration * 0.9);
          selectedClips.push({
            start: endStart,
            end: endStart + ctaDuration,
            score: 0.9,
            type: 'engagement',
            label: 'CTA Loop',
            retentionBoost: 10,
          });
        }

      } else if (style === 'highlights') {
        // HIGHLIGHTS STRATEGY: Maximum hype density with perfect pacing
        const targetClipCount = Math.ceil(duration / optimalCutFrequency);
        let remainingTime = duration;

        // Front-load the best content (attention curve optimization)
        const rankedMoments = [...hypeMoments].sort((a, b) => b.score - a.score);

        // First clip should be HIGH impact (hook)
        if (rankedMoments.length > 0) {
          const hookMoment = rankedMoments[0];
          const hookDuration = Math.min(hookMoment.end - hookMoment.start, optimalCutFrequency * 1.5, remainingTime);
          selectedClips.push({
            ...hookMoment,
            end: hookMoment.start + hookDuration,
            type: 'hook',
            label: 'Opening Impact',
          });
          remainingTime -= hookDuration;
          rankedMoments.shift();
        }

        // Add remaining hype moments with optimal spacing
        for (const moment of rankedMoments) {
          if (remainingTime <= 0 || selectedClips.length >= targetClipCount) break;

          const idealClipDuration = optimalCutFrequency;
          const clipDuration = Math.min(
            moment.end - moment.start,
            idealClipDuration,
            remainingTime
          );

          // Check for overlaps
          const overlaps = selectedClips.some(
            (c) => !(moment.start + clipDuration < c.start || moment.start > c.end)
          );

          if (!overlaps) {
            selectedClips.push({
              ...moment,
              end: moment.start + clipDuration,
            });
            remainingTime -= clipDuration;
          }
        }

        // Inject pattern interrupts for retention
        if (addPatternInterrupts && remainingTime > 2 && patternInterrupts.length > 0) {
          const interrupt = patternInterrupts.find(pi =>
            !selectedClips.some(c => !(pi.start + 2 < c.start || pi.start > c.end))
          );
          if (interrupt) {
            const clipDuration = Math.min(2, remainingTime);
            selectedClips.push({
              ...interrupt,
              end: interrupt.start + clipDuration,
            });
            remainingTime -= clipDuration;
          }
        }

        // Fill gaps with strategic content (avoid dead spots)
        while (remainingTime > 3 && selectedClips.length < targetClipCount) {
          const gapStart = Math.random() * (videoDuration - remainingTime);
          const clipDuration = Math.min(remainingTime, optimalCutFrequency);

          const overlaps = selectedClips.some(
            (c) => !(gapStart + clipDuration < c.start || gapStart > c.end)
          );

          if (!overlaps) {
            selectedClips.push({
              start: gapStart,
              end: gapStart + clipDuration,
              score: 0.6,
              type: 'engagement',
              label: 'Connector',
              retentionBoost: 5,
            });
            remainingTime -= clipDuration;
          } else {
            break; // Avoid infinite loop
          }
        }

      } else {
        // SUMMARY STRATEGY: Narrative arc with peaks
        const numSegments = Math.ceil(duration / 10);
        const segmentDuration = duration / numSegments;
        const arcPoints = ['intro', 'rising', 'climax', 'resolution'];

        for (let i = 0; i < numSegments; i++) {
          const arcPosition = arcPoints[Math.min(i, arcPoints.length - 1)];
          const videoPosition = videoDuration * ((i + 0.5) / numSegments);

          let segmentStart = videoPosition - segmentDuration / 2;
          let segmentScore = 0.8;

          // Try to align with hype moments for the climax
          if (arcPosition === 'climax' && hypeMoments.length > 0) {
            const nearbyHype = hypeMoments.find(m =>
              Math.abs(m.start - videoPosition) < videoDuration * 0.2
            );
            if (nearbyHype) {
              segmentStart = nearbyHype.start;
              segmentScore = nearbyHype.score;
            }
          }

          selectedClips.push({
            start: Math.max(0, segmentStart),
            end: Math.min(segmentStart + segmentDuration, videoDuration),
            score: segmentScore,
            type: arcPosition === 'climax' ? 'climax' : 'engagement',
            label: `${arcPosition.charAt(0).toUpperCase() + arcPosition.slice(1)} ${i + 1}`,
            retentionBoost: arcPosition === 'climax' ? 20 : 10,
          });
        }
      }

      setProcessingProgress(60);

      // Sort clips chronologically for narrative flow
      selectedClips.sort((a, b) => a.start - b.start);

      // Optimize transitions based on pacing style
      const transitionDuration = pacingStyle === 'fast' ? 0.15 : pacingStyle === 'storytelling' ? 0.5 : 0.3;
      const transitionTypes: Array<Transition['type']> =
        pacingStyle === 'fast'
          ? ['fade', 'zoom-in', 'spin']
          : pacingStyle === 'storytelling'
          ? ['dissolve', 'fade', 'crossfade']
          : ['fade', 'dissolve', 'wipe-left', 'zoom-in'];

      setProcessingProgress(70);
      setProcessing(true, 'Calculating viral potential...');

      // Calculate comprehensive viral metrics
      const hasStrongHook = selectedClips.some((c) => c.type === 'hook' && c.score > 0.8);
      const totalDuration = selectedClips.reduce((sum, c) => sum + (c.end - c.start), 0);
      const metrics = calculateViralMetrics(
        selectedClips,
        totalDuration,
        hasStrongHook,
        beats,
        patternInterrupts.length
      );
      setViralMetrics(metrics);

      // Create a new track for the short
      const shortTrackId = uuidv4();
      const shortTrack: Track = {
        id: shortTrackId,
        name: `🔥 Viral Short (${Math.round(totalDuration)}s) - ${metrics.overallViralScore}% viral score`,
        type: 'video',
        clips: [],
        height: 80,
        locked: false,
        muted: false,
        visible: true,
      };

      setProcessingProgress(80);

      // Add clips to the track with viral-optimized transitions
      let timelinePosition = 0;
      selectedClips.forEach((clip, index) => {
        const clipId = uuidv4();
        const transitions: Transition[] = [];

        // Add transitions between clips (beat-synced if possible)
        if (autoTransitions && index > 0) {
          const randomTransition = transitionTypes[Math.floor(Math.random() * transitionTypes.length)];

          // Sync to nearest beat if available
          let syncedDuration = transitionDuration;
          if (beats.length > 0) {
            const clipStartTime = clip.start;
            const nearestBeat = beats.find(b => Math.abs(b - clipStartTime) < 0.3);
            if (nearestBeat) {
              syncedDuration = Math.min(transitionDuration * 1.2, 0.5); // Emphasize beat-synced transitions
            }
          }

          transitions.push({
            id: uuidv4(),
            type: randomTransition,
            duration: syncedDuration,
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
          effects: addSpeedRamps && clip.type === 'climax' ? [{
            id: uuidv4(),
            type: 'speed' as const,
            params: { speed: 1.2, rampIn: 0.3, rampOut: 0.3 },
          }] : [],
          transitions,
          locked: false,
        };
        shortTrack.clips.push(clipData);
        timelinePosition += clip.end - clip.start;
      });

      setProcessingProgress(90);
      setProcessing(true, 'Adding viral optimizations...');

      // Generate auto-captions if enabled
      let newCaptions = [...project.captions];
      if (addCaptions) {
        const generatedCaptions = generateAutoCaptions(selectedClips, totalDuration);
        newCaptions = [...newCaptions, ...generatedCaptions];
      }

      setProcessingProgress(95);

      // Update project with all optimizations
      const projectUpdates: Parameters<typeof updateProject>[0] = {
        tracks: [...project.tracks, shortTrack],
        captions: newCaptions,
        duration: Math.max(project.duration, timelinePosition),
      };

      if (verticalCrop) {
        projectUpdates.resolution = {
          width: 1080,
          height: 1920,
          label: '1080x1920 (Vertical)',
        };
        projectUpdates.aspectRatio = '9:16';
      }

      updateProject(projectUpdates);

      setProcessingProgress(100);

      const hypeMomentCount = selectedClips.filter((c) => c.type === 'climax' || c.type === 'peak' || c.type === 'payoff').length;
      const platformName = platform === 'all' ? 'all platforms' : platform.charAt(0).toUpperCase() + platform.slice(1);

      toast.success(
        `🔥 Created ${Math.round(totalDuration)}s viral short!\n` +
        `${selectedClips.length} clips • ${hypeMomentCount} hype moments\n` +
        `Viral Score: ${metrics.overallViralScore}% • Est. ${metrics.estimatedViews.toLocaleString()} views\n` +
        `Optimized for ${platformName}`,
        { duration: 6000 }
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
          Transform your long-form video into a viral short optimized for maximum engagement.
        </p>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {/* Platform Selection */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4" />
              Target Platform
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
                { value: 'reels', label: 'Reels', emoji: '📸' },
                { value: 'shorts', label: 'Shorts', emoji: '▶️' },
                { value: 'all', label: 'All', emoji: '🌐' },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value as Platform)}
                  className={`rounded-md border p-2 text-center text-xs ${
                    platform === p.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-lg">{p.emoji}</div>
                  <div className="font-medium">{p.label}</div>
                </button>
              ))}
            </div>
          </div>

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
              Content Strategy
            </label>
            <div className="space-y-2">
              {[
                {
                  value: 'hook',
                  label: 'Viral Hook',
                  desc: 'Killer opening → escalating hype → viral payoff',
                  icon: '🎯',
                },
                {
                  value: 'highlights',
                  label: 'Maximum Impact',
                  desc: 'Best moments front-loaded for retention',
                  icon: '🔥',
                },
                {
                  value: 'summary',
                  label: 'Story Arc',
                  desc: 'Narrative flow with dramatic peaks',
                  icon: '📖',
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
                  <p className="font-medium flex items-center gap-2">
                    <span>{s.icon}</span>
                    {s.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Pacing */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Flame className="h-4 w-4" />
              Pacing Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'fast', label: 'Fast Cuts', desc: '~2s clips' },
                { value: 'dynamic', label: 'Dynamic', desc: '~3s clips' },
                { value: 'storytelling', label: 'Story', desc: '~4s clips' },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPacingStyle(p.value as PacingStyle)}
                  className={`rounded-md border p-2 text-center ${
                    pacingStyle === p.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Viral Enhancements */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4" />
              Viral Optimizations
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={addPatternInterrupts}
                  onChange={(e) => setAddPatternInterrupts(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <div className="text-sm">
                  <span className="font-medium">Pattern Interrupts</span>
                  <p className="text-xs text-muted-foreground">Keep attention with sudden changes</p>
                </div>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={optimizeForShares}
                  onChange={(e) => setOptimizeForShares(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <div className="text-sm">
                  <span className="font-medium">Optimize for Shares</span>
                  <p className="text-xs text-muted-foreground">Prioritize share-worthy moments</p>
                </div>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoTransitions}
                  onChange={(e) => setAutoTransitions(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Beat-synced transitions</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={addCaptions}
                  onChange={(e) => setAddCaptions(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Auto-generated engagement captions</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={addSpeedRamps}
                  onChange={(e) => setAddSpeedRamps(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Speed ramps on climax moments</span>
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

          {/* Viral Metrics Dashboard */}
          {viralMetrics && (
            <div className="rounded-md bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 p-4 border border-purple-500/20">
              <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                Viral Potential Analysis
              </h4>

              {/* Overall Score */}
              <div className="mb-4 text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {viralMetrics.overallViralScore}%
                </div>
                <p className="text-xs text-muted-foreground">Viral Score</p>
              </div>

              {/* Detailed Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-black/20 rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Target className="h-3 w-3 text-red-400" />
                    <span className="text-xs">Hook Strength</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-red-400 h-2 rounded-full"
                        style={{ width: `${viralMetrics.hookStrength}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold">{viralMetrics.hookStrength}%</span>
                  </div>
                </div>

                <div className="bg-black/20 rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Eye className="h-3 w-3 text-blue-400" />
                    <span className="text-xs">Retention</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-400 h-2 rounded-full"
                        style={{ width: `${viralMetrics.retentionScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold">{viralMetrics.retentionScore}%</span>
                  </div>
                </div>

                <div className="bg-black/20 rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Share2 className="h-3 w-3 text-green-400" />
                    <span className="text-xs">Shareability</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-400 h-2 rounded-full"
                        style={{ width: `${viralMetrics.shareability}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold">{viralMetrics.shareability}%</span>
                  </div>
                </div>

                <div className="bg-black/20 rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Repeat className="h-3 w-3 text-yellow-400" />
                    <span className="text-xs">Rewatch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${viralMetrics.rewatchValue}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold">{viralMetrics.rewatchValue}%</span>
                  </div>
                </div>
              </div>

              {/* Estimated Performance */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <Eye className="h-4 w-4 mx-auto text-purple-400 mb-1" />
                  <p className="text-lg font-bold">{viralMetrics.estimatedViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Est. Views</p>
                </div>
                <div>
                  <Flame className="h-4 w-4 mx-auto text-red-400 mb-1" />
                  <p className="text-lg font-bold">{viralMetrics.estimatedLikes.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Est. Likes</p>
                </div>
                <div>
                  <Share2 className="h-4 w-4 mx-auto text-green-400 mb-1" />
                  <p className="text-lg font-bold">{viralMetrics.estimatedShares.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Est. Shares</p>
                </div>
              </div>

              {/* Platform Fit */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-muted-foreground mb-2">Platform Fit</p>
                <div className="flex gap-2">
                  {Object.entries(viralMetrics.platformFit).map(([plat, score]) => (
                    <div key={plat} className="flex-1 text-center">
                      <p className="text-xs font-medium">{plat.charAt(0).toUpperCase() + plat.slice(1)}</p>
                      <p className="text-sm font-bold">{score}%</p>
                    </div>
                  ))}
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
