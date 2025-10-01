// lib/items.ts
export const MYTHIC_ITEM_IDS = new Set<number>([
    6630, 6631, 6632, // Goredrinker, Stridebreaker, Divine Sunderer
    6653, 6655, 6656, // Liandry, Luden, Everfrost (legacy still shows in old matches)
    6671, 6672, 6673, // Galeforce, Kraken, Shieldbow
    6662, 6664,       // Frostfire, Turbo Chemtank
    4633, 4636, 4644, // Riftmaker, Night Harvester, Crown
    3190, 4005,       // Locket, Shurelya (support mythic era)
    // add/trim as needed—timeline-based detection is tolerant to extras
  ]);
  