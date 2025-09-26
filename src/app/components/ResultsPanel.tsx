"use client";

import { useMemo, useState } from "react";
import type { SummaryWithChamps } from "./RiotSearch";

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

const roleStyle: Record<string, string> = {
  TOP: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-400/20",
  JUNGLE:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-400/20",
  MIDDLE:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-400/20",
  BOTTOM:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-400/20",
  SUPPORT:
    "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-400/20",
};

const itemIcon = (version: string, id: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;

/** UI fallback if API didn't send queueName yet */
const uiQueueLabel = (id: number): string => {
  switch (id) {
    case 420:
      return "Ranked Solo/Duo";
    case 440:
      return "Ranked Flex";
    case 400:
      return "Normal Draft";
    case 430:
      return "Normal Blind";
    case 490:
      return "Quickplay";
    case 450:
      return "ARAM";
    case 1700:
      return "Arena";
    case 700:
      return "Clash";
    case 900:
    case 1900:
      return "URF";
    default:
      return "Other";
  }
};

function roleChip(role: string, count?: number) {
  const cls =
    roleStyle[role] ||
    "bg-white/40 text-neutral-700 border-white/30 dark:bg-white/10 dark:text-neutral-300";
  return (
    <span
      key={role}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${cls}`}
    >
      <span className="tracking-wide">{role}</span>
      {typeof count === "number" && <span>• {count}</span>}
    </span>
  );
}

export default function ResultsPanel({ data }: { data: SummaryWithChamps }) {
  const champs = data._champs;
  const [sortPerf, setSortPerf] = useState<"best" | "worst">("best");

  const profileIconUrl = useMemo(() => {
    if (!data?.profile?.profileIconId || !champs) return "";
    return `https://ddragon.leagueoflegends.com/cdn/${champs.version}/img/profileicon/${data.profile.profileIconId}.png`;
  }, [data, champs]);

  // Top-5 performance: by winrate; break ties by games, then KDA
  const topFive = useMemo(() => {
    const arr = [...(data.champions || [])];
    arr.sort((a, b) => {
      const d = b.winrate - a.winrate || b.games - a.games || b.kda - a.kda;
      return sortPerf === "best" ? d : -d;
    });
    return arr.slice(0, 5).map((c) => {
      const id = champs.nameToId[c.champion] || c.champion.replace(/\s+/g, "");
      return {
        ...c,
        icon: `https://ddragon.leagueoflegends.com/cdn/${champs.version}/img/champion/${id}.png`,
      };
    });
  }, [data.champions, champs, sortPerf]);

  const history = data.history || [];

  return (
    <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-12">
      {/* Left: Match history */}
      <div className="md:col-span-8 space-y-4">
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {profileIconUrl && (
                <img
                  src={profileIconUrl}
                  className="h-10 w-10 rounded-md ring-1 ring-white/20"
                  alt="Profile icon"
                />
              )}
              <div>
                <div className="text-sm font-medium">
                  {data.account.gameName}#{data.account.tagLine}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  {data.profile?.summonerLevel ? (
                    <>Level {data.profile.summonerLevel} • </>
                  ) : null}
                  {data.profile?.platform?.toUpperCase() || ""}
                </div>
              </div>
            </div>
            <div className="text-xs text-neutral-500">
              {data.totals.matches} matches • {data.totals.wins}W{" "}
              {data.totals.losses}L • {data.totals.winrate}% WR
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium">Match History</h3>
          <div className="mt-3 divide-y divide-white/10">
            {history.length === 0 && (
              <div className="py-6 text-xs text-neutral-500">
                No matches for this filter.
              </div>
            )}
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-3">
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${
                    champs.version
                  }/img/champion/${
                    champs.nameToId[h.champion] ||
                    h.champion.replace(/\s+/g, "")
                  }.png`}
                  alt={h.champion}
                  className="h-9 w-9 rounded-md ring-1 ring-white/15"
                />
                <div className="flex-1">
                  <div className="text-sm">
                    <span
                      className={`font-medium ${
                        h.win ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {h.win ? "Win" : "Loss"}
                    </span>
                    <span className="ml-2">{h.champion}</span>
                    <span className="ml-2 text-xs text-neutral-500">
                      {Math.round(h.duration / 60)}m
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {h.kills}/{h.deaths}/{h.assists} • KDA{" "}
                    {Math.round(h.kda * 10) / 10} • CS {h.cs}
                  </div>

                  {/* Items row */}
                  {(Array.isArray(h.items) && h.items.length) || h.trinket ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {(h.items || []).map((id: number, i: number) =>
                        id ? (
                          <img
                            key={`${id}-${i}`} // unique even for duplicates
                            src={itemIcon(champs.version, id)}
                            alt={`Item ${id}`}
                            className="h-6 w-6 rounded-sm ring-1 ring-white/15"
                          />
                        ) : null
                      )}
                      {h.trinket ? (
                        <img
                          key={`t-${h.trinket}`}
                          src={itemIcon(champs.version, h.trinket)}
                          alt={`Trinket ${h.trinket}`}
                          className="ml-1 h-6 w-6 rounded-sm ring-1 ring-yellow-300/40"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Right side: queue label + date */}
                <div className="w-40 text-right text-xs text-neutral-500 flex flex-col items-end">
                  <span>{(h as any).queueName || uiQueueLabel(h.queueId)}</span>
                  <span className="mt-0.5">
                    {new Date(h.ts).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right: Performance sidebar */}
      <div className="md:col-span-4 space-y-4">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Performance</h3>
            <div className="flex gap-1 rounded-full border border-white/10 p-1">
              <button
                onClick={() => setSortPerf("best")}
                className={`px-2 py-0.5 text-xs rounded-full ${
                  sortPerf === "best"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : ""
                }`}
              >
                Best
              </button>
              <button
                onClick={() => setSortPerf("worst")}
                className={`px-2 py-0.5 text-xs rounded-full ${
                  sortPerf === "worst"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : ""
                }`}
              >
                Worst
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {topFive.map((c) => (
              <div
                key={c.champion}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <img
                  src={c.icon}
                  alt={c.champion}
                  className="h-8 w-8 rounded-md ring-1 ring-white/15"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{c.champion}</div>
                  <div className="text-xs text-neutral-500">
                    {c.games} games • {c.winrate}% WR • KDA {c.kda}
                  </div>
                </div>
              </div>
            ))}
            {!topFive.length && (
              <div className="text-xs text-neutral-500">
                Not enough games for this filter.
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium">Current Streak</h3>
          <div className="mt-3 text-sm">
            {data.streak.type === "none"
              ? "No streak"
              : `${data.streak.type === "win" ? "Win" : "Loss"} streak: ${
                  data.streak.count
                }`}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium">Roles</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(data.roles || []).map((r) => roleChip(r.role, r.count))}
            {(!data.roles || !data.roles.length) && (
              <span className="text-xs text-neutral-500">No role data</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
