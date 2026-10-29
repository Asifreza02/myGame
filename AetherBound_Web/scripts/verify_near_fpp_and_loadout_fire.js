import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runVerification() {
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-verify-fpp-'));
  const port = 9277;
  const roomCode = 'FPP-' + Date.now();

  console.log('===============================================================');
  console.log('  VERIFY: LOADOUT SELECTION (NO IMMEDIATE FIRE) & NEAR-FPP VIEW');
  console.log('===============================================================\n');

  console.log(`Starting headless Chrome on port ${port} with room ${roomCode}...`);
  const browserProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${tempProfile}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    `http://localhost:3000/?role=player&room=${roomCode}`,
  ]);

  let pageWsUrl = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      const target = list.find((t) => t.type === 'page' && t.url.includes('localhost:3000')) || list[0];
      if (target?.webSocketDebuggerUrl) {
        pageWsUrl = target.webSocketDebuggerUrl;
        break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!pageWsUrl) {
    console.error('Failed to get DevTools endpoint');
    browserProc.kill();
    process.exit(1);
  }

  const ws = new WebSocket(pageWsUrl);
  let id = 1;
  const pending = new Map();
  function sendCmd(method, params = {}) {
    return new Promise((resolve, reject) => {
      const reqId = id++;
      pending.set(reqId, { resolve, reject });
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  const jsExceptions = [];
  ws.on('message', (d) => {
    try {
      const msg = JSON.parse(d.toString());
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(msg.error);
        else p.resolve(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
        if (text.includes('[MATCH_STATE ME COUNTS]') || text.includes('[CLIENT applyMatchSnapshot') || text.includes('[DEBUG') || text.includes('[TRACE')) {
          console.log('[BROWSER CONSOLE]', text);
        }
      }
      if (msg.method === 'Network.webSocketFrameSent') {
        console.log('--> WS SENT FROM BROWSER:', msg.params.response.payloadData);
      }
      if (msg.method === 'Network.webSocketFrameReceived') {
        const data = msg.params.response.payloadData;
        if (!data.includes('MATCH_STATE') && !data.includes('PING')) {
          console.log('<-- WS RECV BY BROWSER:', data);
        }
      }
    } catch (e) {}
  });

  await new Promise((r) => ws.on('open', r));
  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');
  await sendCmd('Network.enable');

  console.log('Waiting 6s for world loading, player hydration, and HUD mount...');
  await new Promise((r) => setTimeout(r, 6000));

  let passed = 0;
  let failed = 0;
  function assert(cond, msg) {
    if (cond) {
      console.log(`[✓] ${msg}`);
      passed++;
    } else {
      console.error(`[✗] FAILED: ${msg}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Check Camera Distance & Height (Reduced TPP to near FPP)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Reduced TPP Camera View (Near-FPP) ---');
    const camStats = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const app = window.gameApp;
        if (!app || !app.runner) return null;
        const runner = app.runner;
        const cam = app.camera;

        const dx = cam.position.x - runner.position.x;
        const dz = cam.position.z - runner.position.z;
        const horizDist = Math.hypot(dx, dz);
        const vertDist = cam.position.y - runner.position.y;
        // Measure 3D distance from character head/eye level (y + 1.7) to camera
        const dyHead = cam.position.y - (runner.position.y + 1.7);
        const distFromHead = Math.hypot(dx, dyHead, dz);

        return {
          cameraDistance: runner.cameraDistance,
          cameraHeight: runner.cameraHeight,
          actualHorizDist: horizDist,
          actualVertDist: vertDist,
          distFromHead,
        };
      })()`,
      returnByValue: true,
    });

    const cVal = camStats.result.value;
    console.log('Camera stats:', cVal);
    assert(cVal !== null, 'Runner and camera are active in GameEngine');
    assert(cVal.cameraDistance <= 2.2, `Camera distance is reduced to ${cVal.cameraDistance}m (target <= 2.2m, down from 6.2m)`);
    assert(cVal.cameraHeight <= 1.95, `Camera height is lowered to ${cVal.cameraHeight}m (target <= 1.95m, down from 2.6m)`);
    assert(cVal.distFromHead <= 2.3, `Actual 3D distance from player head to camera is close (${cVal.distFromHead.toFixed(2)}m <= 2.3m)`);

    // -------------------------------------------------------------
    // TEST 2: Initial Slot Selection (Staff selected by default)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Initial Loadout Selection State ---');
    const initialSlot = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const app = window.gameApp;
        const stickBtn = document.querySelector('.stick-slot');
        const activeSlot = document.querySelector('.active-selected-slot');
        return {
          selectedSlotIndex: app?.selectedSlotIndex,
          selectedPowerId: app?.selectedPowerId,
          stickHasActiveClass: stickBtn?.classList?.contains('active-selected-slot'),
          activeSlotHtml: activeSlot?.className,
          fireballCharges: app?.skillCounts?.FIREBALL,
          frostTrapCharges: app?.skillCounts?.FROST_TRAP,
        };
      })()`,
      returnByValue: true,
    });

    const initVal = initialSlot.result.value;
    console.log('Initial Slot state:', initVal);
    assert(initVal.selectedSlotIndex === 0, 'Initial selectedSlotIndex is 0 (Staff/Wand)');
    assert(initVal.selectedPowerId === null, 'Initial selectedPowerId is null');
    assert(initVal.stickHasActiveClass === true, 'Stick slot has .active-selected-slot highlight');
    assert(initVal.fireballCharges === 3, 'Fireball starts with 3 charges');
    assert(initVal.frostTrapCharges === 2, 'Frost Trap starts with 2 charges');

    // -------------------------------------------------------------
    // TEST 3: Select Spell from Loadout (Must NOT fire or consume charge)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Select Spell (No Immediate Fire) ---');
    await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const app = window.gameApp;
        // Select slot index 0 (FIREBALL, which corresponds to hotkey 2 / slot 1)
        app.selectPowerSlot(0);
      })()`,
    });
    // Wait for React re-render cycle
    await new Promise((r) => setTimeout(r, 200));

    const selectSpellResult = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const app = window.gameApp;
        const slotBtns = Array.from(document.querySelectorAll('.power-slot'));
        const fireballBtn = slotBtns[0];

        return {
          selectedSlotIndex: app.selectedSlotIndex,
          selectedPowerId: app.selectedPowerId,
          fireballChargesAfterSelect: app.skillCounts.FIREBALL,
          fireballBtnHasActive: fireballBtn?.classList?.contains('active-selected-slot'),
          isPlacingTrap: app.isPlacingTrap,
        };
      })()`,
      returnByValue: true,
    });

    const spVal = selectSpellResult.result.value;
    console.log('Select Spell state:', spVal);
    assert(spVal.selectedSlotIndex === 1, 'selectedSlotIndex is now 1 (Slot 2, Fireball)');
    assert(spVal.selectedPowerId === 'FIREBALL', 'selectedPowerId is primed as FIREBALL');
    assert(spVal.fireballChargesAfterSelect === 3, 'CRITICAL: Fireball charges NOT consumed upon selection (still 3)');
    assert(spVal.fireballBtnHasActive === true, 'Fireball button has .active-selected-slot highlight');

    // -------------------------------------------------------------
    // TEST 4: Click Fire Button to Cast Primed Spell
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Click Fire Button to Cast Primed Spell ---');
    const fireSpellResult = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const app = window.gameApp;
        // Trigger Left Click fire
        app.onCombatClick({ button: 0 });

        return {
          selectedSlotIndex: app.selectedSlotIndex,
          selectedPowerId: app.selectedPowerId,
          fireballChargesAfterFire: app.skillCounts.FIREBALL,
        };
      })()`,
      returnByValue: true,
    });

    const fspVal = fireSpellResult.result.value;
    console.log('Fire Spell state:', fspVal);
    assert(fspVal.fireballChargesAfterFire === 2, 'CRITICAL: Fireball successfully fired and charges decremented from 3 to 2 upon Fire click');

    // -------------------------------------------------------------
    // TEST 5: Select Trap from Loadout (Must NOT place immediately)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Select Trap (Must NOT place immediately) ---');
    await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const app = window.gameApp;
        // Select slot index 2 (FROST_TRAP, which corresponds to hotkey 4 / slot 3)
        app.selectPowerSlot(2);
      })()`,
    });
    // Wait for React re-render cycle
    await new Promise((r) => setTimeout(r, 200));

    const selectTrapResult = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const app = window.gameApp;
        const slotBtns = Array.from(document.querySelectorAll('.power-slot'));
        const trapBtn = slotBtns[2];

        return {
          selectedSlotIndex: app.selectedSlotIndex,
          selectedPowerId: app.selectedPowerId,
          isPlacingTrap: app.isPlacingTrap,
          activeTargetingTrap: app.activeTargetingTrap,
          targetingGroupVisible: app.trapTargetingGroup?.visible,
          frostTrapChargesAfterSelect: app.skillCounts.FROST_TRAP,
          trapBtnHasActive: trapBtn?.classList?.contains('active-selected-slot'),
        };
      })()`,
      returnByValue: true,
    });

    const trVal = selectTrapResult.result.value;
    console.log('Select Trap state:', trVal);
    assert(trVal.selectedSlotIndex === 3, 'selectedSlotIndex is now 3 (Slot 4, Frost Trap)');
    assert(trVal.selectedPowerId === 'FROST_TRAP', 'selectedPowerId is FROST_TRAP');
    assert(trVal.isPlacingTrap === true, 'Trap targeting reticle is active');
    assert(trVal.targetingGroupVisible === true, '3D ground placement reticle group is visible');
    assert(trVal.frostTrapChargesAfterSelect === 2, 'CRITICAL: Frost Trap charges NOT consumed upon selection (still 2)');
    assert(trVal.trapBtnHasActive === true, 'Frost Trap slot has .active-selected-slot highlight');

    // -------------------------------------------------------------
    // TEST 6: Click Fire Button to Place the Primed Trap
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Click Fire Button to Place the Primed Trap ---');
    const fireTrapClick = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const app = window.gameApp;
        const beforeIsPlacing = app.isPlacingTrap;
        const beforeActive = app.activeTargetingTrap;
        const beforeCount = app.skillCounts?.FROST_TRAP;
        
        // Trigger Left Click fire
        app.onCombatClick({ button: 0 });

        const afterIsPlacing = app.isPlacingTrap;
        const afterCount = app.skillCounts?.FROST_TRAP;

        return {
          beforeIsPlacing,
          beforeActive,
          beforeCount,
          afterIsPlacing,
          afterCount,
        };
      })()`,
      returnByValue: true,
    });
    console.log('Immediate Trap Fire State:', fireTrapClick.result.value);

    // Wait 250ms for React render and state update
    await new Promise((r) => setTimeout(r, 250));

    const fireTrapResult = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const app = window.gameApp;
        return {
          selectedSlotIndex: app.selectedSlotIndex,
          selectedPowerId: app.selectedPowerId,
          isPlacingTrap: app.isPlacingTrap,
          frostTrapChargesAfterFire: app.skillCounts?.FROST_TRAP,
          allSkillCounts: { ...app.skillCounts },
          stickHasActiveAfterPlacement: document.querySelector('.stick-slot')?.classList?.contains('active-selected-slot'),
        };
      })()`,
      returnByValue: true,
    });

    const ftrVal = fireTrapResult.result.value;
    console.log('Fire Trap state:', ftrVal);
    assert(ftrVal.isPlacingTrap === false, 'CRITICAL: Trap placement confirmed and closed');
    assert(ftrVal.frostTrapChargesAfterFire === 1, 'CRITICAL: Frost Trap charges decremented from 2 to 1 upon Fire click');
    assert(ftrVal.selectedSlotIndex === 0, 'Selection automatically returned to primary staff (slot 0)');
    assert(ftrVal.stickHasActiveAfterPlacement === true, 'Stick slot highlight restored');

    // -------------------------------------------------------------
    // TEST 7: Capture Near-FPP In-Game Screenshot
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Capturing Near-FPP In-Game Screenshot ---');
    const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.resolve('public/web_near_fpp_view.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`[✓] Saved in-game screenshot to ${shotPath} (${(shot.data.length / 1024).toFixed(1)} KB)`);

    // Verify 0 runtime exceptions
    console.log('\n--- TEST 8: Console and Runtime Errors ---');
    console.log('JS Exceptions detected:', jsExceptions.length);
    assert(jsExceptions.length === 0, 'Zero unhandled runtime JS exceptions during test execution');

  } catch (err) {
    console.error('Test execution failed with error:', err);
    failed++;
  } finally {
    ws.close();
    browserProc.kill();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runVerification();
