# Photobooth Branding & Frame Editor Implementation Task

## Objective
Implement dynamic merchant branding configuration (theme-based styling, persistent data hooks) and a frame editor component (with supporting APIs and schema updates) into the standalone photobooth app.

## Reference Commits
- `704a510`: Frame editor component, frame management API, services, schema updates.
- `576e5cd`: Dynamic merchant branding configuration, theme-based styling, persistent data hooks.

## Tasks

### 1. Database & Schema Updates
Files: `packages/db/src/schema/`, `packages/types/src/`

- **Branding schema** (`packages/db/src/schema/branding.ts`):
  - Add `appName`, `appTagline`, `tickerText` columns to `brandingConfigs`.
- **Branding types** (`packages/types/src/branding.ts`):
  - Rename `BrandingColors.text` to `foreground`.
  - Add `appName`, `appTagline`, `tickerText` to `BrandingConfig` and `UpdateBrandingInput`.
- **Frames types** (`packages/types/src/frame.ts`):
  - Add `FrameElementType`: `'photo' | 'title' | 'image' | 'emoji' | 'sticker'`.
  - Add `FrameElementBase`, `FramePhotoElement`, `FrameTitleElement`, `FrameImageElement`, `FrameEmojiElement`, `FrameStickerElement`, and union `FrameElement`.
  - Add `FrameTitle` interface.
  - Extend `FrameConfig` to have optional `elements: FrameElement[]` (new structure) alongside legacy `slots`, `background`, `overlay`, `watermark`, and visual sugar fields.
- **Frames schema** (`packages/db/src/schema/frames.ts`):
  - Remove `FrameSlot` import. Add JSDoc comment for `config` column.
- **Drizzle migration**: Run `drizzle-kit generate` and `drizzle-kit push` after schema changes.

### 2. Shared Data Files
Files: `data/`

- Ensure `data/branding.json` exists with at least `appName`, `appTagline`, `tickerText`, `colors`, `fonts`, `logo`.
- Ensure `data/frames.json` exists with `{ categories: [...], frames: [...] }` shape, frames using the new `FrameConfig.elements` structure.

### 3. Booth App — API Routes
Files: `apps/booth/app/api/`

- **`apps/booth/app/api/frames/route.ts`** (new):
  - GET: read `data/frames.json`, return `{ categories, frames }`. Fallback to empty arrays on error.
- **`apps/booth/app/api/branding/route.ts`** (new):
  - GET: read `data/branding.json`, return parsed JSON. Fallback to `{}` on error.

### 4. Booth App — Library & Hooks
Files: `apps/booth/lib/`, `apps/booth/hooks/`

- **`apps/booth/lib/api.ts`** (new):
  - `boothRequest<T>(path)`: fetch from `NEXT_PUBLIC_API_URL` with `X-Merchant-Key` header.
  - `fetchBoothConfig()`: calls `/booth/config`, returns `BoothConfig { merchant, branding, frames, flow }`.
- **`apps/booth/lib/frames.ts`** (refactor):
  - Add `adaptDbFrame(dbFrame)` to map API frame data (including legacy slot-based `FrameConfig`) to the app's internal `Frame` type.
  - Keep `STATIC_FRAMES` as final fallback.
- **`apps/booth/hooks/useFrames.ts`** (new):
  - Priority load: real API → `/api/frames` → static fallback.
  - Returns `{ frames, loading }`.
- **`apps/booth/hooks/useBranding.ts`** (new):
  - Fetch `/api/branding`, merge with defaults.
  - `BrandingData`: `logo`, `appName`, `appTagline`, `colors` (primary/secondary/accent/background/foreground), `fonts` (heading/body), `tickerText`.
  - Returns `{ branding, loading }`.

### 5. Booth App — UI Updates
Files: `apps/booth/app/`, `apps/booth/components/`

- **`apps/booth/app/layout.tsx`** (update):
  - Add `Geist` and `Geist_Mono` font variables via `next/font/google`.
  - Apply `${geistSans.variable} ${geistMono.variable} h-full antialiased` to `<html>`.
  - Set `<body>` class to `min-h-full bg-gray-50 text-gray-900`.
