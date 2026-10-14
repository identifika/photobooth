# Task: Move Firebase onto our own API

Work top to bottom. Finish a domain, check it in the browser, then start the next one. Do not start Firebase Auth removal until every data domain below is reading and writing Postgres through the API.

Postgres is the database. Next.js route handlers are the API. The browser calls those routes with `getApiUrl()`. Prisma stays on the server. The gateway in `gateway/` only caches and forwards; it is not a second database.

Firebase Auth stays in place through the data migration. API routes keep accepting `Authorization: Bearer <Firebase ID token>` until the auth phase.

## Already done

- [x] Prisma schema covers events, captures, frames, filters, backgrounds, publish requests, API keys, studio settings (`prisma/schema.prisma`)
- [x] `AiDailyUsage` model and migration `20261014020600_ai_daily_usage` applied on Neon
- [x] `prisma.config.ts` uses the direct Neon host for `pnpm db:migrate` (the app still uses pooled `DATABASE_URL` in `lib/db.ts`)
- [x] Upload, share, presign, and TURN credentials already skip Firestore (`app/api/upload`, `app/api/share`, `app/api/presign`, `app/api/turn-credentials`)

## Rules for every domain

- [ ] Add or extend the route under `app/api/` so the browser never imports `lib/firestore.ts` for that domain
- [ ] Implement the route with `prisma` from `lib/db.ts`. Preserve the existing JSON field names the UI already expects
- [ ] On import, store the Firestore document id in the row `id` so `/e/[slug]`, frame links, and saved ids keep working
- [ ] Authorize with the current `verifyAuthOrApiKey` / `verifyIdToken` helpers. A user may only change their own rows. Admin emails stay `ADMIN_EMAILS`
- [ ] Point the page or hook at `fetch(getApiUrl(...))`. Leave the Firestore helper in place until that domain's checklist is complete, then delete the unused calls
- [ ] After a write, confirm a following read comes from Postgres. Gateway `GET /api/frames` and `GET /api/events` are cached, so test writes with the gateway bypassed or after the cache TTL

## 0. Import existing Firestore documents

Do this once per collection, before flipping that collection's reads to Postgres. Skip a collection that has no production data.

- [ ] Script reads Firestore with a service account (server only) and upserts into Postgres by document id
- [ ] Collections, in this order: `public_settings/studio`, `api_keys`, `user_api_keys`, `user_frames`, `public_frames`, `user_filters`, `public_filters`, `user_backgrounds`, `public_backgrounds`, `publish_requests`, `events`, `events/{id}/captures`, `ai_daily_usage`
- [ ] `user_api_keys` and `api_keys` both land in `ApiKey`. Skip a duplicate `key` string
- [ ] `ai_daily_usage` document id `{uid}_{YYYY-MM-DD}` maps to `uid` + `usageDate`
- [ ] Event captures keep `eventId` pointing at the imported event id
- [ ] Re-run the script and confirm it updates rows instead of duplicating them

## 1. Studio settings

Smallest public read. Proves the path from Postgres to the browser.

Firestore today: `public_settings/studio` via `hooks/useStudioSettings.ts`.

- [ ] `GET /api/settings` returns `{ studioName, studioLogo, tagline }`, falling back to the defaults in `useStudioSettings`
- [ ] `PUT /api/settings` updates the single `StudioSettings` row (`id = "studio"`). Admin only
- [ ] `hooks/useStudioSettings.ts` loads and saves through that route
- [ ] Check the header, login, settings, editor, frames, and admin reviews still show the studio name
- [ ] Remove the `fsGetDocument` / `fsUpdateDocument` calls from the hook

## 2. API keys

`lib/auth-server.ts` still asks Firestore whether a `pk_live_` key is valid. Do this before other routes rely on API-key auth against Postgres.

Firestore today: `api_keys`, `user_api_keys` in `app/api/keys/route.ts`, `lib/api-keys.ts`, `lib/auth-server.ts`.

- [ ] Rewrite `GET`, `POST`, and `DELETE /api/keys` to use `ApiKey`
- [ ] `verifyAuthOrApiKey` looks up `ApiKey` by `key` where `active` is true, and sets `lastUsedAt`
- [ ] Settings page (`app/settings/page.tsx`) lists, creates, and deletes keys through `/api/keys` instead of `lib/api-keys.ts` Firestore calls
- [ ] A request with `x-api-key` still reaches `GET /api/events` and `GET /api/frames`
- [ ] Remove Firestore from `lib/api-keys.ts` and `lib/auth-server.ts`

