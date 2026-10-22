import * as THREE from '/three/three.module.js';
import {
  GAME_CONFIG,
  OBSTACLES,
  ROLE_DEFINITIONS,
  DAY_NIGHT_CONFIG,
  BIOMES,
  CRAFTING_RECIPES,
  RESOURCES,
} from './config.js';
import { WorldManager } from './world.js';
import { GoalBeacon } from './goal.js';
import { ObstacleManager } from './obstacles.js';
import { PhysicsSystem } from './physics.js';
import { RunnerController } from './runner.js';
import { SaboteurController } from './saboteur.js';
import { NetworkClient } from './network.js';
import { AISaboteur } from './ai_saboteur.js';
import { ParticleSystem } from './particles.js';
import { PowerUpManager } from './powerups.js';
import { audio } from './audio.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.activeRole = 'runner'; // 'runner', 'saboteur', or 'spectator'
    this.isLocalDual = false; // Toggle to control both on one screen
    this.gameState = 'PLAYING';
    this.timeRemaining = GAME_CONFIG.ROUND_TIME;
    this.playerCounts = { runner: 1, saboteur: 0, spectator: 0 };

    const params = new URLSearchParams(window.location.search);
    this.roomCode = params.get('room') || 'default';

    this.clock = new THREE.Clock();
    this.lastNetworkSync = 0;
    this.lastSaboteurSync = 0;

    // Phase 3: Dynamic World Time & Match Performance Statistics
    this.worldTime = 40.0; // Start at pleasant morning/noon
    this.todName = '☀️ MIDDAY';
    this.stats = {
      distanceTraversed: 0,
      resourcesCollected: 0,
      itemsCrafted: 0,
      obstaclesPlaced: 0,
    };
    this.lastRunnerPosForDist = null;

    this.initThree();
    this.initGameSystems();
    this.initUI();
    this.initNetwork();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    // 1. Scene & Atmospheric Fog for Open Plains
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7eaec9);
    this.scene.fog = new THREE.FogExp2(0x7eaec9, 0.005);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    this.ambientLight = new THREE.AmbientLight(0xdde8f0, 1.35);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7e2, 2.2);
    this.sunLight.position.set(70, 130, 60);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 300;
    const shadowDist = 70;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.scene.add(this.sunLight);

    // Window Resize Handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initGameSystems() {
    // 0. Particle System (GPU dust, sparks, explosions, debris, water splashes)
    this.particles = new ParticleSystem(this.scene);

    // 1. World & Terrain Manager
    this.worldManager = new WorldManager(this.scene, 1337);

    // 2. Obstacle Manager
    this.obstacleManager = new ObstacleManager(this.scene, this.worldManager);

    // 3. Physics System
    this.physics = new PhysicsSystem(this.worldManager, this.obstacleManager);

    // 4. Goal Beacon
    this.goalBeacon = new GoalBeacon(this.scene, this.worldManager);
    this.goalBeacon.setPosition(120, 120);

    // 5. Runner Avatar & Controller
    this.runner = new RunnerController(this.scene, this.camera, this.renderer.domElement);
    this.runner.goalBeacon = this.goalBeacon;
    this.runner.particles = this.particles;
    this.runner.physics = this.physics;
    this.runner.worldManager = this.worldManager;
    const startY = this.worldManager.getHeightAt(0, 0);
    this.runner.setState({ x: 0, y: startY + 1.0, z: 0, ry: 0 });

    // 6. Saboteur Tactical Controller
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

    // Phase 3: Power-Up Items Manager
    this.powerUpManager = new PowerUpManager(
      this.scene,
      this.worldManager,
      this.particles,
      (id, type, role) => {
        this.stats.resourcesCollected += 1;
        if (this.network) {
          this.network.sendPowerupCollect(id, type, role);
        }
      }
    );

    // Spawn power-up items as terrain chunks are generated.
    this.worldManager.onChunkCreated = (cx, cz) => {
      this.powerUpManager.populateChunk(cx, cz);
    };
    this.worldManager.onChunksCleared = () => {
      this.powerUpManager.clear();
    };

    // Populate initial chunks
    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        this.powerUpManager.populateChunk(cx, cz);
      }
    }

    // Connect Saboteur Recon Pulse broadcast
    this.saboteur.onReconCallback = (origin) => {
      if (this.network) {
        this.network.sendReconScan(origin);
      }
    };

    // Connect Obstacle Explosion & Destruction broadcasts
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

    // 7. Autonomous AI Saboteur (Auto-places obstacles in front of runner & pilots 3D Saboteur model)
    this.aiSaboteur = new AISaboteur(
      this.worldManager,
      this.obstacleManager,
      (type, pos, rot) => this.onObstaclePlaced(type, pos, rot),
      this.saboteur
    );
  }

  initNetwork() {
    // Detect role & room from URL query param: ?role=runner&room=XYZ
    const params = new URLSearchParams(window.location.search);
    const preferredRole = params.get('role') || 'auto';
    this.isLocalDual = params.get('mode') === 'local';

    if (params.get('role') || params.get('mode') === 'local') {
      const modal = document.getElementById('modal-role-select');
      if (modal) modal.style.display = 'none';
      document.body.classList.remove('cursor-unlocked');
    }

    // Update Room Badge & Modal Input
    const roomBadge = document.getElementById('room-badge');
    if (roomBadge) roomBadge.innerText = this.roomCode;
    const roomInput = document.getElementById('room-input');
    if (roomInput) roomInput.value = this.roomCode;

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
        this.updateHUDTimer();
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
        this.updateHUDTimer();
      },

      onGameOver: (msg) => {
        this.handleGameOver(msg);
      },

      onRoundStarted: (msg) => {
        this.resetRound(msg);
      },

      onPlayersUpdated: (counts) => {
        this.playerCounts = counts;
        const el = document.getElementById('lobby-status');
        if (el) {
          el.innerText = `Players: ${counts.runner} Runner | ${counts.saboteur} Saboteur | ${counts.spectator} Spectator`;
        }
        this.updateAISaboteurStatus();
      },

      onPowerupCollected: (data) => {
        if (this.powerUpManager) {
          this.powerUpManager.handleRemoteCollect(data.id);
        }
      }
    }, this.roomCode);
  }

  isHumanSaboteurAvailable() {
    // 1. Current local player is playing as Saboteur
    if (this.activeRole === 'saboteur') return true;
    // 2. Playing in local dual mode (human player controls both)
    if (this.isLocalDual) return true;
    // 3. In multiplayer, another connected player is Saboteur
    if (this.playerCounts && this.playerCounts.saboteur > 0) return true;
    return false;
  }

  updateAISaboteurStatus() {
    const aiToggle = document.getElementById('ai-saboteur-toggle');
    if (!aiToggle) return;

    if (this.isHumanSaboteurAvailable()) {
      aiToggle.innerText = '👤 Human Saboteur: ACTIVE (AI Standby)';
      aiToggle.className = 'ai-standby';
      if (this.aiSaboteur) {
        this.aiSaboteur.enabled = false;
      }
    } else {
      if (this.aiSaboteur && this.aiSaboteur.enabled) {
        aiToggle.innerText = '🤖 AI Saboteur: ACTIVE (Auto-Hazards)';
        aiToggle.className = 'ai-active';
      } else {
        aiToggle.innerText = '🤖 AI Saboteur: DISABLED';
        aiToggle.className = 'ai-disabled';
      }
    }
  }

  setRole(role) {
    this.activeRole = role;

    const runnerHUD = document.getElementById('runner-hud');
    const saboteurHUD = document.getElementById('saboteur-hud');
    const roleBadge = document.getElementById('role-badge');
    const aimReticle = document.getElementById('aim-reticle');
    const cursorHint = document.getElementById('cursor-unlock-hint');
    const localHint = document.getElementById('local-dual-hint');

    if (localHint) {
      localHint.style.display = this.isLocalDual ? 'block' : 'none';
    }

    if (roleBadge) {
      roleBadge.innerText = role.toUpperCase();
      roleBadge.className = `role-tag ${role}`;
    }

    if (role === 'runner') {
      this.runner.enabled = true;
      this.saboteur.enabled = false;
      document.body.classList.add('runner-mode');
      document.body.classList.remove('saboteur-placing');
      document.body.classList.remove('cursor-unlocked');
      const indicator = document.getElementById('placement-indicator');
      if (indicator) indicator.style.display = 'none';
      if (aimReticle) aimReticle.style.display = 'block';
      if (cursorHint) cursorHint.style.display = 'block';
      runnerHUD.style.display = 'block';
      saboteurHUD.style.display = 'none';
      this.obstacleManager.hidePreview();
      try { this.renderer.domElement.requestPointerLock(); } catch(e) {}
    } else if (role === 'saboteur') {
      this.runner.enabled = false;
      this.saboteur.enabled = true;
      document.body.classList.remove('runner-mode');
      document.body.classList.remove('cursor-unlocked');
      runnerHUD.style.display = 'none';
      saboteurHUD.style.display = 'block';
      if (aimReticle) aimReticle.style.display = 'block';
      if (cursorHint) cursorHint.style.display = 'block';
      if (this.saboteur.isPlacing && this.saboteur.selectedType) {
        document.body.classList.add('saboteur-placing');
      } else {
        document.body.classList.remove('saboteur-placing');
      }
      this.saboteur.refreshPreview();
      try { this.renderer.domElement.requestPointerLock(); } catch(e) {}
    } else {
      // Spectator
      this.runner.enabled = false;
      this.saboteur.enabled = false;
      document.body.classList.remove('runner-mode');
      document.body.classList.remove('cursor-locked');
      document.body.classList.add('cursor-unlocked');
      document.body.classList.remove('saboteur-placing');
      const indicator = document.getElementById('placement-indicator');
      if (indicator) indicator.style.display = 'none';
      if (aimReticle) aimReticle.style.display = 'none';
      if (cursorHint) cursorHint.style.display = 'none';
      runnerHUD.style.display = 'block';
      saboteurHUD.style.display = 'none';
      this.obstacleManager.hidePreview();
    }

    this.updateAISaboteurStatus();
  }

  initUI() {
    // Role selection tabs in lobby / overlay
    window.switchRole = (role) => {
      this.setRole(role);
    };

    // Hotbar obstacle button selection
    window.onObstacleSelected = (type) => {
      document.querySelectorAll('.hotbar-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.type === type);
      });
    };

    const recipeList = document.getElementById('recipe-list');
    if (recipeList) {
      recipeList.addEventListener('click', (event) => {
        const button = event.target.closest('.recipe-button');
        if (!button || button.disabled || this.activeRole !== 'runner') return;
        if (button.dataset.action === 'craft') {
          const result = this.powerUpManager.craft(button.dataset.item);
          if (result.success) {
            this.stats.itemsCrafted += 1;
            this.showCraftingMessage(`Crafted ${result.item.name}.`);
          } else {
            this.showCraftingMessage(result.reason);
          }
        } else if (button.dataset.action === 'use') {
          const result = this.powerUpManager.useItem(button.dataset.item, this.runner);
          this.showCraftingMessage(
            result.success ? `Used ${result.item.name}.` : result.reason,
          );
        }
        this.updateCraftingHUD();
      });
    }

    document.querySelectorAll('.hotbar-item').forEach((item) => {
      item.addEventListener('click', () => {
        if (!this.saboteur.enabled) return;
        const type = item.dataset.type;
        this.saboteur.selectObstacle(type);
      });
    });

    // Toggle local dual mode with Tab key (Only active in explicit Local Dual Mode)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' && this.isLocalDual) {
        e.preventDefault();
        const nextRole = this.activeRole === 'runner' ? 'saboteur' : 'runner';
        this.setRole(nextRole);
      }
    });

    // Play again button
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.network.requestRestart();
      });
    }

    // Room Selection helpers
    const getTargetRoom = () => {
      const roomInp = document.getElementById('room-input');
      return (roomInp && roomInp.value.trim()) ? roomInp.value.trim() : 'default';
    };

    const randomRoomBtn = document.getElementById('btn-random-room');
    if (randomRoomBtn) {
      randomRoomBtn.addEventListener('click', () => {
        const adjectives = ['alpha', 'delta', 'vortex', 'cyber', 'titan', 'apex', 'sol', 'nova'];
        const num = Math.floor(100 + Math.random() * 900);
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const input = document.getElementById('room-input');
        if (input) input.value = `${adj}-${num}`;
      });
    }

    // Role select modal buttons
    const selectRunnerBtn = document.getElementById('btn-select-runner');
    const selectSaboteurBtn = document.getElementById('btn-select-saboteur');
    const selectLocalBtn = document.getElementById('btn-select-local');

    if (selectRunnerBtn) {
      selectRunnerBtn.addEventListener('click', () => {
        const targetRoom = getTargetRoom();
        if (targetRoom !== this.roomCode) {
          window.location.href = `?role=runner&room=${encodeURIComponent(targetRoom)}`;
          return;
        }
        document.getElementById('modal-role-select').style.display = 'none';
        document.body.classList.remove('cursor-unlocked');
        this.setRole('runner');
        audio.ensureContext();
        try { this.renderer.domElement.requestPointerLock(); } catch(e) {}
      });
    }
    if (selectSaboteurBtn) {
      selectSaboteurBtn.addEventListener('click', () => {
        const targetRoom = getTargetRoom();
        if (targetRoom !== this.roomCode) {
          window.location.href = `?role=saboteur&room=${encodeURIComponent(targetRoom)}`;
          return;
        }
        document.getElementById('modal-role-select').style.display = 'none';
        document.body.classList.remove('cursor-unlocked');
        this.setRole('saboteur');
        audio.ensureContext();
        try { this.renderer.domElement.requestPointerLock(); } catch(e) {}
      });
    }
    if (selectLocalBtn) {
      selectLocalBtn.addEventListener('click', () => {
        const targetRoom = getTargetRoom();
        if (targetRoom !== this.roomCode) {
          window.location.href = `?mode=local&room=${encodeURIComponent(targetRoom)}`;
          return;
        }
        document.getElementById('modal-role-select').style.display = 'none';
        document.body.classList.remove('cursor-unlocked');
        this.isLocalDual = true;
        this.setRole('runner');
        const badge = document.getElementById('local-dual-hint');
        if (badge) badge.style.display = 'block';
        audio.ensureContext();
        try { this.renderer.domElement.requestPointerLock(); } catch(e) {}
      });
    }

    // Recon Pulse Button (Saboteur HUD)
    const reconBtn = document.getElementById('btn-recon-pulse');
    if (reconBtn) {
      reconBtn.addEventListener('click', () => {
        if (this.saboteur) {
          this.saboteur.triggerReconPulse(this.runner.position);
        }
      });
    }

    // AI Saboteur Toggle Button
    const aiToggle = document.getElementById('ai-saboteur-toggle');
    if (aiToggle) {
      aiToggle.addEventListener('click', () => {
        if (this.aiSaboteur) {
          this.aiSaboteur.enabled = !this.aiSaboteur.enabled;
          this.updateAISaboteurStatus();
        }
      });
    }

    // Seeing Direction Buttons (Single Third-Person Camera)

    const btnLookGoal = document.getElementById('btn-look-goal');
    if (btnLookGoal) {
      btnLookGoal.addEventListener('click', () => {
        this.runner.lookAtGoal();
      });
    }

    const btnLookBehind = document.getElementById('btn-look-behind');
    if (btnLookBehind) {
      btnLookBehind.addEventListener('click', () => {
        this.runner.lookBehind();
      });
    }

    const btnToggleSteering = document.getElementById('btn-toggle-steering');
    if (btnToggleSteering) {
      btnToggleSteering.addEventListener('click', () => {
        this.runner.toggleSteeringMode();
      });
    }

    const btnCycleSens = document.getElementById('btn-cycle-sens');
    if (btnCycleSens) {
      btnCycleSens.addEventListener('click', () => {
        this.runner.cycleSensitivity();
      });
    }
  }

  onObstaclePlaced(type, pos, rot) {
    this.stats.obstaclesPlaced += 1;

    // If playing in local mode or server disconnected, spawn immediately locally
    if (this.isLocalDual || !this.network.connected) {
      this.obstacleManager.spawnObstacle(
        'obs_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        type,
        pos,
        rot
      );
    }
    // Broadcast via WebSocket server
    this.network.sendPlaceObstacle(type, pos, rot);
  }

  showCraftingMessage(message) {
    const element = document.getElementById('crafting-message');
    if (element) element.innerText = message;
  }

  updateCraftingHUD() {
    if (!this.powerUpManager) return;
    if (this.lastCraftingInventoryVersion === this.powerUpManager.inventoryVersion) return;
    this.lastCraftingInventoryVersion = this.powerUpManager.inventoryVersion;
    const inventory = this.powerUpManager.getInventory();

    const resourceInventory = document.getElementById('resource-inventory');
    if (resourceInventory) {
      resourceInventory.innerHTML = Object.values(RESOURCES).map((resource) => `
        <span class="resource-count" title="${resource.name}">
          <span aria-hidden="true">${resource.icon}</span>
          <span>${inventory.resources[resource.id] || 0}</span>
        </span>
      `).join('');
    }

    const recipeList = document.getElementById('recipe-list');
    if (!recipeList) return;
    recipeList.innerHTML = Object.values(CRAFTING_RECIPES).map((recipe) => {
      const itemCount = inventory.items[recipe.id] || 0;
      const canCraft = Object.entries(recipe.ingredients).every(
        ([resourceId, amount]) => (inventory.resources[resourceId] || 0) >= amount,
      );
      const ingredients = Object.entries(recipe.ingredients)
        .map(([resourceId, amount]) => `${RESOURCES[resourceId].icon} ${amount}`)
        .join(' + ');
      return `
        <div class="recipe-row">
          <div class="recipe-info">
            <span class="recipe-name">${recipe.icon} ${recipe.name}</span>
            <span class="recipe-ingredients">${ingredients} · ${recipe.description}</span>
          </div>
          <div class="recipe-actions">
            <button type="button" class="recipe-button" data-action="craft" data-item="${recipe.id}" ${canCraft ? '' : 'disabled'}>Craft</button>
            <button type="button" class="recipe-button use-recipe-button" data-action="use" data-item="${recipe.id}" ${itemCount > 0 ? '' : 'disabled'}>Use${itemCount > 0 ? ` (${itemCount})` : ''}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  handleGameOver(msg) {
    this.gameState = 'FINISHED';
    const modal = document.getElementById('game-over-modal');
    const title = document.getElementById('game-over-title');
    const desc = document.getElementById('game-over-desc');
    const scoreVal = document.getElementById('game-over-score');

    if (modal) {
      modal.style.display = 'flex';
      if (msg.winner === 'runner') {
        title.innerText = 'RUNNER ESCAPED!';
        title.style.color = '#00ffff';
        desc.innerText = msg.reason || 'The Runner conquered the obstacles and reached the Beacon!';
        audio.playWin();
      } else {
        title.innerText = 'SABOTEUR VICTORIOUS!';
        title.style.color = '#ff3344';
        desc.innerText = msg.reason || 'Time ran out! The Runner was halted by the obstacles.';
        audio.playLose();
      }

      if (msg.scores) {
        scoreVal.innerText = `Score — Runner: ${msg.scores.runner} | Saboteur: ${msg.scores.saboteur}`;
      }

      // Phase 3: Detailed Match Performance Stats & Persistent High Scores
      const statsContainer = document.getElementById('match-stats-container');
      if (statsContainer) {
        const timeElapsed = Math.max(1, Math.round(GAME_CONFIG.ROUND_TIME - this.timeRemaining));
        const dist = Math.round(this.stats.distanceTraversed);
        const resources = this.stats.resourcesCollected;
        const traps = this.stats.obstaclesPlaced;

        // Retrieve best records from localStorage
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

        statsContainer.innerHTML = `
          <div class="match-stats-title">📊 MATCH PERFORMANCE METRICS</div>
          <div class="match-stats-grid">
            <div class="stat-item">
              <span class="stat-name">🏃 Traversed Distance:</span>
              <span class="stat-value">${dist}m ${isNewBestDist ? '<span class="stat-best">★ RECORD</span>' : ''}</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">🧰 Resources Gathered:</span>
              <span class="stat-value">${resources} ${isNewBestResources ? '<span class="stat-best">★ RECORD</span>' : ''}</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">🧱 Traps Deployed:</span>
              <span class="stat-value">${traps}</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">⏱️ Match Duration:</span>
              <span class="stat-value">${timeElapsed}s</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">🏆 All-Time Record Distance:</span>
              <span class="stat-value" style="color: #ffaa00;">${bestStats.bestDist || dist}m</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">⭐ All-Time Resource Record:</span>
              <span class="stat-value" style="color: #00d4ff;">${bestStats.bestResources || resources}</span>
            </div>
          </div>
        `;
      }
    }
  }

  resetRound(msg) {
    this.gameState = 'PLAYING';
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.style.display = 'none';

    // Reset stats
    this.stats = {
      distanceTraversed: 0,
      resourcesCollected: 0,
      itemsCrafted: 0,
      obstaclesPlaced: 0,
    };
    this.lastRunnerPosForDist = null;

    // New seed and terrain
    if (msg.seed) this.worldManager.setSeed(msg.seed);
    if (msg.goalPosition) {
      this.goalBeacon.setPosition(msg.goalPosition.x, msg.goalPosition.z);
      this.runner.goalBeacon = this.goalBeacon;
      this.saboteur.goalBeacon = this.goalBeacon;
    }

    // Reset obstacles and power-up items.
    this.obstacleManager.clear();
    if (this.powerUpManager) {
      this.powerUpManager.clear();
      for (let cx = -2; cx <= 2; cx++) {
        for (let cz = -2; cz <= 2; cz++) {
          this.powerUpManager.populateChunk(cx, cz);
        }
      }
    }

    // Reset runner position, buffs & health
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

    // Reset saboteur position, buffs & health
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
  }

  updateHUDTimer() {
    const timerEl = document.getElementById('hud-timer');
    if (!timerEl) return;

    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;
    timerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    if (this.timeRemaining <= 15) {
      timerEl.classList.add('urgent');
      audio.playTick();
    } else {
      timerEl.classList.remove('urgent');
    }
  }

  // Phase 3: Dynamic Celestial Day/Night Cycle & Sky Lighting
  updateDayNightCycle(dt) {
    this.worldTime += dt;
    const cycle = DAY_NIGHT_CONFIG.CYCLE_DURATION || 180;
    const progress = (this.worldTime % cycle) / cycle; // [0, 1)

    // Quadrants:
    // 0.00 - 0.25: DAWN -> NOON
    // 0.25 - 0.50: NOON -> DUSK
    // 0.50 - 0.75: DUSK -> NIGHT
    // 0.75 - 1.00: NIGHT -> DAWN
    const C = DAY_NIGHT_CONFIG.COLORS;
    let from, to, t, todLabel, todClass;

    if (progress < 0.25) {
      from = C.DAWN;
      to = C.NOON;
      t = progress / 0.25;
      todLabel = '🌅 DAWN';
      todClass = 'dawn';
    } else if (progress < 0.50) {
      from = C.NOON;
      to = C.DUSK;
      t = (progress - 0.25) / 0.25;
      todLabel = '☀️ MIDDAY';
      todClass = 'noon';
    } else if (progress < 0.75) {
      from = C.DUSK;
      to = C.NIGHT;
      t = (progress - 0.50) / 0.25;
      todLabel = '🌇 SUNSET';
      todClass = 'dusk';
    } else {
      from = C.NIGHT;
      to = C.DAWN;
      t = (progress - 0.75) / 0.25;
      todLabel = '🌙 STARRY NIGHT';
      todClass = 'night';
    }

    this.todName = todLabel;
    this.todClass = todClass;

    // Interpolate colors
    const sunColor = new THREE.Color(from.sun).lerp(new THREE.Color(to.sun), t);
    const skyColor = new THREE.Color(from.sky).lerp(new THREE.Color(to.sky), t);
    const fogColor = new THREE.Color(from.fog).lerp(new THREE.Color(to.fog), t);
    const ambColor = new THREE.Color(from.ambient).lerp(new THREE.Color(to.ambient), t);
    const ambInt = THREE.MathUtils.lerp(from.ambientIntensity, to.ambientIntensity, t);

    // Celestial Sun Orbit
    const sunAngle = progress * Math.PI * 2;
    const dist = DAY_NIGHT_CONFIG.SUN_DISTANCE || 180;
    const charPos = this.activeRole === 'saboteur' ? this.saboteur.position : this.runner.position;

    this.sunLight.position.set(
      charPos.x + Math.cos(sunAngle) * dist,
      Math.max(15, Math.sin(sunAngle) * dist + 20),
      charPos.z + Math.sin(sunAngle * 0.5) * (dist * 0.4)
    );
    this.sunLight.target.position.copy(charPos);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.color.copy(sunColor);

    // Dimmer shadows & intensity at night
    this.sunLight.intensity = Math.max(0.35, Math.sin(sunAngle) * 1.8 + 0.6);

    // Ambient, Fog & Sky
    this.ambientLight.color.copy(ambColor);
    this.ambientLight.intensity = ambInt;
    this.scene.background.copy(skyColor);
    this.scene.fog.color.copy(fogColor);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    if (this.gameState === 'PLAYING') {
      // Phase 3: Dynamic Celestial Day/Night progression
      this.updateDayNightCycle(dt);

      // 1. Update Goal Beacon
      this.goalBeacon.update(dt, elapsedTime);

      // 2. Update Obstacle Physics (e.g. Rolling Boulders)
      this.obstacleManager.update(dt);

      // Phase 3: Update power-up items.
      if (this.powerUpManager) {
        const pickupCharacters = this.activeRole === 'runner' ? [this.runner] : [];
        this.powerUpManager.update(dt, pickupCharacters, elapsedTime);
      }

      // GPU Particle System
      if (this.particles) {
        this.particles.update(dt);
      }

      // 3. Update active controller & physics
      if (this.activeRole === 'runner' || this.isLocalDual) {
        this.runner.update(dt);
        this.physics.updateCharacterPhysics(this.runner, dt);

        // Track Runner distance traversed for match metrics
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

        // Immediate Goal Beacon Victory Check!
        if (this.goalBeacon.checkRunnerInside(this.runner.position)) {
          this.handleGameOver({
            winner: 'runner',
            reason: 'The Runner conquered the obstacles and reached the Beacon Goal!'
          });
          this.goalBeacon.triggerVictoryEffect(this.particles);
          this.network.sendGoalReached();
        }

        // Runner Elimination Check
        if (this.runner.health <= 0) {
          this.handleGameOver({
            winner: 'saboteur',
            reason: 'The Runner was eliminated by obstacles!'
          });
        }

        // Network Sync of Runner position (at 30Hz)
        if (elapsedTime - this.lastNetworkSync > 0.033) {
          this.lastNetworkSync = elapsedTime;
          this.network.sendRunnerMove(this.runner.getState());
        }

        // Automatic Obstacle Placement & AI character maneuvering ONLY when no human Saboteur is available
        const aiShouldRun = !this.isHumanSaboteurAvailable() && this.aiSaboteur && this.aiSaboteur.enabled;
        if (aiShouldRun) {
          this.aiSaboteur.update(dt, this.runner, this.goalBeacon, true);
        }
      } else {
        // Keep Runner 3D Character positioned, grounded and visible for the Saboteur / Spectator
        this.physics.updateCharacterPhysics(this.runner, dt);
        this.runner.group.position.copy(this.runner.position);
        this.runner.group.rotation.y = this.runner.rotationY;
        this.runner.group.visible = true;
      }

      if (this.activeRole === 'saboteur' || this.isLocalDual) {
        if (this.activeRole === 'saboteur') {
          this.saboteur.update(dt, this.runner.position);
          this.physics.updateCharacterPhysics(this.saboteur, dt);

          // Saboteur Elimination Check
          if (this.saboteur.health <= 0) {
            this.handleGameOver({
              winner: 'runner',
              reason: 'The Saboteur was neutralized by obstacles!'
            });
          }

          // Network Sync of Saboteur Character position (at 30Hz)
          if (elapsedTime - this.lastSaboteurSync > 0.033) {
            this.lastSaboteurSync = elapsedTime;
            this.network.sendSaboteurMove(this.saboteur.getState());
          }
        }
      } else {
        // Keep Saboteur 3D Character animating in the scene for the Runner
        this.saboteur.update(dt, this.runner.position);
      }

      // 4. Update Infinite World Chunks around both characters
      this.worldManager.update([this.runner.position, this.saboteur.position, this.camera.position], elapsedTime);

      // 5. Update HUD elements
      this.updateHUD(elapsedTime);
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  updateHUD(time) {
    this.updateCraftingHUD();
    const activeChar = (this.activeRole === 'saboteur') ? this.saboteur : this.runner;

    // Phase 3: Current Biome Detection & Badge
    if (this.worldManager && typeof this.worldManager.getDominantBiome === 'function') {
      const biome = this.worldManager.getDominantBiome(activeChar.position.x, activeChar.position.z);
      const biomeBadge = document.getElementById('biome-badge');
      if (biomeBadge && biome) {
        const icons = { LUSH: '🌿', DESERT: '🏜️', SNOW: '❄️', VOLCANIC: '🌋' };
        biomeBadge.innerText = `${icons[biome.id] || '🌍'} ${biome.name}`;
        biomeBadge.className = `biome-tag ${biome.id.toLowerCase()}`;
      }
    }

    // Phase 3: Celestial Time of Day Badge
    const todBadge = document.getElementById('tod-badge');
    if (todBadge) {
      todBadge.innerText = this.todName || '☀️ MIDDAY';
      todBadge.className = `tod-tag ${this.todClass || 'noon'}`;
    }

    // Phase 3: Active Power-Up Buff Badges
    const targetBuffContainerId = (this.activeRole === 'saboteur') ? 'saboteur-buffs' : 'runner-buffs';
    const buffContainer = document.getElementById(targetBuffContainerId);
    if (buffContainer && activeChar && activeChar.getActiveBuffs) {
      const buffs = activeChar.getActiveBuffs();
      if (buffs.length === 0) {
        buffContainer.innerHTML = '';
      } else {
        buffContainer.innerHTML = buffs.map(b => `
          <div class="buff-badge" style="border: 1px solid ${b.color};">
            <div class="buff-left">
              <span class="buff-icon">${b.icon}</span>
              <span class="buff-name" style="color: ${b.color};">${b.name}</span>
            </div>
            <span class="buff-timer" style="color: ${b.color};">${b.timeLeft.toFixed(1)}s</span>
          </div>
        `).join('');
      }
    }

    // 1. Compass & Distance to Goal
    const compassArrow = document.getElementById('compass-arrow');
    const distanceMeter = document.getElementById('distance-meter');

    if (compassArrow && distanceMeter) {
      const dist = Math.round(this.goalBeacon.getDistanceTo(this.runner.position));
      distanceMeter.innerText = `${dist}m`;

      const relAngle = this.goalBeacon.getCompassAngle(this.runner.position, this.runner.rotationY);
      compassArrow.style.transform = `rotate(${relAngle}rad)`;
    }

    // 2. Runner Health Bar
    const runnerHealthFill = document.getElementById('runner-health-fill');
    const runnerHealthText = document.getElementById('runner-health-text');
    if (runnerHealthFill && runnerHealthText) {
      const pct = (this.runner.health / this.runner.maxHealth) * 100;
      runnerHealthFill.style.width = `${pct}%`;
      runnerHealthText.innerText = `${Math.ceil(this.runner.health)} / ${this.runner.maxHealth}`;
      if (this.runner.health < 30) {
        runnerHealthText.style.color = '#ff3344';
      } else {
        runnerHealthText.style.color = 'var(--neon-green)';
      }
    }

    // 3. Runner Stamina Bar
    const staminaBar = document.getElementById('stamina-fill');
    if (staminaBar) {
      const pct = (this.runner.stamina / GAME_CONFIG.RUNNER.STAMINA_MAX) * 100;
      staminaBar.style.width = `${pct}%`;
    }

    // 4. Saboteur Health Bar
    const saboteurHealthFill = document.getElementById('saboteur-health-fill');
    const saboteurHealthText = document.getElementById('saboteur-health-text');
    if (saboteurHealthFill && saboteurHealthText) {
      const pct = (this.saboteur.health / this.saboteur.maxHealth) * 100;
      saboteurHealthFill.style.width = `${pct}%`;
      saboteurHealthText.innerText = `${Math.ceil(this.saboteur.health)} / ${this.saboteur.maxHealth}`;
      if (this.saboteur.health < 30) {
        saboteurHealthText.style.color = '#ff3344';
      } else {
        saboteurHealthText.style.color = 'var(--neon-green)';
      }
    }

    // 5. Saboteur Stamina Bar
    const saboteurStaminaFill = document.getElementById('saboteur-stamina-fill');
    if (saboteurStaminaFill) {
      const pct = (this.saboteur.stamina / GAME_CONFIG.RUNNER.STAMINA_MAX) * 100;
      saboteurStaminaFill.style.width = `${pct}%`;
    }

    // 6. Saboteur Energy Bar
    const energyBar = document.getElementById('energy-fill');
    const energyText = document.getElementById('energy-text');
    if (energyBar && energyText) {
      const pct = (this.saboteur.energy / this.saboteur.maxEnergy) * 100;
      energyBar.style.width = `${pct}%`;
      energyText.innerText = `${Math.floor(this.saboteur.energy)} / ${this.saboteur.maxEnergy}`;
    }
  }
}

// Start Game on page load
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
});
