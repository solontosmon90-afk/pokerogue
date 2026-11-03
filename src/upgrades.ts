/**
 * Permanent offline upgrades.
 * Stored in localStorage under its own key, separate from the game's save data,
 * so game updates or save resets don't wipe it.
 */

const STORAGE_KEY = "pr_upgrades_v1";

export type UpgradeId = "candy" | "luck" | "exp" | "money";

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
    maxLevel: 5,
    baseCost: 50,
    costGrowth: 2,
    perLevel: 1,
  },
  {
    id: "exp",
    name: "EXP Boost",
    description: "+10% EXP per level",
    maxLevel: 10,
    baseCost: 15,
    costGrowth: 1.4,
    perLevel: 0.1,
  },
  {
    id: "money",
    name: "Money Boost",
    description: "+10% wave money per level",
    maxLevel: 10,
    baseCost: 15,
    costGrowth: 1.4,
    perLevel: 0.1,
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

/** Shards earned for clearing a wave: 1 + 1 per 20 waves, plus 5 extra on every 10th (boss) wave. */
export function getShardsForWave(waveIndex: number): number {
  return 1 + Math.floor(waveIndex / 20) + (waveIndex % 10 === 0 ? 5 : 0);
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

// ---------- Effect helpers (used by the game code) ----------

export function getCandyMultiplier(): number {
  return 1 + getUpgradeLevel("candy") * getDef("candy").perLevel;
}

/**
 * Applies the candy upgrade to a candy amount.
 * The fractional part is rounded up at random, so small amounts still benefit
 * (for example 1 candy at +25% gives 2 candy about a quarter of the time).
 */
export function boostCandy(baseAmount: number): number {
  const boosted = baseAmount * getCandyMultiplier();
  const whole = Math.floor(boosted);
  return whole + (Math.random() < boosted - whole ? 1 : 0);
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
