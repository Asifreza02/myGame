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
    id: 'HAZARD', name: 'Snare Mine', rarity: 'Uncommon', weight: 18,
    kind: 'ability', durationMs: 20000, cooldownMs: 28000, color: 0xff8038, icon: '💣',
    description: 'Deploy a mine that damages the next rival who crosses it.',
  },
  SHIELD: {
    id: 'SHIELD', name: 'Aegis Ward', rarity: 'Rare', weight: 12,
    kind: 'ability', durationMs: 8000, cooldownMs: 26000, color: 0x39d9ff, icon: '🛡️',
    description: 'Block one hit for 8 seconds.',
  },
  KINETIC_AMMO: {
    id: 'KINETIC_AMMO', name: 'Blaster Energy Pack', rarity: 'Common', weight: 15,
    kind: 'ammo', ammoGranted: 20, color: 0xd49b42, icon: '🔋',
    description: 'Restores 20 rounds of kinetic blaster ammo.',
  },
  ENERGY_AMMO: {
    id: 'ENERGY_AMMO', name: 'Prismatic Cell Pack', rarity: 'Uncommon', weight: 12,
    kind: 'ammo', ammoGranted: 12, color: 0x39ffff, icon: '✨',
    description: 'Restores 12 charges of laser & plasma ammo.',
  },
  CHEST: {
    id: 'CHEST', name: 'Aether Supply Cache', rarity: 'Rare', weight: 8,
    kind: 'cache', color: 0xffaa22, icon: '📦',
    description: 'Contains high-value crafting supplies and energy cells.',
  },
};

export const KNIFE_RULES = {
  damage: 34,
  range: 3.4,
  facingDotMin: 0.5,
  cooldownMs: 650,
  simultaneousWindowMs: 70,
};

export const WEAPON_DEFINITIONS = {
  KNIFE: {
    id: 'KNIFE',
    name: 'Survival Dagger',
    type: 'melee',
    icon: '🗡️',
    model: null,
    damage: 34,
    range: 3.5,
    cooldownMs: 650,
    ammo: Infinity,
    maxAmmo: Infinity,
    projectileSpeed: 0,
    bulletColor: null,
    tracerColor: null,
    description: 'Basic survival blade for close-quarters combat.',
  },
  PISTOL: {
    id: 'PISTOL',
    name: 'Aether Blaster Pistol',
    type: 'ranged',
    icon: '🔫',
    model: '/models/weapons/blaster-smg.glb',
    scale: 0.85,
    damage: 24,
    range: 50,
    cooldownMs: 320,
    ammo: 16,
    maxAmmo: 16,
    projectileSpeed: 85,
    bulletColor: 0x00f0ff,
    tracerColor: '#00f0ff',
    sound: 'pistol',
    description: 'Rapid semi-automatic sidearm firing charged plasma bolts.',
  },
  GUN: {
    id: 'GUN',
    name: 'Combat Assault Blaster',
    type: 'ranged',
    icon: '⚡',
    model: '/models/weapons/blaster-rifle.glb',
    scale: 0.95,
    damage: 19,
    range: 70,
    cooldownMs: 180,
    ammo: 30,
    maxAmmo: 30,
    projectileSpeed: 100,
    bulletColor: 0xffaa00,
    tracerColor: '#ffaa00',
    sound: 'rifle',
    description: 'High-cadence tactical blaster for mid-range skirmishes.',
  },
  LASER_GUN: {
    id: 'LASER_GUN',
    name: 'Prismatic Laser Cannon',
    type: 'laser',
    icon: '💠',
    model: '/models/weapons/blaster-rifle.glb',
    scale: 1.05,
    damage: 42,
    range: 95,
    cooldownMs: 420,
    ammo: 15,
    maxAmmo: 15,
    projectileSpeed: 200,
    bulletColor: 0x39ffff,
    tracerColor: '#39ffff',
    sound: 'laser',
    description: 'Precision beam accelerator that cuts through players and dragon hide.',
  },
  PLASMA_CANNON: {
    id: 'PLASMA_CANNON',
    name: 'Heavy Plasma Mortar',
    type: 'explosive',
    icon: '💣',
    model: '/models/weapons/blaster-heavy.glb',
    scale: 1.15,
    damage: 60,
    splashRadius: 6.5,
    range: 55,
    cooldownMs: 850,
    ammo: 8,
    maxAmmo: 8,
    projectileSpeed: 42,
    bulletColor: 0xff3366,
    tracerColor: '#ff3366',
    sound: 'plasma',
    description: 'Launches a superheated plasma ball with devastating explosive impact.',
  },
};

export const WEAPON_CRAFTING_RECIPES = [
  {
    weaponId: 'PISTOL',
    name: 'Aether Blaster Pistol',
    icon: '🔫',
    ingredients: { TITANIUM_SCRAP: 1, EMBER_ORE: 1 },
    ammoGranted: 16,
    description: '1x Titanium Scrap + 1x Ember Ore · 24 Damage · 16 Rounds',
  },
  {
    weaponId: 'GUN',
    name: 'Combat Assault Blaster',
    icon: '⚡',
    ingredients: { TITANIUM_SCRAP: 2, IRONWOOD: 2, EMBER_ORE: 1 },
    ammoGranted: 30,
    description: '2x Titanium Scrap + 2x Ironwood + 1x Ember Ore · 19 Damage · 30 Rounds',
  },
  {
    weaponId: 'LASER_GUN',
    name: 'Prismatic Laser Cannon',
    icon: '💠',
    ingredients: { CRYSTAL_LENS: 1, AETHER_ESSENCE: 2, ENERGY_CELL: 1 },
    ammoGranted: 15,
    description: '1x Crystal Lens + 2x Aether Essence + 1x Energy Cell · 42 Damage · 15 Charges',
  },
  {
    weaponId: 'PLASMA_CANNON',
    name: 'Heavy Plasma Mortar',
    icon: '💣',
    ingredients: { ENERGY_CELL: 2, EMBER_ORE: 2, TITANIUM_SCRAP: 2 },
    ammoGranted: 8,
    description: '2x Energy Cell + 2x Ember Ore + 2x Titanium Scrap · 60 Dmg + Splash · 8 Rounds',
  },
  {
    ammoType: 'KINETIC_AMMO',
    name: 'Blaster Energy Pack (+20)',
    icon: '🔋',
    ingredients: { EMBER_ORE: 1, AETHER_ESSENCE: 1 },
    ammoGranted: 20,
    description: '1x Ember Ore + 1x Aether Essence · Refills 20 rounds for Pistol / Gun',
  },
  {
    ammoType: 'ENERGY_AMMO',
    name: 'Prismatic Cell Pack (+12)',
    icon: '✨',
    ingredients: { ENERGY_CELL: 1, AETHER_ESSENCE: 1 },
    ammoGranted: 12,
    description: '1x Energy Cell + 1x Aether Essence · Refills 12 rounds for Laser / Plasma',
  },
];

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

export const DRAGON_ATTACKS = {
  FIRE_BREATH: {
    id: 'FIRE_BREATH', name: 'Fire Breath', telegraphMs: 1500,
    cooldownMs: 6500, damage: 34, range: 52, facingDotMin: 0.78,
    color: 0xff6238,
  },
  GROUND_SLAM: {
    id: 'GROUND_SLAM', name: 'Ground Slam', telegraphMs: 1100,
    cooldownMs: 5600, damage: 28, radius: 9, range: 13,
    color: 0xffcb4b,
  },
};
