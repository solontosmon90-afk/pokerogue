/**
 * Permanent offline upgrades.
 * Stored in localStorage under its own key, separate from the game's save data,
 * so game updates or save resets don't wipe it.
 */

const STORAGE_KEY = "pr_upgrades_v1";

export type UpgradeId =
  | "candy"
  | "luck"
  | "exp"
  | "money"
  | "shop"
  | "balls"
  | "shards"
  | "shiny"
  | "hidden"
  | "friend"
  | "catch";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  maxLevel: number;
  /** Cost of level 1. */
  baseCost: number;
  /** Each next level costs baseCost * costGrowth ^ currentLevel. */
  costGrowth: number;
  /** Effect per level (meaning depends on the upgrade). */
  perLevel: number;
}

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: "candy",
    name: "Candy Boost",
    description: "+25% candy per level",
    maxLevel: 10,
    baseCost: 20,
    costGrowth: 1.5,
    perLevel: 0.25,
  },
  {
    id: "luck",
    name: "Lucky Charm",
    description: "+1 party luck per level",
    maxLevel: 10,
    baseCost: 50,
    costGrowth: 1.2,
    perLevel: 2,
  },
  {
    id: "exp",
    name: "EXP Boost",
    description: "+30% EXP per level",
    maxLevel: 10,
    baseCost: 15,
    costGrowth: 1.4,
    perLevel: 0.3,
  },
  {
    id: "money",
    name: "Money Boost",
    description: "+50% wave money per level",
    maxLevel: 10,
    baseCost: 15,
    costGrowth: 1.4,
    perLevel: 0.5,
  },
  {
    id: "shop",
    name: "Shop Discount",
    description: "-10% shop prices per level",
    maxLevel: 8,
    baseCost: 30,
    costGrowth: 1.6,
    perLevel: 0.1,
  },
  {
    id: "balls",
    name: "Start Balls",
    description: "+2 starting Poke Balls per level",
    maxLevel: 10,
    baseCost: 15,
    costGrowth: 1.5,
    perLevel: 2,
  },
  {
    id: "shards",
    name: "Shard Magnet",
    description: "+100% shards per level",
    maxLevel: 10,
    baseCost: 40,
    costGrowth: 1.3,
    perLevel: 1,
  },
  {
    id: "shiny",
    name: "Shiny Rate",
    description: "+50% wild shiny chance per level",
    maxLevel: 10,
    baseCost: 40,
    costGrowth: 1.5,
    perLevel: 0.5,
  },
  {
    id: "hidden",
    name: "Hidden Ability",
    description: "+50% wild hidden ability chance per level",
    maxLevel: 10,
    baseCost: 30,
    costGrowth: 1.5,
    perLevel: 0.5,
  },
  {
    id: "friend",
    name: "Friendship",
    description: "+30% friendship gain per level",
    maxLevel: 10,
    baseCost: 15,
    costGrowth: 1.4,
    perLevel: 0.3,
  },
  {
    id: "catch",
    name: "Catch Rate",
    description: "+50% catch rate per level",
    maxLevel: 10,
    baseCost: 30,
    costGrowth: 1.5,
    perLevel: 0.5,
  },
];

interface UpgradeSave {
  shards: number;
  levels: Partial<Record<UpgradeId, number>>;
}

let cache: UpgradeSave | null = null;

function load(): UpgradeSave {
  if (cache) {
    return cache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = { shards: Number(parsed.shards) || 0, levels: parsed.levels ?? {} };
      return cache;
    }
  } catch {
    // Storage unavailable or corrupted: fall through to defaults
  }
  cache = { shards: 0, levels: {} };
  return cache;
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
  } catch {
    // Ignore storage errors
  }
}

function getDef(id: UpgradeId): UpgradeDef {
  return UPGRADES.find(u => u.id === id)!;
}

/** Rounds randomly up or down in proportion to the fractional part, so small amounts still benefit. */
function roundFair(value: number): number {
  const whole = Math.floor(value);
  return whole + (Math.random() < value - whole ? 1 : 0);
}

// ---------- Levels and buying ----------

export function getUpgradeLevel(id: UpgradeId): number {
  return load().levels[id] ?? 0;
}

/** Cost of the next level, or `null` if already at max level. */
export function getUpgradeCost(id: UpgradeId): number | null {
  const def = getDef(id);
  const level = getUpgradeLevel(id);
  if (level >= def.maxLevel) {
    return null;
  }
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
}

/** Try to buy the next level. Returns `true` on success. */
export function buyUpgrade(id: UpgradeId): boolean {
  const cost = getUpgradeCost(id);
  const data = load();
  if (cost === null || data.shards < cost) {
    return false;
  }
  data.shards -= cost;
  data.levels[id] = getUpgradeLevel(id) + 1;
  save();
  return true;
}

// ---------- Shards (currency) ----------

export function getShards(): number {
  return load().shards;
}

export function addShards(amount: number): void {
  if (amount <= 0) {
    return;
  }
  load().shards += Math.floor(amount);
  save();
}

/**
 * Shards earned for clearing a wave: 1 + 1 per 20 waves, plus 5 extra on every 10th (boss) wave,
 * increased by the Shard Magnet upgrade.
 */
export function getShardsForWave(waveIndex: number): number {
  const base = 1 + Math.floor(waveIndex / 20) + (waveIndex % 10 === 0 ? 5 : 0);
  return roundFair(base * (1 + getUpgradeLevel("shards") * getDef("shards").perLevel));
}

// ---------- Effect helpers (used by the game code) ----------

export function getCandyMultiplier(): number {
  return 1 + getUpgradeLevel("candy") * getDef("candy").perLevel;
}

/** Applies the candy upgrade to a candy amount (fractions are rounded randomly). */
export function boostCandy(baseAmount: number): number {
  return roundFair(baseAmount * getCandyMultiplier());
}

export function getLuckBonus(): number {
  return getUpgradeLevel("luck") * getDef("luck").perLevel;
}

export function getExpMultiplier(): number {
  return 1 + getUpgradeLevel("exp") * getDef("exp").perLevel;
}

export function getMoneyMultiplier(): number {
  return 1 + getUpgradeLevel("money") * getDef("money").perLevel;
}

/** Multiplier applied to shop prices (1 = full price). */
export function getShopPriceMultiplier(): number {
  return 1 - getUpgradeLevel("shop") * getDef("shop").perLevel;
}

/** Extra Poke Balls at the start of a run. */
export function getStartingBallsBonus(): number {
  return getUpgradeLevel("balls") * getDef("balls").perLevel;
}

/** Multiplier applied to the wild shiny threshold (1 = normal chance). */
export function getShinyMultiplier(): number {
  return 1 + getUpgradeLevel("shiny") * getDef("shiny").perLevel;
}

/** Multiplier applied to the wild hidden ability chance (1 = normal chance). */
export function getHiddenAbilityMultiplier(): number {
  return 1 + getUpgradeLevel("hidden") * getDef("hidden").perLevel;
}

/** Applies the friendship upgrade to a friendship gain (fractions are rounded randomly). */
export function boostFriendship(baseAmount: number): number {
  return roundFair(baseAmount * (1 + getUpgradeLevel("friend") * getDef("friend").perLevel));
}

/** Multiplier applied to the modified catch rate (1 = normal). */
export function getCatchRateMultiplier(): number {
  return 1 + getUpgradeLevel("catch") * getDef("catch").perLevel;
}
