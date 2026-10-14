# Photobooth API Gateway

Standalone gateway for the Photobooth app. It caches safe reads from the Next.js API, keeps a shared HTTP connection pool, and fronts AI frame generation plus generic chat completions.

The Next app keeps working without this process. Point it here only when you want AI, or the whole `/api` surface, to go through the gateway.

## Run

```bash
cd gateway
cp .env.example .env
npm install
npm run dev
```

From the repo root: `npm run gateway`.

Default listen address is `http://127.0.0.1:8788`.

## Routes

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/health` | Process, cache size, counters |
| `GET` | `/ready` | Upstream reachability |
| `POST` | `/v1/generate` | Photobooth frame generation |
| `GET` | `/v1/generate` | Daily prompt usage for the caller |
| `GET`/`POST` | `/api/frames/ai-agent` | Same contract as `/v1/generate` |
| `POST` | `/v1/ai/chat` | Gemini or OpenAI-compatible chat |
| `ALL` | `/api/*` | Reverse proxy to `UPSTREAM_ORIGIN` |
| `GET`/`DELETE` | `/v1/cache` | Admin cache stats and purge |

`GET /api/frames` and `GET /api/events` (including one id or slug) are cached. Other methods and paths are proxied without a stored body. Identical in-flight cache misses share one upstream call. Fresh entries are served immediately; expired entries are served once more while a refresh runs in the background.

Frame generation caches a successful result by prompt, model, history, and client-key fingerprint. A repeat does not call the provider again and does not consume another daily prompt. Send `Idempotency-Key` to pin a retry to the same result for one hour. `auto` tries the configured provider, then any other provider that has its own key, then the built-in frame engine. A named provider does not silently switch.

Chat accepts `{ provider, model, messages, temperature, stream, cache }`. `stream: true` is passed through for OpenAI-compatible providers and is not cached.

## Auth

- Session token or cookie: `pika_session` cookie or `Authorization: Bearer <sessionToken>` (verified against Postgres `sessions` or upstream `/api/auth/me`)
- Master key: `x-api-key` or `Authorization: Bearer <GATEWAY_API_KEY>`

Master keys and emails in `ADMIN_EMAILS` skip the daily frame limit. Everyone else gets `AI_DAILY_LIMIT` successful generations per UTC day (default 3). Cached repeats are free.

## Wire the app

AI only:

```bash
NEXT_PUBLIC_AI_GATEWAY_URL=http://127.0.0.1:8788
```

The frame designer then calls `POST /v1/generate`.

Whole API, with this process proxying the Next app and handling AI itself:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8788
UPSTREAM_ORIGIN=http://127.0.0.1:3000
```

Provider keys (`AI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`) stay on the gateway. Leave `ALLOW_CLIENT_AI_KEYS=true` if the frame designer should still be allowed to send a key from its settings.

## Deploy

`gateway/Dockerfile` listens on 8788. Set the same environment variables as `.env.example`. Do not bake API keys into the image.
