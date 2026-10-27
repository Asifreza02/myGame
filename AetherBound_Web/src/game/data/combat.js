// ============================================================================
// AetherBound: Magical Combat, Sticks, Powers, Traps & 3-Tier Mob System Data
// ============================================================================

// ----------------------------------------------------------------------------
// 1. MAGICAL STICKS & STAVES
// ----------------------------------------------------------------------------
export const MAGIC_STICKS = {
  APPRENTICE_STICK: {
    id: 'APPRENTICE_STICK',
    name: 'Apprentice Wand',
    type: 'wand',
    icon: '🪄',
    model: '/models/magic/wand-basic.glb',
    fallbackModel: 'wand',
    scale: 0.9,
    damage: 18,
    range: 48,
    cooldownMs: 350,
    manaCost: 0,
    ammo: Infinity,
    maxAmmo: Infinity,
    projectileSpeed: 70,
    element: 'arcane',
    sparkColor: 0x55eaff,
    bulletColor: 0x55eaff,
    tracerColor: '#55eaff',
    sound: 'spark',
    description: 'Basic carved elder wand channelling a crisp, high-velocity mystic spark.',
  },
  ELDER_STAFF: {
    id: 'ELDER_STAFF',
    name: 'Elder Runed Staff',
    type: 'staff',
    icon: '🔮',
    model: '/models/magic/staff-elder.glb',
    fallbackModel: 'staff',
    scale: 1.0,
    damage: 28,
    range: 65,
    cooldownMs: 300,
    manaCost: 0,
    ammo: Infinity,
    maxAmmo: Infinity,
    projectileSpeed: 85,
    element: 'nature',
    sparkColor: 0x83e879,
    bulletColor: 0x83e879,
    tracerColor: '#83e879',
    sound: 'nature_bolt',
    description: 'Staff shaped from living elder wood, resonating with high-velocity nature bolts.',
  },
  PYRE_STAFF: {
    id: 'PYRE_STAFF',
    name: 'Pyre Flame Staff',
    type: 'staff',
    icon: '🔥',
    model: '/models/magic/staff-pyre.glb',
    fallbackModel: 'staff',
    scale: 1.1,
    damage: 40,
    splashRadius: 4.5,
    range: 55,
    cooldownMs: 480,
    manaCost: 0,
    ammo: Infinity,
    maxAmmo: Infinity,
    projectileSpeed: 62,
    element: 'fire',
    sparkColor: 0xff6622,
    bulletColor: 0xff6622,
    tracerColor: '#ff6622',
    sound: 'fire_blast',
    description: 'Staff capped with an ember core that launches detonating magma orbs.',
  },
  CELESTIAL_SCEPTER: {
    id: 'CELESTIAL_SCEPTER',
    name: 'Celestial Archmage Scepter',
    type: 'staff',
    icon: '✨',
    model: '/models/magic/staff-celestial.glb',
    fallbackModel: 'staff',
    scale: 1.15,
    damage: 54,
    range: 90,
    cooldownMs: 380,
    manaCost: 0,
    ammo: Infinity,
    maxAmmo: Infinity,
    projectileSpeed: 160,
    element: 'celestial',
    sparkColor: 0xcc66ff,
    bulletColor: 0xcc66ff,
    tracerColor: '#cc66ff',
    sound: 'laser',
    description: 'Archmage scepter focusing pure Aether light into an instant piercing ray.',
  },
};

