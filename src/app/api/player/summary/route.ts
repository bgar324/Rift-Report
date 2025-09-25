import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "UNKNOWN";

class LRU<K, V> {
  private max: number;
  private map = new Map<K, V>();
  constructor(max = 600) { this.max = max; }
  get(k: K) { if (!this.map.has(k)) return undefined; const v = this.map.get(k)!; this.map.delete(k); this.map.set(k, v); return v; }
  set(k: K, v: V) { if (this.map.has(k)) this.map.delete(k); this.map.set(k, v); if (this.map.size > this.max) { const it = this.map.keys().next(); if (!it.done) this.map.delete(it.value); } }
}
const matchCache = new LRU<string, any>(600);
const REGION_GROUPS = new Set(["americas", "europe", "asia", "sea"]);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); }
  finally { clearTimeout(t); }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const riotId = (searchParams.get("riotId") || "").trim();
    const regionGroup = (searchParams.get("region") || "americas").trim().toLowerCase();
    const count = Math.min(parseInt(searchParams.get("count") || "20", 10) || 20, 100);
    const fetchAll = ["1", "true"].includes((searchParams.get("all") || "").trim().toLowerCase());
    const maxIds = Math.min(parseInt(searchParams.get("max") || "300", 10) || 300, 1000);
    const queue = searchParams.get("queue") || "";
    const startTime = searchParams.get("startTime") || "";
    const endTime = searchParams.get("endTime") || "";

    if (!riotId) return NextResponse.json({ error: "Missing riotId. Use GameName#TagLine" }, { status: 400 });
    if (!REGION_GROUPS.has(regionGroup)) return NextResponse.json({ error: `Invalid region group. Use one of: ${Array.from(REGION_GROUPS).join(", ")}` }, { status: 400 });

    const [gameName, tagLine] = riotId.split("#");
    if (!gameName || !tagLine) return NextResponse.json({ error: "Invalid Riot ID. Use GameName#TagLine" }, { status: 400 });

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "RIOT_API_KEY is not set on the server." }, { status: 500 });

    let backoffMs = 0;
    const rfetch = async (url: string, retries = 3): Promise<any> => {
      if (backoffMs) await sleep(backoffMs);
      const res = await fetchWithTimeout(url, { headers: { "X-Riot-Token": apiKey }, cache: "no-store" }, 8000);
      if (res.status === 429 && retries > 0) {
        const retryAfter = Number(res.headers.get("Retry-After") || "1");
        backoffMs = Math.max(backoffMs, retryAfter * 1000);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2 || 500, 8000);
        return rfetch(url, retries - 1);
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Riot API ${res.status}: ${txt || url}`);
      }
      backoffMs = Math.max(0, Math.floor(backoffMs / 2));
      return res.json();
    };

    const account = await rfetch(
      `https://${regionGroup}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );

    const baseIdsUrl = `https://${regionGroup}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids`;
    const idParamsBase = new URLSearchParams();
    if (queue) idParamsBase.set("queue", queue);
    if (startTime) idParamsBase.set("startTime", startTime);
    if (endTime) idParamsBase.set("endTime", endTime);

    async function pageIds(start: number, size: number) {
      const p = new URLSearchParams(idParamsBase);
      p.set("start", String(start));
      p.set("count", String(size));
      return rfetch(`${baseIdsUrl}?${p.toString()}`);
    }

    let matchIds: string[] = [];
    if (fetchAll) {
      const page = Math.min(count, 100);
      let cursor = 0;
      const inflight = new Set<number>();
      const results: Record<number, string[]> = {};
      const maxWorkers = 4;

      async function spawn(start: number) {
        inflight.add(start);
        try { results[start] = await pageIds(start, page); }
        finally { inflight.delete(start); }
      }

      for (let w = 0; w < maxWorkers; w++) await spawn(cursor + w * page);
      while (true) {
        while (inflight.size) await sleep(20);
        const starts = Object.keys(results).map(Number).sort((a, b) => a - b);
        let keepPaging = false;
        for (const s of starts) {
          if (!results[s]) continue;
          const ids = results[s];
          delete results[s];
          if (!Array.isArray(ids) || ids.length === 0) continue;
          matchIds.push(...ids);
          if (matchIds.length >= maxIds) break;
          if (ids.length === page) {
            const nextStart = s + page * maxWorkers;
            if (nextStart < 5000) { keepPaging = true; await spawn(nextStart); }
          }
        }
        if (!keepPaging || matchIds.length >= maxIds) break;
      }
      matchIds = matchIds.slice(0, maxIds);
    } else {
      matchIds = await pageIds(0, count);
    }

    if (!matchIds.length) {
      return NextResponse.json({
        account: { gameName: account.gameName, tagLine: account.tagLine, puuid: account.puuid },
        totals: { matches: 0, wins: 0, losses: 0, winrate: 0, kills: 0, deaths: 0, assists: 0, kda: 0 },
        streak: { type: "none", count: 0 },
        roles: [],
        champions: [],
        powerPicks: [],
      }, { headers: { "Cache-Control": "s-maxage=60" } });
    }

    const concurrency = 16;
    let idx = 0;
    const results: any[] = [];
    const workers = Array.from({ length: Math.min(concurrency, matchIds.length) }, async () => {
      while (true) {
        const i = idx++;
        if (i >= matchIds.length) break;
        const id = matchIds[i];
        const cached = matchCache.get(id);
        if (cached) { results.push(cached); continue; }
        try {
          const m = await rfetch(`https://${regionGroup}.api.riotgames.com/lol/match/v5/matches/${id}`);
          matchCache.set(id, m);
          results.push(m);
        } catch {}
      }
    });
    await Promise.all(workers);

    const roleAgg: Record<Role, number> = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0, UNKNOWN: 0 };
    const perMatchWin: boolean[] = [];
    const championAgg: Record<string, { games: number; wins: number; kills: number; deaths: number; assists: number }> = {};

    for (const m of results) {
      const p = m?.info?.participants?.find((pp: any) => pp?.puuid === account.puuid);
      if (!p) continue;
      const champ = p.championName || "Unknown";
      const role: Role = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].includes(p.teamPosition) ? p.teamPosition : "UNKNOWN";
      roleAgg[role] = (roleAgg[role] || 0) + 1;
      if (!championAgg[champ]) championAgg[champ] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
      championAgg[champ].games += 1;
      championAgg[champ].wins += p.win ? 1 : 0;
      championAgg[champ].kills += p.kills || 0;
      championAgg[champ].deaths += p.deaths || 0;
      championAgg[champ].assists += p.assists || 0;
      perMatchWin.push(Boolean(p.win));
    }

    const totals = perMatchWin.reduce(
      (a, win, i) => {
        a.matches += 1;
        if (win) a.wins += 1; else a.losses += 1;
        const p = results[i]?.info?.participants?.find((pp: any) => pp?.puuid === account.puuid);
        if (p) { a.kills += p.kills || 0; a.deaths += p.deaths || 0; a.assists += p.assists || 0; }
        return a;
      },
      { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 }
    );
    const overallWinrate = totals.matches ? Math.round((totals.wins / totals.matches) * 1000) / 10 : 0;
    const overallKda = totals.deaths ? Math.round(((totals.kills + totals.assists) / totals.deaths) * 10) / 10 : totals.kills + totals.assists;

    let streakType: "win" | "loss" | "none" = "none";
    let streakCount = 0;
    if (perMatchWin.length) {
      const first = perMatchWin[0];
      streakType = first ? "win" : "loss";
      for (const f of perMatchWin) { if (f === first) streakCount++; else break; }
    }

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

    const roles = Object.entries(roleAgg)
      .filter(([, c]) => c > 0)
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    const powerPicks = champions
      .filter(c => c.games >= 3)
      .map(c => {
        const baseline = overallWinrate;
        const diff = Math.round((c.winrate - baseline) * 10) / 10;
        return { champion: c.champion, games: c.games, playerWinrate: c.winrate, globalWinrate: baseline, diff };
      })
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 3);

    return NextResponse.json({
      account: { gameName: account.gameName, tagLine: account.tagLine, puuid: account.puuid },
      totals: { ...totals, winrate: overallWinrate, kda: overallKda },
      streak: { type: streakType, count: streakCount },
      roles,
      champions,
      powerPicks,
    }, { headers: { "Cache-Control": "s-maxage=60" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}
