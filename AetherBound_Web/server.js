import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three/build')));

// Game State Definition
class GameRoom {
  constructor(id = 'default') {
    this.id = id;
    this.clients = new Map(); // ws -> { id, role, name }
    this.roundDuration = 90; // 90 seconds per match
    this.timeRemaining = this.roundDuration;
    this.status = 'WAITING'; // WAITING, PLAYING, RUNNER_WON, SABOTEUR_WON
    this.seed = Math.floor(Math.random() * 1000000);
    this.goalDistance = 180;
    this.goalPosition = this.calculateGoalPosition();
    this.obstacles = []; // array of { id, type, position, rotation, timestamp }
    this.runnerState = { x: 0, y: 10, z: 0, rx: 0, ry: 0, speed: 0, isGrounded: true };
    this.timerInterval = null;
    this.scores = { runner: 0, saboteur: 0 };
  }

  calculateGoalPosition() {
    // Generate goal on an angle between 0 and 2*PI, at distance this.goalDistance
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.round(Math.cos(angle) * this.goalDistance),
      y: 0, // World height will be adjusted by client heightmap
      z: Math.round(Math.sin(angle) * this.goalDistance)
    };
  }

  startRound() {
    this.timeRemaining = this.roundDuration;
    this.status = 'PLAYING';
    this.obstacles = [];
    this.goalPosition = this.calculateGoalPosition();
    this.seed = Math.floor(Math.random() * 1000000);

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.status !== 'PLAYING') return;

      this.timeRemaining -= 1;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.status = 'SABOTEUR_WON';
        this.scores.saboteur += 1;
        this.broadcast({
          type: 'GAME_OVER',
          winner: 'saboteur',
          reason: 'Time expired! Runner failed to reach the beacon.',
          scores: this.scores
        });
      }

      this.broadcast({
        type: 'TIMER_TICK',
        timeRemaining: this.timeRemaining,
        status: this.status
      });
    }, 1000);

    this.broadcast({
      type: 'ROUND_STARTED',
      seed: this.seed,
      goalPosition: this.goalPosition,
      timeRemaining: this.timeRemaining,
      status: this.status,
      scores: this.scores
    });
  }

  resetRound() {
    this.startRound();
  }

  broadcast(message, senderWs = null) {
    const data = JSON.stringify(message);
    for (const [clientWs] of this.clients.entries()) {
      if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    }
  }

  broadcastAll(message) {
    const data = JSON.stringify(message);
    for (const [clientWs] of this.clients.entries()) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    }
  }

  addClient(ws, preferredRole) {
    let assignedRole = preferredRole;
    
    // Check role availability
    let runnerTaken = false;
    let saboteurTaken = false;
    for (const info of this.clients.values()) {
      if (info.role === 'runner') runnerTaken = true;
      if (info.role === 'saboteur') saboteurTaken = true;
    }

    if (preferredRole === 'runner' && runnerTaken) {
      assignedRole = !saboteurTaken ? 'saboteur' : 'spectator';
    } else if (preferredRole === 'saboteur' && saboteurTaken) {
      assignedRole = !runnerTaken ? 'runner' : 'spectator';
    } else if (!preferredRole || preferredRole === 'auto') {
      if (!runnerTaken) assignedRole = 'runner';
      else if (!saboteurTaken) assignedRole = 'saboteur';
      else assignedRole = 'spectator';
    }

    const clientId = 'player_' + Math.random().toString(36).substring(2, 9);
    this.clients.set(ws, { id: clientId, role: assignedRole });

    // Send initial handshake state
    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      clientId,
      role: assignedRole,
      status: this.status,
      timeRemaining: this.timeRemaining,
      seed: this.seed,
      goalPosition: this.goalPosition,
      obstacles: this.obstacles,
      scores: this.scores,
      playerCounts: this.getPlayerCounts()
    }));

    // Broadcast new player joined
    this.broadcastAll({
      type: 'PLAYERS_UPDATED',
      playerCounts: this.getPlayerCounts()
    });

    // Auto-start round if runner and saboteur exist and waiting
    if (this.status === 'WAITING' && (this.hasRole('runner') && this.hasRole('saboteur'))) {
      this.startRound();
    }
  }

  removeClient(ws) {
    this.clients.delete(ws);
    this.broadcastAll({
      type: 'PLAYERS_UPDATED',
      playerCounts: this.getPlayerCounts()
    });
  }

  hasRole(role) {
    for (const info of this.clients.values()) {
      if (info.role === role) return true;
    }
    return false;
  }

  getPlayerCounts() {
    let runner = 0, saboteur = 0, spectator = 0;
    for (const info of this.clients.values()) {
      if (info.role === 'runner') runner++;
      else if (info.role === 'saboteur') saboteur++;
      else spectator++;
    }
    return { runner, saboteur, spectator, total: this.clients.size };
  }
}