// ----------------------------------------------------------------------------
// 2. MAGICAL POWERS & GROUND TRAPS (7 HOTBAR POWER SLOTS)
// ----------------------------------------------------------------------------
export const MAGIC_POWERS = {
  FIREBALL: {
    id: 'FIREBALL',
    name: 'Arcane Fireball',
    kind: 'spell',
    category: 'attack',
    icon: '☄️',
    damage: 42,
    splashRadius: 4.0,
    range: 60,
    cooldownMs: 4000,
    burnDoT: { durationMs: 3000, tickMs: 1000, damagePerTick: 6 },
    color: 0xff5522,
    description: 'Launches a superheated sphere exploding on impact and causing 3s burn.',
  },
  FROST_LANCE: {
    id: 'FROST_LANCE',
    name: 'Frost Lance',
    kind: 'spell',
    category: 'attack',
    icon: '❄️',
    damage: 30,
    range: 65,
    cooldownMs: 4500,
    slowPercent: 0.5,
    slowDurationMs: 3000,
    color: 0x66ddff,
    description: 'Piercing ice shard that reduces target movement speed by 50% for 3s.',
  },
  LIGHTNING_BOLT: {
    id: 'LIGHTNING_BOLT',
    name: 'Lightning Lance',
    kind: 'spell',
    category: 'attack',
    icon: '⚡',
    damage: 48,
    range: 75,
    chainCount: 2,
    cooldownMs: 6000,
    color: 0xffea44,
    description: 'Instant lightning beam that shocks the primary target and arcs to 2 nearby enemies.',
  },
  AETHER_WAVE: {
    id: 'AETHER_WAVE',
    name: 'Aether Repulsion Wave',
    kind: 'spell',
    category: 'utility',
    icon: '🌊',
    damage: 20,
    range: 14,
    knockbackImpulse: 20,
    cooldownMs: 7000,
    color: 0x55eaff,
    description: 'Unleashes a radial shockwave knocking back all surrounding mobs and rivals.',
  },
  FROST_TRAP: {
    id: 'FROST_TRAP',
    name: 'Frost Rune Trap',
    kind: 'trap',
    category: 'trap',
    icon: '🕸️',
    armDelayMs: 1000,
    triggerRadius: 2.8,
    freezeDurationMs: 2500,
    cooldownMs: 12000,
    color: 0x33ccff,
    description: 'Place a magical rune on the ground that freezes the next enemy to step on it for 2.5s.',
  },
  FLAME_SIGIL: {
    id: 'FLAME_SIGIL',
    name: 'Flame Sigil Trap',
    kind: 'trap',
    category: 'trap',
    icon: '💥',
    armDelayMs: 1000,
    triggerRadius: 3.2,
    burstDamage: 32,
    burnDoT: { durationMs: 3000, tickMs: 1000, damagePerTick: 6 },
    cooldownMs: 14000,
    color: 0xff4411,
    description: 'Runic ground mine erupting into a firestorm (32 dmg + 3s burn after-effect).',
  },
  GRAVITY_SNARE: {
    id: 'GRAVITY_SNARE',
    name: 'Arcane Gravity Trap',
    kind: 'trap',
    category: 'trap',
    icon: '🌀',
    armDelayMs: 1200,
    pullRadius: 6.5,
    pullDurationMs: 3500,
    cooldownMs: 18000,
    color: 0xaa44ff,
    description: 'Singularity vortex pulling all surrounding targets into the epicenter.',
  },
  AEGIS_WARD: {
    id: 'AEGIS_WARD',
    name: 'Aegis Protective Ward',
    kind: 'spell',
    category: 'defense',
    icon: '🛡️',
    durationMs: 8000,
    cooldownMs: 22000,
    color: 0x00f0ff,
    description: 'Summons an arcane crystalline shield absorbing the next incoming hit.',
  },
  REJUVENATION: {
    id: 'REJUVENATION',
    name: 'Vital Rejuvenation',
    kind: 'spell',
    category: 'heal',
    icon: '💚',
    healAmount: 40,
    healOverTime: { durationMs: 4000, tickMs: 1000, healPerTick: 5 },
    cooldownMs: 14000,
    color: 0x44ff88,
    description: 'Harnesses nature vitality to restore 40 HP instantly and 20 HP over 4 seconds.',
  },
};

