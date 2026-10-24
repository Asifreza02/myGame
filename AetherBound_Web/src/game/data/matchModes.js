export const MAX_MATCH_PLAYERS = 5;

export const PLAYER_SLOT_THEMES = [
  { index: 0, name: 'Aether Knight', color: '#00f0ff', colorHex: 0x00f0ff, badge: '⚔️' },
  { index: 1, name: 'Crimson Rogue', color: '#ff3366', colorHex: 0xff3366, badge: '🗡️' },
  { index: 2, name: 'Solar Vanguard', color: '#ffaa00', colorHex: 0xffaa00, badge: '🛡️' },
  { index: 3, name: 'Void Stalker', color: '#b344ff', colorHex: 0xb344ff, badge: '👁️' },
  { index: 4, name: 'Verdant Hunter', color: '#00ff88', colorHex: 0x00ff88, badge: '🏹' },
];

export const MATCH_MODES = {
  ffa: {
    id: 'ffa',
    name: 'Free-for-All',
    description: 'Compete against up to 5 contenders. Last survivor standing or the dragon slayer wins.',
    maxPlayers: 5,
    playerCombat: true,
    dragonRewardPolicy: 'final-blow',
  },
  solo: {
    id: 'solo',
    name: 'Solo Survival',
    description: 'Survive the world and the dragon until the match timer ends.',
    maxPlayers: 1,
    playerCombat: false,
    dragonRewardPolicy: 'final-blow',
  },
  'dragon-hunt': {
    id: 'dragon-hunt',
    name: 'Dragon Hunt',
    description: 'Cooperate against the dragon with up to 5 hunters. Player combat is disabled; all living hunters share a dragon victory.',
    maxPlayers: 5,
    playerCombat: false,
    dragonRewardPolicy: 'shared',
  },
};

export const MATCH_DURATIONS = [180, 300, 480, 600];

export const CURATED_CHALLENGES = [
  {
    id: 'emberfall',
    name: 'Emberfall',
    description: 'A long volcanic survival run.',
    mode: 'solo',
    durationSeconds: 480,
    seed: 731942,
  },
  {
    id: 'dragon-vanguard',
    name: 'Dragon Vanguard',
    description: 'A coordinated dragon hunt on a fixed world.',
    mode: 'dragon-hunt',
    durationSeconds: 300,
    seed: 248613,
  },
  {
    id: 'wildcard',
    name: 'Wildcard',
    description: 'A 5-player free-for-all on a shared, repeatable map.',
    mode: 'ffa',
    durationSeconds: 180,
    seed: 905177,
  },
];

export function normalizeMatchConfig(config = {}) {
  const mode = Object.hasOwn(MATCH_MODES, config.mode) ? config.mode : 'ffa';
  const requestedDuration = Number(config.durationSeconds);
  const durationSeconds = Number.isFinite(requestedDuration)
    ? Math.min(900, Math.max(60, Math.round(requestedDuration / 30) * 30))
    : 300;
  const requestedSeed = config.seed === null || config.seed === undefined || config.seed === ''
    ? null
    : Number(config.seed);
  const seed = Number.isSafeInteger(requestedSeed) && requestedSeed > 0 && requestedSeed <= 2_147_483_646
    ? requestedSeed
    : null;
  const challenge = CURATED_CHALLENGES.find((entry) => (
    entry.mode === mode
    && entry.durationSeconds === durationSeconds
    && entry.seed === seed
  ));
  const fillBots = config.fillBots !== false && config.fillBots !== 'false';

  return {
    mode,
    durationSeconds,
    seed,
    fillBots,
    maxPlayers: MATCH_MODES[mode]?.maxPlayers || MAX_MATCH_PLAYERS,
    challengeId: challenge?.id || null,
  };
}
