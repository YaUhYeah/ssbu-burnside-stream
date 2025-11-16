import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Timeline } from './timeline/Timeline';
import { Preview } from './Preview';
import { PropertiesPanel } from './PropertiesPanel';
import { cn } from '@/lib/utils';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

export function Layout() {
  const { sidebarOpen, preferences } = useUIStore();
  const { project, selectedClipIds } = useProjectStore();
  const [previewSize, setPreviewSize] = useState(50); // Percentage
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(true);

  if (!project) return null;

  const isBeginnerMode = preferences.editorMode === 'beginner';

  return (
    <div className="flex h-screen flex-col">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            'border-r border-border bg-card transition-all duration-300',
            sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
          )}
        >
          <Sidebar />
        </div>

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Preview and properties */}
          <div
            className="flex flex-1 overflow-hidden"
            style={{ height: `${previewSize}%` }}
          >
            <div className="flex-1 p-4 relative" data-onboarding="preview">
              <Preview />

              {/* Properties panel toggle */}
              <button
                onClick={() => setPropertiesPanelOpen(!propertiesPanelOpen)}
                className={cn(
                  'absolute top-6 right-6 z-10 rounded-md bg-card/90 p-2 shadow-lg border border-border hover:bg-accent transition-colors',
                  selectedClipIds.length > 0 && !propertiesPanelOpen && 'animate-pulse'
                )}
                title={propertiesPanelOpen ? 'Hide properties' : 'Show properties'}
              >
                {propertiesPanelOpen ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Properties Panel */}
            <div
              className={cn(
                'transition-all duration-300 overflow-hidden',
                propertiesPanelOpen ? 'w-80' : 'w-0'
              )}
            >
              <PropertiesPanel />
            </div>
          </div>

          {/* Resize handle */}
          <div
            className="h-2 cursor-row-resize bg-border hover:bg-primary/50 transition-colors"
            onMouseDown={(e) => {
              const startY = e.clientY;
              const startSize = previewSize;

              const onMouseMove = (e: MouseEvent) => {
                const delta = e.clientY - startY;
                const containerHeight = window.innerHeight - 64; // Minus header
                const newSize = startSize + (delta / containerHeight) * 100;
                setPreviewSize(Math.max(20, Math.min(80, newSize)));
              };

              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
              };

              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            }}
          />

          {/* Timeline */}
          <div
            className="bg-card"
            style={{ height: `${100 - previewSize}%` }}
            data-onboarding="timeline"
          >
            <Timeline simplified={isBeginnerMode} />
          </div>
        </div>
      </div>
    </div>
  );
}
