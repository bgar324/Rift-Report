"use client";

import { useState } from "react";

export default function Home() {
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("americas");
  const [mock, setMock] = useState(false);
  const [windowSize, setWindowSize] = useState<"5" | "20" | "50" | "100" | "all">("20");
  const [start, setStart] = useState<number>(0);
  const [maxAll, setMaxAll] = useState<number>(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<any | null>(null);

  async function analyze() {
    try {
      setLoading(true);
      setError("");
      setData(null);
      if (!riotId.includes("#")) {
        throw new Error("Enter Riot ID like GameName#TAG");
      }
      const params = new URLSearchParams({ riotId, region });
      if (windowSize === "all") {
        params.set("all", "1");
        params.set("count", "100"); // per-page size when fetching all
        params.set("max", String(maxAll));
      } else {
        params.set("count", windowSize);
        params.set("start", String(start));
      }
      if (mock) params.set("mock", "1");

      const res = await fetch(`/api/player/summary?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed (${res.status})`);
      }
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
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold">LoL Performance Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1">Enter your Riot ID (e.g., Faker#KR1) and select your region group.</p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch">
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="Riot ID, e.g., Faker#KR1"
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="americas">americas</option>
          <option value="europe">europe</option>
          <option value="asia">asia</option>
          <option value="sea">sea</option>
        </select>

        <select
          className="border rounded px-3 py-2"
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

        {windowSize !== "all" ? (
          <input
            type="number"
            min={0}
            className="border rounded px-3 py-2 w-28"
            value={start}
            onChange={(e) => setStart(Math.max(0, Number(e.target.value)))}
            placeholder="Start"
            title="Start offset"
          />
        ) : (
          <input
            type="number"
            min={50}
            max={1000}
            className="border rounded px-3 py-2 w-32"
            value={maxAll}
            onChange={(e) => setMaxAll(Math.min(1000, Math.max(50, Number(e.target.value))))}
            placeholder="Max (all)"
            title="Max matches to fetch in All mode"
          />
        )}

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mock} onChange={(e) => setMock(e.target.checked)} />
          Mock data
        </label>

        <button
          onClick={analyze}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}

      {data && (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold">Account</h2>
            <div className="mt-2 text-sm">
              <span className="font-medium">
                {data.account?.gameName}#{data.account?.tagLine}
              </span>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Totals</h2>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="border rounded p-3">
                <div className="text-gray-500">Matches</div>
                <div className="text-lg font-medium">{data.totals?.matches ?? 0}</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-gray-500">Winrate</div>
                <div className="text-lg font-medium">{data.totals?.winrate ?? 0}%</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-gray-500">Record</div>
                <div className="text-lg font-medium">
                  {data.totals?.wins ?? 0}W {data.totals?.losses ?? 0}L
                </div>
              </div>
              <div className="border rounded p-3">
                <div className="text-gray-500">K/D/A</div>
                <div className="text-lg font-medium">
                  {data.totals?.kills ?? 0}/{data.totals?.deaths ?? 0}/{data.totals?.assists ?? 0} (
                  {data.totals?.kda ?? 0})
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Current Streak</h2>
            <p className="mt-2 text-sm">
              {data.streak?.type === "none"
                ? "No streak"
                : `${data.streak?.type === "win" ? "Win" : "Loss"} streak: ${data.streak?.count}`}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Power Picks</h2>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(data.powerPicks || []).map((p: any) => (
                <div key={p.champion} className="border rounded p-3">
                  <div className="font-medium">{p.champion}</div>
                  <div className="text-sm text-gray-600">Games {p.games}</div>
                  <div className="text-sm">
                    Player {p.playerWinrate}% vs Global {p.globalWinrate}%
                  </div>
                  <div className={`text-sm ${p.diff >= 0 ? "text-green-600" : "text-red-600"}`}>Δ {p.diff}%</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Roles</h2>
            <ul className="mt-2 list-disc list-inside text-sm">
              {(data.roles || []).map((r: any) => (
                <li key={r.role}>
                  {r.role}: {r.count}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">By Champion</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2">Champion</th>
                    <th className="text-left p-2">Games</th>
                    <th className="text-left p-2">Wins</th>
                    <th className="text-left p-2">Losses</th>
                    <th className="text-left p-2">Winrate</th>
                    <th className="text-left p-2">K</th>
                    <th className="text-left p-2">D</th>
                    <th className="text-left p-2">A</th>
                    <th className="text-left p-2">KDA</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.champions || []).map((r: any) => (
                    <tr key={r.champion} className="border-t">
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
    </main>
  );
}