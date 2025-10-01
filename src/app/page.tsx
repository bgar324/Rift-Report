"use client";

import { useRef, useState } from "react";
import RiotSearch, { SummaryWithChamps } from "./components/RiotSearch";
import ResultsPanel from "./components/ResultsPanel";

export default function HomePage() {
  const [data, setData] = useState<SummaryWithChamps | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  function onAnalyzed(payload: SummaryWithChamps) {
    setData(payload);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-screen">
      <section className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full blur-3xl opacity-20 bg-gradient-to-br from-white/60 to-white/10" />
          <div className="absolute top-1/3 right-20 h-64 w-64 rounded-full blur-2xl opacity-15 bg-gradient-to-tr from-blue-400/30 to-fuchsia-300/30" />
          <div className="absolute -bottom-16 left-24 h-72 w-72 rounded-full blur-2xl opacity-15 bg-gradient-to-tr from-cyan-300/30 to-violet-400/30" />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <header className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs tracking-wide text-black/70 shadow-sm backdrop-blur">
              RIFT REPORT <span className="h-1 w-1 rounded-full bg-black/30" /> Personal League analytics
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">See your strengths at a glance.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm md:text-base text-neutral-600">
              Clean, fast insights from your recent matches. No clutter. Just signal.
            </p>
          </header>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-black/10 bg-white/60 p-4 shadow-lg backdrop-blur">
            <RiotSearch onAnalyzed={onAnalyzed} />
            <p className="mt-2 text-center text-xs text-neutral-500">
              Tip: use <span className="font-medium">GameName#TAG</span> and pick a region group.
            </p>
          </div>
        </div>
      </section>

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
