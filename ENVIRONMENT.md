# Environment Setup

This app queries Riot Games APIs (Account-V1 and Match-V5) to build a personal performance dashboard.

## 1) Create a local env file
Create a file named `.env.local` at the project root with your Riot API key:

```
RIOT_API_KEY=RGAPI_your_key_here
```

Do NOT commit this file. Your key is tied to your developer account.

- Get a key at: https://developer.riotgames.com/
- Keys expire periodically during development. Refresh as needed.

Optional:

```
# Force mock responses from the summary API (no external requests)
MOCK=1
```

## 2) Running the app

Install and start the dev server:

```
npm install
npm run dev
```

Open http://localhost:3000 and enter a Riot ID like `Faker#KR1`. Choose the correct region group and click Analyze.

You can also toggle the "Mock data" checkbox on the homepage or call the API with `?mock=1` to skip external calls and return demo data.

## 3) Regions and routing

The summary endpoint expects a region group (a.k.a. routing group) used by Account-V1 and Match-V5:

- americas
- europe
- asia
- sea

The app will call:

- Account-V1: `https://{region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`
- Match-V5: `https://{region}.api.riotgames.com/lol/match/v5/matches/...`

## 4) Rate limits

A minimal backoff for HTTP 429 is implemented in `src/app/api/player/summary/route.ts`. For production, please follow Riot's rate limit guidelines and key policy.

## 5) Mock data

- Global baseline winrates: `src/data/globalWinrates.json` (placeholder sample data)
- Example summary payload: `src/data/mockSummary.json`

To use mock data:

- Set `MOCK=1` in `.env.local` OR
- Use the UI toggle OR
- Call `/api/player/summary?...&mock=1`
