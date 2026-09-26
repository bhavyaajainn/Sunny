# Build "Sunny" — a personal affirmation PWA for iPhone

You are building a production-ready personal app for me (single user). Read this whole file first, then open `design/sunny-prototype.html` in a browser and look at every image in `design/screenshots/`. **The prototype is the source of truth for layout, colors, copy, icons and animations. Match it closely.** Reuse its CSS, SVG icons and animation keyframes directly rather than re-inventing them.

Work in the phases listed at the end. After each phase, stop, summarize what you did, and tell me how to verify it.

---

## 1. Goal and hard constraints

- An affirmation app I install on my iPhone from Safari via **Share → Add to Home Screen** (a PWA).
- I write my own affirmations and set reminder times. At those times I get **real iOS notifications** with a random affirmation, even when the app is closed.
- **Completely free.** No Apple Developer account, no App Store, no paid services, no payment code of any kind. Everything runs on the **Cloudflare free plan**.
- **Deploy once and forget.** No weekly re-installs, no manual maintenance.
- Requires iOS 16.4+ (Web Push for Home Screen web apps).
- Timezone: **Asia/Kolkata (IST)** by default, stored as a setting.

## 2. Architecture

One Cloudflare Worker serves everything:

```
sunny/
├── web/                 React + Vite + TypeScript PWA (builds to web/dist)
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   ├── sw.js        service worker (push + notificationclick + app-shell cache)
│   │   └── icons/       apple-touch-icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png
│   └── src/
├── worker/              Cloudflare Worker (TypeScript)
│   ├── src/index.ts     fetch handler (API + static assets) and scheduled handler (cron)
│   ├── src/push.ts      Web Push (VAPID + RFC 8291 encryption) using WebCrypto only
│   ├── migrations/      D1 SQL migrations
│   └── wrangler.toml
├── scripts/
│   ├── generate-vapid.mjs
│   └── generate-icons.mjs
└── README.md            exact setup + deploy steps
```

- **Static assets:** use Workers static assets (`[assets] directory = "../web/dist"`, SPA fallback to index.html) so frontend and API deploy with a single `wrangler deploy` on one HTTPS URL.
- **Database:** Cloudflare D1 (free tier).
- **Scheduler:** a Cron Trigger running **every minute** (`* * * * *`).
- **Push:** standard Web Push with VAPID keys I generate myself. The private key is stored as a Wrangler secret (`VAPID_PRIVATE_KEY`), and the public key and subject (`mailto:`) are vars.
- **Do not use the `web-push` npm package** because it depends on Node crypto and won't run on Workers. Use a WebCrypto-based Web Push library that is confirmed to work on the Workers runtime, or implement RFC 8291 (aes128gcm payload encryption) and RFC 8292 (VAPID JWT, ES256) with `crypto.subtle` yourself. Verify with a real push to an iPhone.
- Frontend libraries: React 18, TypeScript, Vite, `vite-plugin-pwa` is optional (a hand-written `sw.js` is fine and often simpler for push). No UI kit; port the prototype's CSS.

## 3. Data model (D1)

