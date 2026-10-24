import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { DRAGON_ATTACKS, ITEM_DEFINITIONS, KNIFE_RULES } from '../src/game/data/combat.js';
import { BIOME_RESOURCES, RESOURCE_DEFINITIONS, getWeatherState } from '../src/game/data/world.js';
import { MATCH_MODES, normalizeMatchConfig } from '../src/game/data/matchModes.js';
import { SimplexNoise, getBiomeWeights } from '../src/game/noise.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3001;
const MAX_PLAYERS = Number.isInteger(Number(process.env.MAX_ROOM_PLAYERS))
  ? Math.min(32, Math.max(2, Number(process.env.MAX_ROOM_PLAYERS)))
  : 24;
const SERVER_TICK_MS = 50;
const STATE_BROADCAST_MS = 100;
const RECONNECT_GRACE_MS = 30_000;
const DRAGON_REWARD_POLICY = process.env.DRAGON_REWARD_POLICY || 'final-blow';

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

const safeSend = (ws, payload) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

class GameRoom {
  constructor(id, requestedConfig = {}) {
    this.id = id;
    this.config = normalizeMatchConfig(requestedConfig);
    this.mode = MATCH_MODES[this.config.mode];
    this.maxPlayers = this.config.mode === 'ffa'
      ? MAX_PLAYERS
      : Math.min(MAX_PLAYERS, this.mode.maxPlayers);
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
    this.timeRemaining = this.config.durationSeconds;
    this.dragon = { x: 42, y: 11, z: -34, health: 420, maxHealth: 420, alive: true, phase: 'STALKING', attack: null, nextAttackAt: 0 };
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
  }

