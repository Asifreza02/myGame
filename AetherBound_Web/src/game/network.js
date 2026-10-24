// WebSocket Network Client for Real-Time Multiplayer Sync

export class NetworkClient {
  constructor(role = 'player', callbacks = {}, room = 'default', matchConfig = {}) {
    this.role = role;
    this.callbacks = callbacks;
    this.room = room;
    this.matchConfig = matchConfig;
    this.ws = null;
    this.connected = false;
    this.clientId = null;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.connectTimeout = null;
    this.isDestroyed = false;
    this.connectionWarningShown = false;
    this.attackSequence = 0;
    this.reconnectToken = this.loadReconnectToken(room);

    this.connectTimeout = setTimeout(() => {
      this.connectTimeout = null;
      this.connect();
    }, 0);
  }

  reconnectStorageKey(room) {
    return `aetherbound_reconnect:${room}`;
  }

  loadReconnectToken(room) {
    try {
      return localStorage.getItem(this.reconnectStorageKey(room)) || '';
    } catch (error) {
      console.warn('Could not load the reconnect session:', error);
      return '';
    }
  }

  saveReconnectToken(room, token) {
    try {
      if (room !== this.room) localStorage.removeItem(this.reconnectStorageKey(this.room));
      localStorage.setItem(this.reconnectStorageKey(room), token);
    } catch (error) {
      console.warn('Could not save the reconnect session:', error);
    }
  }

  connect() {
    if (this.isDestroyed) return;

    const pageProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL ||
      (isLocalDevelopment ? `${pageProtocol}//localhost:3001` : `${pageProtocol}//${window.location.host}`);
    const wsUrl = new URL(serverUrl);
    wsUrl.searchParams.set('room', this.room);
    wsUrl.searchParams.set('mode', this.matchConfig.mode || 'ffa');
    wsUrl.searchParams.set('duration', String(this.matchConfig.durationSeconds || 300));
    if (this.matchConfig.seed) wsUrl.searchParams.set('seed', String(this.matchConfig.seed));
    if (this.matchConfig.fillBots !== undefined) wsUrl.searchParams.set('bots', String(this.matchConfig.fillBots));
    if (this.reconnectToken) wsUrl.searchParams.set('token', this.reconnectToken);

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      if (this.isDestroyed || this.ws !== ws) return;
      this.connected = true;
      this.reconnectAttempts = 0;
      this.connectionWarningShown = false;
      if (this.callbacks.onConnected) this.callbacks.onConnected();
    };

