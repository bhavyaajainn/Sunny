# Sunny ☀️

A personal affirmation app for iPhone. You install it from Safari to your Home Screen. You write your own affirmations and choose reminder times, and Sunny sends a random affirmation as a real iOS notification, even when the app is closed.

It runs entirely on the Cloudflare free plan: one Worker serves the app, the API, a D1 database and a cron job that runs every minute. No App Store, no Apple Developer account, nothing to pay for.

> **Status:** Phase 3 (API). Steps marked _(later phase)_ don't work yet.

### Changes from BUILD_PROMPT.md

- **No passcode and no onboarding.** Opening Sunny goes straight to Today. The API has no login, so anyone who knows the Worker URL can read and change your affirmations and reminders, and can trigger test notifications. Keep the URL to yourself.
- The starter affirmations and reminders are inserted by the first D1 migration.
- Notifications are turned on from Settings → Notifications → **Turn on**. The install guide is in Settings.

## Project layout

```
sunny/
├── web/        React + Vite + TypeScript PWA (builds to web/dist)
├── worker/     Cloudflare Worker: API, static assets, cron, D1 migrations
├── shared/     Constants used by both sides: vibes, icons, seed data, API types
├── scripts/    generate-vapid.mjs, generate-icons.mjs (later phase)
└── design/     Prototype and screenshots (source of truth for the UI)
```

## 1. Prerequisites

- Node 20 or newer
- A free Cloudflare account
- An iPhone on iOS 16.4 or newer

```sh
npm install
cd worker
npx wrangler login
```

## 2. Database

```sh
cd worker
npx wrangler d1 create sunny
# Copy the printed database_id into worker/wrangler.toml
npm run db:migrate:local
npm run db:migrate:remote
```

## 3. Push keys _(later phase)_

```sh
node scripts/generate-vapid.mjs
# Put VAPID_PUBLIC_KEY and VAPID_SUBJECT into worker/wrangler.toml [vars], then:
cd worker && npx wrangler secret put VAPID_PRIVATE_KEY
```

## 4. Build and deploy

```sh
npm run build            # builds web/dist
cd worker && npx wrangler deploy
```

(`npm run deploy` from the root does both.)

## 5. Install on iPhone _(later phase)_

Open the Worker URL in **Safari** → Share → **Add to Home Screen** → open Sunny from its icon → follow onboarding.

## 6. Troubleshooting _(later phase)_

## 7. Local development

In two terminals:

```sh
npm run dev:worker   # wrangler dev on http://localhost:8787 (API + local D1)
npm run dev:web      # Vite on http://localhost:5173, proxies /api to 8787
```

Run `npm run db:migrate:local` in `worker/` once before the first `dev:worker`. To start over from onboarding, run `npm run db:reset:local` in `worker/` (stop `dev:worker` first) and clear the site data in your browser.

Other commands (from the root):

```sh
npm test             # Vitest (worker + shared)
npm run typecheck
npm run lint
npm run format
```
