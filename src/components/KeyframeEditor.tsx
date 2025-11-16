import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { Plus, Diamond, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Keyframe } from '@/types';

interface KeyframeEditorProps {
  clipId: string;
  trackId: string;
  effectIndex: number;
}

export function KeyframeEditor({ clipId, trackId, effectIndex }: KeyframeEditorProps) {
  const { project, updateClip, currentTime } = useProjectStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedKeyframe, setSelectedKeyframe] = useState<number | null>(null);

  const clip = project?.tracks.find((t) => t.id === trackId)?.clips.find((c) => c.id === clipId);
  const effect = clip?.effects[effectIndex];

  if (!clip || !effect) return null;

  const keyframes = effect.keyframes || [];
  const duration = clip.duration;

  const addKeyframe = () => {
    const relativeTime = currentTime - clip.startTime;
    if (relativeTime < 0 || relativeTime > duration) {
      toast.error('Move playhead within clip to add keyframe');
      return;
    }

    const currentValue = interpolateValue(relativeTime);
    const newKeyframe: Keyframe = {
      time: relativeTime,
      value: currentValue,
      easing: 'ease-in-out',
    };

    const newKeyframes = [...keyframes, newKeyframe].sort((a, b) => a.time - b.time);
    updateEffectKeyframes(newKeyframes);
    toast.success('Keyframe added');
  };

  const removeKeyframe = (index: number) => {
    const newKeyframes = keyframes.filter((_, i) => i !== index);
    updateEffectKeyframes(newKeyframes);
    setSelectedKeyframe(null);
    toast.success('Keyframe removed');
  };

  const updateEffectKeyframes = (newKeyframes: Keyframe[]) => {
    const newEffects = [...clip.effects];
    newEffects[effectIndex] = {
      ...effect,
      keyframes: newKeyframes,
    };
    updateClip(trackId, clipId, { effects: newEffects });
  };

  const interpolateValue = (time: number): number => {
    if (keyframes.length === 0) {
      return (effect.params.value as number) || 1;
    }

    if (keyframes.length === 1) {
      return keyframes[0].value;
    }

    // Find surrounding keyframes
    let before = keyframes[0];
    let after = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (keyframes[i].time <= time && keyframes[i + 1].time >= time) {
        before = keyframes[i];
        after = keyframes[i + 1];
        break;
      }
    }

    if (time <= before.time) return before.value;
    if (time >= after.time) return after.value;

    // Linear interpolation (can add easing later)
    const t = (time - before.time) / (after.time - before.time);
    return before.value + (after.value - before.value) * t;
  };

  const handleKeyframeValueChange = (index: number, value: number) => {
    const newKeyframes = [...keyframes];
    newKeyframes[index] = { ...newKeyframes[index], value };
    updateEffectKeyframes(newKeyframes);
  };

  const handleEasingChange = (index: number, easing: Keyframe['easing']) => {
    const newKeyframes = [...keyframes];
    newKeyframes[index] = { ...newKeyframes[index], easing };
    updateEffectKeyframes(newKeyframes);
  };

  // Draw keyframe curve
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 10;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + ((height - padding * 2) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    if (keyframes.length === 0) {
      // Draw flat line at default value
      const y = height / 2;
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    } else {
      // Draw curve
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const minValue = Math.min(...keyframes.map((k) => k.value), 0);
      const maxValue = Math.max(...keyframes.map((k) => k.value), 2);
      const valueRange = maxValue - minValue || 1;

      for (let i = 0; i <= 100; i++) {
        const time = (duration * i) / 100;
        const value = interpolateValue(time);
        const x = padding + ((width - padding * 2) * i) / 100;
        const y = height - padding - ((value - minValue) / valueRange) * (height - padding * 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw keyframe points
      keyframes.forEach((kf, index) => {
        const x = padding + ((width - padding * 2) * kf.time) / duration;
        const y = height - padding - ((kf.value - minValue) / valueRange) * (height - padding * 2);

        ctx.fillStyle = selectedKeyframe === index ? '#fbbf24' : '#6366f1';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Draw playhead position
      const relativeTime = currentTime - clip.startTime;
      if (relativeTime >= 0 && relativeTime <= duration) {
        const x = padding + ((width - padding * 2) * relativeTime) / duration;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
  }, [keyframes, duration, selectedKeyframe, currentTime, clip.startTime]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold">Keyframes - {effect.type}</h4>
        <div className="flex items-center gap-1">
          <button
            onClick={addKeyframe}
            className="rounded p-1 hover:bg-accent"
            title="Add keyframe at playhead"
          >
            <Plus className="h-3 w-3" />
          </button>
          {selectedKeyframe !== null && (
            <button
              onClick={() => removeKeyframe(selectedKeyframe)}
              className="rounded p-1 hover:bg-destructive hover:text-destructive-foreground"
              title="Remove selected keyframe"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Curve visualization */}
      <canvas
        ref={canvasRef}
        width={280}
        height={100}
        className="w-full rounded border border-border bg-black/50"
        onClick={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = e.clientX - rect.left;
          const relX = (x - 10) / (rect.width - 20);
          const clickTime = relX * duration;

          // Find closest keyframe
          let closestIndex = -1;
          let closestDist = Infinity;
          keyframes.forEach((kf, i) => {
            const dist = Math.abs(kf.time - clickTime);
            if (dist < closestDist && dist < duration * 0.05) {
              closestDist = dist;
              closestIndex = i;
            }
          });
          setSelectedKeyframe(closestIndex >= 0 ? closestIndex : null);
        }}
      />

      {/* Keyframe list */}
      {keyframes.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {keyframes.length} keyframe{keyframes.length !== 1 ? 's' : ''}
          </div>
          {keyframes.map((kf, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-2 rounded p-2 text-xs',
                selectedKeyframe === index ? 'bg-primary/20' : 'bg-muted/30'
              )}
              onClick={() => setSelectedKeyframe(index)}
            >
              <Diamond className="h-3 w-3 text-primary" />
              <span className="w-16">{kf.time.toFixed(2)}s</span>
              <input
                type="number"
                value={kf.value}
                onChange={(e) => handleKeyframeValueChange(index, parseFloat(e.target.value) || 0)}
                className="w-16 rounded bg-background px-1 py-0.5 text-xs"
                step="0.1"
              />
              <select
                value={kf.easing}
                onChange={(e) => handleEasingChange(index, e.target.value as Keyframe['easing'])}
                className="rounded bg-background px-1 py-0.5 text-xs"
              >
                <option value="linear">Linear</option>
                <option value="ease-in">Ease In</option>
                <option value="ease-out">Ease Out</option>
                <option value="ease-in-out">Ease In-Out</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {keyframes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No keyframes. Click + to add a keyframe at the current playhead position.
        </p>
      )}
    </div>
  );
}
