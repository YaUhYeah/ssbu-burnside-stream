import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { Type, Plus, Trash2, ChevronDown, ChevronRight, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import type { TextOverlay, TextStyle, TextAnimation, TextTemplate, TextAnimationType } from '@/types';

// Industry-standard text templates
const TEXT_TEMPLATES: TextTemplate[] = [
  {
    id: 'main-title',
    name: 'Main Title',
    category: 'titles',
    preview: 'YOUR TITLE HERE',
    style: {
      fontFamily: 'Inter',
      fontSize: 72,
      fontWeight: 'bold',
      fontStyle: 'normal',
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 2,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 10,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 4,
    },
    animation: {
      type: 'scale',
      duration: 0.8,
      easing: 'ease-out',
      direction: 'in',
    },
    defaultText: 'YOUR TITLE',
    defaultPosition: { x: 50, y: 50 },
    duration: 5,
  },
  {
    id: 'lower-third-modern',
    name: 'Lower Third - Modern',
    category: 'lower-thirds',
    preview: 'John Doe | CEO',
    style: {
      fontFamily: 'Inter',
      fontSize: 28,
      fontWeight: 'bold',
      fontStyle: 'normal',
      color: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0.8)',
      backgroundPadding: 16,
      backgroundRadius: 4,
      textAlign: 'left',
    },
    animation: {
      type: 'slide-left',
      duration: 0.5,
      easing: 'ease-out',
      direction: 'in',
    },
    defaultText: 'Name | Title',
    defaultPosition: { x: 10, y: 80 },
    duration: 4,
  },
  {
    id: 'cinematic-subtitle',
    name: 'Cinematic Subtitle',
    category: 'cinematic',
    preview: 'Chapter One',
    style: {
      fontFamily: 'Georgia',
      fontSize: 48,
      fontWeight: 'light',
      fontStyle: 'italic',
      color: '#CCCCCC',
      letterSpacing: 8,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    animation: {
      type: 'fade',
      duration: 1.2,
      easing: 'ease-in-out',
      direction: 'both',
    },
    defaultText: 'CHAPTER ONE',
    defaultPosition: { x: 50, y: 50 },
    duration: 3,
  },
  {
    id: 'social-callout',
    name: 'Social Callout',
    category: 'social',
    preview: '@username',
    style: {
      fontFamily: 'Inter',
      fontSize: 36,
      fontWeight: 'bold',
      fontStyle: 'normal',
      color: '#00D4FF',
      strokeColor: '#FFFFFF',
      strokeWidth: 3,
      textAlign: 'center',
    },
    animation: {
      type: 'bounce',
      duration: 0.6,
      easing: 'bounce',
      direction: 'in',
    },
    defaultText: '@username',
    defaultPosition: { x: 50, y: 30 },
    duration: 3,
  },
  {
    id: 'typewriter-reveal',
    name: 'Typewriter',
    category: 'callouts',
    preview: 'Type something...',
    style: {
      fontFamily: 'Courier New',
      fontSize: 32,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#00FF00',
      backgroundColor: 'rgba(0,0,0,0.9)',
      backgroundPadding: 20,
      backgroundRadius: 0,
      textAlign: 'left',
    },
    animation: {
      type: 'typewriter',
      duration: 2,
      easing: 'linear',
      direction: 'in',
    },
    defaultText: 'Type your message here...',
    defaultPosition: { x: 50, y: 50 },
    duration: 4,
  },
  {
    id: 'glitch-title',
    name: 'Glitch Title',
    category: 'social',
    preview: 'GLITCH',
    style: {
      fontFamily: 'Inter',
      fontSize: 64,
      fontWeight: 'black',
      fontStyle: 'normal',
      color: '#FF0066',
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    animation: {
      type: 'glitch',
      duration: 0.3,
      easing: 'linear',
      direction: 'in',
    },
    defaultText: 'GLITCH',
    defaultPosition: { x: 50, y: 50 },
    duration: 2,
  },
  {
    id: 'wave-text',
    name: 'Wave Animation',
    category: 'callouts',
    preview: 'Hello World',
    style: {
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: 'bold',
      fontStyle: 'normal',
      color: '#FFD700',
      textAlign: 'center',
    },
    animation: {
      type: 'wave',
      duration: 1.5,
      easing: 'ease-in-out',
      direction: 'in',
    },
    defaultText: 'HELLO WORLD',
    defaultPosition: { x: 50, y: 50 },
    duration: 4,
  },
  {
    id: 'kinetic-bold',
    name: 'Kinetic Typography',
    category: 'cinematic',
    preview: 'IMPACT',
    style: {
      fontFamily: 'Impact',
      fontSize: 96,
      fontWeight: 'bold',
      fontStyle: 'normal',
      color: '#FFFFFF',
      strokeColor: '#FF0000',
      strokeWidth: 4,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    animation: {
      type: 'kinetic',
      duration: 0.4,
      easing: 'elastic',
      direction: 'in',
    },
    defaultText: 'IMPACT',
    defaultPosition: { x: 50, y: 50 },
    duration: 2,
  },
];

const ANIMATION_TYPES: { id: TextAnimationType; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'fade', name: 'Fade' },
  { id: 'slide-up', name: 'Slide Up' },
  { id: 'slide-down', name: 'Slide Down' },
  { id: 'slide-left', name: 'Slide Left' },
  { id: 'slide-right', name: 'Slide Right' },
  { id: 'scale', name: 'Scale' },
  { id: 'bounce', name: 'Bounce' },
  { id: 'typewriter', name: 'Typewriter' },
  { id: 'glitch', name: 'Glitch' },
  { id: 'wave', name: 'Wave' },
  { id: 'shake', name: 'Shake' },
  { id: 'rotate-in', name: 'Rotate In' },
  { id: 'flip', name: 'Flip' },
  { id: 'zoom-in', name: 'Zoom In' },
  { id: 'blur-in', name: 'Blur In' },
  { id: 'split-reveal', name: 'Split Reveal' },
  { id: 'kinetic', name: 'Kinetic' },
];

const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Impact',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
];

export function TextPanel() {
  const { project, addTextOverlay, updateTextOverlay, removeTextOverlay, currentTime } = useProjectStore();
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string>('templates');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTemplates = selectedCategory === 'all'
    ? TEXT_TEMPLATES
    : TEXT_TEMPLATES.filter((t) => t.category === selectedCategory);

  const selectedText = project?.textOverlays.find((t) => t.id === selectedTextId);

  const addTextFromTemplate = (template: TextTemplate) => {
    const newText: TextOverlay = {
      id: uuidv4(),
      text: template.defaultText,
      startTime: currentTime,
      endTime: currentTime + template.duration,
      style: { ...template.style },
      animation: { ...template.animation },
      position: { ...template.defaultPosition },
    };

    addTextOverlay(newText);
    setSelectedTextId(newText.id);
    toast.success(`Added "${template.name}" text`);
  };

  const addCustomText = () => {
    const newText: TextOverlay = {
      id: uuidv4(),
      text: 'Your Text Here',
      startTime: currentTime,
      endTime: currentTime + 5,
      style: {
        fontFamily: 'Inter',
        fontSize: 48,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      animation: {
        type: 'fade',
        duration: 0.5,
        easing: 'ease-out',
        direction: 'in',
      },
      position: { x: 50, y: 50 },
    };

    addTextOverlay(newText);
    setSelectedTextId(newText.id);
    toast.success('Added custom text');
  };

  const handleStyleChange = (key: keyof TextStyle, value: string | number | boolean) => {
    if (!selectedText) return;
    updateTextOverlay(selectedText.id, {
      style: { ...selectedText.style, [key]: value },
    });
  };

  const handleAnimationChange = (key: keyof TextAnimation, value: string | number) => {
    if (!selectedText) return;
    updateTextOverlay(selectedText.id, {
      animation: { ...selectedText.animation, [key]: value },
    });
  };

  const categories = ['all', 'titles', 'lower-thirds', 'captions', 'callouts', 'social', 'cinematic'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Type className="h-4 w-4" />
          Text & Titles
        </h3>
        <button
          onClick={addCustomText}
          className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3 w-3 inline mr-1" />
          Custom
        </button>
      </div>

      {/* Templates Section */}
      <div>
        <button
          onClick={() => setExpandedSection(expandedSection === 'templates' ? '' : 'templates')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <h4 className="text-xs font-semibold">Templates</h4>
          {expandedSection === 'templates' ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {expandedSection === 'templates' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[10px] capitalize',
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => addTextFromTemplate(template)}
                  className="group rounded border border-border bg-muted/30 p-3 text-left hover:bg-muted/50 hover:border-primary/50 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{template.name}</span>
                    <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                      {template.category}
                    </span>
                  </div>
                  <div
                    className="text-center py-3 rounded bg-black/50 mb-2 overflow-hidden"
                    style={{
                      fontFamily: template.style.fontFamily,
                      fontSize: Math.min(template.style.fontSize / 4, 16),
                      fontWeight: template.style.fontWeight,
                      fontStyle: template.style.fontStyle,
                      color: template.style.color,
                      textTransform: template.style.textTransform,
                      letterSpacing: template.style.letterSpacing ? template.style.letterSpacing / 4 : undefined,
                    }}
                  >
                    {template.preview}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Animation: {template.animation.type} • {template.duration}s
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Current Text Overlays */}
      <div>
        <button
          onClick={() => setExpandedSection(expandedSection === 'current' ? '' : 'current')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <h4 className="text-xs font-semibold">
            Active Text ({project?.textOverlays.length || 0})
          </h4>
          {expandedSection === 'current' ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {expandedSection === 'current' && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {project?.textOverlays.length === 0 ? (
              <p className="text-xs text-muted-foreground">No text overlays added yet</p>
            ) : (
              project?.textOverlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className={cn(
                    'flex items-center justify-between rounded border p-2 cursor-pointer',
                    selectedTextId === overlay.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/30 hover:bg-muted/50'
                  )}
                  onClick={() => setSelectedTextId(overlay.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{overlay.text}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {overlay.startTime.toFixed(1)}s - {overlay.endTime.toFixed(1)}s
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTextOverlay(overlay.id);
                      if (selectedTextId === overlay.id) setSelectedTextId(null);
                      toast.success('Text removed');
                    }}
                    className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Text Editor */}
      {selectedText && (
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'editor' ? '' : 'editor')}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <h4 className="text-xs font-semibold flex items-center gap-2">
              <Palette className="h-3 w-3" />
              Edit Text
            </h4>
            {expandedSection === 'editor' ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {expandedSection === 'editor' && (
            <div className="space-y-3 bg-muted/30 rounded p-3">
              {/* Text Content */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Text Content</label>
                <textarea
                  value={selectedText.text}
                  onChange={(e) => updateTextOverlay(selectedText.id, { text: e.target.value })}
                  className="w-full rounded bg-background px-2 py-1 text-xs resize-none"
                  rows={3}
                />
              </div>

              {/* Timing */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Start Time</label>
                  <input
                    type="number"
                    value={selectedText.startTime}
                    onChange={(e) => updateTextOverlay(selectedText.id, { startTime: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">End Time</label>
                  <input
                    type="number"
                    value={selectedText.endTime}
                    onChange={(e) => updateTextOverlay(selectedText.id, { endTime: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                    step="0.1"
                  />
                </div>
              </div>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">X Position (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={selectedText.position.x}
                    onChange={(e) => updateTextOverlay(selectedText.id, {
                      position: { ...selectedText.position, x: parseFloat(e.target.value) || 50 }
                    })}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Y Position (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={selectedText.position.y}
                    onChange={(e) => updateTextOverlay(selectedText.id, {
                      position: { ...selectedText.position, y: parseFloat(e.target.value) || 50 }
                    })}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                  />
                </div>
              </div>

              {/* Font Settings */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Font Family</label>
                <select
                  value={selectedText.style.fontFamily}
                  onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                  className="w-full rounded bg-background px-2 py-1 text-xs"
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Font Size</label>
                  <input
                    type="number"
                    min="8"
                    max="200"
                    value={selectedText.style.fontSize}
                    onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value) || 48)}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Weight</label>
                  <select
                    value={selectedText.style.fontWeight}
                    onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                  >
                    <option value="light">Light</option>
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="black">Black</option>
                  </select>
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Text Color</label>
                  <input
                    type="color"
                    value={selectedText.style.color}
                    onChange={(e) => handleStyleChange('color', e.target.value)}
                    className="w-full h-8 rounded bg-background cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Stroke Color</label>
                  <input
                    type="color"
                    value={selectedText.style.strokeColor || '#000000'}
                    onChange={(e) => handleStyleChange('strokeColor', e.target.value)}
                    className="w-full h-8 rounded bg-background cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Stroke Width</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={selectedText.style.strokeWidth || 0}
                  onChange={(e) => handleStyleChange('strokeWidth', parseFloat(e.target.value))}
                  className="w-full h-1"
                />
                <span className="text-[10px] text-muted-foreground">{selectedText.style.strokeWidth || 0}px</span>
              </div>

              {/* Animation */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Animation Type</label>
                <select
                  value={selectedText.animation.type}
                  onChange={(e) => handleAnimationChange('type', e.target.value)}
                  className="w-full rounded bg-background px-2 py-1 text-xs"
                >
                  {ANIMATION_TYPES.map((anim) => (
                    <option key={anim.id} value={anim.id}>{anim.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Duration</label>
                  <input
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={selectedText.animation.duration}
                    onChange={(e) => handleAnimationChange('duration', parseFloat(e.target.value) || 0.5)}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Easing</label>
                  <select
                    value={selectedText.animation.easing}
                    onChange={(e) => handleAnimationChange('easing', e.target.value)}
                    className="w-full rounded bg-background px-2 py-1 text-xs"
                  >
                    <option value="linear">Linear</option>
                    <option value="ease-in">Ease In</option>
                    <option value="ease-out">Ease Out</option>
                    <option value="ease-in-out">Ease In-Out</option>
                    <option value="bounce">Bounce</option>
                    <option value="elastic">Elastic</option>
                  </select>
                </div>
              </div>

              {/* Text Alignment */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Alignment</label>
                <div className="flex gap-1">
                  {['left', 'center', 'right'].map((align) => (
                    <button
                      key={align}
                      onClick={() => handleStyleChange('textAlign', align)}
                      className={cn(
                        'flex-1 rounded py-1 text-xs capitalize',
                        selectedText.style.textAlign === align
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-muted'
                      )}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Transform */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Transform</label>
                <select
                  value={selectedText.style.textTransform || 'none'}
                  onChange={(e) => handleStyleChange('textTransform', e.target.value)}
                  className="w-full rounded bg-background px-2 py-1 text-xs"
                >
                  <option value="none">None</option>
                  <option value="uppercase">UPPERCASE</option>
                  <option value="lowercase">lowercase</option>
                  <option value="capitalize">Capitalize</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
