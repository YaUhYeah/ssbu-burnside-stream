import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type {
  Project,
  Track,
  TimelineClip,
  MediaFile,
  Caption,
  AspectRatio,
  Resolution,
  TextOverlay,
} from '@/types';

interface ProjectState {
  project: Project | null;
  selectedClipIds: string[];
  selectedTrackId: string | null;
  currentTime: number;
  isPlaying: boolean;
  zoom: number;
  scrollPosition: number;
  undoStack: Project[];
  redoStack: Project[];
  isDirty: boolean;
  clipboard: TimelineClip[];
}

interface ProjectActions {
  createProject: (name: string, aspectRatio: AspectRatio) => void;
  loadProject: (project: Project) => void;
  saveProject: () => void;
  updateProject: (updates: Partial<Project>) => void;

  // Media
  addMedia: (media: MediaFile) => void;
  removeMedia: (mediaId: string) => void;
  updateMediaFile: (mediaId: string, updates: Partial<MediaFile>) => void;

  // Tracks
  addTrack: (type: Track['type']) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;

  // Clips
  addClip: (trackId: string, clip: Omit<TimelineClip, 'id'>) => void;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
  moveClip: (fromTrackId: string, toTrackId: string, clipId: string, newStartTime: number) => void;
  splitClip: (trackId: string, clipId: string, splitTime: number) => void;
  trimClip: (trackId: string, clipId: string, inPoint: number, outPoint: number) => void;
  separateVideoAudio: (trackId: string, clipId: string) => void;

  // Captions
  addCaption: (caption: Caption) => void;
  updateCaption: (captionId: string, updates: Partial<Caption>) => void;
  removeCaption: (captionId: string) => void;

  // Text Overlays
  addTextOverlay: (textOverlay: TextOverlay) => void;
  updateTextOverlay: (textOverlayId: string, updates: Partial<TextOverlay>) => void;
  removeTextOverlay: (textOverlayId: string) => void;

  // Selection
  selectClip: (clipId: string, multi?: boolean) => void;
  deselectAllClips: () => void;
  selectTrack: (trackId: string) => void;

  // Clipboard
  copySelectedClips: () => void;
  pasteClips: () => void;
  deleteSelectedClips: () => void;

  // Playback
  setCurrentTime: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekForward: (seconds: number) => void;
  seekBackward: (seconds: number) => void;

  // View
  setZoom: (zoom: number) => void;
  setScrollPosition: (position: number) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushToUndoStack: () => void;

  // Utilities
  getClipAtTime: (trackId: string, time: number) => TimelineClip | undefined;
  getTrackById: (trackId: string) => Track | undefined;
  getMediaById: (mediaId: string) => MediaFile | undefined;
  calculateDuration: () => number;
}

const RESOLUTIONS: Record<AspectRatio, Resolution> = {
  '16:9': { width: 1920, height: 1080, label: '1080p' },
  '9:16': { width: 1080, height: 1920, label: '1080p Vertical' },
  '1:1': { width: 1080, height: 1080, label: '1080x1080' },
  '4:5': { width: 1080, height: 1350, label: '1080x1350' },
  '4:3': { width: 1440, height: 1080, label: '1440x1080' },
};

