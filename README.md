# Mifga (מפגע)

Crowd-sourced road-hazard reporting app, Waze-style, built mobile-first with a dark theme aimed at teens (16+).
This is the **local web prototype**: it runs entirely in the browser, no backend, no data leaves the device
(everything is persisted to `localStorage`). It's structured so a real backend and a native iOS build can be
added later without reworking the UI - see "Going to production" below.

## Stack

- React + TypeScript + Vite
- Tailwind CSS (dark/light theme, RTL Hebrew UI)
- react-leaflet + OpenStreetMap/CARTO tiles for the map (no API key needed locally)
- Nominatim (geocoding/address autocomplete) + OSRM demo router (routing) - free, keyless public OSM services
- Capacitor scaffolding is in place (`capacitor.config.ts`) for the Android/iOS native build

> Production note: swap the CARTO tile layer + Nominatim/OSRM calls for the Google Maps SDK / Directions API
> when you're ready to go live, per the "based on Google Maps" requirement - the marker/report/data layer is
> provider-agnostic and doesn't need to change.

## Run locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Because `server.host` is enabled in `vite.config.ts`, you can also open the
"Network" URL it prints on your phone (same wifi) to test at real mobile scale before building an APK.

## What's implemented

**Map & reporting**
- Home map screen, zoomed in tight on the user's live location; hazard markers per type
- Two headline hazard types shown up-front (שוטר/פקח, larger, high-priority pulsing markers); the rest live
  behind an "עוד" (more) drawer: pothole, blocking car, broken sidewalk, camera, accident, roadwork, closure,
  flood, animal
- One-tap report flow: pick type → location (current GPS, typed address with autocomplete, or drag a pin on
  the map) → optional nickname for police/inspector reports → optional photo → points (1, or 5 with a photo) →
  confetti burst on submit
- Community "still there?" voting on any hazard: live like count + "last like" time, confetti on each vote;
  5 "not there" votes auto-removes a hazard
- Self marker shows the user's chosen vehicle icon (scooter / e-bike / e-motorcycle); tapping it opens a
  read-only profile card (avatar, level, points, vehicle+model) - what a friend would see tapping you

**Friends & groups**
- Friends tab: map presence, distance, points, "locate on map" shortcut, walkie-talkie voice message
  (press-and-hold; uses the real mic when available, simulated otherwise so the flow always works)
- Favorite up to 3 friends - they surface on the home screen with a one-tap inline mic button
- Walkie-talkie groups: create/name a group, invite friends (pending until they "accept" - simulated), manage
  membership (add/remove, see last-seen), send a group voice message and see per-member delivery receipts

**Profile & gamification**
- Editable name, photo, and vehicle (type + model, with autocomplete suggestions from a curated model list
  plus free text for anything not listed)
- Points, level/title progression bar, report stats, "top reporters" leaderboard

**Route planning**
- "תכנון מסלול בטוח ממפגעים": address search → route + duration/distance, flags any reported hazards within
  ~120m of the route

**Settings**
- Dark/light theme, notification permission + per-type toggles (police/inspector/other) + radius
- Notification daily limit: free tier (3/day) vs. a locked "unlimited" tier, unlockable via a friend-referral
  flow (enter a friend's phone, composes an invite mentioning who invited them and their vehicle) instead of a
  real payment - there's no billing wired up, this only demonstrates the intended growth loop
- Ad banner placeholder slot

## Project structure

```
src/
  screens/       MapScreen, FriendsScreen, ProfileScreen, RouteScreen - one per bottom-nav tab
  components/    Bottom sheets, map icons, report flow, settings, etc.
  context/       AppContext - the single source of truth (see "State & persistence" below)
  data/          Static config: hazard type defs, vehicle model lists, demo seed data
  hooks/         useGeolocation, useWalkieRecorder
  lib/           Small pure helpers: geo math, routing client, map icon builders, colors, storage
  types/         Shared domain types (platform-agnostic, no DOM/Capacitor types)
```

## State & persistence

Everything lives in `src/context/AppContext.tsx` and is persisted to `localStorage` (see `src/lib/storage.ts`),
keyed per-domain (`mifga:user`, `mifga:friends`, `mifga:hazards`, `mifga:groups`, `mifga:settings`). Loaders
backfill missing fields for state saved by an older version of the schema, so upgrading the app in place
doesn't break existing local data.

This is the main thing a real backend replaces - see below.

## Going to production: what's missing

The APK this builds is a fully working **single-device demo**. To have multiple real users see and update
shared data (hazards, friends, groups, points) live, `AppContext` needs to talk to a real backend instead of
`localStorage`. Concretely:

1. **A database + API.** Something like Supabase/Firebase (fastest to stand up, built-in auth + realtime) or a
   small custom Node/Postgres API. Tables mirror the existing types in `src/types/index.ts` almost 1:1: users,
   hazards, friends/relationships, groups, group_members, group_messages.
2. **Auth.** Right now there's one hardcoded `DEMO_USER`. Real accounts (phone number is the natural choice
   for this audience) are what makes "friends," "groups," and "who reported what" mean anything across devices.
3. **Realtime sync.** Hazard reports, votes, and walkie-talkie messages need to push to other users live, not
   just save locally - Supabase/Firebase realtime subscriptions (or plain WebSockets) replace the `setTimeout`
   simulations currently used for "friend accepted the group invite" / "message delivered".
4. **Real push notifications.** The Notification API calls in `SettingsSheet` only work while the app tab is
   open. Shipping real push (new hazard nearby, group invite, walkie-talkie message) needs Firebase Cloud
   Messaging wired into the Capacitor native build.
5. **File storage** for report photos and profile pictures (Supabase Storage / S3 / Firebase Storage) instead
   of embedding them as base64 data URLs.
6. **Swap the map/geocoding providers** for Google Maps SDK + Directions API (billing key required), per the
   original "based on Google Maps" requirement - everything else in the marker/report layer stays the same.
7. **An SMS gateway** (e.g. Twilio) if the friend-referral invite in Settings should actually send a text,
   rather than just composing the message locally.

None of this is a rewrite - it's mostly replacing the functions inside `AppContext.tsx` (`addReport`,
`confirmHazard`, `createGroup`, etc.) with API calls, and swapping `localStorage` reads for a `user`
subscription once someone's logged in. The screens/components don't need to change.

## Building the APK

1. `npm run build`
2. `npx cap add android` (needs Android Studio/SDK locally, or run it via CI)
3. `npx cap sync android`
4. Build the APK from Android Studio or `./gradlew assembleDebug`

`npx cap add ios` works the same way once there's a macOS/Xcode environment available - the web layer doesn't
need any changes to support it.
