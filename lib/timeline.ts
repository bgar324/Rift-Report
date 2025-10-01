// lib/timeline.ts
import { MYTHIC_ITEM_IDS } from "./items";

type LanePhase = {
  cs10: number; cs15: number;
  goldDiff10: number; goldDiff15: number;
  xpDiff10: number; xpDiff15: number;
  mythicAt?: number | null; // seconds since game start
  firstBloodInvolved?: boolean;
};

export function computeLanePhaseFromTimeline(
  timeline: any,
  mePuuid: string
): LanePhase {
  // participant <-> puuid map
  const pMap: Record<string, number> = {};
  for (const p of timeline?.metadata?.participants || []) {
    pMap[p] = (timeline.metadata.participants.indexOf(p) + 1); // 1..10
  }
  const mePid = pMap[mePuuid];
  if (!mePid) {
    return { cs10: 0, cs15: 0, goldDiff10: 0, goldDiff15: 0, xpDiff10: 0, xpDiff15: 0, mythicAt: null, firstBloodInvolved: false };
  }

  let cs10 = 0, cs15 = 0;
  let goldMe10 = 0, goldMe15 = 0, goldOpp10 = 0, goldOpp15 = 0;
  let xpMe10 = 0, xpMe15 = 0, xpOpp10 = 0, xpOpp15 = 0;
  let mythicAt: number | null = null;
  let firstBloodInvolved = false;

  // naive lane-opponent: same teamPosition later in match; fallback = opposite team same position
  // For timeline-only, we approximate opponent as: same index +/-5 (enemy same slot)
  const oppPid = mePid <= 5 ? mePid + 5 : mePid - 5;

  for (const frame of timeline?.info?.frames || []) {
    const t = Math.floor((frame?.timestamp || 0) / 1000);
    const me = frame?.participantFrames?.[String(mePid)];
    const opp = frame?.participantFrames?.[String(oppPid)];

    if (!me) continue;

    // CS at time = minions + jungle minions killed so far
    const csNow = Number(me?.minionsKilled || 0) + Number(me?.jungleMinionsKilled || 0);
    if (t >= 600 && cs10 === 0) cs10 = csNow; // take first frame >= 10:00
    if (t >= 900 && cs15 === 0) cs15 = csNow;

    if (opp) {
      if (t >= 600 && goldMe10 === 0) { goldMe10 = Number(me?.totalGold||0); goldOpp10 = Number(opp?.totalGold||0); }
      if (t >= 900 && goldMe15 === 0) { goldMe15 = Number(me?.totalGold||0); goldOpp15 = Number(opp?.totalGold||0); }
      if (t >= 600 && xpMe10 === 0)   { xpMe10 = Number(me?.xp||0); xpOpp10  = Number(opp?.xp||0); }
      if (t >= 900 && xpMe15 === 0)   { xpMe15 = Number(me?.xp||0); xpOpp15  = Number(opp?.xp||0); }
    }

    // Item events live in frame.events; record first mythic buy completion
    if (mythicAt == null) {
      for (const ev of frame?.events || []) {
        if (ev.type === "ITEM_PURCHASED" && ev.participantId === mePid) {
          const id = Number(ev.itemId || 0);
          if (MYTHIC_ITEM_IDS.has(id)) {
            mythicAt = t; // seconds
            break;
          }
        }
      }
    }
  }

  // first blood?
  outer: for (const frame of timeline?.info?.frames || []) {
    for (const ev of frame?.events || []) {
      if (ev.type === "CHAMPION_KILL" && (ev.victimId === mePid || ev.killerId === mePid || (ev.assistingParticipantIds||[]).includes(mePid))) {
        firstBloodInvolved = Boolean(ev?.victimId && ev?.timestamp && ev?.timestamp <= timeline?.info?.frames?.[2]?.timestamp); // within early frames ~first blood
        break outer;
      }
    }
  }

  return {
    cs10, cs15,
    goldDiff10: goldMe10 - goldOpp10,
    goldDiff15: goldMe15 - goldOpp15,
    xpDiff10: xpMe10 - xpOpp10,
    xpDiff15: xpMe15 - xpOpp15,
    mythicAt: mythicAt ?? null,
    firstBloodInvolved,
  };
}
