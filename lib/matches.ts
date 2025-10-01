// lib/matches.ts
import { RiotClient, RegionGroup } from "./riot";
import { LRU } from "./lru";

const matchCache = new LRU<string, any>(600);

/** Simple sleep helper for throttling */
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/** Load match IDs with optional queue/time scoping. Paged when `all=true`. */
export async function loadMatchIds(
  client: RiotClient,
  group: RegionGroup,
  puuid: string,
  {
    count,
    all,
    max,
    queue,
    startTime,
    endTime,
  }: {
    count: number;
    all: boolean;
    max: number;
    queue?: string;
    startTime?: string;
    endTime?: string;
  }
): Promise<string[]> {
  const base = new URLSearchParams();
  if (queue) base.set("queue", queue);
  if (startTime) base.set("startTime", startTime);
  if (endTime) base.set("endTime", endTime);

  if (!all) {
    base.set("start", "0");
    base.set("count", String(count));
    return client.getMatchIdsByPuuid(group, puuid, base);
  }

  // Paged "all" mode (safe caps).
  const page = Math.min(count, 100);
  let start = 0;
  const out: string[] = [];
  while (out.length < max) {
    const qs = new URLSearchParams(base);
    qs.set("start", String(start));
    qs.set("count", String(page));
    const ids: string[] = await client.getMatchIdsByPuuid(group, puuid, qs);
    if (!ids?.length) break;
    out.push(...ids);
    if (ids.length < page) break;
    start += page;
    if (start >= 5000) break;
  }
  return out.slice(0, max);
}

/**
 * Fetch matches with concurrency + optional global throttle.
 * `rateMs`: ~minimum milliseconds between requests across all workers (to avoid 429 bursts).
 */
export async function fetchMatches(
  client: RiotClient,
  group: RegionGroup,
  ids: string[],
  concurrency = 16,
  rateMs = 0
) {
  const results: any[] = new Array(ids.length);
  let i = 0;

  // Global throttle token bucket
  let nextAt = Date.now();
  const takeToken = async () => {
    if (rateMs <= 0) return;
    const now = Date.now();
    const wait = Math.max(0, nextAt - now);
    if (wait) await sleep(wait);
    nextAt = Math.max(nextAt, now) + rateMs;
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= ids.length) break;
        const id = ids[idx];

        const cached = matchCache.get(id);
        if (cached) {
          results[idx] = cached;
          continue;
        }

        try {
          await takeToken();
          const m = await client.getMatchById(group, id);
          matchCache.set(id, m);
          results[idx] = m;
        } catch {
          // swallow per-match errors to keep the batch moving
        }
      }
    })
  );

  return results.filter(Boolean);
}

/** Filter by common modes using queueId groups. */
export function filterByMode(
  matches: any[],
  mode: "all" | "ranked" | "unranked" | "aram" | "arena"
) {
  const q = (m: any) => Number(m?.info?.queueId || 0);

  // Ranked SR
  const RANKED = new Set([420, 440]); // Solo/Duo, Flex
  // Unranked SR (Normals / Quickplay)
  const UNRANKED = new Set([400, 430, 490]); // Draft, Blind, Quickplay
  // ARAM
  const ARAM = new Set([450]);
  // ARENA
  const ARENA = new Set([1700]);

  if (mode === "ranked") return matches.filter((m) => RANKED.has(q(m)));
  if (mode === "unranked") return matches.filter((m) => UNRANKED.has(q(m)));
  if (mode === "aram") return matches.filter((m) => ARAM.has(q(m)));
  if (mode === "arena") return matches.filter((m) => ARENA.has(q(m)));
  return matches; // all
}

/** Keep only Summoner's Rift (mapId === 11). */
export function onlySummonersRift(matches: any[]) {
  return matches.filter((m) => Number(m?.info?.mapId || 0) === 11);
}

/** Human label for common queues (extend as needed). */
export function queueLabel(queueId: number): string {
  switch (queueId) {
    // Ranked SR
    case 420: return "Ranked Solo/Duo";
    case 440: return "Ranked Flex";
    // Normals / Quickplay SR
    case 400: return "Normal Draft";
    case 430: return "Normal Blind";
    case 490: return "Quickplay";
    // ARAM
    case 450: return "ARAM";
    // ARENA
    case 1700: return "Arena";
    // (kept for completeness)
    case 700: return "Clash";
    case 900:
    case 1900: return "URF";
    default: return "Other";
  }
}

/** Minimal row for match history UI (with end-of-game items + queueName). */
export function toHistoryRows(puuid: string, matches: any[]) {
  return matches.map((m) => {
    const p = m?.info?.participants?.find((pp: any) => pp?.puuid === puuid);
    const dur = Math.max(0, Number(m?.info?.gameDuration || 0));
    const qid = Number(m?.info?.queueId || 0);

    // items at end of game: item0..item5; item6 trinket
    const items: number[] = [];
    for (let i = 0; i <= 5; i++) {
      const id = Number(p?.[`item${i}`] || 0);
      if (id) items.push(id);
    }
    const trinket = Number(p?.item6 || 0) || null;

    return {
      id: m?.metadata?.matchId as string,
      ts: Number(m?.info?.gameStartTimestamp || m?.info?.gameCreation || 0),
      queueId: qid,
      queueName: queueLabel(qid),
      mapId: Number(m?.info?.mapId || 0),
      win: Boolean(p?.win),
      champion: String(p?.championName || "Unknown"),
      kills: Number(p?.kills || 0),
      deaths: Number(p?.deaths || 0),
      assists: Number(p?.assists || 0),
      kda: p?.deaths ? (p.kills + p.assists) / p.deaths : p?.kills + p?.assists,
      cs: Number(p?.totalMinionsKilled || 0) + Number(p?.neutralMinionsKilled || 0),
      role: String(p?.teamPosition || p?.individualPosition || "MIDDLE"),
      duration: dur,
      items,
      trinket,
    };
  });
}
