// WebSocket Network Client for Real-Time Multiplayer Sync

export class NetworkClient {
  constructor(role = 'auto', callbacks = {}, room = 'default') {
    this.role = role;
    this.callbacks = callbacks;
    this.room = room;
    this.ws = null;
    this.connected = false;
    this.clientId = null;
    this.reconnectAttempts = 0;

    this.connect();
  }

  connect() {
    const pageProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL ||
      (isLocalDevelopment ? `${pageProtocol}//localhost:3000` : `${pageProtocol}//${window.location.host}`);
    const wsUrl = new URL(serverUrl);
    wsUrl.searchParams.set('role', this.role);
    wsUrl.searchParams.set('room', this.room);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      if (this.callbacks.onConnected) this.callbacks.onConnected();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (this.callbacks.onDisconnected) this.callbacks.onDisconnected();
      // Auto reconnect
      setTimeout(() => {
        if (this.reconnectAttempts < 5) {
          this.reconnectAttempts++;
          this.connect();
        }
      }, 2000);
    };

    this.ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
    };
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'INIT_STATE':
        this.clientId = msg.clientId;
        this.role = msg.role;
        if (this.callbacks.onInitState) this.callbacks.onInitState(msg);
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

      case 'ROUND_STARTED':
        if (this.callbacks.onRoundStarted) this.callbacks.onRoundStarted(msg);
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
    }
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

  sendGoalReached() {
    this.send({ type: 'GOAL_REACHED' });
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
}
