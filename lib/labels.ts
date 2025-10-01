// lib/labels.ts
export const SUMMONER_SPELLS: Record<number, { key: string; name: string; icon: string }> = {
    21: { key: "Barrier", name: "Barrier", icon: "spell/SummonerBarrier.png" },
    1:  { key: "Boost",   name: "Cleanse", icon: "spell/SummonerBoost.png" },
    14: { key: "Dot",     name: "Ignite",  icon: "spell/SummonerIgnite.png" },
    3:  { key: "Exhaust", name: "Exhaust", icon: "spell/SummonerExhaust.png" },
    7:  { key: "Heal",    name: "Heal",    icon: "spell/SummonerHeal.png" },
    4:  { key: "Flash",   name: "Flash",   icon: "spell/SummonerFlash.png" },
    11: { key: "Smite",   name: "Smite",   icon: "spell/SummonerSmite.png" },
    12: { key: "Teleport",name: "Teleport",icon: "spell/SummonerTeleport.png" },
    6:  { key: "Ghost",   name: "Ghost",   icon: "spell/SummonerHaste.png" },
    13: { key: "Clarity", name: "Clarity", icon: "spell/SummonerMana.png" },
  };
  
  export type RuneUsage = {
    primaryStyle?: number;
    subStyle?: number;
    keystone?: number;
    // you can expand with perk IDs if you want
  };
  
  export function deriveSpells(s1: number, s2: number) {
    return [s1, s2].map((id) => ({
      id,
      name: SUMMONER_SPELLS[id]?.name || String(id),
      icon: SUMMONER_SPELLS[id]?.icon || "",
    }));
  }
  
  export function deriveRunes(perks: any): RuneUsage {
    const styles = Array.isArray(perks?.styles) ? perks.styles : [];
    const primary = styles.find((s: any) => s?.description === "primaryStyle") || styles[0];
    const sub     = styles.find((s: any) => s?.description === "subStyle") || styles[1];
  
    // best effort keystone = first selection in primary
    const keystone = Number(primary?.selections?.[0]?.perk || 0) || undefined;
  
    return {
      primaryStyle: Number(primary?.style || 0) || undefined,
      subStyle: Number(sub?.style || 0) || undefined,
      keystone,
    };
  }
  