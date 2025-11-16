import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { produce } from 'immer';
import type {
  Project,
  Track,
  TimelineClip,
  MediaFile,
  Caption,
  AspectRatio,
  Resolution,
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
}

interface ProjectActions {
  createProject: (name: string, aspectRatio: AspectRatio) => void;
  loadProject: (project: Project) => void;
  saveProject: () => void;
  updateProject: (updates: Partial<Project>) => void;

  // Media
  addMedia: (media: MediaFile) => void;
  removeMedia: (mediaId: string) => void;

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

  // Captions
  addCaption: (caption: Caption) => void;
  updateCaption: (captionId: string, updates: Partial<Caption>) => void;
  removeCaption: (captionId: string) => void;

  // Selection
  selectClip: (clipId: string, multi?: boolean) => void;
  deselectAllClips: () => void;
  selectTrack: (trackId: string) => void;

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
    (set, get) => ({
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

      // Actions
      createProject: (name, aspectRatio) => {
        const project = createDefaultProject(name, aspectRatio);
        set(produce((state: ProjectState) => {
          state.project = project;
          state.selectedClipIds = [];
          state.selectedTrackId = null;
          state.currentTime = 0;
          state.isPlaying = false;
          state.undoStack = [];
          state.redoStack = [];
          state.isDirty = false;
        }));
      },

      loadProject: (project) => {
        set(produce((state: ProjectState) => {
          state.project = project;
          state.selectedClipIds = [];
          state.selectedTrackId = null;
          state.currentTime = 0;
          state.isPlaying = false;
          state.undoStack = [];
          state.redoStack = [];
          state.isDirty = false;
        }));
      },

      saveProject: () => {
        set(produce((state: ProjectState) => {
          if (state.project) {
            state.project.updatedAt = new Date();
            state.isDirty = false;
          }
        }));
      },

      updateProject: (updates) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
          if (state.project) {
            Object.assign(state.project, updates);
            state.project.updatedAt = new Date();
            state.isDirty = true;
          }
        }));
      },

      addMedia: (media) => {
        set(produce((state: ProjectState) => {
          if (state.project) {
            state.project.media.push(media);
            state.isDirty = true;
          }
        }));
      },

      removeMedia: (mediaId) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
          if (state.project) {
            state.project.media = state.project.media.filter((m) => m.id !== mediaId);
            state.project.tracks.forEach((track) => {
              track.clips = track.clips.filter((clip) => clip.mediaId !== mediaId);
            });
            state.isDirty = true;
          }
        }));
      },

      addTrack: (type) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
          if (state.project) {
            const count = state.project.tracks.filter((t) => t.type === type).length + 1;
            state.project.tracks.push(createDefaultTrack(type, count));
            state.isDirty = true;
          }
        }));
      },

      removeTrack: (trackId) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
          if (state.project) {
            state.project.tracks = state.project.tracks.filter((t) => t.id !== trackId);
            state.isDirty = true;
          }
        }));
      },

      updateTrack: (trackId, updates) => {
        set(produce((state: ProjectState) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              Object.assign(track, updates);
              state.isDirty = true;
            }
          }
        }));
      },

      reorderTracks: (fromIndex, toIndex) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
          if (state.project) {
            const [track] = state.project.tracks.splice(fromIndex, 1);
            state.project.tracks.splice(toIndex, 0, track);
            state.isDirty = true;
          }
        }));
      },

      addClip: (trackId, clipData) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              const clip: TimelineClip = {
                ...clipData,
                id: uuidv4(),
              };
              track.clips.push(clip);
              state.project.duration = get().calculateDuration();
              state.isDirty = true;
            }
          }
        }));
      },

      removeClip: (trackId, clipId) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              track.clips = track.clips.filter((c) => c.id !== clipId);
              state.project.duration = get().calculateDuration();
              state.isDirty = true;
            }
          }
        }));
      },

      updateClip: (trackId, clipId, updates) => {
        set(produce((state: ProjectState) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              const clip = track.clips.find((c) => c.id === clipId);
              if (clip) {
                Object.assign(clip, updates);
                state.project.duration = get().calculateDuration();
                state.isDirty = true;
              }
            }
          }
        }));
      },

      moveClip: (fromTrackId, toTrackId, clipId, newStartTime) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
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
                state.project.duration = get().calculateDuration();
                state.isDirty = true;
              }
            }
          }
        }));
      },

      splitClip: (trackId, clipId, splitTime) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
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
        }));
      },

      trimClip: (trackId, clipId, inPoint, outPoint) => {
        get().pushToUndoStack();
        set(produce((state: ProjectState) => {
          if (state.project) {
            const track = state.project.tracks.find((t) => t.id === trackId);
            if (track) {
              const clip = track.clips.find((c) => c.id === clipId);
              if (clip) {
                const newDuration = outPoint - inPoint;
                clip.inPoint = inPoint;
                clip.outPoint = outPoint;
                clip.duration = newDuration;
                state.project.duration = get().calculateDuration();
                state.isDirty = true;
              }
            }
          }
        }));
      },

      addCaption: (caption) => {
        set(produce((state: ProjectState) => {
          if (state.project) {
            state.project.captions.push(caption);
            state.isDirty = true;
          }
        }));
      },

      updateCaption: (captionId, updates) => {
        set(produce((state: ProjectState) => {
          if (state.project) {
            const caption = state.project.captions.find((c) => c.id === captionId);
            if (caption) {
              Object.assign(caption, updates);
              state.isDirty = true;
            }
          }
        }));
      },

      removeCaption: (captionId) => {
        set(produce((state: ProjectState) => {
          if (state.project) {
            state.project.captions = state.project.captions.filter((c) => c.id !== captionId);
            state.isDirty = true;
          }
        }));
      },

      selectClip: (clipId, multi = false) => {
        set(produce((state: ProjectState) => {
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
        }));
      },

      deselectAllClips: () => {
        set(produce((state: ProjectState) => {
          state.selectedClipIds = [];
        }));
      },

      selectTrack: (trackId) => {
        set(produce((state: ProjectState) => {
          state.selectedTrackId = trackId;
        }));
      },

      setCurrentTime: (time) => {
        set(produce((state: ProjectState) => {
          state.currentTime = Math.max(0, time);
        }));
      },

      play: () => {
        set(produce((state: ProjectState) => {
          state.isPlaying = true;
        }));
      },

      pause: () => {
        set(produce((state: ProjectState) => {
          state.isPlaying = false;
        }));
      },

      togglePlay: () => {
        set(produce((state: ProjectState) => {
          state.isPlaying = !state.isPlaying;
        }));
      },

      seekForward: (seconds) => {
        set(produce((state: ProjectState) => {
          state.currentTime = Math.min(
            state.currentTime + seconds,
            state.project?.duration || 0
          );
        }));
      },

      seekBackward: (seconds) => {
        set(produce((state: ProjectState) => {
          state.currentTime = Math.max(0, state.currentTime - seconds);
        }));
      },

      setZoom: (zoom) => {
        set(produce((state: ProjectState) => {
          state.zoom = Math.max(0.1, Math.min(10, zoom));
        }));
      },

      setScrollPosition: (position) => {
        set(produce((state: ProjectState) => {
          state.scrollPosition = position;
        }));
      },

      undo: () => {
        set(produce((state: ProjectState) => {
          if (state.undoStack.length > 0 && state.project) {
            state.redoStack.push(JSON.parse(JSON.stringify(state.project)));
            state.project = state.undoStack.pop()!;
            state.isDirty = true;
          }
        }));
      },

      redo: () => {
        set(produce((state: ProjectState) => {
          if (state.redoStack.length > 0 && state.project) {
            state.undoStack.push(JSON.parse(JSON.stringify(state.project)));
            state.project = state.redoStack.pop()!;
            state.isDirty = true;
          }
        }));
      },

      pushToUndoStack: () => {
        set(produce((state: ProjectState) => {
          if (state.project) {
            state.undoStack.push(JSON.parse(JSON.stringify(state.project)));
            state.redoStack = [];
            if (state.undoStack.length > 50) {
              state.undoStack.shift();
            }
          }
        }));
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
    }),
    {
      name: 'clipflow-project',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        project: state.project,
      }),
    }
  )
);
