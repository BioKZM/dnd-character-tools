// Oyun ikonlari icin eslemeler. Ikonlar game-icons.net (CC BY 3.0), veri: src/components/ui/game-icon-data.ts
// Yeni bir isim eklersen `node tools/build-game-icons.mjs` ile veri dosyasini yeniden uret.
import { GAME_ICONS } from "@/components/ui/game-icon-data";

export type GameIconName = keyof typeof GAME_ICONS;

const FALLBACK: GameIconName = "star-swirl";

function pick(name: string): GameIconName {
  return (name in GAME_ICONS ? name : FALLBACK) as GameIconName;
}

function byKeywords(text: string, rules: Array<[RegExp, string]>, fallback: string): GameIconName {
  const value = text.toLowerCase();
  const hit = rules.find(([pattern]) => pattern.test(value));
  return pick(hit ? hit[1] : fallback);
}

const CLASS_ICONS: Record<string, string> = {
  artificer: "gears",
  barbarian: "battle-axe",
  bard: "lyre",
  cleric: "holy-symbol",
  druid: "oak-leaf",
  fighter: "crossed-swords",
  monk: "meditation",
  paladin: "shield-reflect",
  ranger: "bow-arrow",
  rogue: "hood",
  sorcerer: "fire-spell-cast",
  warlock: "evil-eyes",
  wizard: "wizard-staff",
};

export function classIcon(classId: string): GameIconName {
  return pick(CLASS_ICONS[classId] ?? FALLBACK);
}

export function raceIcon(idOrName: string): GameIconName {
  return byKeywords(
    idOrName,
    [
      [/eladrin|fey|fairy/, "fairy"],
      [/elf|drow/, "elf-ear"],
      [/tabaxi|cat/, "cat"],
      [/dwarf|duergar/, "dwarf-face"],
      [/dragon/, "dragon-head"],
      [/tiefling|devil/, "devil-mask"],
      [/gnome/, "pointy-hat"],
      [/orc/, "orc-head"],
      [/halfling|hobbit/, "hobbit-door"],
      [/human/, "person"],
    ],
    "person",
  );
}

const SKILL_ICONS: Record<string, string> = {
  athletics: "weight-lifting-up",
  acrobatics: "acrobatic",
  "sleight-of-hand": "robber-hand",
  stealth: "hood",
  arcana: "spell-book",
  history: "scroll-unfurled",
  investigation: "magnifying-glass",
  nature: "tree-branch",
  religion: "prayer",
  "animal-handling": "bear-face",
  insight: "brain",
  medicine: "caduceus",
  perception: "eye-target",
  survival: "campfire",
  deception: "drama-masks",
  intimidation: "evil-eyes",
  performance: "lyre",
  persuasion: "talk",
};

export function skillIcon(skillId: string): GameIconName {
  const key = skillId.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return pick(SKILL_ICONS[key] ?? (key.startsWith("sleight") ? "robber-hand" : key.startsWith("animal") ? "bear-face" : "skills"));
}

export function schoolIcon(school: string | undefined | null): GameIconName {
  return byKeywords(
    school ?? "",
    [
      [/abjur/, "magic-shield"],
      [/conjur/, "magic-portal"],
      [/divin/, "crystal-ball"],
      [/enchant/, "heart-wings"],
      [/evoc/, "fireball"],
      [/illus/, "domino-mask"],
      [/necro/, "skull-crossed-bones"],
      [/transm/, "cauldron"],
    ],
    "magic-swirl",
  );
}

export function weaponIcon(name: string): GameIconName {
  return byKeywords(
    name,
    [
      [/hand crossbow|light crossbow|heavy crossbow|crossbow/, "crossbow"],
      [/longbow|shortbow|bow/, "bow-arrow"],
      [/sling/, "sling"],
      [/dart/, "dart"],
      [/blowgun|net/, "fishing-net"],
      [/whip/, "whip"],
      [/javelin/, "thrown-spear"],
      [/trident/, "trident"],
      [/spear|lance|pike/, "barbed-spear"],
      [/glaive/, "glaive"],
      [/halberd/, "halberd"],
      [/flail/, "flail"],
      [/morningstar/, "spiked-mace"],
      [/mace/, "flanged-mace"],
      [/war pick|pick/, "war-pick"],
      [/light hammer/, "claw-hammer"],
      [/maul|hammer/, "warhammer"],
      [/handaxe|hatchet/, "hatchet"],
      [/axe/, "battle-axe"],
      [/club/, "wood-club"],
      [/quarterstaff|staff/, "bo"],
      [/sickle/, "sickle"],
      [/dagger/, "plain-dagger"],
      [/shortsword/, "gladius"],
      [/greatsword/, "relic-blade"],
      [/scimitar|rapier|katana/, "katana"],
      [/sword/, "broadsword"],
    ],
    "sword-clash",
  );
}