- **`apps/booth/app/globals.css`** (update):
  - Update CSS custom properties to use branding color tokens instead of hardcoded values.
- **`apps/booth/app/page.tsx`** (update):
  - Use `useBranding()` and `useFrames()` hooks.
  - Apply `branding.colors.accent` and `branding.colors.foreground` as `accentColor` and `borderColor`.
  - Render `branding.appName` and `branding.appTagline` in header (replace hardcoded "Photobooth" / "Studio").
  - Replace static ticker text with `branding.tickerText`.
- **`apps/booth/components/FrameSelector.tsx`** (update):
  - Accept or read branding data to apply dynamic colors for active/hover states.
- **`apps/booth/components/FinalStrip.tsx`** (update):
  - Render frames using new `FrameElement`-based config (photo, title, image, emoji, sticker elements) instead of the old slot approach.

### 6. Merchant Admin — API Routes
Files: `apps/merchant-admin/app/api/`

- **`apps/merchant-admin/app/api/frames/route.ts`** (new):
  - GET: read `data/frames.json`.
  - POST: write updated frames data to `data/frames.json`.
- **`apps/merchant-admin/app/api/branding/route.ts`** (new):
  - GET: read `data/branding.json`.
  - POST: merge and write updated branding data to `data/branding.json`.

### 7. Merchant Admin — Library
Files: `apps/merchant-admin/lib/api.ts`

- Add functions for frames management: `getFrames`, `createFrame`, `updateFrame`, `deleteFrame`.
- Add functions for branding: `getBranding`, `updateBranding`.
- Keep existing merchant/auth helpers.

### 8. Merchant Admin — FrameEditor Component
File: `apps/merchant-admin/components/FrameEditor.tsx` (new, ~1100 lines)

Key features:
- Canvas with H/V rulers, pixel indicators.
- 8-point canvas resize handles (n/s/e/w/ne/nw/se/sw).
- Snap-to-grid / snap-to-element guides (4px threshold).
- Element types supported: `photo`, `title`, `image`, `emoji`, `sticker`.
- Per-element controls: position (x, y), size (w, h), rotation, color, font, alignment, emoji/sticker emoji picker.
- Layout presets: `single`, `strip_2`, `strip_3`, `strip_4`, `grid_2x2`.
- Frame canvas size presets: Portrait 2:3 (400x600), Square (500x500), Landscape 3:2 (600x400), Story 9:16 (360x640), Tall 3:4 (450x600).
- `onChange(config: FrameConfig)` callback on every change.
- Dependencies needed: `@workspace/ui` components (Input, Button), `@workspace/types/frame`.

### 9. Merchant Admin — Dashboard Pages
Files: `apps/merchant-admin/app/dashboard/`

- **`apps/merchant-admin/app/dashboard/frames/page.tsx`** (update):
  - Use `FrameEditor` for creating/editing frames.
  - Frame list, category selector, active toggle, sort order.
- **`apps/merchant-admin/app/dashboard/branding/page.tsx`** (update):
  - Add inputs for `appName`, `appTagline`, `tickerText`.
  - Rename "Text color" label to "Foreground".
  - Show live preview of branding changes.
  - Save to `/api/branding` (POST).

### 10. Shared UI Package
File: `packages/ui/src/components/frame-preview.tsx` (new)

- `FramePreview` component to render a `Frame`/`FrameConfig` as a visual thumbnail.
- Used by both merchant-admin (frame list) and booth (frame selector).

## Verification Checklist
- [ ] `pnpm turbo typecheck` passes with no new errors.
- [ ] `pnpm turbo lint` passes.
- [ ] Booth app starts and loads branding from `data/branding.json`.
- [ ] Booth app renders frames from `data/frames.json`.
- [ ] Merchant admin branding page saves to `data/branding.json`.
- [ ] Merchant admin frame editor creates/updates frames in `data/frames.json`.
- [ ] Frame elements (photo slots, titles, stickers) render correctly in `FinalStrip`.
