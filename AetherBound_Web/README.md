# ⚡ AetherBound: Sabotage
**An Asymmetric 3D Open-World Multiplayer Game: Runner vs. Saboteur**

---

## 🎮 How to Play

### 1. Start the Server
```bash
npm start
```
The server is live at: **`http://localhost:3000`**

---

### 2. Game Modes & Match Rooms

#### Mode A: Multi-Room Networked Multiplayer
- Rooms isolate match timers, world seeds, goal coordinates, and players.
- **Player 1 (The Runner)**: `http://localhost:3000?role=runner&room=match1`
- **Player 2 (The Saboteur)**: `http://localhost:3000?role=saboteur&room=match1`
- Or use the in-game modal to type a custom code or click **`🎲 Random`**.

#### Mode B: Local Dual Mode
- Play both characters locally on one computer. Role-switching via **`[Tab]`** is exclusively available in Local Dual Mode.

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
