/**
 * Story Mode: a harder Classic run with a story about a time loop.
 *
 * - Each run you lose counts as one "loop".
 * - The rival's lines change as the loop count grows (they start to remember).
 * - Winning plays an ending. With enough loops the ending is the true ending.
 *
 * Everything is stored in localStorage under its own key, separate from the game's save data.
 * Note: avoid ":" and "{" in the story text, to keep it safe from the translation system.
 */

import { globalScene } from "#app/global-scene";
import { TrainerType } from "#enums/trainer-type";
import { trainerConfigs } from "#trainers/trainer-config";

const STORAGE_KEY = "pr_story_v1";

/** Lost runs needed before winning gives the true ending (the loop breaks). Change this to taste. */
export const TRUE_ENDING_LOOPS = 3;
/** Enemy levels are multiplied by this number in Story Mode. 1 = no change. */
const ENEMY_LEVEL_MULTIPLIER = 1.1;
/** Extra health bar segments for boss Pokemon in Story Mode. 0 = no change. */
const BOSS_EXTRA_SEGMENTS = 1;
/** Loops needed to reach story stage 2 and stage 3 of the rival's dialogue. */
const STAGE_2_LOOPS = 3;
const STAGE_3_LOOPS = 8;

interface StorySave {
  enabled: boolean;
  loops: number;
  clears: number;
}

let cache: StorySave | null = null;

function load(): StorySave {
  if (cache) {
    return cache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = {
        enabled: !!parsed.enabled,
        loops: Number(parsed.loops) || 0,
        clears: Number(parsed.clears) || 0,
      };
      return cache;
    }
  } catch {
    // Storage unavailable or corrupted: fall through to defaults
  }
  cache = { enabled: false, loops: 0, clears: 0 };
  return cache;
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
  } catch {
    // Ignore storage errors
  }
}

export function isStoryMode(): boolean {
  return load().enabled;
}

export function setStoryMode(on: boolean): void {
  load().enabled = on;
  save();
  applyStoryDialogue();
}

/** How many runs have been lost in Story Mode so far. */
export function getLoopCount(): number {
  return load().loops;
}

/** Call when a Classic run ends. A loss adds a loop; a win is counted as a clear. */
export function recordRunEnd(isVictory: boolean): void {
  const data = load();
  if (!data.enabled) {
    return;
  }
  if (isVictory) {
    data.clears++;
  } else {
    data.loops++;
  }
  save();
  applyStoryDialogue();
}

function inStoryClassic(): boolean {
  return isStoryMode() && !!globalScene.gameMode?.isClassic;
}

/** Story Mode makes enemy Pokemon stronger. */
export function getStoryEnemyLevel(level: number): number {
  return inStoryClassic() ? Math.ceil(level * ENEMY_LEVEL_MULTIPLIER) : level;
}

/** Story Mode gives boss Pokemon extra health bar segments. */
export function getStoryBossSegmentBonus(): number {
  return inStoryClassic() ? BOSS_EXTRA_SEGMENTS : 0;
}

// ---------- Story text ----------

/** In the text below, "$" starts a new dialogue box page. */
interface RivalLines {
  encounter: string;
  victory: string;
  defeat: string;
}

/** Rival fights, in order: waves 8, 25, 55, 95, 145 and 195 in Classic. */
const RIVAL_TYPES = [
  TrainerType.RIVAL,
  TrainerType.RIVAL_2,
  TrainerType.RIVAL_3,
  TrainerType.RIVAL_4,
  TrainerType.RIVAL_5,
  TrainerType.RIVAL_6,
];

