// src/app/api/player/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

import {
  RiotClient,
  assertRegionGroup,
  RegionGroup,
  platformFromMatchId,
} from "../../../../../lib/riot";
import {
  loadMatchIds,
  fetchMatches,
  filterByMode,
  onlySummonersRift,
  toHistoryRows,
} from "../../../../../lib/matches";
import { computeLanePhaseFromTimeline } from "../../../../../lib/timeline";
import { aggregateForPuuid } from "../../../../../lib/aggregate";

type Mode = "all" | "ranked" | "unranked" | "aram" | "arena";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // --- Inputs ---
    const riotId = (searchParams.get("riotId") || "").trim();
    const region = (searchParams.get("region") || "americas").trim().toLowerCase();
    assertRegionGroup(region);

    const mode = ((searchParams.get("mode") || "all").toLowerCase() as Mode);
    const size = (searchParams.get("size") || "").toLowerCase();
    const srOnlyParam = (searchParams.get("srOnly") || "1").trim();
    const srOnly = srOnlyParam === "1" || srOnlyParam === "true";

    // Count / paging
    let count = Math.min(parseInt(searchParams.get("count") || "20", 10) || 20, 100);
    let fetchAll = ["1", "true"].includes((searchParams.get("all") || "").trim().toLowerCase());
    let maxIds = Math.min(parseInt(searchParams.get("max") || "300", 10) || 300, 1000);

    // Size shorthands
    if (size) {
      if (size === "all") {
        fetchAll = true;
        count = 100;
        maxIds = Math.max(maxIds, 300);
      } else {
        count = Math.min(parseInt(size, 10) || 20, 100);
        fetchAll = false;
      }
    }

    // Queue scoping: explicit > inferred from mode
    const qp = searchParams.get("queue");
    let queue: string | undefined = (qp && qp.trim()) || undefined;
    if (!queue) {
      if (mode === "aram") queue = "450";
      else if (mode === "arena") queue = "1700";
    }

    // Optional time window
    const startTime = searchParams.get("startTime") || undefined;
    const endTime = searchParams.get("endTime") || undefined;

    // Riot ID validation
    const [gameName, tagLine] = riotId.split("#");
    if (!gameName || !tagLine) {
      return NextResponse.json(
        { error: "Invalid Riot ID. Use GameName#TagLine" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing RIOT_API_KEY" }, { status: 500 });
    }
    const rc = new RiotClient(apiKey);

    // --- Resolve account ---
    const account = await rc.getAccountByRiotId(region as RegionGroup, gameName, tagLine);

    // --- Load match IDs ---
    const ids = await loadMatchIds(rc, region as RegionGroup, account.puuid, {
      count,
      all: fetchAll,
      max: maxIds,
      queue,
      startTime,
      endTime,
    });

    // Early empty payload (stable shape)
    if (!ids.length) {
      return NextResponse.json(
        {
          account: {
            gameName: account.gameName,
            tagLine: account.tagLine,
            puuid: account.puuid,
          },
          profile: { profileIconId: null, summonerLevel: null, platform: null },
          totals: {
            matches: 0, wins: 0, losses: 0,
            kills: 0, deaths: 0, assists: 0,
            winrate: 0, kda: 0,
          },
          streak: { type: "none", count: 0 },
          roles: [],
          champions: [],
          powerPicks: [],
          history: [],
          masteryTop: [],
          _meta: { ids: 0, mode, srOnly: false },
        },
        { headers: { "Cache-Control": "s-maxage=60" } }
      );
    }

    // --- Profile (best-effort, routed via first match platform) ---
    let profile = {
      profileIconId: null as number | null,
      summonerLevel: null as number | null,
      platform: null as string | null,
    };
    try {
      const platform = platformFromMatchId(ids[0]);
      const summ = await rc.getSummonerByPuuid(platform, account.puuid);
      profile = {
        profileIconId: summ?.profileIconId ?? null,
        summonerLevel: summ?.summonerLevel ?? null,
        platform,
      };
    } catch {
      // optional
    }

    // --- Fetch & filter matches ---
    // Adaptive concurrency + gentle throttle to avoid 429 storms
    const N = ids.length;
    const conc = N <= 20 ? 16 : N <= 50 ? 10 : N <= 120 ? 8 : 6;
    const rateMs = N <= 20 ? 0 : N <= 50 ? 35 : 60;

    const matchesRaw = await fetchMatches(rc, region as RegionGroup, ids, conc, rateMs);
    const matchesMode = filterByMode(matchesRaw, mode);

    // History rows (include items/trinket/queueName)
    const history = toHistoryRows(account.puuid, matchesMode);

    // SR-only analytics ONLY for SR modes (ranked/unranked)
    const doSrOnly = srOnly && (mode === "ranked" || mode === "unranked");
    const analyticsBase = doSrOnly ? onlySummonersRift(matchesMode) : matchesMode;

    const summary = aggregateForPuuid(account.puuid, analyticsBase);

    // --- Add Mastery (top 3) ---
    let masteryTop: Array<{ championId: number; championPoints: number }> = [];
    try {
      if (profile.platform) {
        const mastery = await rc.getChampionMasteryByPuuid(profile.platform, account.puuid);
        masteryTop = (mastery || [])
          .sort((a: any, b: any) => b.championPoints - a.championPoints)
          .slice(0, 3)
          .map((m: any) => ({
            championId: Number(m.championId),
            championPoints: Number(m.championPoints),
          }));
      }
    } catch {
      // best effort
    }

    // --- Add lane-phase to first ~12 rows (quick & useful) ---
    const historyWithPhase = await (async () => {
      const out = [...history];
      const cap = Math.min(out.length, 12);
      if (cap === 0) return out;

      const timelines = await Promise.all(
        out.slice(0, cap).map(async (row) => {
          try {
            const tl = await rc.getMatchTimeline(region as RegionGroup, row.id);
            return { id: row.id, tl };
          } catch {
            return { id: row.id, tl: null };
          }
        })
      );

      const map = new Map(timelines.map((t) => [t.id, t.tl]));
      for (let i = 0; i < cap; i++) {
        const row = out[i];
        const tl = map.get(row.id);
        if (!tl) continue;
        (row as any).lanePhase = computeLanePhaseFromTimeline(tl, account.puuid);
      }
      return out;
    })();

    // --- Respond ---
    return NextResponse.json(
      {
        account: {
          gameName: account.gameName,
          tagLine: account.tagLine,
          puuid: account.puuid,
        },
        profile,
        ...summary,
        history: historyWithPhase,
        masteryTop,
        _meta: { ids: ids.length, mode, srOnly: doSrOnly },
      },
      { headers: { "Cache-Control": "s-maxage=60" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
