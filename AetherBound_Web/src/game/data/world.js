export const RESOURCE_DEFINITIONS = {
  AETHER_ESSENCE: {
    id: 'AETHER_ESSENCE',
    name: 'Aether Essence',
    rarity: 'Common',
    icon: '🔹',
    color: 0x55eaff,
    biome: 'lush',
  },
  EMBER_ORE: {
    id: 'EMBER_ORE',
    name: 'Ember Ore',
    rarity: 'Uncommon',
    icon: '🪨',
    color: 0xff7138,
    biome: 'volcanic',
  },
  IRONWOOD: {
    id: 'IRONWOOD',
    name: 'Ironwood',
    rarity: 'Common',
    icon: '🪵',
    color: 0xb58a54,
    biome: 'lush',
  },
  MOON_HERB: {
    id: 'MOON_HERB',
    name: 'Moon Herb',
    rarity: 'Uncommon',
    icon: '🌿',
    color: 0x83e879,
    biome: 'snow',
  },
  TITANIUM_SCRAP: {
    id: 'TITANIUM_SCRAP',
    name: 'Titanium Scrap',
    rarity: 'Common',
    icon: '🔩',
    color: 0x8ea2b8,
    biome: 'desert',
  },
  CRYSTAL_LENS: {
    id: 'CRYSTAL_LENS',
    name: 'Crystal Lens',
    rarity: 'Rare',
    icon: '💎',
    color: 0x00f0ff,
    biome: 'snow',
  },
  ENERGY_CELL: {
    id: 'ENERGY_CELL',
    name: 'Energy Cell',
    rarity: 'Uncommon',
    icon: '⚡',
    color: 0xffe042,
    biome: 'volcanic',
  },
};

export const BIOME_RESOURCES = {
  lush: ['IRONWOOD', 'AETHER_ESSENCE', 'TITANIUM_SCRAP'],
  desert: ['TITANIUM_SCRAP', 'EMBER_ORE', 'AETHER_ESSENCE'],
  snow: ['MOON_HERB', 'CRYSTAL_LENS', 'IRONWOOD'],
  volcanic: ['EMBER_ORE', 'ENERGY_CELL', 'TITANIUM_SCRAP'],
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