const RIVAL_LINES: RivalLines[][] = [
  // Stage 1 (few loops): a strange feeling of deja vu
  [
    {
      encounter: "Hey, you made it here too!$Funny... I feel like I've said that before.",
      victory: "Whoa, you're strong.$That felt familiar, somehow.",
      defeat: "Ha! Got you this time.$...This time? Weird thing to say.",
    },
    {
      encounter: "Again? We keep running into each other.$Why does that feel like a habit?",
      victory: "Every time I lose to you, my head hurts a little.",
      defeat: "I won, but it feels hollow.$As if I'd won before.",
    },
    {
      encounter: "I had a dream last night.$You were fighting me, over and over.",
      victory: "Your moves... I swear I've seen them all.",
      defeat: "Tell me I'm not the only one who feels this.",
    },
    {
      encounter: "Something is wrong with this world.$And you're at the center of it.",
      victory: "You knew what I'd do before I did it.$How?",
      defeat: "I'll keep getting stronger.$I just know I'll need to.",
    },
    {
      encounter: "I keep seeing the same road, the same faces.$Is any of this real?",
      victory: "Fine. Keep going.$Maybe the end explains everything.",
      defeat: "No... not again.$Wait. Again? Why did I say that?",
    },
    {
      encounter: "This is the last gate.$Whatever this feeling is, I'll face it with you.",
      victory: "Go on. Finish what you started.",
      defeat: "It can't end like this.$Something keeps taking it all back.",
    },
  ],
  // Stage 2 (some loops): the rival remembers fragments
  [
    {
      encounter: "You're back. I remember your starter.$From before. Before what? I can't tell.",
      victory: "I knew that move was coming.$I always do, now.",
      defeat: "I won, but I can feel the clock rewinding.$Do you feel it too?",
    },
    {
      encounter: "I counted. This is not our first fight in this place.$Not even close.",
      victory: "Right. Right! You win here.$I remember that part.",
      defeat: "I won once before, too.$It didn't change anything.",
    },
    {
      encounter: "Every time you fall, the world starts over.$And a little of me stays behind.",
      victory: "Each time I lose, I remember a little more.$Don't stop.",
      defeat: "Loop after loop, and I'm still in your way.$I'm sorry.",
    },
    {
      encounter: "I know you've been falling out there.$I know because I've watched it. Again and again.",
      victory: "Then win properly this time.$I'll hold on to every moment I can.",
      defeat: "Please... don't make me forget you again.",
    },
    {
      encounter: "Almost there. I can feel it.$Every reset has led to this spot.",
      victory: "You're getting closer to the end.$I can feel it too.",
      defeat: "Not yet. Not yet!$One more loop... I'll remember.",
    },
    {
      encounter: "I remember all of it now.$Every fall, every restart, every bad ending.",
      victory: "Then end it. For both of us.",
      defeat: "No... not again.$Come back to me. I'll be waiting.",
    },
  ],
  // Stage 3 (many loops): the rival remembers everything
  [
    {
      encounter: "I remember everything.$All of the loops. All of the fights. All of you.",
      victory: "Every run, you start here and I start here.$I'm still glad it's you.",
      defeat: "Easy for me this time.$I've had so many chances to practice.",
    },
    {
      encounter: "How many loops now? I stopped counting.$I never stopped waiting.",
      victory: "Good. Keep that fire.$I'll keep your place in line.",
      defeat: "Don't give up on me.$I'm not giving up on you.",
    },
    {
      encounter: "Every version of you, I remember.$The reckless ones, the careful ones, the ones who cried.",
      victory: "That's the one I was hoping for.$Go. Win it for us.",
      defeat: "I can't let you through yet.$You aren't ready, and I know exactly why.",
    },
    {
      encounter: "I've watched you fall a thousand different ways.$I want to watch you live.",
      victory: "Then live.$Walk out of this loop, and I'll walk beside you.",
      defeat: "Again. Fine.$I'll keep fighting you until you're strong enough.",
    },
    {
      encounter: "Next stop is the end of the world, or the end of the loop.$You decide which.",
      victory: "That's it. That's the one.$Don't look back.",
      defeat: "Close. So close.$Come back stronger and I'll be here, as always.",
    },
    {
      encounter: "This is it. The last fight before the end.$Show me everything you've learned across every loop.",
      victory: "...Then go.$Break the loop. I'll be right behind you.",
      defeat: "Not today.$Reset, if you must. I'll remember.",
    },
  ],
];

/** Ending when you win with too few loops (the loop is not broken yet). */
const ECHO_ENDING =
  "You did it... didn't you?$Funny, I feel like this was supposed to mean more.$I keep thinking I forgot something important.$If we ever meet again, I hope I remember.";

/** The true ending, when you win after enough loops. Both characters are adults in the epilogue. */
const TRUE_ENDING =
  "You did it. The loop is really over, isn't it?$I remember all of it. Every reset, every goodbye.$Every time you fell, I watched you get back up.$I counted every single one. Not once did you quit.$I don't want to forget this. I don't want to forget you.$Years later, I'm still counting.$Not loops. Mornings. Every morning with you.$I asked you the question I'd held onto for a hundred loops.$You said yes. I think every version of you would have.$We were married that spring, with every trainer we ever fought cheering us on.$And the loop never came back.$Thank you for never giving up on us.";

/** The ending dialogue to show after a Classic win, or `null` when Story Mode is off. */
export function getStoryEnding(): string | null {
  if (!inStoryClassic()) {
    return null;
  }
  return getLoopCount() >= TRUE_ENDING_LOOPS ? TRUE_ENDING : ECHO_ENDING;
}

/** The text on the end card, or `null` when Story Mode is off. */
export function getStoryEndCardText(): string | null {
  if (!inStoryClassic()) {
    return null;
  }
  return getLoopCount() >= TRUE_ENDING_LOOPS ? "The loop is broken." : "The loop continues...";
}

// ---------- Applying the rival dialogue ----------

const MESSAGE_KEYS = [
  "encounterMessages",
  "victoryMessages",
  "defeatMessages",
  "femaleEncounterMessages",
  "femaleVictoryMessages",
  "femaleDefeatMessages",
] as const;

/** The game's own rival lines, saved the first time we change them so Story Mode can be switched off again. */
const originalMessages = new Map<TrainerType, Record<string, unknown>>();

function getStoryStage(): number {
  const loops = getLoopCount();
  if (loops >= STAGE_3_LOOPS) {
    return 2;
  }
  return loops >= STAGE_2_LOOPS ? 1 : 0;
}

/**
 * Put the story's rival lines into the rival trainers, or restore the game's lines if Story Mode is off.
 * Called when the game starts, when Story Mode is switched, and after every run.
 */
export function applyStoryDialogue(): void {
  const stage = getStoryStage();
  RIVAL_TYPES.forEach((type, index) => {
    const config = trainerConfigs[type] as unknown as Record<string, unknown> | undefined;
    if (!config) {
      return;
    }

    if (!originalMessages.has(type)) {
      originalMessages.set(type, Object.fromEntries(MESSAGE_KEYS.map(key => [key, config[key]])));
    }

    if (!isStoryMode()) {
      const saved = originalMessages.get(type)!;
      for (const key of MESSAGE_KEYS) {
        config[key] = saved[key];
      }
      return;
    }

    const lines = RIVAL_LINES[stage][index];
    config.encounterMessages = [lines.encounter];
    config.victoryMessages = [lines.victory];
    config.defeatMessages = [lines.defeat];
    config.femaleEncounterMessages = [lines.encounter];
    config.femaleVictoryMessages = [lines.victory];
    config.femaleDefeatMessages = [lines.defeat];
  });
}
