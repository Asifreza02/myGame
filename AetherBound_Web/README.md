# AetherBound: 5-Player Multi-Competitor Survival & Dragon Hunt

A multiplayer 5-player free-for-all action survival game built with Next.js, Three.js, and an authoritative Node.js WebSocket server.

## 5-Player Free-for-All Competition

- **Max 5 Contenders**: Each game room supports up to 5 simultaneous competitors fighting for survival.
- **Rival AI Bots**: Rooms automatically fill with intelligent AI survivor bots up to the 5-player limit if fewer human players are present (or configurable to humans-only). As human players connect, they take over bot slots!
- **Color-Coded Contenders**: Each player is assigned a distinct signature color and runic aura ring (Cyan, Crimson, Gold, Violet, Emerald).
- **Overhead Health Bars & Nameplates**: Competitors have dynamic, real-time floating health bars showing remaining HP and state.
- **Live Leaderboard & Standings**: An in-game 5-player standings widget tracks remaining survivors, health, and elimination counts in real time.
- **Live Killfeed**: Instant elimination notifications pop up when competitors slash rivals or fall to the world/dragon.
- **Dual Victory Paths**:
  1. **Last Contender Standing**: Eliminate all 4 rival contenders to become the sole survivor.
  2. **Dragon Slayer**: Strike down the mighty roaming dragon before rivals do.

## Run locally

Start the game server and web app:

```bash
npm run server
npm run dev
```

The web app runs at `http://localhost:3000`; the game server listens on port `3001`. Set `PORT` to change the server port, and set `NEXT_PUBLIC_GAME_SERVER_URL` in the web app environment when the server runs elsewhere.

## Join a match

1. Enter your **Survivor Name** and choose a **Match Room** code (or click **NEW** for a random room).
2. Share the room code with up to 4 friends to play together in the same 5-player match.
3. Or click **QUICK PLAY** to instantly join an active 5-player lobby!

## Collectibles & Weapon Crafting System

Collect raw materials, titanium scrap, and crystals scattered across the biomes, open the **Aetherian Weapon Forge** (Hotkey `C` or click `FORGE`), and craft devastating firearms to blast rivals and hunt the dragon:

### 1. Collectible Resources
- 🔩 **Titanium Scrap**: Industrial alloy parts & Kenney supply crates scattered in desert and ruins.
- 💎 **Crystal Lens**: Rare prismatic refraction crystals found in the snowy mountain ridges.
- ⚡ **Energy Cell**: High-charge plasma power cylinders located near volcanic fissures.
- 🪵 **Ironwood**: Dense timber gathered from lush forests.
- 🪨 **Ember Ore**: Geothermal mineral chunks mined from the volcanic badlands.
- 🔹 **Aether Essence**: Pure ambient energy orbs floating throughout the valley.
- 🌿 **Moon Herb**: Healing flora found across tundra fields.
- All seven pickups use locally bundled, CC0 Kenney 3D models, with color accents to distinguish materials; the game does not fetch models from a third-party host at runtime.

### 2. Craftable Firearms (CC0 Kenney 3D Blaster Kit)
- 🔫 **Aether Blaster Pistol** (`blaster-smg.glb`):
  - *Recipe*: 1x Titanium Scrap + 1x Ember Ore
  - *Stats*: 24 Damage · 50m Range · 16 Rounds
- ⚡ **Combat Assault Blaster** (`blaster-rifle.glb`):
  - *Recipe*: 2x Titanium Scrap + 2x Ironwood + 1x Ember Ore
  - *Stats*: 19 Damage · 70m Range · 30 Rounds (Rapid Fire)
- 💠 **Prismatic Laser Cannon** (`blaster-rifle.glb` with chromatic lens):
  - *Recipe*: 1x Crystal Lens + 2x Aether Essence + 1x Energy Cell
  - *Stats*: 42 Damage · 95m Range · 15 Charges (Instant piercing beam)
- 💣 **Heavy Plasma Mortar** (`blaster-heavy.glb`):
  - *Recipe*: 2x Energy Cell + 2x Ember Ore + 2x Titanium Scrap
  - *Stats*: 60 Damage + 6.5m Splash Radius · 55m Range · 8 Rounds
- 🔋 **Blaster Energy Pack (+20 Rounds)**:
  - *Recipe*: 1x Ember Ore + 1x Aether Essence
- ✨ **Prismatic Cell Pack (+12 Charges)**:
  - *Recipe*: 1x Energy Cell + 1x Aether Essence

### 3. Combat Mechanics
- **3D Weapon Rigging**: Hand-attached 3D blasters on character bones with realistic firing recoil and procedural audio synthesis.
- **Visual FX**: Real-time laser beam cylinders, energetic plasma spheres, and glowing tracer bolts with impact sparks.
- **Authoritative Raycast & Splash Damage**: Server computes line-of-sight raycasts and explosive radius damage against all 5 competitors and the dragon.
- **Weapon Switching**: Use keys `1`–`5` or HUD weapon buttons to swap between your Knife and crafted blasters.

## Controls

- **WASD** / Arrow keys to move, **Space** to jump or vault, **Ctrl** to slide, and **Shift** to sprint.
- **C** or **B** key or click **FORGE** button on HUD to toggle the Aetherian Weapon Forge modal.
- **1–5** Number keys or weapon switcher bar to change active weapons.
- **Left Click** to shoot equipped firearm or swing dagger.
- The mobile action pad includes touch virtual joystick, touch look zone, and dedicated attack button.

## Match rules

The authoritative WebSocket server validates positions, speeds, melee combat range, hit detection, damage, item pickups, and eliminations. Matches have no time limit and end when one survivor remains, the dragon is defeated, or all contenders are eliminated. The dragon roams passively for the first 3 minutes, then escalates through three stronger phases at 3-minute intervals. Eliminated players automatically spectate living contenders until the match ends.

The playable world is bounded to a 1,000-meter radius from the center.
