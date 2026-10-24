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
};

export const BIOME_RESOURCES = {
  lush: ['IRONWOOD', 'AETHER_ESSENCE'],
  desert: ['AETHER_ESSENCE', 'EMBER_ORE'],
  snow: ['MOON_HERB', 'IRONWOOD'],
  volcanic: ['EMBER_ORE', 'AETHER_ESSENCE'],
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
    fogDensity: 0.012,
    ambientIntensity: 1.1,
    sunIntensity: 1.7,
    movementMultiplier: 1.0,
  },
  {
    id: 'RAIN',
    name: 'Driving Rain',
    durationSeconds: 75,
    sky: 0x718381,
    fog: 0x718381,
    fogDensity: 0.008,
    ambientIntensity: 0.95,
    sunIntensity: 1.35,
    movementMultiplier: 0.92,
  },
  {
    id: 'STORM',
    name: 'Aether Storm',
    durationSeconds: 75,
    sky: 0x52676c,
    fog: 0x52676c,
    fogDensity: 0.014,
    ambientIntensity: 0.82,
    sunIntensity: 1.1,
    movementMultiplier: 0.85,
  },
];

export function getWeatherState(elapsedSeconds) {
  const elapsed = Math.max(0, elapsedSeconds);
  let phaseStart = 0;
  for (const phase of WEATHER_PHASES) {
    const phaseEnd = phaseStart + phase.durationSeconds;
    if (elapsed < phaseEnd || phase === WEATHER_PHASES[WEATHER_PHASES.length - 1]) {
      return {
        id: phase.id,
        name: phase.name,
        sky: phase.sky,
        fog: phase.fog,
        fogDensity: phase.fogDensity,
        ambientIntensity: phase.ambientIntensity,
        sunIntensity: phase.sunIntensity,
        movementMultiplier: phase.movementMultiplier,
        secondsUntilChange: Math.max(0, Math.ceil(phaseEnd - elapsed)),
      };
    }
    phaseStart = phaseEnd;
  }
  return WEATHER_PHASES[0];
}
