// lib/timeline.ts
import { MYTHIC_ITEM_IDS } from "./items";

export type LanePhase = {
  cs10: number; cs15: number;
  goldDiff10: number; goldDiff15: number;
  xpDiff10: number; xpDiff15: number;
  mythicAt?: number | null;       // seconds since game start
  firstBloodInvolved?: boolean;
};

/** Extract lane-phase splits + mythic timing from a match timeline. */
export function computeLanePhaseFromTimeline(
  timeline: any,
  mePuuid: string
): LanePhase {
  // puuid -> participantId (1..10)
  const participants: string[] = timeline?.metadata?.participants || [];
  const mePid = (participants.indexOf(mePuuid) + 1) || 0;
  if (!mePid) {
    return {
      cs10: 0, cs15: 0,
      goldDiff10: 0, goldDiff15: 0,
      xpDiff10: 0, xpDiff15: 0,
      mythicAt: null, firstBloodInvolved: false
    };
  }

  // approximate opposite-laner: same slot on enemy team
  const oppPid = mePid <= 5 ? mePid + 5 : mePid - 5;

  let cs10 = 0, cs15 = 0;
  let gMe10 = 0, gMe15 = 0, gOp10 = 0, gOp15 = 0;
  let xMe10 = 0, xMe15 = 0, xOp10 = 0, xOp15 = 0;
  let mythicAt: number | null = null;
  let firstBloodInvolved = false;

  for (const frame of timeline?.info?.frames || []) {
    const t = Math.floor((frame?.timestamp || 0) / 1000);
    const me = frame?.participantFrames?.[String(mePid)];
    const op = frame?.participantFrames?.[String(oppPid)];
    if (!me) continue;

    const csNow = Number(me?.minionsKilled || 0) + Number(me?.jungleMinionsKilled || 0);
    if (t >= 600 && cs10 === 0) cs10 = csNow;
    if (t >= 900 && cs15 === 0) cs15 = csNow;

    if (op) {
      if (t >= 600 && gMe10 === 0) { gMe10 = Number(me?.totalGold||0); gOp10 = Number(op?.totalGold||0); }
      if (t >= 900 && gMe15 === 0) { gMe15 = Number(me?.totalGold||0); gOp15 = Number(op?.totalGold||0); }
      if (t >= 600 && xMe10 === 0) { xMe10 = Number(me?.xp||0);        xOp10 = Number(op?.xp||0); }
      if (t >= 900 && xMe15 === 0) { xMe15 = Number(me?.xp||0);        xOp15 = Number(op?.xp||0); }
    }

    // track mythic completion time (first item purchase that matches mythic IDs)
    if (mythicAt == null) {
      for (const ev of frame?.events || []) {
        if (ev.type === "ITEM_PURCHASED" && ev.participantId === mePid) {
          const id = Number(ev.itemId || 0);
          if (MYTHIC_ITEM_IDS.has(id)) { mythicAt = t; break; }
        }
      }
    }
  }

  // naive first-blood involvement check (early kill frames)
  outer: for (const frame of timeline?.info?.frames || []) {
    for (const ev of frame?.events || []) {
      if (ev.type === "CHAMPION_KILL") {
        const assists: number[] = ev.assistingParticipantIds || [];
        if (ev.killerId === mePid || ev.victimId === mePid || assists.includes(mePid)) {
          firstBloodInvolved = true;
          break outer;
        }
      }
    }
  }

  return {
    cs10, cs15,
    goldDiff10: gMe10 - gOp10,
    goldDiff15: gMe15 - gOp15,
    xpDiff10: xMe10 - xOp10,
    xpDiff15: xMe15 - xOp15,
    mythicAt: mythicAt ?? null,
    firstBloodInvolved,
  };
}
