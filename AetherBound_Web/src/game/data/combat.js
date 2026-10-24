export const ITEM_DEFINITIONS = {
  HEALTH: {
    id: 'HEALTH', name: 'Vitality Draught', rarity: 'Common', weight: 25,
    kind: 'consumable', heal: 35, color: 0xff4f7e,
    description: 'Restores 35 health when picked up.',
  },
  SPEED: {
    id: 'SPEED', name: 'Windrunner Boots', rarity: 'Common', weight: 25,
    kind: 'ability', durationMs: 6000, cooldownMs: 16000, color: 0xffdf46,
    description: 'Move 50% faster for 6 seconds.',
  },
  RECON: {
    id: 'RECON', name: 'Seeker Pulse', rarity: 'Uncommon', weight: 20,
    kind: 'ability', durationMs: 6000, cooldownMs: 22000, color: 0xa56aff,
    description: 'Reveal distant rivals for 6 seconds.',
  },
  HAZARD: {
    id: 'HAZARD', name: 'Snare Mine', rarity: 'Uncommon', weight: 18,
    kind: 'ability', durationMs: 20000, cooldownMs: 28000, color: 0xff8038,
    description: 'Deploy a mine that damages the next rival who crosses it.',
  },
  SHIELD: {
    id: 'SHIELD', name: 'Aegis Ward', rarity: 'Rare', weight: 12,
    kind: 'ability', durationMs: 8000, cooldownMs: 26000, color: 0x39d9ff,
    description: 'Block one hit for 8 seconds.',
  },
};

export const KNIFE_RULES = {
  damage: 34,
  range: 3.4,
  facingDotMin: 0.5,
  cooldownMs: 650,
  simultaneousWindowMs: 70,
};

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