    ws.onmessage = (event) => {
      if (this.isDestroyed || this.ws !== ws) return;
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      if (this.isDestroyed || this.ws !== ws) return;
      this.connected = false;
      if (this.callbacks.onDisconnected) this.callbacks.onDisconnected();
      this.reconnectAttempts++;
      const delay = Math.min(15_000, 1_000 * (2 ** Math.min(this.reconnectAttempts, 4))) + Math.floor(Math.random() * 500);
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.connect();
      }, delay);
    };

    ws.onerror = () => {
      if (!this.isDestroyed && this.ws === ws && !this.connectionWarningShown) {
        console.warn(`Could not connect to game server at ${wsUrl}. Check that it is running; retrying.`);
        this.connectionWarningShown = true;
      }
    };
  }

  destroy() {
    this.isDestroyed = true;
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.connected = false;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'INIT_STATE':
        this.clientId = msg.playerId || msg.clientId;
        this.role = 'player';
        if (msg.reconnectToken) {
          this.saveReconnectToken(msg.room || this.room, msg.reconnectToken);
          this.reconnectToken = msg.reconnectToken;
        }
        if (msg.room && msg.room !== this.room) {
          this.room = msg.room;
          const url = new URL(window.location.href);
          url.searchParams.set('room', msg.room);
          window.history.replaceState(window.history.state, '', url);
        }
        if (this.callbacks.onInitState) this.callbacks.onInitState(msg);
        break;

      case 'MATCH_STATE':
        if (this.callbacks.onMatchState) this.callbacks.onMatchState(msg.snapshot);
        break;
      case 'MATCH_STARTED':
        if (this.callbacks.onMatchStarted) this.callbacks.onMatchStarted(msg);
        break;
      case 'MATCH_RESULTS':
        if (this.callbacks.onMatchResults) this.callbacks.onMatchResults(msg);
        break;
      case 'PLAYER_JOINED':
      case 'PLAYER_ELIMINATED':
      case 'PLAYER_DISCONNECTED':
      case 'PLAYER_RECONNECTED':
      case 'PLAYER_DAMAGED':
      case 'PLAYER_ATTACKED':
      case 'ATTACK_RESULT':
      case 'ITEM_COLLECTED':
      case 'ABILITY_USED':
      case 'ABILITY_RESULT':
      case 'HAZARD_DEPLOYED':
      case 'DRAGON_DAMAGED':
      case 'DRAGON_ATTACK_TELEGRAPH':
      case 'DRAGON_ATTACK_RESOLVED':
      case 'DRAGON_PHASE_CHANGED':
      case 'WORLD_HAZARD_WARNING':
      case 'ROOM_FULL':
      case 'WEAPON_CRAFTED':
      case 'WEAPON_EQUIPPED':
      case 'WEAPON_FIRED':
      case 'WEAPON_FIRE_RESULT':
      case 'CRAFT_RESULT':
      case 'ITEM_SPAWNED':
        if (this.callbacks.onGameEvent) this.callbacks.onGameEvent(msg);
        break;
      case 'SESSION_IN_USE':
        if (this.callbacks.onSessionInUse) this.callbacks.onSessionInUse(msg.message);
        this.destroy();
        break;

      case 'RUNNER_UPDATE':
        if (this.callbacks.onRunnerUpdate) this.callbacks.onRunnerUpdate(msg.state);
        break;

      case 'SABOTEUR_UPDATE':
        if (this.callbacks.onSaboteurUpdate) this.callbacks.onSaboteurUpdate(msg.state);
        break;

      case 'OBSTACLE_SPAWNED':
        if (this.callbacks.onObstacleSpawned) this.callbacks.onObstacleSpawned(msg.obstacle);
        break;

      case 'EXPLOSION':
        if (this.callbacks.onExplosion) this.callbacks.onExplosion(msg);
        break;

      case 'OBSTACLE_DESTROYED':
        if (this.callbacks.onObstacleDestroyed) this.callbacks.onObstacleDestroyed(msg.id);
        break;

      case 'RECON_SCAN':
        if (this.callbacks.onReconScan) this.callbacks.onReconScan(msg);
        break;

      case 'TIMER_TICK':
        if (this.callbacks.onTimerTick) this.callbacks.onTimerTick(msg.timeRemaining, msg.status);
        break;

      case 'GAME_OVER':
        if (this.callbacks.onGameOver) this.callbacks.onGameOver(msg);
        break;

      case 'ROLE_ASSIGNED':
        this.role = msg.role;
        if (this.callbacks.onRoleAssigned) this.callbacks.onRoleAssigned(msg.role);
        break;

      case 'ROLE_ASSIGNMENT_FAILED':
        if (this.callbacks.onRoleAssignmentFailed) this.callbacks.onRoleAssignmentFailed(msg.message);
        break;

      case 'ROUND_STARTED':
        if (this.callbacks.onRoundStarted) this.callbacks.onRoundStarted(msg);
        break;

      case 'RETURN_TO_LOBBY':
        if (this.callbacks.onReturnToLobby) this.callbacks.onReturnToLobby(msg);
        break;

      case 'PLAYERS_UPDATED':
        if (this.callbacks.onPlayersUpdated) this.callbacks.onPlayersUpdated(msg.playerCounts);
        break;

      case 'POWERUP_COLLECTED':
        if (this.callbacks.onPowerupCollected) this.callbacks.onPowerupCollected(msg);
        break;
    }
  }

  send(data) {
    if (this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendPlayerMove(state) { this.send({ type: 'PLAYER_MOVE', state }); }
  attack() {
    this.attackSequence += 1;
    this.send({ type: 'KNIFE_ATTACK', attackId: this.attackSequence });
  }
  collectItem(id) { this.send({ type: 'PICKUP_ITEM', id }); }
  useAbility(ability) { this.send({ type: 'USE_ABILITY', ability }); }
  craftWeapon(recipeIndex) { this.send({ type: 'CRAFT_WEAPON', recipeIndex }); }
  equipWeapon(weaponId) { this.send({ type: 'EQUIP_WEAPON', weaponId }); }
  fireWeapon(weaponId, origin, direction) {
    this.send({ type: 'WEAPON_FIRE', weaponId, origin, direction, fireId: Date.now() });
  }

  sendRunnerMove(state) {
    this.send({ type: 'RUNNER_MOVE', state });
  }

  sendSaboteurMove(state) {
    this.send({ type: 'SABOTEUR_MOVE', state });
  }

  sendPlaceObstacle(obstacleType, position, rotation) {
    this.send({
      type: 'PLACE_OBSTACLE',
      obstacleType,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z }
    });
  }

  sendExplosion(position, radius, knockback) {
    this.send({
      type: 'EXPLOSION',
      position: { x: position.x, y: position.y, z: position.z },
      radius,
      knockback
    });
  }

  sendObstacleDestroyed(id) {
    this.send({
      type: 'OBSTACLE_DESTROYED',
      id
    });
  }

  sendReconScan(origin) {
    this.send({
      type: 'RECON_SCAN',
      origin: { x: origin.x, y: origin.y, z: origin.z }
    });
  }

  sendPowerupCollect(id, powerupType, role) {
    this.send({
      type: 'POWERUP_COLLECTED',
      id,
      powerupType,
      role
    });
  }

  requestRestart() {
    this.send({ type: 'REQUEST_RESTART' });
  }

  requestRole(role) {
    return this.send({ type: 'REQUEST_ROLE', role });
  }

  returnToLobby() {
    return this.send({ type: 'RETURN_TO_LOBBY' });
  }
}
