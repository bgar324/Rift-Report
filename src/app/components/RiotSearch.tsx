"use client";

import { useEffect, useRef, useState } from "react";

/* ---------- Glass styles (light mode only) ---------- */
const glassChipBase =
  "rounded-full px-3 py-1 text-xs uppercase font-medium transition " +
  "backdrop-blur-md bg-gradient-to-b from-white/40 to-white/20 border border-black/10 " +
  "text-neutral-800 hover:from-white/60 hover:to-white/40 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20";
const glassChipActive =
  "from-white/80 to-white/60 border-black/20 text-black shadow-md ring-1 ring-black/10";
const glassChipInactive =
  "text-neutral-600 hover:text-neutral-900";

const glassInput =
  "rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm shadow-inner outline-none " +
  "placeholder:text-neutral-500 focus:ring-2 focus:ring-black/10";
const glassSelect =
  "w-32 rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm uppercase focus:ring-2 focus:ring-black/10";
const glassPrimaryBtn =
  "rounded-xl px-5 py-3 text-sm font-medium shadow-md transition " +
  "bg-black text-white hover:opacity-90 disabled:opacity-50 cursor-pointer";

/* ---------- Types ---------- */
export type ChampIndex = { version: string; nameToId: Record<string, string> };
export type Mode = "all" | "ranked" | "unranked" | "aram" | "arena";

export type LanePhase = {
  cs10: number; cs15: number;
  goldDiff10: number; goldDiff15: number;
  xpDiff10: number; xpDiff15: number;
  mythicAt?: number | null;
};

export type SummaryPayload = {
  account: { gameName: string; tagLine: string; puuid: string };
  profile?: { profileIconId: number | null; summonerLevel: number | null; platform: string | null };
  totals: { matches: number; wins: number; losses: number; kills: number; deaths: number; assists: number; winrate: number; kda: number };
  streak: { type: "win" | "loss" | "none"; count: number };
  roles: { role: string; count: number }[];
  champions: { champion: string; games: number; wins: number; losses: number; winrate: number; kills: number; deaths: number; assists: number; kda: number }[];
  powerPicks: { champion: string; games: number; playerWinrate: number; globalWinrate: number; diff: number }[];
  history: ({
    id: string; ts: number; queueId: number; mapId: number; win: boolean;
    champion: string; kills: number; deaths: number; assists: number; kda: number; cs: number; role: string; duration: number;
    items?: number[]; trinket?: number | null;
    lanePhase?: LanePhase; // NEW
  })[];
  masteryTop?: { championId: number; championPoints: number }[];
  _meta?: any;
};

export type SummaryWithChamps = SummaryPayload & { _champs: ChampIndex };

/* ---------- Data Dragon helpers ---------- */
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
  useEffect(() => {
    let done = false;
    loadChampionIndex().then(v => { if (!done) setIdx(v); });
    return () => { done = true; };
  }, []);
  return idx;
}

/* ---------- Component ---------- */
export default function RiotSearch({ onAnalyzed }: { onAnalyzed: (p: SummaryWithChamps) => void }) {
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("americas");
  const [mode, setMode] = useState<Mode>("all");
  const [size, setSize] = useState<"5" | "20" | "50" | "100" | "all">("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const champs = useChampionIndex();
  const hasSearched = useRef(false);

  async function run() {
    try {
      setLoading(true);
      setError("");
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

  // Auto re-run on mode/size change after first analyze
  useEffect(() => {
    if (hasSearched.current && riotId.includes("#") && !loading) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, size]);

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Input row */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className={`${glassInput} flex-1`}
            placeholder="Riot ID, e.g., Faker#KR1"
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
          />
        <div className="flex gap-3">
            <select
              className={glassSelect}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {["americas", "europe", "asia", "sea"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button onClick={run} className={glassPrimaryBtn} disabled={loading || !champs}>
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>

        {/* Mode + sample-size row (glass chips) */}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <label className="text-neutral-600 text-xs">Mode:</label>
          {(["all", "ranked", "unranked", "aram", "arena"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`${glassChipBase} ${mode === m ? glassChipActive : glassChipInactive}`}
            >
              {m.toUpperCase()}
            </button>
          ))}

          <span className="mx-2 hidden h-4 w-px bg-black/10 sm:inline-block" />

          <label className="text-neutral-600 text-xs">Sample:</label>
          {(["5", "20", "50", "100", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              aria-pressed={size === s}
              className={`${glassChipBase} ${size === s ? glassChipActive : glassChipInactive}`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mt-2 text-center text-xs text-red-500">{error}</div>}
    </>
  );
}
