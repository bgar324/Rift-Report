# Riot Report — Personalized Champion Performance Dashboard

Next.js (App Router + Tailwind) app that lets a player enter their Riot ID and instantly see:

- Champion breakdown (games, wins, winrate, K/D/A)
- Role distribution (Top/Jungle/Mid/ADC/Support)
- Power Picks (player winrate vs. global baseline)
- Current win/loss streak

The server calls Riot Account-V1 and Match-V5 on the regional host to fetch recent matches and aggregates the results.

## Quickstart

1) Install deps

```bash
npm install
```

2) Add your Riot API key

Create `.env.local` in the project root:

```
RIOT_API_KEY=RGAPI_your_key_here
```

Optional: enable mock/demo mode (no external requests)

```
MOCK=1
```

3) Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 and enter a Riot ID like `Faker#KR1`. Pick the correct region group (americas/europe/asia/sea) and click Analyze. You can toggle "Mock data" to see a demo without a key.

## How it works

- API Route: `src/app/api/player/summary/route.ts`
  - Resolves Riot ID → PUUID via Account-V1 on the selected region group.
  - Fetches recent match IDs and details via Match-V5.
  - Aggregates per-champion stats, role distribution, overall totals, and computes a simple streak.
  - Computes Power Picks by comparing player winrate vs. a global baseline (`src/data/globalWinrates.json`). Missing champs default to 50% baseline.
  - Includes minimal handling for HTTP 429 using `Retry-After` and chunked requests to be gentle with rate limits.

- UI: `src/app/page.tsx`
  - Simple client page to input Riot ID and region group, toggle mock mode, and render the dashboard.

- Data:
  - `src/data/globalWinrates.json` — placeholder global winrates for comparison.
  - `src/data/mockSummary.json` — canned response for demo mode.

See `ENVIRONMENT.md` for details on environment setup, regions/routing, and rate limit notes.

## Notes

- This project is for personal/portfolio use. Follow Riot’s developer policies and rate limits.
- For production, consider adding persistence, better error handling, chart visualizations, and champion assets via Data Dragon.

## License

MIT
