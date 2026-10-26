# AetherBound: Magical Survival & 3-Tier Dragon Hunt
**Game Type**: Multiplayer free-for-all magical action survival (PvPvE)  
**Target Platforms**: PC (Desktop Browser) & Mobile (Touch Virtual Controls)  
**Target Environment**: 3D procedural open world with biomes, natural resources, and elemental threats  
**Core Loop**: Players spawn with a basic magic stick, scavenge natural resources into a backpack to craft advanced staves, offensive spells, and magical ground traps, and battle through 3 tiers of escalating mobs culminating in the 1-minute aerial/grounded Dragon boss.

---

## Game Overview & Vision

A high-stakes magical survival battleground set in a dangerous, procedurally generated world. Every player begins equipped with a single **Apprentice Magic Stick** capable of firing basic arcane sparks. Contenders explore the biomes, gather natural resources (Elder Wood, Arcane Quartz, Ember Ore, Moon Herb, and Elemental Essences), store them in their **Backpack**, and craft superior staves, offensive spells, and tactical magical ground traps.

The HUD quick-bar provides a streamlined **Toggle Bar** strictly holding **1 equipped stick** and **7 active powers**.

### Match Progression & 3-Tier Mob System:
1. **Tier 1 (Basic Mob — Aqua Fiend)**: Active from the match start; roams waterways and groves casting simple water attacks and yielding water drops.
2. **Tier 2 (Intermediate Mob — Flame Brute)**: Arrives after the initial escalation timer (90s); unleashes fiery blasts inflicting an authoritative **3-second Burn After-Effect** (DoT).
3. **Tier 3 (Final Boss — The Dragon / Ashwing Drake)**: The roaming calamity of the arena. Operates on a strict **1-Minute Flight / 25-Second Ground Landing Cycle**:
   - Attacks from the skies for 60 seconds (aerial breath sweeps, dive attacks).
   - Lands on the ground for 25 seconds with an impact shockwave, allowing players to lay magical ground traps under its claws and unleash heavy spell barrages.

---

## 7-Phase Implementation Roadmap

### Phase 1: Data Contracts & State Architecture [COMPLETED ✓]
- [x] Defined `MAGIC_STICKS`, `MAGIC_POWERS`, `TRAP_DEFINITIONS`, and `MOB_SYSTEM_CONFIG` in `combat.js` with query helper functions (`getStickDefinition`, `getPowerDefinition`, `getTrapDefinition`, `isStick`, `isPower`, `isTrap`).
- [x] Defined natural resources (`ELDER_WOOD`, `ARCANE_QUARTZ`, `EMBER_ORE`, `MOON_HERB`, `AETHER_ESSENCE`, `RIVER_DEW`, `BLAZING_CINDER`) in `world.js` along with `NATURAL_RESOURCES` export, `RESOURCE_YIELDS`, and `isNaturalResource(id)`.
- [x] Extended server and client player states with `equippedStick`, `powerSlots` (7 slots), `backpack` (`sticks`, `powers`, `resources`), and active `statusEffects` (with server-side DoT burn ticks, client visual overlays in `DamageOverlay.jsx`, and status pill badges).
- [x] Implemented network message synchronization (`EQUIP_STICK`, `SET_POWER_SLOT`, `USE_POWER_SLOT`, `STICK_EQUIPPED`, `POWER_SLOT_CHANGED`, `STATUS_EFFECT_APPLIED`) and verified with 23 passing automated tests.

### Phase 2: Starting Magic Stick, Projectile Mechanics & Natural Resources [COMPLETED ✓]
- [x] Replaced knife/dagger starting loadout with the **Apprentice Wand** (`🪄`) 3D model with golden ferrule & cyan aether gem attached to player character's right hand.
- [x] Implemented authoritative magic projectile casting (`MAGIC_BOLT_CAST`, `WEAPON_FIRED`, basic arcane spark comet trails, and impact particle bursts).
- [x] Replaced industrial scrap/crate pickups with 3D natural resource nodes (Elder Wood logs, Arcane Quartz geodes, Ember Ore basalt, Moon Herbs, Blazing Cinder, River Dew) with colored vertical beacon beams.
- [x] Implemented interactive harvesting animations, particle burst effects, audio chime, and real-time synchronization with player backpack resources.
- [x] Verified full browser functionality via automated subagent browser tests with zero runtime errors.

### Phase 3: Backpack Inventory & 8-Slot Toggle Bar (1 Stick + 7 Powers) [COMPLETED ✓]
- [x] Designed and built the **Arcane Backpack & Grimoire Modal** (`src/components/BackpackModal.jsx`):
  - 4-tabbed storage: Hotbar Loadout, Sticks & Staves, Spells & Traps, and Raw Materials.
  - Full drag-and-drop & click-to-assign slot management with slot swapping and audio cues.
- [x] Overhauled `EquipmentToggleBar.jsx` into the strict **1 Stick + 7 Powers** layout:
  - Left slot: Current Magic Stick (Key `1`).
  - Next 7 slots: Active Powers & Traps with hotkey dual-badges (`2`–`8` / `Q`, `E`, `R`, `F`, `Z`, `X`, `V`).
  - Real-time radial conic-gradient cooldown sweeps, ready glows, and direct hotbar slot swapping.
- [x] Fixed modal unmount and unmemoized state sync (`RoleSelectModal` unmount during matches, single-source engine state updates) eliminating React loop lockups.
- [x] Verified full browser functionality and all 30 automated test suite checks passing with zero errors.