// ----------------------------------------------------------------------------
// 2b. MAGICAL GROUND TRAPS (TACTICAL RUNIC SYSTEM)
// ----------------------------------------------------------------------------
export const TRAP_DEFINITIONS = {
  FROST_TRAP: {
    id: 'FROST_TRAP',
    name: 'Frost Rune Trap',
    icon: '🕸️',
    armDelayMs: 1000,
    triggerRadius: 2.8,
    effectType: 'FREEZE',
    freezeDurationMs: 2500,
    damage: 12,
    cooldownMs: 12000,
    color: 0x33ccff,
    runeGlyph: 'ᚠ',
    description: 'Ground rune that arms after 1s; freezes stepping enemies in place for 2.5s.',
  },
  FLAME_SIGIL: {
    id: 'FLAME_SIGIL',
    name: 'Flame Sigil Trap',
    icon: '💥',
    armDelayMs: 1000,
    triggerRadius: 3.2,
    effectType: 'BURN',
    burstDamage: 32,
    burnDoT: { durationMs: 3000, tickMs: 1000, damagePerTick: 6 },
    cooldownMs: 14000,
    color: 0xff4411,
    runeGlyph: 'ᚲ',
    description: 'Runic mine detonating for 32 burst damage and inflicting a 3s burn after-effect.',
  },
  GRAVITY_SNARE: {
    id: 'GRAVITY_SNARE',
    name: 'Arcane Gravity Trap',
    icon: '🌀',
    armDelayMs: 1200,
    triggerRadius: 6.5,
    effectType: 'PULL',
    pullRadius: 6.5,
    pullDurationMs: 3500,
    cooldownMs: 18000,
    color: 0xaa44ff,
    runeGlyph: 'ᚦ',
    description: 'Singularity vortex pulling surrounding rivals and mobs toward its epicenter.',
  },
  LIGHTNING_PULSE: {
    id: 'LIGHTNING_PULSE',
    name: 'Lightning Conduit Trap',
    icon: '⚡',
    armDelayMs: 800,
    triggerRadius: 3.0,
    effectType: 'SHOCK',
    burstDamage: 28,
    chainCount: 2,
    cooldownMs: 16000,
    color: 0xffea44,
    runeGlyph: 'ᛋ',
    description: 'Conduit rune that electrocutes the triggerer and arcs lightning to nearby enemies.',
  },
  THORN_ROOTS: {
    id: 'THORN_ROOTS',
    name: 'Tangle Thorn Trap',
    icon: '🌿',
    armDelayMs: 1000,
    triggerRadius: 3.0,
    effectType: 'ROOT',
    rootDurationMs: 3000,
    damage: 18,
    cooldownMs: 11000,
    color: 0x55cc44,
    runeGlyph: 'ᛏ',
    description: 'Thorned brambles entangling victim for 3s while dealing nature damage.',
  },
};

export function getStickDefinition(stickId) {
  return MAGIC_STICKS[stickId] || MAGIC_STICKS.APPRENTICE_STICK;
}

export function getPowerDefinition(powerId) {
  return MAGIC_POWERS[powerId] || null;
}

export function getTrapDefinition(trapId) {
  return TRAP_DEFINITIONS[trapId] || null;
}

export function isStick(id) {
  return Boolean(MAGIC_STICKS[id]);
}

export function isPower(id) {
  return Boolean(MAGIC_POWERS[id]);
}

export function isTrap(id) {
  return Boolean(TRAP_DEFINITIONS[id]);
}

