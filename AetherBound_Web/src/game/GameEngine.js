import * as THREE from 'three';
import { GAME_CONFIG, OBSTACLES, DAYLIGHT_CONFIG } from './config.js';
import { WorldManager } from './world.js';
import { GoalBeacon } from './goal.js';
import { ObstacleManager } from './obstacles.js';
import { PhysicsSystem } from './physics.js';
import { RunnerController } from './entities/Runner.js';
import { SaboteurController } from './entities/Saboteur.js';
import { NetworkClient } from './network.js';
import { AISaboteur } from './ai_saboteur.js';
import { ParticleSystem } from './particles.js';
import { PowerUpManager } from './powerups.js';
import { audio } from './audio.js';

export class GameEngine {
  constructor(containerElement, onStateChange) {
    this.container = containerElement;
    this.onStateChange = onStateChange;

    this.activeRole = 'runner';
    this.isLocalDual = false;
    this.gameState = 'PLAYING';
    this.timeRemaining = GAME_CONFIG.ROUND_TIME;
    this.playerCounts = { runner: 1, saboteur: 0, spectator: 0 };

    const params = new URLSearchParams(window.location.search);
    this.roomCode = params.get('room') || 'default';
    const preferredRole = params.get('role');
    this.isLocalDual = params.get('mode') === 'local';

    if (preferredRole) {
      this.activeRole = preferredRole;
    }

    this.clock = new THREE.Clock();
    this.lastNetworkSync = 0;
    this.lastSaboteurSync = 0;
    this.lastStateEmit = 0;

    this.todName = '☀️ DAYTIME';
    this.todClass = 'noon';
    this.stats = {
      distanceTraversed: 0,
      resourcesCollected: 0,
      itemsCrafted: 0,
      obstaclesPlaced: 0,
    };
    this.lastRunnerPosForDist = null;
    this.damageFlash = 0;
    this.toastMessage = null;
    this.toastTimeout = null;
    this.isPointerLocked = false;
    this.gameOverData = null;

    this.placementData = {
      visible: false,
      selectedType: 'WALL',
      dist: 16.0,
      maxDist: 75.0,
      hasEnergy: true,
      cost: 30,
      currentEnergy: 100,
      inRange: true,
      isInsideSanctuary: false,
      isValidPlacement: true,
    };

    this.initThree();
    this.initGameSystems();
    this.initNetwork(preferredRole || 'auto');

    if (preferredRole || this.isLocalDual) {
      this.setRole(this.activeRole);
    } else {
      this.gameState = 'ROLE_SELECT';
    }

    this.animate = this.animate.bind(this);
    this.animationId = requestAnimationFrame(this.animate);

    // Global reference for any legacy bindings
    window.gameApp = this;
    this.emitState();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa8bdb4);
    this.scene.fog = new THREE.FogExp2(0xa8bdb4, 0.0042);

    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const pixelRatioLimit = window.innerWidth < 768 ? 1.35 : 1.75;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioLimit));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.ambientLight = new THREE.HemisphereLight(0xd9e8e5, 0x53614a, 1.45);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7e2, 2.2);
    this.sunLight.position.set(70, 130, 60);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.bias = -0.00015;
    this.sunLight.shadow.normalBias = 0.025;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 300;
    const shadowDist = 70;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.scene.add(this.sunLight);

    this.onResize = () => {
      if (!this.camera || !this.renderer) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.onResize);
  }

  initGameSystems() {
    this.particles = new ParticleSystem(this.scene);
    this.worldManager = new WorldManager(this.scene, 1337);
    this.obstacleManager = new ObstacleManager(this.scene, this.worldManager);
    this.physics = new PhysicsSystem(this.worldManager, this.obstacleManager);

    this.goalBeacon = new GoalBeacon(this.scene, this.worldManager);
    this.goalBeacon.setPosition(120, 120);

    // Runner
    this.runner = new RunnerController(this.scene, this.camera, this.renderer.domElement);
    this.runner.goalBeacon = this.goalBeacon;
    this.runner.particles = this.particles;
    this.runner.physics = this.physics;
    this.runner.worldManager = this.worldManager;
    const startY = this.worldManager.getHeightAt(0, 0);
    this.runner.setState({ x: 0, y: startY + 1.0, z: 0, ry: 0 });

    this.runner.onDamage = () => {
      this.damageFlash = Date.now();
      this.emitState();
    };
    this.runner.onPointerLockChange = (locked) => {
      this.isPointerLocked = locked;
      this.emitState();
    };
    this.runner.onSensitivityChange = () => {
      this.emitState();
    };

    // Saboteur
    this.saboteur = new SaboteurController(
      this.scene,
      this.camera,
      this.renderer.domElement,
      this.physics,
      this.obstacleManager,
      (type, pos, rot) => this.onObstaclePlaced(type, pos, rot)
    );
    this.saboteur.goalBeacon = this.goalBeacon;
    this.saboteur.worldManager = this.worldManager;

    this.saboteur.onDamage = () => {
      this.damageFlash = Date.now();
      this.emitState();
    };
    this.saboteur.onPointerLockChange = (locked) => {
      this.isPointerLocked = locked;
      this.emitState();
    };
    this.saboteur.onPlacementUpdate = (data) => {
      this.placementData = data;
      this.emitState();
    };
    this.saboteur.onSensitivityChange = () => {
      this.emitState();
    };
    this.saboteur.onToast = (msg) => {
      this.showToast(msg);
    };

    // PowerUp Manager
    this.powerUpManager = new PowerUpManager(
      this.scene,
      this.worldManager,
      this.particles,
      (id, type, role) => {
        this.stats.resourcesCollected += 1;
        if (this.network) {
          this.network.sendPowerupCollect(id, type, role);
        }
        this.emitState();
      }
    );

    this.worldManager.onChunkCreated = (cx, cz) => {
      this.powerUpManager.populateChunk(cx, cz);
    };
    this.worldManager.onChunksCleared = () => {
      this.powerUpManager.clear();
    };

    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        this.powerUpManager.populateChunk(cx, cz);
      }
    }

    this.saboteur.onReconCallback = (origin) => {
      if (this.network) {
        this.network.sendReconScan(origin);
      }
    };

    this.obstacleManager.onExplosion = (blastPos, blastRadius, blastKnockback) => {
      if (this.particles) this.particles.emitExplosion(blastPos);
      audio.playExplosion();

      [this.runner, this.saboteur].forEach((char) => {
        if (!char) return;
        const dx = char.position.x - blastPos.x;
        const dz = char.position.z - blastPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= blastRadius && dist > 0.001) {
          const force = (1.0 - dist / blastRadius) * blastKnockback;
          char.velocity.x += (dx / dist) * force;
          char.velocity.z += (dz / dist) * force;
          char.velocity.y = 12.0 * (1.0 - dist / blastRadius);
          const dmg = Math.round(Math.max(25, 65 * (1.0 - dist / blastRadius)));
          if (char.takeDamage) char.takeDamage(dmg, 'explosion');
          else if (char.onHazardHit) char.onHazardHit();
        }
      });

      if (this.network) {
        this.network.sendExplosion(blastPos, blastRadius, blastKnockback);
      }
    };

    this.obstacleManager.onDestroyObstacle = (id) => {
      if (this.network) {
        this.network.sendObstacleDestroyed(id);
      }
    };

    // AI Saboteur
    this.aiSaboteur = new AISaboteur(
      this.worldManager,
      this.obstacleManager,
      (type, pos, rot) => this.onObstaclePlaced(type, pos, rot),
      this.saboteur,
      (msg) => this.showToast(msg)
    );
  }

  initNetwork(preferredRole) {
    this.network = new NetworkClient(preferredRole, {
      onInitState: (msg) => {
        if (!this.isLocalDual) {
          this.setRole(msg.role);
        }
        if (msg.seed) {
          this.worldManager.setSeed(msg.seed);
        }
        if (msg.goalPosition) {
          this.goalBeacon.setPosition(msg.goalPosition.x, msg.goalPosition.z);
          this.runner.goalBeacon = this.goalBeacon;
          this.saboteur.goalBeacon = this.goalBeacon;
        }
        if (msg.obstacles && msg.obstacles.length > 0) {
          msg.obstacles.forEach((obs) => {
            this.obstacleManager.spawnObstacle(obs.id, obs.type, obs.position, obs.rotation);
          });
        }
        this.timeRemaining = msg.timeRemaining;
        this.emitState();
      },

      onRunnerUpdate: (remoteState) => {
        if (this.activeRole !== 'runner') {
          this.runner.setState(remoteState);
        }
      },

      onSaboteurUpdate: (remoteState) => {
        if (this.activeRole !== 'saboteur') {
          this.saboteur.setState(remoteState);
        }
      },

      onObstacleSpawned: (obs) => {
        this.obstacleManager.spawnObstacle(obs.id, obs.type, obs.position, obs.rotation);
        if (this.particles) {
          this.particles.emitObstacleSparks(new THREE.Vector3(obs.position.x, obs.position.y + 0.5, obs.position.z), 18, 0x00ffff);
        }
      },

      onExplosion: (data) => {
        const blastPos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        if (this.particles) this.particles.emitExplosion(blastPos);
        audio.playExplosion();

        [this.runner, this.saboteur].forEach((char) => {
          if (!char) return;
          const dx = char.position.x - blastPos.x;
          const dz = char.position.z - blastPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= data.radius && dist > 0.001) {
            const force = (1.0 - dist / data.radius) * data.knockback;
            char.velocity.x += (dx / dist) * force;
            char.velocity.z += (dz / dist) * force;
            char.velocity.y = 12.0 * (1.0 - dist / data.radius);
            const dmg = Math.round(Math.max(25, 65 * (1.0 - dist / data.radius)));
            if (char.takeDamage) char.takeDamage(dmg, 'explosion');
            else if (char.onHazardHit) char.onHazardHit();
          }
        });
      },

      onObstacleDestroyed: (id) => {
        this.obstacleManager.destroyObstacle(id, this.particles);
      },

      onReconScan: (data) => {
        audio.playReconScan();
        if (this.saboteur) {
          this.saboteur.receiveReconPulse(data.origin);
        }
      },

      onTimerTick: (timeRemaining, status) => {
        this.timeRemaining = timeRemaining;
        this.gameState = status;
        if (this.timeRemaining <= 15) {
          audio.playTick();
        }
        this.emitState();
      },

      onGameOver: (msg) => {
        this.handleGameOver(msg);
      },

      onRoundStarted: (msg) => {
        this.resetRound(msg);
      },

      onPlayersUpdated: (counts) => {
        this.playerCounts = counts;
        this.updateAISaboteurStatus();
        this.emitState();
      },

      onPowerupCollected: (data) => {
        if (this.powerUpManager) {
          this.powerUpManager.handleRemoteCollect(data.id);
        }
      }
    }, this.roomCode);
  }

  showToast(msg) {
    this.toastMessage = msg;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastMessage = null;
      this.emitState();
    }, 3200);
    this.emitState();
  }

  isHumanSaboteurAvailable() {
    if (this.activeRole === 'saboteur') return true;
    if (this.isLocalDual) return true;
    if (this.playerCounts && this.playerCounts.saboteur > 0) return true;
    return false;
  }

  updateAISaboteurStatus() {
    if (this.isHumanSaboteurAvailable()) {
      if (this.aiSaboteur) this.aiSaboteur.enabled = false;
    }
  }

  setRole(role) {
    this.activeRole = role;
    this.gameState = 'PLAYING';

    if (role === 'runner') {
      this.runner.enabled = true;
      this.saboteur.enabled = false;
      document.body.classList.add('runner-mode');
      document.body.classList.remove('saboteur-placing');
      document.body.classList.remove('cursor-unlocked');
      this.obstacleManager.hidePreview();
      this.requestPointerLock();
    } else if (role === 'saboteur') {
      this.runner.enabled = false;
      this.saboteur.enabled = true;
      document.body.classList.remove('runner-mode');
      document.body.classList.remove('cursor-unlocked');
      if (this.saboteur.isPlacing && this.saboteur.selectedType) {
        document.body.classList.add('saboteur-placing');
      } else {
        document.body.classList.remove('saboteur-placing');
      }
      this.saboteur.refreshPreview();
      this.requestPointerLock();
    } else {
      this.runner.enabled = false;
      this.saboteur.enabled = false;
      document.body.classList.remove('runner-mode');
      document.body.classList.remove('cursor-locked');
      document.body.classList.add('cursor-unlocked');
      document.body.classList.remove('saboteur-placing');
      this.obstacleManager.hidePreview();
    }

    this.updateAISaboteurStatus();
    this.emitState();
  }

  setLocalDual(isLocal) {
    this.isLocalDual = isLocal;
    this.setRole('runner');
    this.emitState();
  }

  selectObstacle(type) {
    if (this.saboteur) {
      this.saboteur.selectObstacle(type);
      this.emitState();
    }
  }

  deselectObstacle() {
    if (this.saboteur) {
      this.saboteur.deselectObstacle();
      this.emitState();
    }
  }

  triggerReconPulse() {
    if (this.saboteur) {
      this.saboteur.triggerReconPulse(this.runner.position);
      this.emitState();
    }
  }

  toggleAISaboteur() {
    if (this.aiSaboteur) {
      this.aiSaboteur.enabled = !this.aiSaboteur.enabled;
      this.updateAISaboteurStatus();
      this.emitState();
    }
  }

  lookAtGoal() {
    if (this.runner && this.activeRole === 'runner') this.runner.lookAtGoal();
    if (this.saboteur && this.activeRole === 'saboteur') this.saboteur.lookAtGoal();
  }

  lookBehind() {
    if (this.runner && this.activeRole === 'runner') this.runner.lookBehind();
    if (this.saboteur && this.activeRole === 'saboteur') this.saboteur.lookBehind();
  }

  cycleRunnerSensitivity() {
    if (this.runner) {
      this.runner.cycleSensitivity();
      this.emitState();
    }
  }

  cycleSaboteurSensitivity() {
    if (this.saboteur) {
      this.saboteur.cycleSensitivity();
      this.emitState();
    }
  }

  craftPowerUp(recipeId) {
    if (this.activeRole !== 'runner' || !this.powerUpManager) return;
    const result = this.powerUpManager.craft(recipeId);
    if (result.success) {
      this.stats.itemsCrafted += 1;
      this.showToast(`Crafted ${result.item.name}.`);
    } else {
      this.showToast(result.reason);
    }
    this.emitState();
  }

  usePowerUp(itemId) {
    if (this.activeRole !== 'runner' || !this.powerUpManager) return;
    const result = this.powerUpManager.useItem(itemId, this.runner);
    if (result.success) {
      this.showToast(`Used ${result.item.name}.`);
    } else {
      this.showToast(result.reason);
    }
    this.emitState();
  }

  // Mobile Touch & Virtual Joystick Support
  setJoystick(x, y) {
    if (this.activeRole === 'runner' || (this.isLocalDual && this.activeRole === 'runner')) {
      if (this.runner) this.runner.setJoystick(x, y);
    } else if (this.activeRole === 'saboteur' || (this.isLocalDual && this.activeRole === 'saboteur')) {
      if (this.saboteur) this.saboteur.setJoystick(x, y);
    }
  }

  addLookYaw(deltaYaw) {
    if (this.activeRole === 'runner') {
      if (this.runner) this.runner.addCameraYaw(deltaYaw);
    } else if (this.activeRole === 'saboteur') {
      if (this.saboteur) this.saboteur.addCameraYaw(deltaYaw);
    }
  }

  // Controls item placement by screen drag on mobile
  dragItemPlacement(deltaX, deltaY) {
    if (this.activeRole === 'saboteur' || (this.isLocalDual && this.activeRole === 'saboteur')) {
      if (this.saboteur) {
        this.saboteur.dragItemPlacement(deltaX, deltaY);
      }
    }
  }

  adjustPlacementDistance(delta) {
    if (this.saboteur) {
      this.saboteur.adjustPlacementDistance(delta);
    }
  }

  rotatePlacement() {
    if (this.saboteur) {
      this.saboteur.rotatePlacement();
    }
  }

  deployObstacle() {
    if (this.saboteur) {
      this.saboteur.triggerDeploy();
    }
  }

  jump() {
    if (this.activeRole === 'runner' || (this.isLocalDual && this.activeRole === 'runner')) {
      if (this.runner) this.runner.triggerJump();
    } else if (this.activeRole === 'saboteur' || (this.isLocalDual && this.activeRole === 'saboteur')) {
      if (this.saboteur) this.saboteur.triggerJump();
    }
  }

  slide() {
    if (this.activeRole === 'runner' || (this.isLocalDual && this.activeRole === 'runner')) {
      if (this.runner) this.runner.startSlide();
    } else if (this.activeRole === 'saboteur' || (this.isLocalDual && this.activeRole === 'saboteur')) {
      if (this.saboteur) this.saboteur.startSlide();
    }
  }

  setSprint(active) {
    if (this.activeRole === 'runner' || (this.isLocalDual && this.activeRole === 'runner')) {
      if (this.runner) this.runner.setSprinting(active);
    } else if (this.activeRole === 'saboteur' || (this.isLocalDual && this.activeRole === 'saboteur')) {
      if (this.saboteur) this.saboteur.setSprinting(active);
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().then(() => {
          if (screen.orientation?.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  requestRestart() {
    if (this.network) {
      this.network.requestRestart();
    }
  }

  requestPointerLock() {
    if (navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches) return;
    try {
      this.renderer.domElement.requestPointerLock();
    } catch(e) {}
  }

  onObstaclePlaced(type, pos, rot) {
    this.stats.obstaclesPlaced += 1;
    if (this.isLocalDual || !this.network.connected) {
      this.obstacleManager.spawnObstacle(
        'obs_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        type,
        pos,
        rot
      );
    }
    this.network.sendPlaceObstacle(type, pos, rot);
    this.emitState();
  }

  handleGameOver(msg) {
    this.gameState = 'FINISHED';

    const timeElapsed = Math.max(1, Math.round(GAME_CONFIG.ROUND_TIME - this.timeRemaining));
    const dist = Math.round(this.stats.distanceTraversed);
    const resources = this.stats.resourcesCollected;
    const traps = this.stats.obstaclesPlaced;

    let bestStats = { bestDist: 0, bestResources: 0, bestTime: 999 };
    try {
      const saved = localStorage.getItem('aetherbound_best_stats');
      if (saved) bestStats = JSON.parse(saved);
    } catch (e) {}

    let isNewBestDist = false;
    let isNewBestResources = false;

    if (dist > (bestStats.bestDist || 0)) {
      bestStats.bestDist = dist;
      isNewBestDist = true;
    }
    const previousBestResources = bestStats.bestResources || bestStats.bestCrystals || 0;
    if (resources > previousBestResources) {
      bestStats.bestResources = resources;
      isNewBestResources = true;
    }
    if (msg.winner === 'runner' && timeElapsed < (bestStats.bestTime || 999)) {
      bestStats.bestTime = timeElapsed;
    }

    try {
      localStorage.setItem('aetherbound_best_stats', JSON.stringify(bestStats));
    } catch (e) {}

    if (msg.winner === 'runner') {
      audio.playWin();
    } else {
      audio.playLose();
    }

    this.gameOverData = {
      winner: msg.winner,
      reason: msg.reason || (msg.winner === 'runner' ? 'The Runner escaped!' : 'Time ran out!'),
      scores: msg.scores || { runner: 0, saboteur: 0 },
      metrics: {
        dist,
        resources,
        traps,
        timeElapsed,
        bestDist: bestStats.bestDist || dist,
        bestResources: bestStats.bestResources || resources,
        isNewBestDist,
        isNewBestResources,
      }
    };

    this.emitState();
  }

  resetRound(msg) {
    this.gameState = 'PLAYING';
    this.gameOverData = null;

    this.stats = {
      distanceTraversed: 0,
      resourcesCollected: 0,
      itemsCrafted: 0,
      obstaclesPlaced: 0,
    };
    this.lastRunnerPosForDist = null;

    if (msg.seed) this.worldManager.setSeed(msg.seed);
    if (msg.goalPosition) {
      this.goalBeacon.setPosition(msg.goalPosition.x, msg.goalPosition.z);
      this.runner.goalBeacon = this.goalBeacon;
      this.saboteur.goalBeacon = this.goalBeacon;
    }

    this.obstacleManager.clear();
    if (this.powerUpManager) {
      this.powerUpManager.clear();
      for (let cx = -2; cx <= 2; cx++) {
        for (let cz = -2; cz <= 2; cz++) {
          this.powerUpManager.populateChunk(cx, cz);
        }
      }
    }

    const startY = this.worldManager.getHeightAt(0, 0);
    this.runner.health = 100;
    this.runner.invulnerableTimer = 0;
    this.runner.speedBuffTimer = 0;
    this.runner.speedMultiplier = 1.0;
    this.runner.jumpBuffTimer = 0;
    this.runner.bonusJumpForce = 0;
    this.runner.hasShield = false;
    this.runner.shieldTimer = 0;
    if (this.runner.shieldMesh) this.runner.shieldMesh.visible = false;
    this.runner.setState({ x: 0, y: startY + 1.0, z: 0, ry: 0, health: 100 });

    const saboY = this.worldManager.getHeightAt(25, 25);
    this.saboteur.health = 100;
    this.saboteur.invulnerableTimer = 0;
    this.saboteur.speedBuffTimer = 0;
    this.saboteur.speedMultiplier = 1.0;
    this.saboteur.jumpBuffTimer = 0;
    this.saboteur.bonusJumpForce = 0;
    this.saboteur.hasShield = false;
    this.saboteur.shieldTimer = 0;
    if (this.saboteur.shieldMesh) this.saboteur.shieldMesh.visible = false;
    this.saboteur.setState({ x: 25, y: saboY + 1.0, z: 25, ry: Math.PI, health: 100 });

    this.emitState();
  }

  updateDaylight() {
    this.todName = '☀️ DAYTIME';
    this.todClass = 'noon';
    const charPos = this.activeRole === 'saboteur' ? this.saboteur.position : this.runner.position;

    this.sunLight.position.set(
      charPos.x + DAYLIGHT_CONFIG.sunOffset.x,
      charPos.y + DAYLIGHT_CONFIG.sunOffset.y,
      charPos.z + DAYLIGHT_CONFIG.sunOffset.z
    );
    this.sunLight.target.position.copy(charPos);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.color.setHex(DAYLIGHT_CONFIG.sun);
    this.sunLight.intensity = DAYLIGHT_CONFIG.sunIntensity;
    this.ambientLight.color.setHex(DAYLIGHT_CONFIG.ambient);
    this.ambientLight.intensity = DAYLIGHT_CONFIG.ambientIntensity;
    this.scene.background.setHex(DAYLIGHT_CONFIG.sky);
    this.scene.fog.color.setHex(DAYLIGHT_CONFIG.fog);
  }

  animate() {
    this.animationId = requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    if (this.gameState === 'PLAYING') {
      this.updateDaylight();

      this.goalBeacon.update(dt, elapsedTime);
      this.obstacleManager.update(dt);

      if (this.powerUpManager) {
        const pickupCharacters = this.activeRole === 'runner' ? [this.runner] : [];
        this.powerUpManager.update(dt, pickupCharacters, elapsedTime);
      }

      if (this.particles) {
        this.particles.update(dt);
      }

      // Runner logic
      if (this.activeRole === 'runner' || this.isLocalDual) {
        this.runner.update(dt);
        this.physics.updateCharacterPhysics(this.runner, dt);

        if (this.lastRunnerPosForDist) {
          const dx = this.runner.position.x - this.lastRunnerPosForDist.x;
          const dz = this.runner.position.z - this.lastRunnerPosForDist.z;
          const moveDist = Math.sqrt(dx * dx + dz * dz);
          if (moveDist > 0.01 && moveDist < 6.0) {
            this.stats.distanceTraversed += moveDist;
          }
        } else {
          this.lastRunnerPosForDist = new THREE.Vector3();
        }
        this.lastRunnerPosForDist.copy(this.runner.position);

        if (this.goalBeacon.checkRunnerInside(this.runner.position)) {
          this.handleGameOver({
            winner: 'runner',
            reason: 'The Runner conquered the obstacles and reached the Beacon Goal!'
          });
          this.goalBeacon.triggerVictoryEffect(this.particles);
          this.network.sendGoalReached();
        }

        if (this.runner.health <= 0) {
          this.handleGameOver({
            winner: 'saboteur',
            reason: 'The Runner was eliminated by obstacles!'
          });
        }

        if (elapsedTime - this.lastNetworkSync > 0.033) {
          this.lastNetworkSync = elapsedTime;
          this.network.sendRunnerMove(this.runner.getState());
        }

        const aiShouldRun = !this.isHumanSaboteurAvailable() && this.aiSaboteur && this.aiSaboteur.enabled;
        if (aiShouldRun) {
          this.aiSaboteur.update(dt, this.runner, this.goalBeacon, true);
        }
      } else {
        this.physics.updateCharacterPhysics(this.runner, dt);
        this.runner.group.position.copy(this.runner.position);
        this.runner.group.rotation.y = this.runner.rotationY;
        this.runner.group.visible = true;
      }

      // Saboteur logic
      if (this.activeRole === 'saboteur' || this.isLocalDual) {
        if (this.activeRole === 'saboteur') {
          this.saboteur.update(dt, this.runner.position);
          this.physics.updateCharacterPhysics(this.saboteur, dt);

          if (this.saboteur.health <= 0) {
            this.handleGameOver({
              winner: 'runner',
              reason: 'The Saboteur was neutralized by obstacles!'
            });
          }

          if (elapsedTime - this.lastSaboteurSync > 0.033) {
            this.lastSaboteurSync = elapsedTime;
            this.network.sendSaboteurMove(this.saboteur.getState());
          }
        }
      } else {
        this.saboteur.update(dt, this.runner.position);
      }

      this.physics.resolveCharacterCollision(this.runner, this.saboteur);
      this.worldManager.update([this.runner.position, this.saboteur.position, this.camera.position], elapsedTime);

      // Throttle React state emission to ~20Hz
      if (elapsedTime - this.lastStateEmit > 0.05) {
        this.lastStateEmit = elapsedTime;
        this.emitState();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  emitState() {
    if (!this.onStateChange) return;

    const activeChar = (this.activeRole === 'saboteur') ? this.saboteur : this.runner;
    let biome = null;
    if (this.worldManager && activeChar) {
      biome = this.worldManager.getDominantBiome(activeChar.position.x, activeChar.position.z);
    }

    const distToBeacon = Math.round(this.goalBeacon.getDistanceTo(this.runner.position));
    const compassAngle = this.goalBeacon.getCompassAngle(this.runner.position, this.runner.rotationY);

    const snapshot = {
      gameState: this.gameState,
      activeRole: this.activeRole,
      isLocalDual: this.isLocalDual,
      roomCode: this.roomCode,
      timeRemaining: this.timeRemaining,
      playerCounts: this.playerCounts,
      environment: {
        biome,
        todName: this.todName,
        todClass: this.todClass,
      },
      runnerStats: {
        health: this.runner.health,
        maxHealth: this.runner.maxHealth,
        stamina: this.runner.stamina,
        maxStamina: GAME_CONFIG.RUNNER.STAMINA_MAX,
        distanceToBeacon: distToBeacon,
        compassAngle,
        sensitivity: this.runner.mouseSensitivity,
        buffs: this.runner.getActiveBuffs(),
        craftingInventory: this.powerUpManager.getInventory(),
      },
      saboteurStats: {
        health: this.saboteur.health,
        maxHealth: this.saboteur.maxHealth,
        stamina: this.saboteur.stamina,
        maxStamina: GAME_CONFIG.RUNNER.STAMINA_MAX,
        energy: this.saboteur.energy,
        maxEnergy: this.saboteur.maxEnergy,
        reconCooldown: this.saboteur.reconCooldown,
        reconCooldownTimer: this.saboteur.reconCooldownTimer,
        selectedType: this.saboteur.selectedType,
        isPlacing: this.saboteur.isPlacing,
        sensitivity: this.saboteur.mouseSensitivity,
        buffs: this.saboteur.getActiveBuffs(),
      },
      placementData: this.placementData,
      gameOverData: this.gameOverData,
      isPointerLocked: this.isPointerLocked,
      damageFlash: this.damageFlash,
      toastMessage: this.toastMessage,
      aiEnabled: Boolean(this.aiSaboteur && this.aiSaboteur.enabled),
      humanSaboteurAvailable: this.isHumanSaboteurAvailable(),
    };

    this.onStateChange(snapshot);
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
    }
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    if (this.network && this.network.ws) {
      this.network.ws.close();
    }
  }
}
