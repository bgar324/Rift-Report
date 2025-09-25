import { RiotClient, RegionGroup } from "./riot";
import { LRU } from "./lru";

const matchCache = new LRU<string, any>(600);

export async function loadMatchIds(
  client: RiotClient,
  group: RegionGroup,
  puuid: string,
  { count, all, max, queue, startTime, endTime }: { count: number; all: boolean; max: number; queue?: string; startTime?: string; endTime?: string; }
): Promise<string[]> {
  const base = new URLSearchParams();
  if (queue) base.set("queue", queue);
  if (startTime) base.set("startTime", startTime);
  if (endTime) base.set("endTime", endTime);

  if (!all) {
    base.set("start", "0"); base.set("count", String(count));
    return client.getMatchIdsByPuuid(group, puuid, base);
  }

  // paged "all" mode
  const page = Math.min(count, 100);
  let start = 0; const out: string[] = [];
  while (out.length < max) {
    const qs = new URLSearchParams(base); qs.set("start", String(start)); qs.set("count", String(page));
    const ids: string[] = await client.getMatchIdsByPuuid(group, puuid, qs);
    if (!ids?.length) break;
    out.push(...ids);
    if (ids.length < page) break;
    start += page;
    if (start >= 5000) break;
  }
  return out.slice(0, max);
}

export async function fetchMatches(
  client: RiotClient, group: RegionGroup, ids: string[], concurrency = 16
) {
  const results: any[] = new Array(ids.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
    while (true) {
      const idx = i++; if (idx >= ids.length) break;
      const id = ids[idx];
      const cached = matchCache.get(id);
      if (cached) { results[idx] = cached; continue; }
      try {
        const m = await client.getMatchById(group, id);
        matchCache.set(id, m);
        results[idx] = m;
      } catch {}
    }
  }));
  return results.filter(Boolean);
}
