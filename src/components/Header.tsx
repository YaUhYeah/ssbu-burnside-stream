import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Save,
  Download,
  Settings,
  Undo2,
  Redo2,
  Scissors,
  Wand2,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export function Header() {
  const {
    project,
    isPlaying,
    currentTime,
    undoStack,
    redoStack,
    togglePlay,
    seekBackward,
    seekForward,
    undo,
    redo,
    saveProject,
    selectedClipIds,
    splitClip,
  } = useProjectStore();

  const {
    sidebarOpen,
    setSidebarOpen,
    preferences,
    toggleTheme,
    setShowExportDialog,
    setShowSettingsDialog,
    setShowShortifyDialog,
  } = useUIStore();

  if (!project) return null;

  const handleSave = () => {
    saveProject();
    toast.success('Project saved');
  };

  const handleSplit = () => {
    if (selectedClipIds.length === 1) {
      // Find the clip and split it at current time
      for (const track of project.tracks) {
        const clip = track.clips.find((c) => c.id === selectedClipIds[0]);
        if (clip) {
          splitClip(track.id, clip.id, currentTime);
          toast.success('Clip split at playhead');
          break;
        }
      }
    } else {
      toast.error('Select a single clip to split');
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* Left section - Menu and project info */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-md p-2 hover:bg-accent"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </button>

        <div className="flex flex-col">
          <h1 className="text-sm font-semibold">{project.name}</h1>
          <span className="text-xs text-muted-foreground">
            {project.resolution.label} • {project.fps}fps • {project.aspectRatio}
          </span>
        </div>
      </div>

      {/* Center section - Playback controls */}
      <div className="flex items-center gap-2" data-onboarding="tools">
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          className={cn(
            'rounded-md p-2 hover:bg-accent',
            undoStack.length === 0 && 'opacity-50 cursor-not-allowed'
          )}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </button>

        <button
          onClick={redo}
          disabled={redoStack.length === 0}
          className={cn(
            'rounded-md p-2 hover:bg-accent',
            redoStack.length === 0 && 'opacity-50 cursor-not-allowed'
          )}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px bg-border" />

        <button
          onClick={() => seekBackward(10)}
          className="rounded-md p-2 hover:bg-accent"
          title="Skip back 10s"
        >
          <SkipBack className="h-5 w-5" />
        </button>

        <button
          onClick={togglePlay}
          className="rounded-full bg-primary p-3 text-primary-foreground hover:bg-primary/90"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={() => seekForward(10)}
          className="rounded-md p-2 hover:bg-accent"
          title="Skip forward 10s"
        >
          <SkipForward className="h-5 w-5" />
        </button>

        <div className="mx-2 h-6 w-px bg-border" />

        <div className="flex items-center gap-1 rounded-md bg-muted px-3 py-1 font-mono text-sm">
          <span>{formatTime(currentTime)}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">
            {formatTime(project.duration || 0)}
          </span>
        </div>

        <div className="mx-2 h-6 w-px bg-border" />

        <button
          onClick={handleSplit}
          className="rounded-md p-2 hover:bg-accent"
          title="Split clip (S)"
        >
          <Scissors className="h-4 w-4" />
        </button>

        <button
          onClick={() => setShowShortifyDialog(true)}
          className="flex items-center gap-1 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-2 text-sm font-medium text-white hover:from-purple-600 hover:to-pink-600"
          title="Auto Shortify"
          data-onboarding="shortify"
        >
          <Wand2 className="h-4 w-4" />
          Shortify
        </button>
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="rounded-md p-2 hover:bg-accent"
          title="Toggle theme"
        >
          {preferences.theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={handleSave}
          className="rounded-md p-2 hover:bg-accent"
          title="Save project (Ctrl+S)"
        >
          <Save className="h-5 w-5" />
        </button>

        <button
          onClick={() => setShowExportDialog(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          title="Export (Ctrl+E)"
          data-onboarding="export"
        >
          <Download className="h-4 w-4" />
          Export
        </button>

        <button
          onClick={() => setShowSettingsDialog(true)}
          className="rounded-md p-2 hover:bg-accent"
          title="Settings (Ctrl+,)"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
