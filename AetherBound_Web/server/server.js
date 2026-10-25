import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { DRAGON_ATTACKS, getDragonPhase, ITEM_DEFINITIONS, KNIFE_RULES, WEAPON_DEFINITIONS, WEAPON_CRAFTING_RECIPES } from '../src/game/data/combat.js';
import { BIOME_RESOURCES, RESOURCE_DEFINITIONS, getWeatherState } from '../src/game/data/world.js';
import { MATCH_MODES, normalizeMatchConfig, PLAYER_SLOT_THEMES, MAX_MATCH_PLAYERS } from '../src/game/data/matchModes.js';
import { SimplexNoise, getBiomeWeights } from '../src/game/noise.js';
import { GAME_CONFIG } from '../src/game/config.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.GAME_SERVER_PORT || process.env.PORT || 3001;
const MAX_PLAYERS = MAX_MATCH_PLAYERS; // Maximum 5 players per game room
const SERVER_TICK_MS = 50;
const STATE_BROADCAST_MS = 100;
const RECONNECT_GRACE_MS = 30_000;
const DRAGON_REWARD_POLICY = process.env.DRAGON_REWARD_POLICY || 'final-blow';
const WORLD_RADIUS = GAME_CONFIG.WORLD.RADIUS;

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', maxPlayers: MAX_PLAYERS }));

