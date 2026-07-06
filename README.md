# Photobooth

A real-time collaborative photobooth app with AI background removal, WebRTC peer-to-peer sessions, Firebase auth, and multi-platform support (web, desktop, iOS, Android).

## Features

### Core Photobooth
- **Frame Selection** — Custom frame styles with user-created frames, admin review workflow, and public frame gallery
- **Live Photo Capture** — Real-time camera with countdown and photo capture
- **AI Background Removal** — Client-side background removal powered by @huggingface/transformers (ONNX/WASM)
- **Custom Backgrounds** — Upload images, choose from gallery, or keep original
- **Filters & Adjustments** — Preset filters plus manual sliders for brightness, contrast, saturation, temperature, hue, sepia, grayscale, vignette, and blur
- **Photo Strip Rendering** — Film-strip style composite with customizable frames
- **Animated GIF Export** — Slideshow GIF generation using gif.js web workers
- **Individual Downloads** — Per-photo downloads with custom frames
- **Bulk Media Export** — Batch upload and share multiple photos/GIFs with exponential backoff retry
- **S3-Compatible Storage** — Server-side image storage via AWS SDK with CDN support

### WebRTC "Date Mode" (Photobooth for Two)
- **Peer-to-Peer Video** — Real-time video connection between two users
- **Synchronized Capture** — Both participants see countdown and capture simultaneously
- **Side-by-Side Compositing** — Two video feeds rendered into a single frame
- **TURN Credential Relay** — Server-side TURN credential fetching via Turnix API with in-memory caching
- **Reconnection Logic** — Automatic peer connection reset on failure
- **Session State Sync** — File sharing and state synchronization via WebRTC data channels
- **Chat Panel** — Text messaging between participants during session
- **QR Code Invite** — Easy session joining via QR code scan
- **Session Management** — Host can gracefully end sessions for all participants

### User Experience
- **Firebase Authentication** — Email/password auth with Capacitor native auth on mobile
- **Multi-Step Workflow** — Guided flow with peer sync for collaborative sessions
- **Responsive Mobile Layouts** — Device-specific UI with restrictions for complex features (frame editor blocked on mobile)
- **Navigation Guards** — Unsaved changes warnings via custom dialog provider
- **SWR Data Fetching** — Optimistic UI with stale-while-revalidate pattern for frames, backgrounds, and filters

### Admin Features
- **Frame Publishing Review** — Moderated workflow for user-submitted frames
- **Admin Dashboard** — Review pending frame submissions at `/admin/reviews`

## Tech Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **TypeScript**
- **Tailwind CSS 4**
- **Firebase** (Authentication, Firestore via REST API wrapper)
- **WebRTC** (RTCPeerConnection, RTCDataChannel)
- **Turnix** (TURN credential provider)
- **SWR** (Data fetching and caching)
- **AWS SDK** (S3-compatible storage)
- **gif.js** (Animated GIF encoding via web workers)
- **@huggingface/transformers** (Client-side AI background removal)
- **Tauri v2** (Native desktop app for macOS/Windows/Linux)
- **Capacitor 8** (iOS and Android native mobile support)

## Getting Started

### Prerequisites

