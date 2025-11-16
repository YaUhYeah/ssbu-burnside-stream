import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { transcribeAudio, optimizeCaptionTiming, identifySpeakers } from '@/utils/speechRecognition';
import { getHighlightDetector } from '@/utils/highlightDetection';
import { getAudioProcessor } from '@/utils/audioProcessor';
import { detectSilence, suggestBRollPoints, summarizeContent, generateHashtags } from '@/utils/ai';
import type { Caption, Highlight } from '@/types';
import toast from 'react-hot-toast';

interface AIFeatureState {
  isProcessing: boolean;
  progress: number;
  currentTask: string;
}

export function useAIFeatures() {
  const [state, setState] = useState<AIFeatureState>({
    isProcessing: false,
    progress: 0,
    currentTask: '',
  });

  const { project, addCaption } = useProjectStore();
  const { setProcessing, setProcessingProgress } = useUIStore();

  const updateProgress = useCallback((progress: number, task: string) => {
    setState((prev) => ({ ...prev, progress, currentTask: task }));
    setProcessingProgress(progress);
  }, [setProcessingProgress]);

  const generateCaptions = useCallback(async (): Promise<Caption[]> => {
    if (!project || project.media.length === 0) {
      toast.error('No media to generate captions from');
      return [];
    }

    setState({ isProcessing: true, progress: 0, currentTask: 'Preparing audio...' });
    setProcessing(true, 'Generating captions...');

    try {
      // Find first video or audio file
      const mediaFile = project.media.find(
        (m) => m.type === 'video' || m.type === 'audio'
      );

      if (!mediaFile) {
        throw new Error('No audio or video media found');
      }

      updateProgress(10, 'Extracting audio...');

      // Fetch the media file as blob
      const response = await fetch(mediaFile.path);
      const mediaBlob = await response.blob();

      updateProgress(30, 'Analyzing speech patterns...');

      // Transcribe audio
      let captions = await transcribeAudio(mediaBlob);

      updateProgress(60, 'Optimizing caption timing...');

      // Optimize timing
      captions = optimizeCaptionTiming(captions);

      updateProgress(80, 'Identifying speakers...');

      // Identify speakers
      captions = identifySpeakers(captions);

      updateProgress(90, 'Adding captions to project...');

      // Add to project
      captions.forEach((caption) => {
        addCaption(caption);
      });

      updateProgress(100, 'Complete!');
      toast.success(`Generated ${captions.length} captions`);

      return captions;
    } catch (error) {
      console.error('Caption generation error:', error);
      toast.error('Failed to generate captions');
      return [];
    } finally {
      setState({ isProcessing: false, progress: 0, currentTask: '' });
      setProcessing(false);
    }
  }, [project, addCaption, setProcessing, updateProgress]);

  const detectHighlights = useCallback(async (): Promise<Highlight[]> => {
    if (!project || project.media.length === 0) {
      toast.error('No media to analyze');
      return [];
    }

    setState({ isProcessing: true, progress: 0, currentTask: 'Analyzing media...' });
    setProcessing(true, 'Detecting highlights...');

    try {
      const mediaFile = project.media.find(
        (m) => m.type === 'video' || m.type === 'audio'
      );

      if (!mediaFile) {
        throw new Error('No audio or video media found');
      }

      updateProgress(10, 'Loading media...');

      const response = await fetch(mediaFile.path);
      const mediaBlob = await response.blob();

      updateProgress(20, 'Decoding audio...');

      // Decode audio
      const audioContext = new AudioContext();
      const arrayBuffer = await mediaBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      updateProgress(40, 'Analyzing audio patterns...');

      // Detect highlights
      const detector = getHighlightDetector();
      const highlights = await detector.detectHighlights(audioBuffer, {
        minDuration: 3,
        maxHighlights: 10,
        sensitivity: 0.7,
      });

      updateProgress(80, 'Ranking highlights...');

      await audioContext.close();

      updateProgress(100, 'Complete!');
      toast.success(`Found ${highlights.length} highlights`);

      return highlights;
    } catch (error) {
      console.error('Highlight detection error:', error);
      toast.error('Failed to detect highlights');
      return [];
    } finally {
      setState({ isProcessing: false, progress: 0, currentTask: '' });
      setProcessing(false);
    }
  }, [project, setProcessing, updateProgress]);

  const removeSilences = useCallback(async (): Promise<Array<{ start: number; end: number }>> => {
    if (!project || project.media.length === 0) {
      toast.error('No media to analyze');
      return [];
    }

    setState({ isProcessing: true, progress: 0, currentTask: 'Analyzing audio...' });
    setProcessing(true, 'Detecting silences...');

    try {
      const mediaFile = project.media.find(
        (m) => m.type === 'video' || m.type === 'audio'
      );

      if (!mediaFile) {
        throw new Error('No audio or video media found');
      }

      updateProgress(20, 'Loading audio...');

      const response = await fetch(mediaFile.path);
      const mediaBlob = await response.blob();

      updateProgress(40, 'Decoding audio...');

      const audioContext = new AudioContext();
      const arrayBuffer = await mediaBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      updateProgress(60, 'Detecting silences...');

      const channelData = audioBuffer.getChannelData(0);
      const silences = detectSilence(channelData, audioBuffer.sampleRate, 0.01, 0.5);

      await audioContext.close();

      updateProgress(100, 'Complete!');
      toast.success(`Found ${silences.length} silent segments`);

      return silences;
    } catch (error) {
      console.error('Silence detection error:', error);
      toast.error('Failed to detect silences');
      return [];
    } finally {
      setState({ isProcessing: false, progress: 0, currentTask: '' });
      setProcessing(false);
    }
  }, [project, setProcessing, updateProgress]);

  const analyzeAudio = useCallback(async () => {
    if (!project || project.media.length === 0) {
      toast.error('No media to analyze');
      return null;
    }

    setState({ isProcessing: true, progress: 0, currentTask: 'Analyzing audio...' });
    setProcessing(true, 'Analyzing audio properties...');

    try {
      const mediaFile = project.media.find(
        (m) => m.type === 'video' || m.type === 'audio'
      );

      if (!mediaFile) {
        throw new Error('No audio or video media found');
      }

      updateProgress(30, 'Processing audio...');

      const response = await fetch(mediaFile.path);
      const mediaBlob = await response.blob();

      const processor = getAudioProcessor();
      const analysis = await processor.analyzeAudio(mediaBlob);

      updateProgress(100, 'Complete!');

      toast.success(`Audio analyzed: ${analysis.loudness.integrated.toFixed(1)} LUFS`);

      return analysis;
    } catch (error) {
      console.error('Audio analysis error:', error);
      toast.error('Failed to analyze audio');
      return null;
    } finally {
      setState({ isProcessing: false, progress: 0, currentTask: '' });
      setProcessing(false);
    }
  }, [project, setProcessing, updateProgress]);

  const generateSummary = useCallback(async (): Promise<{
    summary: string;
    hashtags: string[];
  }> => {
    if (!project || project.captions.length === 0) {
      toast.error('Generate captions first');
      return { summary: '', hashtags: [] };
    }

    setState({ isProcessing: true, progress: 0, currentTask: 'Generating summary...' });
    setProcessing(true, 'Creating content summary...');

    try {
      updateProgress(30, 'Analyzing content...');

      const summary = summarizeContent(project.captions);

      updateProgress(60, 'Generating hashtags...');

      const hashtags = generateHashtags(project.captions);

      updateProgress(100, 'Complete!');

      toast.success('Summary generated');

      return { summary, hashtags };
    } catch (error) {
      console.error('Summary generation error:', error);
      toast.error('Failed to generate summary');
      return { summary: '', hashtags: [] };
    } finally {
      setState({ isProcessing: false, progress: 0, currentTask: '' });
      setProcessing(false);
    }
  }, [project, setProcessing, updateProgress]);

  const suggestBRoll = useCallback(async (): Promise<number[]> => {
    if (!project || project.captions.length === 0) {
      toast.error('Generate captions first');
      return [];
    }

    const points = suggestBRollPoints(project.captions);
    toast.success(`Found ${points.length} B-roll insertion points`);
    return points;
  }, [project]);

  return {
    ...state,
    generateCaptions,
    detectHighlights,
    removeSilences,
    analyzeAudio,
    generateSummary,
    suggestBRoll,
  };
}