const safeSend = (ws, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clampToWorld = (x, z) => {
  const radius = Math.hypot(x, z);
  const maxRadius = WORLD_RADIUS - 2;
  if (radius <= maxRadius) return { x, z };
  const scale = maxRadius / radius;
  return { x: x * scale, z: z * scale };
};

class GameRoom {
  constructor(id, requestedConfig = {}) {
    this.id = id;
    this.config = normalizeMatchConfig(requestedConfig);
    this.mode = MATCH_MODES[this.config.mode] || MATCH_MODES.ffa;
    this.maxPlayers = Math.min(MAX_PLAYERS, this.mode.maxPlayers || MAX_PLAYERS);
    this.seed = this.config.seed || Math.floor(Math.random() * 2_147_483_646) + 1;
    this.matchConfig = {
      ...this.config,
      seed: this.seed,
      maxPlayers: this.maxPlayers,
      modeName: this.mode.name,
      playerCombat: this.mode.playerCombat,
    };
    this.clients = new Map();
    this.players = new Map();
    this.state = 'LOBBY';
    this.worldNoise = new SimplexNoise(this.seed);
    this.dragon = { x: 42, y: 11, z: -34, health: 420, maxHealth: 420, alive: true, phase: 'PASSIVE', attack: null, nextAttackAt: 0, roamTarget: null, nextRoamTargetAt: 0 };
    this.items = this.createItems();
    this.hazards = [];
    this.interval = null;
    this.matchStartedAt = null;
    this.lastBroadcast = 0;
    this.pendingKnifeAttacks = [];
    this.knifeFlushTimer = null;
    this.dragonAttackSequence = 0;
    this.lastDragonAttackType = 'GROUND_SLAM';
    this.dragonRewardPolicy = this.mode.id === 'dragon-hunt'
      ? 'shared'
      : (DRAGON_REWARD_POLICY === 'shared' ? 'shared' : this.mode.dragonRewardPolicy);
    this.emptyRoomTimer = null;
    this.nextSpawnSlot = 0;
  }

  getTerrainHeight(x, z) {
    const dist = Math.hypot(x, z);
    if (dist < 28) return 0.8;
    const nx = x * 0.012;
    const nz = z * 0.012;
    const weights = getBiomeWeights(this.worldNoise, x, z);
    const baseH = this.worldNoise.noise2D(nx, nz) * 0.75 + this.worldNoise.noise2D(nx * 2.2, nz * 2.2) * 0.25;
    const mult = weights.lush * 1.8 + weights.desert * 2.5 + weights.snow * 2.9 + weights.volcanic * 2.2;
    return baseH * mult + 0.8;
  }

  getNextAvailableSlot() {
    const usedSlots = new Set([...this.players.values()].map((p) => p.slot));
    for (let slot = 0; slot < this.maxPlayers; slot += 1) {
      if (!usedSlots.has(slot)) return slot;
    }
    return this.players.size % this.maxPlayers;
  }

  addClient(ws, reconnectToken, requestedName = null) {
    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
      this.emptyRoomTimer = null;
    }
    const returningPlayer = reconnectToken
      ? [...this.players.values()].find((candidate) => candidate.reconnectToken === reconnectToken)
      : null;
    if (returningPlayer && (returningPlayer.connected || returningPlayer.reconnectExpiresAt > Date.now())) {
      const previousSocket = [...this.clients].find(([, playerId]) => playerId === returningPlayer.id)?.[0];
      if (previousSocket) {
        this.clients.delete(previousSocket);
        previousSocket.close(4001, 'Player session resumed in another connection');
      }
      if (returningPlayer.reconnectTimer) clearTimeout(returningPlayer.reconnectTimer);
      returningPlayer.reconnectTimer = null;
      returningPlayer.connected = true;
      returningPlayer.reconnectExpiresAt = 0;
      returningPlayer.lastMoveAt = 0;
      if (requestedName) returningPlayer.name = requestedName;
      this.clients.set(ws, returningPlayer.id);
      safeSend(ws, {
        type: 'INIT_STATE',
        playerId: returningPlayer.id,
        reconnectToken: returningPlayer.reconnectToken,
        resumed: true,
        room: this.id,
        seed: this.seed,
        matchConfig: this.matchConfig,
        state: this.state,
        snapshot: this.snapshot(),
      });
      this.broadcast({ type: 'PLAYER_RECONNECTED', player: this.publicPlayer(returningPlayer) }, ws);
      this.broadcastState();
      return;
    }

    // Room full check: if at capacity, see if any bot can make way for human player
    if (this.players.size >= this.maxPlayers) {
      const botToReplace = [...this.players.values()].find((p) => p.isBot);
      if (botToReplace) {
        this.players.delete(botToReplace.id);
        this.broadcast({ type: 'PLAYER_DISCONNECTED', playerId: botToReplace.id });
      } else {
        safeSend(ws, { type: 'ROOM_FULL', maxPlayers: this.maxPlayers });
        ws.close(1008, 'Room full');
        return;
      }
    }

    const id = `player-${Math.random().toString(36).slice(2, 9)}`;
    const slot = this.getNextAvailableSlot();
    const theme = PLAYER_SLOT_THEMES[slot % PLAYER_SLOT_THEMES.length];
    const spawnAngle = (slot / this.maxPlayers) * Math.PI * 2 + (this.seed % 10) * 0.1;
    const spawnRadius = 22 + (slot % 2) * 5;
    const spawnX = Math.round(Math.cos(spawnAngle) * spawnRadius);
    const spawnZ = Math.round(Math.sin(spawnAngle) * spawnRadius);
    const spawnY = this.getTerrainHeight(spawnX, spawnZ) + 1.0;
    const token = reconnectToken || randomUUID();
    const playerName = requestedName || theme.name;

    const player = {
      id,
      name: playerName,
      slot,
      color: theme.color,
      colorHex: theme.colorHex,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      ry: spawnAngle + Math.PI,
      pitch: 0,
      health: 100,
      maxHealth: 100,
      alive: true,
      connected: true,
      isBot: false,
      inventory: [],
      joinedAt: Date.now(),
      lastMoveAt: 0,
      lastAttackAt: 0,
      lastAttackId: 0,
      abilityReadyAt: {},
      activeAbilities: {},
      shieldUntil: 0,
      reconnectToken: token,
      reconnectExpiresAt: 0,
      reconnectTimer: null,
      resources: {},
      weapons: ['KNIFE'],
      equippedWeapon: 'KNIFE',
      ammo: { PISTOL: 0, GUN: 0, LASER_GUN: 0, PLASMA_CANNON: 0 },
      lastWeaponFireAt: 0,
      stats: { kills: 0, survivalTime: 0, itemsCollected: 0, damageDealt: 0, dragonDamage: 0 },
      lastSurvivalTickAt: Date.now(),
      nextWorldDamageAt: 0,
      inVolcanicZone: false,
      voice: { isSpeaking: false, isMuted: false, isDeafened: false },
    };

    this.clients.set(ws, id);
    this.players.set(id, player);

    if (this.players.size >= 1 && this.state === 'LOBBY') {
      this.start();
    }

    safeSend(ws, {
      type: 'INIT_STATE',
      playerId: id,
      reconnectToken: token,
      resumed: false,
      room: this.id,
      seed: this.seed,
      matchConfig: this.matchConfig,
      state: this.state,
      snapshot: this.snapshot(),
    });
    this.broadcast({ type: 'PLAYER_JOINED', player: this.publicPlayer(player) });
    this.broadcastState();
  }

  spawnBot(slot) {
    const theme = PLAYER_SLOT_THEMES[slot % PLAYER_SLOT_THEMES.length];
    const spawnAngle = (slot / this.maxPlayers) * Math.PI * 2 + (this.seed % 10) * 0.1;
    const spawnRadius = 22 + (slot % 2) * 5;
    const spawnX = Math.round(Math.cos(spawnAngle) * spawnRadius);
    const spawnZ = Math.round(Math.sin(spawnAngle) * spawnRadius);
    const spawnY = this.getTerrainHeight(spawnX, spawnZ) + 1.0;
    const id = `bot-${slot}-${Math.random().toString(36).slice(2, 7)}`;

    const bot = {
      id,
      name: `${theme.name} (Bot)`,
      slot,
      color: theme.color,
      colorHex: theme.colorHex,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      ry: spawnAngle + Math.PI,
      pitch: 0,
      health: 100,
      maxHealth: 100,
      alive: true,
      connected: true,
      isBot: true,
      inventory: [],
      joinedAt: Date.now(),
      lastMoveAt: Date.now(),
      lastAttackAt: 0,
      lastAttackId: 0,
      abilityReadyAt: {},
      activeAbilities: {},
      shieldUntil: 0,
      reconnectToken: null,
      reconnectExpiresAt: 0,
      reconnectTimer: null,
      resources: {},
      weapons: ['KNIFE'],
      equippedWeapon: 'KNIFE',
      ammo: { PISTOL: 0, GUN: 0, LASER_GUN: 0, PLASMA_CANNON: 0 },
      lastWeaponFireAt: 0,
      stats: { kills: 0, survivalTime: 0, itemsCollected: 0, damageDealt: 0, dragonDamage: 0 },
      lastSurvivalTickAt: Date.now(),
      nextWorldDamageAt: 0,
      inVolcanicZone: false,
      wanderTarget: { x: spawnX + (Math.random() - 0.5) * 24, z: spawnZ + (Math.random() - 0.5) * 24 },
      wanderTimer: 2.0 + Math.random() * 2.0,
      combatTargetId: null,
    };
    this.players.set(id, bot);
    return bot;
  }

  createItems() {
    let randomState = (this.seed >>> 0) || 1;
    const random = () => {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 0x100000000;
    };
    const abilities = Object.values(ITEM_DEFINITIONS);
    const totalWeight = abilities.reduce((sum, item) => sum + item.weight, 0);
    const createAbilityDrop = (index, x, z, rarity = null, preferredType = null) => {
      let pick = random() * totalWeight;
      const definition = abilities.find((item) => (pick -= item.weight) <= 0) || abilities[0];
      const type = preferredType || definition.id;
      return {
        id: `loot-${index}-${Math.floor(random() * 1_000_000).toString(36)}`,
        type,
        kind: 'ability',
        biome: this.getBiomeAt(x, z),
        rarity: rarity || ITEM_DEFINITIONS[type].rarity,
        x,
        z,
        active: true,
      };
    };
    const createResourceDrop = (index, x, z, biome, forcedType = null) => {
      const pool = BIOME_RESOURCES[biome] || BIOME_RESOURCES.lush;
      const type = forcedType || pool[Math.floor(random() * pool.length)];
      return {
        id: `loot-${index}-${Math.floor(random() * 1_000_000).toString(36)}`,
        type,
        kind: 'resource',
        biome,
        rarity: RESOURCE_DEFINITIONS[type]?.rarity || 'Common',
        x,
        z,
        active: true,
      };
    };
    const items = [];

    // 1. Structural Caches: Dedicated Loot Stations, Houses & Outposts
    const bGrid = GAME_CONFIG.WORLD.BUILDING_GRID_SIZE || 110;
    const maxB = Math.floor((WORLD_RADIUS - 35) / bGrid);
    for (let bx = -maxB; bx <= maxB; bx++) {
      for (let bz = -maxB; bz <= maxB; bz++) {
        const originX = bx * bGrid;
        const originZ = bz * bGrid;
        const cellDist = Math.hypot(originX, originZ);
        if (cellDist > WORLD_RADIUS - 35 || cellDist < 35) continue;

        let bSeed = Math.abs(bx * 389271 ^ bz * 728931 ^ this.seed);
        const rng = () => {
          bSeed = (bSeed * 16807) % 2147483647;
          return (bSeed - 1) / 2147483646;
        };

        const wx = Math.round(originX + (rng() - 0.5) * (bGrid * 0.6));
        const wz = Math.round(originZ + (rng() - 0.5) * (bGrid * 0.6));
        const archetype = Math.floor(rng() * 6);
        const biome = this.getBiomeAt(wx, wz);

        if (archetype === 5) {
          // Aether Loot Station: Guaranteed High-Tier Cache!
          items.push(createAbilityDrop(items.length, wx, wz, 'Rare'));
          items.push({
            id: `loot-${items.length}-${Math.floor(random() * 1_000_000).toString(36)}`,
            type: 'CHEST',
            kind: 'cache',
            biome,
            rarity: 'Rare',
            x: wx + 1,
            z: wz + 1,
            active: true,
          });
          items.push(createResourceDrop(items.length, wx + 2, wz + 1, biome, 'ENERGY_CELL'));
          items.push(createResourceDrop(items.length, wx - 2, wz - 1, biome, 'TITANIUM_SCRAP'));
        } else if (archetype === 3 || archetype === 4) {
          // Colony Habitation House / Frontier Duplex: Porch Cache
          items.push(createAbilityDrop(items.length, wx, wz + 2));
          items.push(createResourceDrop(items.length, wx - 1, wz + 2, biome));
        } else if (archetype === 0 || archetype === 2) {
          // Command Outpost / Military Depot: Combat Supplies
          items.push({
            id: `loot-${items.length}-${Math.floor(random() * 1_000_000).toString(36)}`,
            type: rng() > 0.5 ? 'KINETIC_AMMO' : 'ENERGY_AMMO',
            kind: 'ammo',
            biome,
            rarity: 'Common',
            x: wx,
            z: wz + 2,
            active: true,
          });
          items.push(createResourceDrop(items.length, wx + 2, wz, biome, 'TITANIUM_SCRAP'));
          items.push(createResourceDrop(items.length, wx - 2, wz, biome, 'EMBER_ORE'));
        }
      }
    }

    // 2. Wilderness Abilities across the entire 1km radius (48 drops)
    for (let i = 0; i < 48; i += 1) {
      const angle = i * 2.399 + (random() - 0.5) * 0.3;
      const radius = 28 + (i / 48) * (WORLD_RADIUS - 80) + random() * 20;
      const x = Math.round(Math.cos(angle) * radius);
      const z = Math.round(Math.sin(angle) * radius);
      items.push(createAbilityDrop(items.length, x, z));
    }

    // 3. Wilderness Crafting Resources across the entire 1km radius (128 drops)
    const allResourceTypes = Object.keys(RESOURCE_DEFINITIONS);
    for (let i = 0; i < 128; i += 1) {
      const angle = i * 1.618 + (random() - 0.5) * 0.32;
      const radius = 24 + (i / 128) * (WORLD_RADIUS - 70) + random() * 24;
      const x = Math.round(Math.cos(angle) * radius);
      const z = Math.round(Math.sin(angle) * radius);
      const biome = this.getBiomeAt(x, z);
      const forcedType = allResourceTypes[i % allResourceTypes.length];
      items.push(createResourceDrop(items.length, x, z, biome, forcedType));
    }

    // 4. Dragon territory resource caches
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2 + random() * 0.5;
      const radius = 16 + (index % 3) * 12 + random() * 8;
      const x = Math.round(this.dragon.x + Math.cos(angle) * radius);
      const z = Math.round(this.dragon.z + Math.sin(angle) * radius);
      items.push(createResourceDrop(items.length, x, z, 'volcanic', 'ENERGY_CELL'));
    }

    return items;
  }

  getBiomeAt(x, z) {
    const weights = getBiomeWeights(this.worldNoise, x, z);
    return Object.keys(weights).reduce((best, biome) => weights[biome] > weights[best] ? biome : best, 'lush');
  }

  publicPlayer(player) {
    const { id, name, slot, color, colorHex, isBot, x, y, z, ry, pitch, health, maxHealth, alive, connected, inventory, abilityReadyAt, activeAbilities, resources, weapons, equippedWeapon, ammo } = player;
    const stats = {
      ...player.stats,
      survivalTime: Math.floor(player.stats.survivalTime),
    };
    return {
      id, name, slot, color, colorHex, isBot: Boolean(isBot), x, y, z, ry, pitch: pitch || 0, health, maxHealth, alive, connected,
      inventory, abilityReadyAt, activeAbilities, resources,
      weapons: weapons || ['KNIFE'],
      equippedWeapon: equippedWeapon || 'KNIFE',
      ammo: ammo || {},
      stats,
      voice: player.voice || { isSpeaking: false, isMuted: false, isDeafened: false },
    };
  }

  snapshot() {
    return {
      room: this.id,
      state: this.state,
      matchConfig: this.matchConfig,
      players: [...this.players.values()].map((player) => this.publicPlayer(player)),
      items: this.items.map((item) => ({ ...item })),
      hazards: this.hazards.map((hazard) => ({ ...hazard })),
      dragon: { ...this.dragon },
      dragonRewardPolicy: this.dragonRewardPolicy,
      weather: getWeatherState(this.matchStartedAt ? (Date.now() - this.matchStartedAt) / 1000 : 0),
    };
  }

  start() {
    this.state = 'ACTIVE';
    this.matchStartedAt = Date.now();
    this.dragon.nextAttackAt = this.matchStartedAt + 18_000;
    this.dragon.roamTarget = this.pickDragonRoamTarget();
    this.dragon.nextRoamTargetAt = this.matchStartedAt + 30_000;

    // Auto-fill bots to complete the 5-player roster if enabled
    if (this.config.fillBots !== false && this.mode.id !== 'solo') {
      while (this.players.size < this.maxPlayers) {
        const slot = this.getNextAvailableSlot();
        this.spawnBot(slot);
      }
    }

    this.interval = setInterval(() => {
      if (this.state !== 'ACTIVE') return;
      const now = Date.now();
      this.updateSurvivalTime(now);
      this.updateBots(now, SERVER_TICK_MS / 1000);
      this.updateDragon(now, SERVER_TICK_MS / 1000);
      this.hazards = this.hazards.filter((hazard) => !hazard.triggered && hazard.expiresAt > now);
      this.broadcastState();
    }, SERVER_TICK_MS);

    this.broadcast({ type: 'MATCH_STARTED', seed: this.seed, matchConfig: this.matchConfig });
  }

  pickDragonRoamTarget() {
    const angle = Math.random() * Math.PI * 2;
    const radius = 150 + Math.random() * (WORLD_RADIUS - 250);
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  }

  updateSurvivalTime(now) {
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      const elapsed = Math.max(0, Math.min(now - player.lastSurvivalTickAt, 250));
      player.stats.survivalTime += elapsed / 1000;
      player.lastSurvivalTickAt = now;
    }
  }

  updateBots(now, dt) {
    if (this.state !== 'ACTIVE') return;
    const livingPlayers = [...this.players.values()].filter((p) => p.alive);

    for (const bot of this.players.values()) {
      if (!bot.isBot || !bot.alive) continue;

      // Clean active abilities
      bot.activeAbilities = Object.fromEntries(
        Object.entries(bot.activeAbilities).filter(([, endsAt]) => endsAt > now)
      );

      // Check volcanic ground hazard
      const weights = getBiomeWeights(this.worldNoise, bot.x, bot.z);
      const isVolcanic = weights.volcanic >= 0.4;
      if (isVolcanic && now >= bot.nextWorldDamageAt) {
        bot.health = Math.max(0, bot.health - 8);
        bot.nextWorldDamageAt = now + 2200;
        this.broadcast({ type: 'PLAYER_DAMAGED', playerId: bot.id, attackerId: 'world', health: bot.health, damage: 8, source: 'volcanic-ground' });
        if (bot.health <= 0) {
          this.eliminate(bot, 'The volcanic ground took a contender.', 'world');
          continue;
        }
      }

      // Check deployable hazards
      for (const hazard of this.hazards) {
        if (!bot.alive) break;
        if (hazard.ownerId === bot.id || hazard.triggered || distance(bot, hazard) > 2.2) continue;
        hazard.triggered = true;
        const absorbed = bot.shieldUntil > now;
        if (absorbed) bot.shieldUntil = 0;
        const damage = absorbed ? 0 : Math.min(25, bot.health);
        if (!absorbed) bot.health = Math.max(0, bot.health - damage);
        if (!absorbed) {
          const owner = this.players.get(hazard.ownerId);
          if (owner) owner.stats.damageDealt += damage;
        }
        this.broadcast({ type: 'PLAYER_DAMAGED', playerId: bot.id, attackerId: hazard.ownerId, health: bot.health, damage, source: 'hazard' });
        if (bot.health <= 0) {
          const owner = this.players.get(hazard.ownerId);
          if (owner && !absorbed) owner.stats.kills += 1;
          this.eliminate(bot, 'Eliminated by a deployable hazard.', hazard.ownerId);
        }
      }
      if (!bot.alive) continue;

      // 1. Identify Closest Living Rival Opponent
      const opponents = livingPlayers.filter((p) => p.id !== bot.id);
      let closestOpponent = null;
      let closestOpponentDist = Infinity;
      for (const opp of opponents) {
        const d = distance(bot, opp);
        if (d < closestOpponentDist) {
          closestOpponentDist = d;
          closestOpponent = opp;
        }
      }

      // 2. Identify Nearest Active Loot Item
      let nearestItem = null;
      let nearestItemDist = Infinity;
      for (const item of this.items) {
        if (!item.active) continue;
        const d = distance(bot, item);
        if (d < nearestItemDist && d < 28) {
          nearestItemDist = d;
          nearestItem = item;
        }
      }

      // 3. Dragon Danger Check: evade if dragon is telegraphing an attack near bot
      let evadeVector = null;
      if (this.dragon.alive && this.dragon.attack) {
        const dTarget = this.dragon.attack.target;
        if (dTarget && distance(bot, dTarget) < (this.dragon.attack.radius || 10) + 4) {
          const dToDragon = Math.max(0.1, distance(bot, dTarget));
          evadeVector = { x: (bot.x - dTarget.x) / dToDragon, z: (bot.z - dTarget.z) / dToDragon };
        }
      }

      let moveX = 0;
      let moveZ = 0;
      let speed = 12.0;

      if (evadeVector) {
        moveX = evadeVector.x;
        moveZ = evadeVector.z;
        speed = 18.0;
      } else if (closestOpponent && closestOpponentDist <= 38 && (this.mode.playerCombat || bot.health < 40)) {
        // Combat chase / shootout
        const dx = closestOpponent.x - bot.x;
        const dz = closestOpponent.z - bot.z;
        const dist = Math.max(0.001, closestOpponentDist);
        bot.ry = Math.atan2(dx, dz);

        const currentWeapon = bot.equippedWeapon || 'KNIFE';
        const weaponDef = WEAPON_DEFINITIONS[currentWeapon] || WEAPON_DEFINITIONS.KNIFE;
        const hasRangedAmmo = weaponDef.type !== 'melee' && (bot.ammo[currentWeapon] || 0) > 0;

        if (hasRangedAmmo && closestOpponentDist <= weaponDef.range) {
          // Ranged shootout
          const oppDy = (closestOpponent.y + 1.0) - (bot.y + 1.2);
          const opp3dDist = Math.hypot(dx, oppDy, dz) || 1;
          bot.pitch = Math.asin(oppDy / opp3dDist);

          if (now - (bot.lastWeaponFireAt || 0) >= weaponDef.cooldownMs + 220) {
            this.fireWeapon(null, bot, {
              origin: { x: bot.x, y: bot.y + 1.2, z: bot.z },
              direction: { x: dx / opp3dDist, y: oppDy / opp3dDist, z: dz / opp3dDist },
            });
          }
          if (closestOpponentDist > 7.0) {
            moveX = dx / dist;
            moveZ = dz / dist;
            speed = 9.0;
          }
        } else if (closestOpponentDist > 2.2) {
          moveX = dx / dist;
          moveZ = dz / dist;
          speed = closestOpponentDist > 14 ? 17.0 : 13.0;
        } else {
          // Melee range
          if (now - bot.lastAttackAt >= KNIFE_RULES.cooldownMs + 180) {
            bot.lastAttackId = (bot.lastAttackId || 0) + 1;
            this.queueKnifeAttack(null, bot, { attackId: bot.lastAttackId });
          }
        }
      } else if (this.dragon.alive && distance(bot, this.dragon) < 34) {
        // Shoot at dragon if in range
        const dx = this.dragon.x - bot.x;
        const dy = (this.dragon.y + 2.0) - (bot.y + 1.2);
        const dz = this.dragon.z - bot.z;
        const dragon3dDist = Math.hypot(dx, dy, dz) || 1;
        bot.ry = Math.atan2(dx, dz);
        bot.pitch = Math.asin(dy / dragon3dDist);

        const currentWeapon = bot.equippedWeapon || 'KNIFE';
        const weaponDef = WEAPON_DEFINITIONS[currentWeapon] || WEAPON_DEFINITIONS.KNIFE;
        if (weaponDef.type !== 'melee' && (bot.ammo[currentWeapon] || 0) > 0) {
          if (now - (bot.lastWeaponFireAt || 0) >= weaponDef.cooldownMs + 250) {
            this.fireWeapon(null, bot, {
              origin: { x: bot.x, y: bot.y + 1.2, z: bot.z },
              direction: { x: dx / dragon3dDist, y: dy / dragon3dDist, z: dz / dragon3dDist },
            });
          }
        }
      } else if (nearestItem && nearestItemDist < 25) {
        // Move towards item
        const dx = nearestItem.x - bot.x;
        const dz = nearestItem.z - bot.z;
        const dist = Math.max(0.001, nearestItemDist);
        bot.ry = Math.atan2(dx, dz);
        if (nearestItemDist > 1.8) {
          moveX = dx / dist;
          moveZ = dz / dist;
          speed = 13.0;
        } else {
          this.handleItemPickup(bot, nearestItem);
        }
      } else {
        // Wander around map
        bot.wanderTimer = (bot.wanderTimer || 0) - dt;
        if (bot.wanderTimer <= 0) {
          bot.wanderTimer = 3.5 + Math.random() * 3.0;
          const wanderAngle = Math.random() * Math.PI * 2;
          const wanderRadius = 10 + Math.random() * 25;
          bot.wanderTarget = {
            x: Math.cos(wanderAngle) * wanderRadius,
            z: Math.sin(wanderAngle) * wanderRadius,
          };
        }
        const dx = bot.wanderTarget.x - bot.x;
        const dz = bot.wanderTarget.z - bot.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 2.0) {
          moveX = dx / dist;
          moveZ = dz / dist;
          bot.ry = Math.atan2(dx, dz);
          speed = 9.5;
        }
      }

      if (moveX !== 0 || moveZ !== 0) {
        const step = speed * dt;
        bot.x += moveX * step;
        bot.z += moveZ * step;
      }
      const boundedPosition = clampToWorld(bot.x, bot.z);
      bot.x = boundedPosition.x;
      bot.z = boundedPosition.z;
      bot.y = this.getTerrainHeight(bot.x, bot.z) + 1.0;

      // Abilities
      if (bot.inventory.includes('SHIELD') && bot.health < 60 && !bot.shieldUntil) {
        this.handleBotUseAbility(bot, 'SHIELD');
      } else if (bot.inventory.includes('SPEED') && closestOpponentDist > 15 && closestOpponentDist < 35) {
        this.handleBotUseAbility(bot, 'SPEED');
      }
    }
  }

  checkBotCrafting(bot) {
    if (!bot || !bot.alive) return;
    for (let index = 0; index < WEAPON_CRAFTING_RECIPES.length; index += 1) {
      const recipe = WEAPON_CRAFTING_RECIPES[index];
      let canCraft = true;
      for (const [res, count] of Object.entries(recipe.ingredients)) {
        if ((bot.resources[res] || 0) < count) {
          canCraft = false;
          break;
        }
      }
      if (canCraft) {
        this.craftWeapon(bot, index);
        break;
      }
    }
  }

  handleItemPickup(player, item) {
    if (!item.active) return;
    item.active = false;
    const definition = ITEM_DEFINITIONS[item.type];
    if (item.kind === 'resource') {
      player.resources[item.type] = (player.resources[item.type] || 0) + 1;
    } else if (item.type === 'HEALTH') {
      player.health = Math.min(player.maxHealth, player.health + (definition?.heal || 35));
    } else if (item.type === 'KINETIC_AMMO') {
      player.ammo = player.ammo || {};
      player.ammo.PISTOL = Math.min(16, (player.ammo.PISTOL || 0) + 16);
      player.ammo.GUN = Math.min(30, (player.ammo.GUN || 0) + 20);
    } else if (item.type === 'ENERGY_AMMO') {
      player.ammo = player.ammo || {};
      player.ammo.LASER_GUN = Math.min(15, (player.ammo.LASER_GUN || 0) + 12);
      player.ammo.PLASMA_CANNON = Math.min(8, (player.ammo.PLASMA_CANNON || 0) + 6);
    } else if (item.type === 'CHEST') {
      player.resources.ENERGY_CELL = (player.resources.ENERGY_CELL || 0) + 2;
      player.resources.TITANIUM_SCRAP = (player.resources.TITANIUM_SCRAP || 0) + 2;
      player.resources.AETHER_ESSENCE = (player.resources.AETHER_ESSENCE || 0) + 2;
    } else {
      player.inventory = [...new Set([...player.inventory, item.type])];
    }
    player.stats.itemsCollected += 1;
    this.broadcast({
      type: 'ITEM_COLLECTED',
      id: item.id,
      itemType: item.type,
      kind: item.kind,
      biome: item.biome,
      rarity: item.rarity,
      playerId: player.id,
      health: player.health,
      ammo: player.ammo,
      inventory: player.inventory,
      resources: player.resources,
    });

    if (player.isBot) {
      this.checkBotCrafting(player);
    }

    setTimeout(() => {
      if (this.state === 'ACTIVE') {
        item.active = true;
        this.broadcast({ type: 'ITEM_SPAWNED', item });
      }
    }, 35000);
  }

  handleBotUseAbility(bot, ability) {
    const definition = ITEM_DEFINITIONS[ability];
    const now = Date.now();
    const readyAt = bot.abilityReadyAt[ability] || 0;
    if (!definition || now < readyAt || !bot.inventory.includes(ability)) return;
    bot.abilityReadyAt[ability] = now + definition.cooldownMs;
    bot.activeAbilities[ability] = now + definition.durationMs;
    if (ability === 'SHIELD') bot.shieldUntil = now + definition.durationMs;
    this.broadcast({
      type: 'ABILITY_USED',
      playerId: bot.id,
      ability,
      duration: definition.durationMs,
      cooldownMs: definition.cooldownMs,
      readyAt: bot.abilityReadyAt[ability],
    });
  }

  broadcast(message, except = null) {
    for (const [socket] of this.clients) if (socket !== except) safeSend(socket, message);
  }

  broadcastState() {
    const now = Date.now();
    if (now - this.lastBroadcast < STATE_BROADCAST_MS) return;
    this.lastBroadcast = now;
    this.broadcast({ type: 'MATCH_STATE', snapshot: this.snapshot() });
  }

  finish(winnerId, reason, kind = 'survival') {
    if (this.state !== 'ACTIVE') return;
    this.state = 'RESULTS';
    clearInterval(this.interval);
    this.interval = null;
    if (this.knifeFlushTimer) clearTimeout(this.knifeFlushTimer);
    this.knifeFlushTimer = null;
    this.pendingKnifeAttacks = [];
    this.broadcast({ type: 'MATCH_RESULTS', winnerId, reason, kind, dragonRewardPolicy: this.dragonRewardPolicy, snapshot: this.snapshot() });
  }

  updateDragon(now, tickSeconds) {
    if (!this.dragon.alive) return;
    const elapsedSeconds = (now - this.matchStartedAt) / 1000;
    const profile = getDragonPhase(elapsedSeconds);
    if (profile.id !== this.dragon.phase) {
      this.dragon.phase = profile.id;
      this.broadcast({ type: 'DRAGON_PHASE_CHANGED', phase: profile.id });
    }

    const alivePlayers = [...this.players.values()].filter((player) => player.alive && player.connected);
    let target = alivePlayers.sort((a, b) => distance(a, this.dragon) - distance(b, this.dragon))[0];
    if (target && distance(target, this.dragon) > profile.aggroRange) target = null;
    if (this.dragon.attack) {
      if (now >= this.dragon.attack.impactAt) this.resolveDragonAttack(now);
      return;
    }

    if (target && profile.id !== 'PASSIVE') {
      const orbitAngle = elapsedSeconds * (profile.id === 'PHASE_3' ? 0.68 : 0.46);
      const orbitRadius = 2.6;
      const orbitX = target.x + Math.cos(orbitAngle) * orbitRadius;
      const orbitZ = target.z + Math.sin(orbitAngle) * orbitRadius;
      const moveX = orbitX - this.dragon.x;
      const moveZ = orbitZ - this.dragon.z;
      const moveDistance = Math.hypot(moveX, moveZ);
      if (moveDistance > 0.5) {
        const step = Math.min(moveDistance, profile.speed * tickSeconds);
        this.dragon.x += (moveX / moveDistance) * step;
        this.dragon.z += (moveZ / moveDistance) * step;
      }
      this.dragon.ry = Math.atan2(target.x - this.dragon.x, target.z - this.dragon.z);
    } else {
      if (!this.dragon.roamTarget || now >= this.dragon.nextRoamTargetAt
        || distance(this.dragon, this.dragon.roamTarget) < 12) {
        this.dragon.roamTarget = this.pickDragonRoamTarget();
        this.dragon.nextRoamTargetAt = now + 30_000;
      }
      const dx = this.dragon.roamTarget.x - this.dragon.x;
      const dz = this.dragon.roamTarget.z - this.dragon.z;
      const roamDistance = Math.hypot(dx, dz);
      if (roamDistance > 0.5) {
        const step = Math.min(roamDistance, profile.speed * tickSeconds);
        this.dragon.x += (dx / roamDistance) * step;
        this.dragon.z += (dz / roamDistance) * step;
        this.dragon.ry = Math.atan2(dx, dz);
      }
    }
    const boundedPosition = clampToWorld(this.dragon.x, this.dragon.z);
    this.dragon.x = boundedPosition.x;
    this.dragon.z = boundedPosition.z;

    if (!target || now < this.dragon.nextAttackAt) return;
    const attack = this.nextDragonAttack(profile);
    const targetDistance = distance(target, this.dragon);
    if (targetDistance > attack.range) {
      this.dragon.nextAttackAt = now + 800;
      return;
    }
    this.dragonAttackSequence += 1;
    this.dragon.attack = {
      id: `dragon-attack-${this.dragonAttackSequence}`,
      type: attack.id,
      name: attack.name,
      startedAt: now,
      impactAt: now + attack.telegraphMs,
      targetId: target.id,
      target: attack.id === 'GROUND_SLAM'
        ? { x: this.dragon.x, z: this.dragon.z }
        : { x: target.x, z: target.z },
      origin: { x: this.dragon.x, z: this.dragon.z },
      direction: {
        x: targetDistance > 0 ? (target.x - this.dragon.x) / targetDistance : 0,
        z: targetDistance > 0 ? (target.z - this.dragon.z) / targetDistance : 1,
      },
      radius: attack.radius,
      range: attack.range,
      facingDotMin: attack.facingDotMin,
      color: attack.color,
      damage: attack.damage,
      cooldownMs: attack.cooldownMs,
    };
    this.broadcast({ type: 'DRAGON_ATTACK_TELEGRAPH', attack: this.dragon.attack });
  }

  nextDragonAttack(profile) {
    const options = Object.values(DRAGON_ATTACKS);
    const next = options.find((attack) => attack.id !== this.lastDragonAttackType) || options[0];
    this.lastDragonAttackType = next.id;
    return {
      ...next,
      telegraphMs: Math.max(600, next.telegraphMs * profile.telegraphMultiplier),
      cooldownMs: Math.max(1_200, next.cooldownMs * profile.cooldownMultiplier),
      damage: Math.max(1, Math.round(next.damage * profile.damageMultiplier)),
      range: next.range * profile.rangeMultiplier,
      radius: next.radius ? next.radius * profile.rangeMultiplier : undefined,
    };
  }

  resolveDragonAttack(now) {
    const attack = this.dragon.attack;
    if (!attack || this.state !== 'ACTIVE' || !this.dragon.alive) return;
    this.dragon.attack = null;
    const impacted = [];
    for (const player of this.players.values()) {
      if (!player.alive || !player.connected) continue;
      if (attack.type === 'FIRE_BREATH') {
        const dx = player.x - attack.origin.x;
        const dz = player.z - attack.origin.z;
        const range = Math.hypot(dx, dz);
        const facing = range > 0
          ? (attack.direction.x * dx + attack.direction.z * dz) / range
          : -1;
        if (range > attack.range || facing < attack.facingDotMin) continue;
      } else if (distance(player, attack.target) > attack.radius) {
        continue;
      }
      const absorbed = player.shieldUntil > now;
      if (absorbed) player.shieldUntil = 0;
      else player.health = Math.max(0, player.health - attack.damage);
      impacted.push({ player, damage: absorbed ? 0 : attack.damage });
    }
    this.dragon.nextAttackAt = now + attack.cooldownMs;
    this.broadcast({
      type: 'DRAGON_ATTACK_RESOLVED', attackId: attack.id, attackType: attack.type,
      impacted: impacted.map(({ player, damage }) => ({ playerId: player.id, health: player.health, damage })),
    });
    for (const { player, damage } of impacted) {
      if (damage > 0) this.broadcast({ type: 'PLAYER_DAMAGED', playerId: player.id, attackerId: 'dragon', health: player.health, damage, source: attack.type });
    }
    for (const { player } of impacted) {
      if (player.health <= 0 && player.alive) {
        player.alive = false;
        this.broadcast({ type: 'PLAYER_ELIMINATED', playerId: player.id, attackerId: 'dragon', reason: 'The dragon struck you down.', player: this.publicPlayer(player) });
      }
    }
    this.checkLastPlayer();
  }

  defeatDragon(killerId) {
    if (this.state !== 'ACTIVE' || !this.dragon.alive) return false;
    this.dragon.alive = false;
    this.dragon.phase = 'DEFEATED';
    this.dragon.attack = null;
    const winners = this.dragonRewardPolicy === 'shared'
      ? [...this.players.values()].filter((player) => player.alive).map((player) => player.id)
      : [killerId];
    this.finish(this.dragonRewardPolicy === 'shared' ? winners : killerId, 'The dragon has been defeated.', 'dragon');
    return true;
  }

  checkLastPlayer() {
    const alive = [...this.players.values()].filter((player) => player.alive);
    if (this.config.mode === 'solo' && this.state === 'ACTIVE' && alive.length === 0) {
      this.finish('none', 'You were eliminated.', 'survival');
      return;
    }
    if (this.config.mode === 'dragon-hunt' && this.state === 'ACTIVE' && alive.length === 0) {
      this.finish('none', 'The hunting party was eliminated.', 'survival');
      return;
    }
    if (!this.mode.playerCombat) return;
    const hasHadOpponent = this.players.size > 1;
    if (this.state === 'ACTIVE' && hasHadOpponent && alive.length === 1) {
      const winner = alive[0];
      const winReason = winner.isBot
        ? `${winner.name} won the 5-player free-for-all as the last survivor.`
        : `${winner.name} is the last survivor standing! Victory in the 5-player battle!`;
      this.finish(winner.id, winReason);
    } else if (this.state === 'ACTIVE' && hasHadOpponent && alive.length === 0) {
      this.finish('draw', 'All competitors were eliminated.');
    }
  }

  eliminate(player, reason, attackerId = null) {
    if (!player?.alive || this.state !== 'ACTIVE') return;
    player.alive = false;
    player.health = 0;
    const remainingAlive = [...this.players.values()].filter((p) => p.alive).length;
    this.broadcast({
      type: 'PLAYER_ELIMINATED',
      playerId: player.id,
      attackerId,
      reason,
      remainingAlive,
      player: this.publicPlayer(player),
    });
    this.checkLastPlayer();
  }

  queueKnifeAttack(ws, attacker, message) {
    if (this.state !== 'ACTIVE' || !attacker.alive) return;
    const now = Date.now();
    const attackId = Number(message.attackId);
    if (!Number.isSafeInteger(attackId) || attackId <= attacker.lastAttackId) {
      if (ws) safeSend(ws, { type: 'ATTACK_RESULT', attackId: Number.isSafeInteger(attackId) ? attackId : null, hit: false, reason: 'duplicate' });
      return;
    }
    attacker.lastAttackId = attackId;
    const cooldownRemaining = KNIFE_RULES.cooldownMs - (now - attacker.lastAttackAt);
    if (cooldownRemaining > 0) {
      if (ws) safeSend(ws, { type: 'ATTACK_RESULT', attackId, hit: false, reason: 'cooldown', cooldownRemaining });
      return;
    }
    attacker.lastAttackAt = now;
    this.broadcast({ type: 'PLAYER_ATTACKED', playerId: attacker.id }, ws);

    const forwardX = Math.sin(attacker.ry);
    const forwardZ = Math.cos(attacker.ry);
    const candidates = [...this.players.values()]
      .filter((target) => this.mode.playerCombat && target.id !== attacker.id && target.alive && target.connected)
      .map((target) => ({ target, type: 'player' }))
      .concat(this.dragon.alive ? [{ target: this.dragon, type: 'dragon' }] : [])
      .map((entry) => {
        const dx = entry.target.x - attacker.x;
        const dz = entry.target.z - attacker.z;
        const range = Math.hypot(dx, dz);
        const facing = range > 0 ? (forwardX * dx + forwardZ * dz) / range : -1;
        return { ...entry, range, facing };
      })
      .filter((entry) => entry.range <= KNIFE_RULES.range && entry.facing >= KNIFE_RULES.facingDotMin)
      .sort((a, b) => a.range - b.range);
    const selected = candidates[0];
    if (!selected) {
      if (ws) safeSend(ws, { type: 'ATTACK_RESULT', attackId, hit: false, reason: 'miss' });
      return;
    }

    this.pendingKnifeAttacks.push({
      ws, attackerId: attacker.id, attackId, targetId: selected.type === 'player' ? selected.target.id : null,
      targetType: selected.type, createdAt: now,
    });
    if (!this.knifeFlushTimer) {
      this.knifeFlushTimer = setTimeout(() => this.flushKnifeAttacks(), KNIFE_RULES.simultaneousWindowMs);
    }
  }

  flushKnifeAttacks() {
    this.knifeFlushTimer = null;
    const attacks = this.pendingKnifeAttacks.splice(0);
    if (!attacks.length || this.state !== 'ACTIVE') return;
    const playerDamage = new Map();
    const results = [];
    let dragonKillerId = null;

    for (const attack of attacks) {
      if (attack.targetType === 'dragon') {
        if (!this.dragon.alive) {
          results.push({ ...attack, hit: false, reason: 'target-unavailable', damage: 0 });
          continue;
        }
        results.push({ ...attack, hit: true, damage: KNIFE_RULES.damage });
        continue;
      }
      const target = this.players.get(attack.targetId);
      if (!target || !target.alive || !target.connected || !this.mode.playerCombat) {
        results.push({ ...attack, hit: false, reason: 'target-unavailable', damage: 0 });
        continue;
      }
      if (target.shieldUntil > Date.now()) {
        target.shieldUntil = 0;
        results.push({ ...attack, hit: true, blocked: true, damage: 0 });
      } else {
        const previous = playerDamage.get(target.id) || { damage: 0, attackerId: attack.attackerId, attacks: [] };
        playerDamage.set(target.id, previous);
        const result = { ...attack, hit: true, damage: KNIFE_RULES.damage };
        previous.attacks.push(result);
        results.push(result);
      }
    }

    for (const attack of results) {
      if (attack.targetType !== 'dragon' || !attack.hit) continue;
      const appliedDamage = Math.min(KNIFE_RULES.damage, this.dragon.health);
      attack.damage = appliedDamage;
      this.dragon.health -= appliedDamage;
      if (appliedDamage > 0) dragonKillerId = attack.attackerId;
    }

    for (const [targetId, result] of playerDamage) {
      const target = this.players.get(targetId);
      let remainingHealth = target.health;
      result.damage = 0;
      for (const attack of result.attacks) {
        const appliedDamage = Math.min(KNIFE_RULES.damage, remainingHealth);
        attack.damage = appliedDamage;
        remainingHealth -= appliedDamage;
        result.damage += appliedDamage;
        if (appliedDamage > 0) result.attackerId = attack.attackerId;
      }
      target.health = remainingHealth;
      this.broadcast({ type: 'PLAYER_DAMAGED', playerId: targetId, attackerId: result.attackerId, health: target.health, damage: result.damage, source: 'knife' });
    }
    const dragonDamage = results.reduce((total, attack) => total + (attack.targetType === 'dragon' ? attack.damage : 0), 0);
    if (dragonDamage > 0 && this.dragon.alive) {
      this.broadcast({ type: 'DRAGON_DAMAGED', attackerId: dragonKillerId, health: this.dragon.health, maxHealth: this.dragon.maxHealth, damage: dragonDamage });
    }

    for (const result of results) {
      if (result.hit && result.damage > 0) {
        const attacker = this.players.get(result.attackerId);
        if (attacker) {
          attacker.stats.damageDealt += result.damage;
          if (result.targetType === 'dragon') attacker.stats.dragonDamage += result.damage;
        }
      }
      if (result.ws) {
        safeSend(result.ws, {
          type: 'ATTACK_RESULT', attackId: result.attackId, hit: result.hit, targetType: result.targetType,
          targetId: result.targetId, damage: result.damage, blocked: Boolean(result.blocked), reason: result.reason,
        });
      }
    }
    for (const [targetId, result] of playerDamage) {
      const target = this.players.get(targetId);
      if (target.health > 0 || !target.alive) continue;
      target.alive = false;
      const killer = this.players.get(result.attackerId);
      if (killer) killer.stats.kills += 1;
      this.broadcast({ type: 'PLAYER_ELIMINATED', playerId: targetId, attackerId: result.attackerId, reason: 'Eliminated with a knife.', player: this.publicPlayer(target) });
    }

    if (this.dragon.alive && this.dragon.health <= 0) this.defeatDragon(dragonKillerId);
    else this.checkLastPlayer();
    this.broadcastState();
  }

  craftWeapon(player, recipeIndex) {
    if (this.state !== 'ACTIVE' || !player.alive) return { success: false, reason: 'Player cannot craft now' };
    const recipe = WEAPON_CRAFTING_RECIPES[recipeIndex];
    if (!recipe) return { success: false, reason: 'Invalid crafting recipe' };

    for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
      if ((player.resources[ingredient] || 0) < count) {
        return { success: false, reason: `Missing ${count}x ${RESOURCE_DEFINITIONS[ingredient]?.name || ingredient}` };
      }
    }

    for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
      player.resources[ingredient] -= count;
    }

    if (recipe.weaponId) {
      if (!player.weapons.includes(recipe.weaponId)) {
        player.weapons.push(recipe.weaponId);
      }
      player.equippedWeapon = recipe.weaponId;
      player.ammo[recipe.weaponId] = (player.ammo[recipe.weaponId] || 0) + (recipe.ammoGranted || 0);
    } else if (recipe.ammoType === 'KINETIC_AMMO') {
      player.ammo.PISTOL = (player.ammo.PISTOL || 0) + 16;
      player.ammo.GUN = (player.ammo.GUN || 0) + 20;
    } else if (recipe.ammoType === 'ENERGY_AMMO') {
      player.ammo.LASER_GUN = (player.ammo.LASER_GUN || 0) + 12;
      player.ammo.PLASMA_CANNON = (player.ammo.PLASMA_CANNON || 0) + 6;
    }

    this.broadcast({
      type: 'WEAPON_CRAFTED',
      playerId: player.id,
      weaponId: recipe.weaponId,
      ammoType: recipe.ammoType,
      ammo: player.ammo,
      weapons: player.weapons,
      resources: player.resources,
      equippedWeapon: player.equippedWeapon,
    });
    this.broadcastState();
    return { success: true, weaponId: recipe.weaponId, ammoType: recipe.ammoType };
  }

  fireWeapon(ws, player, message) {
    if (this.state !== 'ACTIVE' || !player.alive) return;
    const now = Date.now();
    const weaponId = player.equippedWeapon || 'KNIFE';
    const def = WEAPON_DEFINITIONS[weaponId] || WEAPON_DEFINITIONS.KNIFE;

    if (def.ammo !== Infinity) {
      const currentAmmo = player.ammo[weaponId] || 0;
      if (currentAmmo <= 0) {
        if (ws) safeSend(ws, { type: 'WEAPON_FIRE_RESULT', fireId: message.fireId, success: false, reason: 'no-ammo' });
        return;
      }
      player.ammo[weaponId] = currentAmmo - 1;
    }

    const cooldown = def.cooldownMs || 300;
    if (now - (player.lastWeaponFireAt || 0) < cooldown - 60) {
      if (ws) safeSend(ws, { type: 'WEAPON_FIRE_RESULT', fireId: message.fireId, success: false, reason: 'cooldown' });
      return;
    }
    player.lastWeaponFireAt = now;

    const origin = {
      x: Number(message.origin?.x) || player.x,
      y: Number(message.origin?.y) || (player.y + 1.2),
      z: Number(message.origin?.z) || player.z,
    };
    let dirX = Number(message.direction?.x) || Math.sin(player.ry);
    let dirY = Number(message.direction?.y) || 0;
    let dirZ = Number(message.direction?.z) || Math.cos(player.ry);
    const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
    dirX /= dirLen;
    dirY /= dirLen;
    dirZ /= dirLen;

    const candidates = [];

    if (this.mode.playerCombat) {
      for (const target of this.players.values()) {
        if (target.id === player.id || !target.alive || !target.connected) continue;
        const toTargetX = target.x - origin.x;
        const toTargetY = (target.y + 1.0) - origin.y;
        const toTargetZ = target.z - origin.z;
        const distAlongRay = toTargetX * dirX + toTargetY * dirY + toTargetZ * dirZ;
        if (distAlongRay <= 0 || distAlongRay > def.range) continue;

        const projX = origin.x + dirX * distAlongRay;
        const projY = origin.y + dirY * distAlongRay;
        const projZ = origin.z + dirZ * distAlongRay;
        const perpDist = Math.hypot(target.x - projX, (target.y + 1.0) - projY, target.z - projZ);

        if (perpDist <= 1.6) {
          candidates.push({
            type: 'player',
            target,
            distance: distAlongRay,
            point: { x: projX, y: projY, z: projZ },
          });
        }
      }
    }

    if (this.dragon.alive) {
      const toDragonX = this.dragon.x - origin.x;
      const toDragonY = (this.dragon.y + 2.0) - origin.y;
      const toDragonZ = this.dragon.z - origin.z;
      const distAlongRay = toDragonX * dirX + toDragonY * dirY + toDragonZ * dirZ;
      if (distAlongRay > 0 && distAlongRay <= def.range) {
        const projX = origin.x + dirX * distAlongRay;
        const projY = origin.y + dirY * distAlongRay;
        const projZ = origin.z + dirZ * distAlongRay;
        const perpDist = Math.hypot(this.dragon.x - projX, (this.dragon.y + 2.0) - projY, this.dragon.z - projZ);
        if (perpDist <= 5.5) {
          candidates.push({
            type: 'dragon',
            target: this.dragon,
            distance: distAlongRay,
            point: { x: projX, y: projY, z: projZ },
          });
        }
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    const hitEntry = candidates[0];
    const hitPoint = hitEntry ? hitEntry.point : {
      x: origin.x + dirX * Math.min(def.range, 50),
      y: origin.y + dirY * Math.min(def.range, 50),
      z: origin.z + dirZ * Math.min(def.range, 50),
    };

    let appliedDamage = 0;
    let hitTargetId = null;

    if (hitEntry) {
      if (hitEntry.type === 'player') {
        const target = hitEntry.target;
        hitTargetId = target.id;
        if (target.shieldUntil > now) {
          target.shieldUntil = 0;
          this.broadcast({ type: 'PLAYER_DAMAGED', playerId: target.id, attackerId: player.id, health: target.health, damage: 0, source: def.id, blocked: true });
        } else {
          appliedDamage = Math.min(def.damage, target.health);
          target.health = Math.max(0, target.health - appliedDamage);
          player.stats.damageDealt += appliedDamage;
          this.broadcast({ type: 'PLAYER_DAMAGED', playerId: target.id, attackerId: player.id, health: target.health, damage: appliedDamage, source: def.id });
          if (target.health <= 0) {
            target.alive = false;
            player.stats.kills += 1;
            this.broadcast({ type: 'PLAYER_ELIMINATED', playerId: target.id, attackerId: player.id, reason: `Eliminated with ${def.name}.`, player: this.publicPlayer(target) });
            this.checkLastPlayer();
          }
        }
      } else if (hitEntry.type === 'dragon') {
        hitTargetId = 'dragon';
        appliedDamage = Math.min(def.damage, this.dragon.health);
        this.dragon.health = Math.max(0, this.dragon.health - appliedDamage);
        player.stats.damageDealt += appliedDamage;
        player.stats.dragonDamage += appliedDamage;
        this.broadcast({ type: 'DRAGON_DAMAGED', attackerId: player.id, health: this.dragon.health, maxHealth: this.dragon.maxHealth, damage: appliedDamage, source: def.id });
        if (this.dragon.health <= 0) {
          this.defeatDragon(player.id);
        }
      }
    }

    if (def.splashRadius && def.splashRadius > 0) {
      const splashCenter = hitPoint;
      for (const target of this.players.values()) {
        if (target.id === player.id || !target.alive || target.id === hitTargetId) continue;
        const d = Math.hypot(target.x - splashCenter.x, target.z - splashCenter.z);
        if (d <= def.splashRadius) {
          const splashDmg = Math.round(def.damage * (1 - d / def.splashRadius) * 0.75);
          if (splashDmg > 0) {
            target.health = Math.max(0, target.health - splashDmg);
            player.stats.damageDealt += splashDmg;
            this.broadcast({ type: 'PLAYER_DAMAGED', playerId: target.id, attackerId: player.id, health: target.health, damage: splashDmg, source: 'splash' });
            if (target.health <= 0) {
              target.alive = false;
              player.stats.kills += 1;
              this.broadcast({ type: 'PLAYER_ELIMINATED', playerId: target.id, attackerId: player.id, reason: `Vaporized by plasma splash.`, player: this.publicPlayer(target) });
              this.checkLastPlayer();
            }
          }
        }
      }
    }

    this.broadcast({
      type: 'WEAPON_FIRED',
      playerId: player.id,
      weaponId: def.id,
      origin,
      direction: { x: dirX, y: dirY, z: dirZ },
      hit: Boolean(hitEntry),
      hitPoint,
      targetId: hitTargetId,
      damage: appliedDamage,
      remainingAmmo: player.ammo[weaponId] || 0,
    });

    if (ws) {
      safeSend(ws, {
        type: 'WEAPON_FIRE_RESULT',
        fireId: message.fireId,
        success: true,
        weaponId: def.id,
        remainingAmmo: player.ammo[weaponId] || 0,
      });
    }

    this.broadcastState();
  }

  handle(ws, message) {
    const id = this.clients.get(ws);
    const player = this.players.get(id);
    if (!player || !message || typeof message.type !== 'string') return;
    if (message.type === 'PLAYER_MOVE' && this.state === 'ACTIVE' && player.alive) {
      const state = message.state || {};
      const now = Date.now();
      const dt = clamp((now - player.lastMoveAt) / 1000, 0.01, 0.2);
      const requestedPosition = clampToWorld(clamp(state.x, -WORLD_RADIUS, WORLD_RADIUS), clamp(state.z, -WORLD_RADIUS, WORLD_RADIUS));
      const nx = requestedPosition.x, nz = requestedPosition.z;
      const weather = getWeatherState((now - this.matchStartedAt) / 1000);
      const speedCap = ((player.activeAbilities.SPEED || 0) > now ? 34 : 27) * weather.movementMultiplier;
      const maxStep = speedCap * dt + 2.5;
      const delta = distance(player, { x: nx, z: nz });
      if (delta > maxStep) {
        const ratio = maxStep / delta;
        player.x += (nx - player.x) * ratio;
        player.z += (nz - player.z) * ratio;
      } else { player.x = nx; player.z = nz; }
      player.y = clamp(state.y, -20, 250);
      player.ry = clamp(state.ry, -1000, 1000);
      player.pitch = Number.isFinite(state.pitch) ? clamp(state.pitch, -1.5, 1.5) : (player.pitch || 0);
      player.lastMoveAt = now;
      if (Number.isFinite(state.ry)) player.ry = Math.atan2(Math.sin(state.ry), Math.cos(state.ry));
      player.activeAbilities = Object.fromEntries(Object.entries(player.activeAbilities).filter(([, endsAt]) => endsAt > now));
      const biomeWeights = getBiomeWeights(this.worldNoise, player.x, player.z);
      const isInVolcanicZone = biomeWeights.volcanic >= 0.4;
      if (isInVolcanicZone && !player.inVolcanicZone) {
        this.broadcast({ type: 'WORLD_HAZARD_WARNING', playerId: id, hazard: 'VOLCANIC_GROUND' });
        player.nextWorldDamageAt = now + 1200;
      }
      player.inVolcanicZone = isInVolcanicZone;
      if (isInVolcanicZone && now >= player.nextWorldDamageAt) {
        const damage = 8;
        player.health = Math.max(0, player.health - damage);
        player.nextWorldDamageAt = now + 2200;
        this.broadcast({ type: 'PLAYER_DAMAGED', playerId: id, attackerId: 'world', health: player.health, damage, source: 'volcanic-ground' });
        if (player.health <= 0) this.eliminate(player, 'The volcanic ground overwhelmed you.', 'world');
      }
      for (const hazard of this.hazards) {
        if (!player.alive) break;
        if (hazard.ownerId === id || hazard.triggered || distance(player, hazard) > 2.2) continue;
        hazard.triggered = true;
        const absorbed = player.shieldUntil > now;
        if (absorbed) player.shieldUntil = 0;
        const damage = absorbed ? 0 : Math.min(25, player.health);
        if (!absorbed) player.health = Math.max(0, player.health - damage);
        if (!absorbed) {
          const owner = this.players.get(hazard.ownerId);
          if (owner) owner.stats.damageDealt += damage;
        }
        this.broadcast({ type: 'PLAYER_DAMAGED', playerId: id, attackerId: hazard.ownerId, health: player.health, damage, source: 'hazard' });
        if (player.health <= 0) {
          const owner = this.players.get(hazard.ownerId);
          if (owner && !absorbed) owner.stats.kills += 1;
          this.eliminate(player, 'Eliminated by a deployable hazard.', hazard.ownerId);
        }
      }
      this.hazards = this.hazards.filter((hazard) => !hazard.triggered && hazard.expiresAt > now);
      this.broadcastState();
      return;
    }
    if (message.type === 'KNIFE_ATTACK') {
      this.queueKnifeAttack(ws, player, message);
      return;
    }
    if (message.type === 'PICKUP_ITEM' && this.state === 'ACTIVE' && player.alive) {
      const item = this.items.find((entry) => entry.id === message.id && entry.active);
      if (!item || distance(player, item) > 3.6) return;
      this.handleItemPickup(player, item);
      this.broadcastState();
      return;
    }
    if (message.type === 'CRAFT_WEAPON' && this.state === 'ACTIVE' && player.alive) {
      const result = this.craftWeapon(player, message.recipeIndex);
      if (ws) safeSend(ws, { type: 'CRAFT_RESULT', ...result });
      return;
    }
    if (message.type === 'EQUIP_WEAPON' && player.alive) {
      const weaponId = String(message.weaponId || 'KNIFE');
      if (weaponId === 'KNIFE' || (player.weapons && player.weapons.includes(weaponId))) {
        player.equippedWeapon = weaponId;
        this.broadcast({ type: 'WEAPON_EQUIPPED', playerId: id, weaponId });
        this.broadcastState();
      }
      return;
    }
    if (message.type === 'WEAPON_FIRE' && this.state === 'ACTIVE' && player.alive) {
      this.fireWeapon(ws, player, message);
      return;
    }
    if (message.type === 'USE_ABILITY' && this.state === 'ACTIVE' && player.alive) {
      const ability = String(message.ability || '');
      const definition = ITEM_DEFINITIONS[ability];
      const now = Date.now();
      const readyAt = player.abilityReadyAt[ability] || 0;
      if (!definition || definition.kind !== 'ability' || !player.inventory.includes(ability)) {
        safeSend(ws, { type: 'ABILITY_RESULT', ability, success: false, reason: 'You do not have that ability.' });
        return;
      }
      if (now < readyAt) {
        safeSend(ws, { type: 'ABILITY_RESULT', ability, success: false, reason: 'Ability is cooling down.', readyAt });
        return;
      }
      player.abilityReadyAt[ability] = now + definition.cooldownMs;
      player.activeAbilities[ability] = now + definition.durationMs;
      if (ability === 'HAZARD') {
        const hazard = { id: `hazard-${id}-${now}`, ownerId: id, x: player.x, z: player.z, expiresAt: now + definition.durationMs };
        this.hazards ||= [];
        this.hazards.push(hazard);
        this.broadcast({ type: 'HAZARD_DEPLOYED', hazard });
      } else {
        if (ability === 'SHIELD') player.shieldUntil = now + definition.durationMs;
        this.broadcast({ type: 'ABILITY_USED', playerId: id, ability, duration: definition.durationMs, cooldownMs: definition.cooldownMs, readyAt: player.abilityReadyAt[ability] });
      }
      if (ability === 'HAZARD') this.broadcast({ type: 'ABILITY_USED', playerId: id, ability, duration: definition.durationMs, cooldownMs: definition.cooldownMs, readyAt: player.abilityReadyAt[ability] });
      safeSend(ws, { type: 'ABILITY_RESULT', ability, success: true, readyAt: player.abilityReadyAt[ability] });
      this.broadcastState();
      return;
    }
    if (message.type === 'VOICE_SIGNAL') {
      const targetId = String(message.targetId || '');
      if (!targetId || targetId === id) return;
      for (const [clientWs, clientId] of this.clients.entries()) {
        if (clientId === targetId) {
          safeSend(clientWs, {
            type: 'VOICE_SIGNAL',
            senderId: id,
            signal: message.signal,
          });
          break;
        }
      }
      return;
    }
    if (message.type === 'VOICE_STATUS') {
      player.voice = {
        isSpeaking: Boolean(message.isSpeaking),
        isMuted: Boolean(message.isMuted),
        isDeafened: Boolean(message.isDeafened),
      };
      this.broadcast({
        type: 'VOICE_STATUS',
        playerId: id,
        isSpeaking: player.voice.isSpeaking,
        isMuted: player.voice.isMuted,
        isDeafened: player.voice.isDeafened,
      }, ws);
      return;
    }
  }

  removeClient(ws) {
    const id = this.clients.get(ws);
    if (!id) return;
    this.broadcast({ type: 'VOICE_PEER_LEFT', playerId: id }, ws);
    this.clients.delete(ws);
    const player = this.players.get(id);
    if (!player || !player.connected) return;
    player.connected = false;
    player.reconnectExpiresAt = Date.now() + RECONNECT_GRACE_MS;
    player.reconnectTimer = setTimeout(() => {
      if (player.connected || player.reconnectExpiresAt > Date.now()) return;
      player.reconnectTimer = null;
      if (player.alive) {
        player.alive = false;
        player.health = 0;
      }
      this.players.delete(id);
      this.broadcast({ type: 'PLAYER_DISCONNECTED', playerId: id });
      this.checkLastPlayer();
      this.broadcastState();
      if (this.players.size === 0) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }, RECONNECT_GRACE_MS);
    this.broadcast({ type: 'PLAYER_DISCONNECTED', playerId: id, reconnectGraceMs: RECONNECT_GRACE_MS });
    this.broadcastState();
  }

  dispose() {
    clearInterval(this.interval);
    clearTimeout(this.emptyRoomTimer);
    clearTimeout(this.knifeFlushTimer);
    for (const player of this.players.values()) clearTimeout(player.reconnectTimer);
  }
}

const rooms = new Map();
const normalizeRoom = (value) => String(value || 'default').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'default';

// Enable CORS and body parsing for room discovery APIs
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

// API: List all active public rooms
app.get(['/api/rooms', '/rooms'], (_req, res) => {
  const activeRooms = [...rooms.values()]
    .filter((room) => room.players.size > 0 || room.id !== 'default')
    .map((room) => {
      const humanCount = [...room.players.values()].filter((p) => !p.isBot).length;
      const isFull = room.players.size >= room.maxPlayers && ![...room.players.values()].some((p) => p.isBot);
      return {
        id: room.id.toUpperCase(),
        code: room.id.toUpperCase(),
        mode: room.matchConfig.mode,
        modeName: room.matchConfig.modeName || room.mode.name,
        maxPlayers: room.maxPlayers,
        playerCount: room.players.size,
        humanCount,
        aliveCount: [...room.players.values()].filter((p) => p.alive).length,
        state: room.state,
        seed: room.seed,
        isFull,
      };
    });
  res.status(200).json({ rooms: activeRooms, count: activeRooms.length });
});

// API: Query status of a specific room code
app.get(['/api/rooms/:roomId', '/rooms/:roomId'], (req, res) => {
  const roomId = normalizeRoom(req.params.roomId);
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(200).json({ exists: false, id: req.params.roomId.toUpperCase() });
  }
  const humanCount = [...room.players.values()].filter((p) => !p.isBot).length;
  const isFull = room.players.size >= room.maxPlayers && ![...room.players.values()].some((p) => p.isBot);
  res.status(200).json({
    exists: true,
    id: room.id.toUpperCase(),
    code: room.id.toUpperCase(),
    mode: room.matchConfig.mode,
    modeName: room.matchConfig.modeName || room.mode.name,
    maxPlayers: room.maxPlayers,
    playerCount: room.players.size,
    humanCount,
    aliveCount: [...room.players.values()].filter((p) => p.alive).length,
    state: room.state,
    seed: room.seed,
    isFull,
  });
});

