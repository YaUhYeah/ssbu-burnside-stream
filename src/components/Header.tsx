import { useState, useEffect, useRef } from 'react';
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
  FileText,
  Keyboard,
  Volume2,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { captionsToSRT, captionsToVTT } from '@/utils/export';
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

  // Visual feedback states
  const [showPlayFeedback, setShowPlayFeedback] = useState(false);
  const [lastAction, setLastAction] = useState<'play' | 'pause' | null>(null);
  const [audioIndicator, setAudioIndicator] = useState(false);
  const playButtonRef = useRef<HTMLButtonElement>(null);

  // Show visual feedback when play state changes
  useEffect(() => {
    if (isPlaying) {
      setLastAction('play');
      setShowPlayFeedback(true);
      setAudioIndicator(true);
      const timer = setTimeout(() => setShowPlayFeedback(false), 800);
      return () => clearTimeout(timer);
    } else {
      setLastAction('pause');
      setShowPlayFeedback(true);
      setAudioIndicator(false);
      const timer = setTimeout(() => setShowPlayFeedback(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isPlaying]);

  // Enhanced play/pause with visual feedback
  const handleTogglePlay = () => {
    // Add button press animation
    if (playButtonRef.current) {
      playButtonRef.current.classList.add('scale-90');
      setTimeout(() => {
        playButtonRef.current?.classList.remove('scale-90');
      }, 100);
    }
    togglePlay();

    // Show toast for state change with visual indicator
    if (!isPlaying) {
      toast('▶️ Playing', {
        duration: 1000,
        icon: '🔊',
        style: { background: '#10B981', color: 'white' }
      });
    } else {
      toast('⏸️ Paused', {
        duration: 1000,
        icon: '🔇',
        style: { background: '#EF4444', color: 'white' }
      });
    }
  };

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

  const handleExportSRT = () => {
    if (project.captions.length === 0) {
      toast.error('No captions to export');
      return;
    }
    const srt = captionsToSRT(project.captions);
    const blob = new Blob([srt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_captions.srt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('SRT file downloaded');
  };

  const handleExportVTT = () => {
    if (project.captions.length === 0) {
      toast.error('No captions to export');
      return;
    }
    const vtt = captionsToVTT(project.captions);
    const blob = new Blob([vtt], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_captions.vtt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('VTT file downloaded');
  };

  const showKeyboardShortcuts = () => {
    toast(
      <div className="text-xs">
        <div className="font-semibold mb-2">Keyboard Shortcuts</div>
        <div className="space-y-1">
          <div><kbd className="bg-muted px-1 rounded">Space</kbd> Play/Pause</div>
          <div><kbd className="bg-muted px-1 rounded">←/→</kbd> Seek ±1s</div>
          <div><kbd className="bg-muted px-1 rounded">Shift+←/→</kbd> Seek ±10s</div>
          <div><kbd className="bg-muted px-1 rounded">Ctrl+Z</kbd> Undo</div>
          <div><kbd className="bg-muted px-1 rounded">Ctrl+Shift+Z</kbd> Redo</div>
          <div><kbd className="bg-muted px-1 rounded">Ctrl+E</kbd> Export</div>
          <div><kbd className="bg-muted px-1 rounded">Ctrl+K</kbd> Auto Shortify</div>
          <div><kbd className="bg-muted px-1 rounded">Delete</kbd> Remove clip</div>
          <div><kbd className="bg-muted px-1 rounded">F</kbd> Fullscreen</div>
        </div>
      </div>,
      { duration: 10000 }
    );
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
          className="rounded-md p-2 hover:bg-accent transition-transform active:scale-95"
          title="Skip back 10s"
        >
          <SkipBack className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            ref={playButtonRef}
            onClick={handleTogglePlay}
            className={cn(
              'rounded-full p-3 text-primary-foreground transition-all duration-150',
              isPlaying
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-primary hover:bg-primary/90'
            )}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </button>

          {/* Visual feedback overlay */}
          {showPlayFeedback && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={cn(
                'absolute inset-0 rounded-full animate-ping opacity-50',
                lastAction === 'play' ? 'bg-green-400' : 'bg-red-400'
              )} />
            </div>
          )}

          {/* Audio state indicator */}
          <div className={cn(
            'absolute -top-1 -right-1 w-3 h-3 rounded-full transition-all duration-300',
            audioIndicator
              ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50'
              : 'bg-gray-400'
          )}>
            {audioIndicator && (
              <div className="absolute inset-0 rounded-full bg-green-400 animate-ping" />
            )}
          </div>
        </div>

        <button
          onClick={() => seekForward(10)}
          className="rounded-md p-2 hover:bg-accent transition-transform active:scale-95"
          title="Skip forward 10s"
        >
          <SkipForward className="h-5 w-5" />
        </button>

        <div className="mx-2 h-6 w-px bg-border" />

        {/* Time display with state indicator */}
        <div className={cn(
          'flex items-center gap-1 rounded-md px-3 py-1 font-mono text-sm transition-colors',
          isPlaying ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted'
        )}>
          {audioIndicator && (
            <Volume2 className="h-4 w-4 mr-1 animate-pulse" />
          )}
          <span className="font-bold">{formatTime(currentTime)}</span>
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
          onClick={showKeyboardShortcuts}
          className="rounded-md p-2 hover:bg-accent"
          title="Keyboard shortcuts"
        >
          <Keyboard className="h-5 w-5" />
        </button>

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

        <div className="relative group">
          <button
            onClick={handleExportSRT}
            className="rounded-md p-2 hover:bg-accent"
            title="Export captions"
          >
            <FileText className="h-5 w-5" />
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50">
            <div className="rounded-md border border-border bg-card py-1 shadow-lg min-w-32">
              <button
                onClick={handleExportSRT}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
              >
                Export SRT
              </button>
              <button
                onClick={handleExportVTT}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
              >
                Export VTT
              </button>
            </div>
          </div>
        </div>

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
