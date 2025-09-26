import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

import { RiotClient, assertRegionGroup, RegionGroup, platformFromMatchId } from "../../../../../lib/riot";
import { loadMatchIds, fetchMatches, filterByMode, onlySummonersRift, toHistoryRows } from "../../../../../lib/matches";
import { aggregateForPuuid } from "../../../../../lib/aggregate";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const riotId = (searchParams.get("riotId") || "").trim();
    const region = (searchParams.get("region") || "americas").trim().toLowerCase();
    assertRegionGroup(region);

    // Modes: all/ranked/unranked/aram/arena
    const mode = (searchParams.get("mode") || "all").toLowerCase() as
      | "all" | "ranked" | "unranked" | "aram" | "arena";
    const size = (searchParams.get("size") || "").toLowerCase();
    const srOnly = (searchParams.get("srOnly") || "1") === "1";

    let count = Math.min(parseInt(searchParams.get("count") || "20", 10) || 20, 100);
    let fetchAll = ["1", "true"].includes((searchParams.get("all") || "").trim().toLowerCase());
    let maxIds = Math.min(parseInt(searchParams.get("max") || "300", 10) || 300, 1000);

    if (size) {
      if (size === "all") { fetchAll = true; count = 100; maxIds = Math.max(maxIds, 300); }
      else { count = Math.min(parseInt(size, 10) || 20, 100); fetchAll = false; }
    }

    const queue = searchParams.get("queue") || undefined;
    const startTime = searchParams.get("startTime") || undefined;
    const endTime = searchParams.get("endTime") || undefined;

    const [gameName, tagLine] = riotId.split("#");
    if (!gameName || !tagLine) {
      return NextResponse.json({ error: "Invalid Riot ID. Use GameName#TagLine" }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY!;
    const rc = new RiotClient(apiKey);

    const account = await rc.getAccountByRiotId(region as RegionGroup, gameName, tagLine);

    const ids = await loadMatchIds(rc, region as RegionGroup, account.puuid, {
      count, all: fetchAll, max: maxIds, queue, startTime, endTime,
    });

    if (!ids.length) {
      return NextResponse.json({
        account: { gameName: account.gameName, tagLine: account.tagLine, puuid: account.puuid },
        profile: { profileIconId: null, summonerLevel: null, platform: null },
        totals: { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0, winrate: 0, kda: 0 },
        streak: { type: "none", count: 0 },
        roles: [], champions: [], powerPicks: [],
        history: [],
        _meta: { ids: 0, mode, srOnly },
      }, { headers: { "Cache-Control": "s-maxage=60" } });
    }

    // Profile info
    let profile = { profileIconId: null as number | null, summonerLevel: null as number | null, platform: null as string | null };
    try {
      const platform = platformFromMatchId(ids[0]);
      const summ = await rc.getSummonerByPuuid(platform, account.puuid);
      profile = { profileIconId: summ?.profileIconId ?? null, summonerLevel: summ?.summonerLevel ?? null, platform };
    } catch {}

    // Fetch & filter
    const matchesRaw = await fetchMatches(rc, region as RegionGroup, ids, 16);
    const matchesMode = filterByMode(matchesRaw, mode);

    // History rows (now include items/trinket)
    const history = toHistoryRows(account.puuid, matchesMode);

    // SR-only analytics unless user set srOnly=0 OR mode is arena (Arena isn’t SR)
    const doSrOnly = srOnly && mode !== "arena";
    const analyticsBase = doSrOnly ? onlySummonersRift(matchesMode) : matchesMode;
    const summary = aggregateForPuuid(account.puuid, analyticsBase);

    return NextResponse.json({
      account: { gameName: account.gameName, tagLine: account.tagLine, puuid: account.puuid },
      profile,
      ...summary,
      history,
      _meta: { ids: ids.length, mode, srOnly: doSrOnly },
    }, { headers: { "Cache-Control": "s-maxage=60" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}