// API: Create or reserve a room with unique code and config
app.post(['/api/rooms', '/rooms'], (req, res) => {
  const requestedRoom = normalizeRoom(req.body?.roomCode);
  const requestedConfig = normalizeMatchConfig(req.body?.config || {});
  let room = rooms.get(requestedRoom);
  if (!room) {
    room = new GameRoom(requestedRoom, requestedConfig);
    rooms.set(requestedRoom, room);
  }
  res.status(200).json({
    success: true,
    room: {
      id: room.id.toUpperCase(),
      code: room.id.toUpperCase(),
      mode: room.matchConfig.mode,
      modeName: room.matchConfig.modeName || room.mode.name,
      maxPlayers: room.maxPlayers,
      seed: room.seed,
    },
  });
});

wss.on('connection', (ws, req) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const requestedRoom = normalizeRoom(params.get('room'));
  const reconnectToken = String(params.get('token') || '').slice(0, 80);
  const requestedName = (params.get('name') || '').trim().slice(0, 24);
  const requestedConfig = normalizeMatchConfig({
    mode: params.get('mode'),
    seed: params.get('seed'),
    fillBots: params.get('bots') !== 'false' && params.get('bots') !== 'none',
  });
  let roomId = requestedRoom;
  if (reconnectToken) {
    const previousRoom = [...rooms.values()].find((candidate) => (
      candidate.players.size > 0
      && [...candidate.players.values()].some((player) => player.reconnectToken === reconnectToken && !player.connected)
    ));
    if (previousRoom) roomId = previousRoom.id;
  }
  if (roomId === 'quickplay') {
    const existingRoom = requestedConfig.mode === 'solo'
      ? null
      : [...rooms.values()].find((candidate) => (
        candidate.state === 'ACTIVE'
        && candidate.matchConfig.mode === requestedConfig.mode
        && [...candidate.players.values()].filter((p) => !p.isBot).length < candidate.maxPlayers
      ));
    roomId = existingRoom?.id || normalizeRoom(`quick-${randomUUID().slice(0, 8)}`);
  }
  let room = rooms.get(roomId);
  if (!room) {
    room = new GameRoom(roomId, requestedConfig);
    rooms.set(roomId, room);
  }
  room.addClient(ws, reconnectToken, requestedName);

  ws.on('message', (data) => {
    try {
      room.handle(ws, JSON.parse(data.toString()));
    } catch (error) {
      console.error('Invalid game message:', error);
    }
  });

  ws.on('close', () => {
    room.removeClient(ws);
    if (room.clients.size === 0 && !room.emptyRoomTimer) {
      room.emptyRoomTimer = setTimeout(() => {
        if (room.clients.size === 0 && rooms.get(roomId) === room) {
          room.dispose();
          rooms.delete(roomId);
        }
      }, RECONNECT_GRACE_MS + 1000);
    }
  });
});

server.listen(PORT, () => console.log(`AetherBound 5-Player FFA server listening on ${PORT}`));
