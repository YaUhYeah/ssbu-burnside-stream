import { X, Monitor, Maximize2, Crop } from 'lucide-react';

interface ResolutionMatchDialogProps {
  mediaName: string;
  mediaWidth: number;
  mediaHeight: number;
  projectWidth: number;
  projectHeight: number;
  onMatchToMedia: () => void;
  onKeepProject: () => void;
  onCancel: () => void;
}

export function ResolutionMatchDialog({
  mediaName,
  mediaWidth,
  mediaHeight,
  projectWidth,
  projectHeight,
  onMatchToMedia,
  onKeepProject,
  onCancel,
}: ResolutionMatchDialogProps) {
  const mediaAspect = mediaWidth / mediaHeight;
  const projectAspect = projectWidth / projectHeight;
  const aspectMismatch = Math.abs(mediaAspect - projectAspect) > 0.1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Resolution Mismatch</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          The imported media <strong>{mediaName}</strong> has a different resolution than your project.
        </p>

        <div className="mb-6 space-y-3 rounded-md bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Media Resolution:</span>
            <span className="text-sm font-mono">
              {mediaWidth}x{mediaHeight}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Project Resolution:</span>
            <span className="text-sm font-mono">
              {projectWidth}x{projectHeight}
            </span>
          </div>
          {aspectMismatch && (
            <div className="mt-2 rounded bg-yellow-500/10 p-2 text-xs text-yellow-600 dark:text-yellow-400">
              Aspect ratio mismatch detected. Video will be letterboxed or cropped.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={onMatchToMedia}
            className="flex w-full items-center gap-3 rounded-md border border-primary bg-primary/10 p-3 text-left hover:bg-primary/20"
          >
            <Maximize2 className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Match project to media</p>
              <p className="text-xs text-muted-foreground">
                Change project to {mediaWidth}x{mediaHeight}
              </p>
            </div>
          </button>

          <button
            onClick={onKeepProject}
            className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-accent"
          >
            <Crop className="h-5 w-5" />
            <div>
              <p className="font-medium">Keep project resolution</p>
              <p className="text-xs text-muted-foreground">
                Auto-scale media to fit ({projectWidth}x{projectHeight})
              </p>
            </div>
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel import
          </button>
        </div>
      </div>
    </div>
  );
}
