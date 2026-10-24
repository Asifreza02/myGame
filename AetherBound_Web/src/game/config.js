// Game Configuration and Data-Driven Entity Definitions

export const GAME_CONFIG = {
  ROUND_TIME: 90, // seconds
  WORLD: {
    CHUNK_SIZE: 32,
    CHUNK_SEGMENTS: 16,
    RENDER_DISTANCE: 4, // 4 chunks radius in all directions
    HEIGHT_SCALE: 1.8, // Flat plain field without ridges
    NOISE_SCALE: 0.007,
    WATER_LEVEL: 0.0, // Water elevation for lakes/basins
    BUILDING_GRID_SIZE: 110, // Buildings placed far apart (every ~110m)
    BIG_ROCK_COUNT: 2, // Big rock monoliths per chunk
    FOLIAGE_DENSITY: 3, // Low trees/bushes
  },
  RUNNER: {
    BASE_SPEED: 14.0,
    SPRINT_SPEED: 22.0,
    JUMP_FORCE: 11.0,
    GRAVITY: 24.0,
    STAMINA_MAX: 100,
    STAMINA_DRAIN: 25, // per second while sprinting
    STAMINA_RECOVERY: 18, // per second while resting
    RADIUS: 0.8,
    HEIGHT: 1.8,
    SLIDE_HEIGHT: 0.9,
    SLIDE_BURST: 1.35,
    SLIDE_DURATION: 0.75,
    VAULT_MIN_HEIGHT: 0.7,
    VAULT_MAX_HEIGHT: 2.3,
  },
  SABOTEUR: {
    MAX_ENERGY: 100,
    ENERGY_REGEN: 6, // points per sec
    CAMERA_SPEED: 45.0,
    CAMERA_MIN_Y: 8,
    CAMERA_MAX_Y: 70,
    PLACEMENT_MAX_DIST: 90,
    RECON_COOLDOWN: 14.0, // seconds
    RECON_DURATION: 6.0,   // seconds
  },
};

// Data-driven Obstacle Definitions
export const OBSTACLES = {
  WALL: {
    id: 'WALL',
    name: 'Barrier Wall',
    cost: 25,
    key: '1',
    description: 'Impassable concrete barricade forcing a detour.',
    icon: '🧱',
    size: { width: 8, height: 4, depth: 1.5 },
    color: 0x8899aa,
    type: 'SOLID',
    durability: 100, // Destructible by explosions or rolling boulders
    lifetime: 0,
  },
  MUD: {
    id: 'MUD',
    name: 'Tar / Mud Trap',
    cost: 20,
    key: '2',
    description: 'Sticky swamp zone reducing Runner speed by 65%.',
    icon: '🧪',
    size: { width: 7, height: 0.3, depth: 7 },
    color: 0x3d2714,
    type: 'ZONE',
    slowFactor: 0.35,
    duration: 3.0,
  },
  SPIKES: {
    id: 'SPIKES',
    name: 'Spike Barricade',
    cost: 35,
    key: '3',
    description: 'Dangerous thorns that repel the runner with knockback.',
    icon: '⚡',
    size: { width: 6, height: 2.2, depth: 2 },
    color: 0xcc3333,
    type: 'HAZARD',
    knockback: 15,
    durability: 60,
  },
  BOULDER: {
    id: 'BOULDER',
    name: 'Rolling Boulder',
    cost: 40,
    key: '4',
    description: 'Heavy kinetic sphere rolling down slopes.',
    icon: '☄️',
    radius: 2.2,
    color: 0x665544,
    type: 'DYNAMIC',
    speed: 8.0,
  },
  BARREL: {
    id: 'BARREL',
    name: 'Explosive Barrel',
    cost: 45,
    key: '5',
    description: 'Volatile explosive mine. Detonates on proximity or boulder impact, launching a massive shockwave and shattering nearby walls!',
    icon: '💥',
    size: { radius: 1.1, height: 2.2 },
    color: 0xff4400,
    type: 'EXPLOSIVE',
    blastRadius: 9.0,
    blastKnockback: 26.0,
  }
};

