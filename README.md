# ClipFlow Studio

**AI-Powered Video Editor for Creators**

A professional, production-ready video editing application optimized for both long-form and short-form content creators. Local-first, privacy-focused, with powerful AI automation features.

![ClipFlow Studio](./docs/screenshot.png)

## Features

### Core Editing
- **Non-linear Timeline** - Multi-track editing for video, audio, captions, and overlays
- **Drag-and-Drop Import** - Support for MP4, MOV, MKV, WebM, MP3, WAV, and images
- **Precision Trimming** - Frame-by-frame editing with ripple/roll/delete edits
- **Multi-clip Selection** - Group operations and nested timelines

### AI-Powered Automation
- **Auto-Captions** - Speech-to-text with speaker detection
- **Smart Highlights** - Automatic detection of high-energy moments
- **One-Click Shortify** - Convert long videos to engaging shorts automatically
- **Scene Detection** - AI-powered cut suggestions
- **Silence Removal** - Auto-trim dead air and pauses

### Short-Form Optimization
- **Aspect-First Editing** - 9:16, 1:1, 4:5 templates
- **Platform Presets** - TikTok, Instagram Reels, YouTube Shorts
- **Trending Styles** - Apply popular editing patterns
- **Smart Vertical Crop** - Face/object-aware cropping

### Audio Processing
- **Multi-track Audio** - Gain, fade, pan, mute, solo
- **Auto-ducking** - Voice vs. music balancing
- **One-click Noise Reduction**
- **Loudness Normalization** - ITU/EBU compliant (-14 LUFS)

### Export & Publishing
- **Platform-Specific Presets** - YouTube, TikTok, Instagram, Twitter
- **Batch Export Queue** - Process multiple videos
- **Direct Publishing** - OAuth integration with platforms
- **Quality Control** - Bitrate, codec, and resolution options

## Quick Start

### Web Version (PWA)
```bash
npm install
npm start
```
Open http://localhost:5173 in your browser.

### Desktop App
```bash
npm install
npm run electron:dev
```

### Building Installers

**Windows:**
```bash
npm run electron:build:win
```

**macOS:**
```bash
npm run electron:build:mac
```

**Linux:**
```bash
npm run electron:build:linux
```

## System Requirements

### Minimum
- **OS:** Windows 10, macOS 10.15, Ubuntu 20.04
- **RAM:** 8GB
- **Storage:** 500MB (app) + project space
- **CPU:** Intel i5 / AMD Ryzen 5 or equivalent

### Recommended
- **RAM:** 16GB+
- **GPU:** Dedicated graphics for hardware acceleration
- **Storage:** SSD for optimal performance

## Architecture

```
clipflow-studio/
├── src/                    # React application
│   ├── components/         # UI components
│   ├── stores/             # Zustand state management
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript definitions
│   └── workers/            # Web Workers for heavy processing
├── electron/               # Desktop app shell
├── public/                 # Static assets
└── resources/              # Native binaries (FFmpeg, ONNX models)
```

### Tech Stack
- **Frontend:** React 18 + TypeScript + Vite
- **State:** Zustand with persistence
- **Styling:** Tailwind CSS + Radix UI
- **Media:** FFmpeg.wasm (browser) / FFmpeg binary (desktop)
- **ML:** ONNX Runtime for local AI inference
- **Desktop:** Electron with auto-updates

## Usage Guide

### For New Creators (Beginner Mode)

1. **Create Project** - Click "New Project" and choose aspect ratio
2. **Import Media** - Drag and drop your video files
3. **Add to Timeline** - Click the play button on media items
4. **Auto-Captions** - Go to Captions panel and click "Auto-Generate"
5. **Shortify** - Click the "Shortify" button to create AI-powered shorts
6. **Export** - Choose platform preset and export

### For Advanced Users

- Switch to Advanced Mode in Settings
- Access multi-track timeline with keyframing
- Fine-tune color correction and effects
- Custom export settings with codec control
- Batch processing for multiple projects

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Play/Pause | `Space` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` |
| Export | `Ctrl+E` |
| Settings | `Ctrl+,` |
| Split Clip | `S` |
| Skip Forward | `→` |
| Skip Backward | `←` |
| Skip 10s Forward | `Shift+→` |
| Skip 10s Backward | `Shift+←` |

## Privacy & Data

ClipFlow Studio is **local-first**:
- All processing happens on your device by default
- No data is sent to cloud without explicit consent
- Optional cloud features require user opt-in
- Privacy dashboard shows exactly what's shared

### Local ML Models
- Speech recognition (ASR)
- Scene detection
- Face/object detection
- Audio noise reduction

## Export Presets

| Platform | Resolution | FPS | Bitrate | Aspect |
|----------|-----------|-----|---------|--------|
| YouTube | 1920x1080 | 30 | 8 Mbps | 16:9 |
| YouTube Shorts | 1080x1920 | 30 | 6 Mbps | 9:16 |
| TikTok | 1080x1920 | 30 | 6 Mbps | 9:16 |
| Instagram Reels | 1080x1920 | 30 | 6 Mbps | 9:16 |
| Instagram Feed | 1080x1080 | 30 | 5 Mbps | 1:1 |
| Twitter/X | 1920x1080 | 30 | 6 Mbps | 16:9 |

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup
```bash
git clone https://github.com/your-org/clipflow-studio.git
cd clipflow-studio
npm install
```

### Development
```bash
# Web development
npm start

# Desktop development
npm run electron:dev

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
```

### Building
```bash
# Production build
npm run build

# Desktop installers
npm run electron:build
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

### v1.1 (Q1 2025)
- [ ] Multi-language caption support
- [ ] Advanced color grading with LUTs
- [ ] Plugin system for custom effects
- [ ] Cloud project backup

### v1.2 (Q2 2025)
- [ ] Real-time collaboration
- [ ] Mobile companion app
- [ ] Stock media marketplace
- [ ] Advanced audio mixing

### v2.0 (2025)
- [ ] GPU-accelerated rendering
- [ ] 4K/8K support
- [ ] Professional broadcast features
- [ ] Enterprise team management

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- FFmpeg for media processing
- ONNX Runtime for ML inference
- React and the open-source community
- All contributors and testers

---

**Made with love for creators worldwide**

For support, visit [clipflow.studio/support](https://clipflow.studio/support) or open an issue on GitHub.
