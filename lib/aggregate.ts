// lib/aggregate.ts
export type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "SUPPORT";

function inferRole(p: any): Role {
  // Prefer Riot labels if present
  const tp = (p?.teamPosition || p?.individualPosition || "").toUpperCase();
  if (tp === "TOP") return "TOP";
  if (tp === "JUNGLE") return "JUNGLE";
  if (tp === "MIDDLE" || tp === "MID") return "MIDDLE";
  if (tp === "BOTTOM" || tp === "BOT" || tp === "ADC") return "BOTTOM";
  if (tp === "UTILITY" || tp === "SUPPORT") return "SUPPORT";

  // Heuristic 1: Smite => Jungle
  const SMITE = 11;
  if (p?.summoner1Id === SMITE || p?.summoner2Id === SMITE) return "JUNGLE";

  // Heuristic 2: Support starting items
  const SUPPORT_ITEMS = new Set<number>([
    3850, 3851, 3853, 3854, // Spellthief
    3858, 3859, 3860, 3862, // Relic/Steel Shoulders
    3869, 3870, 3871, 3874, // Spectral lines (seasonal variants)
  ]);
  for (let i = 0; i <= 6; i++) {
    const id = p?.[`item${i}`];
    if (id && SUPPORT_ITEMS.has(id)) return "SUPPORT";
  }

  // Heuristic 3: Very low CS → likely Support
  const cs = (p?.totalMinionsKilled || 0) + (p?.neutralMinionsKilled || 0);
  if (cs < 120) return "SUPPORT";

  // Fallback
  return "MIDDLE";
}

export type Summary = {
  totals: { matches: number; wins: number; losses: number; kills: number; deaths: number; assists: number; winrate: number; kda: number; };
  streak: { type: "win" | "loss" | "none"; count: number; };
  roles: { role: Role; count: number }[];
  champions: { champion: string; games: number; wins: number; losses: number; winrate: number; kills: number; deaths: number; assists: number; kda: number; }[];
  powerPicks: { champion: string; games: number; playerWinrate: number; globalWinrate: number; diff: number; }[];
};

export function aggregateForPuuid(puuid: string, matches: any[]): Summary {
  const roleAgg: Record<Role, number> = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, SUPPORT: 0 };
  const championAgg: Record<string, { games: number; wins: number; kills: number; deaths: number; assists: number }> = {};
  const perWin: boolean[] = [];
  const perP: any[] = [];

  for (const m of matches) {
    const p = m?.info?.participants?.find((pp: any) => pp?.puuid === puuid);
    if (!p) continue;
    perP.push(p);

    const role = inferRole(p);
    roleAgg[role]++;

    const c = p.championName || "Unknown";
    (championAgg[c] ||= { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 });
    const a = championAgg[c];
    a.games++;
    if (p.win) a.wins++;
    a.kills += p.kills || 0;
    a.deaths += p.deaths || 0;
    a.assists += p.assists || 0;

    perWin.push(Boolean(p.win));
  }

  const totals = perP.reduce((t, p) => {
    t.matches++;
    if (p.win) t.wins++; else t.losses++;
    t.kills += p.kills || 0;
    t.deaths += p.deaths || 0;
    t.assists += p.assists || 0;
    return t;
  }, { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 });

  const winrate = totals.matches ? Math.round((totals.wins / totals.matches) * 1000) / 10 : 0;
  const kda = totals.deaths ? Math.round(((totals.kills + totals.assists) / totals.deaths) * 10) / 10 : (totals.kills + totals.assists);

  let streakType: "win" | "loss" | "none" = "none";
  let streakCount = 0;
  if (perWin.length) {
    const first = perWin[0];
    streakType = first ? "win" : "loss";
    for (const w of perWin) { if (w === first) streakCount++; else break; }
  }

  const champions = Object.entries(championAgg).map(([champion, v]) => {
    const d = v.deaths || 0;
    const ckda = d ? (v.kills + v.assists) / d : v.kills + v.assists;
    return {
      champion,
      games: v.games,
      wins: v.wins,
      losses: v.games - v.wins,
      winrate: Math.round((v.wins / v.games) * 1000) / 10,
      kills: v.kills,
      deaths: v.deaths,
      assists: v.assists,
      kda: Math.round(ckda * 10) / 10
    };
  }).sort((a, b) => b.games - a.games);

  const roles = Object.entries(roleAgg)
    .filter(([, c]) => c > 0)
    .map(([role, count]) => ({ role: role as Role, count }))
    .sort((a, b) => b.count - a.count);

  const powerPicks = champions
    .filter(c => c.games >= 3)
    .map(c => ({
      champion: c.champion,
      games: c.games,
      playerWinrate: c.winrate,
      globalWinrate: winrate,
      diff: Math.round((c.winrate - winrate) * 10) / 10
    }))
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);

  return { totals: { ...totals, winrate, kda }, streak: { type: streakType, count: streakCount }, roles, champions, powerPicks };
}
