// lib/riot.ts
export type RegionGroup = "americas" | "europe" | "asia" | "sea";
/** Platform routing keys (derived from match ID prefixes). */
export type Platform =
  | "na1" | "br1" | "la1" | "la2" | "oc1"
  | "euw1" | "eun1" | "tr1" | "ru"
  | "kr" | "jp1"
  | "ph2" | "sg2" | "th2" | "tw2" | "vn2";

const REGION_GROUPS = new Set<RegionGroup>(["americas", "europe", "asia", "sea"]);
const DEFAULT_TIMEOUT = 8000;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithTimeout(url: string, init: RequestInit, ms = DEFAULT_TIMEOUT) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); }
  finally { clearTimeout(t); }
}

export class RiotClient {
  private apiKey: string;
  private backoffMs = 0;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("Missing RIOT_API_KEY");
    this.apiKey = apiKey;
  }

  private async getJson(url: string, retries = 3): Promise<any> {
    if (this.backoffMs) await sleep(this.backoffMs);

    const res = await fetchWithTimeout(url, {
      headers: { "X-Riot-Token": this.apiKey },
      cache: "no-store",
    });

    if (res.status === 429 && retries > 0) {
      const retryAfter = Number(res.headers.get("Retry-After") || "1");
      this.backoffMs = Math.max(this.backoffMs, retryAfter * 1000);
      await sleep(this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2 || 500, 8000);
      return this.getJson(url, retries - 1);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => url);
      throw new Error(`Riot API ${res.status}: ${body}`);
    }

    this.backoffMs = Math.max(0, Math.floor(this.backoffMs / 2));
    return res.json();
  }

  // ---- Account / Summoner
  getAccountByRiotId = (group: RegionGroup, gameName: string, tagLine: string) =>
    this.getJson(
      `https://${group}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`
    );

  getSummonerByPuuid = (platform: Platform | string, puuid: string) =>
    this.getJson(
      `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
    );

  // ---- Matches
  getMatchIdsByPuuid = (group: RegionGroup, puuid: string, qs: URLSearchParams) =>
    this.getJson(
      `https://${group}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${qs}`
    );

  getMatchById = (group: RegionGroup, matchId: string) =>
    this.getJson(
      `https://${group}.api.riotgames.com/lol/match/v5/matches/${matchId}`
    );

  /** NEW: Match timeline (for CS/gold/xp splits, item timings, objective events). */
  getMatchTimeline = (group: RegionGroup, matchId: string) =>
    this.getJson(
      `https://${group}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`
    );

  /** NEW: Champion mastery by puuid (platform-routed). */
  getChampionMasteryByPuuid = (platform: Platform | string, puuid: string) =>
    this.getJson(
      `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`
    );

  /** NEW: Ranked entries (optional context). */
  getLeagueEntriesBySummoner = (platform: Platform | string, summonerId: string) =>
    this.getJson(
      `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`
    );
}

// helpers
export function assertRegionGroup(v: string): asserts v is RegionGroup {
  if (!REGION_GROUPS.has(v as RegionGroup)) {
    throw new Error(`Invalid region group. Use: ${Array.from(REGION_GROUPS).join(", ")}`);
  }
}

/** Derive platform (routing value) from a matchId like "NA1_123..." → "na1". */
export function platformFromMatchId(matchId: string): Platform | string {
  const prefix = matchId.split("_")[0]?.toLowerCase();
  return (prefix || "na1") as Platform | string;
}
