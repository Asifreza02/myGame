# AetherBound: Multiplayer Survival & Dragon Hunt
**Game Type**: Multiplayer free-for-all action survival (PvPvE)
**Target Environment**: 3D procedural open world
**Core Loop**: Players start with a knife, scavenge items to unlock abilities, and compete to be the last player alive or defeat the main dragon.

---

## Game Overview & Vision

A multiplayer survival game set in a dangerous, procedurally generated world. Every player begins with the same basic knife and no special role. Players explore, gather equipment, and unlock temporary or equipped abilities inspired by the former Runner and Saboteur kits while competing against one another and the world.

The match has two possible victory paths:

1. **Last player standing**: Eliminate or outlast every other player then defeat the dragon.
2. **Dragon slayer**: Defeat the main dragon and earn the match victory.

Players must choose whether to fight rivals, seek upgrades, avoid danger, or risk contesting the dragon. The dragon and neutral hazards create pressure that keeps players moving and creates opportunities for encounters.

**Dragon victory rule to decide during design**: whether the player who lands the final blow wins, or whether all living players share the victory. Until decided, treat dragon slaying as a match-ending victory condition and keep the reward policy configurable.

---

## Core Gameplay Systems

- **Free-for-all multiplayer**: Several players join one match as competitors. No fixed Runner or Saboteur teams or roles.
- **Shared starting loadout**: Every player spawns with a knife and baseline movement, health, and defensive capabilities.
- **Scavenged abilities**: Items found in the world unlock abilities drawn from both former kits, including mobility, vaulting, sprinting, recon, shielding, and tactical hazards. Any player can acquire and use them.
- **PvP combat**: Players use their knife, acquired equipment, and abilities to fight or evade other players.
- **PvE dragon encounter**: A powerful main dragon roams or is encountered in a defined arena. Players may attack it, evade it, or exploit its threat against rivals.
- **Dual victory conditions**: The match ends when one player remains or when the dragon is defeated. The dragon reward policy remains an explicit design decision.
- **Procedural survival world**: Seeded terrain, biomes, resources, item drops, and neutral hazards support replayable matches and strategic exploration.

---

## 4-Phase Roadmap

### Phase 1: Free-for-All Foundation & Playable Match
*Goal: Replace role-based play with a complete small-scale multiplayer survival loop.*
- **Match and Lobby Flow**:
  - Create/join rooms that support multiple competing players.
  - Assign each player a unique identity and spawn point; do not assign Runner or Saboteur roles.
  - Establish match states for lobby, active play, player elimination, and match results.
- **Player Baseline**:
  - Use one shared third-person movement and camera controller for every player.
  - Spawn every player with the same knife and basic combat actions.
  - Add health, damage, elimination, and respawn/spectating rules as required by the match flow.
- **Scavenging Prototype**:
  - Spawn a small set of collectible items around the map.
  - Collecting an item grants its corresponding ability or equipment.
  - Initially adapt abilities from both previous kits: sprint/slide/vault, recon, shield, and deployable hazards.
- **Match Loop and Victory**:
  - Track living players and declare the last surviving player the winner.
  - Add a dragon encounter and a match-ending dragon defeat event.
  - Keep the dragon victory reward policy configurable until individual-vs-shared credit is decided.
- **Networking**:
  - Synchronize player identity, transforms, health, combat, item pickups, ability state, eliminations, dragon state, and match results through the authoritative WebSocket server.

### Phase 2: Combat, Ability Items & Dragon Encounter
*Goal: Make player-versus-player combat and the boss objective readable, fair, and fun.*
- **Knife Combat**:
  - Add server-validated melee range, attack timing, hit detection, damage, and feedback.
  - Ensure simultaneous attacks and latency do not produce inconsistent elimination results.
- **Item and Ability Design**:
  - Define item rarity, spawn rules, pickup behavior, ability duration/cooldown, and whether items are consumed or retained.
  - Convert former Runner and Saboteur skills into item-granted abilities usable by any player.
  - Balance offensive, defensive, mobility, recon, and deployable-hazard items for free-for-all play.
- **Dragon Boss**:
  - Build a boss with clear telegraphs, multiple attacks, movement phases, health, and a defeat state.
  - Let players choose to cooperate temporarily or attack one another while contesting the dragon.
  - Resolve dragon defeat exactly once on the authoritative server and apply the selected victory policy.
- **Player Feedback**:
  - Show health, knife/action controls, inventory or equipped abilities, remaining players, and dragon status.
  - Present clear pickup, damage, elimination, victory, and defeat feedback.

### Phase 3: World, Loot & Survival Depth
*Goal: Make exploration and match decisions evolve across a replayable world.*
- **Procedural Biomes**:
  - Add seamless Lush Forest, Rocky Canyon, Snowy Peak, and Volcanic Badlands regions.
  - Stream terrain and points of interest around all active players.
- **Loot and Resources**:
  - Place curated item pools and resource drops across biomes and points of interest.
  - Add stronger, contested loot near dangerous areas and the dragon.
  - Make pickup distribution fair enough to prevent spawn advantage while preserving meaningful risk.
- **World Threats**:
  - Add neutral creatures, environmental hazards, and a day/night or weather system that affects visibility and movement.
  - Use the dragon and world threats to create pressure without making PvE damage an arbitrary substitute for PvP.
- **Progression and Match Stats**:
  - Track match history, eliminations, survival time, items collected, damage dealt, and dragon contribution.
  - Keep long-term progression cosmetic or otherwise separated from competitive match power.

### Phase 4: Scale, Modes & Community Content
*Goal: Expand the core survival game after the free-for-all and dragon loop are proven.*
- **Player Count and Matchmaking**:
  - Tune room capacity, spawn distribution, server tick rate, and replication for larger matches.
  - Add matchmaking, reconnect handling, and configurable match lengths.
- **Optional Modes**:
  - Add solo survival and dragon-hunt variants with explicit victory rules.
  - Explore team modes only as optional modes; they do not replace the core free-for-all.
  - Consider limited-time objectives and map variations after core balance is stable.
- **Community Content**:
  - Support shareable world seeds and curated challenges.
  - Consider safe, data-driven item and map configuration rather than executable user scripts.

---

## Technical Stack & Architecture

- **Rendering Engine**: Three.js (WebGL / WebGPU) for responsive 3D browser gameplay.
- **Physics and Combat**: Use the existing movement and collision systems where practical; validate combat, pickups, ability effects, dragon health, and match results authoritatively on the server.
- **Backend / Networking**: Node.js + WebSocket (`ws`) for room matchmaking, server-authoritative match state, and multi-client synchronization.
- **Terrain Generation**: Seeded 2D noise with chunk grid indexing `(cx, cz)` and streaming around active players.
- **Game Data**: Data-driven definitions for players, items, abilities, weapons, dragon attacks, and match rules. Former player roles are not player classes.
- **UI & HUD**: Player health, knife/action controls, inventory or equipped abilities, remaining player count, dragon status, and match state.
