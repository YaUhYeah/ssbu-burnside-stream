export interface MediaFile {
  id: string;
  name: string;
  path: string;
  type: 'video' | 'audio' | 'image';
  duration: number;
  size: number;
  width?: number;
  height?: number;
  fps?: number;
  thumbnail?: string;
  waveform?: number[];
  createdAt: Date;
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  trackId: string;
  startTime: number; // Position on timeline (seconds)
  duration: number; // Duration on timeline (seconds)
  inPoint: number; // Start point in source media
  outPoint: number; // End point in source media
  volume: number;
  opacity: number;
  effects: Effect[];
  transitions: Transition[];
  locked: boolean;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'caption' | 'overlay';
  muted: boolean;
  locked: boolean;
  visible: boolean;
  height: number;
  clips: TimelineClip[];
}

export interface Effect {
  id: string;
  type: EffectType;
  params: Record<string, number | string | boolean>;
  startTime?: number;
  endTime?: number;
  keyframes?: Keyframe[];
}

export type EffectType =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'blur'
  | 'sharpen'
  | 'noise-reduction'
  | 'color-correction'
  | 'crop'
  | 'scale'
  | 'rotate'
  | 'flip'
  | 'stabilize'
  | 'speed'
  | 'reverse';

export interface Transition {
  id: string;
  type: TransitionType;
  duration: number;
  position: 'start' | 'end';
  params: Record<string, number | string>;
}

export type TransitionType =
  | 'fade'
  | 'crossfade'
  | 'dissolve'
  | 'wipe'
  | 'slide'
  | 'zoom'
  | 'whip'
  | 'glitch';

export interface Keyframe {
  time: number;
  value: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface Caption {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  style: CaptionStyle;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  position: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
  outline: boolean;
  shadow: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  resolution: Resolution;
  fps: number;
  aspectRatio: AspectRatio;
  duration: number;
  tracks: Track[];
  media: MediaFile[];
  captions: Caption[];
  settings: ProjectSettings;
}

export interface Resolution {
  width: number;
  height: number;
  label: string;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '4:3';

export interface ProjectSettings {
  autoSave: boolean;
  autoSaveInterval: number;
  showWaveforms: boolean;
  snapToGrid: boolean;
  gridSize: number;
  defaultTransitionDuration: number;
  defaultCaptionStyle: CaptionStyle;
}

export interface ExportPreset {
  id: string;
  name: string;
  platform: Platform;
  resolution: Resolution;
  fps: number;
  bitrate: number;
  codec: string;
  format: string;
  audioCodec: string;
  audioBitrate: number;
  aspectRatio: AspectRatio;
}

export type Platform =
  | 'youtube'
  | 'youtube-shorts'
  | 'tiktok'
  | 'instagram-reels'
  | 'instagram-feed'
  | 'twitter'
  | 'facebook'
  | 'vimeo'
  | 'custom';

export interface ExportJob {
  id: string;
  projectId: string;
  preset: ExportPreset;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputPath: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: TemplateCategory;
  duration: number;
  aspectRatio: AspectRatio;
  tracks: Track[];
  placeholders: TemplatePlaceholder[];
}

export type TemplateCategory =
  | 'gaming'
  | 'vlog'
  | 'podcast'
  | 'tutorial'
  | 'product'
  | 'announcement'
  | 'trending';

export interface TemplatePlaceholder {
  id: string;
  type: 'video' | 'audio' | 'image' | 'text';
  name: string;
  required: boolean;
  duration?: number;
}

export interface Highlight {
  id: string;
  startTime: number;
  endTime: number;
  score: number;
  type: 'audio-peak' | 'motion' | 'face-emotion' | 'combined';
  thumbnail?: string;
}

export interface AIAnalysisResult {
  highlights: Highlight[];
  scenes: SceneDetection[];
  silences: TimeRange[];
  captions: Caption[];
}

export interface SceneDetection {
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  editorMode: 'beginner' | 'advanced';
  language: string;
  autoPlay: boolean;
  showTooltips: boolean;
  keyboardShortcuts: Record<string, string>;
  recentProjects: string[];
  cloudEnabled: boolean;
  privacyMode: boolean;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
}
