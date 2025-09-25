"use client";

import { useState } from "react";

export default function Home() {
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("americas");
  const [windowSize, setWindowSize] = useState<"5" | "20" | "50" | "100" | "all">("20");
  const [maxAll, setMaxAll] = useState<number>(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<any | null>(null);

  async function analyze() {
    try {
      setLoading(true);
      setError("");
      setData(null);
      if (!riotId.includes("#")) throw new Error("Enter Riot ID like GameName#TAG");
      const params = new URLSearchParams({ riotId, region });
      if (windowSize === "all") {
        params.set("all", "1");
        params.set("count", "100");
        params.set("max", String(maxAll));
      } else {
        params.set("count", windowSize);
      }
      const res = await fetch(`/api/player/summary?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
      const json = await res.json();
      if (json?.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 md:py-16">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="glass-strong p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-semibold">Rift Report</h1>
          <p className="mt-2 text-sm md:text-base text-neutral-600 dark:text-neutral-400">Personalized League performance analytics</p>

          <div className="mt-6 flex flex-col lg:flex-row gap-3 items-stretch">
            <input
              className="glass-soft px-3 py-2 flex-1 focus:outline-none"
              placeholder="Riot ID, e.g., Faker#KR1"
              value={riotId}
              onChange={(e) => setRiotId(e.target.value)}
            />
            <select
              className="glass-soft px-3 py-2 uppercase"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="americas">americas</option>
              <option value="europe">europe</option>
              <option value="asia">asia</option>
              <option value="sea">sea</option>
            </select>

            <select
              className="glass-soft px-3 py-2"
              value={windowSize}
              onChange={(e) => setWindowSize(e.target.value as any)}
              title="Match window"
            >
              <option value="5">5</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all">All (capped)</option>
            </select>

            {windowSize === "all" && (
              <input
                type="number"
                min={50}
                max={1000}
                className="glass-soft px-3 py-2 w-32"
                value={maxAll}
                onChange={(e) => setMaxAll(Math.min(1000, Math.max(50, Number(e.target.value))))}
                placeholder="Max (all)"
                title="Max matches to fetch in All mode"
              />
            )}

            <button
              onClick={analyze}
              className="glass-strong px-4 py-2 font-medium hover:ring-white/30 transition"
              disabled={loading}
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>

          {error && <div className="mt-3 text-red-500 text-sm">{error}</div>}
        </header>

        {data && (
          <div className="space-y-8">
            <section className="glass p-6 md:p-8">
              <h2 className="section-title">Account</h2>
              <div className="mt-2 text-sm">
                <span className="font-medium">
                  {data.account?.gameName}#{data.account?.tagLine}
                </span>
              </div>
            </section>

            <section className="glass p-6 md:p-8">
              <h2 className="section-title">Totals</h2>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="glass-soft p-4">
                  <div className="card-title-muted">Matches</div>
                  <div className="text-lg font-medium">{data.totals?.matches ?? 0}</div>
                </div>
                <div className="glass-soft p-4">
                  <div className="card-title-muted">Winrate</div>
                  <div className="text-lg font-medium">{data.totals?.winrate ?? 0}%</div>
                </div>
                <div className="glass-soft p-4">
                  <div className="card-title-muted">Record</div>
                  <div className="text-lg font-medium">
                    {data.totals?.wins ?? 0}W {data.totals?.losses ?? 0}L
                  </div>
                </div>
                <div className="glass-soft p-4">
                  <div className="card-title-muted">K/D/A</div>
                  <div className="text-lg font-medium">
                    {data.totals?.kills ?? 0}/{data.totals?.deaths ?? 0}/{data.totals?.assists ?? 0} ({data.totals?.kda ?? 0})
                  </div>
                </div>
              </div>
            </section>

            <section className="glass p-6 md:p-8">
              <h2 className="section-title">Current Streak</h2>
              <p className="mt-2 text-sm">
                {data.streak?.type === "none"
                  ? "No streak"
                  : `${data.streak?.type === "win" ? "Win" : "Loss"} streak: ${data.streak?.count}`}
              </p>
            </section>

            <section className="glass p-6 md:p-8">
              <h2 className="section-title">Power Picks</h2>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(data.powerPicks || []).map((p: any) => (
                  <div key={p.champion} className="glass-soft p-4">
                    <div className="font-medium">{p.champion}</div>
                    <div className="card-title-muted">Games {p.games}</div>
                    <div className="text-sm">Player {p.playerWinrate}% vs Global {p.globalWinrate}%</div>
                    <div className={`${p.diff >= 0 ? "text-green-600" : "text-red-600"} text-sm`}>Δ {p.diff}%</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass p-6 md:p-8">
              <h2 className="section-title">Roles</h2>
              <ul className="mt-3 list-disc list-inside text-sm space-y-1">
                {(data.roles || []).map((r: any) => (
                  <li key={r.role}>
                    {r.role}: {r.count}
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass p-6 md:p-8">
              <h2 className="section-title">By Champion</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left">
                    <tr>
                      <th className="p-2">Champion</th>
                      <th className="p-2">Games</th>
                      <th className="p-2">Wins</th>
                      <th className="p-2">Losses</th>
                      <th className="p-2">Winrate</th>
                      <th className="p-2">K</th>
                      <th className="p-2">D</th>
                      <th className="p-2">A</th>
                      <th className="p-2">KDA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.champions || []).map((r: any) => (
                      <tr key={r.champion} className="border-t border-white/10">
                        <td className="p-2">{r.champion}</td>
                        <td className="p-2">{r.games}</td>
                        <td className="p-2">{r.wins}</td>
                        <td className="p-2">{r.losses}</td>
                        <td className="p-2">{r.winrate}%</td>
                        <td className="p-2">{r.kills}</td>
                        <td className="p-2">{r.deaths}</td>
                        <td className="p-2">{r.assists}</td>
                        <td className="p-2">{r.kda}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
