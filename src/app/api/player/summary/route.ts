import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import globalWinrates from "@/data/globalWinrates.json";
import mockSummary from "@/data/mockSummary.json";

// Utility: chunk an array
function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

// Valid region groups for LoL Match-V5 and Account-V1
const REGION_GROUPS = new Set(["americas", "europe", "asia", "sea"]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const riotId = (searchParams.get("riotId") || "").trim();
    const regionGroup = (searchParams.get("region") || "americas").trim().toLowerCase();

    // count acts as page size (max 100 for Match-V5)
    const count = Math.min(parseInt(searchParams.get("count") || "20", 10) || 20, 100);

    // pagination + all-mode flags
    const mockParam = (searchParams.get("mock") || "").trim().toLowerCase();
    const useMock = process.env.MOCK === "1" || mockParam === "1" || mockParam === "true";
    const start = Math.max(0, parseInt(searchParams.get("start") || "0", 10) || 0);
    const allParam = (searchParams.get("all") || "").trim().toLowerCase();
    const fetchAll = allParam === "1" || allParam === "true";
    // safety cap for All-mode; hard cap at 1000 to avoid hammering the API
    const maxIds = Math.min(parseInt(searchParams.get("max") || "300", 10) || 300, 1000);

    if (!riotId) {
      return NextResponse.json({ error: "Missing riotId. Use format GameName#TagLine" }, { status: 400 });
    }
    if (!REGION_GROUPS.has(regionGroup)) {
      return NextResponse.json(
        { error: `Invalid region group. Use one of: ${Array.from(REGION_GROUPS).join(", ")}` },
        { status: 400 }
      );
    }

    const [gameName, tagLine] = riotId.split("#");
    if (!gameName || !tagLine) {
      return NextResponse.json({ error: "Invalid Riot ID. Use format GameName#TagLine" }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;

    if (!apiKey && !useMock) {
      return NextResponse.json(
        { error: "RIOT_API_KEY is not set on the server. See ENVIRONMENT.md to configure or set MOCK=1 for demo." },
        { status: 500 }
      );
    }

    if (useMock) {
      return NextResponse.json(mockSummary);
    }

    // Helper to call Riot API with proper headers and minimal 429 backoff
    const rfetch = async (url: string, retries = 2): Promise<any> => {
      const res = await fetch(url, {
        headers: { "X-Riot-Token": apiKey! },
        cache: "no-store",
      });
      if (res.status === 429 && retries > 0) {
        const retryAfter = Number(res.headers.get("Retry-After") || "1");
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return rfetch(url, retries - 1);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Riot API error ${res.status} for ${url}: ${text}`);
      }
      return res.json();
    };

    // 1) Get account by Riot ID -> PUUID
    const accountUrl = `https://${regionGroup}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagLine)}`;
    const account = (await rfetch(accountUrl)) as { puuid: string; gameName: string; tagLine: string };

    // 2) Get match IDs (pagination and 'all' mode)
    const baseIdsUrl = `https://${regionGroup}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids`;
    let matchIds: string[] = [];

    if (fetchAll) {
      // Use `count` as a per-page size (<=100); loop pages up to `maxIds`
      const pageCount = Math.min(count, 100);
      let cursor = 0;
      while (matchIds.length < maxIds) {
        const idsUrl = `${baseIdsUrl}?start=${cursor}&count=${pageCount}`;
        const ids = (await rfetch(idsUrl)) as string[];
        if (!Array.isArray(ids) || ids.length === 0) break;
        matchIds.push(...ids);
        if (ids.length < pageCount) break; // no more pages
        cursor += pageCount;
        // small delay between pages to be nicer to the API
        await new Promise((r) => setTimeout(r, 150));
      }
      // trim to cap if overshot
      if (matchIds.length > maxIds) matchIds = matchIds.slice(0, maxIds);
    } else {
      // Single window
      const idsUrl = `${baseIdsUrl}?start=${start}&count=${count}`;
      matchIds = (await rfetch(idsUrl)) as string[];
    }

    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return NextResponse.json({
        account: { gameName: account.gameName, tagLine: account.tagLine, puuid: account.puuid },
        totals: { matches: 0, wins: 0, losses: 0, winrate: 0, kills: 0, deaths: 0, assists: 0, kda: 0 },
        streak: { type: "none", count: 0 },
        roles: [],
        champions: [],
        powerPicks: [],
      });
    }

    // 3) Fetch match details (chunked to be friendly to rate limits)
    const chunks = chunk(matchIds, 5);
    const matches: any[] = [];
    for (const c of chunks) {
      const results = await Promise.all(
        c.map((id) => rfetch(`https://${regionGroup}.api.riotgames.com/lol/match/v5/matches/${id}`))
      );
      matches.push(...results);
      await new Promise((r) => setTimeout(r, 150));
    }

    type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "UNKNOWN";

    const championAgg: Record<string, { games: number; wins: number; kills: number; deaths: number; assists: number }> =
      {};
    const roleAgg: Record<Role, number> = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0, UNKNOWN: 0 };

    const perMatchWinFlags: boolean[] = [];

    for (const m of matches) {
      const p = m?.info?.participants?.find((pp: any) => pp?.puuid === account.puuid);
      if (!p) continue;
      const champ = (p.championName as string) || "Unknown";
      const win = Boolean(p.win);
      const kills = Number(p.kills) || 0;
      const deaths = Number(p.deaths) || 0;
      const assists = Number(p.assists) || 0;
      const teamPosition = (p.teamPosition as string) || "";

      const role: Role = ((): Role => {
        switch (teamPosition) {
          case "TOP":
          case "JUNGLE":
          case "MIDDLE":
          case "BOTTOM":
          case "UTILITY":
            return teamPosition;
          default:
            return "UNKNOWN";
        }
      })();

      roleAgg[role] = (roleAgg[role] || 0) + 1;

      if (!championAgg[champ]) {
        championAgg[champ] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
      }
      championAgg[champ].games += 1;
      championAgg[champ].wins += win ? 1 : 0;
      championAgg[champ].kills += kills;
      championAgg[champ].deaths += deaths;
      championAgg[champ].assists += assists;

      perMatchWinFlags.push(win);
    }

    // Totals and streak
    const totals = perMatchWinFlags.reduce(
      (acc, win, idx) => {
        acc.matches += 1;
        if (win) acc.wins += 1;
        else acc.losses += 1;
        const p = matches[idx]?.info?.participants?.find((pp: any) => pp?.puuid === account.puuid);
        if (p) {
          acc.kills += Number(p.kills) || 0;
          acc.deaths += Number(p.deaths) || 0;
          acc.assists += Number(p.assists) || 0;
        }
        return acc;
      },
      { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 }
    );
    const overallWinrate = totals.matches ? Math.round((totals.wins / totals.matches) * 1000) / 10 : 0;
    const overallKda = totals.deaths ? Math.round(((totals.kills + totals.assists) / totals.deaths) * 10) / 10 : totals.kills + totals.assists;

    // Current streak (assumes matchIds newest -> oldest)
    let streakType: "win" | "loss" | "none" = "none";
    let streakCount = 0;
    if (perMatchWinFlags.length > 0) {
      const first = perMatchWinFlags[0];
      streakType = first ? "win" : "loss";
      for (const f of perMatchWinFlags) {
        if (f === first) streakCount += 1;
        else break;
      }
    }

    // Champions list
    const champions = Object.entries(championAgg)
      .map(([champion, v]) => {
        const deaths = v.deaths || 0;
        const kda = deaths ? (v.kills + v.assists) / deaths : v.kills + v.assists;
        return {
          champion,
          games: v.games,
          wins: v.wins,
          losses: v.games - v.wins,
          winrate: Math.round((v.wins / v.games) * 1000) / 10,
          kills: v.kills,
          deaths: v.deaths,
          assists: v.assists,
          kda: Math.round(kda * 10) / 10,
        };
      })
      .sort((a, b) => b.games - a.games);

    // Roles list
    const roles = Object.entries(roleAgg)
      .filter(([, c]) => c > 0)
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    // Power picks
    const powerPicks = champions
      .filter((c) => c.games >= 3)
      .map((c) => {
        const global = (globalWinrates as Record<string, number>)[c.champion] ?? 50;
        const diff = Math.round((c.winrate - global) * 10) / 10;
        return { champion: c.champion, games: c.games, playerWinrate: c.winrate, globalWinrate: global, diff };
      })
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 3);

    return NextResponse.json({
      account: { gameName: account.gameName, tagLine: account.tagLine, puuid: account.puuid },
      totals: { ...totals, winrate: overallWinrate, kda: Math.round(overallKda * 10) / 10 },
      streak: { type: streakType, count: streakCount },
      roles,
      champions,
      powerPicks,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}