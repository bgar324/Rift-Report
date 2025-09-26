"use client";

import { useEffect, useRef, useState } from "react";

export type ChampIndex = { version: string; nameToId: Record<string, string> };

/** ✅ Narrowed modes (removed clash/urf; added arena) */
export type Mode = "all" | "ranked" | "unranked" | "aram" | "arena";

/** ✅ History rows now include items + trinket  */
export type SummaryPayload = {
  account: { gameName: string; tagLine: string; puuid: string };
  profile?: { profileIconId: number | null; summonerLevel: number | null; platform: string | null };
  totals: { matches: number; wins: number; losses: number; kills: number; deaths: number; assists: number; winrate: number; kda: number };
  streak: { type: "win" | "loss" | "none"; count: number };
  roles: { role: string; count: number }[];
  champions: { champion: string; games: number; wins: number; losses: number; winrate: number; kills: number; deaths: number; assists: number; kda: number }[];
  powerPicks: { champion: string; games: number; playerWinrate: number; globalWinrate: number; diff: number }[];
  history: {
    id: string;
    ts: number;
    queueId: number;
    mapId: number;
    win: boolean;
    champion: string;
    kills: number;
    deaths: number;
    assists: number;
    kda: number;
    cs: number;
    role: string;
    duration: number;
    /** ✅ new fields coming from API */
    items?: number[];
    trinket?: number | null;
  }[];
  _meta?: any;
};

/** ✅ what ResultsPanel expects */
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

export default function RiotSearch({ onAnalyzed }: { onAnalyzed: (p: SummaryWithChamps) => void }) {
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("americas");
  /** ✅ use the narrowed Mode union */
  const [mode, setMode] = useState<Mode>("all");
  const [size, setSize] = useState<"5" | "20" | "50" | "100" | "all">("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const champs = useChampionIndex();
  const hasSearched = useRef(false);

  async function run() {
    try {
      setLoading(true); setError("");
      if (!riotId.includes("#")) throw new Error("Enter Riot ID like GameName#TAG");
      const params = new URLSearchParams({ riotId, region, mode, size, srOnly: "1" });
      const res = await fetch(`/api/player/summary?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      if (champs) { onAnalyzed({ ...json, _champs: champs }); hasSearched.current = true; }
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // auto re-run on mode/size change after first analyze
  useEffect(() => { if (hasSearched.current && riotId.includes("#") && !loading) run(); /* eslint-disable-next-line */ }, [mode, size]);

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="flex-1 rounded-xl border border-white/10 bg-white/70 px-4 py-3 text-sm shadow-inner outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-black/10 dark:bg-white/5 dark:placeholder:text-neutral-400"
            placeholder="Riot ID, e.g., Faker#KR1"
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
          />
          <div className="flex gap-3">
            <select className="w-32 rounded-xl border border-white/10 bg-white/70 px-3 py-3 text-sm uppercase dark:bg-white/5" value={region} onChange={(e)=>setRegion(e.target.value)}>
              {["americas","europe","asia","sea"].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={run} className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white shadow-md hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black" disabled={loading || !champs}>
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>

        {/* Mode + sample-size row (no clash/urf) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="text-neutral-500">Mode:</label>
          {(["all","ranked","unranked","aram","arena"] as const).map(m => (
            <button key={m} onClick={()=>setMode(m)}
              className={`rounded-full border px-3 py-1 ${mode===m ? "bg-black text-white border-black dark:bg-white dark:text-black" : "bg-white/40 dark:bg-white/10 border-white/20"}`}>
              {m.toUpperCase()}
            </button>
          ))}
          <span className="mx-2 h-4 w-px bg-white/20" />
          <label className="text-neutral-500">Sample:</label>
          {(["5","20","50","100","all"] as const).map(s => (
            <button key={s} onClick={()=>setSize(s)}
              className={`rounded-full border px-3 py-1 ${size===s ? "bg-black text-white border-black dark:bg-white dark:text-black" : "bg-white/40 dark:bg-white/10 border-white/20"}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mt-2 text-center text-xs text-red-500">{error}</div>}
    </>
  );
}
