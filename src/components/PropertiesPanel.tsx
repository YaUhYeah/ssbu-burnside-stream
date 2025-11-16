import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  ChevronDown,
  ChevronRight,
  Sliders,
  Move,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { KeyframeEditor } from './KeyframeEditor';
import toast from 'react-hot-toast';
import type { TimelineClip } from '@/types';

export function PropertiesPanel() {
  const {
    project,
    selectedClipIds,
    updateClip,
    removeClip,
    deselectAllClips,
  } = useProjectStore();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    transform: true,
    effects: true,
    color: false,
  });
  const [expandedEffects, setExpandedEffects] = useState<Record<string, boolean>>({});

  if (!project) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No project loaded
      </div>
    );
  }

  if (selectedClipIds.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Select a clip to edit properties
      </div>
    );
  }

  // Get first selected clip for editing
  let selectedClip: TimelineClip | null = null;
  let selectedTrackId: string | null = null;

  for (const track of project.tracks) {
    const clip = track.clips.find((c) => selectedClipIds.includes(c.id));
    if (clip) {
      selectedClip = clip;
      selectedTrackId = track.id;
      break;
    }
  }

  if (!selectedClip || !selectedTrackId) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Clip not found
      </div>
    );
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleEffect = (effectId: string) => {
    setExpandedEffects((prev) => ({ ...prev, [effectId]: !prev[effectId] }));
  };

  const updateClipProperty = (key: keyof TimelineClip, value: number | boolean) => {
    updateClip(selectedTrackId!, selectedClip!.id, { [key]: value });
  };

  const removeEffect = (effectIndex: number) => {
    const newEffects = selectedClip!.effects.filter((_, i) => i !== effectIndex);
    updateClip(selectedTrackId!, selectedClip!.id, { effects: newEffects });
    toast.success('Effect removed');
  };

  const updateEffectParam = (effectIndex: number, param: string, value: number | boolean) => {
    const newEffects = [...selectedClip!.effects];
    newEffects[effectIndex] = {
      ...newEffects[effectIndex],
      params: { ...newEffects[effectIndex].params, [param]: value },
    };
    updateClip(selectedTrackId!, selectedClip!.id, { effects: newEffects });
  };

  const handleDeleteClip = () => {
    removeClip(selectedTrackId!, selectedClip!.id);
    deselectAllClips();
    toast.success('Clip deleted');
  };

  const media = project.media.find((m) => m.id === selectedClip.mediaId);

  return (
    <div className="h-full overflow-y-auto bg-card border-l border-border">
      <div className="sticky top-0 z-10 bg-card border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Properties
          </h3>
          <button
            onClick={handleDeleteClip}
            className="rounded p-1 hover:bg-destructive hover:text-destructive-foreground"
            title="Delete clip"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {media?.name || 'Unknown clip'}
        </p>
        {selectedClipIds.length > 1 && (
          <p className="text-xs text-primary mt-1">
            +{selectedClipIds.length - 1} more selected
          </p>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Transform Section */}
        <div>
          <button
            onClick={() => toggleSection('transform')}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="text-xs font-semibold flex items-center gap-2">
              <Move className="h-3 w-3" />
              Transform
            </h4>
            {expandedSections.transform ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {expandedSections.transform && (
            <div className="mt-2 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Opacity</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedClip.opacity}
                    onChange={(e) => updateClipProperty('opacity', parseFloat(e.target.value))}
                    className="flex-1 h-1"
                  />
                  <span className="text-xs w-12 text-right">
                    {Math.round(selectedClip.opacity * 100)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Volume</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={selectedClip.volume}
                    onChange={(e) => updateClipProperty('volume', parseFloat(e.target.value))}
                    className="flex-1 h-1"
                  />
                  <span className="text-xs w-12 text-right">
                    {Math.round(selectedClip.volume * 100)}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">In Point</label>
                  <input
                    type="number"
                    value={selectedClip.inPoint.toFixed(2)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        updateClip(selectedTrackId!, selectedClip!.id, {
                          inPoint: val,
                          duration: selectedClip!.outPoint - val,
                        });
                      }
                    }}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Out Point</label>
                  <input
                    type="number"
                    value={selectedClip.outPoint.toFixed(2)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        updateClip(selectedTrackId!, selectedClip!.id, {
                          outPoint: val,
                          duration: val - selectedClip!.inPoint,
                        });
                      }
                    }}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                    step="0.1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Start Time</label>
                <input
                  type="number"
                  value={selectedClip.startTime.toFixed(2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                      updateClipProperty('startTime', val);
                    }
                  }}
                  className="w-full rounded bg-background px-2 py-1 text-xs"
                  step="0.1"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedClip.locked}
                    onChange={(e) => updateClipProperty('locked', e.target.checked)}
                    className="h-3 w-3"
                  />
                  {selectedClip.locked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3" />
                  )}
                  Locked
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Effects Section */}
        <div>
          <button
            onClick={() => toggleSection('effects')}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="text-xs font-semibold flex items-center gap-2">
              <Sliders className="h-3 w-3" />
              Effects ({selectedClip.effects.length})
            </h4>
            {expandedSections.effects ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {expandedSections.effects && (
            <div className="mt-2 space-y-3">
              {selectedClip.effects.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No effects applied. Add effects from the Effects panel.
                </p>
              ) : (
                selectedClip.effects.map((effect, index) => (
                  <div
                    key={effect.id}
                    className="rounded border border-border bg-muted/20 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => toggleEffect(effect.id)}
                        className="flex items-center gap-2 text-xs font-medium"
                      >
                        {expandedEffects[effect.id] ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {effect.type}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updateEffectParam(index, 'enabled', !effect.params.enabled)
                          }
                          className={cn(
                            'rounded p-1',
                            effect.params.enabled
                              ? 'text-primary hover:bg-accent'
                              : 'text-muted-foreground hover:bg-accent'
                          )}
                          title={effect.params.enabled ? 'Disable effect' : 'Enable effect'}
                        >
                          {effect.params.enabled ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={() => removeEffect(index)}
                          className="rounded p-1 hover:bg-destructive hover:text-destructive-foreground"
                          title="Remove effect"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {expandedEffects[effect.id] && (
                      <div className="mt-2 space-y-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Value</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="3"
                              step="0.01"
                              value={(effect.params.value as number) || 1}
                              onChange={(e) =>
                                updateEffectParam(index, 'value', parseFloat(e.target.value))
                              }
                              className="flex-1 h-1"
                            />
                            <span className="text-xs w-12 text-right">
                              {((effect.params.value as number) || 1).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Keyframe Editor */}
                        <KeyframeEditor
                          clipId={selectedClip.id}
                          trackId={selectedTrackId!}
                          effectIndex={index}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Transitions Section */}
        {selectedClip.transitions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold flex items-center gap-2 mb-2">
              <RotateCcw className="h-3 w-3" />
              Transitions
            </h4>
            <div className="space-y-2">
              {selectedClip.transitions.map((transition, index) => (
                <div
                  key={transition.id}
                  className="rounded border border-border bg-muted/20 p-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{transition.type}</span>
                    <button
                      onClick={() => {
                        const newTransitions = selectedClip!.transitions.filter(
                          (_, i) => i !== index
                        );
                        updateClip(selectedTrackId!, selectedClip!.id, {
                          transitions: newTransitions,
                        });
                        toast.success('Transition removed');
                      }}
                      className="rounded p-1 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2">
                    <label className="text-xs text-muted-foreground">Duration</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.1"
                        value={transition.duration}
                        onChange={(e) => {
                          const newTransitions = [...selectedClip!.transitions];
                          newTransitions[index] = {
                            ...newTransitions[index],
                            duration: parseFloat(e.target.value),
                          };
                          updateClip(selectedTrackId!, selectedClip!.id, {
                            transitions: newTransitions,
                          });
                        }}
                        className="flex-1 h-1"
                      />
                      <span className="text-xs w-12 text-right">
                        {transition.duration.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
