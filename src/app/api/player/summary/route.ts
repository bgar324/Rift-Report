import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

import { RiotClient, assertRegionGroup, RegionGroup, platformFromMatchId} from "../../../../../lib/riot";
import { loadMatchIds, fetchMatches } from "../../../../..//lib/matches";
import { aggregateForPuuid } from "../../../../..//lib/aggregate";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const riotId = (searchParams.get("riotId") || "").trim();
    const region = (searchParams.get("region") || "americas").trim().toLowerCase();
    assertRegionGroup(region);

    const count = Math.min(parseInt(searchParams.get("count") || "20", 10) || 20, 100);
    const fetchAll = ["1","true"].includes((searchParams.get("all") || "").trim().toLowerCase());
    const maxIds = Math.min(parseInt(searchParams.get("max") || "300", 10) || 300, 1000);
    const queue = searchParams.get("queue") || undefined;
    const startTime = searchParams.get("startTime") || undefined;
    const endTime = searchParams.get("endTime") || undefined;

    const [gameName, tagLine] = riotId.split("#");
    if (!gameName || !tagLine) return NextResponse.json({ error: "Invalid Riot ID. Use GameName#TagLine" }, { status: 400 });

    const apiKey = process.env.RIOT_API_KEY!;
    const rc = new RiotClient(apiKey);

    const account = await rc.getAccountByRiotId(region as RegionGroup, gameName, tagLine);

    const ids = await loadMatchIds(rc, region as RegionGroup, account.puuid, {
      count, all: fetchAll, max: maxIds, queue, startTime, endTime
    });

    if (!ids.length) {
      return NextResponse.json({
        account: { gameName: account.gameName, tagLine: account.tagLine, puuid: account.puuid },
        totals:{matches:0,wins:0,losses:0,kills:0,deaths:0,assists:0,winrate:0,kda:0},
        streak:{type:"none",count:0}, roles:[], champions:[], powerPicks:[], profileIconId:null
      }, { headers: { "Cache-Control": "s-maxage=60" } });
    }

    // (New) Get platform from first match id to fetch Summoner and iconId
    const platform = platformFromMatchId(ids[0]); // e.g., 'na1'
    const summ = await rc.getSummonerByPuuid(platform, account.puuid); // has profileIconId, summonerLevel

    const matches = await fetchMatches(rc, region as RegionGroup, ids, 16);
    const summary = aggregateForPuuid(account.puuid, matches);

    return NextResponse.json({
      account: { gameName: account.gameName, tagLine: account.tagLine, puuid: account.puuid },
      profile: { profileIconId: summ?.profileIconId ?? null, summonerLevel: summ?.summonerLevel ?? null, platform },
      ...summary
    }, { headers: { "Cache-Control": "s-maxage=60" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}
