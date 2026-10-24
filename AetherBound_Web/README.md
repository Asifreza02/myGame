# AetherBound: Dragon Hunt

A small multiplayer free-for-all survival prototype built with Next.js, Three.js, and a Node.js WebSocket server.

## Run locally

Start the game server and web app in separate terminals:

```bash
npm run server
npm run dev
```

The web app runs at `http://localhost:3000`. The game server listens on `3001` by default. Set `PORT` to change the server port, and set `NEXT_PUBLIC_GAME_SERVER_URL` in the web app environment when the server runs elsewhere.

## Join a match

Choose **NEW** to create a room code, or enter a shared code and join. Players in the same room share a match. Each player gets a unique spawn and the same knife, health, and movement abilities.

## Controls

- **WASD** move, **Space** jump or vault, **Ctrl** slide, and **Shift** sprint.
- **Click** to swing the knife at nearby players or strike the dragon.
- Collect glowing items and activate retained abilities with their hotbar buttons or number keys **1–5**.
- The mobile action pad includes movement actions and a knife attack button.

## Match rules

The authoritative WebSocket server tracks room membership, player positions, health, eliminations, pickups, ability activations, dragon health, and results. A match ends when one player remains, the dragon is defeated, or the five-minute timer expires. Eliminated players spectate until the match ends.

The dragon victory policy is configurable with `DRAGON_REWARD_POLICY=final-blow` (default) or `DRAGON_REWARD_POLICY=shared`. The server awards a dragon victory to the final attacker by default; `shared` awards it to all living players.

## World, loot, and match history

Each room uses its match seed to generate four blended biomes and a balanced loot field. Biome resources are tracked separately from abilities, while rare ability drops are placed near the dragon for higher-risk contests. The world streams around active players.

Weather moves through clear skies, mist, rain, and an aether storm during a match. Mist and storms reduce visibility, and wet or stormy conditions slow movement. Volcanic ground is a warned, damaging hazard; leave the glowing region to avoid repeated damage.

The results screen records eliminations, survival time, items found, damage dealt, and dragon damage. The most recent ten match summaries are stored in this browser only; they are cosmetic stats and do not grant competitive power.

For deployment, host the WebSocket server on a Node.js service that supports persistent WebSocket connections. Set `NEXT_PUBLIC_GAME_SERVER_URL` to its public `wss://` URL. A serverless Next.js deployment does not host the match state.
