import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import toast from 'react-hot-toast';

export function useKeyboardShortcuts() {
  const {
    project,
    togglePlay,
    seekForward,
    seekBackward,
    setCurrentTime,
    undo,
    redo,
    undoStack,
    redoStack,
    selectedClipIds,
    copySelectedClips,
    pasteClips,
    deleteSelectedClips,
    clipboard,
  } = useProjectStore();

  const { setShowExportDialog, setShowNewProjectDialog, setShowShortifyDialog, setShowSettingsDialog } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      // Playback controls
      if (e.key === ' ' && !isMod) {
        e.preventDefault();
        togglePlay();
      }

      // Copy selected clips
      if (isMod && e.key === 'c' && selectedClipIds.length > 0) {
        e.preventDefault();
        copySelectedClips();
        toast.success(`Copied ${selectedClipIds.length} clip${selectedClipIds.length > 1 ? 's' : ''}`);
      }

      // Paste clips
      if (isMod && e.key === 'v' && clipboard.length > 0) {
        e.preventDefault();
        pasteClips();
        toast.success(`Pasted ${clipboard.length} clip${clipboard.length > 1 ? 's' : ''}`);
      }

      // Delete selected clips
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipIds.length > 0) {
        e.preventDefault();
        const count = selectedClipIds.length;
        deleteSelectedClips();
        toast.success(`Deleted ${count} clip${count > 1 ? 's' : ''}`);
      }

      // Seek controls
      if (e.key === 'ArrowLeft' && !isMod && !e.shiftKey) {
        e.preventDefault();
        seekBackward(1);
      }
      if (e.key === 'ArrowRight' && !isMod && !e.shiftKey) {
        e.preventDefault();
        seekForward(1);
      }

      // Fast seek (with shift)
      if (e.key === 'ArrowLeft' && e.shiftKey && !isMod) {
        e.preventDefault();
        seekBackward(10);
      }
      if (e.key === 'ArrowRight' && e.shiftKey && !isMod) {
        e.preventDefault();
        seekForward(10);
      }

      // Jump to start/end
      if (e.key === 'Home') {
        e.preventDefault();
        setCurrentTime(0);
      }
      if (e.key === 'End' && project) {
        e.preventDefault();
        setCurrentTime(project.duration);
      }

      // Undo/Redo
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.length > 0) {
          undo();
          toast.success('Undone');
        }
      }
      if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (redoStack.length > 0) {
          redo();
          toast.success('Redone');
        }
      }
      if (isMod && e.key === 'y') {
        e.preventDefault();
        if (redoStack.length > 0) {
          redo();
          toast.success('Redone');
        }
      }

      // New project
      if (isMod && e.key === 'n') {
        e.preventDefault();
        setShowNewProjectDialog(true);
      }

      // Export
      if (isMod && e.key === 'e') {
        e.preventDefault();
        setShowExportDialog(true);
      }

      // Auto Shortify
      if (isMod && e.key === 'k') {
        e.preventDefault();
        setShowShortifyDialog(true);
      }

      // Settings
      if (isMod && e.key === ',') {
        e.preventDefault();
        setShowSettingsDialog(true);
      }

      // Toggle fullscreen
      if (e.key === 'f' && !isMod) {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    seekForward,
    seekBackward,
    setCurrentTime,
    project,
    undo,
    redo,
    undoStack,
    redoStack,
    selectedClipIds,
    copySelectedClips,
    pasteClips,
    deleteSelectedClips,
    clipboard,
    setShowExportDialog,
    setShowNewProjectDialog,
    setShowShortifyDialog,
    setShowSettingsDialog,
  ]);

  // Listen for Electron menu events
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    const handleUndo = () => {
      const state = useProjectStore.getState();
      if (state.undoStack.length > 0) {
        state.undo();
        toast.success('Undone');
      }
    };

    const handleRedo = () => {
      const state = useProjectStore.getState();
      if (state.redoStack.length > 0) {
        state.redo();
        toast.success('Redone');
      }
    };

    const handleNewProject = () => {
      setShowNewProjectDialog(true);
    };

    const handleExport = () => {
      setShowExportDialog(true);
    };

    electronAPI.onUndo(handleUndo);
    electronAPI.onRedo(handleRedo);
    electronAPI.onNewProject(handleNewProject);
    electronAPI.onExport(handleExport);
  }, [setShowNewProjectDialog, setShowExportDialog]);
}