```sql
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  vibe TEXT NOT NULL DEFAULT 'sunny',          -- 'hype' | 'sunny' | 'calm'
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  theme TEXT NOT NULL DEFAULT 'system',        -- 'light' | 'system' | 'dark'
  passcode_hash TEXT,                          -- PBKDF2-SHA256, with salt + iterations
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE affirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'sun',            -- sun|sprout|flower|heart|star|rainbow|cloud|moon
  active INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT NOT NULL,                          -- 'HH:MM' 24h in settings.timezone
  label TEXT NOT NULL,
  days TEXT NOT NULL DEFAULT '1111111',        -- Mon..Sun
  active INTEGER NOT NULL DEFAULT 1,
  last_sent_on TEXT                            -- 'YYYY-MM-DD' local date, prevents duplicates
);
CREATE TABLE subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Seed on first setup with the 6 affirmations (and their icons) and 3 reminders from the prototype: 07:30 Morning boost (every day, on), 13:00 Midday reset (Mon–Fri, on), and 21:30 Wind down (every day, off).

## 4. API (all JSON, under `/api`)

Auth: single user. `POST /api/setup` is allowed only while `passcode_hash` is null. `POST /api/login` checks the passcode. Both return a random session token. The client stores it in `localStorage` and sends `Authorization: Bearer <token>`. Store only a SHA-256 hash of the token. Rate-limit login attempts (for example, 5 per 15 minutes, tracked in D1). Every other route needs a valid token.

| Method | Path | Purpose |
|---|---|---|
| GET | /api/status | `{ setupDone }` (public) |
| POST | /api/setup | `{ passcode }` → sets passcode, seeds data, returns token |
| POST | /api/login | `{ passcode }` → token |
| GET/PATCH | /api/settings | name, vibe, timezone, theme |
| POST | /api/passcode | change passcode `{ current, next }` |
| GET/POST | /api/affirmations | list / create `{ text, icon }` |
| PATCH/DELETE | /api/affirmations/:id | edit text/icon/active, delete |
| POST | /api/affirmations/:id/restore | undo delete (or re-create client-side with the same data) |
| GET/POST | /api/reminders | list / create `{ time, label, days }` |
| PATCH/DELETE | /api/reminders/:id | edit / toggle / delete |
| GET | /api/push/public-key | VAPID public key |
| POST | /api/push/subscribe | save subscription (upsert by endpoint) |
| POST | /api/push/test | send a notification right now (the "Send to lock screen" button) |

Validate input: affirmation text 1–200 chars, time `HH:MM`, days a 7-char `[01]` string, and icon/vibe/theme from their allowed sets.

## 5. Scheduler (cron, every minute)

1. Compute the current local date, weekday (Mon=0) and `HH:MM` in `settings.timezone` using `Intl.DateTimeFormat`.
2. Find active reminders where `time == HH:MM`, the day flag is `1`, and `last_sent_on != today`. For resilience, also catch reminders up to 2 minutes late that haven't been sent today.
3. For each one, pick a random **active** affirmation, avoiding the one sent last time if possible, then build the payload:
   - `title`: a random template from the current vibe (see §7), with `{n}` = name (fallback "friend") and `{l}` = the lowercased reminder label.
   - `body`: `${affirmation.text} ${vibeEmoji}`
   - `data`: `{ affirmationId, title, body, url: "/?moment=1" }`
4. Send to every subscription. On HTTP 404/410 delete that subscription, and log other failures.
5. Set `last_sent_on = today`.
6. Skip silently if there are no active affirmations.

## 6. PWA and iOS specifics (important)

- `manifest.webmanifest`: `name` "Sunny", `short_name` "Sunny", `display` "standalone", `start_url` "/", `theme_color` and `background_color` `#FFD23F`, and icons 192/512 plus maskable.
- In `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=default`, `apple-mobile-web-app-title=Sunny`, and `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`.
- **Icons:** generate PNGs from the prototype's gradient-sun app icon (`.appicon`: a 135° gradient `#FFE259 → #FF8A3D → #FF4E8A`, a cream sun disc with rays). Write it as an SVG and render it to PNG with `sharp` in `scripts/generate-icons.mjs`. This icon is what iOS shows on every notification, so make it look good at small sizes.
- **Install detection:** if not running standalone (`navigator.standalone !== true` and not `matchMedia('(display-mode: standalone)')`), show only the Install screen. Web Push on iOS works only from the Home Screen app.
- **Permission:** call `Notification.requestPermission()` **only inside a user tap handler** ("Turn on notifications"). Then `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` and POST the subscription. Re-send the subscription on every app launch in case it changed.
- **Service worker `push` handler:** always call `showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data, tag: 'sunny-' + Date.now() })`. iOS may revoke push for pushes that don't show a notification. If a visible client exists, also `postMessage({ type: 'reminder', ...data })` to it so the app shows the **in-app banner**.
- **`notificationclick`:** close the notification, then focus an existing client and `postMessage({ type: 'open-moment', ...data })`, or `clients.openWindow('/?moment=1&a=<id>&t=<encoded title>')`. The app then opens the **Moment** screen with that affirmation.
- Cache the app shell in the service worker so the app opens instantly and works offline for reading (writes need network; show a clear message if offline).
- Honor the safe areas exactly as in the prototype (`env(safe-area-inset-*)`).

