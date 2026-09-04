# Open House — US Open family companion

A mobile-first Next.js app for US Open schedules, local start times, live scores, favourites, family picks, a leaderboard, a lightweight prediction model and the draw.

## What works now

- **Today:** live / upcoming / completed US Open singles matches, local browser time, ATP/WTA/favourites filters and 60-second refresh.
- **Open House Edge:** lazy-loaded per-match estimate using available ranking, 2026 hard-court record, H2H and recent form. It intentionally returns “not enough data” rather than inventing numbers.
- **Family mode:** Supabase anonymous sign-in, invite-code onboarding, shared picks, DB-level pick locking, favourites and automatic result settlement when a completed match is seen.
- **Leaderboard:** points, accuracy, streak and underdog wins.
- **Draw:** men/women draw through API-Tennis `get_draw`, with a mobile-friendly rounds view.
- **Players:** current top-100 ATP/WTA ranking list and favourites.
- **Demo mode:** works without any external keys using clearly fictional data.
- **PWA:** installable manifest and icon.

## 1. Install

Requires Node 20.9+.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

With no `.env.local`, the site runs in demo mode and family picks use localStorage.

## 2. API-Tennis

Create an API-Tennis key and add:

```env
API_TENNIS_KEY=your_key
```

The app calls API-Tennis only from server route handlers. The key is never sent to the browser.

The provider lives in `src/lib/tennis/provider.ts`. External responses are normalised into the app's own Match / Player / Draw types, so the provider can be replaced later.

Implementation note: tournament discovery uses API-Tennis `get_tournaments`. `get_events` returns event **types** (ATP Singles, WTA Singles, etc.), not the actual tournament list, so it cannot reliably discover the men's/women's US Open tournament keys by itself.

## 3. Supabase family sharing

Create a free Supabase project.

1. In **Authentication → Providers / Settings**, enable **Anonymous Sign-Ins**.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Change the seeded family name / invite code at the bottom of the SQL first if desired.
4. Add the project variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Restart the dev server. Each device will be anonymously signed in and prompted for a display name + family code.

Anonymous Supabase sessions are tied to that browser/device. Clearing site data or changing devices creates a new anonymous identity. For this casual family tournament app that keeps onboarding friction very low.

## 4. Production checks

```bash
npm run typecheck
npm run lint
npm run build
```

## 5. Deploy free on Vercel

1. Push this folder to GitHub/GitLab/Bitbucket.
2. Import it at Vercel.
3. Add the three environment variables above.
4. Deploy.

The app is compatible with Vercel Hobby + Supabase Free. API-Tennis calls are cached with Next.js/Vercel caching so every family browser is not hitting the upstream API independently.

## Data / caching behaviour

- Live/today endpoint: browser refresh every 60 seconds; upstream live request revalidated ~75 seconds, fixtures ~5 minutes.
- Draw: ~20 minutes.
- Rankings / player / H2H data: ~6 hours.
- API failures fall back to a clearly labelled demo feed rather than showing broken UI.

## Prediction model

Available factors are weighted as requested:

- Ranking: 55%
- Hard-court record: 25%
- H2H: 15%
- Recent form: 5%

Missing factors are omitted and remaining weights are re-normalised. If less than 50% of the intended evidence is available, no prediction is shown. Probabilities are bounded and rounded to whole percentages to avoid fake precision.

## A practical limitation

API-Tennis fixture payloads do not document a reliable court/stadium field in the public examples. The normaliser checks likely court fields and otherwise displays **Court TBC** rather than inventing a venue. Everything else degrades the same way: missing data is omitted, not fabricated.