// Extensible Role Definitions
export const ROLE_DEFINITIONS = {
  RUNNER: {
    id: 'runner',
    title: 'The Runner',
    description: 'Survive the arena, outlast rival contenders, and defeat the dragon.',
    cameraMode: 'THIRD_PERSON',
    controls: 'WASD / Shift to Sprint / Space to Jump',
  },
  SABOTEUR: {
    id: 'saboteur',
    title: 'The Saboteur',
    description: 'Survey the terrain from above and place tactical obstacles to stop the Runner.',
    cameraMode: 'TACTICAL_OVERHEAD',
    controls: 'WASD / Mouse to fly & Click terrain to place obstacles (1-4 keys to select)',
  },
  GUARDIAN: {
    id: 'guardian',
    title: 'The Guardian (Phase 4)',
    description: 'Allied with Runner. Can shatter obstacles and cast temporary shields.',
  },
  TRAPPER: {
    id: 'trapper',
    title: 'The Trapper (Phase 4)',
    description: 'Allied with Saboteur. Specializes in hidden tripwires and blind spots.',
  }
};

// Phase 3: Procedural Multi-Biome Definitions
export const BIOMES = {
  LUSH: {
    id: 'LUSH',
    name: 'Lush Meadows & Pine Forest',
    grassColor: 0x4a7e37,
    foliageColor: 0x24582e,
    rockColor: 0x58524d,
    heightScale: 1.8,
    treeDensity: 4,
    hasWater: true,
  },
  DESERT: {
    id: 'DESERT',
    name: 'Rocky Desert Canyons',
    grassColor: 0xd49a5b,
    foliageColor: 0xa87f44,
    rockColor: 0x8a4b2a,
    heightScale: 2.6,
    treeDensity: 2,
    hasWater: false,
  },
  SNOW: {
    id: 'SNOW',
    name: 'Frost Peaks & Frozen Tundra',
    grassColor: 0xeef5fc,
    foliageColor: 0x447766,
    rockColor: 0x6e7e8e,
    heightScale: 2.8,
    treeDensity: 3,
    hasWater: true,
    isSlippery: true,
  },
  VOLCANIC: {
    id: 'VOLCANIC',
    name: 'Volcanic Basalt Badlands',
    grassColor: 0x232328,
    foliageColor: 0xff4400,
    rockColor: 0x18181c,
    heightScale: 2.2,
    treeDensity: 1,
    hasWater: false,
    hasLava: true,
  }
};

// Phase 3: Collectible Items & Power-Ups
export const POWERUPS = {
  SPEED: {
    id: 'SPEED',
    name: 'Speed Surge',
    duration: 6.0,
    multiplier: 1.6,
    color: 0xffea00,
    icon: '⚡',
    description: '+60% Sprint Burst Speed',
  },
  JUMP: {
    id: 'JUMP',
    name: 'High Jump',
    duration: 8.0,
    jumpForce: 18.0,
    color: 0x00ff88,
    icon: '🦘',
    description: 'Kinetic Leap: Double Jump Height',
  },
  SHIELD: {
    id: 'SHIELD',
    name: 'Aegis Shield',
    duration: 25.0,
    color: 0x00d4ff,
    icon: '🛡️',
    description: 'Absorbs 1 Hazard / Obstacle Hit',
  },
  HEALTH: {
    id: 'HEALTH',
    name: 'Nanite Repair',
    amount: 30,
    color: 0xff0077,
    icon: '❤️',
    description: '+30 Integrity Restoration',
  }
};

