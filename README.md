# Sunny ☀️

A personal affirmation app for iPhone. You install it from Safari to your Home Screen, write your own affirmations, and pick reminder times. At those times Sunny sends a random affirmation as a real iOS notification, even when the app is closed.

It runs entirely on the **Cloudflare free plan**: one Worker serves the app and the API, stores data in D1, and a cron job checks reminders every minute. No App Store, no Apple Developer account, nothing to pay for.

Live: **https://sunny.sunny-worker.workers.dev**

### Changes from BUILD_PROMPT.md

- **No passcode and no onboarding.** Opening Sunny goes straight to Today. The API has no login, so anyone who knows the Worker URL can read and change your affirmations and reminders. Keep the URL to yourself. Test notifications are rate-limited to one every 10 seconds.
- The starter affirmations and reminders are inserted by the first D1 migration.
- Notifications are turned on from **Settings → Notifications → Turn on**. The install guide is in Settings.
- The VAPID subject is the site URL (not an email), so no personal email is in the repo.

## How it works

```
sunny/
├── web/       React + Vite PWA → web/dist
│   └── public/  manifest, sw.js (offline shell, push, notification tap), icons, _headers
├── worker/    Cloudflare Worker
│   ├── src/index.ts      fetch (API + static assets) and scheduled (cron) handlers
│   ├── src/api.ts        /api routes
│   ├── src/push.ts       Web Push: RFC 8291 encryption + RFC 8292 VAPID, WebCrypto only
│   ├── src/scheduler.ts  every-minute reminder check
│   └── migrations/       D1 schema + starter data
├── shared/    vibes, icons, payload builder, API types (used by web and worker)
└── scripts/   generate-vapid.mjs, generate-icons.mjs
```

- **Reminders:** every minute the cron converts "now" to your timezone (default Asia/Kolkata). Each active reminder whose time is now, or up to 2 minutes ago, and whose day is switched on, gets sent once per day. It picks a random active affirmation (avoiding the last one sent) and pushes it to every subscribed device. Dead subscriptions (404/410) are removed.
- **Tapping a notification** opens Sunny on the Moment screen with that affirmation. If Sunny is open when a reminder arrives, you also get the in-app banner.
- **Offline:** the app shell is cached by the service worker and your data by the app, so you can read your affirmations offline. Changes need a connection; you'll see a message if you're offline.

## Setup and deploy (from scratch)

### 1. Prerequisites

- Node 20 or newer (npm 11 recommended: `npm i -g npm@11`)
- A free Cloudflare account with a verified email address
- An iPhone on iOS 16.4 or newer

```sh
npm install
cd worker
npx wrangler login
```

### 2. Database

```sh
cd worker
npx wrangler d1 create sunny
# Copy the printed database_id into worker/wrangler.toml
npm run db:migrate:local
npm run db:migrate:remote
```

### 3. Push keys (VAPID)

```sh
node scripts/generate-vapid.mjs --dev-vars   # prints the keys, writes worker/.dev.vars (git-ignored)
```

- Put `VAPID_PUBLIC_KEY` into `worker/wrangler.toml` under `[vars]`, and set `VAPID_SUBJECT` to your site URL (or a `mailto:` address).
- Store the private key as a Cloudflare secret. It is never committed:

```sh
cd worker
npx wrangler secret put VAPID_PRIVATE_KEY   # paste the private key when asked
```

If you ever generate new keys, every phone has to turn notifications on again. The app does this automatically on its next launch.

### 4. Build and deploy

```sh
npm run build              # builds web/dist
cd worker && npx wrangler deploy
```

`npm run deploy` from the root does both. Remember `npm run db:migrate:remote` (in `worker/`) whenever a new migration is added.

### 5. Install on iPhone

1. Open the URL in **Safari** (not Chrome or another app's browser).
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open Sunny **from the Home Screen icon**.
4. Go to **Settings → Notifications → Turn on**, then tap **Allow**.
5. Tap **Send** next to Test notification, lock your phone, and wait a few seconds.

### 6. Troubleshooting

**No notifications**

- Check that you're on iOS 16.4 or newer (Settings → General → About).
- Open Sunny from the **Home Screen icon**, not a Safari tab. Push only works in the installed app.
- iPhone **Settings → Notifications → Sunny**: Allow Notifications on, Lock Screen and Banners on.
- A **Focus** mode (Sleep, Do Not Disturb, Work) may be hiding them. Allow Sunny in that Focus, or turn it off.
- In Sunny, Settings → Notifications should say **Allowed**. If it says **Off**, notifications were denied; turn them on in iPhone Settings (above).
- Reminders fire at the minute set in **Asia/Kolkata** time, and only on the days switched on.
- To see what the server does, run `cd worker && npx wrangler tail` while a reminder is due.

**Deleted the Home Screen icon?** Add it again from Safari (step 5), open it, and tap **Turn on** again. Your affirmations and reminders are safe on the server. The old subscription is removed automatically the first time a push to it fails.

**"You just sent a test"**: tests are limited to one every 10 seconds.

### 7. Local development

In two terminals:

```sh
npm run dev:worker   # wrangler dev on http://localhost:8787 (API + local D1 + web/dist)
npm run dev:web      # Vite on http://localhost:5173, proxies /api to 8787
```

- Run `npm run db:migrate:local` in `worker/` once before the first `dev:worker`.
- To start over, run `npm run db:reset:local` in `worker/` (stop `dev:worker` first).
- **On your phone over Wi-Fi:** `npm run dev:phone` instead of `dev:web`, then open `http://<your-Mac's-IP>:5173` (no Home Screen app or push, because that needs HTTPS).
- **Push on desktop:** `npm run build`, then open http://localhost:8787 in Chrome and use Settings → Turn on. Service workers and push work on `localhost`.
- **Trigger the cron by hand:** `curl "http://localhost:8787/cdn-cgi/handler/scheduled"`.
- **Jump to a screen in dev:** `http://localhost:5173/?screen=today|affs|reminders|settings|install|moment|banner`.

Other commands (from the root):

```sh
npm test             # Vitest: scheduler, payload, Web Push crypto, validation
npm run typecheck
npm run lint
npm run format
node scripts/generate-icons.mjs   # re-render the app icons
```

## Deploy checklist

- [ ] `npm run typecheck && npm run lint && npm test` pass
- [ ] New migrations applied: `cd worker && npm run db:migrate:remote`
- [ ] `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` in `wrangler.toml`; `VAPID_PRIVATE_KEY` set with `wrangler secret put`
- [ ] `npm run deploy`
- [ ] Open the live URL: Today loads, and adding an affirmation survives a reload
- [ ] From the Home Screen app: Settings → Send → the notification arrives on the lock screen
- [ ] Tap the notification → Moment screen with that affirmation

## Auto-deploy from GitHub (optional)

In the Cloudflare dashboard: **Workers & Pages → sunny → Settings → Builds → Connect**, choose this GitHub repo and branch `main`, then set:

- Root directory: `/`
- Build command: `npm ci && npm run build`
- Deploy command: `cd worker && npx wrangler deploy`

Every push to `main` then deploys automatically (free tier). Migrations still need `npm run db:migrate:remote` by hand.

## Cost

Everything here is on free tiers: Cloudflare Workers, D1, cron, and static assets; Apple's Web Push; and GitHub. With no payment method on the Cloudflare account, nothing can be charged. If a free limit were ever hit, requests would fail for the day instead of costing money.