**For mobile development:**
- Xcode (iOS)
- Android Studio (Android)
- [Capacitor CLI](https://capacitorjs.com/docs/getting-started)

**For desktop development:**
- [Rust](https://rustup.rs/)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Environment Variables

Create `.env.local`:

```bash
# Firebase (web SDK config)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Turnix TURN credential provider
NEXT_PUBLIC_TURNIX_TOKEN=your_turnix_token

# S3-compatible storage (server-side)
S3_ENDPOINT=https://your-s3-endpoint.com
S3_REGION=auto
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your_bucket_name

# CDN (optional)
CDN_BASE_URL=https://your-cdn.com
```

### Web App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For production:

```bash
npm run build
npm run start
```

### Desktop App (Tauri)

**Requires [Rust](https://rustup.rs/) installed.**

```bash
# Development (opens native window with hot reload)
npm run tauri:dev

# Production build (generates .app / .dmg / .exe)
npm run tauri:build
```

**Output locations:**
- **macOS:** `src-tauri/target/release/bundle/macos/Photobooth.app`
- **macOS DMG:** `src-tauri/target/release/bundle/dmg/Photobooth_*.dmg`

**Tauri configuration:**
- `src-tauri/tauri.conf.json` — app window, bundling, security settings
- `src-tauri/Info.plist` — macOS camera/microphone permission descriptions
- `src-tauri/Entitlements.plist` — macOS entitlements (camera, audio)
- `src-tauri/Cargo.toml` — Rust dependencies

### Mobile App (Capacitor)

**iOS:**

```bash
# Build web assets
npm run build

# Sync to Capacitor
npm run cap sync ios

# Open in Xcode
npm run cap open ios
```

Build and run from Xcode. Requires:
- `ios/App/App/GoogleService-Info.plist` (Firebase iOS config)
- Signing certificate and provisioning profile
- Bundle ID: `pika.identifika.app`

**Android:**

```bash
# Build web assets
npm run build

# Sync to Capacitor
npm run cap sync android

# Open in Android Studio
npm run cap open android
```

Build and run from Android Studio. Requires:
- `android/app/google-services.json` (Firebase Android config)

**Important mobile notes:**
- **Authentication:** Uses `@capacitor-firebase/authentication` for native auth
- **Firestore:** Uses REST API wrapper (`lib/firestore.ts`) — native plugin and web SDK both broken in WebViews
- **Status Bar:** Configured with `overlaysWebView: false`
- **iOS Setup:** `AppDelegate.swift` must call `FirebaseApp.configure()`
- **Camera Downloads:** Uses `@capacitor/filesystem` + `@capacitor/share` for data URLs
- **Frame Editor:** Blocked on mobile (performance/UX restrictions)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server (Turbopack) |
| `npm run build` | Build for web (server mode) |
| `npm run build:tauri` | Build static export for Tauri |
| `npm run build:static` | Build static export (generic) |
| `npm run start` | Start production web server |
| `npm run tauri:dev` | Run desktop app in dev mode |
| `npm run tauri:build` | Build native desktop app |
| `npm run cap` | Capacitor CLI commands |

## Project Structure

```
app/
  page.tsx                → Landing / frame selection
  editor/page.tsx         → Main photobooth editor
  date/page.tsx           → WebRTC "date mode" session
  frames/page.tsx         → Frame gallery
  share/page.tsx          → Share captured media
  login/page.tsx          → Firebase auth
  settings/page.tsx       → User settings
  admin/reviews/page.tsx  → Frame review dashboard (admin)
  api/
    turn-credentials/     → TURN credential proxy (Turnix)
    upload/               → S3 file upload
    presign/              → S3 presigned URL generation
    share/                → Bulk media upload
    proxy-image/          → CDN image processing

components/
  Camera.tsx              → Camera with live capture
  BackgroundSelector.tsx  → BG removal + filters + adjustments
  FinalStrip.tsx          → Strip rendering, GIF export, downloads
  FrameSelector.tsx       → Frame picker UI
  FrameEditor.tsx         → Frame creation tool (desktop only)
  PhotoReview.tsx         → Photo accept/retake screen
  DatePhotobooth.tsx      → WebRTC dual-camera session
  DualCameraView.tsx      → Side-by-side video feeds
  ChatPanel.tsx           → WebRTC text chat
  ShareSection.tsx        → Bulk media export UI
  PolaroidGrid.tsx        → Photo gallery grid
  PhotoStrip.tsx          → Film strip with printing animation
  StripPreview.tsx        → Frame preview component

lib/
  frames.ts               → Frame definitions and logic
  frame-types.ts          → Frame TypeScript types
  draw-frame.ts           → Canvas frame rendering
  firebase.ts             → Firebase web SDK init
  firestore.ts            → REST API Firestore wrapper
  useDatePeerConnection.ts→ WebRTC connection hook
  roomSession.ts          → Session state management
  cdn.ts                  → CDN image URL generation
  uploadFrameImage.ts     → S3 upload with retry logic
  download.ts             → Client-side file downloads
  remove-bg.ts            → AI background removal
  user-frames.ts          → User-created frames CRUD
  public-frames.ts        → Public frame gallery
  publish-requests.ts     → Frame review workflow

hooks/
  useAuth.tsx             → Firebase auth state
  useFrames.ts            → SWR frame fetching
  useGifGenerator.ts      → GIF encoding worker
  useBulkUpload.ts        → Batch S3 upload with retry
  useIsMobile.ts          → Mobile detection
  useStudioSettings.ts    → Studio configuration state

src-tauri/              → Tauri native app (Rust backend)
android/                → Capacitor Android project
ios/                    → Capacitor iOS project

public/
  gif.worker.js         → gif.js web worker
  backgrounds/          → Default background images
```

## Firebase Setup

### Firestore Collections

- `frames` — User-created frames
- `public-frames` — Published frames
- `publish-requests` — Pending frame reviews
- `backgrounds` — Custom background images
- `filters` — Custom filters
- `users` — User profiles

### Security Rules

See `firestore.rules` for:
- User authentication requirements
- Admin role checks
- Read/write permissions per collection

### Storage

S3-compatible storage via AWS SDK (not Firebase Storage). Configure:
- Bucket CORS for client uploads
- CDN for image delivery
- Presigned URLs for secure uploads

## WebRTC Architecture

### Components

1. **Signaling** — Separate Rust relay (see `/signal-relay` if available, or `task.md` for deployment)
2. **TURN Credentials** — Server-side fetch from Turnix with in-memory cache
3. **Peer Connection** — `useDatePeerConnection.ts` hook manages RTCPeerConnection lifecycle
4. **Data Channel** — State sync, chat, file sharing between peers
5. **Reconnection** — Automatic reset on ICE failure or disconnect

### Session Flow

1. Host creates room → generates room ID
2. Guest joins via link or QR code
3. WebRTC handshake via signaling relay
4. P2P connection established (video + data channel)
5. Synchronized photo capture on both sides
6. Side-by-side composite rendered locally
7. Host can end session for all participants

### Known Limitations

- Frame editor disabled on mobile (performance/UX)
- No reconnect-after-network-blip (requires page reload)
- Single-use rooms (no persistent/rejoinable sessions)

## Deployment

### Web (Vercel)

```bash
npm run build
```

Deploy via Vercel CLI or GitHub integration. Configure environment variables in Vercel dashboard.

### Mobile (App Store / Play Store)

Build via Xcode/Android Studio. Requires:
- Apple Developer account (iOS)
- Google Play Developer account (Android)
- Signing certificates
- Firebase project with iOS/Android apps registered

### Desktop (macOS App Store / DMG distribution)

```bash
npm run tauri:build
```

Output in `src-tauri/target/release/bundle/`. For App Store distribution, configure signing in `tauri.conf.json`.

## Pitfalls & Solutions

### iOS
- **CSS `var()` in `@keyframes`** — Broken on iOS. Use static values.
- **Data URL downloads** — Requires `@capacitor/filesystem` + `@capacitor/share`.
- **Status Bar** — Set `overlaysWebView: false` to prevent overlap.
- **GoogleService-Info.plist** — Must be in Xcode project (`.pbxproj`).
- **AppDelegate** — Call `FirebaseApp.configure()` in `application(_:didFinishLaunchingWithOptions:)`.

### Android
- **WebView Firestore** — Use REST API wrapper, native plugin fails.

### WebRTC
- **Reconnection** — `peer-left` event keeps WebSocket open for reconnect.
- **Invite Links** — Use origin on web, hardcoded `pika.identifika.my.id` on native.

### S3 Uploads
- **Retry Logic** — Exponential backoff for transient failures (network, 503).
- **Bulk Upload** — `useBulkUpload` hook handles batch uploads with progress tracking.

## License

Private project.
