export const MATCH_MODES = {
  ffa: {
    id: 'ffa',
    name: 'Free-for-All',
    description: 'Compete against every other survivor. Last alive or the final dragon attacker wins.',
    maxPlayers: 24,
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
    description: 'Cooperate against the dragon. Player combat is disabled; all living hunters share a dragon victory.',
    maxPlayers: 8,
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
    description: 'A quick free-for-all with a shared, repeatable map.',
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

  return {
    mode,
    durationSeconds,
    seed,
    challengeId: challenge?.id || null,
  };
}