### Phase 4: Arcane Crafting System & Ground Magical Traps [COMPLETED ✓]
- [x] Overhauled `CraftingModal.jsx` into the **Arcane Spell & Stick Altar**:
  - Top natural resource tracker bar (Elder Wood, Quartz, Ember Ore, Moon Herb, Essences).
  - Categorized recipe tabs: Staves, Powers & Spells, and Magical Traps.
  - Requirement counters (`owned / required`) with color-coded badge states.
  - Instant crafting with audio chime, backpack addition, and auto-closing options.
- [x] Implemented the **Magical Trap Placement System** (`GameEngine.js` & `server.js`):
  - Live ground preview ring projected onto terrain 12m ahead with rotating arcane runes.
  - LMB placement sends `DEPLOY_TRAP`, RMB or `Escape` cancels targeting.
  - 1.0s authoritative arming delay with pulsating rune rings.
  - Authoritative server collision detection for traps triggering on rival players, mobs, and grounded dragon paws.
  - Detonation VFX: `spawnFrostCageVFX` (6-pillar ice prison), `spawnFlameEruptionVFX` (fire blast), and `spawnGravityVortexVFX`.
  - Authoritative status effect application: Frost freeze (stun), Arcane slow, and Flame explosion (32 DMG + 3s burn DoT at 6 DMG/s).
- [x] Verified via browser subagent tests and automated test suite (40/40 passed).

### Phase 5: 3-Tier Mob System — Level 1 Water Mob & Level 2 Fire Mob [COMPLETED ✓]
- [x] **Tier 1 Mob (Aqua Fiend)**:
  - Server-side AI state machine (Spawn, Patrol/Wander, Aggro Chase within 24m, Shoot Water Bolt).
  - Client-side 3D fluid translucent water elemental mesh with 4 orbiting water droplets, cyan aether pointlight, and 3D billboard health nameplate.
  - Water spit projectile tracers with particle splashes and impact sounds.
- [x] **Tier 2 Mob (Flame Brute)**:
  - Match escalation spawning trigger at 90s (`MOB_ESCALATION` announcement broadcast).
  - Client-side faceted obsidian volcanic golem with magma spikes, basalt horns, pulsating core light, and health nameplate.
  - Authoritative flame projectile attack with 3-Second Burn After-Effect (`BURN` status effect with 1000ms tick intervals, 6 DMG/s DoT).
  - Client HUD visual burn effects: animated orange ember vignette (`#damage-overlay.burning`), status pill badge (`🔥 Burning`), and damage flashes.

### Phase 6: Dragon 1-Minute Aerial Combat & Ground Landing Vulnerability [COMPLETED]
- **60s Aerial / 25s Grounded Cycle (`server.js`)**:
  - `dragon.flightPhase`: Dynamic switching between `'AERIAL'` (60s) and `'GROUNDED'` (25s) with altitude interpolation (+14m cruising, +0.6m landed).
  - 3-second prior warning telegraph on ground (`DRAGON_LANDING_TELEGRAPH`) with countdown.
  - Landing touchdown impact shockwave (crushes all contenders within 8.5m for 20 dmg).
  - Multi-attack specialization: Aerial uses `FIRE_BREATH` (52m cone, 34 dmg); Grounded uses `TAIL_SWEEP` (360-degree sweep, 22 dmg) and `GROUND_SLAM` (9m radius stomp, 28 dmg).
  - 1.25x damage multiplier when grounded; Frost Traps freeze/stun dragon for 3.0s, Flame Sigils deal 50 bonus damage.
- **3D Visuals, Skeletal Animations & HUD (`GameEngine.js`, `TopHud.jsx`, `hud.css`)**:
  - Glowing red/orange warning ring & disc decal on terrain during 3s landing telegraph.
  - GlTF animations: `'fly_loop'` while airborne, `'idle_loop'`/`'walk_loop'` while grounded, `'takeoff'` upon ascent, `'roar'`/`'bite'` during attacks.
  - Ground impact explosion VFX and camera shake.
  - HUD boss flight badge with glowing gold/orange status when grounded.
- Verified with **40/40 tests passing** in `scripts/test_game.js` and 0 build errors.

### Phase 7: Mobile Touch Dual Controls, Procedural Audio Polish & Final Verification [COMPLETED]
- [x] **Mobile Touch Action Pad Polish (`MobileActionPad.jsx`, `hud.css`)**:
  - Dedicated 1-tap thumb buttons for `🎒 BAG` and `✨ ALTAR` directly in the mobile cluster.
  - Contextual `💥 PLACE` and `❌ CANCEL` touch buttons during magical trap targeting.
  - Main action button with `SPARK` indicator and cooldown display for starter apprentice wand and crafted staves.
  - Horizontal touch scrolling and responsive spacing for the 8-slot hotbar on mobile viewports.
- [x] **Synthesized Procedural Audio Engine (`audio.js`)**:
  - Web Audio API procedural synthesis: `playArcaneSpark()` (spark woosh), `playWingsFlap()` (resonant flight gust), `playDragonRoar()` (sawtooth roar), `playBurnTick()` (sizzle hiss), `playFrostFreeze()`, `playFlameExplosion()`, `playGravityVortex()`.
  - Zero external audio files needed (<100MB download size, zero network audio latency, zero GC allocations).
- [x] **Cross-Platform Verification & Performance**:
  - Seamless dual controls: PC Keyboard (WASD, 1-8 number keys, B, C, LMB/RMB) and Mobile Touch (virtual joystick, touch look zone, action pad).
  - Automated test suite `scripts/test_game.js` verified with **45/45 tests passing**.
  - Production Next.js Turbopack build compiled with **zero errors**.
  - All 7 implementation phases are now **100% complete and fully verified**.
