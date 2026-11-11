import type { Ability } from "#abilities/ability";
import { globalScene } from "#app/global-scene";
import { isSecondPassiveUnlocked } from "#app/second-passive";
import { allAbilities } from "#data/data-lists";
import { AbilityId } from "#enums/ability-id";
import type { Pokemon } from "#field/pokemon";
import type {
  AbAttrBaseParams,
  AbAttrMap,
  AbAttrParamMap,
  AbAttrString,
  CallableAbAttrString,
} from "#types/ability-types";

type AbAttrPredicate<T extends AbAttrString> = (attr: AbAttrMap[T]) => boolean;

interface ApplyAbAttrConfig<T extends AbAttrString> {
  /** An optional array to which ability trigger messges will be added */
  messages?: string[] | undefined;
  /**
   * An optional filter to use when determining what attributes to use.
   * Any {@linkcode AbAttr}s for which this returns `false` will be skipped during attribute application.
   */
  attrFilter?: AbAttrPredicate<T>;
}

/**
 * Get the "second passive" of a Pokemon: an extra ability (the species' hidden ability)
 * that the player unlocked with candy in the starter select menu.
 * @returns The extra {@linkcode Ability}, or `null` if the Pokemon has none.
 */
function getSecondPassive(pokemon: Pokemon): Ability | null {
  if (!pokemon.isPlayer() || !isSecondPassiveUnlocked(pokemon.species.getRootSpeciesId())) {
    return null;
  }

  const abilityId = pokemon.getSpeciesForm(true).getAbility(2);
  if (abilityId == null || abilityId === AbilityId.NONE) {
    return null;
  }

  const ability = allAbilities[abilityId];
  if (!ability) {
    return null;
  }

  // Never apply the same ability twice
  if (ability.id === pokemon.getAbility().id) {
    return null;
  }
  if (pokemon.hasPassive() && ability.id === pokemon.getPassiveAbility().id) {
    return null;
  }

  return ability;
}

/** Checks whether the second passive can currently be applied (mirrors `Pokemon#canApplyAbility`). */
function canApplyBonusAbility(pokemon: Pokemon, ability: Ability): boolean {
  if (pokemon.isFusion() && ability.hasAttr("NoFusionAbilityAbAttr")) {
    return false;
  }
  if (globalScene.movesetGenInProgress) {
    return true;
  }
  if (pokemon.isTransformed() && ability.hasAttr("NoTransformAbilityAbAttr")) {
    return false;
  }
  const arena = globalScene.arena;
  if (arena.ignoreAbilities && arena.ignoringEffectSource !== pokemon.getBattlerIndex() && ability.ignorable) {
    return false;
  }
  if (pokemon.summonData.abilitySuppressed && ability.suppressable) {
    return false;
  }
  return (pokemon.hp > 0 || ability.bypassFaint) && !ability.conditions.some(condition => !condition(pokemon));
}

function applySingleAbAttrs<T extends AbAttrString>(
  attrType: T,
  params: AbAttrParamMap[T],
  { attrFilter = () => true, messages }: ApplyAbAttrConfig<T> = {},
  bonusAbility?: Ability,
) {
  const { simulated = false, passive = false, pokemon } = params;
  if (bonusAbility) {
    if (!canApplyBonusAbility(pokemon, bonusAbility)) {
      return;
    }
  } else if (
    !pokemon.canApplyAbility(passive)
    || (passive && pokemon.getPassiveAbility().id === pokemon.getAbility().id)
  ) {
    return;
  }

  const ability = bonusAbility ?? (passive ? pokemon.getPassiveAbility() : pokemon.getAbility());
  const attrs = ability.getAttrs(attrType);

  for (const attr of attrs) {
    if (!attrFilter(attr)) {
      continue;
    }

    // TODO: Make `getCondition` default to `() => true` instead of `null`
    const condition = attr.getCondition();
    // We require an `as any` cast to suppress an error about the `params` type not being assignable to
    // the type of the argument expected by `attr.canApply()`. This is OK, because we know that
    // `attr` is an instance of the `attrType` class provided to the method, and typescript _will_ check
    // that the `params` object has the correct properties for that class at the callsites.
    if ((condition && !condition(pokemon)) || !attr.canApply(params as any)) {
      continue;
    }

    let abShown = false;

    // The ability flyout only knows about the regular ability and passive, so it is skipped for the second passive
    if (attr.showAbility && !simulated && !bonusAbility) {
      globalScene.phaseManager.queueAbilityDisplay(pokemon, passive, true);
      abShown = true;
    }

    const message = attr.getTriggerMessage(params as any, ability.name);
    if (message) {
      if (!simulated) {
        globalScene.phaseManager.queueMessage(message);
      }
      // TODO: Should messages be added to the array if they aren't actually shown?
      messages?.push(message);
    }

    // The `as any` cast here uses the same reasoning as above.
    attr.apply(params as any);

    if (abShown) {
      globalScene.phaseManager.queueAbilityDisplay(pokemon, passive, false);
    }

    if (!simulated) {
      pokemon.waveData.abilitiesApplied.add(ability.id);
      pokemon.summonData.abilitiesApplied.add(ability.id);
    }
  }
}

