"use client";

import { useRef, useState } from "react";
import RiotSearch, { SummaryWithChamps } from "./components/RiotSearch";
import ResultsPanel from "./components/ResultsPanel";

export default function HomePage() {
  // ✅ state expects SummaryWithChamps (includes _champs)
  const [data, setData] = useState<SummaryWithChamps | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  function onAnalyzed(payload: SummaryWithChamps) {
    setData(payload);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        {/* gradient blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full blur-3xl opacity-20 bg-gradient-to-br from-white/40 to-white/5 dark:from-white/10 dark:to-white/0" />
          <div className="absolute top-1/3 right-20 h-64 w-64 rounded-full blur-2xl opacity-15 bg-gradient-to-tr from-blue-500/30 to-fuchsia-400/30" />
          <div className="absolute -bottom-16 left-24 h-72 w-72 rounded-full blur-2xl opacity-15 bg-gradient-to-tr from-cyan-400/30 to-violet-500/30" />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <header className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/70 dark:text-white/60 shadow-sm backdrop-blur">
              RIFT REPORT
              <span className="h-1 w-1 rounded-full bg-white/30" />
              Personal League analytics
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
              See your strengths at a glance.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm md:text-base text-neutral-600 dark:text-neutral-400">
              Clean, fast insights from your recent matches. No clutter. Just signal.
            </p>
          </header>

          {/* centered search */}
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
            <RiotSearch onAnalyzed={onAnalyzed} />
            <p className="mt-2 text-center text-xs text-neutral-500">
              Tip: use <span className="font-medium">GameName#TAG</span> and pick a region group.
            </p>
          </div>

          {/* “feature strip” */}
          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            {["Bento stats", "Power picks", "Streaks", "Roles"].map((t) => (
              <div
                key={t}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-neutral-600 dark:text-neutral-400 backdrop-blur"
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section ref={resultsRef} className="mx-auto max-w-6xl px-6 pb-20">
        {data ? (
          <ResultsPanel data={data} />
        ) : (
          <div className="mx-auto mt-12 max-w-lg text-center text-sm text-neutral-500">
            Run a report to see your personalized dashboard.
          </div>
        )}
      </section>
    </main>
  );
}
