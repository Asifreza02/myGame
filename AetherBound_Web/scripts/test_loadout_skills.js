import { WebSocket } from 'ws';
import { MAGIC_POWERS, ARCANE_CRAFTING_RECIPES } from '../src/game/data/combat.js';

const WS_URL = 'ws://localhost:3001';

function log(section, msg, ok = true) {
  const icon = ok ? '✓' : '✗';
  console.log(`[${icon}] [${section}] ${msg}`);
}

async function runLoadoutTests() {
  console.log('========================================================');
  console.log('   SKILL COUNT, LOADOUT REMOVAL & CHANGE TEST SUITE     ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, section = 'LOADOUT_TEST') {
    if (condition) {
      log(section, message, true);
      passed++;
    } else {
      log(section, message, false);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  function createClient(name) {
    const url = new URL(WS_URL);
    url.searchParams.set('room', 'test-loadout-' + Date.now());
    url.searchParams.set('role', 'player');
    url.searchParams.set('name', name);

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
        console.error('JSON parse err:', e);
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
        try { ws.close(); } catch (_) {}
      },
    };
  }

  try {
    const client = createClient('HeroMage');

    // 1. Connection & Initial Skill Counts
    const initState = await client.waitForMessage((m) => m.type === 'INIT_STATE');
    assert(initState && initState.playerId, `Client connected and got playerId: ${initState.playerId}`, 'INIT');

    const player = initState.snapshot.players.find((p) => p.id === initState.playerId);
    assert(player !== undefined, 'Found player in state snapshot', 'INIT');
    assert(player.skillCounts !== undefined, 'Player has skillCounts object', 'INIT');
    assert(typeof player.skillCounts.FIREBALL === 'number' && player.skillCounts.FIREBALL > 0, `Player starts with Fireball charges (${player.skillCounts.FIREBALL})`, 'INIT');
    assert(player.powerSlots.includes('FIREBALL'), 'Fireball is in initial loadout (powerSlots)', 'INIT');
    assert(player.skillCounts.AEGIS_WARD === 0, 'Uncrafted skill Aegis Ward starts with 0 charges', 'INIT');
    assert(!player.powerSlots.includes('AEGIS_WARD'), 'Uncrafted skill Aegis Ward is not in initial loadout', 'INIT');

    // 2. Test Zero Count Skill Cannot Be Equipped
    console.log('\n--- Step 2: Zero Count Skill Cannot be Equipped into Loadout ---');
    client.send({
      type: 'SET_POWER_SLOT',
      slotIndex: 4,
      powerId: 'AEGIS_WARD',
    });
    const equipFail1 = await client.waitForNextMessage((m) => m.type === 'EQUIP_FAILED');
    assert(equipFail1 !== null && equipFail1.reason.includes('Zero count'), 'Server rejected equipping zero-count skill into loadout', 'ZERO_COUNT_PREVENT');

    // 3. Test Option to Change Items in Loadout
    console.log('\n--- Step 3: Change Items in Loadout ---');
    // Change slot 4 to REJUVENATION (which has charges > 0)
    client.send({
      type: 'SET_POWER_SLOT',
      slotIndex: 4,
      powerId: 'REJUVENATION',
    });
    const slotChange1 = await client.waitForNextMessage((m) => m.type === 'POWER_SLOT_CHANGED' && m.slotIndex === 4);
    assert(slotChange1.powerSlots[4] === 'REJUVENATION', 'Slot 4 successfully set to REJUVENATION', 'LOADOUT_CHANGE');

    // Clear slot 4 (Unequip item)
    client.send({
      type: 'SET_POWER_SLOT',
      slotIndex: 4,
      powerId: null,
    });
    const slotChange2 = await client.waitForNextMessage((m) => m.type === 'POWER_SLOT_CHANGED' && m.slotIndex === 4);
    assert(slotChange2.powerSlots[4] === null, 'Slot 4 successfully cleared (unequipped)', 'LOADOUT_CHANGE');

    // Change equipped primary weapon / stick in slot 1
    client.send({
      type: 'EQUIP_STICK',
      stickId: 'APPRENTICE_STICK',
    });
    const stickEquip = await client.waitForNextMessage((m) => m.type === 'STICK_EQUIPPED');
    assert(stickEquip.stickId === 'APPRENTICE_STICK', 'Successfully swapped equipped staff in slot 1', 'LOADOUT_CHANGE');

    // 4. Test Crafting Any Skill Adds to Loadout with Its Count
    console.log('\n--- Step 4: Craft Skill & Add to Loadout with Count ---');
    // Channel altar once to get 2 Arcane Quartz + 2 Aether Essence (combined with 1+2 starting = 3 Quartz, 4 Essence)
    client.send({ type: 'CHANNEL_ALTAR_ESSENCE' });
    await client.waitForNextMessage((m) => m.type === 'CRAFT_RESULT');

    // Craft LIGHTNING_BOLT (Spell) which has count 0 and is not in starter loadout
    const lightningRecipeIndex = ARCANE_CRAFTING_RECIPES.findIndex((r) => r.powerId === 'LIGHTNING_BOLT');
    client.send({
      type: 'CRAFT_WEAPON',
      recipeIndex: lightningRecipeIndex,
    });
    const craftEvent1 = await client.waitForNextMessage((m) => m.type === 'WEAPON_CRAFTED' && m.powerId === 'LIGHTNING_BOLT');
    assert(craftEvent1 !== null, 'Lightning Lance forged at Arcane Altar', 'CRAFT_SKILL');
    assert(craftEvent1.skillCounts && craftEvent1.skillCounts.LIGHTNING_BOLT === 1, 'Crafted skill has count = 1', 'CRAFT_SKILL');
    assert(craftEvent1.powerSlots.includes('LIGHTNING_BOLT'), 'Crafted skill was AUTOMATICALLY ADDED TO LOADOUT with count 1', 'CRAFT_SKILL');

    // Craft another charge of LIGHTNING_BOLT (we have enough Quartz & Essence from Altar!)
    client.send({
      type: 'CRAFT_WEAPON',
      recipeIndex: lightningRecipeIndex,
    });
    const craftEvent2 = await client.waitForNextMessage((m) => m.type === 'WEAPON_CRAFTED' && m.powerId === 'LIGHTNING_BOLT');
    assert(craftEvent2.skillCounts.LIGHTNING_BOLT === 2, 'Crafting skill again incremented its count to 2 in loadout', 'CRAFT_SKILL');

    // 5. Test Crafting Aegis Ward & Using It To Zero Charges
    console.log('\n--- Step 5: Craft Skill & Deplete Charges to 0 ---');
    // Wait for Altar cooldown to channel again if needed
    await new Promise((r) => setTimeout(r, 4200));
    client.send({ type: 'CHANNEL_ALTAR_ESSENCE' });
    await client.waitForNextMessage((m) => m.type === 'CRAFT_RESULT');

    const aegisRecipeIndex = ARCANE_CRAFTING_RECIPES.findIndex((r) => r.powerId === 'AEGIS_WARD');
    client.send({
      type: 'CRAFT_WEAPON',
      recipeIndex: aegisRecipeIndex,
    });
    const craftAegis = await client.waitForNextMessage((m) => m.type === 'WEAPON_CRAFTED' && m.powerId === 'AEGIS_WARD');
    assert(craftAegis !== null, 'Aegis Ward crafted at Altar', 'CRAFT_SKILL');
    assert(craftAegis.skillCounts.AEGIS_WARD === 1, 'Aegis Ward crafted with count = 1', 'CRAFT_SKILL');
    assert(craftAegis.powerSlots.includes('AEGIS_WARD'), 'Aegis Ward automatically added to loadout', 'CRAFT_SKILL');

    // Cast Aegis Ward (1 charge -> count becomes 0!)
    client.send({
      type: 'CAST_SPELL',
      powerId: 'AEGIS_WARD',
      origin: { x: player.x, y: player.y + 1, z: player.z },
      direction: { x: 0, y: 1, z: 0 },
    });
    const countChange = await client.waitForNextMessage((m) => m.type === 'SKILL_COUNT_CHANGED' && m.powerId === 'AEGIS_WARD');
    assert(countChange.remainingCount === 0, 'Aegis Ward charges dropped from 1 to 0', 'ZERO_COUNT_REMOVAL');

    // Verify it was automatically removed from loadout in powerSlots
    assert(!countChange.powerSlots.includes('AEGIS_WARD'), 'Aegis Ward was AUTOMATICALLY REMOVED from loadout on zero count', 'ZERO_COUNT_REMOVAL');

    // 6. Verify zero-count skill cannot be re-equipped
    console.log('\n--- Step 6: Verify Depleted Skill Cannot be Equipped ---');
    client.send({
      type: 'SET_POWER_SLOT',
      slotIndex: 1,
      powerId: 'AEGIS_WARD',
    });
    const equipFail2 = await client.waitForNextMessage((m) => m.type === 'EQUIP_FAILED');
    assert(equipFail2 !== null && equipFail2.reason.includes('Zero count'), 'Depleted skill blocked from being equipped into loadout', 'ZERO_COUNT_PREVENT');

    client.close();
    console.log('\n========================================================');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('========================================================');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runLoadoutTests();
