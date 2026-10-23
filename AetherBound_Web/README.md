# ⚡ AetherBound: Sabotage
**An Asymmetric 3D Open-World Multiplayer Game: Runner vs. Saboteur**

---

## 🎮 How to Play

### 1. Start the Game Locally
Run the Next.js frontend and WebSocket game server in separate terminals:
```bash
npm run dev
```
The game is available at **`http://localhost:3001`**. Start the multiplayer server with `npm run server` in the other terminal; it listens on port `3000`.

---

### 2. Game Modes & Match Rooms

#### Mode A: Multi-Room Networked Multiplayer
- Rooms isolate match timers, world seeds, goal coordinates, and players.
- **Player 1 (The Runner)**: `http://localhost:3001?role=runner&room=match1`
- **Player 2 (The Saboteur)**: `http://localhost:3001?role=saboteur&room=match1`
- Or use the in-game modal to type a custom code or click **`🎲 Random`**.

#### Mode B: Local Dual Mode
- Play both characters locally on one computer. Role-switching via **`[Tab]`** is exclusively available in Local Dual Mode.

#### Match End & Restart
- After the results screen, the game returns to role selection while keeping the multiplayer connection open.
- After a match ends, both players return to the role lobby and the room resets for a fresh match. Extra players wait in the lobby until a role opens; there is no spectator role.
- Choose an available role in the same room to start a fresh round. If that role is occupied, select the other role or enter another room.

---

## 🚀 Deploy to Vercel

The frontend is a Next.js App Router app. In Vercel, set the project **Root Directory** to `AetherBound_Web`; use the default Next.js framework preset and `npm run build` as the build command.

The multiplayer server uses persistent WebSocket connections and must be deployed separately on a Node.js host that supports WebSockets (for example, Render or Railway). Deploy the `server/` service with the repository root set to `AetherBound_Web` and the start command `npm run server`. The server uses the host-provided `PORT`.

In the Vercel project settings, set this environment variable to the public secure WebSocket URL of that server, then redeploy:

```text
NEXT_PUBLIC_GAME_SERVER_URL=wss://your-game-server.example.com
```

Local development defaults to `ws://localhost:3000`. Local Dual mode does not require the multiplayer server. Vercel serverless functions do not host this stateful WebSocket server.

---

## 🕹️ Characters & Controls

### 🏃 The Runner
The Runner possesses **only** Runner abilities. All Saboteur tools, energy meters, and hotbars are disabled and hidden.
| Control | Action |
|---|---|
| **Fixed Aim Reticle** | Center reticle locks aim direction; mouse cursor hidden during play |
| **Esc** | Unlock & display standard mouse cursor (Click screen to re-lock) |
| **Mouse / Touchpad** | Rotate POV horizontally left and right |
| **W / S / A / D** | Move forward, backpedal, and strafe relative to facing direction |
| **Ctrl / C** (While Moving) | **Power Slide**: Low profile (0.9m) + 35% speed burst + dust trail |
| **Space** (Near low obstacle) | **Dynamic Vault**: Automatically mantle over obstacles (0.7m–2.3m height) |
| **Space** (Open terrain) | Normal Jump |
| **Shift** (Hold) | Sprint (Consumes Stamina) |
| **F** | Snap aim direction toward Beacon Goal |
| **C** | Look Behind (spin 180°) |
| **HUD Compass & Distance** | Real-time vector and distance meter to Beacon Goal |

#### Field Crafting
Gather visible resources as the Runner to add them to your inventory, then use the **FIELD CRAFTING** panel to craft and activate items when needed. Resource types are tied to biomes: Ironwood and Moon Herb in Lush areas, Ember Ore and Aether Essence in Desert areas, Aether Essence and Moon Herb in Snow areas, and Ember Ore and Ironwood in Volcanic areas.

| Crafted item | Ingredients | Effect |
|---|---|---|
| **Windrunner Boots** | 1 Aether Essence + 1 Ironwood | +60% speed for 6 seconds |
| **Springstep Boots** | 1 Ironwood + 1 Moon Herb | Powerful jumps for 8 seconds |
| **Aether Ward** | 1 Aether Essence + 1 Ember Ore | Blocks one hazard hit |
| **Vitality Draught** | 1 Aether Essence + 2 Moon Herbs | Restores 30 health |

#### Mobile Controls
Play in landscape for the full touch layout. On a phone, tap **TRY LANDSCAPE** on the portrait prompt; browsers that support the Screen Orientation API will enter fullscreen and request landscape. If the browser or device blocks orientation locking, enable Auto-rotate and turn the phone manually. For browsers that support installed web apps, add AetherBound to your home screen to use the landscape app orientation declared in its web manifest. Use the left virtual joystick to move, drag the right side of the screen to aim, and use the on-screen action buttons to sprint, jump, slide, and turn. The Runner's **CRAFT** button opens the recipe list. The Saboteur can select hazards from the hotbar, then use **PLACE** and **45°** to build the gauntlet.

🏆 **Instant Victory**: The moment you step into the Beacon Goal platform, victory triggers immediately with celebration fireworks and win audio!

---

### 🦹‍♂️ The Saboteur (3D Character)
The Saboteur is a tangible 3D cyber-operative character visible in the world, equipped with dark carbon armor, glowing orange ocular visor, dual shoulder jetpack thrusters, and a holographic projector gauntlet.
| Control | Action |
|---|---|
| **W / A / S / D** | Pilot Saboteur character with hover-glide thrusters across hills |
| **Mouse Wheel** | Adjust tactical camera distance (9m–26m) and height (5m–16m) |
| **1, 2, 3, 4, 5** | Select hazard from hotbar (Wall, Mud, Spikes, Boulder, Barrel) |
| **R** or **Right Click** | Rotate obstacle orientation by 45° |
| **Left Click** | Deploy obstacle at targeted terrain within 75m range |
| **F / Space** | **Orbital Recon Pulse**: Emits radar wave and reveals Runner silhouette through obstacles for 6s |
| **Tactical Energy** | 100 max energy, regenerates +6/sec |

⚠️ **Goal Sanctuary**: Obstacles strictly forbidden within 20m of the Beacon Goal.
⚠️ **Casting Range**: The Saboteur must be within 75m of the placement location.

#### Tactical Obstacles Roster:
1. **Barrier Wall** (25 ⚡): Concrete roadblock (100 HP, destructible by boulders and explosions).
2. **Mud Trap** (20 ⚡): Sticky hazard slowing Runner by 65%.
3. **Spikes** (35 ⚡): Sharp barricade inflicting knockback.
4. **Boulder** (40 ⚡): Heavy physics sphere rolling downhill, crushing barrels and cracking walls!
5. **Explosive Barrel** (45 ⚡): Volatile container detonating on Runner proximity (< 2.5m) or boulder impact, with 9m blast radius, 26 knockback impulse, and chain reactions!
