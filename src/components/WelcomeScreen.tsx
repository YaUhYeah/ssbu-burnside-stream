import { Film, Plus, FolderOpen, Sparkles } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function WelcomeScreen() {
  const { setShowNewProjectDialog } = useUIStore();

  return (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-background to-muted/50">
      <div className="flex flex-col items-center space-y-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 p-3">
            <Film className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">ClipFlow Studio</h1>
            <p className="text-muted-foreground">
              AI-Powered Video Editor for Creators
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            onClick={() => setShowNewProjectDialog(true)}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="rounded-lg bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">New Project</h3>
              <p className="text-sm text-muted-foreground">
                Start from scratch
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              // TODO: Implement project open
            }}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="rounded-lg bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
              <FolderOpen className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Open Project</h3>
              <p className="text-sm text-muted-foreground">
                Continue editing
              </p>
            </div>
          </button>

          <button
            onClick={() => setShowNewProjectDialog(true)}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-3 transition-colors group-hover:from-purple-500/20 group-hover:to-pink-500/20">
              <Sparkles className="h-8 w-8 text-purple-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Quick Short</h3>
              <p className="text-sm text-muted-foreground">
                AI-assisted creation
              </p>
            </div>
          </button>
        </div>

        {/* Features */}
        <div className="mt-8 grid max-w-3xl grid-cols-2 gap-4 text-sm md:grid-cols-4">
          {[
            'Auto Captions',
            'Smart Highlights',
            'One-Click Export',
            'AI Shortify',
            'Templates',
            'Multi-Track Audio',
            'Color Correction',
            'Batch Processing',
          ].map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              {feature}
            </div>
          ))}
        </div>

        {/* Version */}
        <p className="text-xs text-muted-foreground">Version 1.0.0</p>
      </div>
    </div>
  );
}