## 3. Frames

Firestore today: `lib/user-frames.ts`, `lib/public-frames.ts`, `lib/frames.ts` (`loadPublicFrames`). Routes that already exist still call those helpers: `GET /api/frames`, `GET /api/frames/[id]`.

Callers: `hooks/useFrames.ts`, `app/editor/page.tsx`, `app/frames/page.tsx`, `app/settings/page.tsx`, `app/e/[slug]/page.tsx`, `app/seed/page.tsx`, `components/FrameSelector.tsx`.

- [ ] `GET /api/frames` and `GET /api/frames/[id]` read `UserFrame` and `PublicFrame`
- [ ] `POST /api/frames`, `PATCH /api/frames/[id]`, `DELETE /api/frames/[id]` for the signed-in user's frames
- [ ] `GET /api/frames/public`, `PATCH /api/frames/public/[id]`, `DELETE /api/frames/public/[id]` for public frames. Owner or admin, matching `updatePublicFrameAsOwner` and `deletePublicFrame`
- [ ] Switch `loadPublicFrames`, `useFrames`, the editor, the frames page, settings, the event booth, and the seed page to these routes
- [ ] Create a frame, reload, edit it, delete it. Open a public frame as a guest
- [ ] Remove Firestore from `lib/user-frames.ts` and `lib/public-frames.ts`

## 4. Filters

Firestore today: `lib/user-filters.ts`, `lib/public-filters.ts`.

Callers: `hooks/useFilters.ts`, `app/filters/page.tsx`, `app/filter-editor/page.tsx`, `app/settings/page.tsx`.

- [ ] `GET` and `POST /api/filters`, `GET`, `PATCH`, and `DELETE /api/filters/[id]`
- [ ] `GET /api/filters/public`, plus owner/admin update and delete
- [ ] Switch the filters page, filter editor, settings, and `useFilters` to these routes
- [ ] Create, edit, and delete a filter, then reload
- [ ] Remove Firestore from both filter libs

## 5. Backgrounds

Firestore today: `lib/user-backgrounds.ts`, `lib/public-backgrounds.ts`.

Callers: `hooks/useBackgrounds.ts`, `components/BackgroundSelector.tsx`, `components/MyBackgrounds.tsx`.

Image bytes already go to S3 through `/api/upload` and `/api/presign`. This phase only moves the background records.

- [ ] `GET` and `POST /api/backgrounds`, `DELETE /api/backgrounds/[id]`
- [ ] `GET /api/backgrounds/public` and owner/admin delete
- [ ] Switch `useBackgrounds`, `BackgroundSelector`, and `MyBackgrounds` to these routes
- [ ] Upload a background, see it in the selector, delete it
- [ ] Remove Firestore from both background libs

## 6. Publish requests

Depends on frames, filters, and backgrounds already being in Postgres. `approvePublishRequest` copies a user asset into the public table.

Firestore today: `lib/publish-requests.ts`.

Callers: `hooks/useFrames.ts`, `app/editor/page.tsx`, `app/frames/page.tsx`, `app/filters/page.tsx`, `app/admin/reviews/page.tsx`, `app/settings/page.tsx`, `components/MyBackgrounds.tsx`, `components/BackgroundSelector.tsx`.

- [ ] `POST /api/publish-requests` with `type` of `frame`, `filter`, or `background`
- [ ] `GET /api/publish-requests` for the signed-in user's requests
- [ ] `GET /api/publish-requests?status=pending` for admins
- [ ] `POST /api/publish-requests/[id]/approve` and `POST /api/publish-requests/[id]/reject`
- [ ] Approve still creates the matching `PublicFrame`, `PublicFilter`, or `PublicBackground`
- [ ] Switch the editor, frames, filters, backgrounds, settings, and `/admin/reviews` to these routes
- [ ] Submit a frame, approve it as admin, and see it in the public list
- [ ] Remove Firestore from `lib/publish-requests.ts`

## 7. Events and the live gallery

Firestore today: `lib/events.ts`, plus a direct `fsUpdateDocument` in `app/api/events/[slug]/route.ts`. The gallery subscribes with `onSnapshot` in `subscribeToEventCaptures`.

