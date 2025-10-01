// lib/items.ts
// Minimal mythic item set (keep it broad; extend as needed).
export const MYTHIC_ITEM_IDS = new Set<number>([
  // Old mythics (pre-14.10) kept for historical matches
  6630, // Goredrinker
  6631, // Stridebreaker
  6632, // Divine Sunderer
  6671, // Galeforce
  6672, // Kraken Slayer
  6673, // Immortal Shieldbow
  6653, // Liandry's
  6655, // Luden's
  6656, // Night Harvester
  6662, // Frostfire
  6664, // Turbo Chemtank
  6675, // Navori
  6677, // Rageknife (edge cases)
  3190, // Locket (legacy)
  2065, // Shurelya's (legacy)

  // Post-14.x "major" completions worth timing (identify as 'mythic-like' for UX)
  6692, // Eclipse
  6691, // Duskblade
  6693, // Prowler's (historic)
  3078, // Trinity Force
  3026, // GA (sometimes used as first big spike)
  6657, // Rod of Ages (historic)
  3089, // Rabadon's
  3124, // Guinsoo's
  3153, // BORK
  3053, // Sterak's
  3115, // Nashor's
  4628, // Horizon Focus
]);
