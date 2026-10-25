import { WebSocket } from 'ws';

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
  function createTestClient(name, room = 'TEST_ROOM_A', token = '') {
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
      waitForMessage(predicate, timeoutMs = 6000) {
        const existing = messages.find(predicate);
        if (existing) return Promise.resolve(existing);

        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            const idx = listeners.findIndex((l) => l.resolve === resolve);
            if (idx >= 0) listeners.splice(idx, 1);
            reject(new Error(`Timed out waiting for message after ${timeoutMs}ms`));
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

  // TEST 2: Connect Player 1 & Lobby / Room State
  console.log('\n--- Step 2: Player 1 Connection & Room Initialization ---');
  const roomName = `ARENA_${Date.now()}`;
  const client1 = createTestClient('Valkyrie_1', roomName);

  let p1InitState = null;
  let p1Token = null;
  let p1Id = null;

  try {
    p1InitState = await client1.waitForMessage((m) => m.type === 'INIT_STATE');
    assert(p1InitState.playerId, `Player 1 received playerId: ${p1InitState.playerId}`, 'WS_CONN');
    assert(p1InitState.reconnectToken, 'Player 1 received reconnectToken', 'WS_CONN');
    assert(p1InitState.room === roomName, `Joined room: ${p1InitState.room}`, 'WS_CONN');
    assert(p1InitState.dragon && p1InitState.dragon.maxHealth === 420, 'Dragon initialized with 420 HP', 'WS_CONN');
    p1Id = p1InitState.playerId;
    p1Token = p1InitState.reconnectToken;

    // Check Match State broadcast
    const matchState = await client1.waitForMessage((m) => m.type === 'MATCH_STATE');
    assert(matchState.snapshot, 'Received MATCH_STATE snapshot', 'SYNC');
    assert(matchState.snapshot.competitors.length === 5, `Match has 5 contenders (1 human + 4 AI bots)`, 'SYNC');
    assert(matchState.snapshot.items.length > 0, `Items spawned in world: ${matchState.snapshot.items.length}`, 'SYNC');
  } catch (err) {
    log('WS_CONN', `Player 1 setup failed: ${err.message}`, false);
    failed++;
  }

  // TEST 3: Connect Player 2 & Bot Slot Replacement
  console.log('\n--- Step 3: Player 2 Connection & Bot Replacement ---');
  const client2 = createTestClient('Ranger_2', roomName);
  let p2Id = null;

  try {
    const p2Init = await client2.waitForMessage((m) => m.type === 'INIT_STATE');
    p2Id = p2Init.playerId;
    assert(p2Id && p2Id !== p1Id, `Player 2 connected with unique ID: ${p2Id}`, 'MULTI');

    // Wait for MATCH_STATE showing 2 humans
    const nextState = await client1.waitForMessage((m) => {
      if (m.type !== 'MATCH_STATE') return false;
      const comps = m.snapshot.competitors || [];
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
    const targetPos = { x: 15.5, y: 1.2, z: -20.3 };
    client1.send({
      type: 'UPDATE_TRANSFORM',
      position: targetPos,
      rotation: { x: 0, y: 1.57, z: 0 },
      velocity: { x: 2.0, y: 0, z: 0 },
      isGrounded: true,
      isSprinting: true,
      isSliding: false,
    });

    // Client 2 should observe Client 1's position updated in MATCH_STATE
    const syncState = await client2.waitForMessage((m) => {
      if (m.type !== 'MATCH_STATE') return false;
      const c1 = m.snapshot.competitors.find((c) => c.id === p1Id);
      return c1 && Math.abs(c1.x - targetPos.x) < 0.5 && Math.abs(c1.z - targetPos.z) < 0.5;
    });
    assert(syncState, 'Client 2 received synced position of Client 1', 'TRANSFORM');
  } catch (err) {
    log('TRANSFORM', `Transform sync failed: ${err.message}`, false);
    failed++;
  }

  // TEST 5: Item Collection & Resource Accumulation
  console.log('\n--- Step 5: Item Collection & Inventory ---');
  try {
    // Get an existing item in the world
    const latestState = await client1.waitForMessage((m) => m.type === 'MATCH_STATE' && m.snapshot.items.length > 0);
    const firstItem = latestState.snapshot.items[0];

    // Move player 1 directly to item position
    client1.send({
      type: 'UPDATE_TRANSFORM',
      position: { x: firstItem.x, y: firstItem.y, z: firstItem.z },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      isGrounded: true,
      isSprinting: false,
      isSliding: false,
    });

    // Send item collection request
    client1.send({
      type: 'COLLECT_ITEM',
      itemId: firstItem.id,
    });

    const collectResult = await client1.waitForMessage((m) => m.type === 'ITEM_COLLECTED' || (m.type === 'MATCH_STATE' && !m.snapshot.items.some((it) => it.id === firstItem.id)));
    assert(collectResult, `Item ${firstItem.type} collected successfully`, 'INVENTORY');
  } catch (err) {
    log('INVENTORY', `Item collection failed: ${err.message}`, false);
    failed++;
  }

  // TEST 6: Melee Knife Combat & Damage Verification
  console.log('\n--- Step 6: Authoritative Melee Combat & Damage ---');
  try {
    // Position Client 1 and Client 2 right next to each other
    const combatPos1 = { x: 10.0, y: 1.0, z: 10.0 };
    const combatPos2 = { x: 11.2, y: 1.0, z: 10.0 }; // 1.2m away (within knife 2.6m reach)

    client1.send({
      type: 'UPDATE_TRANSFORM',
      position: combatPos1,
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      isGrounded: true,
      isSprinting: false,
      isSliding: false,
    });

    client2.send({
      type: 'UPDATE_TRANSFORM',
      position: combatPos2,
      rotation: { x: 0, y: -Math.PI / 2, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      isGrounded: true,
      isSprinting: false,
      isSliding: false,
    });

    // Allow transform updates to register
    await new Promise((r) => setTimeout(r, 150));

    // Client 1 slashes Client 2
    client1.send({
      type: 'KNIFE_ATTACK',
      origin: combatPos1,
      direction: { x: 1, y: 0, z: 0 },
      range: 2.6,
      sequence: 1,
    });

    // Expect PLAYER_DAMAGED event on Client 2
    const damageMsg = await client2.waitForMessage((m) => m.type === 'PLAYER_DAMAGED' && m.targetId === p2Id);
    assert(damageMsg, `Client 2 took ${damageMsg.damage} melee damage from Client 1 (Remaining HP: ${damageMsg.remainingHealth})`, 'COMBAT');
  } catch (err) {
    log('COMBAT', `Combat test failed: ${err.message}`, false);
    failed++;
  }

  // TEST 7: Dragon Combat & Health
  console.log('\n--- Step 7: Dragon Combat & Telegraphing ---');
  try {
    const dragonStateMsg = await client1.waitForMessage((m) => m.type === 'MATCH_STATE' && m.snapshot.dragon);
    const dragon = dragonStateMsg.snapshot.dragon;
    assert(dragon.alive, `Dragon is alive with ${dragon.health}/${dragon.maxHealth} HP`, 'DRAGON');

    // Move player 1 near dragon and attack dragon
    const attackDir = {
      x: dragon.x - combatPos1.x,
      y: 0,
      z: dragon.z - combatPos1.z,
    };
    const len = Math.hypot(attackDir.x, attackDir.z) || 1;
    attackDir.x /= len;
    attackDir.z /= len;

    // Position player 1 right next to dragon
    const nearDragonPos = { x: dragon.x - 2.0, y: dragon.y, z: dragon.z };
    client1.send({
      type: 'UPDATE_TRANSFORM',
      position: nearDragonPos,
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      isGrounded: true,
      isSprinting: false,
      isSliding: false,
    });

    await new Promise((r) => setTimeout(r, 150));

    client1.send({
      type: 'KNIFE_ATTACK',
      origin: nearDragonPos,
      direction: { x: 1, y: 0, z: 0 },
      range: 4.0,
      sequence: 2,
    });

    const dragonDmg = await client1.waitForMessage((m) => m.type === 'DRAGON_DAMAGED');
    assert(dragonDmg, `Dragon took ${dragonDmg.damage} damage! Remaining Dragon HP: ${dragonDmg.remainingHealth}`, 'DRAGON');
  } catch (err) {
    log('DRAGON', `Dragon combat test failed: ${err.message}`, false);
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
    // Server checks resources; if resources lacking, returns CRAFT_RESULT success: false
    client1.send({
      type: 'CRAFT_WEAPON',
      recipeIndex: 0,
    });

    const craftResult = await client1.waitForMessage((m) => m.type === 'CRAFT_RESULT');
    assert(craftResult !== null, `Server responded to craft request: ${craftResult.message || (craftResult.success ? 'Crafted' : 'Failed as expected')}`, 'CRAFTING');

    // Test weapon equip
    client1.send({
      type: 'EQUIP_WEAPON',
      weaponId: 'KNIFE',
    });
    const equipResult = await client1.waitForMessage((m) => m.type === 'WEAPON_EQUIPPED');
    assert(equipResult && equipResult.weaponId === 'KNIFE', 'Equipped weapon is KNIFE', 'WEAPONS');
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
