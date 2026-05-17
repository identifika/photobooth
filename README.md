# Photobooth

A vintage-inspired photobooth app with live photo capture, AI background removal, image filters, and animated GIF export. Runs as a web app or a native desktop app.

## Features

- **Frame Selection** — 12 unique frame styles (strips, grids, duos) with distinct color themes
- **Live Photo Capture** — records ~5 seconds of motion (3s countdown + 2s after) alongside each still photo
- **AI Background Removal** — client-side background removal powered by @imgly/background-removal (ONNX/WASM)
- **Custom Backgrounds** — green screen, uploaded images, or keep the original
- **Filters & Adjustments** — 10 preset filters (Vintage, Noir, Warm, Cool, Vivid, Fade, Dramatic, Golden, Moonlight) plus manual sliders for brightness, contrast, saturation, temperature, hue, sepia, grayscale, vignette, and blur
- **Photo Strip Rendering** — generates a film-strip style composite with sprocket holes, borders, and labels
- **Animated GIF Export** — slideshow GIF of all photos + per-photo live moment GIFs
- **Individual Downloads** — each photo downloadable with a polaroid-style frame
- **Responsive UI** — Tailwind CSS, vintage aesthetic with Playfair Display + DM Sans typography

## Tech Stack

- Next.js 16 (App Router, React 19)
- TypeScript
- Tailwind CSS 4
- gif.js (animated GIF encoding via web workers)
- @imgly/background-removal (client-side AI segmentation)
- **Tauri v2 (native desktop app for macOS/Windows/Linux)**

## Getting Started

### Web App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

For production:

```bash
npm run build
npm run start
```

### **Desktop App (Tauri)**

**Requires [Rust](https://rustup.rs/) installed on your system.**

```bash
# Development (opens native window with hot reload)
npm run tauri:dev

# Production build (generates .app / .dmg / .exe)
npm run tauri:build
```

**Output locations:**
- **macOS:** `src-tauri/target/release/bundle/macos/Photobooth.app`
- **macOS DMG:** `src-tauri/target/release/bundle/dmg/Photobooth_0.1.0_aarch64.dmg`

**Tauri configuration:**
- `src-tauri/tauri.conf.json` — app window, bundling, and security settings
- `src-tauri/Info.plist` — macOS camera/microphone permission descriptions
- `src-tauri/Entitlements.plist` — macOS entitlements (camera, audio)
- `src-tauri/Cargo.toml` — Rust dependencies (`macos-private-api` enabled for camera access in WKWebView)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for web (server mode) |
| `npm run start` | Start production web server |
| `npm run build:tauri` | Build static export for Tauri |
| `npm run tauri:dev` | Run desktop app in dev mode |
| `npm run tauri:build` | Build native desktop app |

## Project Structure

```
app/                    → Next.js pages and layout
components/             → React components
  Camera.tsx            → Camera with live frame capture
  BackgroundSelector.tsx→ BG removal + filters + adjustments
  FinalStrip.tsx        → Strip rendering, GIF export, downloads
  FrameSelector.tsx     → Frame picker UI
  PhotoReview.tsx       → Photo accept/retake screen
lib/
  frames.ts            → Frame definitions (12 styles)
src-tauri/             → Tauri native app (Rust backend)
public/
  gif.worker.js        → gif.js web worker
```

## License

Private project.
