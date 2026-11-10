# Squigglepig 2.0 | Draw Squiggles, Get Giggles

A real-time multiplayer party game, rebuilt as a native mobile app for the
Google Play Store and Apple App Store, with a web version built from the same
code.

It's drawing telephone: a prompt becomes a drawing becomes a guess becomes the
next drawing, passed around the whole group. At the end each chain is revealed
and scored against the prompt it started from — the funniest wrecks and the
faithful saves both earn points.

## How to play

1. One person taps **Create Game** to get a 4-letter room code; everyone else taps
   **Join Game** and enters it. When the group is in the lobby, the host picks the
   points-to-win and taps **Start**. Everyone stays in the room until they tap
   **Leave game**: closing the app only marks them away (and sends them
   notifications about the room). A room closes after 10 minutes with nobody
   doing anything in it, and nobody new can join once a game has started.
2. **Fill the pot** — everyone drops short, drawable prompts into a shared pool
   until it holds enough to seed every chain of every round. The game auto-starts
   the moment it fills.
3. Each round you're first shown **the one prompt you own** (you'll judge that
   chain later), then you **draw** a different prompt you're handed. Drawings pass
   around: you **guess** the one you receive, your guess becomes the next player's
   thing to draw, and so on until everyone has touched every chain.
4. **Reveal** — each chain is walked one step at a time, judged by the player who
   owns its prompt. Every drawing or guess that still matches the original prompt
   earns its maker **+1**, and every blank drawing (an empty canvas, or the
   timer running out) costs the player who owed it **−1**. First player to the
   target score wins.

Needs at least **3 players** (with 2, the last caption would always fall to the
prompt's own author, so there's nothing to guess).

## Built With

- **Expo 58** — React Native framework for iOS, Android and web
- **react-native-web** — The same screens rendered in the browser
- **React Native 0.88** — Cross-platform mobile UI
- **TypeScript** — Type safety
- **Supabase** — Realtime Broadcast and Presence for multiplayer sync, anonymous guest sign-in, and Postgres (with pg_cron and pg_net) for rooms that outlast a closed app (free tier)
- **expo-notifications** — Push notifications about your room, sent through Expo's push service
- **expo-router** — Navigation and deep linking
- **react-native-svg** — Vector drawing canvas (strokes encoded as compact JSON)
- **react-native-gesture-handler** — Touch input and pan gestures
- **react-native-reanimated** — Smooth animations
- **react-native-safe-area-context** — Notch and edge-to-edge device support
- **expo-image** — Original art and animated GIFs
- **expo-audio** — Sound effects
- **react-native-view-shot** — Drawing export to image

## One-time setup

### 1. Create a free Supabase project
1. Go to https://supabase.com and sign up (free, no credit card).
2. Click **New project**. Pick any name, set a database password, choose the region nearest you, and create it (~2 min to provision).
3. In the dashboard copy two values (the **Connect** button at the top shows both):
   - **Project URL** — Settings → Data API (e.g. `https://abcd1234.supabase.co`)
   - **Publishable key** — Settings → API Keys (starts with `sb_publishable_...`; click **Create new API keys** if you only see the legacy anon key)
4. Turn on guest sign-in: **Authentication → Sign In / Providers → Allow
   anonymous sign-ins**. Every player is an anonymous Supabase user (no sign-up
   screen), which is what room membership and push tokens hang off.
