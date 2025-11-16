import { useState } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import type { AspectRatio } from '@/types';
import toast from 'react-hot-toast';

const ASPECT_RATIOS: Array<{ value: AspectRatio; label: string; description: string }> = [
  { value: '16:9', label: 'Landscape (16:9)', description: 'YouTube, Standard Video' },
  { value: '9:16', label: 'Portrait (9:16)', description: 'TikTok, Reels, Shorts' },
  { value: '1:1', label: 'Square (1:1)', description: 'Instagram Feed' },
  { value: '4:5', label: 'Portrait (4:5)', description: 'Instagram Post' },
  { value: '4:3', label: 'Classic (4:3)', description: 'Traditional TV' },
];

export function NewProjectDialog() {
  const { setShowNewProjectDialog } = useUIStore();
  const { createProject } = useProjectStore();

  const [name, setName] = useState('Untitled Project');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    createProject(name.trim(), aspectRatio);
    setShowNewProjectDialog(false);
    toast.success('Project created');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create New Project</h2>
          <button
            onClick={() => setShowNewProjectDialog(false)}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Project name */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter project name"
            />
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Aspect Ratio
            </label>
            <div className="grid grid-cols-1 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.value}
                  onClick={() => setAspectRatio(ratio.value)}
                  className={`flex items-center justify-between rounded-md border p-3 text-left transition-colors ${
                    aspectRatio === ratio.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div>
                    <p className="font-medium">{ratio.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {ratio.description}
                    </p>
                  </div>
                  <div
                    className={`flex h-10 items-center justify-center rounded border ${
                      aspectRatio === ratio.value
                        ? 'border-primary bg-primary/20'
                        : 'border-border'
                    }`}
                    style={{
                      width:
                        ratio.value === '16:9'
                          ? '60px'
                          : ratio.value === '9:16'
                          ? '35px'
                          : ratio.value === '1:1'
                          ? '40px'
                          : ratio.value === '4:5'
                          ? '32px'
                          : '53px',
                    }}
                  >
                    <span className="text-[10px]">{ratio.value}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setShowNewProjectDialog(false)}
            className="rounded-md px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
