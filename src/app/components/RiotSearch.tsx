"use client";

import { useEffect, useState } from "react";

export type ChampIndex = { version: string; nameToId: Record<string, string> };

export type SummaryPayload = {
  account: { gameName: string; tagLine: string; puuid: string };
  profile?: { profileIconId: number | null; summonerLevel: number | null; platform: string | null };
  totals: { matches: number; wins: number; losses: number; kills: number; deaths: number; assists: number; winrate: number; kda: number };
  streak: { type: "win" | "loss" | "none"; count: number };
  roles: { role: string; count: number }[];
  champions: { champion: string; games: number; wins: number; losses: number; winrate: number; kills: number; deaths: number; assists: number; kda: number }[];
  powerPicks: { champion: string; games: number; playerWinrate: number; globalWinrate: number; diff: number }[];
};

// ✅ this is what ResultsPanel expects
export type SummaryWithChamps = SummaryPayload & { _champs: ChampIndex };

async function loadChampionIndex(): Promise<ChampIndex> {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then(r => r.json());
  const version = versions[0];
  const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`).then(r => r.json());
  const nameToId: Record<string, string> = {};
  for (const k of Object.keys(data.data)) nameToId[data.data[k].name] = data.data[k].id;
  return { version, nameToId };
}

function useChampionIndex() {
  const [idx, setIdx] = useState<ChampIndex | null>(null);
  useEffect(() => { let done = false; loadChampionIndex().then(v => { if (!done) setIdx(v); }); return () => { done = true; }; }, []);
  return idx;
}

export function champIcon(version: string, id: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
}

export default function RiotSearch({ onAnalyzed }: { onAnalyzed: (p: SummaryWithChamps) => void }) {
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("americas");
  const [windowSize, setWindowSize] = useState<"5" | "20" | "50" | "100" | "all">("20");
  const [maxAll, setMaxAll] = useState<number>(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const champs = useChampionIndex();

  async function analyze() {
    try {
      setLoading(true); setError("");
      if (!riotId.includes("#")) throw new Error("Enter Riot ID like GameName#TAG");
      const params = new URLSearchParams({ riotId, region });
      if (windowSize === "all") { params.set("all", "1"); params.set("count", "100"); params.set("max", String(maxAll)); }
      else { params.set("count", windowSize); }
      const res = await fetch(`/api/player/summary?${params.toString()}`, { cache: "no-store" });
      let json: any = null; try { json = await res.json(); } catch {}
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      if (json?.error) throw new Error(json.error);
      if (champs) onAnalyzed({ ...json, _champs: champs });
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 rounded-xl border border-white/10 bg-white/70 px-4 py-3 text-sm shadow-inner outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-black/10 dark:bg-white/5 dark:placeholder:text-neutral-400"
          placeholder="Riot ID, e.g., Faker#KR1"
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
        />
        <div className="flex gap-3">
          <select
            className="w-32 rounded-xl border border-white/10 bg-white/70 px-3 py-3 text-sm uppercase dark:bg-white/5"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            {["americas", "europe", "asia", "sea"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            className="w-28 rounded-xl border border-white/10 bg-white/70 px-3 py-3 text-sm dark:bg-white/5"
            value={windowSize}
            onChange={(e) => setWindowSize(e.target.value as any)}
            title="Match window"
          >
            {["5","20","50","100","all"].map(v => <option key={v} value={v}>{v === "all" ? "All" : v}</option>)}
          </select>
          {windowSize === "all" && (
            <input
              type="number" min={50} max={1000}
              className="w-24 rounded-xl border border-white/10 bg-white/70 px-3 py-3 text-sm dark:bg-white/5"
              value={maxAll}
              onChange={(e) => setMaxAll(Math.min(1000, Math.max(50, Number(e.target.value))))}
              title="Max matches in All mode"
            />
          )}
          <button
            onClick={analyze}
            className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white shadow-md hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
            disabled={loading || !champs}
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>
      {error && <div className="mt-2 text-center text-xs text-red-500">{error}</div>}
    </>
  );
}
