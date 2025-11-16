import { useState } from 'react';
import { X, Download, Check } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import type { ExportPreset } from '@/types';
import toast from 'react-hot-toast';

const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    platform: 'youtube',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    fps: 30,
    bitrate: 8000,
    codec: 'h264',
    format: 'mp4',
    audioCodec: 'aac',
    audioBitrate: 192,
    aspectRatio: '16:9',
  },
  {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    platform: 'youtube-shorts',
    resolution: { width: 1080, height: 1920, label: '1080p Vertical' },
    fps: 30,
    bitrate: 6000,
    codec: 'h264',
    format: 'mp4',
    audioCodec: 'aac',
    audioBitrate: 192,
    aspectRatio: '9:16',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    platform: 'tiktok',
    resolution: { width: 1080, height: 1920, label: '1080p Vertical' },
    fps: 30,
    bitrate: 6000,
    codec: 'h264',
    format: 'mp4',
    audioCodec: 'aac',
    audioBitrate: 192,
    aspectRatio: '9:16',
  },
  {
    id: 'instagram-reels',
    name: 'Instagram Reels',
    platform: 'instagram-reels',
    resolution: { width: 1080, height: 1920, label: '1080p Vertical' },
    fps: 30,
    bitrate: 6000,
    codec: 'h264',
    format: 'mp4',
    audioCodec: 'aac',
    audioBitrate: 192,
    aspectRatio: '9:16',
  },
  {
    id: 'instagram-feed',
    name: 'Instagram Feed',
    platform: 'instagram-feed',
    resolution: { width: 1080, height: 1080, label: '1080x1080' },
    fps: 30,
    bitrate: 5000,
    codec: 'h264',
    format: 'mp4',
    audioCodec: 'aac',
    audioBitrate: 192,
    aspectRatio: '1:1',
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    platform: 'twitter',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    fps: 30,
    bitrate: 6000,
    codec: 'h264',
    format: 'mp4',
    audioCodec: 'aac',
    audioBitrate: 192,
    aspectRatio: '16:9',
  },
];

export function ExportDialog() {
  const { setShowExportDialog, setProcessing, setProcessingProgress } = useUIStore();
  const { project } = useProjectStore();

  const [selectedPreset, setSelectedPreset] = useState<string>('youtube');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeCaptions, setIncludeCaptions] = useState(true);
  const [qualityLevel, setQualityLevel] = useState<'draft' | 'standard' | 'high' | 'ultra'>('high');

  const qualityMultiplier = {
    draft: 0.5,
    standard: 1,
    high: 1.5,
    ultra: 2,
  };

  const handleExport = async () => {
    if (!project) return;

    setShowExportDialog(false);
    setProcessing(true, 'Exporting video...');

    // Simulate export process
    for (let i = 0; i <= 100; i += 2) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      setProcessingProgress(i);
    }

    setProcessing(false);
    toast.success('Video exported successfully!');
  };

  const preset = EXPORT_PRESETS.find((p) => p.id === selectedPreset);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Export Video</h2>
          <button
            onClick={() => setShowExportDialog(false)}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Platform presets */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Export Preset
            </label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {EXPORT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPreset(p.id)}
                  className={`flex items-center justify-between rounded-md border p-3 text-left transition-colors ${
                    selectedPreset === p.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.resolution.label}
                    </p>
                  </div>
                  {selectedPreset === p.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Level */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Quality Level
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['draft', 'standard', 'high', 'ultra'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setQualityLevel(level)}
                  className={`rounded-md border p-2 text-center transition-colors ${
                    qualityLevel === level
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-sm font-medium capitalize">{level}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {level === 'draft' && 'Fast preview'}
                    {level === 'standard' && 'Balanced'}
                    {level === 'high' && 'Best quality'}
                    {level === 'ultra' && 'Maximum'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Export settings */}
          {preset && (
            <div className="rounded-md bg-muted/50 p-4">
              <h3 className="mb-3 text-sm font-medium">Export Settings</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Resolution</p>
                  <p className="font-medium">
                    {preset.resolution.width}x{preset.resolution.height}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frame Rate</p>
                  <p className="font-medium">{preset.fps} fps</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Video Codec</p>
                  <p className="font-medium">{preset.codec.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bitrate</p>
                  <p className="font-medium">
                    {Math.round(preset.bitrate * qualityMultiplier[qualityLevel])} kbps
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Audio Codec</p>
                  <p className="font-medium">{preset.audioCodec.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Format</p>
                  <p className="font-medium">.{preset.format}</p>
                </div>
              </div>
            </div>
          )}

          {/* Codec compatibility note */}
          <div className="rounded-md bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-400">
            <strong>Note:</strong> MKV files with certain codecs (HEVC/H.265, VP9) may have limited browser support.
            For best results, use MP4 files with H.264 codec. All exports use the widely compatible H.264 codec.
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeAudio}
                onChange={(e) => setIncludeAudio(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Include audio tracks</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeCaptions}
                onChange={(e) => setIncludeCaptions(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Burn in captions</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setShowExportDialog(false)}
            className="rounded-md px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