Callers: `hooks/useEvents.ts`, `app/events/page.tsx`, `app/events/new/page.tsx`, `app/events/[id]/page.tsx`, `app/e/[slug]/page.tsx`, `app/e/[slug]/gallery/page.tsx`.

Routes that already exist: `GET` and `POST /api/events`, `GET` and `PATCH /api/events/[slug]`.

- [ ] Those four handlers read and write `Event` through Prisma. Delete the `fsUpdateDocument` call
- [ ] `POST /api/events/[slug]/captures` creates an `EventCapture`
- [ ] `GET /api/events/[slug]/captures` returns captures newest first
- [ ] Event list, create, edit, and delete screens call the API instead of `lib/events.ts`
- [ ] The booth page loads the event by slug from the API
- [ ] Replace `subscribeToEventCaptures` on the gallery page with polling of `GET /api/events/[slug]/captures` every few seconds while the gallery is open
- [ ] Create an event, open `/e/[slug]`, save a capture, and see it show up on the gallery without a refresh
- [ ] Remove Firestore and `onSnapshot` from `lib/events.ts`

## 8. AI daily usage

The table exists. The Next.js AI route still writes Firestore `ai_daily_usage`, and the gateway keeps the count in memory.

- [ ] `GET` and `POST /api/frames/ai-agent` read and increment `AiDailyUsage` for `uid` + today's UTC `usageDate`
- [ ] A cache hit does not increment `count`. A failed provider call does not increment `count`
- [ ] Admins (`ADMIN_EMAILS`) stay unlimited
- [ ] Gateway `POST /v1/generate` uses the same Postgres table when `DATABASE_URL` is set, and keeps the in-memory counter only as a fallback when it is not
- [ ] Send three prompts as a non-admin and confirm the fourth returns 429. Repeat the same prompt and confirm the cached result does not add another count
- [ ] Delete the Firestore REST usage helpers in `app/api/frames/ai-agent/route.ts`

## 9. Firebase Auth

Start this only after sections 1–8 are done. Until then, `uid` on every row is still a Firebase user id.

Today: `lib/firebase.ts`, `hooks/useAuth.tsx` (web Google popup, email, password, and Capacitor `FirebaseAuthentication`), `lib/auth-client.ts`, `lib/auth-server.ts` (`accounts:lookup`), `gateway/src/auth.ts`, and `EmailAuthProvider` / `linkWithCredential` on `app/settings/page.tsx`.

- [ ] Add a `User` model (`id`, `email`, `name`, `passwordHash`, `googleSub`) and a session model. New users get an id; imported users keep their current Firebase `uid` as `id` so existing rows still match
- [ ] `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- [ ] Google sign-in goes through our OAuth callback and sets the same session cookie
- [ ] Web `useAuth` exposes `{ id, email, name }` from `/api/auth/me` instead of a Firebase `User`
- [ ] `getClientAuthToken` sends the session cookie (web) or a bearer session token (native). Route handlers accept that credential
- [ ] Replace Capacitor Firebase Authentication on iOS and Android with the same email and Google endpoints
- [ ] Settings page account linking no longer uses `linkWithCredential`
- [ ] Gateway auth verifies our session instead of `identitytoolkit.googleapis.com`
- [ ] Sign in, refresh, sign out, and call `/api/frames` on web. Repeat on a device build

## 10. Remove Firebase

Do this last, when nothing imports the SDK.

- [ ] Delete `lib/firestore.ts` and `lib/firebase.ts`
- [ ] Remove `firebase` and `@capacitor-firebase/authentication` from `package.json` and the `FirebaseAuthentication` block in `capacitor.config.ts`
- [ ] Remove `NEXT_PUBLIC_FIREBASE_*` from the app and from the gateway's token lookup
- [ ] `app/api/proxy-image/route.ts` can drop the `firebasestorage.googleapis.com` and `.firebasestorage.app` allowlist once no saved image URL uses them
- [ ] Search the repo for `firestore`, `firebase/auth`, and `identitytoolkit` and confirm the only remaining hits are this checklist or comments you still want
- [ ] `pnpm db:migrate` still applies cleanly, and `pnpm build` succeeds

## Done when

- [ ] A new account can sign in, create a frame, an event, a filter, and a background, publish one, and see a gallery capture, with the network tab showing only our `/api` routes
- [ ] Restarting the gateway does not reset a user's AI daily count
- [ ] No client component imports `lib/firestore.ts`