// ----------------------------------------------------------------------------
// 3. 3-LEVEL MOB & DRAGON SYSTEM CONFIG
// ----------------------------------------------------------------------------
export const MOB_SYSTEM_CONFIG = {
  TIER_1_WATER_MOB: {
    id: 'AQUA_FIEND',
    name: 'Aqua Zombie',
    tier: 1,
    spawnTimeSeconds: 0,
    health: 80,
    maxHealth: 80,
    speed: 4.2,
    aggroRadius: 16,
    attack: {
      type: 'WATER_SPIT',
      name: 'Aqua Water Spit',
      damage: 16,
      range: 18,
      projectileSpeed: 16,
      cooldownMs: 4600,
      color: 0x22aaff,
    },
    drops: ['RIVER_DEW', 'ELDER_WOOD', 'AETHER_ESSENCE'],
    description: 'Drowned aquatic undead zombie attacking with high-speed water projectiles.',
  },
  TIER_2_FIRE_MOB: {
    id: 'FLAME_BRUTE',
    name: 'Flame Zombie',
    tier: 2,
    spawnTimeSeconds: 90,
    health: 95,
    maxHealth: 95,
    speed: 5.2,
    aggroRadius: 18,
    attack: {
      type: 'FIRE_SPIT',
      name: 'Molten Fire Spit',
      damage: 14,
      range: 22,
      projectileSpeed: 18,
      cooldownMs: 5200,
      burnDoT: {
        durationSeconds: 3,
        tickIntervalSeconds: 1,
        damagePerTick: 2,
      },
      color: 0xff5511,
    },
    drops: ['BLAZING_CINDER', 'EMBER_ORE', 'ARCANE_QUARTZ'],
    description: 'Charred infernal magma zombie brute with incinerating attacks leaving a 3-second burn.',
  },
  TIER_3_DRAGON: {
    id: 'ASHWING_DRAKE',
    name: 'Ashwing Drake',
    tier: 3,
    spawnTimeSeconds: 180,
    health: 500,
    maxHealth: 500,
    aerialDurationSeconds: 60,  // Exactly 1 minute in air
    groundDurationSeconds: 25,  // Lands on ground for 25s
    aerialSpeed: 16.0,
    groundSpeed: 6.0,
    attacks: {
      FIRE_BREATH: {
        id: 'FIRE_BREATH',
        name: 'Fire Breath',
        telegraphMs: 1500,
        cooldownMs: 6500,
        damage: 34,
        range: 52,
        facingDotMin: 0.78,
        color: 0xff6238,
      },
      GROUND_SLAM: {
        id: 'GROUND_SLAM',
        name: 'Ground Slam',
        telegraphMs: 1100,
        cooldownMs: 5600,
        damage: 28,
        radius: 9,
        range: 13,
        color: 0xffcb4b,
      },
      TAIL_SWEEP: {
        id: 'TAIL_SWEEP',
        name: 'Grounded Tail Sweep',
        telegraphMs: 800,
        cooldownMs: 4000,
        damage: 22,
        range: 8,
        color: 0xff8833,
      },
    },
    description: 'Catastrophic dragon boss that attacks from the air for 1 minute before landing on the ground.',
  },
};

