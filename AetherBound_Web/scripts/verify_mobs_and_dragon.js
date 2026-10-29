import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BROWSER_PATH = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;

console.log('Using browser binary:', BROWSER_PATH);

async function verifyMobsAndDragon() {
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-mob-dragon-'));
  const port = 9250;

  console.log(`Starting headless Chrome on port ${port}...`);
  const browserProc = spawn(BROWSER_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${tempProfile}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'http://localhost:3000/?role=player&room=VALE-7721',
  ]);

  browserProc.on('error', (err) => console.error('Browser spawn error:', err));

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
    console.error('FAILED: Unable to connect to Chrome DevTools endpoint');
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
      if (msg.method === 'Runtime.exceptionThrown') {
        jsExceptions.push(msg.params.exceptionDetails);
      }
    } catch (e) {}
  });

  await new Promise((r) => ws.on('open', r));
  await sendCmd('Console.enable');
  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');

  console.log('Waiting 6s for match connection, 3D zombie models, and dragon synchronization...');
  await new Promise((r) => setTimeout(r, 6000));

  // ============================================================
  // CHECK 1: Active Mobs in Combat Arena & Proximity to Player
  // ============================================================
  console.log('\n--- CHECK 1: Active Mobs in Combat Arena ---');
  const mobEval = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const app = window.gameApp;
      if (!app) return null;
      const playerPos = app.runner ? { x: app.runner.position.x, y: app.runner.position.y, z: app.runner.position.z } : null;
      const mobs = Array.from(app.worldMobs ? app.worldMobs.entries() : []).map(([id, group]) => {
        const dist = playerPos ? Math.hypot(group.position.x - playerPos.x, group.position.z - playerPos.z) : null;
        return {
          id,
          name: group.userData?.mob?.name,
          tier: group.userData?.mob?.tier,
          pos: { x: Math.round(group.position.x), z: Math.round(group.position.z) },
          dist: dist ? Math.round(dist) : null,
          visible: group.visible,
          isFallback: group.userData?.isFallback,
        };
      }).sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999));

      const visibleCount = mobs.filter(m => m.visible).length;
      const nearbyCount = mobs.filter(m => m.dist && m.dist <= 60).length;
      const threatRadarText = document.querySelector('.zombie-radar-panel')?.innerText?.trim();

      return {
        totalMobs: mobs.length,
        visibleCount,
        nearbyCount,
        playerPos,
        threatRadarText,
        nearestMobs: mobs.slice(0, 8),
      };
    })()`,
    returnByValue: true,
  });

  const mobData = mobEval.result?.value;
  console.log('Total Mobs in World:', mobData?.totalMobs);
  console.log('Visible Mobs (within 160m):', mobData?.visibleCount);
  console.log('Close-Range Mobs (within 60m):', mobData?.nearbyCount);
  console.log('Player Spawn Position:', mobData?.playerPos);
  console.log('HUD Threat Radar:', mobData?.threatRadarText || 'None');
  console.log('Nearest Mobs:');
  for (const m of mobData?.nearestMobs || []) {
    console.log(`  - [${m.name}] ${m.dist}m away at (${m.pos.x}, ${m.pos.z}) | Visible: ${m.visible} | Fallback: ${m.isFallback}`);
  }

  // Capture Screenshot of Arena Mobs
  const shot1 = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot1?.data) {
    fs.writeFileSync('public/web_mobs_visible.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved screenshot to public/web_mobs_visible.png');
  }

  // ============================================================
  // CHECK 2: Dragon Position & Frontal Attack Alignment
  // ============================================================
  console.log('\n--- CHECK 2: Dragon Position & Frontal Attack Alignment ---');
  // Wait another 3s for dragon AI tick
  await new Promise((r) => setTimeout(r, 3000));

  const dragonEval = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const app = window.gameApp;
      if (!app) return null;
      const p = app.runner;
      const d = app.dragonMesh;
      if (!p || !d) return null;

      const px = p.position.x;
      const pz = p.position.z;
      const py = p.position.y;
      const dx = d.position.x;
      const dz = d.position.z;
      const dy = d.position.y;

      const horizDist = Math.hypot(dx - px, dz - pz);
      const vertDist = dy - py;

      // Player forward vector (Runner camera forward is -sin(cameraYaw), -cos(cameraYaw))
      const playerYaw = p.cameraYaw !== undefined ? p.cameraYaw : (p.rotationY ?? 0);
      const forwardX = -Math.sin(playerYaw);
      const forwardZ = -Math.cos(playerYaw);

      // Vector from player to dragon
      const toDragonX = horizDist > 0 ? (dx - px) / horizDist : 0;
      const toDragonZ = horizDist > 0 ? (dz - pz) / horizDist : 0;

      // Dot product: > 0 means dragon is in front of the player (in frontal 180-deg hemisphere)
      const dotForward = forwardX * toDragonX + forwardZ * toDragonZ;

      return {
        dragonState: {
          phase: app.dragonState?.phase,
          flightPhase: app.dragonState?.flightPhase,
          altitude: app.dragonState?.altitude,
          alive: app.dragonState?.alive,
          activeAttack: app.dragonState?.attack?.type || null,
        },
        dragonPos: { x: Math.round(dx), y: Number(dy.toFixed(1)), z: Math.round(dz) },
        playerPos: { x: Math.round(px), y: Number(py.toFixed(1)), z: Math.round(pz) },
        horizDist: Number(horizDist.toFixed(1)),
        vertDist: Number(vertDist.toFixed(1)),
        dotForward: Number(dotForward.toFixed(2)),
        isInFront: dotForward > 0,
        notDirectlyOverhead: horizDist >= 10,
      };
    })()`,
    returnByValue: true,
  });

  const dragonData = dragonEval.result?.value;
  console.log('Dragon Flight Phase:', dragonData?.dragonState?.flightPhase);
  console.log('Dragon Altitude above ground:', dragonData?.dragonState?.altitude);
  console.log('Dragon Position:', dragonData?.dragonPos);
  console.log('Player Position:', dragonData?.playerPos);
  console.log(`Horizontal Distance to Player: ${dragonData?.horizDist}m (Expected standoff: ~14-25m, NOT 2.6m overhead)`);
  console.log(`Vertical Height above Player: ${dragonData?.vertDist}m (Expected: ~3.5-5.5m, NOT 14m stratosphere)`);
  console.log(`Alignment Dot Product: ${dragonData?.dotForward} (Positive means in front of player)`);
  console.log('Is Positioned in Front of Player:', dragonData?.isInFront);
  console.log('Not Directly Overhead:', dragonData?.notDirectlyOverhead);

  // Capture Screenshot of Dragon in Front
  const shot2 = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot2?.data) {
    fs.writeFileSync('public/web_dragon_front_attack.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved screenshot to public/web_dragon_front_attack.png');
  }

  // ============================================================
  // AUDIT & ASSERTIONS
  // ============================================================
  console.log('\n--- Final Verification Audit ---');
  let passed = true;

  if (!mobData || mobData.totalMobs < 8) {
    console.error('FAILED: Not enough mobs spawned (expected >= 8).');
    passed = false;
  } else {
    console.log(`[PASS] Mobs Spawned: ${mobData.totalMobs} mobs in match`);
  }

  if (!mobData || mobData.nearbyCount < 2) {
    console.error('FAILED: Not enough close-range mobs near player (expected >= 2 within 60m).');
    passed = false;
  } else {
    console.log(`[PASS] Proximity: ${mobData.nearbyCount} mobs within 60m of player`);
  }

  if (!dragonData || dragonData.horizDist < 10) {
    console.error('FAILED: Dragon is hovering directly above player (horizDist < 10m).');
    passed = false;
  } else {
    console.log(`[PASS] Dragon Standoff Distance: ${dragonData.horizDist}m (safely in front, not overhead)`);
  }

  if (!dragonData || !dragonData.isInFront) {
    console.error('FAILED: Dragon is not positioned in front of the player (dotForward <= 0).');
    passed = false;
  } else {
    console.log(`[PASS] Dragon Frontal Alignment: Dot product ${dragonData.dotForward} (> 0: directly in front of player field of view)`);
  }

  if (jsExceptions.length > 0) {
    console.error(`FAILED: ${jsExceptions.length} unhandled JS exceptions occurred.`);
    passed = false;
  } else {
    console.log('[PASS] Zero JavaScript runtime exceptions');
  }

  ws.close();
  browserProc.kill();
  try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (_) {}

  if (!passed) {
    process.exit(1);
  }

  console.log('\n========================================================================');
  console.log('SUCCESS: MOBS ARE ACTIVE & DRAGON ATTACKS FROM FRONT OF PLAYER');
  console.log('========================================================================');
  process.exit(0);
}

verifyMobsAndDragon().catch(err => {
  console.error('Verification script failed:', err);
  process.exit(1);
});

