# Task: Wire "Photobooth for Two" (WebRTC date sessions) into existing photobooth app

## What this adds

A new flow alongside your existing single-device photobooth: two people on a
video call take a synchronized photo together, composited into one frame,
using your existing frame/overlay system. Built on WebRTC (P2P video) +
a small Rust signaling relay (deployed separately on Coolify) + Next.js
pages/components (deployed on Vercel with the rest of the app).

No video/audio ever touches your servers — the relay only shuttles the
initial handshake (SDP/ICE) and disconnects from the data path once the
P2P connection is live.

---

## 0. Prerequisites / decisions before starting

- [ ] Confirm target route: this doc assumes `/date` and `/date/[roomId]`.
      Rename if it collides with existing routes.
- [ ] Confirm you want single-use rooms (current behavior — a new
      `/date` visit always makes a fresh room) vs. persistent/rejoinable
      rooms. Single-use is what's implemented; flag if you want rejoin support.
- [ ] Decide TURN server now or later (see step 5). Fine to ship with
      STUN-only first and add TURN if users report connection failures.

---

## 1. Deploy the signaling relay (Coolify)

Files: `signal-relay/` (Cargo.toml, src/main.rs, Dockerfile)

- [ ] Add `signal-relay/` as its own directory in a repo Coolify can build
      from (either a new repo, or a subfolder of your monorepo — point
      Coolify's build context at that subfolder).
- [ ] Create new Coolify resource → Dockerfile-based build → point at
      `signal-relay/Dockerfile`.
- [ ] Assign a domain, e.g. `relay.yourdomain.com`. Let Coolify/Traefik
      issue the TLS cert — **this must be `wss://`, not `ws://`**, or
      Vercel's `https://` pages will block it as mixed content.
- [ ] Confirm port `8787` is routed through that domain (Coolify handles
      this once the domain is attached to the service).
- [ ] Smoke test: `wscat -c wss://relay.yourdomain.com/ws/test-room/test-peer`
      should connect without erroring.

---

## 2. Add env var on Vercel

- [ ] In the Next.js project's Vercel settings, add:
      ```
      NEXT_PUBLIC_SIGNAL_URL=wss://relay.yourdomain.com
      ```
- [ ] Add the same to local `.env.local` pointing at `ws://localhost:8787`
      for dev (run the relay locally with `cargo run` while developing).

---

## 3. Drop in the Next.js files

Files: `nextjs-client/` (lib/, components/, app/date/)

- [ ] Copy `lib/useDatePeerConnection.ts` → your `lib/` (or `src/lib/`)
- [ ] Copy `lib/roomSession.ts` → same location
- [ ] Copy `components/DatePhotobooth.tsx` → your `components/`
- [ ] Copy `app/date/page.tsx` and `app/date/[roomId]/page.tsx` → your
      `app/` directory
- [ ] Fix the `@/lib/...` and `@/components/...` import aliases if your
      `tsconfig.json` paths config differs
- [ ] Confirm Tailwind classes resolve — component uses plain utility
      classes (no custom theme tokens), should work as-is if Tailwind is
      already configured

---

## 4. Wire in your existing frame/overlay system

This is the main integration work — `DatePhotobooth.tsx` currently draws
a minimal placeholder frame (thin border + timestamp) directly in
`captureFrame()`. Replace that with your real system:

- [ ] Locate your existing frame overlay logic from the main photobooth
      app (the 24-frame / four-layout-type system) — likely a canvas
      drawing function or set of overlay image assets.
- [ ] In `captureFrame()`, after `drawCoverVideo()` calls for both panes,
      replace the "Editorial frame chrome" block with a call into your
      existing overlay renderer, passing the canvas context.
- [ ] Decide which of your 24 frames apply to a *two-person side-by-side*
      layout specifically — the two-pane layout here (`FRAME.width /
      FRAME.height` split) may only match a subset of your existing
      frame types. You may want a new frame category for "duo" shots
      rather than reusing single-subject frames.
- [ ] If your existing app also does GIF generation: `captureFrame()`
      currently grabs a single still. To reuse your GIF pipeline, change
      the capture trigger to grab a short burst of composited frames
      (e.g. every 150ms for 1.5s post-countdown) into an array, then feed
      that array to your existing GIF encoder instead of `canvas.toDataURL()`.
- [ ] Confirm output resolution/aspect ratio matches what your existing
      download/share flow expects (currently `1280x480` hardcoded in
      `FRAME` constant in `DatePhotobooth.tsx` — adjust to match your
      other frame dimensions if they need to be consistent).

---

## 5. Production hardening (do before real users, not required for demo)

- [ ] **TURN server**: STUN-only (current default, `stun:stun.l.google.com:19302`)
      will fail for users behind restrictive NAT/corporate VPNs. Add a
      TURN server — either self-hosted `coturn` (can live on the same
      Coolify box as the relay) or a hosted option (Cloudflare, Twilio).
      Update `ICE_SERVERS` in `useDatePeerConnection.ts`.
- [ ] **Room cleanup**: relay already removes empty rooms from memory on
      disconnect (`src/main.rs`, `handle_socket`). No persistent storage
      involved, so no cleanup job needed — but if you later add room
      metadata (e.g. matching to user accounts), that lives in your main
      app's DB, not the relay.
- [ ] **Rate limiting / abuse**: relay currently accepts any `roomId`/
      `peerId` pair with no auth. If room links could be guessed or
      shared beyond the intended two people, consider signing room
      tokens (e.g. short-lived JWT minted by your Next.js backend when
      a session starts) and validating them in the relay's WS handler.
- [ ] **CORS**: relay currently uses `CorsLayer::permissive()` — fine for
      launch, but tighten to your exact Vercel domain(s) once stable.

---

## 6. Testing checklist

- [ ] Two browser tabs (or two devices) on the same `/date/[roomId]` link
      connect and both video feeds render
- [ ] "take photo together" triggers countdown on **both** sides
      simultaneously (data channel sync)
- [ ] Captured image shows both panes correctly composited, correct
      left/right assignment (host = left, guest = right)
- [ ] Refreshing either tab mid-session doesn't break the connection or
      reassign roles (sessionStorage persistence)
- [ ] Third person opening the same link gets "room full" message, not
      allowed to join
- [ ] One person closing the tab shows "your date left" on the other side
- [ ] Test across different networks (not just same wifi) to catch
      NAT traversal issues before adding TURN

---

## Known gaps / not yet built

- No mobile-specific camera handling (front/back camera switch) — uses
  `facingMode: "user"` only
- No reconnect-after-drop logic — a network blip currently requires a
  fresh page load
- No waiting-room UI polish (e.g. showing the local preview while
  waiting for the other peer to join — currently just shows status text)
- No analytics/logging on session starts, completions, or drop-off