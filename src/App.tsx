import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { Layout } from '@/components/Layout';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { NewProjectDialog } from '@/components/dialogs/NewProjectDialog';
import { ExportDialog } from '@/components/dialogs/ExportDialog';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';
import { ShortifyDialog } from '@/components/dialogs/ShortifyDialog';
import { OnboardingOverlay } from '@/components/OnboardingOverlay';
import { ProcessingOverlay } from '@/components/ProcessingOverlay';

export function App() {
  const { preferences, showNewProjectDialog, showExportDialog, showSettingsDialog, showShortifyDialog, isProcessing } = useUIStore();
  const { project } = useProjectStore();

  useEffect(() => {
    // Apply theme
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else if (preferences.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [preferences.theme]);

  useEffect(() => {
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { togglePlay, undo, redo, seekForward, seekBackward } = useProjectStore.getState();
      const { setShowExportDialog, setShowSettingsDialog } = useUIStore.getState();

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        redo();
      } else if (e.ctrlKey && e.code === 'KeyE') {
        e.preventDefault();
        setShowExportDialog(true);
      } else if (e.ctrlKey && e.code === 'Comma') {
        e.preventDefault();
        setShowSettingsDialog(true);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekForward(e.shiftKey ? 10 : 1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekBackward(e.shiftKey ? 10 : 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      {project ? <Layout /> : <WelcomeScreen />}

      {/* Dialogs */}
      {showNewProjectDialog && <NewProjectDialog />}
      {showExportDialog && <ExportDialog />}
      {showSettingsDialog && <SettingsDialog />}
      {showShortifyDialog && <ShortifyDialog />}

      {/* Overlays */}
      <OnboardingOverlay />
      {isProcessing && <ProcessingOverlay />}

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'bg-card text-card-foreground border border-border',
          duration: 4000,
        }}
      />
    </div>
  );
}
