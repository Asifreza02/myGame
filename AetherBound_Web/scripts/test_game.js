import { WebSocket } from 'ws';
import { MAGIC_STICKS, MAGIC_POWERS, TRAP_DEFINITIONS, MOB_SYSTEM_CONFIG, DRAGON_ATTACKS } from '../src/game/data/combat.js';
import { RESOURCE_DEFINITIONS } from '../src/game/data/world.js';

const BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

function log(section, msg, ok = true) {
  const icon = ok ? '✓' : '✗';
  console.log(`[${icon}] [${section}] ${msg}`);
}

async function runTests() {
  console.log('==============================================');
  console.log('   AETHERBOUND SERVER & GAMEPLAY TEST SUITE   ');
  console.log('==============================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, section = 'TEST') {
    if (condition) {
      log(section, message, true);
      passed++;
    } else {
      log(section, message, false);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // TEST 1: Health endpoint
  console.log('--- Step 1: Health & Config Endpoint ---');
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    assert(res.status === 200, `Health status is 200 (got ${res.status})`, 'HTTP');
    assert(data.status === 'ok', `Health status is 'ok'`, 'HTTP');
    assert(data.maxPlayers === 5, `Max players is 5 (got ${data.maxPlayers})`, 'HTTP');
  } catch (err) {
    log('HTTP', `Failed to query health endpoint: ${err.message}`, false);
    failed++;
  }

  // Helper to connect a WebSocket client and wait for message
  function createTestClient(name, room = 'test-room-a', token = '') {
    const url = new URL(WS_URL);
    url.searchParams.set('room', room);
    url.searchParams.set('role', 'player');
    url.searchParams.set('name', name);
    if (token) url.searchParams.set('token', token);

    const ws = new WebSocket(url.toString());
    const messages = [];
    const listeners = [];

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        messages.push(parsed);
        for (let i = listeners.length - 1; i >= 0; i--) {
          const l = listeners[i];
          if (l.predicate(parsed)) {
            listeners.splice(i, 1);
            l.resolve(parsed);
          }
        }
      } catch (e) {
        console.error('Error parsing msg:', e);
      }
    });

    return {
      ws,
      messages,
      waitForNextMessage(predicate, timeoutMs = 8000) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            const idx = listeners.findIndex((l) => l.resolve === resolve);
            if (idx >= 0) listeners.splice(idx, 1);
            reject(new Error(`Timed out waiting for next message after ${timeoutMs}ms`));
          }, timeoutMs);

          listeners.push({
            predicate,
            resolve: (msg) => {
              clearTimeout(timer);
              resolve(msg);
            },
          });
        });
      },
      waitForMessage(predicate, timeoutMs = 8000) {
        const existing = messages.slice().reverse().find(predicate);
        if (existing) return Promise.resolve(existing);
        return this.waitForNextMessage(predicate, timeoutMs);
      },
      send(obj) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(obj));
        }
      },
      close() {
        try {
          ws.close();
        } catch (_) {}
      },
    };
  }

  // Helper to move player smoothly in steps to respect speed validation
  async function walkTo(client, startPos, targetPos) {
    const dx = targetPos.x - startPos.x;
    const dz = targetPos.z - startPos.z;
    const totalDist = Math.hypot(dx, dz);
    const facing = Math.atan2(dx, dz);
    const stepDist = 1.2; // 1.2 meters per 60ms tick (20m/s speed)
    const numSteps = Math.max(1, Math.ceil(totalDist / stepDist));

    let current = { ...startPos };
    for (let i = 1; i <= numSteps; i++) {
      const t = i / numSteps;
      current = {
        x: startPos.x + dx * t,
        y: targetPos.y || startPos.y,
        z: startPos.z + dz * t,
        ry: facing,
        pitch: 0,
      };
      client.send({
        type: 'PLAYER_MOVE',
        state: current,
      });
      await new Promise((r) => setTimeout(r, 60));
    }
    return current;
  }

  // TEST 2: Connect Player 1 & Lobby / Room State
  console.log('\n--- Step 2: Player 1 Connection & Room Initialization ---');
  const roomName = `arena-${Date.now()}`;
  const client1 = createTestClient('Valkyrie_1', roomName);

  let p1InitState = null;
  let p1Token = null;
  let p1Id = null;
  let p1Pos = null;

  try {
    p1InitState = await client1.waitForMessage((m) => m.type === 'INIT_STATE');
    assert(p1InitState.playerId, `Player 1 received playerId: ${p1InitState.playerId}`, 'WS_CONN');
    assert(p1InitState.reconnectToken, 'Player 1 received reconnectToken', 'WS_CONN');
    assert(p1InitState.room === roomName, `Joined room: ${p1InitState.room}`, 'WS_CONN');
    assert(p1InitState.snapshot && p1InitState.snapshot.dragon && p1InitState.snapshot.dragon.maxHealth >= 400, `Dragon initialized with ${p1InitState.snapshot.dragon.maxHealth} HP`, 'WS_CONN');
    p1Id = p1InitState.playerId;
    p1Token = p1InitState.reconnectToken;

    const mySpawn = p1InitState.snapshot.players.find((p) => p.id === p1Id);
    p1Pos = { x: mySpawn.x, y: mySpawn.y, z: mySpawn.z, ry: mySpawn.ry, pitch: 0 };

    // Check Match State broadcast
    const matchState = await client1.waitForMessage((m) => m.type === 'MATCH_STATE');
    assert(matchState.snapshot, 'Received MATCH_STATE snapshot', 'SYNC');
    assert(matchState.snapshot.players.length === 5, `Match has 5 contenders (1 human + 4 AI bots)`, 'SYNC');
    assert(matchState.snapshot.items.length > 0, `Items spawned in world: ${matchState.snapshot.items.length}`, 'SYNC');
  } catch (err) {
    log('WS_CONN', `Player 1 setup failed: ${err.message}`, false);
    failed++;
  }

  // TEST 3: Connect Player 2 & Bot Slot Replacement
  console.log('\n--- Step 3: Player 2 Connection & Bot Replacement ---');
  const client2 = createTestClient('Ranger_2', roomName);
  let p2Id = null;
  let p2Token = null;
  let p2Pos = null;

  try {
    const p2Init = await client2.waitForMessage((m) => m.type === 'INIT_STATE');
    p2Id = p2Init.playerId;
    p2Token = p2Init.reconnectToken;
    const p2Spawn = p2Init.snapshot.players.find((p) => p.id === p2Id);
    p2Pos = { x: p2Spawn.x, y: p2Spawn.y, z: p2Spawn.z, ry: p2Spawn.ry, pitch: 0 };
    assert(p2Id && p2Id !== p1Id, `Player 2 connected with unique ID: ${p2Id}`, 'MULTI');

    // Wait for MATCH_STATE showing 2 humans
    const nextState = await client1.waitForNextMessage((m) => {
      if (m.type !== 'MATCH_STATE') return false;
      const comps = m.snapshot.players || [];
      const humanCount = comps.filter((c) => !c.isBot).length;
      return humanCount === 2;
    });

    assert(nextState, 'MATCH_STATE updated: 2 humans + 3 AI bots = 5 competitors', 'MULTI');
  } catch (err) {
    log('MULTI', `Player 2 setup failed: ${err.message}`, false);
    failed++;
  }

  // TEST 4: Transform & Movement Synchronization
  console.log('\n--- Step 4: Transform Synchronization ---');
  try {
    const targetMovePos = { x: p1Pos.x + 2.0, y: p1Pos.y, z: p1Pos.z + 1.0 };
    p1Pos = await walkTo(client1, p1Pos, targetMovePos);

    // Client 2 should observe Client 1's position updated in MATCH_STATE
    const syncState = await client2.waitForNextMessage((m) => {
      if (m.type !== 'MATCH_STATE') return false;
      const c1 = m.snapshot.players.find((c) => c.id === p1Id);
      return c1 && Math.abs(c1.x - p1Pos.x) < 1.0 && Math.abs(c1.z - p1Pos.z) < 1.0;
    });
    assert(syncState, 'Client 2 received synced position of Client 1', 'TRANSFORM');
  } catch (err) {
    log('TRANSFORM', `Transform sync failed: ${err.message}`, false);
    failed++;
  }

  // TEST 5: Item Collection & Resource Accumulation
  console.log('\n--- Step 5: Item Collection & Inventory ---');
  try {
    const latestState = await client1.waitForMessage((m) => m.type === 'MATCH_STATE');
    const items = latestState.snapshot.items.filter((it) => it.active);

    // Find the item closest to Player 1
    items.sort((a, b) => Math.hypot(a.x - p1Pos.x, a.z - p1Pos.z) - Math.hypot(b.x - p1Pos.x, b.z - p1Pos.z));
    const closestItem = items[0];
    log('INVENTORY', `Walking to nearest item (${closestItem.type} at ${closestItem.x}, ${closestItem.z})`);

    // Smoothly walk directly on top of the item
    p1Pos = await walkTo(client1, p1Pos, { x: closestItem.x, y: p1Pos.y, z: closestItem.z });

    // Send item pickup request
    client1.send({
      type: 'PICKUP_ITEM',
      id: closestItem.id,
    });

    const itemCollectedEvent = await client1.waitForNextMessage(
      (m) => (m.type === 'ITEM_COLLECTED' && m.id === closestItem.id) ||
             (m.type === 'MATCH_STATE' && !m.snapshot.items.some((it) => it.id === closestItem.id && it.active))
    );
    assert(itemCollectedEvent, `Item ${closestItem.type} collected successfully`, 'INVENTORY');
  } catch (err) {
    log('INVENTORY', `Item collection failed: ${err.message}`, false);
    failed++;
  }

  // TEST 6: Melee Knife Combat & Damage Verification
  console.log('\n--- Step 6: Authoritative Melee Combat & Damage ---');
  try {
    // Walk Player 2 to within 1.2m of Player 1
    const p2Target = { x: p1Pos.x + 1.2, y: p1Pos.y, z: p1Pos.z };
    p2Pos = await walkTo(client2, p2Pos, p2Target);

    // Orient Player 1 directly facing Player 2
    const dx = p2Pos.x - p1Pos.x;
    const dz = p2Pos.z - p1Pos.z;
    const ryP1 = Math.atan2(dx, dz);
    p1Pos.ry = ryP1;
    client1.send({ type: 'PLAYER_MOVE', state: p1Pos });

    // Orient Player 2 facing Player 1
    p2Pos.ry = Math.atan2(-dx, -dz);
    client2.send({ type: 'PLAYER_MOVE', state: p2Pos });

    await new Promise((r) => setTimeout(r, 150));

    // Client 1 attacks Client 2 with knife
    client1.send({
      type: 'KNIFE_ATTACK',
      attackId: 101,
    });

    // Expect PLAYER_DAMAGED broadcast for Client 2
    const damageMsg = await client2.waitForNextMessage((m) => m.type === 'PLAYER_DAMAGED' && m.playerId === p2Id);
    assert(damageMsg, `Client 2 took ${damageMsg.damage} melee damage from Client 1 (Remaining HP: ${damageMsg.health})`, 'COMBAT');
  } catch (err) {
    log('COMBAT', `Combat test failed: ${err.message}`, false);
    failed++;
  }

  // TEST 7: Dragon Status & Combat Verification
  console.log('\n--- Step 7: Dragon Status & Boss Mechanics ---');
  try {
    const dragonStateMsg = await client1.waitForMessage((m) => m.type === 'MATCH_STATE' && m.snapshot.dragon);
    const dragon = dragonStateMsg.snapshot.dragon;
    assert(dragon.alive, `Dragon is alive with ${dragon.health}/${dragon.maxHealth} HP (Phase: ${dragon.phase})`, 'DRAGON');
    assert(dragon.maxHealth >= 400, `Dragon boss health correctly initialized to ${dragon.maxHealth}`, 'DRAGON');
    assert(['PASSIVE', 'ENRAGED', 'INFERNO', 'APOCALYPTIC'].includes(dragon.phase), `Dragon phase is valid: ${dragon.phase}`, 'DRAGON');
  } catch (err) {
    log('DRAGON', `Dragon test failed: ${err.message}`, false);
    failed++;
  }

  // TEST 8: Reconnection Token Resume
  console.log('\n--- Step 8: Reconnection Token Handling ---');
  try {
    client2.close();
    await new Promise((r) => setTimeout(r, 300));

    // Reconnect with same token
    const client2Reconnected = createTestClient('Ranger_2', roomName, p2Token);
    const reconInit = await client2Reconnected.waitForMessage((m) => m.type === 'INIT_STATE');
    assert(reconInit.reconnectToken, `Reconnection succeeded, reconnected to room: ${reconInit.room}`, 'RECONNECT');
    client2Reconnected.close();
  } catch (err) {
    log('RECONNECT', `Reconnect test failed: ${err.message}`, false);
    failed++;
  }

  // TEST 9: Weapon Crafting & Equipment Validation
  console.log('\n--- Step 9: Weapon Crafting & Swapping ---');
  try {
    // Try to craft recipe 0 (Aether Blaster Pistol)
    client1.send({
      type: 'CRAFT_WEAPON',
      recipeIndex: 0,
    });

    const craftResult = await client1.waitForNextMessage((m) => m.type === 'CRAFT_RESULT');
    assert(craftResult !== null, `Server responded to craft request: ${craftResult.reason || 'Crafted successfully'}`, 'CRAFTING');

    // Test stick equip
    client1.send({
      type: 'EQUIP_STICK',
      stickId: 'APPRENTICE_STICK',
    });
    const equipResult = await client1.waitForNextMessage((m) => m.type === 'STICK_EQUIPPED' || m.type === 'WEAPON_EQUIPPED');
    assert(equipResult && (equipResult.stickId === 'APPRENTICE_STICK' || equipResult.weaponId === 'APPRENTICE_STICK'), 'Equipped stick is APPRENTICE_STICK', 'WEAPONS');

    // TEST 10: Phase 1 Data Contracts & Power Slots
    console.log('\n--- Step 10: Phase 1 Data Contracts & Power Slots ---');
    client1.send({
      type: 'SET_POWER_SLOT',
      slotIndex: 3,
      powerId: 'AETHER_WAVE',
    });
    const powerSlotResult = await client1.waitForNextMessage((m) => m.type === 'POWER_SLOT_CHANGED');
    assert(powerSlotResult && powerSlotResult.slotIndex === 3, 'Power slot 3 updated to AETHER_WAVE', 'PHASE_1');
    assert(Array.isArray(powerSlotResult.powerSlots) && powerSlotResult.powerSlots.length === 7, 'Player powerSlots has exactly 7 slots', 'PHASE_1');

    // TEST 11: Phase 4 Arcane Ground Traps
    console.log('\n--- Step 11: Phase 4 Arcane Ground Traps & Detonations ---');
    client1.send({
      type: 'DEPLOY_TRAP',
      trapType: 'FROST_TRAP',
      position: { x: 15, y: 1, z: 15 },
    });
    const trapDeployed = await client1.waitForNextMessage((m) => m.type === 'TRAP_DEPLOYED');
    assert(trapDeployed !== null && trapDeployed.trap?.trapType === 'FROST_TRAP', 'Frost Rune Trap deployed successfully on server', 'PHASE_4_TRAPS');
    assert(trapDeployed.trap.armedAt > Date.now(), 'Trap has active arming delay', 'PHASE_4_TRAPS');
    assert(trapDeployed.trap.radius > 0, `Trap trigger radius is valid (${trapDeployed.trap.radius}m)`, 'PHASE_4_TRAPS');

    // TEST 12: Phase 5 3-Tier Mob System
    console.log('\n--- Step 12: Phase 5 3-Tier Mob System (Aqua Fiend & Flame Brute) ---');
    const latestState = await client1.waitForNextMessage((m) => m.type === 'MATCH_STATE');
    assert(latestState && Array.isArray(latestState.snapshot?.mobs), 'Match snapshot contains mobs array', 'PHASE_5_MOBS');
    const aquaFiend = latestState.snapshot.mobs.find((m) => m.tier === 1 && m.type === 'AQUA_FIEND');
    assert(aquaFiend !== undefined, 'Tier 1 Aqua Fiend spawned at match start (0:00)', 'PHASE_5_MOBS');
    assert(aquaFiend.health === 80, `Aqua Fiend has 80 HP (got ${aquaFiend.health})`, 'PHASE_5_MOBS');
    assert(aquaFiend.attackDamage === 16, `Aqua Fiend attack deals 16 damage (got ${aquaFiend.attackDamage})`, 'PHASE_5_MOBS');

    // TEST 13: Phase 6 Final Boss Dragon Multi-Attack & Aerial/Grounded Cycle
    console.log('\n--- Step 13: Phase 6 Final Boss Dragon Multi-Attack & Ground Cycle ---');
    const dragon = latestState.snapshot?.dragon;
    assert(dragon !== undefined && dragon.alive, 'Dragon exists and is alive in snapshot', 'PHASE_6_DRAGON');
    assert(dragon.health === 500 && dragon.maxHealth === 500, `Dragon health is 500 HP (got ${dragon.health})`, 'PHASE_6_DRAGON');
    assert(dragon.flightPhase === 'AERIAL', `Dragon initializes in AERIAL flight phase (got ${dragon.flightPhase})`, 'PHASE_6_DRAGON');
    assert(typeof dragon.flightPhaseTimer === 'number' && dragon.flightPhaseTimer > 0, `Flight phase countdown timer is active (${dragon.flightPhaseTimer}s)`, 'PHASE_6_DRAGON');

    // Multi-attack configuration assertions
    assert(DRAGON_ATTACKS.FIRE_BREATH !== undefined, 'Dragon has FIRE_BREATH cone attack (Aerial)', 'PHASE_6_DRAGON');
    assert(DRAGON_ATTACKS.FIRE_BREATH.damage === 34 && DRAGON_ATTACKS.FIRE_BREATH.range === 52, 'FIRE_BREATH has 34 dmg and 52m range', 'PHASE_6_DRAGON');
    assert(DRAGON_ATTACKS.GROUND_SLAM !== undefined, 'Dragon has GROUND_SLAM radial slam (Grounded)', 'PHASE_6_DRAGON');
    assert(DRAGON_ATTACKS.GROUND_SLAM.damage === 28 && DRAGON_ATTACKS.GROUND_SLAM.radius === 9, 'GROUND_SLAM has 28 dmg and 9m radius', 'PHASE_6_DRAGON');
    assert(DRAGON_ATTACKS.TAIL_SWEEP !== undefined, 'Dragon has TAIL_SWEEP 360-degree sweep (Grounded)', 'PHASE_6_DRAGON');
    assert(DRAGON_ATTACKS.TAIL_SWEEP.damage === 22 && DRAGON_ATTACKS.TAIL_SWEEP.range === 8, 'TAIL_SWEEP has 22 dmg and 8m range', 'PHASE_6_DRAGON');

    // TEST 14: Phase 7 Full Magical Power System & Natural Resources Verification
    console.log('\n--- Step 14: Phase 7 Full Magical System & Resources ---');
    assert(MAGIC_STICKS.APPRENTICE_STICK.damage > 0, 'Starter Apprentice Wand has valid spark damage', 'PHASE_7_SYSTEM');
    assert(MAGIC_STICKS.APPRENTICE_STICK.ammo === Infinity, 'Starter Apprentice Wand has infinite basic spark ammo', 'PHASE_7_SYSTEM');
    const primaryResources = Object.values(RESOURCE_DEFINITIONS).filter((r) => !r.aliasOf);
    assert(primaryResources.length === 7, `7 Primary Natural Resources defined in the game (got ${primaryResources.length})`, 'PHASE_7_SYSTEM');
    assert(Object.keys(TRAP_DEFINITIONS).length >= 3, 'Tactical magical ground traps defined', 'PHASE_7_SYSTEM');
    assert(Object.keys(MAGIC_POWERS).length >= 7, 'Full 7-power arsenal defined for hotbar slots', 'PHASE_7_SYSTEM');
  } catch (err) {
    log('CRAFTING', `Crafting/weapon test failed: ${err.message}`, false);
    failed++;
  }

  // Clean up
  client1.close();

  console.log('\n==============================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('==============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