export const RESOURCES = {
  AETHER_ESSENCE: {
    id: 'AETHER_ESSENCE',
    name: 'Aether Essence',
    icon: '🔹',
    color: 0x55eaff,
  },
  EMBER_ORE: {
    id: 'EMBER_ORE',
    name: 'Ember Ore',
    icon: '🪨',
    color: 0xff7138,
  },
  IRONWOOD: {
    id: 'IRONWOOD',
    name: 'Ironwood',
    icon: '🪵',
    color: 0xb58a54,
  },
  MOON_HERB: {
    id: 'MOON_HERB',
    name: 'Moon Herb',
    icon: '🌿',
    color: 0x83e879,
  },
  TITANIUM_SCRAP: {
    id: 'TITANIUM_SCRAP',
    name: 'Titanium Scrap',
    icon: '🔩',
    color: 0x8ea2b8,
  },
  CRYSTAL_LENS: {
    id: 'CRYSTAL_LENS',
    name: 'Crystal Lens',
    icon: '💎',
    color: 0x00f0ff,
  },
  ENERGY_CELL: {
    id: 'ENERGY_CELL',
    name: 'Energy Cell',
    icon: '⚡',
    color: 0xffe042,
  },
};

export const CRAFTING_RECIPES = {
  PISTOL: {
    id: 'PISTOL',
    name: 'Aether Blaster Pistol',
    icon: '🔫',
    type: 'weapon',
    description: 'Fast semi-auto blaster (24 Dmg, 16 Rounds)',
    ingredients: { TITANIUM_SCRAP: 1, EMBER_ORE: 1 },
  },
  GUN: {
    id: 'GUN',
    name: 'Combat Assault Blaster',
    icon: '⚡',
    type: 'weapon',
    description: 'High-rate assault blaster (19 Dmg, 30 Rounds)',
    ingredients: { TITANIUM_SCRAP: 2, IRONWOOD: 2, EMBER_ORE: 1 },
  },
  LASER_GUN: {
    id: 'LASER_GUN',
    name: 'Prismatic Laser Cannon',
    icon: '💠',
    type: 'weapon',
    description: 'Piercing sniper laser beam (42 Dmg, 15 Rounds)',
    ingredients: { CRYSTAL_LENS: 1, AETHER_ESSENCE: 2, ENERGY_CELL: 1 },
  },
  PLASMA_CANNON: {
    id: 'PLASMA_CANNON',
    name: 'Heavy Plasma Mortar',
    icon: '💣',
    type: 'weapon',
    description: 'Explosive splash plasma cannon (60 Dmg, 8 Rounds)',
    ingredients: { ENERGY_CELL: 2, EMBER_ORE: 2, TITANIUM_SCRAP: 2 },
  },
  SPEED: {
    id: 'SPEED',
    name: 'Windrunner Boots',
    icon: '🥾',
    description: '+60% speed for 6 seconds',
    ingredients: { AETHER_ESSENCE: 1, IRONWOOD: 1 },
  },
  JUMP: {
    id: 'JUMP',
    name: 'Springstep Boots',
    icon: '🦘',
    description: 'Powerful jumps for 8 seconds',
    ingredients: { IRONWOOD: 1, MOON_HERB: 1 },
  },
  SHIELD: {
    id: 'SHIELD',
    name: 'Aether Ward',
    icon: '🛡️',
    description: 'Block one hazard hit',
    ingredients: { AETHER_ESSENCE: 1, EMBER_ORE: 1 },
  },
  HEALTH: {
    id: 'HEALTH',
    name: 'Vitality Draught',
    icon: '🧪',
    description: 'Restore 30 health',
    ingredients: { AETHER_ESSENCE: 1, MOON_HERB: 2 },
  },
};

// Fixed daylight keeps the world clearly visible throughout every match.
export const DAYLIGHT_CONFIG = {
  sun: 0xfff7e2,
  sky: 0xa8bdb4,
  fog: 0xa8bdb4,
  ambient: 0xd9e8e5,
  ambientIntensity: 1.25,
  sunIntensity: 2.0,
  sunOffset: { x: 70, y: 130, z: 60 },
};
