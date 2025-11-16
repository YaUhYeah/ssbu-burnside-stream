import { X, Monitor, Moon, Sun } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function SettingsDialog() {
  const {
    setShowSettingsDialog,
    preferences,
    setPreferences,
    setEditorMode,
  } = useUIStore();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={() => setShowSettingsDialog(false)}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Theme */}
          <div>
            <label className="mb-2 block text-sm font-medium">Theme</label>
            <div className="flex gap-2">
              {[
                { value: 'light', icon: Sun, label: 'Light' },
                { value: 'dark', icon: Moon, label: 'Dark' },
                { value: 'system', icon: Monitor, label: 'System' },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() =>
                    setPreferences({ theme: value as 'light' | 'dark' | 'system' })
                  }
                  className={`flex flex-1 flex-col items-center gap-2 rounded-md border p-3 ${
                    preferences.theme === value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor Mode */}
          <div>
            <label className="mb-2 block text-sm font-medium">Editor Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setEditorMode('beginner')}
                className={`flex-1 rounded-md border p-3 text-center ${
                  preferences.editorMode === 'beginner'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-medium">Beginner</p>
                <p className="text-xs text-muted-foreground">
                  Simplified interface
                </p>
              </button>
              <button
                onClick={() => setEditorMode('advanced')}
                className={`flex-1 rounded-md border p-3 text-center ${
                  preferences.editorMode === 'advanced'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-medium">Advanced</p>
                <p className="text-xs text-muted-foreground">Full features</p>
              </button>
            </div>
          </div>

          {/* Privacy */}
          <div>
            <label className="mb-2 block text-sm font-medium">Privacy</label>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">Privacy Mode (Local Only)</span>
                <input
                  type="checkbox"
                  checked={preferences.privacyMode}
                  onChange={(e) =>
                    setPreferences({ privacyMode: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Enable Cloud Features</span>
                <input
                  type="checkbox"
                  checked={preferences.cloudEnabled}
                  onChange={(e) =>
                    setPreferences({ cloudEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input"
                />
              </label>
            </div>
          </div>

          {/* Auto-save */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              General Settings
            </label>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">Auto-play preview</span>
                <input
                  type="checkbox"
                  checked={preferences.autoPlay}
                  onChange={(e) =>
                    setPreferences({ autoPlay: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Show tooltips</span>
                <input
                  type="checkbox"
                  checked={preferences.showTooltips}
                  onChange={(e) =>
                    setPreferences({ showTooltips: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setShowSettingsDialog(false)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
