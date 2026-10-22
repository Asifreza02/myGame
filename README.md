# ⚡ AetherBound: Sabotage (Project Monorepo)

This repository contains two complete implementations of **AetherBound: Sabotage**:

```
myGame/
├── 🌐 AetherBound_Web/     # WebGL 3D Browser Multiplayer (Three.js + React + Node.js)
└── 📱 AetherBound_Unity/   # Mobile 3D Game (Unity 6 + URP + Touch Controls + C#)
```

---

## 📱 1. `AetherBound_Unity` (Mobile Game)
A mobile-optimized 3D action game built with **Unity 6** and the **Universal Render Pipeline (URP)** for enhanced graphics, native 60 FPS performance, and touchscreen controls.

### Features
- **URP 17.6**: Dynamic mobile render scaling (0.8x), soft shadows, single-pass batching.
- **Mobile Touch Controls**: Dual-touch layout with floating virtual joystick (left) and swipe look zone (right).
- **Procedural Multi-Biome Open World**: Infinite chunk streaming with Lush, Desert, Snow, and Volcanic biomes.
- **Asymmetric Gameplay**:
  - **Runner**: 3D third-person controller, sprint, power slide (0.9m low-profile burst), dynamic vaulting (0.7m–2.3m mantling), stamina, and health.
  - **Saboteur**: Tactical energy system, 5-slot obstacle hotbar, 45° rotation, 75m range limit, 20m goal sanctuary restriction, and Orbital Recon Pulse.
  - **AI Saboteur**: Intelligent AI for solo Runner mode that flanks and deploys obstacles ahead of the player.
- **Tactical Obstacles**: Destructible Barrier Walls (100 HP), Tar Mud Traps (65% slow), Spike Barricades (knockback & damage), Rolling Boulders (physics Rigidbody), and Explosive Barrels (proximity mine & chain reactions).
- **Turnkey Setup**: Open [`Assets/Scenes/AetherBound_Main.unity`](AetherBound_Unity/Assets/Scenes/AetherBound_Main.unity) and press **Play**.

### How to Run in Unity
1. Open **Unity Hub** -> Click **Add** -> **Add project from disk**.
2. Select `C:\Users\Dell\OneDrive\Desktop\myGame\AetherBound_Unity`.
3. Open with **Unity 6 (6000.6.6f1)**.
4. Load `Assets/Scenes/AetherBound_Main.unity` and click **Play**.

---

## 🌐 2. `AetherBound_Web` (Web Game)
The original open-world browser multiplayer game built with Three.js, React, Vite, and Node.js WebSocket networking.

### How to Run
```bash
cd AetherBound_Web
npm install
npm start
```
The game server starts at: `http://localhost:3000`