5. Open **SQL Editor → New query**, paste in `supabase/rooms.sql` and click
   **Run**. It creates the rooms (who is in each one, whether a game is on, and
   the host's snapshot of it), makes each room's Realtime channel private to its
   members, schedules a job that closes rooms after 10 idle minutes (pg_cron),
   and sends push notifications through Expo (pg_net). Safe to run again.
6. Open **SQL Editor → New query**, paste in `supabase/keepalive.sql` and click
   **Run**. It creates a one-row table for the keep-alive workflow
   (`.github/workflows/supabase-keepalive.yml`): free projects pause after 7 days
   without database reads, and the game's Realtime traffic doesn't count. The
   workflow also needs `SUPABASE_URL` and `SUPABASE_KEY` repository secrets
   (Settings → Secrets and variables → Actions), the same values as `.env`.
7. Do the same with `supabase/birthdays.sql` (run it again if you ran an older
   copy: signed-in guests need to be able to read it too). It creates the `birthdays` table
   the app reads to know whose birthday it is: on each one the app shows the
   birthday theme with that name iced on the cake. Add, change or remove
   birthdays in **Table Editor → birthdays** (a name of 1–24 characters, a
   month 1–12 and a day). Phones pick up changes the next time the app opens
   or comes back to the foreground; no app update is needed.

### 2. Add your credentials
```bash
cp .env.example .env
```
Edit `.env` and paste in your Project URL and anon key.

### 3. Install and run
```bash
npm install
npx expo start
```
Then either:
- Press **a** (Android emulator) / **i** (iOS simulator, macOS only), or
- Install **Expo Go** on your phone and scan the QR code.

To test multiplayer, open the app on two devices/emulators: one taps **Create Game**
(shares the 4-letter code), the other taps **Join Game** and enters it.

### Push notifications
Expo Go can't receive push notifications, so test them in a development build
(`eas build --profile development`) on a real phone; simulators and emulators
have no push token. The server sends them through Expo's push service, which
needs each platform's credentials once:
- **Android:** create a Firebase project, add an Android app with the package
  `com.squigglepig.app`, download its `google-services.json` to the project root
  and add `"googleServicesFile": "./google-services.json"` under `android` in
  `app.json`. Then upload an FCM V1 service-account key with
  `eas credentials -p android` (Push Notifications → FCM V1).
- **iOS:** once the Apple developer account exists, `eas build -p ios` offers to
  create the push key (APNs) for you.

Without them the game works the same; there are just no notifications.

> If you change `.env`, restart with `npx expo start -c` to clear the cache.

### Web
```bash
npm run web         # dev server in the browser (or press w in `npx expo start`)
npm run build:web   # static single-page build in dist/
```
`dist/` can be served by any static host; unknown paths must fall back to
`index.html` so routes like `/join?room=ABCD` load the app. The `EXPO_PUBLIC_`
Supabase values are baked into the bundle at build time — the publishable key
is meant to be public, but never put a secret key in `.env`. Files in `public/`
(the page template, `_headers`, the web app manifest and its icons) are copied
into `dist/`. The icons are the app logo on teal; `og-image.png` (the link
preview card, also in `site/`) is the Play Store feature graphic.

### Tests
```bash
npm test            # the test suite (tests/), about 15 seconds
npm run typecheck   # TypeScript, the app and the tests
```
No phone, emulator or Supabase project needed. The suite runs on Node's own
test runner (through `tsx`) and covers the game's rules away from React
(`src/state/rules.ts`: chains, scoring, who hosts and judges, and which
late or out-of-order messages a phone ignores), getting around between the
room's screens (`src/state/nav.ts`), big messages sent in pieces
(`src/lib/chunks.ts`), drawings thinned before they're sent
(`src/lib/strokes.ts`), and the server itself: `supabase/rooms.sql` runs in
PGlite, a real Postgres in-process, with Supabase's own parts (auth,
Realtime, pg_cron, pg_net) stood in for (`tests/helpers/db.ts`). Run it
before pushing; a change to `rooms.sql` still has to be run in the Supabase
SQL editor to reach the live server.

### Drawing size (development builds)
Every drawing canvas (the game's, and Rewards › Art supplies) shows how big the
drawing is as it's handed in, against the 256 KB Supabase's free plan allows in
one message, with a bar that turns amber at 75% and red past 100%, and its size
before thinning (`src/dev/DrawingSize.tsx`). A drawing past the limit still
arrives, in pieces (`src/lib/chunks.ts`), on every phone except ones still on
2.9.0. The readout never reaches a release build.

### Local test tooling (optional)
Anything in `src/dev/local/` is gitignored and only loads in dev builds. Drop a
`.tsx` file there whose default export is a component and it appears at the
bottom of the lobby — handy for helpers like automated "ghost" players that let
you play a full game on one phone. Restart `npx expo start` after adding files.

## Hosting (Cloudflare Pages)
Two Pages projects deploy from this repo's `master` branch:

| Domain | What | Build command | Output |
|---|---|---|---|
| squigglepig.app | Landing page, `/join` invite page, `.well-known/assetlinks.json` (Android App Links), `.well-known/apple-app-site-association` (iOS Universal Links) | none | `site` |
| play.squigglepig.app | The game, web build | `npm run build:web` | `dist` |

The game project needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`
set as environment variables in its Pages settings, since `.env` isn't committed.
Node comes from `.node-version`.

The web build is one bundle (`asyncRoutes.web: false` in `app.json`) rather than
SDK 58's default of loading each screen as it's reached. A deploy replaces the old
files, so a player mid-game would otherwise find their next screen gone, and the
game moves everyone between screens by itself. Holding a browser's Back also has
to load ahead of the router (`src/lib/browserBack.ts`).

Room links always use `https://squigglepig.app/join?room=…` (see
`src/lib/links.ts`): the app opens them where it's installed, and everywhere else
the invite page offers the app, the store, or the same room on play.squigglepig.app.

## Building for the app stores (later)
Native store binaries are produced with EAS:
```bash
npm install -g eas-cli
eas login
eas build -p android   # signed .aab for Google Play
eas build -p ios       # .ipa for the App Store (requires an Apple Developer account)
```

## Accounts you'll eventually need
| Service | Needed for | Cost |
|---|---|---|
| Supabase | Multiplayer backend | Free |
| Expo / EAS | Cloud builds | Free tier |
| Google Play Console | Publishing to Android | $25 one-time |
| Apple Developer Program | Publishing to iOS | $99 / year |