## 7. Screens and behavior (match the prototype)

The design tokens come straight from the prototype's `:root`. The font is **Bricolage Grotesque** (400/600/800) from Google Fonts with a system-ui fallback. The palette is sun `#FFD23F`, flame `#FF6B2C`, plum `#2B1B3D`, card `#FFFBEA`, sky `#8FD3FF`. Include dark mode (the plum background tokens) and light/auto/dark switching. Respect `prefers-reduced-motion`, which must disable animations but keep all text visible.

**Onboarding (first run only), with a 3-step progress bar:**
1. **Install** (`01-install.png`): the spinning sun, the "Sunny" wordmark, and 3 steps. Shown whenever the app isn't standalone.
2. **Notifications** (`02`, `03`): a preview notification, "Turn on notifications" (real permission prompt), and a "Not now" link.
3. **Passcode** (`04`): a 4-digit keypad that sets the passcode via `/api/setup`. Later launches with no valid token show the same keypad in "Enter passcode" mode (`/api/login`), with a shake animation on a wrong code.

**Tabs:** Today, Affirmations, Reminders, Settings. The bottom bar is plum with a yellow active pill.

- **Today** (`05`, `16`): the greeting depends on the time of day plus the name, with a slowly spinning sun icon. There is **no streak**. The big cream card has the rotating sun disc, 4 bobbing doodles (cloud, star, heart, flower), the affirmation in large 800-weight type, **"I feel it ☀️"** (a burst of confetti plus icons, and a "Felt N times today" line counted per local day in localStorage), and **"Another one"** (random other active affirmation with a pop animation). The "Next reminder" row shows an icon by time of day (before 11 sun, before 16 flower, before 19 rainbow, otherwise moon) and taps through to Reminders.
- **Affirmations** (`06`–`09`): a heading with a bobbing sprout, and "N saved, M in rotation. Tap one to edit." Each card has an icon badge, the text (tap to edit), then in one centered row **the toggle followed by a trash button**. Deleting removes the card immediately and shows a toast "Affirmation deleted" with **Undo** for about 4.5s. The API delete is sent only after the toast expires, or use a restore endpoint. There's a floating "＋ Add affirmation" button. The add/edit bottom sheet has a textarea, an **icon picker** (8 icons), quick emoji buttons, and Cancel or Delete plus Save. The empty state is the sprout with "No affirmations yet. Tap "Add affirmation" to plant your first one."
- **Reminders** (`10`, `11`): cards with a time-of-day badge, the big time, the label, and M–S day dots, plus a toggle. "Add reminder" and tap-to-edit open a sheet with a time input, name, and day toggles. The **Notification vibe** segmented control (Hype 🔥 / Sunny ☀️ / Calm 🌙) saves to settings and updates the live preview. **"Send to lock screen"** calls `/api/push/test`, and **"Show in-app banner"** shows the banner locally.
- **Settings** (`12`): name, notification status (Allowed / Off, with guidance to enable it in iPhone Settings → Notifications → Sunny when denied), test notification, theme (Light / Auto / Dark), change passcode, and install guide.

**Moment screen** (`14`, shown after tapping a notification or the banner): a full-screen animated gradient in the vibe's colors, a glowing pulsing sun, 3 bobbing vibe icons, falling confetti and icons, the notification title, and the affirmation revealed word by word. "I said it out loud 🎉" bursts, counts as a "felt", and returns to Today with that affirmation. "Later" closes it.

**In-app banner** (`15`): drops in with a bounce, has a gradient in the vibe's colors, the app icon wiggles, a 6s shrinking progress bar, and tapping it opens the Moment screen.

**Vibes** (used by both the server and the client; keep them in one shared constants file):