const createDefaultTrack = (type: Track['type'], index: number): Track => ({
  id: uuidv4(),
  name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${index}`,
  type,
  muted: false,
  locked: false,
  visible: true,
  height: type === 'video' ? 80 : 60,
  clips: [],
});

const createDefaultProject = (name: string, aspectRatio: AspectRatio): Project => ({
  id: uuidv4(),
  name,
  description: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  resolution: RESOLUTIONS[aspectRatio],
  fps: 30,
  aspectRatio,
  duration: 0,
  tracks: [
    createDefaultTrack('video', 1),
    createDefaultTrack('audio', 1),
    createDefaultTrack('caption', 1),
  ],
  media: [],
  captions: [],
  textOverlays: [],
  settings: {
    autoSave: true,
    autoSaveInterval: 60000,
    showWaveforms: true,
    snapToGrid: true,
    gridSize: 0.1,
    defaultTransitionDuration: 0.5,
    defaultCaptionStyle: {
      fontFamily: 'Arial',
      fontSize: 24,
      color: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      position: 'bottom',
      alignment: 'center',
      outline: true,
      shadow: true,
    },
  },
});

export const useProjectStore = create<ProjectState & ProjectActions>()(
  persist(
    immer((set, get) => ({
      // State
      project: null,
      selectedClipIds: [],
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      zoom: 1,
      scrollPosition: 0,
      undoStack: [],
      redoStack: [],
      isDirty: false,
      clipboard: [],

      // Actions
      createProject: (name, aspectRatio) => {
        const project = createDefaultProject(name, aspectRatio);
        set((state) => {
          state.project = project;
          state.selectedClipIds = [];
          state.selectedTrackId = null;
          state.currentTime = 0;
          state.isPlaying = false;
          state.undoStack = [];
          state.redoStack = [];
          state.isDirty = false;
        });
      },

      loadProject: (project) => {
        set((state) => {
          state.project = project;
          state.selectedClipIds = [];
          state.selectedTrackId = null;
          state.currentTime = 0;
          state.isPlaying = false;
          state.undoStack = [];
          state.redoStack = [];
          state.isDirty = false;
        });
      },

      saveProject: () => {
        set((state) => {
          if (state.project) {
            state.project.updatedAt = new Date();
            state.isDirty = false;
          }
        });
      },

      updateProject: (updates) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            Object.assign(state.project, updates);
            state.project.updatedAt = new Date();
            state.isDirty = true;
          }
        });
      },

      addMedia: (media) => {
        set((state) => {
          if (state.project) {
            state.project.media.push(media);
            state.isDirty = true;
          }
        });
      },

      removeMedia: (mediaId) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            state.project.media = state.project.media.filter((m) => m.id !== mediaId);
            state.project.tracks.forEach((track) => {
              track.clips = track.clips.filter((clip) => clip.mediaId !== mediaId);
            });
            state.isDirty = true;
          }
        });
      },

      updateMediaFile: (mediaId, updates) => {
        set((state) => {
          if (state.project) {
            const mediaIndex = state.project.media.findIndex((m) => m.id === mediaId);
            if (mediaIndex >= 0) {
              state.project.media[mediaIndex] = {
                ...state.project.media[mediaIndex],
                ...updates,
              };
            }
          }
        });
      },

      addTrack: (type) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            const count = state.project.tracks.filter((t) => t.type === type).length + 1;
            state.project.tracks.push(createDefaultTrack(type, count));
            state.isDirty = true;
          }
        });
      },

      removeTrack: (trackId) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            state.project.tracks = state.project.tracks.filter((t) => t.id !== trackId);
            state.isDirty = true;
          }
        });
      },

      updateTrack: (trackId, updates) => {
        set((state) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              Object.assign(track, updates);
              state.isDirty = true;
            }
          }
        });
      },

      reorderTracks: (fromIndex, toIndex) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            const [track] = state.project.tracks.splice(fromIndex, 1);
            state.project.tracks.splice(toIndex, 0, track);
            state.isDirty = true;
          }
        });
      },

      addClip: (trackId, clipData) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              const clip: TimelineClip = {
                ...clipData,
                id: uuidv4(),
              };
              track.clips.push(clip);
              state.isDirty = true;
            }
          }
        });
        // Update duration after state change
        const duration = get().calculateDuration();
        set((state) => {
          if (state.project) {
            state.project.duration = duration;
          }
        });
      },

      removeClip: (trackId, clipId) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              track.clips = track.clips.filter((c) => c.id !== clipId);
              state.isDirty = true;
            }
          }
        });
        const duration = get().calculateDuration();
        set((state) => {
          if (state.project) {
            state.project.duration = duration;
          }
        });
      },

      updateClip: (trackId, clipId, updates) => {
        set((state) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              const clip = track.clips.find((c) => c.id === clipId);
              if (clip) {
                Object.assign(clip, updates);
                state.isDirty = true;
              }
            }
          }
        });
        const duration = get().calculateDuration();
        set((state) => {
          if (state.project) {
            state.project.duration = duration;
          }
        });
      },

      moveClip: (fromTrackId, toTrackId, clipId, newStartTime) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            const fromTrack = state.project.tracks.find((t) => t.id === fromTrackId);
            const toTrack = state.project.tracks.find((t) => t.id === toTrackId);
            if (fromTrack && toTrack) {
              const clipIndex = fromTrack.clips.findIndex((c) => c.id === clipId);
              if (clipIndex !== -1) {
                const [clip] = fromTrack.clips.splice(clipIndex, 1);
                clip.trackId = toTrackId;
                clip.startTime = newStartTime;
                toTrack.clips.push(clip);
                state.isDirty = true;
              }
            }
          }
        });
        const duration = get().calculateDuration();
        set((state) => {
          if (state.project) {
            state.project.duration = duration;
          }
        });
      },

      splitClip: (trackId, clipId, splitTime) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              const clipIndex = track.clips.findIndex((c) => c.id === clipId);
              if (clipIndex !== -1) {
                const clip = track.clips[clipIndex];
                const relativeTime = splitTime - clip.startTime;

                if (relativeTime > 0 && relativeTime < clip.duration) {
                  const newClip: TimelineClip = {
                    ...clip,
                    id: uuidv4(),
                    startTime: splitTime,
                    duration: clip.duration - relativeTime,
                    inPoint: clip.inPoint + relativeTime,
                  };

                  clip.duration = relativeTime;
                  clip.outPoint = clip.inPoint + relativeTime;

                  track.clips.splice(clipIndex + 1, 0, newClip);
                  state.isDirty = true;
                }
              }
            }
          }
        });
      },

      trimClip: (trackId, clipId, inPoint, outPoint) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              const clip = track.clips.find((c) => c.id === clipId);
              if (clip) {
                const newDuration = outPoint - inPoint;
                clip.inPoint = inPoint;
                clip.outPoint = outPoint;
                clip.duration = newDuration;
                state.isDirty = true;
              }
            }
          }
        });
        const duration = get().calculateDuration();
        set((state) => {
          if (state.project) {
            state.project.duration = duration;
          }
        });
      },

      separateVideoAudio: (trackId, clipId) => {
        get().pushToUndoStack();
        set((state) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (!track) return;

            const clip = track.clips.find((c) => c.id === clipId);
            if (!clip) return;

            const media = state.project.media.find((m) => m.id === clip.mediaId);
            if (!media || media.type !== 'video') return;

            // Create audio version of the media file
            const audioMedia: MediaFile = {
              id: `${media.id}-audio`,
              name: `${media.name} (Audio)`,
              path: media.path,
              type: 'audio',
              duration: media.duration,
              size: media.size,
              waveform: media.waveform,
              createdAt: new Date(),
            };

            // Add the audio media file
            state.project.media.push(audioMedia);

            // Find or create audio track
            let audioTrack = state.project.tracks.find((t) => t.type === 'audio');
            if (!audioTrack) {
              const newTrackId = `audio-${Date.now()}`;
              audioTrack = {
                id: newTrackId,
                name: `Audio ${state.project.tracks.filter((t) => t.type === 'audio').length + 1}`,
                type: 'audio',
                muted: false,
                locked: false,
                visible: true,
                height: 60,
                clips: [],
              };
              state.project.tracks.push(audioTrack);
            }

            // Create audio clip mirroring the video clip
            const audioClip: TimelineClip = {
              id: `${clip.id}-audio`,
              mediaId: audioMedia.id,
              trackId: audioTrack.id,
              startTime: clip.startTime,
              duration: clip.duration,
              inPoint: clip.inPoint,
              outPoint: clip.outPoint,
              volume: clip.volume,
              opacity: 1,
              effects: [],
              transitions: [],
              locked: false,
            };

            // Add audio clip to audio track
            audioTrack.clips.push(audioClip);

            // Mute the original video clip (detach audio)
            clip.volume = 0;

            state.isDirty = true;
          }
        });
      },

      addCaption: (caption) => {
        set((state) => {
          if (state.project) {
            state.project.captions.push(caption);
            state.isDirty = true;
          }
        });
      },

      updateCaption: (captionId, updates) => {
        set((state) => {
          if (state.project) {
            const caption = state.project.captions.find((c) => c.id === captionId);
            if (caption) {
              Object.assign(caption, updates);
              state.isDirty = true;
            }
          }
        });
      },

      removeCaption: (captionId) => {
        set((state) => {
          if (state.project) {
            state.project.captions = state.project.captions.filter((c) => c.id !== captionId);
            state.isDirty = true;
          }
        });
      },

      addTextOverlay: (textOverlay) => {
        set((state) => {
          if (state.project) {
            state.project.textOverlays.push(textOverlay);
            state.isDirty = true;
          }
        });
      },

      updateTextOverlay: (textOverlayId, updates) => {
        set((state) => {
          if (state.project) {
            const overlay = state.project.textOverlays.find((t) => t.id === textOverlayId);
            if (overlay) {
              Object.assign(overlay, updates);
              state.isDirty = true;
            }
          }
        });
      },

      removeTextOverlay: (textOverlayId) => {
        set((state) => {
          if (state.project) {
            state.project.textOverlays = state.project.textOverlays.filter((t) => t.id !== textOverlayId);
            state.isDirty = true;
          }
        });
      },

      selectClip: (clipId, multi = false) => {
        set((state) => {
          if (multi) {
            const index = state.selectedClipIds.indexOf(clipId);
            if (index === -1) {
              state.selectedClipIds.push(clipId);
            } else {
              state.selectedClipIds.splice(index, 1);
            }
          } else {
            state.selectedClipIds = [clipId];
          }
        });
      },

      deselectAllClips: () => {
        set((state) => {
          state.selectedClipIds = [];
        });
      },

      selectTrack: (trackId) => {
        set((state) => {
          state.selectedTrackId = trackId;
        });
      },

      copySelectedClips: () => {
        const { project, selectedClipIds } = get();
        if (!project || selectedClipIds.length === 0) return;

        const clipsToCopy: TimelineClip[] = [];
        for (const clipId of selectedClipIds) {
          for (const track of project.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              clipsToCopy.push({ ...clip });
              break;
            }
          }
        }

        set((state) => {
          state.clipboard = clipsToCopy;
        });
      },

      pasteClips: () => {
        const { project, clipboard, currentTime } = get();
        if (!project || clipboard.length === 0) return;

        get().pushToUndoStack();

        // Sort clips by start time to maintain relative positions
        const sortedClips = [...clipboard].sort((a, b) => a.startTime - b.startTime);
        const firstClipStart = sortedClips[0].startTime;
        const offset = currentTime - firstClipStart;

        set((state) => {
          if (!state.project) return;

          const newClipIds: string[] = [];

          for (const clipData of sortedClips) {
            // Find appropriate track for paste
            const targetTrack = state.project.tracks.find((t) => t.id === clipData.trackId) ||
              state.project.tracks[0];

            if (targetTrack) {
              const newClip: TimelineClip = {
                ...clipData,
                id: uuidv4(),
                trackId: targetTrack.id,
                startTime: clipData.startTime + offset,
              };
              targetTrack.clips.push(newClip);
              newClipIds.push(newClip.id);
            }
          }

          state.selectedClipIds = newClipIds;
          state.isDirty = true;
        });

        // Update duration
        const duration = get().calculateDuration();
        set((state) => {
          if (state.project) {
            state.project.duration = duration;
          }
        });
      },

      deleteSelectedClips: () => {
        const { project, selectedClipIds } = get();
        if (!project || selectedClipIds.length === 0) return;

        get().pushToUndoStack();

        set((state) => {
          if (!state.project) return;

          for (const clipId of selectedClipIds) {
            for (const track of state.project.tracks) {
              const clipIndex = track.clips.findIndex((c) => c.id === clipId);
              if (clipIndex !== -1) {
                track.clips.splice(clipIndex, 1);
                break;
              }
            }
          }

          state.selectedClipIds = [];
          state.isDirty = true;
        });

        // Update duration
        const duration = get().calculateDuration();
        set((state) => {
          if (state.project) {
            state.project.duration = duration;
          }
        });
      },

      setCurrentTime: (time) => {
        set((state) => {
          state.currentTime = Math.max(0, time);
        });
      },

      play: () => {
        set((state) => {
          state.isPlaying = true;
        });
      },

      pause: () => {
        set((state) => {
          state.isPlaying = false;
        });
      },

      togglePlay: () => {
        set((state) => {
          state.isPlaying = !state.isPlaying;
        });
      },

      seekForward: (seconds) => {
        set((state) => {
          state.currentTime = Math.min(
            state.currentTime + seconds,
            state.project?.duration || 0
          );
        });
      },

      seekBackward: (seconds) => {
        set((state) => {
          state.currentTime = Math.max(0, state.currentTime - seconds);
        });
      },

      setZoom: (zoom) => {
        set((state) => {
          state.zoom = Math.max(0.1, Math.min(10, zoom));
        });
      },

      setScrollPosition: (position) => {
        set((state) => {
          state.scrollPosition = position;
        });
      },

      undo: () => {
        set((state) => {
          if (state.undoStack.length > 0 && state.project) {
            state.redoStack.push(JSON.parse(JSON.stringify(state.project)));
            state.project = state.undoStack.pop()!;
            state.isDirty = true;
          }
        });
      },

      redo: () => {
        set((state) => {
          if (state.redoStack.length > 0 && state.project) {
            state.undoStack.push(JSON.parse(JSON.stringify(state.project)));
            state.project = state.redoStack.pop()!;
            state.isDirty = true;
          }
        });
      },

      pushToUndoStack: () => {
        set((state) => {
          if (state.project) {
            state.undoStack.push(JSON.parse(JSON.stringify(state.project)));
            state.redoStack = [];
            if (state.undoStack.length > 50) {
              state.undoStack.shift();
            }
          }
        });
      },

      getClipAtTime: (trackId, time) => {
        const { project } = get();
        if (!project) return undefined;
        const track = project.tracks.find((t) => t.id === trackId);
        if (!track) return undefined;
        return track.clips.find(
          (clip) => time >= clip.startTime && time <= clip.startTime + clip.duration
        );
      },

      getTrackById: (trackId) => {
        const { project } = get();
        if (!project) return undefined;
        return project.tracks.find((t) => t.id === trackId);
      },

      getMediaById: (mediaId) => {
        const { project } = get();
        if (!project) return undefined;
        return project.media.find((m) => m.id === mediaId);
      },

      calculateDuration: () => {
        const { project } = get();
        if (!project) return 0;
        let maxDuration = 0;
        project.tracks.forEach((track) => {
          track.clips.forEach((clip) => {
            const clipEnd = clip.startTime + clip.duration;
            if (clipEnd > maxDuration) {
              maxDuration = clipEnd;
            }
          });
        });
        return maxDuration;
      },
    })),
    {
      name: 'clipflow-project',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        project: state.project,
      }),
    }
  )
);
