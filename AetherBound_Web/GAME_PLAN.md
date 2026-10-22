# Open-World 3D Asymmetric Multiplayer Game: Master Plan
**Title / Working Name**: *AetherBound: Sabotage* (Runner vs. Saboteur)  
**Target Environment**: 3D Procedural Open World  
**Core Mechanics**: Asymmetric Real-Time Objective (Runner must reach the dynamic goal; Saboteur builds/places obstacles to stop them within a time limit).

---

## Game Overview & Vision

An endless, procedurally generated 3D world where two players compete in an asymmetric contest of skill, speed, and strategic placement:
1. **The Runner**: Navigates 3D terrain, jumps across ravines, weaves around obstacles, uses stamina/mobility abilities, and races toward a distant dynamic Beacon Goal before the round timer expires.
2. **The Saboteur**: Commands a bird's-eye / tactical tactical perspective, surveying the Runner's route, spending energy/cooldowns to place physical obstacles, traps, and hazards directly in the Runner's path in real time.
3. **Endless Possibilities**: Built upon a procedural chunk-based infinite terrain generator with seedable biomes, dynamic weather, varying elevations, and emergent obstacles.
4. **Scalable Architecture**: Built with an Entity-Component data-driven architecture to seamlessly expand from 1v1 into 2v2, 1vMany, or 8+ player free-for-all / team asymmetric matches.

---

## 4-Phase Roadmap

### Phase 1: Architecture, Procedural Core & Playable Foundation (Current Phase)
*Goal: Establish system architecture, open-world procedural engine, data-driven entity system, and a playable Phase 1 build.*
- **Procedural Open-World Engine**:
  - Infinite coordinate-based chunk grid system with Perlin/Simplex noise terrain generation.
  - Biome heightmaps, procedural natural props (trees, rocks, cliffs), and dynamic chunk streaming around active players.
- **Dynamic Goal System**:
  - Procedural beacon placement with visual ray/pillar visible across terrain.
  - Distance calculation, compass HUD, and win trigger zone.
- **Asymmetric Role & Control Systems**:
  - **Runner Controller**: 3D Third-person physics controller (movement, jump, sprint, terrain collision, camera orbit).
  - **Saboteur Controller**: Free-cam / tactical orbital camera with terrain raycasting, cursor preview grid, and obstacle placement logic.
- **Obstacle Placement Mechanics**:
  - Placement budget / energy bar that regenerates over time.
  - Core obstacle roster:
    - *Stone Barrier*: High physical wall blocking direct paths.
    - *Tar Pit / Mud Trap*: Slows runner movement speed by 60%.
    - *Spike Trap / Barricade*: Forces runner to find an alternate route or jump cleanly.
    - *Rolling Boulder*: Dynamic physics-based hazard rolling down slopes.
- **Match Loop & State Management**:
  - Round countdown timer (e.g., 90–120s).
  - Win/loss detection: Runner reaches goal = Runner wins; Timer reaches 0 = Saboteur wins.
  - Round restart and procedural seed regeneration.
- **Multiplayer Foundation**:
  - Local Dual-View / Hotseat & Split-Screen mode for instant play on one machine.
  - Node.js WebSocket server architecture for synchronized real-time multi-client sessions.
- **Extensible Data-Driven Framework**:
  - Player roles and obstacle definitions structured as declarative schemas (`RoleDefinition`, `ObstacleDefinition`) for future multi-player expansion.

---

### Phase 2: Gameplay Depth, Physics Simulation & Dedicated Networking
*Goal: Vertical slice enhancement, robust physics, and low-latency multiplayer replication.*
- **Advanced Physics & Traversal**:
  - Dynamic climbing, vaulting, slide mechanics for the Runner.
  - Physics-driven collisions (Cannon-es / Rapier 3D) for rolling obstacles, destructible walls, and explosive barrels.
- **Network Replication Layer**:
  - Authoritative WebSocket / WebRTC server handling player positions, obstacle placement latency compensation, and state synchronization.
  - Room/Lobby creation with unique join codes for two remote players.
- **Enhanced Saboteur Abilities**:
  - Fog of War or Scanner radar to track Runner through valleys.
  - Environmental sabotage (triggering rockslides, collapsing bridges).
- **Audio & Visual Polish**:
  - 3D spatial audio (footsteps, placement sounds, wind, countdown heartbeat).
  - Particle effects for obstacle spawning, dust trails, and goal beacon pulsing.

---

### Phase 3: Open-World Expansion, Procedural Biomes & Emergent Hazards
*Goal: Scale the environment into a truly endless world with varied terrain and emergent dangers.*
- **Procedural Multi-Biome Streaming**:
  - Seamless transitions: Lush Forests, Rocky Canyons, Snowy Peaks, Volcanic Badlands.
  - Infinite chunk LOD (Level of Detail) optimization for high frame rates at long draw distances.
- **Dynamic Neutral World Hazards**:
  - Procedural wildlife (neutral creatures that can be startled toward the runner).
  - Day/night cycle and dynamic weather storms (sandstorms, blizzards) impacting visibility and traction.
- **Runner Power-Ups & Items**:
  - Scattered crystal pick-ups: Speed Boost, Double Jump, Grappling Hook, Wall-Breaker hammer.
- **Persistent Progression & Score**:
  - Match history, best times, evasion score for Runners, obstacle efficiency rating for Saboteurs.

---

### Phase 4: Multiplayer Scaling & Modding SDK
*Goal: Evolve from 1v1 into 2-8+ player asymmetric team modes and user-generated content.*
- **New Player Roles & Team Compositions**:
  - *The Guardian (Player 3)*: Runs alongside the Runner, able to smash obstacles or shield the Runner.
  - *The Trapper (Player 4)*: Works with the Saboteur, setting hidden tripwires and sensor mines.
  - *The Scout*: High-mobility observer revealing paths or disarming traps.
  - *2v2 Mode*: 2 Runners vs. 2 Saboteurs with combined objectives.
  - *Many vs. 1*: 4 Runners racing to survive against 1 Master Saboteur.
- **Custom Game Modes**:
  - *Relay Race*: Multiple checkpoints across endless terrain.
  - *Territory Control*: Runners must capture 3 beacons while Saboteurs defend.
- **Community Modding & Custom Obstacle API**:
  - JSON-based obstacle editor allowing custom models, hitboxes, and script triggers.
  - Custom map seed sharing and community challenge boards.

---

## Technical Stack & Architecture

- **Rendering Engine**: Three.js (WebGL / WebGPU) for fast, responsive 3D in the browser.
- **Physics Engine**: Cannon-es (lightweight 3D rigid-body physics) for terrain collision, player kinematics, and obstacle hitboxes.
- **Backend / Networking**: Node.js + WebSocket (`ws`) for server-authoritative state sync, room matchmaking, and multi-client communication.
- **Terrain Generation**: 2D Simplex/Perlin noise with octaves, persistence, and chunk grid indexing `(cx, cz)`.
- **UI & HUD**: Modern lightweight overlay with health/stamina, timer countdown, obstacle placement hotbar, mini-map, and role-selection screen.
