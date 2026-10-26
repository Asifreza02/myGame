// ============================================================================
// AetherBound: Natural Resources, Biomes & Weather System Data
// ============================================================================

export const RESOURCE_DEFINITIONS = {
  // --- Natural Crafting Resources ---
  ELDER_WOOD: {
    id: 'ELDER_WOOD',
    name: 'Elder Wood',
    rarity: 'Common',
    icon: '🪵',
    color: 0xb58a54,
    biome: 'lush',
    description: 'Resilient ancient timber infused with nature mana, used to craft staves and traps.',
  },
  ARCANE_QUARTZ: {
    id: 'ARCANE_QUARTZ',
    name: 'Arcane Quartz',
    rarity: 'Uncommon',
    icon: '💎',
    color: 0x00f0ff,
    biome: 'snow',
    description: 'Prismatic crystal resonating with arcane frequencies, essential for focus lenses.',
  },
  EMBER_ORE: {
    id: 'EMBER_ORE',
    name: 'Ember Ore',
    rarity: 'Uncommon',
    icon: '🪨',
    color: 0xff7138,
    biome: 'volcanic',
    description: 'Geothermal ore that radiates persistent volcanic heat, used in flame magic.',
  },
  MOON_HERB: {
    id: 'MOON_HERB',
    name: 'Moon Herb',
    rarity: 'Uncommon',
    icon: '🌿',
    color: 0x83e879,
    biome: 'snow',
    description: 'Nocturnal glowing flora harvested for wards and defensive protection spells.',
  },
  AETHER_ESSENCE: {
    id: 'AETHER_ESSENCE',
    name: 'Aether Essence',
    rarity: 'Common',
    icon: '🔹',
    color: 0x55eaff,
    biome: 'lush',
    description: 'Pure ambient mana floating across the valley, used to empower all spells.',
  },
  RIVER_DEW: {
    id: 'RIVER_DEW',
    name: 'River Dew',
    rarity: 'Common',
    icon: '💧',
    color: 0x33b3ff,
    biome: 'lush',
    description: 'Purified water droplets gathered from springs and water fiends.',
  },
  BLAZING_CINDER: {
    id: 'BLAZING_CINDER',
    name: 'Blazing Cinder',
    rarity: 'Rare',
    icon: '🔥',
    color: 0xff4400,
    biome: 'volcanic',
    description: 'Superheated cinder dropped by flame brutes, powering explosive flame magic.',
  },

  // --- Backward Compatibility Aliases ---
  IRONWOOD: {
    id: 'IRONWOOD',
    name: 'Elder Wood',
    rarity: 'Common',
    icon: '🪵',
    color: 0xb58a54,
    biome: 'lush',
    aliasOf: 'ELDER_WOOD',
  },
  TITANIUM_SCRAP: {
    id: 'TITANIUM_SCRAP',
    name: 'River Dew',
    rarity: 'Common',
    icon: '💧',
    color: 0x33b3ff,
    biome: 'desert',
    aliasOf: 'RIVER_DEW',
  },
  CRYSTAL_LENS: {
    id: 'CRYSTAL_LENS',
    name: 'Arcane Quartz',
    rarity: 'Rare',
    icon: '💎',
    color: 0x00f0ff,
    biome: 'snow',
    aliasOf: 'ARCANE_QUARTZ',
  },
  ENERGY_CELL: {
    id: 'ENERGY_CELL',
    name: 'Blazing Cinder',
    rarity: 'Uncommon',
    icon: '🔥',
    color: 0xff4400,
    biome: 'volcanic',
    aliasOf: 'BLAZING_CINDER',
  },
};

export const NATURAL_RESOURCES = [
  'ELDER_WOOD',
  'ARCANE_QUARTZ',
  'EMBER_ORE',
  'MOON_HERB',
  'AETHER_ESSENCE',
  'RIVER_DEW',
  'BLAZING_CINDER',
];

export const RESOURCE_YIELDS = {
  ELDER_WOOD: 3,
  ARCANE_QUARTZ: 2,
  EMBER_ORE: 2,
  MOON_HERB: 2,
  AETHER_ESSENCE: 2,
  RIVER_DEW: 3,
  BLAZING_CINDER: 1,
};

export function isNaturalResource(id) {
  return NATURAL_RESOURCES.includes(id);
}

export const BIOME_RESOURCES = {
  lush: ['ELDER_WOOD', 'AETHER_ESSENCE', 'RIVER_DEW', 'IRONWOOD'],
  desert: ['RIVER_DEW', 'EMBER_ORE', 'AETHER_ESSENCE', 'TITANIUM_SCRAP'],
  snow: ['MOON_HERB', 'ARCANE_QUARTZ', 'ELDER_WOOD', 'CRYSTAL_LENS'],
  volcanic: ['EMBER_ORE', 'BLAZING_CINDER', 'ARCANE_QUARTZ', 'ENERGY_CELL'],
};

export const WEATHER_PHASES = [
  {
    id: 'CLEAR',
    name: 'Clear Skies',
    durationSeconds: 75,
    sky: 0xa8bdb4,
    fog: 0xa8bdb4,
    fogDensity: 0.0042,
    ambientIntensity: 1.25,
    sunIntensity: 2.0,
    movementMultiplier: 1.0,
  },
  {
    id: 'MIST',
    name: 'Rolling Mist',
    durationSeconds: 75,
    sky: 0x879b99,
    fog: 0x879b99,
    fogDensity: 0.0078,
    ambientIntensity: 1.0,
    sunIntensity: 1.45,
    movementMultiplier: 1.0,
  },
  {
    id: 'RAIN',
    name: 'Cold Rain',
    durationSeconds: 75,
    sky: 0x617371,
    fog: 0x617371,
    fogDensity: 0.0092,
    ambientIntensity: 0.9,
    sunIntensity: 1.1,
    movementMultiplier: 0.9,
  },
  {
    id: 'STORM',
    name: 'Aether Storm',
    durationSeconds: 75,
    sky: 0x3d354d,
    fog: 0x3d354d,
    fogDensity: 0.0135,
    ambientIntensity: 0.72,
    sunIntensity: 0.75,
    movementMultiplier: 0.82,
  },
];

export function getWeatherState(elapsedSeconds = 0) {
  const totalCycleDuration = WEATHER_PHASES.reduce((sum, phase) => sum + phase.durationSeconds, 0);
  const cycleTime = ((elapsedSeconds % totalCycleDuration) + totalCycleDuration) % totalCycleDuration;
  let accumulated = 0;
  for (const phase of WEATHER_PHASES) {
    if (cycleTime < accumulated + phase.durationSeconds) {
      return {
        ...phase,
        secondsIntoPhase: cycleTime - accumulated,
        secondsUntilChange: Math.ceil(accumulated + phase.durationSeconds - cycleTime),
      };
    }
    accumulated += phase.durationSeconds;
  }
  return {
    ...WEATHER_PHASES[0],
    secondsIntoPhase: 0,
    secondsUntilChange: WEATHER_PHASES[0].durationSeconds,
  };
}
