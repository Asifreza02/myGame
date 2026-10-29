import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function verifyPlayerAndDragonHud() {
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-verify-hud-'));
  const port = 9265;

  console.log(`Starting headless Chrome on port ${port}...`);
  const browserProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${tempProfile}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'http://localhost:3000/?role=player&room=VALE-7721',
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
      if (msg.method === 'Runtime.exceptionThrown') {
        jsExceptions.push(msg.params.exceptionDetails);
      }
    } catch (e) {}
  });

  await new Promise((r) => ws.on('open', r));
  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');

  console.log('Waiting 6s for world loading, player hydration, and HUD mount...');
  await new Promise((r) => setTimeout(r, 6000));

  // ============================================================
  // CHECK 1: Cinematic Dragon Boss Health Bar in HUD & 3D Sprite
  // ============================================================
  console.log('\n--- CHECK 1: Dragon Boss Health Bar in Player HUD ---');
  const hudCheck = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const bossBar = document.querySelector('.boss-health-bar-container');
      const bossTitle = document.querySelector('.boss-name-group .boss-title')?.innerText?.trim();
      const bossBadge = document.querySelector('.boss-flight-badge')?.innerText?.trim();
      const bossHp = document.querySelector('.boss-hp-numbers')?.innerText?.trim();
      const fillEl = document.querySelector('.boss-health-fill');
      const fillStyleWidth = fillEl?.style?.width;

      const app = window.gameApp;
      const dragon3dSprite = app?.dragonNameplate?.sprite?.visible;
      const dragonHp = app?.dragonState?.health;
      const dragonMaxHp = app?.dragonState?.maxHealth;

      return {
        hasBossBarInDom: Boolean(bossBar),
        bossTitle,
        bossBadge,
        bossHp,
        fillStyleWidth,
        dragon3dSpriteVisible: Boolean(dragon3dSprite),
        dragonState: { health: dragonHp, maxHealth: dragonMaxHp },
      };
    })()`,
    returnByValue: true,
  });

  const hudData = hudCheck.result?.value;
  console.log('HUD Boss Bar Present:', hudData?.hasBossBarInDom);
  console.log('Boss Title:', hudData?.bossTitle);
  console.log('Flight Badge:', hudData?.bossBadge);
  console.log('Boss HP Display:', hudData?.bossHp);
  console.log('Boss Health Fill Width:', hudData?.fillStyleWidth);
  console.log('3D Overhead Dragon Sprite Visible:', hudData?.dragon3dSpriteVisible);

  // ============================================================
  // CHECK 2: Player Breaking & Shaking Stability
  // ============================================================
  console.log('\n--- CHECK 2: Player Breaking & Shaking Diagnostics ---');
  const stabilityEval = await sendCmd('Runtime.evaluate', {
    expression: `new Promise((resolve) => {
      const app = window.gameApp;
      if (!app || !app.runner) return resolve({ error: 'No runner' });
      const r = app.runner;

      const samples = [];
      let count = 0;
      function record() {
        // Wait until initial spawn height lands on terrain ground
        if (!r.isGrounded) {
          requestAnimationFrame(record);
          return;
        }
        if (count++ < 30) {
          samples.push({
            py: r.position.y,
            camY: app.camera.position.y,
            vy: r.velocity.y,
            isGrounded: r.isGrounded,
            actionKey: r.animator?.activeKey,
            poseRotZ: r.animator?.poseRoot?.rotation?.z ?? 0,
            hasDamageFlash: Boolean(app.damageFlash && Date.now() - app.damageFlash < 500),
          });
          requestAnimationFrame(record);
        } else {
          // Check variance
          const pyVals = samples.map(s => s.py);
          const camYVals = samples.map(s => s.camY);
          const pyMin = Math.min(...pyVals);
          const pyMax = Math.max(...pyVals);
          const camYMin = Math.min(...camYVals);
          const camYMax = Math.max(...camYVals);

          const actions = [...new Set(samples.map(s => s.actionKey))];
          const anyDamageFlash = samples.some(s => s.hasDamageFlash);

          resolve({
            frameCount: samples.length,
            samplesSummary: samples.map((s, idx) => '[' + idx + '] py=' + s.py.toFixed(3) + ' camY=' + s.camY.toFixed(3) + ' vy=' + s.vy.toFixed(3) + ' g=' + s.isGrounded + ' key=' + s.actionKey),
            pyVariance: Number((pyMax - pyMin).toFixed(5)),
            camYVariance: Number((camYMax - camYMin).toFixed(5)),
            actionsObserved: actions,
            currentHealth: r.health,
            anyDamageFlash,
            sampleStart: samples[0],
            sampleEnd: samples[samples.length - 1],
          });
        }
      }
      requestAnimationFrame(record);
    })`,
    awaitPromise: true,
    returnByValue: true,
  });

  const stabData = stabilityEval.result?.value;
  console.log('Frames Sampled:', stabData?.frameCount);
  console.log('Samples summary:\n', stabData?.samplesSummary?.join('\n'));
  console.log('Position Y Variance (Target: 0.00000):', stabData?.pyVariance);
  console.log('Camera Y Variance (Target: < 0.05):', stabData?.camYVariance);
  console.log('Animation Actions Observed:', stabData?.actionsObserved);
  console.log('Player Current Health:', stabData?.currentHealth);
  console.log('Taking Immediate Damage / Flashing at Spawn:', stabData?.anyDamageFlash);

  // Capture final screenshot showing the fixed player and the dragon health bar
  const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot?.data) {
    fs.writeFileSync('public/web_player_and_dragon_hud.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved screenshot to public/web_player_and_dragon_hud.png');
  }

  // ============================================================
  // AUDIT & ASSERTIONS
  // ============================================================
  console.log('\n--- Final Verification Audit ---');
  let passed = true;

  if (!hudData?.hasBossBarInDom) {
    console.error('FAILED: Dragon Boss Bar not found in HUD DOM.');
    passed = false;
  } else {
    console.log('[PASS] Dragon Boss Bar mounted in HUD');
  }

  if (!hudData?.bossTitle || !hudData.bossTitle.includes('IGNIS')) {
    console.error('FAILED: Dragon Boss Title missing or incorrect.');
    passed = false;
  } else {
    console.log(`[PASS] Dragon Boss Title: "${hudData.bossTitle}"`);
  }

  if (!hudData?.dragon3dSpriteVisible) {
    console.error('FAILED: 3D Dragon overhead sprite is not visible.');
    passed = false;
  } else {
    console.log('[PASS] 3D Dragon overhead nameplate and health bar sprite visible in world space');
  }

  if (stabData?.pyVariance > 0.001) {
    console.error(`FAILED: Player position Y is jittering (variance: ${stabData.pyVariance}).`);
    passed = false;
  } else {
    console.log(`[PASS] Player vertical stability: variance ${stabData?.pyVariance}m (rock solid)`);
  }

  if (stabData?.actionsObserved?.includes('jump')) {
    console.error('FAILED: Character falsely triggered jump animation while stationary.');
    passed = false;
  } else {
    console.log('[PASS] Animation stability: pure idle locomotion, no false jumping');
  }

  if (jsExceptions.length > 0) {
    console.error(`FAILED: ${jsExceptions.length} JavaScript exceptions.`);
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
  console.log('SUCCESS: PLAYER SHAKING FIXED & DRAGON HEALTHBAR VISIBLE TO PLAYER');
  console.log('========================================================================');
  process.exit(0);
}

verifyPlayerAndDragonHud().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