  addClient(ws, reconnectToken) {
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
        timeRemaining: this.timeRemaining,
        snapshot: this.snapshot(),
      });
      this.broadcast({ type: 'PLAYER_RECONNECTED', player: this.publicPlayer(returningPlayer) }, ws);
      this.broadcastState();
      return;
    }
    if (this.players.size >= this.maxPlayers) {
      safeSend(ws, { type: 'ROOM_FULL', maxPlayers: this.maxPlayers });
      ws.close(1008, 'Room full');
      return;
    }
    const id = `player-${Math.random().toString(36).slice(2, 9)}`;
    const slot = this.nextSpawnSlot || 0;
    this.nextSpawnSlot = slot + 1;
    const angle = slot * 2.399;
    const radius = 12 + 9 * Math.sqrt(slot);
    const token = reconnectToken || randomUUID();
    const player = {
      id, name: `Wanderer ${slot + 1}`, x: Math.cos(angle) * radius, y: 3, z: Math.sin(angle) * radius,
      ry: angle + Math.PI, health: 100, maxHealth: 100, alive: true,
      inventory: [], joinedAt: Date.now(), lastMoveAt: 0, lastAttackAt: 0,
      lastAttackId: 0, abilityReadyAt: {}, activeAbilities: {}, shieldUntil: 0,
      reconnectToken: token, connected: true, reconnectExpiresAt: 0, reconnectTimer: null,
      resources: {}, stats: { kills: 0, survivalTime: 0, itemsCollected: 0, damageDealt: 0, dragonDamage: 0 },
      lastSurvivalTickAt: Date.now(), nextWorldDamageAt: 0, inVolcanicZone: false,
    };
    this.clients.set(ws, id);
    this.players.set(id, player);
    if (this.players.size >= 1 && this.state === 'LOBBY') this.start();
    safeSend(ws, {
      type: 'INIT_STATE',
      playerId: id,
      reconnectToken: token,
      resumed: false,
      room: this.id,
      seed: this.seed,
      matchConfig: this.matchConfig,
      state: this.state,
      timeRemaining: this.timeRemaining,
      snapshot: this.snapshot(),
    });
    this.broadcast({ type: 'PLAYER_JOINED', player: this.publicPlayer(player) });
    this.broadcastState();
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
    const createResourceDrop = (index, x, z, biome) => {
      const pool = BIOME_RESOURCES[biome] || BIOME_RESOURCES.lush;
      const type = pool[Math.floor(random() * pool.length)];
      return {
        id: `loot-${index}-${Math.floor(random() * 1_000_000).toString(36)}`,
        type,
        kind: 'resource',
        biome,
        rarity: RESOURCE_DEFINITIONS[type].rarity,
        x,
        z,
        active: true,
      };
    };
    const items = [];

    for (let index = 0; index < 12; index += 1) {
      const angle = index * 2.399 + (random() - 0.5) * 0.25;
      const radius = 28 + (index % 4) * 16 + random() * 6;
      const x = Math.round(Math.cos(angle) * radius);
      const z = Math.round(Math.sin(angle) * radius);
      items.push(createAbilityDrop(index, x, z));
    }

    const resourcePoints = new Map();
    for (let radius = 80; radius <= 1400 && resourcePoints.size < 4; radius += 24) {
      for (let sector = 0; sector < 24 && resourcePoints.size < 4; sector += 1) {
        const angle = (sector / 24) * Math.PI * 2;
        const x = Math.round(Math.cos(angle) * radius);
        const z = Math.round(Math.sin(angle) * radius);
        const biome = this.getBiomeAt(x, z);
        if (!resourcePoints.has(biome)) resourcePoints.set(biome, { x, z });
      }
    }
    for (const biome of Object.keys(BIOME_RESOURCES)) {
      const point = resourcePoints.get(biome);
      if (!point) throw new Error(`Unable to place resource loot in the ${biome} biome.`);
      items.push(createResourceDrop(items.length, point.x, point.z, biome));
    }

    const beacon = { x: 120, z: 120 };
    const beaconAngle = random() * Math.PI * 2;
    const beaconRadius = 6 + random() * 7;
    const beaconX = Math.round(beacon.x + Math.cos(beaconAngle) * beaconRadius);
    const beaconZ = Math.round(beacon.z + Math.sin(beaconAngle) * beaconRadius);
    items.push(createAbilityDrop(items.length, beaconX, beaconZ));
    const resourceAngle = beaconAngle + Math.PI;
    const resourceX = Math.round(beacon.x + Math.cos(resourceAngle) * beaconRadius);
    const resourceZ = Math.round(beacon.z + Math.sin(resourceAngle) * beaconRadius);
    items.push(createResourceDrop(items.length, resourceX, resourceZ, this.getBiomeAt(resourceX, resourceZ)));

    for (let index = 0; index < 2; index += 1) {
      const angle = (index / 2) * Math.PI * 2 + random() * 0.5;
      const radius = 18 + random() * 10;
      const x = Math.round(this.dragon.x + Math.cos(angle) * radius);
      const z = Math.round(this.dragon.z + Math.sin(angle) * radius);
      items.push(createAbilityDrop(items.length, x, z, 'Rare', index === 0 ? 'SHIELD' : 'HAZARD'));
    }

    return items;
  }

  getBiomeAt(x, z) {
    const weights = getBiomeWeights(this.worldNoise, x, z);
    return Object.keys(weights).reduce((best, biome) => weights[biome] > weights[best] ? biome : best, 'lush');
  }

  publicPlayer(player) {
    const { id, name, x, y, z, ry, health, maxHealth, alive, connected, inventory, abilityReadyAt, activeAbilities, resources } = player;
    const stats = {
      ...player.stats,
      survivalTime: Math.floor(player.stats.survivalTime),
    };
    return { id, name, x, y, z, ry, health, maxHealth, alive, connected, inventory, abilityReadyAt, activeAbilities, resources, stats };
  }

  snapshot() {
    return {
      room: this.id, state: this.state, timeRemaining: this.timeRemaining,
      matchConfig: this.matchConfig,
      players: [...this.players.values()].map((player) => this.publicPlayer(player)),
      items: this.items.map((item) => ({ ...item })),
      hazards: this.hazards.map((hazard) => ({ ...hazard })),
      dragon: { ...this.dragon }, dragonRewardPolicy: this.dragonRewardPolicy,
      weather: getWeatherState(this.matchStartedAt ? (Date.now() - this.matchStartedAt) / 1000 : 0),
    };
  }

  start() {
    this.state = 'ACTIVE';
    this.matchStartedAt = Date.now();
    this.dragon.nextAttackAt = this.matchStartedAt + 4500;
    this.interval = setInterval(() => {
      if (this.state !== 'ACTIVE') return;
      const now = Date.now();
      this.timeRemaining = Math.max(0, this.config.durationSeconds - Math.floor((Date.now() - this.matchStartedAt) / 1000));
      if (this.timeRemaining <= 0) {
        const livingPlayer = [...this.players.values()].find((player) => player.alive);
        if (this.config.mode === 'solo' && livingPlayer) {
          this.finish(livingPlayer.id, 'You survived the full match.', 'survival');
        } else {
          this.finish('draw', 'The match timer expired.');
        }
      }
      else {
        this.updateSurvivalTime(now);
        this.updateDragon(now, SERVER_TICK_MS / 1000);
        this.hazards = this.hazards.filter((hazard) => !hazard.triggered && hazard.expiresAt > now);
        this.broadcastState();
      }
    }, SERVER_TICK_MS);
    this.broadcast({ type: 'MATCH_STARTED', seed: this.seed, duration: this.config.durationSeconds, matchConfig: this.matchConfig });
  }

  updateSurvivalTime(now) {
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      const elapsed = Math.max(0, Math.min(now - player.lastSurvivalTickAt, 250));
      player.stats.survivalTime += elapsed / 1000;
      player.lastSurvivalTickAt = now;
    }
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
    const nextPhase = this.dragon.health <= this.dragon.maxHealth * 0.5 ? 'ENRAGED' : 'STALKING';
    if (nextPhase !== this.dragon.phase) {
      this.dragon.phase = nextPhase;
      this.broadcast({ type: 'DRAGON_PHASE_CHANGED', phase: nextPhase });
    }

    const alivePlayers = [...this.players.values()].filter((player) => player.alive && player.connected);
    const target = alivePlayers.sort((a, b) => distance(a, this.dragon) - distance(b, this.dragon))[0];
    if (this.dragon.attack) {
      if (now >= this.dragon.attack.impactAt) this.resolveDragonAttack(now);
      return;
    }

    const moveSpeed = this.dragon.phase === 'ENRAGED' ? 16 : 11;
    const elapsed = (now - this.matchStartedAt) / 1000;
    if (target) {
      const orbitAngle = elapsed * (this.dragon.phase === 'ENRAGED' ? 0.68 : 0.46);
      const orbitRadius = 2.6;
      const orbitX = target.x + Math.cos(orbitAngle) * orbitRadius;
      const orbitZ = target.z + Math.sin(orbitAngle) * orbitRadius;
      const moveX = orbitX - this.dragon.x;
      const moveZ = orbitZ - this.dragon.z;
      const moveDistance = Math.hypot(moveX, moveZ);
      if (moveDistance > 0.5) {
        const step = Math.min(moveDistance, moveSpeed * tickSeconds);
        this.dragon.x += (moveX / moveDistance) * step;
        this.dragon.z += (moveZ / moveDistance) * step;
      }
      this.dragon.ry = Math.atan2(target.x - this.dragon.x, target.z - this.dragon.z);
    } else {
      this.dragon.x = 42 + Math.cos(elapsed * 0.18) * 10;
      this.dragon.z = -34 + Math.sin(elapsed * 0.18) * 10;
      this.dragon.ry = elapsed * 0.18 - Math.PI / 2;
    }

    if (!target || now < this.dragon.nextAttackAt) return;
    const attack = this.nextDragonAttack();
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

  nextDragonAttack() {
    const options = Object.values(DRAGON_ATTACKS);
    const next = options.find((attack) => attack.id !== this.lastDragonAttackType) || options[0];
    this.lastDragonAttackType = next.id;
    if (this.dragon.phase === 'ENRAGED') {
      return { ...next, telegraphMs: Math.max(750, next.telegraphMs - 250), cooldownMs: next.cooldownMs * 0.72, damage: next.damage + 8 };
    }
    return next;
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
      this.finish('none', 'You were eliminated before the timer expired.', 'survival');
      return;
    }
    if (this.config.mode === 'dragon-hunt' && this.state === 'ACTIVE' && alive.length === 0) {
      this.finish('none', 'The hunting party was eliminated.', 'survival');
      return;
    }
    if (!this.mode.playerCombat) return;
    const hasHadOpponent = this.players.size > 1;
    if (this.state === 'ACTIVE' && hasHadOpponent && alive.length === 1) {
      this.finish(alive[0].id, `${alive[0].name} is the last player standing.`);
    } else if (this.state === 'ACTIVE' && hasHadOpponent && alive.length === 0) {
      this.finish('draw', 'No players remain alive.');
    }
  }

  eliminate(player, reason, attackerId = null) {
    if (!player?.alive || this.state !== 'ACTIVE') return;
    player.alive = false;
    player.health = 0;
    this.broadcast({ type: 'PLAYER_ELIMINATED', playerId: player.id, attackerId, reason, player: this.publicPlayer(player) });
    this.checkLastPlayer();
  }

  queueKnifeAttack(ws, attacker, message) {
    if (this.state !== 'ACTIVE' || !attacker.alive) return;
    const now = Date.now();
    const attackId = Number(message.attackId);
    if (!Number.isSafeInteger(attackId) || attackId <= attacker.lastAttackId) {
      safeSend(ws, { type: 'ATTACK_RESULT', attackId: Number.isSafeInteger(attackId) ? attackId : null, hit: false, reason: 'duplicate' });
      return;
    }
    attacker.lastAttackId = attackId;
    const cooldownRemaining = KNIFE_RULES.cooldownMs - (now - attacker.lastAttackAt);
    if (cooldownRemaining > 0) {
      safeSend(ws, { type: 'ATTACK_RESULT', attackId, hit: false, reason: 'cooldown', cooldownRemaining });
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
      safeSend(ws, { type: 'ATTACK_RESULT', attackId, hit: false, reason: 'miss' });
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
      safeSend(result.ws, {
        type: 'ATTACK_RESULT', attackId: result.attackId, hit: result.hit, targetType: result.targetType,
        targetId: result.targetId, damage: result.damage, blocked: Boolean(result.blocked), reason: result.reason,
      });
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

  handle(ws, message) {
    const id = this.clients.get(ws);
    const player = this.players.get(id);
    if (!player || !message || typeof message.type !== 'string') return;
    if (message.type === 'PLAYER_MOVE' && this.state === 'ACTIVE' && player.alive) {
      const state = message.state || {};
      const now = Date.now();
      const dt = clamp((now - player.lastMoveAt) / 1000, 0.01, 0.2);
      const nx = clamp(state.x, -5000, 5000), nz = clamp(state.z, -5000, 5000);
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
      if (!item || distance(player, item) > 3.2) return;
      item.active = false;
      const definition = ITEM_DEFINITIONS[item.type];
      if (item.kind === 'resource') {
        player.resources[item.type] = (player.resources[item.type] || 0) + 1;
      } else if (item.type === 'HEALTH') {
        player.health = Math.min(player.maxHealth, player.health + definition.heal);
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
        playerId: id,
        health: player.health,
        inventory: player.inventory,
        resources: player.resources,
      });
      this.broadcastState();
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
  }

  removeClient(ws) {
    const id = this.clients.get(ws);
    if (!id) return;
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
wss.on('connection', (ws, req) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const requestedRoom = normalizeRoom(params.get('room'));
  const reconnectToken = String(params.get('token') || '').slice(0, 80);
  const requestedConfig = normalizeMatchConfig({
    mode: params.get('mode'),
    durationSeconds: params.get('duration'),
    seed: params.get('seed'),
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
        && candidate.matchConfig.durationSeconds === requestedConfig.durationSeconds
        && candidate.players.size < candidate.maxPlayers
      ));
    roomId = existingRoom?.id || normalizeRoom(`quick-${randomUUID().slice(0, 8)}`);
  }
  let room = rooms.get(roomId);
  if (!room) { room = new GameRoom(roomId, requestedConfig); rooms.set(roomId, room); }
  room.addClient(ws, reconnectToken);
  ws.on('message', (data) => {
    try { room.handle(ws, JSON.parse(data.toString())); }
    catch (error) { console.error('Invalid game message:', error); }
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

server.listen(PORT, () => console.log(`AetherBound FFA server listening on ${PORT}`));
