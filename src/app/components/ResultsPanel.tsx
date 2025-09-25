"use client";

import { useMemo } from "react";
import type { SummaryWithChamps } from "./RiotSearch";
import { champIcon } from "./RiotSearch";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export default function ResultsPanel({ data }: { data: SummaryWithChamps }) {
  const champs = data._champs;

  const profileIconUrl = useMemo(() => {
    if (!data?.profile?.profileIconId || !champs) return "";
    return `https://ddragon.leagueoflegends.com/cdn/${champs.version}/img/profileicon/${data.profile.profileIconId}.png`;
  }, [data, champs]);

  const powerPicks = useMemo(() => {
    return (data.powerPicks || []).map((p) => {
      const id = champs.nameToId[p.champion] || p.champion.replace(/\s+/g, "");
      return { ...p, icon: champIcon(champs.version, id) };
    });
  }, [data, champs]);

  const rows = useMemo(() => {
    return (data.champions || []).map((r) => {
      const id = champs.nameToId[r.champion] || r.champion.replace(/\s+/g, "");
      return { ...r, icon: champIcon(champs.version, id) };
    });
  }, [data, champs]);

  return (
    <div className="mt-12 space-y-8">
      {/* Header strip */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          {profileIconUrl && <img src={profileIconUrl} className="h-10 w-10 rounded-md ring-1 ring-white/20" alt="Profile icon" />}
          <div>
            <div className="text-sm font-medium">{data.account.gameName}#{data.account.tagLine}</div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              {data.profile?.summonerLevel ? <>Level {data.profile.summonerLevel} • </> : null}
              {data.profile?.platform?.toUpperCase() || ""}
            </div>
          </div>
        </div>
        <div className="text-xs text-neutral-500">
          {data.totals.matches} matches • {data.totals.wins}W {data.totals.losses}L • {data.totals.winrate}% WR
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        {/* Totals */}
        <Card className="md:col-span-4">
          <h3 className="text-sm font-medium">Totals</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-neutral-500">Winrate</div>
              <div className="text-lg font-semibold">{data.totals.winrate}%</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-neutral-500">Record</div>
              <div className="text-lg font-semibold">{data.totals.wins}W {data.totals.losses}L</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-neutral-500">K/D/A</div>
              <div className="text-lg font-semibold">{data.totals.kills}/{data.totals.deaths}/{data.totals.assists}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-neutral-500">KDA</div>
              <div className="text-lg font-semibold">{data.totals.kda}</div>
            </div>
          </div>
        </Card>

        {/* Power Picks */}
        <Card className="md:col-span-8">
          <h3 className="text-sm font-medium">Power Picks</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(powerPicks.length ? powerPicks : []).map((p) => (
              <div key={p.champion} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <img src={p.icon} alt={p.champion} className="h-10 w-10 rounded-lg ring-1 ring-white/20" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.champion}</div>
                  <div className="text-xs text-neutral-500">Games {p.games}</div>
                  <div className="text-xs">Player {p.playerWinrate}% vs Global {p.globalWinrate}%</div>
                </div>
                <div className={`${p.diff >= 0 ? "text-green-600" : "text-red-600"} text-sm font-medium`}>Δ {p.diff}%</div>
              </div>
            ))}
            {!powerPicks.length && <div className="text-xs text-neutral-500">Not enough games yet.</div>}
          </div>
        </Card>

        {/* Streak */}
        <Card className="md:col-span-4">
          <h3 className="text-sm font-medium">Current Streak</h3>
          <div className="mt-3 text-sm">
            {data.streak.type === "none" ? "No streak" : `${data.streak.type === "win" ? "Win" : "Loss"} streak: ${data.streak.count}`}
          </div>
        </Card>

        {/* Roles */}
        <Card className="md:col-span-8">
          <h3 className="text-sm font-medium">Roles</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(data.roles || []).map((r) => (
              <span key={r.role} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">{r.role} • {r.count}</span>
            ))}
            {(!data.roles || !data.roles.length) && <span className="text-xs text-neutral-500">No role data</span>}
          </div>
        </Card>

        {/* By Champion table */}
        <Card className="md:col-span-12">
          <h3 className="text-sm font-medium">By Champion</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-neutral-500">
                <tr>
                  {["Champion","Games","Wins","Losses","Winrate","K","D","A","KDA"].map(h => (
                    <th key={h} className="p-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.champion} className="border-t border-white/10">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <img src={r.icon} alt={r.champion} className="h-7 w-7 rounded-md ring-1 ring-white/15" />
                        <span>{r.champion}</span>
                      </div>
                    </td>
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
                {!rows.length && (
                  <tr>
                    <td className="p-4 text-xs text-neutral-500" colSpan={9}>No champion data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
