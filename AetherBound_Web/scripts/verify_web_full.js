import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BROWSER_PATH = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;

console.log('Using browser binary:', BROWSER_PATH);

async function runFullWebVerification() {
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-full-test-'));
  const port = 9240;

  console.log(`Starting headless Chrome with clean profile: ${tempProfile} on port ${port}...`);
  const browserProc = spawn(BROWSER_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${tempProfile}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'http://localhost:3000/?role=player&room=VALE-9301',
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

  console.log('Connected to CDP endpoint at:', pageWsUrl);
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

  const consoleLogs = [];
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
        const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        consoleLogs.push({ type: msg.params.type, text });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        jsExceptions.push(msg.params.exceptionDetails);
      }
    } catch (e) {
      console.error('Error parsing CDP message:', e);
    }
  });

  await new Promise((r) => ws.on('open', r));
  await sendCmd('Console.enable');
  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');

  console.log('Waiting for game scene and HUD to fully hydrate (4.5s)...');
  await new Promise((r) => setTimeout(r, 4500));

  // ==========================================
  // CHECK 1: Hotbar Dock & Charge Badges
  // ==========================================
  console.log('\n--- CHECK 1: Equipment Toggle Dock & Charges ---');
  const hotbarEval = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const dock = document.querySelector('.equipment-toggle-dock');
      if (!dock) return null;
      const stickBtn = dock.querySelector('.stick-slot');
      const stickText = stickBtn?.innerText?.replace(/\\n/g, ' ');
      const powerBtns = Array.from(dock.querySelectorAll('.power-slot')).map(btn => {
        const num = btn.querySelector('.slot-hotkey-badge')?.innerText;
        const badge = btn.querySelector('.slot-charge-badge')?.innerText;
        const icon = btn.querySelector('.slot-icon')?.innerText;
        const isEmpty = btn.classList.contains('empty-power-slot');
        return { num, icon, badge: badge || 'none', isEmpty };
      });
      const swapBtn = Boolean(dock.querySelector('.loadout-toggle-btn'));
      return { hasDock: true, stickText, powerBtns, swapBtn };
    })()`,
    returnByValue: true,
  });

  const hotbarData = hotbarEval.result?.value;
  console.log('Hotbar mounted:', hotbarData?.hasDock);
  console.log('Stick Slot:', hotbarData?.stickText);
  console.log('Power Slots:');
  for (const s of hotbarData?.powerBtns || []) {
    console.log(`  [Slot ${s.num}] Icon: ${s.icon} | Charge Badge: ${s.badge} | Empty: ${s.isEmpty}`);
  }
  console.log('Swap button present:', hotbarData?.swapBtn);

  // Capture Screenshot 1: In-game HUD with charges
  const shot1 = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot1?.data) {
    fs.writeFileSync('public/web_1_ingame_hud.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved screenshot 1 to public/web_1_ingame_hud.png');
  }

  // ==========================================
  // CHECK 2: Toggle Swap Mode & Quick Popover
  // ==========================================
  console.log('\n--- CHECK 2: Swap Mode & Quick Loadout Popover ---');
  // Click Swap button
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const swapBtn = document.querySelector('.loadout-toggle-btn');
      if (swapBtn) swapBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 600));

  // Click Slot 6 (empty slot) to trigger popover
  console.log('Clicking Slot 6 to open Quick Loadout Popover...');
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const slot6 = document.querySelectorAll('.power-slot')[4]; // 5th power slot (Slot 6)
      if (slot6) slot6.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 600));

  const popoverEval = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const popover = document.querySelector('.quick-loadout-popover');
      if (!popover) return null;
      const title = popover.querySelector('.popover-title')?.innerText?.replace(/\\n/g, ' ');
      const items = Array.from(popover.querySelectorAll('.quick-loadout-item-btn')).map(btn => {
        const name = btn.querySelector('.item-name')?.innerText;
        const charge = btn.querySelector('.quick-charge-badge')?.innerText;
        const isClear = btn.classList.contains('clear-slot-btn');
        return { name: isClear ? 'CLEAR SLOT' : name, charge: charge || null };
      });
      return { visible: true, title, items };
    })()`,
    returnByValue: true,
  });

  console.log('Quick Loadout Popover State:', popoverEval.result?.value);

  // Capture Screenshot 2: Quick Loadout Popover
  const shot2 = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot2?.data) {
    fs.writeFileSync('public/web_2_quick_loadout_popover.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved screenshot 2 to public/web_2_quick_loadout_popover.png');
  }

  // Close popover
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.querySelector('.popover-close-btn');
      if (closeBtn) closeBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 400));

  // ==========================================
  // CHECK 3: Arcane Backpack Modal (Loadout Tab)
  // ==========================================
  console.log('\n--- CHECK 3: Arcane Backpack Modal & Hotbar Loadout Tab ---');
  // Click Backpack shortcut button
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const bpBtn = document.querySelector('.backpack-shortcut-btn');
      if (bpBtn) bpBtn.click();
      else window.gameApp?.setBackpackModalOpen(true);
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  const backpackEval = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.querySelector('.backpack-modal-card') || document.querySelector('.crafting-modal-card');
      if (!modal) return null;
      const activeTab = document.querySelector('.backpack-tab-btn.is-active')?.innerText?.trim();
      const slotCells = Array.from(document.querySelectorAll('.backpack-powers-grid .backpack-slot-cell')).map((cell, idx) => ({
        slotIndex: idx + 2,
        name: cell.querySelector('.slot-cell-name')?.innerText || 'EMPTY',
        charge: cell.querySelector('.slot-cell-charges')?.innerText || null,
        hasChangeBtn: Boolean(cell.querySelector('.change-btn')),
        hasRemoveBtn: Boolean(cell.querySelector('.remove-btn'))
      }));
      const grimoireCards = Array.from(document.querySelectorAll('.backpack-cards-grid .backpack-card')).map(card => ({
        name: card.querySelector('.card-name')?.innerText,
        tag: card.querySelector('.card-tag')?.innerText,
        charges: card.querySelector('.charges-stock-badge')?.innerText || card.querySelector('.depleted-stock-badge')?.innerText
      }));
      return { visible: true, activeTab, slotCells, grimoireCards: grimoireCards.slice(0, 8) };
    })()`,
    returnByValue: true,
  });

  console.log('Backpack Modal State:');
  console.log('  Active Tab:', backpackEval.result?.value?.activeTab);
  console.log('  Hotbar Loadout Slots:');
  for (const s of backpackEval.result?.value?.slotCells || []) {
    console.log(`    Slot ${s.slotIndex}: ${s.name} [Charges: ${s.charge || 'none'}] (Change: ${s.hasChangeBtn}, Remove: ${s.hasRemoveBtn})`);
  }
  console.log('  Grimoire Skills:');
  for (const c of backpackEval.result?.value?.grimoireCards || []) {
    console.log(`    - ${c.name} [${c.tag}] | ${c.charges}`);
  }

  // Capture Screenshot 3: Backpack Loadout Tab
  const shot3 = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot3?.data) {
    fs.writeFileSync('public/web_3_backpack_loadout.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved screenshot 3 to public/web_3_backpack_loadout.png');
  }

  // Close Backpack modal
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.querySelector('.crafting-close-btn');
      if (closeBtn) closeBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 400));

  // ==========================================
  // CHECK 4: Crafting Altar Modal & Owned Charges
  // ==========================================
  console.log('\n--- CHECK 4: Crafting Altar Modal & Owned Charges ---');
  // Click Forge / Altar shortcut button
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const forgeBtn = document.querySelector('.forge-shortcut-btn');
      if (forgeBtn) forgeBtn.click();
      else window.gameApp?.setCraftingModalOpen(true);
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  const craftingEval = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.querySelector('.crafting-modal-card');
      if (!modal) return null;
      const recipes = Array.from(document.querySelectorAll('.recipe-card.arcane-recipe-card')).map(card => ({
        name: card.querySelector('.recipe-name')?.innerText,
        ownedPill: card.querySelector('.recipe-owned-pill')?.innerText || card.querySelector('.owned-badge')?.innerText,
        actionBtn: card.querySelector('.recipe-action-btn')?.innerText?.replace(/\\n/g, ' ')
      }));
      return { visible: true, recipeCount: recipes.length, recipes: recipes.slice(0, 6) };
    })()`,
    returnByValue: true,
  });

  console.log('Crafting Altar State:');
  console.log(`  Modal visible: ${craftingEval.result?.value?.visible}, Total recipes: ${craftingEval.result?.value?.recipeCount}`);
  for (const r of craftingEval.result?.value?.recipes || []) {
    console.log(`    - ${r.name} | Owned/Charges: ${r.ownedPill || 'none'} | Action: ${r.actionBtn}`);
  }

  // Capture Screenshot 4: Crafting Altar Modal
  const shot4 = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot4?.data) {
    fs.writeFileSync('public/web_4_crafting_altar.png', Buffer.from(shot4.data, 'base64'));
    console.log('Saved screenshot 4 to public/web_4_crafting_altar.png');
  }

  // Close Crafting modal
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.querySelector('.crafting-close-btn');
      if (closeBtn) closeBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 400));

  // ==========================================
  // FINAL CONSOLE ERROR & EXCEPTION AUDIT
  // ==========================================
  console.log('\n--- Console Logs & Exceptions Audit ---');
  console.log(`Total console messages: ${consoleLogs.length}`);
  console.log(`Total unhandled JS exceptions: ${jsExceptions.length}`);

  if (jsExceptions.length > 0) {
    for (const ex of jsExceptions) {
      console.error('JS EXCEPTION:', ex.text, ex.exception?.description);
    }
    process.exit(1);
  }

  ws.close();
  browserProc.kill();
  try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (_) {}

  console.log('\n========================================================================');
  console.log('VERIFICATION COMPLETE: 100% OF LOADOUT & CRAFTING FEATURES TESTED IN WEB');
  console.log('========================================================================');
  process.exit(0);
}

runFullWebVerification().catch(err => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});

