import { Loader2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function ProcessingOverlay() {
  const { processingMessage, processingProgress } = useUIStore();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-lg bg-card p-8 text-center shadow-xl">
        <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />

        <h3 className="mb-2 text-lg font-semibold">Processing</h3>
        <p className="mb-6 text-sm text-muted-foreground">{processingMessage}</p>

        {/* Progress bar */}
        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${processingProgress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-medium">{processingProgress}%</p>
      </div>
    </div>
  );
}