// ----------------------------------------------------------------------------
// 4. ARCANE CRAFTING RECIPES (STAVES, SPELLS & TRAPS)
// ----------------------------------------------------------------------------
export const ARCANE_CRAFTING_RECIPES = [
  // Upgraded Staves
  {
    type: 'stick',
    stickId: 'ELDER_STAFF',
    weaponId: 'ELDER_STAFF',
    name: 'Elder Runed Staff',
    icon: '🔮',
    ingredients: { ELDER_WOOD: 3, ARCANE_QUARTZ: 1 },
    description: '3x Elder Wood + 1x Arcane Quartz · 28 DMG · 65m Range · Nature Bolt',
  },
  {
    type: 'stick',
    stickId: 'PYRE_STAFF',
    weaponId: 'PYRE_STAFF',
    name: 'Pyre Flame Staff',
    icon: '🔥',
    ingredients: { ELDER_WOOD: 2, EMBER_ORE: 2, BLAZING_CINDER: 1 },
    description: '2x Elder Wood + 2x Ember Ore + 1x Blazing Cinder · 40 DMG · Explosive Magma',
  },
  {
    type: 'stick',
    stickId: 'CELESTIAL_SCEPTER',
    weaponId: 'CELESTIAL_SCEPTER',
    name: 'Celestial Archmage Scepter',
    icon: '✨',
    ingredients: { ARCANE_QUARTZ: 2, AETHER_ESSENCE: 3, BLAZING_CINDER: 1 },
    description: '2x Arcane Quartz + 3x Aether Essence + 1x Blazing Cinder · 54 DMG · 90m Piercing',
  },
  // Spells
  {
    type: 'power',
    powerId: 'FIREBALL',
    name: 'Spell: Arcane Fireball',
    icon: '☄️',
    ingredients: { EMBER_ORE: 1, BLAZING_CINDER: 1 },
    description: '1x Ember Ore + 1x Blazing Cinder · 42 Blast DMG + 3s Burn After-Effect',
  },
  {
    type: 'power',
    powerId: 'FROST_LANCE',
    name: 'Spell: Frost Lance',
    icon: '❄️',
    ingredients: { RIVER_DEW: 2, ARCANE_QUARTZ: 1 },
    description: '2x River Dew + 1x Arcane Quartz · 30 DMG + 50% Slow for 3s',
  },
  {
    type: 'power',
    powerId: 'LIGHTNING_BOLT',
    name: 'Spell: Lightning Lance',
    icon: '⚡',
    ingredients: { ARCANE_QUARTZ: 1, AETHER_ESSENCE: 2 },
    description: '1x Arcane Quartz + 2x Aether Essence · 48 Instant Chain Lightning',
  },
  // Traps
  {
    type: 'power',
    powerId: 'FROST_TRAP',
    name: 'Trap: Frost Rune Trap',
    icon: '🕸️',
    ingredients: { RIVER_DEW: 2, ELDER_WOOD: 1 },
    description: '2x River Dew + 1x Elder Wood · Ground rune that freezes enemies for 2.5s',
  },
  {
    type: 'power',
    powerId: 'FLAME_SIGIL',
    name: 'Trap: Flame Sigil Trap',
    icon: '💥',
    ingredients: { EMBER_ORE: 2, BLAZING_CINDER: 1 },
    description: '2x Ember Ore + 1x Blazing Cinder · Exploding mine dealing 32 DMG + 3s Burn',
  },
  {
    type: 'power',
    powerId: 'GRAVITY_SNARE',
    name: 'Trap: Arcane Gravity Trap',
    icon: '🌀',
    ingredients: { AETHER_ESSENCE: 2, ARCANE_QUARTZ: 1 },
    description: '2x Aether Essence + 1x Arcane Quartz · Gravitational vortex pulling enemies in',
  },
  {
    type: 'power',
    powerId: 'AEGIS_WARD',
    name: 'Spell: Aegis Protective Ward',
    icon: '🛡️',
    ingredients: { MOON_HERB: 2, AETHER_ESSENCE: 1 },
    description: '2x Moon Herb + 1x Aether Essence · Absorbs next incoming hit for 8s',
  },
  {
    type: 'power',
    powerId: 'REJUVENATION',
    name: 'Spell: Vital Rejuvenation',
    icon: '💚',
    ingredients: { MOON_HERB: 2, RIVER_DEW: 2 },
    description: '2x Moon Herb + 2x River Dew · Restores 40 HP instantly + 20 HP over 4s',
  },
];

