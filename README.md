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
   points-to-win and taps **Start**.
2. **Fill the pot** — everyone drops short, drawable prompts into a shared pool
   until it holds enough to seed every chain of every round. The game auto-starts
   the moment it fills.
3. Each round you're first shown **the one prompt you own** (you'll judge that
   chain later), then you **draw** a different prompt you're handed. Drawings pass
   around: you **guess** the one you receive, your guess becomes the next player's
   thing to draw, and so on until everyone has touched every chain.
4. **Reveal** — each chain is walked one step at a time, judged by the player who
   owns its prompt. Every drawing or guess that still matches the original prompt
   earns its maker **+1**. First player to the target score wins.

Needs at least **3 players** (with 2, the last caption would always fall to the
prompt's own author, so there's nothing to guess).

## Built With

- **Expo 57** — React Native framework for iOS, Android and web
- **react-native-web** — The same screens rendered in the browser
- **React Native 0.86** — Cross-platform mobile UI
- **TypeScript** — Type safety
- **Supabase Realtime** — Real-time database, Broadcast and Presence for multiplayer sync (free tier)
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
4. Realtime is enabled by default — no tables or extra config needed for this game.

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

> If you change `.env`, restart with `npx expo start -c` to clear the cache.

### Web
```bash
npm run web         # dev server in the browser (or press w in `npx expo start`)
npm run build:web   # static single-page build in dist/
```
`dist/` can be served by any static host; unknown paths must fall back to
`index.html` so routes like `/join?room=ABCD` load the app. The `EXPO_PUBLIC_`
Supabase values are baked into the bundle at build time — the publishable key
is meant to be public, but never put a secret key in `.env`.

### Local test tooling (optional)
Anything in `src/dev/local/` is gitignored and only loads in dev builds. Drop a
`.tsx` file there whose default export is a component and it appears at the
bottom of the lobby — handy for helpers like automated "ghost" players that let
you play a full game on one phone. Restart `npx expo start` after adding files.

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
