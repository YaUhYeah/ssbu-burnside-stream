import { useState } from 'react';
import { X, Wand2, Sparkles, Clock, Zap } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import toast from 'react-hot-toast';

export function ShortifyDialog() {
  const { setShowShortifyDialog, setProcessing, setProcessingProgress } = useUIStore();
  const { project } = useProjectStore();

  const [duration, setDuration] = useState<15 | 30 | 60>(30);
  const [style, setStyle] = useState<'hook' | 'highlights' | 'summary'>('highlights');
  const [addCaptions, setAddCaptions] = useState(true);
  const [verticalCrop, setVerticalCrop] = useState(true);

  const handleShortify = async () => {
    if (!project || project.media.length === 0) {
      toast.error('Add some media first');
      return;
    }

    setShowShortifyDialog(false);
    setProcessing(true, 'AI is analyzing your video...');

    // Simulate AI processing
    const steps = [
      { progress: 10, message: 'Analyzing video content...' },
      { progress: 25, message: 'Detecting highlights...' },
      { progress: 40, message: 'Identifying key moments...' },
      { progress: 55, message: 'Generating captions...' },
      { progress: 70, message: 'Optimizing for short-form...' },
      { progress: 85, message: 'Applying style and transitions...' },
      { progress: 100, message: 'Finalizing your short!' },
    ];

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setProcessingProgress(step.progress);
    }

    setProcessing(false);
    toast.success(`Created ${duration}s short with ${style} style!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 p-2">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold">AI Shortify</h2>
          </div>
          <button
            onClick={() => setShowShortifyDialog(false)}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Automatically convert your long-form video into an engaging short-form
          clip optimized for social media.
        </p>

        <div className="space-y-6">
          {/* Duration */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Target Duration
            </label>
            <div className="flex gap-2">
              {[15, 30, 60].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d as 15 | 30 | 60)}
                  className={`flex-1 rounded-md border p-3 text-center ${
                    duration === d
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-lg font-bold">{d}s</p>
                  <p className="text-xs text-muted-foreground">
                    {d === 15 ? 'Quick' : d === 30 ? 'Standard' : 'Extended'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Content Style
            </label>
            <div className="space-y-2">
              {[
                {
                  value: 'hook',
                  label: 'Hook & CTA',
                  desc: 'Attention-grabbing intro with call-to-action',
                },
                {
                  value: 'highlights',
                  label: 'Best Highlights',
                  desc: 'Most engaging moments from your video',
                },
                {
                  value: 'summary',
                  label: 'Quick Summary',
                  desc: 'Condensed overview of main points',
                },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value as 'hook' | 'highlights' | 'summary')}
                  className={`w-full rounded-md border p-3 text-left ${
                    style === s.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4" />
              Enhancements
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={addCaptions}
                  onChange={(e) => setAddCaptions(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Add auto-generated captions</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={verticalCrop}
                  onChange={(e) => setVerticalCrop(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Smart vertical crop (9:16)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setShowShortifyDialog(false)}
            className="rounded-md px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleShortify}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white hover:from-purple-600 hover:to-pink-600"
          >
            <Wand2 className="h-4 w-4" />
            Generate Short
          </button>
        </div>
      </div>
    </div>
  );
}