const rooms = new Map(); // roomId -> GameRoom

function getOrCreateRoom(roomId = 'default') {
  if (!rooms.has(roomId)) {
    const room = new GameRoom(roomId);
    rooms.set(roomId, room);
    console.log(`[Server] Created new room: "${roomId}"`);
  }
  return rooms.get(roomId);
}

wss.on('connection', (ws, req) => {
  const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const role = urlParams.get('role') || 'auto';
  const roomId = urlParams.get('room') || 'default';

  const room = getOrCreateRoom(roomId);
  room.addClient(ws, role);
  console.log(`[Server Room "${roomId}"] Player connected as ${role}. Total clients: ${room.clients.size}`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const clientInfo = room.clients.get(ws);

      switch (msg.type) {
        case 'RUNNER_MOVE':
          room.runnerState = msg.state;
          // Relay runner position to saboteur & spectators in the same room
          room.broadcast({
            type: 'RUNNER_UPDATE',
            state: msg.state
          }, ws);
          break;

        case 'SABOTEUR_MOVE':
          room.saboteurState = msg.state;
          // Relay saboteur position to runner & spectators in the same room
          room.broadcast({
            type: 'SABOTEUR_UPDATE',
            state: msg.state
          }, ws);
          break;

        case 'PLACE_OBSTACLE':
          // Disallow placement within 20m of Goal Sanctuary
          if (room.goalPosition && msg.position) {
            const dx = msg.position.x - room.goalPosition.x;
            const dz = msg.position.z - room.goalPosition.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 20.0) {
              console.log(`[Server Room "${roomId}"] Rejected obstacle placement: inside 20m goal sanctuary (${dist.toFixed(1)}m away)`);
              break;
            }
          }

          // Add to obstacle registry and broadcast to all in room
          const obstacle = {
            id: 'obs_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            type: msg.obstacleType,
            position: msg.position,
            rotation: msg.rotation || { x: 0, y: 0, z: 0 },
            placedBy: clientInfo ? clientInfo.id : 'unknown'
          };
          room.obstacles.push(obstacle);
          room.broadcastAll({
            type: 'OBSTACLE_SPAWNED',
            obstacle
          });
          break;

        case 'EXPLOSION':
          // Relay explosion shockwave to all other players in this room
          room.broadcast({
            type: 'EXPLOSION',
            position: msg.position,
            radius: msg.radius,
            knockback: msg.knockback
          }, ws);
          break;

        case 'OBSTACLE_DESTROYED':
          // Remove destroyed obstacle from room cache and broadcast
          const oIdx = room.obstacles.findIndex((o) => o.id === msg.id);
          if (oIdx !== -1) room.obstacles.splice(oIdx, 1);
          room.broadcast({
            type: 'OBSTACLE_DESTROYED',
            id: msg.id
          }, ws);
          break;

        case 'RECON_SCAN':
          // Relay Recon pulse to all clients in this room
          room.broadcast({
            type: 'RECON_SCAN',
            origin: msg.origin
          }, ws);
          break;

        case 'GOAL_REACHED':
          if (room.status === 'PLAYING') {
            room.status = 'RUNNER_WON';
            room.scores.runner += 1;
            room.broadcastAll({
              type: 'GAME_OVER',
              winner: 'runner',
              timeRemaining: room.timeRemaining,
              reason: 'The Runner successfully navigated the obstacles and reached the Beacon Goal!',
              scores: room.scores
            });
          }
          break;

        case 'POWERUP_COLLECTED':
          // Relay power-up collection across all other players in the room
          room.broadcast({
            type: 'POWERUP_COLLECTED',
            id: msg.id,
            powerupType: msg.powerupType,
            role: msg.role
          }, ws);
          break;

        case 'REQUEST_RESTART':
          room.resetRound();
          break;
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    room.removeClient(ws);
    console.log(`[Server Room "${roomId}"] Player disconnected. Clients remaining: ${room.clients.size}`);
    if (room.clients.size === 0 && roomId !== 'default') {
      setTimeout(() => {
        if (room.clients.size === 0) {
          if (room.timerInterval) clearInterval(room.timerInterval);
          rooms.delete(roomId);
          console.log(`[Server] Cleaned up empty room: "${roomId}"`);
        }
      }, 15000);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` AetherBound: Sabotage Game Server running on port ${PORT}`);
  console.log(` Local access: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