export function toolIcon(name: string): GameIconName {
  return byKeywords(
    name,
    [
      [/callig/, "quill-ink"],
      [/paint/, "paint-brush"],
      [/herbal/, "herbs-bundle"],
      [/thie/, "lockpicks"],
      [/instrument|lute|flute|drum|horn|lyre|viol/, "pan-flute"],
      [/gaming|dice|card/, "rolling-dices"],
      [/smith|tinker|mason|carpenter/, "anvil"],
      [/disguise|forgery/, "domino-mask"],
      [/vehicle/, "knapsack"],
    ],
    "toolbox",
  );
}

export function backgroundIcon(idOrName: string): GameIconName {
  return byKeywords(
    idOrName,
    [
      [/hermit|monk|cloister/, "lotus"],
      [/acolyte|priest|faith|inquisitor/, "prayer"],
      [/soldier|veteran|mercenary|guard|watch|knight/, "crossed-swords"],
      [/criminal|urchin|smuggl|spy|agent|bandit|thie/, "hood"],
      [/sage|scholar|student|mage|archae|researcher/, "spell-book"],
      [/outlander|traveler|drifter|giant|foundling|feylost/, "campfire"],
      [/folk hero|hero/, "laurels"],
      [/entertainer|charlatan|celebrity|actor|grinner/, "drama-masks"],
      [/noble|courtier|scion|house/, "visored-helm"],
      [/merchant|guild|artisan|crafter/, "coins"],
      [/sailor|pirate|harbor|marine|fisher/, "trident"],
      [/haunted/, "skull-crossed-bones"],
    ],
    "open-book",
  );
}

export function featIcon(name: string): GameIconName {
  return byKeywords(
    name,
    [
      [/alert/, "alarm-clock"],
      [/lucky|luck/, "clover"],
      [/tough|durable/, "heart-plus"],
      [/mobile|speed|fleet|squat/, "running-ninja"],
      [/sentinel|defensive|guard/, "visored-helm"],
      [/war caster|spell|magic|arcane|ritual|initiate|adept|robes|caster/, "fire-spell-cast"],
      [/sharpshooter|archer|eye|observant/, "eye-target"],
      [/crossbow/, "crossbow"],
      [/great weapon|weapon master|polearm|slasher|crusher|piercer|savage/, "battle-axe"],
      [/shield/, "round-shield"],
      [/armor/, "breastplate"],
      [/skill|expert|prodigy/, "skills"],
      [/resilient/, "checked-shield"],
      [/actor|performer/, "drama-masks"],
      [/grappl|tavern|brawl/, "fist"],
      [/leader|inspir|knight|squire/, "laurels"],
      [/healer|chef/, "caduceus"],
      [/dragonmark|mark/, "tied-scroll"],
      [/linguist|telepath/, "talk"],
      [/dual|two-weapon/, "sword-clash"],
      [/stealth|skulker|lurker/, "hood"],
    ],
    "laurels",
  );
}

export function featureIcon(name: string): GameIconName {
  return byKeywords(
    name,
    [
      [/ability score improvement|asi/, "stars-stack"],
      [/movement|speed|step|dash|fleet|land's stride|roving/, "run"],
      [/unarmored defense|defense|armor/, "checked-shield"],
      [/martial arts|unarmed|flurry|fist/, "fist"],
      [/\bki\b|focus|meditat|stillness|timeless|perfect self/, "meditation"],
      [/fall/, "falling"],
      [/evasion|uncanny|dodge|deflect|parry/, "dodge"],
      [/extra attack|attack|strike|surge|blade|weapon|kensei|accuracy/, "sword-clash"],
      [/stun|lightning/, "lightning-arc"],
      [/heal|second wind|purity|body|hit point|vigor/, "heart-plus"],
      [/language|tongue|speak/, "talk"],
      [/soul|save|resilien|indomitable|diamond/, "checked-shield"],
      [/invisible|empty body|vanish|hide|shadow|veil/, "hood"],
      [/sense|aware|sight|vision|perception|eye/, "eye-target"],
      [/favored|enemy|foe|hunter|slayer|planar/, "bow-arrow"],
      [/explorer|terrain|wanderer/, "campfire"],
      [/pact|patron|invocation|eldritch|thrall|mind|whisper/, "evil-eyes"],
      [/inspiration|song|bardic|countercharm|college|jack of all/, "lyre"],
      [/expertise|skill/, "skills"],
      [/fighting style|style/, "crossed-swords"],
      [/spell|magic|arcan|cantrip|secrets|mystic/, "magic-swirl"],
      [/tool|brush|craft/, "quill-ink"],
    ],
    "star-swirl",
  );
}

export function featureIconFor(text: string): GameIconName {
  return featureIcon(text);
}