| Vibe | Title templates | Body emoji | Gradient colors | Moment icons |
|---|---|---|---|---|
| hype | "🔥 Hey {n}, this one's for you!", "⚡ Power-up time, {n}!", "🚀 Say it out loud, {n}!" | 💪 | #FF4E8A, #FF8A3D, #7B2FF7 | star, heart, sun |
| sunny | "☀️ Your {l} is here", "🌻 A little sunshine for you, {n}", "✨ Pause for 5 seconds, {n}" | ☀️ | #FF9F1C, #FF5E3A, #E8356D | sun, flower, sprout |
| calm | "🌙 Breathe in, {n}", "🍃 A gentle reminder for you", "💛 Just for you, {n}" | 🌿 | #5EC8F2, #8B7CF6, #4A3A8C | moon, cloud, sprout |

Copy the 8 SVG icons exactly from the `ICONS` object in the prototype into a React `<Icon name="…" />` component.

Note: the iOS lock-screen notification look is controlled by iOS (frosted card, system sound). We control only the icon, title and body. All color and animation lives inside the app.

## 8. Quality bar

- TypeScript strict, ESLint + Prettier, no `any` in the API layer.
- Optimistic UI for toggles, edits and deletes, rolling back with an error toast on failure.
- Every error message says what happened and what to do.
- Accessible: focus rings, `role="switch"`/`aria-checked`, `aria-label` on icon-only buttons, 44px touch targets.
- No secrets in the repo. `.dev.vars.example` documents the required vars.
- Unit tests (Vitest) for the scheduler's time matching (timezone, day flags, dedupe, late catch-up) and for the payload builder.

## 9. README must include (exact commands)

1. Prerequisites: Node 20+, a free Cloudflare account, and `npx wrangler login`.
2. `npx wrangler d1 create sunny` → paste the id into `wrangler.toml` → run migrations (local and remote).
3. `node scripts/generate-vapid.mjs` → set `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` in `wrangler.toml` vars, then `npx wrangler secret put VAPID_PRIVATE_KEY`.
4. `npm run build` (web) then `npx wrangler deploy` (worker plus assets).
5. On iPhone: open the URL in **Safari** → Share → Add to Home Screen → open from the icon → onboarding.
6. Troubleshooting: no notifications (check iOS version, open from the Home Screen icon, Settings → Notifications → Sunny, Focus modes), and re-subscribing after deleting the icon.
7. Local dev: `wrangler dev` with the Vite dev server proxied to `/api`. Push can be tested in desktop Chrome/Safari.

## 10. Phases (stop after each one)

1. **Scaffold:** monorepo, Vite React TS app, Worker with static assets, D1 migrations, shared constants (vibes, icons), README skeleton.
2. **UI port:** all screens from the prototype as React components with local mock data, pixel-close to the screenshots, including animations, dark mode and reduced motion.
3. **API + auth:** D1 CRUD, passcode setup/login, and wiring the UI to the API with optimistic updates and undo delete.
4. **PWA:** manifest, generated icons, service worker (shell cache, push, notificationclick → Moment, postMessage → banner), install detection, and the permission flow.
5. **Push + cron:** VAPID, WebCrypto Web Push, the test endpoint, the scheduled handler, and tests.
6. **Polish + deploy:** README walkthrough, final check against every screenshot, and a deploy checklist.

## 11. Acceptance checklist

- [ ] Installed from Safari to the Home Screen, it opens full-screen with the Sunny gradient-sun icon.
- [ ] First run: install → notifications → passcode works, and later launches ask for the passcode only if the token is missing.
- [ ] Add, edit (text + icon), toggle and delete (with Undo) affirmations, and it survives reinstall because the data is server-side.
- [ ] Add, edit, toggle and delete reminders, with days respected.
- [ ] "Send to lock screen" delivers a real notification within seconds while the app is closed.
- [ ] Scheduled reminders arrive at the right IST minute, once per day each.
- [ ] Tapping a notification opens the Moment screen with that exact affirmation.
- [ ] With the app open when a reminder fires, the in-app banner appears.
- [ ] Vibe changes the notification titles and emoji and the Moment/banner colors.
- [ ] No streak anywhere, and no payment code, trackers or analytics.
- [ ] Runs entirely on the Cloudflare free plan.