// ----------------------------------------------------------------------------
// 5. LEGACY & BACKWARD COMPATIBILITY BRIDGES
// ----------------------------------------------------------------------------
export const ITEM_DEFINITIONS = {
  HEALTH: {
    id: 'HEALTH', name: 'Vitality Draught', rarity: 'Common', weight: 25,
    kind: 'consumable', heal: 35, color: 0xff4f7e, icon: '❤️',
    description: 'Restores 35 health when picked up.',
  },
  SPEED: {
    id: 'SPEED', name: 'Windrunner Boots', rarity: 'Common', weight: 25,
    kind: 'ability', durationMs: 6000, cooldownMs: 16000, color: 0xffdf46, icon: '⚡',
    description: 'Move 50% faster for 6 seconds.',
  },
  RECON: {
    id: 'RECON', name: 'Seeker Pulse', rarity: 'Uncommon', weight: 20,
    kind: 'ability', durationMs: 6000, cooldownMs: 22000, color: 0xa56aff, icon: '📡',
    description: 'Reveal distant rivals for 6 seconds.',
  },
  HAZARD: {
    id: 'HAZARD', name: 'Flame Sigil Trap', rarity: 'Uncommon', weight: 18,
    kind: 'ability', durationMs: 20000, cooldownMs: 28000, color: 0xff8038, icon: '💣',
    description: 'Deploy a mine that damages the next rival who crosses it.',
  },
  SHIELD: {
    id: 'SHIELD', name: 'Aegis Ward', rarity: 'Rare', weight: 12,
    kind: 'ability', durationMs: 8000, cooldownMs: 26000, color: 0x39d9ff, icon: '🛡️',
    description: 'Block one hit for 8 seconds.',
  },
  KINETIC_AMMO: {
    id: 'KINETIC_AMMO', name: 'Aether Spark Crystal', rarity: 'Common', weight: 15,
    kind: 'ammo', ammoGranted: 20, color: 0x55eaff, icon: '✨',
    description: 'Refills raw arcane energy.',
  },
  ENERGY_AMMO: {
    id: 'ENERGY_AMMO', name: 'Prismatic Focus Gem', rarity: 'Uncommon', weight: 12,
    kind: 'ammo', ammoGranted: 12, color: 0xcc66ff, icon: '🔮',
    description: 'Restores charged celestial mana.',
  },
  CHEST: {
    id: 'CHEST', name: 'Aether Supply Cache', rarity: 'Rare', weight: 8,
    kind: 'cache', color: 0xffaa22, icon: '📦',
    description: 'Contains high-value natural crafting materials and essences.',
  },
};

export const KNIFE_RULES = {
  damage: 18,
  range: 48,
  facingDotMin: 0.5,
  cooldownMs: 350,
  simultaneousWindowMs: 70,
};

// Aliased to maintain compatibility across existing systems
export const WEAPON_DEFINITIONS = {
  ...MAGIC_STICKS,
  KNIFE: MAGIC_STICKS.APPRENTICE_STICK,
  PISTOL: MAGIC_STICKS.APPRENTICE_STICK,
  GUN: MAGIC_STICKS.ELDER_STAFF,
  LASER_GUN: MAGIC_STICKS.CELESTIAL_SCEPTER,
  PLASMA_CANNON: MAGIC_STICKS.PYRE_STAFF,
};

export const WEAPON_CRAFTING_RECIPES = ARCANE_CRAFTING_RECIPES;

export const DRAGON_PHASES = [
  { id: 'PASSIVE', startsAtSeconds: 0, speed: 8, aggroRange: 38, damageMultiplier: 0.25, cooldownMultiplier: 2.5, telegraphMultiplier: 1.3, rangeMultiplier: 0.75 },
  { id: 'PHASE_1', startsAtSeconds: 180, speed: 12, aggroRange: Infinity, damageMultiplier: 1, cooldownMultiplier: 1, telegraphMultiplier: 1, rangeMultiplier: 1 },
  { id: 'PHASE_2', startsAtSeconds: 360, speed: 15, aggroRange: Infinity, damageMultiplier: 1.4, cooldownMultiplier: 0.8, telegraphMultiplier: 0.9, rangeMultiplier: 1.08 },
  { id: 'PHASE_3', startsAtSeconds: 540, speed: 18, aggroRange: Infinity, damageMultiplier: 1.85, cooldownMultiplier: 0.65, telegraphMultiplier: 0.78, rangeMultiplier: 1.2 },
];

export function getDragonPhase(elapsedSeconds) {
  let phase = DRAGON_PHASES[0];
  for (const candidate of DRAGON_PHASES) {
    if (elapsedSeconds < candidate.startsAtSeconds) break;
    phase = candidate;
  }
  return phase;
}

export const DRAGON_ATTACKS = MOB_SYSTEM_CONFIG.TIER_3_DRAGON.attacks;