function applyAbAttrsInternal<T extends CallableAbAttrString>(
  attrType: T,
  params: AbAttrParamMap[T],
  config: ApplyAbAttrConfig<T>,
) {
  // If the pokemon is not defined, no ability attributes can be applied.
  // This check is necessary because of callers secretly passing `null`s to this function
  // (most notably during switch out/entrance code)
  // TODO: Find and remove all instances where this occurs
  if (!params.pokemon) {
    return;
  }
  if (params.passive !== undefined) {
    applySingleAbAttrs(attrType, params, config);
    return;
  }

  for (const passive of [false, true]) {
    params.passive = passive;
    applySingleAbAttrs(attrType, params, config);
  }

  // Second passive (extra ability unlocked with candy in the starter select menu)
  const bonusAbility = getSecondPassive(params.pokemon);
  if (bonusAbility) {
    params.passive = false;
    applySingleAbAttrs(attrType, params, config, bonusAbility);
  }

  // Restore passive if it was undefined on entry to allow re-use of parameter objects
  params.passive = undefined;
}

/**
 * Apply all ability attributes matching the given type.
 * @param attrType - The name of the ability attribute to apply
 * @param params - The parameters to pass to the ability attribute's `apply` method
 * @param messages - An optional array to which ability trigger messges will be added
 */
export function applyAbAttrs<T extends CallableAbAttrString>(
  attrType: T,
  params: AbAttrParamMap[T],
  messages?: string[],
): void {
  applyAbAttrsInternal(attrType, params, { messages });
}

// TODO: Improve the type signatures of the following methods / refactor the apply methods

/**
 * `AbAttrPredicate` used to avoid triggering Imposter and other non re-activating `PostSummonAbAttr`s
 * when gaining the ability again.
 */
const postSummonGainedMidTurnCondition: AbAttrPredicate<"PostSummonAbAttr"> = attr => attr.shouldActivateOnGain();

/**
 * Applies abilities when they become active mid-turn through **temporary** effects
 * (such as from ability-changing or suppressing effects).
 *
 * Ignores passives as they don't change and shouldn't be reapplied when main abilities change
 */
// TODO: Rework to call `applyAbAttrsInternal` rather than iterating over `[false, true]` at callsites
export function applyOnGainAbAttrs(params: AbAttrBaseParams): void {
  applySingleAbAttrs("PostSummonAbAttr", params, { attrFilter: postSummonGainedMidTurnCondition });
}

/**
 * Apply the effects of abilities when they become active mid-turn from a Pokemon changing its form.
 *
 * @param params - The parameters to pass to the ability attribute's `apply` method
 * @remarks
 * In keeping with mainline behavior (such as Mega Tyranitar re-applying Sand Stream on Mega Evolving),
 * this will re-apply all relevant abilities **regardless** of whether the form change altered the ability or not.
 * @privateRemarks
 * This will not apply any attributes that extend off of `PostSummonFormChangeAbAttr` to prevent infinite loops,
 * and will only apply each unique `AbilityId` once per turn for a similar reason.
 */
export function applyPostFormChangeAbAttrs(params: Omit<AbAttrBaseParams, "passive">): void {
  const { pokemon } = params;
  const { formChangeAbilitiesApplied } = pokemon.turnData;
  const activeApplied = formChangeAbilitiesApplied.has(pokemon.getAbility().id);
  const passiveApplied = formChangeAbilitiesApplied.has(pokemon.getPassiveAbility().id);

  if (activeApplied && passiveApplied) {
    return;
  }

  // Form change abilities currently don't work as passives, but no harm future-proofing it for later
  let passive: boolean | undefined;
  if (activeApplied) {
    passive = true;
    formChangeAbilitiesApplied.add(pokemon.getPassiveAbility().id);
  } else if (passiveApplied) {
    passive = false;
    formChangeAbilitiesApplied.add(pokemon.getAbility().id);
  } else {
    formChangeAbilitiesApplied.add(pokemon.getPassiveAbility().id).add(pokemon.getAbility().id);
  }

  applyAbAttrsInternal(
    "PostSummonAbAttr",
    { ...params, passive },
    {
      attrFilter: attr => !attr.is("PostSummonFormChangeAbAttr") && !attr.is("PostSummonFormChangeByWeatherAbAttr"),
    },
  );
}

/**
 * Applies ability attributes which activate when the ability is lost or suppressed (i.e. primal weather)
 */
export function applyOnLoseAbAttrs(params: AbAttrBaseParams): void {
  applySingleAbAttrs("PreLeaveFieldAbAttr", params);

  applySingleAbAttrs("IllusionBreakAbAttr", params);
}
