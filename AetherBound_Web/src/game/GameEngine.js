import * as THREE from 'three';
import { GAME_CONFIG, OBSTACLES, DAYLIGHT_CONFIG } from './config.js';
import { WorldManager } from './world.js';
import { ObstacleManager } from './obstacles.js';
import { PhysicsSystem } from './physics.js';
import { RunnerController } from './entities/Runner.js';
import { SaboteurController } from './entities/Saboteur.js';
import { NetworkClient } from './network.js';
import { AISaboteur } from './ai_saboteur.js';
import { ParticleSystem } from './particles.js';
import { PowerUpManager } from './powerups.js';
import { audio } from './audio.js';
import { requestPointerLock as lockPointer } from './pointerLock.js';
import { ITEM_DEFINITIONS, KNIFE_RULES, WEAPON_DEFINITIONS, WEAPON_CRAFTING_RECIPES } from './data/combat.js';
import { RESOURCE_DEFINITIONS, getWeatherState } from './data/world.js';
import { normalizeMatchConfig } from './data/matchModes.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VoiceManager } from './voice/VoiceManager.js';

function disposeThreeObject(root) {
  root?.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

function drawPlayerNameplate(canvas, ctx, name, health, maxHealth, color = '#00f0ff', isAlive = true, isBot = false, isSpeaking = false, isMuted = false) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background rounded glass panel with speaking halo glow
  if (isSpeaking) {
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = 'rgba(8, 16, 24, 0.9)';
  ctx.strokeStyle = isSpeaking ? '#00ff88' : (color || '#00f0ff');
  ctx.lineWidth = isSpeaking ? 3.5 : 3;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 12);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0; // Clear shadow

  // Color Indicator Dot
  ctx.fillStyle = isSpeaking ? '#00ff88' : (color || '#00f0ff');
  ctx.beginPath();
  ctx.arc(28, 28, 9, 0, Math.PI * 2);
  ctx.fill();

  // Name Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const cleanName = String(name || 'Survivor').slice(0, 16);
  ctx.fillText(cleanName, 46, 28);
  const textWidth = ctx.measureText(cleanName).width;

  // Bot badge or Voice Indicator
  const curBadgeX = 52 + textWidth;
  if (isBot) {
    const badgeX = Math.min(w - 70, curBadgeX);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, 17, 56, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b8fff0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOT', badgeX + 28, 28);
  } else if (isSpeaking) {
    const badgeX = Math.min(w - 44, curBadgeX);
    // Draw 3 audio wave bars
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(badgeX, 23, 4, 10);
    ctx.fillRect(badgeX + 6, 17, 4, 22);
    ctx.fillRect(badgeX + 12, 20, 4, 16);
  } else if (isMuted) {
    const badgeX = Math.min(w - 38, curBadgeX);
    ctx.fillStyle = '#ff4466';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔇', badgeX + 14, 28);
  }

  // Health Bar
  const barX = 20;
  const barY = 48;
  const barW = w - 40;
  const barH = 18;
  const maxHp = maxHealth || 100;
  const curHp = Math.max(0, Math.min(maxHp, health ?? maxHp));
  const hpRatio = maxHp > 0 ? curHp / maxHp : 0;

  // Track
  ctx.fillStyle = 'rgba(20, 28, 38, 0.95)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 5);
  ctx.fill();

  if (isAlive && curHp > 0) {
    const fillColor = hpRatio > 0.5 ? '#00ff88' : hpRatio > 0.25 ? '#ffaa00' : '#ff3344';
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(barX + 1, barY + 1, Math.max(4, (barW - 2) * hpRatio), barH - 2, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(curHp)} / ${maxHp}`, barX + barW / 2, barY + barH / 2);
  } else {
    ctx.fillStyle = '#ff4466';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💀 ELIMINATED', barX + barW / 2, barY + barH / 2);
  }
}

export class GameEngine {
  constructor(containerElement, onStateChange) {
    this.container = containerElement;
    this.onStateChange = onStateChange;

    this.activeRole = 'player';
    this.gameState = 'ROLE_SELECT';
    this.playerCounts = { total: 1, alive: 1, max: 5 };
    this.competitors = [];
    this.killfeed = [];
    this.localPlayerColor = '#00f0ff';
    this.localPlayerSlot = 0;

    const params = new URLSearchParams(window.location.search);
    this.roomCode = params.get('room') || 'default';
    this.matchConfig = normalizeMatchConfig({
      mode: params.get('mode'),
      seed: params.get('seed'),
      fillBots: params.get('bots'),
    });
    const navigationEntry = performance.getEntriesByType('navigation')[0];
    const preferredRole = navigationEntry?.type === 'reload' ? null : params.get('role');
    this.returningToMenu = params.get('menu') === '1';
    this.roleSelectMessage = '';

    if (preferredRole) {
      this.activeRole = preferredRole;
    }

    this.clock = new THREE.Clock();
    this.lastNetworkSync = 0;
    this.lastSaboteurSync = 0;
    this.lastStateEmit = 0;
    this.serverStatus = 'WAITING';
    this.gameOverTimeout = null;
    this.aiSaboteurPreferredEnabled = true;

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
    this.playerId = null;
    this.remotePlayers = new Map();
    this.pickupMeshes = new Map();
    this.pickups = [];
    this.hazardMeshes = new Map();
    this.dragonState = { health: 420, maxHealth: 420, alive: true, phase: 'PASSIVE' };
    this.abilityCooldowns = {};
    this.attackCooldownUntil = 0;
    this.reconRevealUntil = 0;
    this.lastTelegraphId = null;
    this.weatherState = getWeatherState(0);
    this.lastWeatherId = null;
    this.matchStats = { kills: 0, survivalTime: 0, itemsCollected: 0, damageDealt: 0, dragonDamage: 0 };
    this.playerResources = {};
    this.equippedWeapon = 'KNIFE';
    this.weapons = ['KNIFE'];
    this.playerAmmo = { PISTOL: 0, GUN: 0, LASER_GUN: 0, PLASMA_CANNON: 0 };
    this.activeTracers = [];
    this.craftingModalOpen = false;
    this.matchHistory = this.loadMatchHistory();

    this.voiceManager = null;
    this.voiceState = {
      isMuted: false,
      isDeafened: false,
      pushToTalk: false,
      isPttPressed: false,
      isSpeaking: false,
      volume: 1.0,
      permissionState: 'prompt',
      peerCount: 0,
      connectedPeers: [],
    };
    this.playerVoiceStatus = new Map();

    this.placementData = {
      visible: false,
      selectedType: 'WALL',
      dist: 16.0,
      maxDist: 75.0,
      hasEnergy: true,
      cost: 30,
      currentEnergy: 100,
      inRange: true,
      isValidPlacement: true,
    };

    this.initThree();
    this.initGameSystems();
    if (preferredRole) this.initNetwork('player');

    if (preferredRole === 'player') {
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
    this.scene.fog = new THREE.FogExp2(0xa8bdb4, 0.0022);

    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
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

    // Runner
    this.runner = new RunnerController(this.scene, this.camera, this.renderer.domElement);
    this.runner.particles = this.particles;
    this.runner.physics = this.physics;
    this.runner.worldManager = this.worldManager;
    this.runner.setCharacterModelReadyHandler(() => this.refreshRemoteCharacterModels());
    const startY = this.worldManager.getHeightAt(0, 0);
    this.runner.setState({ x: 0, y: startY + 1.0, z: 0, ry: 0 });
    this.runner.enabled = false;
    this.worldManager.update([this.runner.position, this.camera.position], 0);

    this.dragonMesh = new THREE.Group();
    this.dragonFallback = new THREE.Group();
    const dragonBody = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0x682c32, roughness: 0.7, emissive: 0x26090c }),
    );
    dragonBody.scale.set(1.3, 0.8, 1.9);
    dragonBody.position.y = 2.3;
    dragonBody.castShadow = true;
    this.dragonFallback.add(dragonBody);
    const dragonHead = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xb73b32, roughness: 0.6 }));
    dragonHead.rotation.x = Math.PI / 2;
    dragonHead.position.set(0, 2.5, -3.2);
    this.dragonFallback.add(dragonHead);
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x3d1822, side: THREE.DoubleSide, roughness: 0.86 });
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.8), wingMaterial);
      wing.position.set(side * 2.5, 3.25, 0.4);
      wing.rotation.set(-0.38, side * 0.22, side * 0.28);
      this.dragonFallback.add(wing);
    }
    this.dragonMesh.add(this.dragonFallback);
    this.dragonBaseY = this.worldManager.getHeightAt(42, -34) + 11;
    this.dragonMesh.position.set(42, this.dragonBaseY, -34);
    this.dragonTargetPosition = new THREE.Vector3(42, this.dragonBaseY, -34);
    this.dragonRenderPosition = this.dragonTargetPosition.clone();
    this.dragonTargetYaw = 0;
    this.scene.add(this.dragonMesh);
    this.dragonMixer = null;
    this.dragonAnimationClips = new Map();
    this.dragonActiveAction = null;
    this.dragonActiveAnimation = null;
    this.loadDragonModel();

    this.dragonBreathBeam = new THREE.Group();
    this.dragonBreathOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 0.3, 1, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff431c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.dragonBreathInner = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 0.08, 1, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd044, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.dragonBreathBeam.add(this.dragonBreathOuter, this.dragonBreathInner);
    this.dragonBreathBeam.visible = false;
    this.scene.add(this.dragonBreathBeam);

    const telegraphMaterial = new THREE.MeshBasicMaterial({ color: 0xff6238, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.dragonTelegraph = new THREE.Mesh(new THREE.CircleGeometry(1, 48), telegraphMaterial);
    this.dragonTelegraph.rotation.x = -Math.PI / 2;
    this.dragonTelegraph.position.y = 0.18;
    this.dragonTelegraph.visible = false;
    this.scene.add(this.dragonTelegraph);
    this.dragonTelegraphRing = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.dragonTelegraphRing.rotation.x = -Math.PI / 2;
    this.dragonTelegraphRing.position.y = 0.2;
    this.dragonTelegraphRing.visible = false;
    this.scene.add(this.dragonTelegraphRing);
    this.dragonBreathTelegraph = null;

    this.onCombatClick = () => {
      if (this.gameState !== 'PLAYING' || this.activeRole !== 'player') return;
      this.attack();
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onCombatClick);
    this.onKeyDownHandler = (event) => {
      if (this.gameState !== 'PLAYING') return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (event.code === 'KeyC' || event.code === 'KeyB') {
        this.toggleCraftingModal();
        return;
      }
      // Weapon Number Keys: 1 to 5
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(event.code)) {
        const slotIdx = Number(event.code.replace('Digit', '')) - 1;
        if (slotIdx >= 0 && slotIdx < this.weapons.length) {
          this.equipWeapon(this.weapons[slotIdx]);
          return;
        }
      }
      // Ability Keys: Q, E, R, F, Z, X
      const abilityKeys = ['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyZ', 'KeyX'];
      const abilityIdx = abilityKeys.indexOf(event.code);
      if (abilityIdx !== -1) {
        const abilities = this.runner?.inventory || [];
        if (abilityIdx < abilities.length) {
          this.activateAbility(abilities[abilityIdx]);
          return;
        }
      }
    };
    window.addEventListener('keydown', this.onKeyDownHandler);

    this.onWheelHandler = (event) => {
      if (this.gameState !== 'PLAYING' || !this.weapons || this.weapons.length <= 1) return;
      if (!this.isPointerLocked) return;
      const curIdx = this.weapons.indexOf(this.equippedWeapon);
      const delta = event.deltaY > 0 ? 1 : -1;
      const nextIdx = (curIdx + delta + this.weapons.length) % this.weapons.length;
      this.equipWeapon(this.weapons[nextIdx]);
    };
    window.addEventListener('wheel', this.onWheelHandler, { passive: true });

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

  loadDragonModel() {
    const loader = new GLTFLoader();
    loader.load('/models/dragon/Ashwing_Drake_Lite.glb', (gltf) => {
      if (this.destroyed) {
        disposeThreeObject(gltf.scene);
        return;
      }

      gltf.scene.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });

      const modelRoot = new THREE.Group();
      modelRoot.scale.setScalar(0.82);
      modelRoot.add(gltf.scene);
      if (this.dragonFallback) {
        this.dragonMesh.remove(this.dragonFallback);
        disposeThreeObject(this.dragonFallback);
        this.dragonFallback = null;
      }
      this.dragonMesh.add(modelRoot);
      this.dragonModelRoot = modelRoot;
      this.dragonMixer = new THREE.AnimationMixer(gltf.scene);
      this.dragonAnimationClips = new Map(gltf.animations.map((clip) => [clip.name, clip]));
      this.playDragonAnimation('fly_loop', true);
    }, undefined, (error) => {
      console.error('Could not load the dragon model.', error);
    });
  }

  playDragonAnimation(name, loop = true) {
    const clip = this.dragonAnimationClips?.get(name);
    if (!clip || !this.dragonMixer || this.dragonActiveAnimation === name) return;
    this.dragonActiveAction?.fadeOut(0.2);
    const action = this.dragonMixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.fadeIn(0.2).play();
    this.dragonActiveAction = action;
    this.dragonActiveAnimation = name;
  }

  initNetwork(preferredRole) {
    this.network = new NetworkClient(preferredRole, {
      onInitState: (msg) => {
        this.serverStatus = msg.status;
        this.playerId = msg.playerId;
        if (msg.room) this.roomCode = msg.room;
        if (msg.matchConfig) this.matchConfig = msg.matchConfig;
        if (this.returningToMenu) {
          this.gameState = 'ROLE_SELECT';
        } else {
          this.setRole('player');
        }
        if (msg.seed) {
          this.worldManager.setSeed(msg.seed);
        }
        if (msg.snapshot) this.applyMatchSnapshot(msg.snapshot);
        if (msg.resumed) this.showToast('Connection restored. You rejoined your match.');
        if (this.playerId) {
          this.voiceManager?.init(this.playerId);
        }
        this.emitState();
      },

      onDisconnected: () => {
        this.serverStatus = 'RECONNECTING';
        this.showToast('Connection lost. Reconnecting to your match…');
        this.voiceManager?.reset();
      },
      onMatchState: (snapshot) => this.applyMatchSnapshot(snapshot),
      onMatchStarted: (message) => {
        this.serverStatus = 'ACTIVE';
        if (message.matchConfig) this.matchConfig = message.matchConfig;
        this.gameState = 'PLAYING';
        this.emitState();
      },
      onMatchResults: (result) => {
        this.applyMatchSnapshot(result.snapshot || {});
        this.handleMatchResults(result);
      },
      onGameEvent: (event) => this.handleGameEvent(event),
      onSessionInUse: (message) => {
        this.returnToMenu(false);
        this.roleSelectMessage = message || 'This player session is already connected.';
        this.emitState();
      },

      onRoleAssigned: (role) => {
        this.activeRole = role;
        this.returningToMenu = false;
        this.roleSelectMessage = '';
        this.setRole(role);
      },

      onRoleAssignmentFailed: (message) => {
        this.roleSelectMessage = message;
        this.emitState();
      },

      onRunnerUpdate: (remoteState) => {
        // Role-specific replication is not used by free-for-all matches.
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

      onRoundStarted: (msg) => {
        this.serverStatus = msg.status || 'PLAYING';
        this.resetRound(msg);
      },

      onReturnToLobby: (msg) => {
        this.serverStatus = 'WAITING';
        if (msg.playerCounts) this.playerCounts = msg.playerCounts;
        this.returnToMenu(false, msg);
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
      },

      onVoiceSignal: (msg) => {
        this.voiceManager?.handleVoiceSignal(msg.senderId, msg.signal);
      },

      onVoiceStatus: (msg) => {
        this.voiceManager?.handleVoiceStatus(msg.playerId, msg.isSpeaking, msg.isMuted, msg.isDeafened);
      },

      onVoicePeerLeft: (msg) => {
        this.voiceManager?.removePeer(msg.playerId);
      },
    }, this.roomCode, this.matchConfig);

    this.voiceManager = new VoiceManager(this.network, {
      onVoiceStateChange: (state) => {
        this.voiceState = state;
        this.emitState();
      },
      onLocalSpeaking: (isSpeaking) => {
        if (this.playerId) {
          this.playerVoiceStatus.set(this.playerId, {
            isSpeaking,
            isMuted: this.voiceState?.isMuted || false,
          });
          this.emitState();
        }
      },
      onPeerSpeakingChange: (peerId, isSpeaking, isMuted) => {
        this.playerVoiceStatus.set(peerId, { isSpeaking, isMuted });
        const remote = this.remotePlayers.get(peerId);
        if (remote) {
          drawPlayerNameplate(
            remote.labelCanvas,
            remote.labelCtx,
            remote.lastDrawnName,
            remote.lastDrawnHealth,
            remote.state?.maxHealth || 100,
            remote.state?.color || '#00f0ff',
            remote.lastDrawnAlive,
            remote.state?.isBot,
            isSpeaking,
            isMuted
          );
          remote.labelTexture.needsUpdate = true;
          remote.lastDrawnSpeaking = isSpeaking;
          remote.lastDrawnMuted = isMuted;
        }
        this.emitState();
      },
    });
  }

  applyMatchSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.players)) return;
    this.serverStatus = snapshot.state || this.serverStatus;
    if (snapshot.matchConfig) this.matchConfig = snapshot.matchConfig;
    if (snapshot.room) this.roomCode = snapshot.room;
    if (snapshot.weather) this.weatherState = snapshot.weather;
    const previousPhase = this.dragonState?.phase;
    this.dragonState = snapshot.dragon || this.dragonState;
    this.playerCounts = {
      total: snapshot.players.length,
      alive: snapshot.players.filter((player) => player.alive).length,
      max: this.matchConfig?.maxPlayers || 5,
    };
    this.competitors = snapshot.players.map((p) => {
      const voice = this.playerVoiceStatus?.get(p.id) || p.voice || {};
      return {
        id: p.id,
        name: p.name,
        slot: p.slot,
        color: p.color || '#00f0ff',
        colorHex: p.colorHex || 0x00f0ff,
        health: p.health,
        maxHealth: p.maxHealth || 100,
        alive: p.alive,
        isBot: Boolean(p.isBot),
        isLocal: p.id === this.playerId,
        stats: p.stats || {},
        kills: p.stats?.kills || 0,
        damageDealt: p.stats?.damageDealt || 0,
        isSpeaking: Boolean(voice.isSpeaking),
        isMuted: Boolean(voice.isMuted),
        voice,
      };
    });

    for (const player of snapshot.players) {
      if (player.id === this.playerId) {
        if (!this.playerSpawned) {
          this.runner.setState({ x: player.x, y: player.y, z: player.z, ry: player.ry, health: player.health });
          this.playerSpawned = true;
        }
        this.runner.health = player.health;
        this.runner.maxHealth = player.maxHealth;
        this.runner.inventory = player.inventory || [];
        this.playerResources = player.resources || {};
        this.matchStats = player.stats || this.matchStats;
        this.abilityCooldowns = player.abilityReadyAt || this.abilityCooldowns;
        this.localPlayerColor = player.color || '#00f0ff';
        this.localPlayerSlot = player.slot ?? 0;
        this.localPlayerName = player.name;
        if (!player.alive) this.runner.enabled = false;
        continue;
      }
      let remote = this.remotePlayers.get(player.id);
      if (!remote) {
        const group = this.runner.cloneCharacterGroup();
        group.traverse((node) => { if (node.isMesh) node.castShadow = true; });

        // Ground runic ring in player's slot color
        const ringGeo = new THREE.RingGeometry(0.72, 0.88, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: player.colorHex || 0x00f0ff,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        });
        const groundRing = new THREE.Mesh(ringGeo, ringMat);
        groundRing.rotation.x = -Math.PI / 2;
        groundRing.position.y = 0.05;
        group.add(groundRing);

        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 320;
        labelCanvas.height = 76;
        const context = labelCanvas.getContext('2d');
        const voiceStatus = this.playerVoiceStatus?.get(player.id) || player.voice || {};
        const isSpeaking = Boolean(voiceStatus.isSpeaking);
        const isMuted = Boolean(voiceStatus.isMuted);
        drawPlayerNameplate(labelCanvas, context, player.name, player.health, player.maxHealth, player.color, player.alive, player.isBot, isSpeaking, isMuted);
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }));
        label.position.y = 2.65;
        label.scale.set(3.2, 0.76, 1);
        group.add(label);
        this.scene.add(group);
        const snapshotTime = performance.now();
        remote = {
          group,
          label,
          labelCanvas,
          labelCtx: context,
          labelTexture,
          groundRing,
          lastDrawnHealth: player.health,
          lastDrawnAlive: player.alive,
          lastDrawnName: player.name,
          lastDrawnSpeaking: isSpeaking,
          lastDrawnMuted: isMuted,
          targetPosition: new THREE.Vector3(player.x, player.y, player.z),
          targetYaw: player.ry || 0,
          targetPitch: player.pitch || 0,
          pitch: player.pitch || 0,
          state: player,
          animator: this.runner.createCharacterAnimator(group),
          lastSnapshotPosition: new THREE.Vector3(player.x, player.y, player.z),
          lastSnapshotAt: snapshotTime,
          animationState: { grounded: true },
          attackTimer: 0,
          hitReactTimer: 0,
        };
        this.remotePlayers.set(player.id, remote);
      } else {
        const voiceStatus = this.playerVoiceStatus?.get(player.id) || player.voice || {};
        const isSpeaking = Boolean(voiceStatus.isSpeaking);
        const isMuted = Boolean(voiceStatus.isMuted);
        if (remote.lastDrawnHealth !== player.health || remote.lastDrawnAlive !== player.alive || remote.lastDrawnName !== player.name || remote.lastDrawnSpeaking !== isSpeaking || remote.lastDrawnMuted !== isMuted) {
          drawPlayerNameplate(remote.labelCanvas, remote.labelCtx, player.name, player.health, player.maxHealth, player.color, player.alive, player.isBot, isSpeaking, isMuted);
          remote.labelTexture.needsUpdate = true;
          remote.lastDrawnHealth = player.health;
          remote.lastDrawnAlive = player.alive;
          remote.lastDrawnName = player.name;
          remote.lastDrawnSpeaking = isSpeaking;
          remote.lastDrawnMuted = isMuted;
        }
        if (remote.groundRing) remote.groundRing.visible = player.alive;
      }
      remote.targetPosition.set(player.x, player.y, player.z);
      remote.targetYaw = player.ry || 0;
      remote.targetPitch = player.pitch || 0;

      const snapshotTime = performance.now();
      const snapshotDelta = Math.max(0.016, (snapshotTime - remote.lastSnapshotAt) / 1000);
      const movementX = player.x - remote.lastSnapshotPosition.x;
      const movementY = player.y - remote.lastSnapshotPosition.y;
      const movementZ = player.z - remote.lastSnapshotPosition.z;
      const horizontalDistance = Math.hypot(movementX, movementZ);
      const snapshotSpeed = horizontalDistance / snapshotDelta;
      const heading = player.ry || 0;
      const forwardX = Math.sin(heading);
      const forwardZ = Math.cos(heading);
      const rightX = Math.cos(heading);
      const rightZ = -Math.sin(heading);
      const movementLength = Math.max(horizontalDistance, 0.001);
      remote.animationState = {
        moving: snapshotSpeed > 1.1,
        sprinting: snapshotSpeed > 17,
        forward: (movementX * forwardX + movementZ * forwardZ) / movementLength,
        strafe: (movementX * rightX + movementZ * rightZ) / movementLength,
        grounded: Math.abs(movementY) < 0.65,
        verticalVelocity: THREE.MathUtils.clamp(movementY / snapshotDelta, -24, 24),
      };
      remote.lastSnapshotPosition.set(player.x, player.y, player.z);
      remote.lastSnapshotAt = snapshotTime;
      remote.state = player;
      const range = Math.hypot(player.x - this.runner.position.x, player.z - this.runner.position.z);
      remote.group.visible = player.alive && (range <= 120 || performance.now() < this.reconRevealUntil);
    }
    const currentIds = new Set(snapshot.players.filter((player) => player.id !== this.playerId).map((player) => player.id));
    for (const [id, remote] of this.remotePlayers) {
      if (currentIds.has(id)) continue;
      this.scene.remove(remote.group);
      remote.labelTexture?.dispose();
      remote.groundRing?.geometry?.dispose();
      remote.groundRing?.material?.dispose();
      this.remotePlayers.delete(id);
    }
    if (this.voiceManager && Array.isArray(snapshot.players)) {
      this.voiceManager.syncPeers(snapshot.players);
    }
    if (Array.isArray(snapshot.items)) {
      this.pickups = snapshot.items;
      for (const item of snapshot.items) {
        if (!item.active) this.pendingPickups?.delete(item.id);
        let mesh = this.pickupMeshes.get(item.id);
        if (!mesh) {
          const definition = ITEM_DEFINITIONS[item.type] || RESOURCE_DEFINITIONS[item.type];
          const color = definition?.color || 0xffffff;
          const size = item.rarity === 'Rare' ? 0.82 : item.rarity === 'Uncommon' ? 0.72 : 0.62;
          mesh = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45 }));
          mesh.position.set(item.x, this.worldManager.getHeightAt(item.x, item.z) + 1.15, item.z);
          this.scene.add(mesh);
          this.pickupMeshes.set(item.id, mesh);
        }
        mesh.visible = item.active;
      }
    }
    const activeHazards = new Set((snapshot.hazards || []).map((hazard) => hazard.id));
    for (const [id, mesh] of this.hazardMeshes) {
      if (activeHazards.has(id)) continue;
      this.scene.remove(mesh);
      this.hazardMeshes.delete(id);
    }
    if (this.dragonMesh && this.dragonState) {
      const flightHeight = Number.isFinite(this.dragonState.y) ? this.dragonState.y : 11;
      this.dragonBaseY = this.worldManager.getHeightAt(this.dragonState.x, this.dragonState.z) + flightHeight;
      this.dragonTargetPosition.set(this.dragonState.x, this.dragonBaseY, this.dragonState.z);
      this.dragonTargetYaw = this.dragonState.ry || 0;
      this.dragonMesh.visible = this.dragonState.alive;
      this.updateDragonTelegraph(this.dragonState.attack);
    }
    if (previousPhase && previousPhase !== this.dragonState.phase) this.showToast(`Dragon phase: ${this.dragonState.phase}.`);
    this.emitState();
  }

  refreshRemoteCharacterModels() {
    if (!this.runner) return;
    for (const remote of this.remotePlayers.values()) {
      const previousGroup = remote.group;
      const group = this.runner.cloneCharacterGroup();
      group.add(remote.label);
      if (remote.groundRing) group.add(remote.groundRing);
      group.position.copy(previousGroup.position);
      group.rotation.copy(previousGroup.rotation);
      group.visible = previousGroup.visible;
      this.scene.remove(previousGroup);
      this.scene.add(group);
      remote.group = group;
      remote.animator = this.runner.createCharacterAnimator(group);
      remote.animator.update(0, remote.animationState);
    }
  }

  updateDragonTelegraph(attack) {
    const visible = Boolean(attack && this.dragonState?.alive);
    if (!visible) {
      const hadTelegraph = Boolean(this.lastTelegraphId);
      this.dragonTelegraph.visible = false;
      this.dragonTelegraphRing.visible = false;
      this.dragonBreathBeam.visible = false;
      this.clearDragonBreathTelegraph();
      this.lastTelegraphId = null;
      if (hadTelegraph) this.playDragonAnimation('fly_loop', true);
      return;
    }

    const color = attack.color || 0xff6238;
    if (attack.type === 'FIRE_BREATH') {
      this.dragonTelegraph.visible = false;
      this.dragonTelegraphRing.visible = false;
      this.updateDragonBreathBeam(attack);
      if (this.lastTelegraphId !== attack.id) {
        this.clearDragonBreathTelegraph();
        const segments = 32;
        const halfAngle = Math.acos(THREE.MathUtils.clamp(attack.facingDotMin ?? 0.78, -1, 1));
        const centerAngle = Math.atan2(attack.direction.x, attack.direction.z);
        const vertices = new Float32Array((segments + 2) * 3);
        const indices = [];
        for (let i = 0; i <= segments; i += 1) {
          const angle = centerAngle - halfAngle + (2 * halfAngle * i) / segments;
          const offset = (i + 1) * 3;
          vertices[offset] = Math.sin(angle) * attack.range;
          vertices[offset + 2] = Math.cos(angle) * attack.range;
          if (i < segments) indices.push(0, i + 1, i + 2);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        this.dragonBreathTelegraph = new THREE.Mesh(geometry, material);
        this.dragonBreathTelegraph.position.set(
          attack.origin.x,
          this.worldManager.getHeightAt(attack.origin.x, attack.origin.z) + 0.22,
          attack.origin.z,
        );
        this.dragonBreathTelegraph.renderOrder = 2;
        this.scene.add(this.dragonBreathTelegraph);
      }
    } else {
      this.dragonBreathBeam.visible = false;
      this.clearDragonBreathTelegraph();
      this.dragonTelegraph.visible = true;
      this.dragonTelegraphRing.visible = true;
      this.dragonTelegraph.material.color.setHex(color);
      this.dragonTelegraphRing.material.color.setHex(color);
      this.dragonTelegraph.position.set(attack.target.x, this.worldManager.getHeightAt(attack.target.x, attack.target.z) + 0.18, attack.target.z);
      this.dragonTelegraphRing.position.set(attack.target.x, this.dragonTelegraph.position.y + 0.02, attack.target.z);
      this.dragonTelegraph.scale.set(attack.radius, attack.radius, attack.radius);
      this.dragonTelegraphRing.scale.set(attack.radius, attack.radius, attack.radius);
    }

    if (this.lastTelegraphId !== attack.id) {
      this.lastTelegraphId = attack.id;
      this.playDragonAnimation(attack.type === 'FIRE_BREATH' ? 'roar' : 'bite', false);
      this.showToast(`DRAGON ATTACK: ${attack.name.toUpperCase()} — DODGE THE MARKED AREA!`);
    }
  }

  updateDragonBreathBeam(attack) {
    if (!attack?.target || !attack.origin || !this.dragonMesh) {
      this.dragonBreathBeam.visible = false;
      return;
    }

    const direction = new THREE.Vector3(attack.direction.x, 0, attack.direction.z).normalize();
    const start = new THREE.Vector3(attack.origin.x, this.dragonMesh.position.y + 1.4, attack.origin.z)
      .addScaledVector(direction, 2.6);
    const end = new THREE.Vector3(
      attack.target.x,
      this.worldManager.getHeightAt(attack.target.x, attack.target.z) + 0.55,
      attack.target.z,
    );
    const beam = end.sub(start);
    const length = beam.length();
    if (length < 0.1) {
      this.dragonBreathBeam.visible = false;
      return;
    }

    beam.normalize();
    this.dragonBreathBeam.position.copy(start).addScaledVector(beam, length / 2);
    this.dragonBreathBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beam);
    this.dragonBreathOuter.scale.y = length;
    this.dragonBreathInner.scale.y = length;
    this.dragonBreathBeam.visible = true;
  }

  clearDragonBreathTelegraph() {
    if (!this.dragonBreathTelegraph) return;
    this.scene.remove(this.dragonBreathTelegraph);
    this.dragonBreathTelegraph.geometry.dispose();
    this.dragonBreathTelegraph.material.dispose();
    this.dragonBreathTelegraph = null;
  }

  handleGameEvent(event) {
    if (event.type === 'WEAPON_CRAFTED') {
      if (event.playerId === this.playerId) {
        this.weapons = event.weapons || this.weapons;
        this.playerAmmo = event.ammo || this.playerAmmo;
        this.playerResources = event.resources || this.playerResources;
        if (event.equippedWeapon) {
          this.equippedWeapon = event.equippedWeapon;
          this.runner?.setEquippedWeapon(event.equippedWeapon);
        }
        audio.playCraftSuccess();
        const def = WEAPON_DEFINITIONS[event.weaponId];
        this.showToast(def ? `Forged ${def.name}!` : `Forged ammo pack!`);
      } else {
        const rival = this.remotePlayers.get(event.playerId)?.state?.name || 'A rival';
        const def = WEAPON_DEFINITIONS[event.weaponId];
        if (def) this.showToast(`${rival} forged ${def.name}!`);
      }
      this.emitState();
      return;
    }
    if (event.type === 'WEAPON_EQUIPPED') {
      if (event.playerId === this.playerId) {
        this.equippedWeapon = event.weaponId;
        this.runner?.setEquippedWeapon(event.weaponId);
      }
      this.emitState();
      return;
    }
    if (event.type === 'WEAPON_FIRED') {
      this.spawnWeaponTracer(event);
      return;
    }
    if (event.type === 'WEAPON_FIRE_RESULT') {
      if (event.remainingAmmo !== undefined) {
        this.playerAmmo[event.weaponId] = event.remainingAmmo;
      }
      if (!event.success && event.reason === 'no-ammo') {
        audio.playEmptyAmmo();
        this.showToast('Out of ammo! Press [C] to forge ammo in the Workbench.');
      }
      this.emitState();
      return;
    }
    if (event.type === 'CRAFT_RESULT') {
      if (!event.success) {
        this.showToast(event.reason || 'Could not craft item.');
      }
      return;
    }
    if (event.type === 'ITEM_SPAWNED' && event.item) {
      if (this.powerUpManager) {
        const existing = this.powerUpManager.resources.get(event.item.id);
        if (existing) {
          existing.active = true;
          existing.mesh.visible = true;
        }
      }
      return;
    }
    if (event.type === 'PLAYER_ATTACKED') {
      const remote = this.remotePlayers.get(event.playerId);
      if (remote) remote.attackTimer = 0.28;
      return;
    }
    if (event.type === 'PLAYER_DAMAGED' && event.damage > 0) {
      if (event.playerId === this.playerId) this.runner.hitReactTimer = 0.24;
      else {
        const remote = this.remotePlayers.get(event.playerId);
        if (remote) remote.hitReactTimer = 0.24;
      }
    }

    if (event.type === 'HAZARD_DEPLOYED') {
      const geometry = new THREE.CylinderGeometry(0.78, 0.92, 0.28, 8);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xc84237, emissive: 0x57100a, emissiveIntensity: 0.6 }));
      mesh.position.set(event.hazard.x, this.worldManager.getHeightAt(event.hazard.x, event.hazard.z) + 0.2, event.hazard.z);
      this.scene.add(mesh);
      this.hazardMeshes.set(event.hazard.id, mesh);
      this.showToast('Deployable hazard armed.');
      return;
    }
    if (event.type === 'ATTACK_RESULT') {
      if (!event.hit) {
        const message = event.reason === 'cooldown'
          ? `Knife ready in ${(event.cooldownRemaining / 1000).toFixed(1)}s.`
          : event.reason === 'target-unavailable' ? 'Target already out of range.' : 'Knife missed. Face your target.';
        this.showToast(message);
      } else if (event.blocked) {
        audio.playImpact();
        this.showToast('Aegis Ward blocked the knife hit.');
      } else {
        audio.playImpact();
        this.showToast(event.targetType === 'dragon' ? `Dragon struck for ${event.damage} damage.` : `Knife hit for ${event.damage} damage.`);
      }
    } else if (event.type === 'PLAYER_DAMAGED' && event.playerId === this.playerId) {
      this.damageFlash = Date.now();
      this.runner.health = event.health;
      audio.playImpact();
      if (event.damage > 0) {
        const source = event.attackerId === 'dragon'
          ? (event.source === 'FIRE_BREATH' ? 'Dragon fire breath' : event.source === 'GROUND_SLAM' ? 'Dragon ground slam' : 'Dragon')
          : event.source === 'knife' ? 'Knife' : event.source === 'volcanic-ground' ? 'Volcanic ground' : 'Hazard';
        this.showToast(`${source} hit: −${event.damage} health.`);
      }
    } else if (event.type === 'PLAYER_ELIMINATED') {
      const victimName = event.player?.name || 'A contender';
      let killerName = 'The Wilds';
      if (event.attackerId === 'dragon') killerName = 'The Dragon';
      else if (event.attackerId === this.playerId) killerName = this.localPlayerName || 'You';
      else if (event.attackerId) {
        const killerObj = this.competitors?.find((c) => c.id === event.attackerId);
        if (killerObj) killerName = killerObj.name;
      }
      this.addKillfeedItem(`${killerName} eliminated ${victimName}`);
      if (event.playerId === this.playerId) {
        this.runner.enabled = false;
        this.showToast('You were eliminated. Spectating remaining contenders.');
      } else {
        const remaining = event.remainingAlive ?? Math.max(1, (this.playerCounts.alive || 1) - 1);
        this.showToast(`${victimName} was eliminated. (${remaining} survivors left)`);
      }
    } else if (event.type === 'PLAYER_RECONNECTED') {
      this.showToast(`${event.player?.name || 'A hunter'} rejoined the match.`);
    } else if (event.type === 'ITEM_COLLECTED') {
      const mesh = this.pickupMeshes.get(event.id);
      if (mesh) mesh.visible = false;
      this.pendingPickups?.delete(event.id);
      if (event.playerId === this.playerId) {
        this.runner.inventory = event.inventory || this.runner.inventory || [];
        this.runner.health = event.health ?? this.runner.health;
        this.playerResources = event.resources || this.playerResources;
        if (event.kind === 'resource') this.stats.resourcesCollected += 1;
        const definition = ITEM_DEFINITIONS[event.itemType] || RESOURCE_DEFINITIONS[event.itemType];
        this.showToast(`${definition?.name || event.itemType} collected · ${event.rarity || 'Common'}.`);
      } else {
        this.showToast(`${this.remotePlayers.get(event.playerId)?.state?.name || 'A rival'} found ${event.itemType}.`);
      }
    } else if (event.type === 'ABILITY_USED' && event.playerId === this.playerId) {
      if (event.ability === 'SPEED') {
        this.runner.applySpeedBuff(event.duration / 1000, 1.5);
      } else if (event.ability === 'SHIELD') {
        this.runner.applyShield(event.duration / 1000);
      } else if (event.ability === 'RECON') {
        this.reconRevealUntil = performance.now() + event.duration;
        const nearby = [...this.remotePlayers.values()].filter((remote) => remote.state.alive && Math.hypot(remote.group.position.x - this.runner.position.x, remote.group.position.z - this.runner.position.z) < 70).length;
        this.showToast(`Recon pulse: ${nearby} rival${nearby === 1 ? '' : 's'} nearby.`);
      }
      this.abilityCooldowns = { ...this.abilityCooldowns, [event.ability]: event.readyAt };
      if (event.ability !== 'RECON') this.showToast(`${ITEM_DEFINITIONS[event.ability]?.name || event.ability} activated.`);
    } else if (event.type === 'ABILITY_RESULT' && !event.success) {
      this.showToast(event.reason || 'Ability could not be used.');
    } else if (event.type === 'DRAGON_DAMAGED') {
      this.dragonState.health = event.health;
      this.showToast(`Dragon took ${event.damage || 0} damage · ${event.health} health left.`);
    } else if (event.type === 'DRAGON_ATTACK_TELEGRAPH') {
      this.dragonState.attack = event.attack;
      this.updateDragonTelegraph(event.attack);
    } else if (event.type === 'DRAGON_ATTACK_RESOLVED') {
      const resolvedAttack = this.dragonState.attack;
      this.dragonState.attack = null;
      this.updateDragonTelegraph(null);
      if (resolvedAttack?.type === 'FIRE_BREATH' && resolvedAttack.target && this.particles) {
        const { x, z } = resolvedAttack.target;
        this.particles.emitExplosion({ x, y: this.worldManager.getHeightAt(x, z) + 0.1, z });
      }
      const localHit = event.impacted?.find((entry) => entry.playerId === this.playerId);
      if (localHit?.damage === 0) this.showToast('Aegis Ward absorbed the dragon attack.');
    } else if (event.type === 'DRAGON_PHASE_CHANGED') {
      this.dragonState.phase = event.phase;
      const phaseMessages = {
        PHASE_1: '3 minutes passed. The dragon has awakened.',
        PHASE_2: '6 minutes passed. The dragon is hunting.',
        PHASE_3: '9 minutes passed. The dragon is at full power.',
      };
      this.showToast(phaseMessages[event.phase] || `Dragon phase: ${event.phase}.`);
    } else if (event.type === 'WORLD_HAZARD_WARNING' && event.playerId === this.playerId) {
      this.showToast('VOLCANIC GROUND: leave the glowing terrain to avoid damage.');
    } else if (event.type === 'ROOM_FULL') {
      this.network?.destroy();
      this.returnToMenu(false);
      this.roleSelectMessage = `This room is full (maximum ${event.maxPlayers} players).`;
      this.emitState();
    }
  }

  handleMatchResults(result) {
    this.serverStatus = 'RESULTS';
    this.gameState = 'FINISHED';
    const winners = Array.isArray(result.winnerId) ? result.winnerId : [result.winnerId];
    const didWin = winners.includes(this.playerId);
    const localPlayer = result.snapshot?.players?.find((player) => player.id === this.playerId);
    if (localPlayer?.stats) this.matchStats = localPlayer.stats;
    this.gameOverData = {
      winner: didWin ? 'you' : (result.winnerId === 'draw' ? 'draw' : 'opponent'),
      reason: result.reason || 'The match is over.',
      kind: result.kind || 'survival',
      dragonRewardPolicy: result.dragonRewardPolicy,
      stats: this.matchStats,
    };
    this.saveMatchHistory(this.gameOverData);
    if (didWin) audio.playWin(); else audio.playLose();
    this.emitState();
  }

  saveMatchHistory(result) {
    const record = {
      endedAt: new Date().toISOString(),
      room: this.roomCode,
      mode: this.matchConfig.mode,
      seed: this.matchConfig.seed,
      winner: result.winner,
      kind: result.kind,
      stats: { ...result.stats },
    };
    try {
      const history = this.loadMatchHistory();
      this.matchHistory = [record, ...history].slice(0, 10);
      localStorage.setItem('aetherbound_match_history', JSON.stringify(this.matchHistory));
    } catch (error) {
      console.warn('Could not save match history:', error);
    }
  }

  loadMatchHistory() {
    try {
      const history = JSON.parse(localStorage.getItem('aetherbound_match_history') || '[]');
      if (!Array.isArray(history)) throw new TypeError('Match history must be an array.');
      return history.slice(0, 10);
    } catch (error) {
      console.warn('Could not load match history:', error);
      return [];
    }
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
    return false;
  }

  updateAISaboteurStatus() {
    if (this.aiSaboteur) {
      this.aiSaboteur.enabled = !this.isHumanSaboteurAvailable() && this.aiSaboteurPreferredEnabled;
    }
  }

  setRole(role) {
    if (role !== 'player') {
      this.activeRole = 'lobby';
      this.returningToMenu = true;
      this.gameState = 'ROLE_SELECT';
      this.runner.enabled = false;
      this.saboteur.enabled = false;
      document.body.classList.remove('runner-mode', 'saboteur-placing', 'cursor-locked');
      document.body.classList.add('cursor-unlocked');
      this.obstacleManager.hidePreview();
      if (document.pointerLockElement) document.exitPointerLock();
      this.emitState();
      return;
    }

    this.activeRole = 'player';
    this.gameState = 'PLAYING';
    this.runner.enabled = true;
    this.saboteur.enabled = false;
    document.body.classList.add('runner-mode');
    document.body.classList.remove('saboteur-placing', 'cursor-unlocked');
    this.obstacleManager.hidePreview();
    this.emitState();
  }

  selectRole(role) {
    if (this.returningToMenu) {
      this.roleSelectMessage = this.network.requestRole(role)
        ? ''
        : 'Still connecting to the game server. Please try again in a moment.';
      this.emitState();
      return;
    }
    this.setRole(role);
  }

  returnToMenu(notifyServer = true, resetData = {}) {
    if (this.gameOverTimeout) {
      clearTimeout(this.gameOverTimeout);
      this.gameOverTimeout = null;
    }
    if (notifyServer && this.network) this.network.destroy();
    {
      this.resetRound({ seed: resetData.seed });
    }
    this.serverStatus = 'WAITING';
    this.activeRole = 'lobby';
    this.updateAISaboteurStatus();
    this.returningToMenu = true;
    this.roleSelectMessage = '';
    this.gameOverData = null;
    this.gameState = 'ROLE_SELECT';
    this.runner.enabled = false;
    this.saboteur.enabled = false;
    document.body.classList.remove('runner-mode', 'saboteur-placing', 'cursor-locked');
    document.body.classList.add('cursor-unlocked');
    if (document.pointerLockElement) document.exitPointerLock();
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
      this.aiSaboteurPreferredEnabled = !this.aiSaboteurPreferredEnabled;
      this.updateAISaboteurStatus();
      this.emitState();
    }
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
    if (this.activeRole !== 'player' || !this.powerUpManager) return;
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
    if (this.activeRole !== 'player' || !this.powerUpManager) return;
    const result = this.powerUpManager.useItem(itemId, this.runner);
    if (result.success) {
      this.showToast(`Used ${result.item.name}.`);
    } else {
      this.showToast(result.reason);
    }
    this.emitState();
  }

  activateAbility(ability) {
    if (this.activeRole !== 'player' || !this.runner.inventory?.includes(ability)) return;
    this.network?.useAbility(ability);
  }

  spawnWeaponTracer(event) {
    const origin = event.origin || { x: 0, y: 1.2, z: 0 };
    const hitPoint = event.hitPoint || { x: origin.x, y: origin.y, z: origin.z + 20 };
    const weaponId = event.weaponId || 'PISTOL';
    const def = WEAPON_DEFINITIONS[weaponId] || WEAPON_DEFINITIONS.PISTOL;

    if (def.sound === 'pistol') audio.playPistol();
    else if (def.sound === 'rifle') audio.playRifle();
    else if (def.sound === 'laser') audio.playLaser();
    else if (def.sound === 'plasma') audio.playPlasma();

    const start = new THREE.Vector3(origin.x, origin.y, origin.z);
    const end = new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z);
    const dist = Math.max(0.1, start.distanceTo(end));
    const dir = end.clone().sub(start).normalize();

    if (weaponId === 'LASER_GUN') {
      const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, dist, 8);
      beamGeo.rotateX(Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.copy(start).lerp(end, 0.5);
      beamMesh.lookAt(end);
      this.scene.add(beamMesh);
      this.activeTracers.push({ mesh: beamMesh, life: 0.18, maxLife: 0.18 });
    } else if (weaponId === 'PLASMA_CANNON') {
      const plasmaGeo = new THREE.SphereGeometry(0.38, 10, 8);
      const plasmaMat = new THREE.MeshBasicMaterial({
        color: 0xff3366,
        transparent: true,
        opacity: 0.95,
      });
      const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
      plasmaMesh.position.copy(start);
      this.scene.add(plasmaMesh);
      const velocity = dir.clone().multiplyScalar(45);
      this.activeTracers.push({ mesh: plasmaMesh, life: dist / 45, maxLife: dist / 45, isPlasma: true, velocity });
    } else {
      const boltLen = Math.min(2.5, dist);
      const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, boltLen, 6);
      boltGeo.rotateX(Math.PI / 2);
      const boltColor = weaponId === 'PISTOL' ? 0x00f0ff : 0xffaa00;
      const boltMat = new THREE.MeshBasicMaterial({
        color: boltColor,
        transparent: true,
        opacity: 0.9,
      });
      const boltMesh = new THREE.Mesh(boltGeo, boltMat);
      boltMesh.position.copy(start).lerp(end, 0.5);
      boltMesh.lookAt(end);
      this.scene.add(boltMesh);
      this.activeTracers.push({ mesh: boltMesh, life: 0.12, maxLife: 0.12 });
    }

    if (event.hit && this.particles) {
      setTimeout(() => {
        this.particles.emitDust(end, weaponId === 'PLASMA_CANNON' ? 24 : 8);
      }, (dist / (def.projectileSpeed || 100)) * 1000);
    }
  }

  attack() {
    if (this.activeRole !== 'player' || this.runner.health <= 0) return;
    if (!this.network?.connected) {
      this.showToast('Connecting to the match server…');
      return;
    }

    const currentWeapon = this.equippedWeapon || 'KNIFE';
    const def = WEAPON_DEFINITIONS[currentWeapon] || WEAPON_DEFINITIONS.KNIFE;

    if (def.type === 'melee') {
      const remaining = this.attackCooldownUntil - Date.now();
      if (remaining > 0) {
        this.showToast(`Knife ready in ${(remaining / 1000).toFixed(1)}s.`);
        return;
      }
      this.attackCooldownUntil = Date.now() + KNIFE_RULES.cooldownMs;
      this.network?.attack();
      this.runner.playKnifeSwing();
    } else {
      const currentAmmo = this.playerAmmo[currentWeapon] || 0;
      if (currentAmmo <= 0) {
        audio.playEmptyAmmo();
        this.showToast(`No ammo! Open Forge [C] to craft more.`);
        return;
      }

      const remaining = this.attackCooldownUntil - Date.now();
      if (remaining > 0) return;
      this.attackCooldownUntil = Date.now() + (def.cooldownMs || 300);

      this.playerAmmo[currentWeapon] = currentAmmo - 1;
      this.emitState();

      if (def.sound === 'pistol') audio.playPistol();
      else if (def.sound === 'rifle') audio.playRifle();
      else if (def.sound === 'laser') audio.playLaser();
      else if (def.sound === 'plasma') audio.playPlasma();

      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const origin = new THREE.Vector3(this.runner.position.x, this.runner.position.y + 1.2, this.runner.position.z);

      // Third-person reticle convergence: Raycast from camera along center reticle
      const maxRayDist = def.range || 70;
      let targetPoint = this.camera.position.clone().addScaledVector(camDir, maxRayDist);

      let closestHitDist = maxRayDist;
      const camPos = this.camera.position;

      // 1. Dragon target convergence
      if (this.dragonMesh && this.dragonMesh.visible && this.dragonState?.alive) {
        const dragonPos = this.dragonMesh.position;
        const toDragon = dragonPos.clone().sub(camPos);
        const distAlong = toDragon.dot(camDir);
        if (distAlong > 0 && distAlong < closestHitDist) {
          const proj = camPos.clone().addScaledVector(camDir, distAlong);
          if (proj.distanceTo(dragonPos) <= 5.5) {
            closestHitDist = distAlong;
            targetPoint = proj;
          }
        }
      }

      // 2. Remote competitor contenders convergence
      for (const remote of this.remotePlayers.values()) {
        if (!remote.state?.alive || !remote.group.visible) continue;
        const pPos = remote.group.position.clone();
        pPos.y += 1.0;
        const toPlayer = pPos.clone().sub(camPos);
        const distAlong = toPlayer.dot(camDir);
        if (distAlong > 0 && distAlong < closestHitDist) {
          const proj = camPos.clone().addScaledVector(camDir, distAlong);
          if (proj.distanceTo(pPos) <= 1.6) {
            closestHitDist = distAlong;
            targetPoint = proj;
          }
        }
      }

      // Calculate weapon ray from player's weapon towards target point
      const fireDir = targetPoint.clone().sub(origin).normalize();
      const finalDir = fireDir.dot(camDir) > 0.2 ? fireDir : camDir;

      this.network?.fireWeapon(currentWeapon, origin, finalDir);
      this.runner.knifeSwingTimer = 0.12;
    }
  }

  craftWeapon(recipeIndex) {
    if (!this.network?.connected) return;
    this.network.craftWeapon(recipeIndex);
  }

  equipWeapon(weaponId) {
    if (weaponId === this.equippedWeapon) return;
    this.equippedWeapon = weaponId;
    this.network?.equipWeapon(weaponId);
    this.runner?.setEquippedWeapon(weaponId);
    this.emitState();
  }

  toggleCraftingModal() {
    this.craftingModalOpen = !this.craftingModalOpen;
    this.emitState();
  }

  setCraftingModalOpen(open) {
    this.craftingModalOpen = Boolean(open);
    this.emitState();
  }

  // Mobile Touch & Virtual Joystick Support
  setJoystick(x, y) {
    if (this.activeRole === 'player') {
      if (this.runner) this.runner.setJoystick(x, y);
    }
  }

  addLook(deltaYaw, deltaPitch = 0) {
    if (this.activeRole === 'player') {
      if (this.runner) this.runner.addCameraLook(deltaYaw, deltaPitch);
    }
  }

  addLookYaw(deltaYaw) {
    this.addLook(deltaYaw, 0);
  }

  addLookPitch(deltaPitch) {
    this.addLook(0, deltaPitch);
  }

  // Controls item placement by screen drag on mobile
  dragItemPlacement(deltaX, deltaY) {
    void deltaX;
    void deltaY;
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
    if (this.activeRole === 'player') {
      if (this.runner) this.runner.triggerJump();
    }
  }

  slide() {
    if (this.activeRole === 'player') {
      if (this.runner) this.runner.startSlide();
    }
  }

  setSprint(active) {
    if (this.activeRole === 'player') {
      if (this.runner) this.runner.setSprinting(active);
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
    lockPointer(this.renderer.domElement);
  }

  onObstaclePlaced(type, pos, rot) {
    this.stats.obstaclesPlaced += 1;
    if (!this.network.connected) {
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

  resetRound(msg) {
    this.returningToMenu = false;
    this.roleSelectMessage = '';
    this.gameState = 'PLAYING';
    this.gameOverData = null;
    this.damageFlash = 0;
    this.toastMessage = null;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
    this.placementData = {
      visible: false,
      selectedType: 'WALL',
      dist: 16.0,
      maxDist: 75.0,
      hasEnergy: true,
      cost: 30,
      currentEnergy: GAME_CONFIG.SABOTEUR.MAX_ENERGY,
      inRange: true,
      isValidPlacement: true,
    };

    this.stats = {
      distanceTraversed: 0,
      resourcesCollected: 0,
      itemsCrafted: 0,
      obstaclesPlaced: 0,
    };
    this.lastRunnerPosForDist = null;

    if (msg.seed) this.worldManager.setSeed(msg.seed);
    this.obstacleManager.clear();
    if (this.particles) this.particles.clear();
    if (this.powerUpManager) this.powerUpManager.clear();

    const startY = this.worldManager.getHeightAt(0, 0);
    this.runner.health = 100;
    this.runner.stamina = GAME_CONFIG.RUNNER.STAMINA_MAX;
    this.runner.isSprinting = false;
    this.runner.invulnerableTimer = 0;
    this.runner.speedBuffTimer = 0;
    this.runner.speedMultiplier = 1.0;
    this.runner.jumpBuffTimer = 0;
    this.runner.bonusJumpForce = 0;
    this.runner.hasShield = false;
    this.runner.shieldTimer = 0;
    this.runner.velocity.set(0, 0, 0);
    this.runner.isSliding = false;
    this.runner.slideTimer = 0;
    this.runner.isVaulting = false;
    this.runner.vaultTimer = 0;
    this.runner.cameraYaw = 0;
    this.runner.animTime = 0;
    this.runner.joystickVector.x = 0;
    this.runner.joystickVector.y = 0;
    Object.keys(this.runner.keys).forEach((key) => { this.runner.keys[key] = false; });
    if (this.runner.shieldMesh) this.runner.shieldMesh.visible = false;
    this.runner.setState({ x: 0, y: startY + 1.0, z: 0, ry: 0, health: 100 });

    const saboY = this.worldManager.getHeightAt(25, 25);
    this.saboteur.health = 100;
    this.saboteur.stamina = GAME_CONFIG.RUNNER.STAMINA_MAX;
    this.saboteur.energy = GAME_CONFIG.SABOTEUR.MAX_ENERGY;
    this.saboteur.isSprinting = false;
    this.saboteur.invulnerableTimer = 0;
    this.saboteur.speedBuffTimer = 0;
    this.saboteur.speedMultiplier = 1.0;
    this.saboteur.jumpBuffTimer = 0;
    this.saboteur.bonusJumpForce = 0;
    this.saboteur.hasShield = false;
    this.saboteur.shieldTimer = 0;
    this.saboteur.velocity.set(0, 0, 0);
    this.saboteur.reconCooldownTimer = 0;
    this.saboteur.reconActiveTimer = 0;
    this.saboteur.isSliding = false;
    this.saboteur.slideTimer = 0;
    this.saboteur.isVaulting = false;
    this.saboteur.vaultTimer = 0;
    this.saboteur.cameraYaw = 0;
    this.saboteur.animTime = 0;
    this.saboteur.selectedType = 'WALL';
    this.saboteur.isPlacing = true;
    this.saboteur.placementRotation = 0;
    this.saboteur.scanWaves = [];
    Object.keys(this.saboteur.keys).forEach((key) => { this.saboteur.keys[key] = false; });
    if (this.saboteur.shieldMesh) this.saboteur.shieldMesh.visible = false;
    this.saboteur.setState({ x: 25, y: saboY + 1.0, z: 25, ry: Math.PI, health: 100 });

    this.emitState();
  }

  updateDaylight() {
    this.todName = this.weatherState.name;
    this.todClass = this.weatherState.id.toLowerCase();
    if (this.lastWeatherId !== this.weatherState.id) {
      this.lastWeatherId = this.weatherState.id;
      if (this.weatherState.id !== 'CLEAR') this.showToast(`Weather changed: ${this.weatherState.name}.`);
    }
    const charPos = this.runner.position;

    this.sunLight.position.set(
      charPos.x + DAYLIGHT_CONFIG.sunOffset.x,
      charPos.y + DAYLIGHT_CONFIG.sunOffset.y,
      charPos.z + DAYLIGHT_CONFIG.sunOffset.z
    );
    this.sunLight.target.position.copy(charPos);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.color.setHex(DAYLIGHT_CONFIG.sun);
    this.sunLight.intensity = this.weatherState.sunIntensity;
    this.ambientLight.color.setHex(DAYLIGHT_CONFIG.ambient);
    this.ambientLight.intensity = this.weatherState.ambientIntensity;
    this.scene.background.setHex(this.weatherState.sky);
    this.scene.fog.color.setHex(this.weatherState.fog);
    this.scene.fog.density = this.weatherState.fogDensity;
  }

  animate() {
    this.animationId = requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();
    this.dragonMixer?.update(dt);
    if (this.dragonMesh?.visible && Number.isFinite(this.dragonBaseY)) {
      const dragonLerp = 1 - Math.exp(-dt * 8);
      this.dragonRenderPosition.lerp(this.dragonTargetPosition, dragonLerp);
      this.dragonMesh.position.copy(this.dragonRenderPosition);
      this.dragonMesh.position.y += Math.sin(elapsedTime * 2.2) * 0.38;
      const yawDelta = Math.atan2(
        Math.sin(this.dragonTargetYaw - this.dragonMesh.rotation.y),
        Math.cos(this.dragonTargetYaw - this.dragonMesh.rotation.y),
      );
      this.dragonMesh.rotation.y += yawDelta * dragonLerp;
      if (this.dragonState?.attack?.type === 'FIRE_BREATH') {
        this.updateDragonBreathBeam(this.dragonState.attack);
      }
    }
    if (this.dragonBreathBeam?.visible) {
      const pulse = 0.78 + Math.sin(elapsedTime * 18) * 0.22;
      this.dragonBreathOuter.material.opacity = 0.28 * pulse;
      this.dragonBreathInner.material.opacity = 0.45 * pulse;
    }

    if (this.gameState === 'PLAYING') {
      this.updateDaylight();

      for (const remote of this.remotePlayers.values()) {
        if (remote.targetPosition) {
          const lerpFactor = 1 - Math.exp(-dt * 14);
          remote.group.position.lerp(remote.targetPosition, lerpFactor);
          const yawDelta = Math.atan2(
            Math.sin(remote.targetYaw - remote.group.rotation.y),
            Math.cos(remote.targetYaw - remote.group.rotation.y)
          );
          remote.group.rotation.y += yawDelta * lerpFactor;
        }
        remote.pitch = THREE.MathUtils.lerp(remote.pitch || 0, remote.targetPitch || 0, 1 - Math.exp(-dt * 12));
        remote.attackTimer = Math.max(0, remote.attackTimer - dt);
        remote.hitReactTimer = Math.max(0, remote.hitReactTimer - dt);
        remote.animator?.update(dt, {
          ...remote.animationState,
          pitch: remote.pitch,
          attackProgress: remote.attackTimer > 0 ? 1 - remote.attackTimer / 0.28 : 0,
          hitProgress: remote.hitReactTimer > 0 ? 1 - remote.hitReactTimer / 0.24 : 0,
        });
      }

      this.obstacleManager.update(dt);

      if (this.particles) {
        this.particles.update(dt);
      }

      // Update active weapon bullet/laser/plasma tracers
      for (let i = this.activeTracers.length - 1; i >= 0; i--) {
        const tracer = this.activeTracers[i];
        tracer.life -= dt;
        if (tracer.life <= 0) {
          this.scene.remove(tracer.mesh);
          tracer.mesh.geometry?.dispose();
          tracer.mesh.material?.dispose();
          this.activeTracers.splice(i, 1);
        } else {
          tracer.mesh.material.opacity = (tracer.life / tracer.maxLife) * (tracer.isPlasma ? 0.95 : 0.85);
          if (tracer.isPlasma && tracer.velocity) {
            tracer.mesh.position.addScaledVector(tracer.velocity, dt);
          }
        }
      }

      if (this.activeRole === 'player' && this.runner.health > 0) {
        this.runner.weatherSpeedMultiplier = this.weatherState.movementMultiplier;
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

        if (elapsedTime - this.lastNetworkSync > 0.05) {
          this.lastNetworkSync = elapsedTime;
          this.network.sendPlayerMove(this.runner.getState());
        }

        for (const item of this.pickups) {
          if (!item.active) continue;
          const distToPlayer = Math.hypot(item.x - this.runner.position.x, item.z - this.runner.position.z);
          if (distToPlayer < 2.6 && !this.pendingPickups?.has(item.id)) {
            this.pendingPickups ||= new Set();
            this.pendingPickups.add(item.id);
            this.network.collectItem(item.id);
          } else if (distToPlayer < 80) {
            const mesh = this.pickupMeshes.get(item.id);
            if (mesh) {
              mesh.rotation.y = elapsedTime * 2.0;
              mesh.position.y = this.worldManager.getHeightAt(item.x, item.z) + 1.15 + Math.sin(elapsedTime * 2.8 + item.x) * 0.18;
            }
          }
        }

        // 1km World Boundary Proximity Warning
        const playerRadius = Math.hypot(this.runner.position.x, this.runner.position.z);
        if (playerRadius > 940) {
          const distRemaining = Math.max(0, Math.round(1000 - playerRadius));
          if (!this.lastBoundaryWarningAt || Date.now() - this.lastBoundaryWarningAt > 4000) {
            this.showToast(`⚠ APPROACHING 1KM WORLD BARRIER (${distRemaining}m to boundary)`);
            this.lastBoundaryWarningAt = Date.now();
          }
        }
      } else {
        if (this.runner.health > 0) this.physics.updateCharacterPhysics(this.runner, dt);
        this.runner.group.position.copy(this.runner.position);
        this.runner.group.rotation.y = this.runner.rotationY;
        if (this.runner.health <= 0) {
          this.runner.group.visible = false;
          const target = [...this.remotePlayers.values()].find((entry) => entry.state.alive);
          if (target) {
            const { x, y, z } = target.group.position;
            const yaw = target.group.rotation.y;
            this.camera.position.set(x + Math.sin(yaw) * 7, y + 4, z + Math.cos(yaw) * 7);
            this.camera.lookAt(x, y + 1.1, z);
          }
        } else {
          this.runner.group.visible = true;
        }
      }

      this.saboteur.mesh.visible = false;
      this.worldManager.update([this.runner.position, this.camera.position, ...[...this.remotePlayers.values()].map((player) => player.group.position)], elapsedTime);

      // Throttle React state emission to ~20Hz
      if (elapsedTime - this.lastStateEmit > 0.05) {
        this.lastStateEmit = elapsedTime;
        this.emitState();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  addKillfeedItem(text) {
    const item = {
      id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      expiresAt: Date.now() + 4500,
    };
    this.killfeed = [item, ...(this.killfeed || [])].slice(0, 4);
    this.emitState();
  }

  emitState() {
    if (!this.onStateChange) return;

    const now = Date.now();
    this.killfeed = (this.killfeed || []).filter((kf) => kf.expiresAt > now);

    const activeChar = this.runner;
    let biome = null;
    if (this.worldManager && activeChar) {
      biome = this.worldManager.getDominantBiome(activeChar.position.x, activeChar.position.z);
    }

    const snapshot = {
      gameState: this.gameState,
      activeRole: this.activeRole,
      roomCode: this.roomCode,
      matchConfig: this.matchConfig,
      roleSelectMessage: this.roleSelectMessage,
      playerCounts: this.playerCounts,
      competitors: this.competitors || [],
      killfeed: this.killfeed || [],
      localPlayerColor: this.localPlayerColor || '#00f0ff',
      localPlayerSlot: this.localPlayerSlot ?? 0,
      playerId: this.playerId,
      inventory: this.runner.inventory || [],
      matchStats: this.matchStats,
      matchHistory: this.matchHistory,
      playerResources: this.playerResources,
      weapons: this.weapons || ['KNIFE'],
      equippedWeapon: this.equippedWeapon || 'KNIFE',
      playerAmmo: this.playerAmmo || {},
      craftingModalOpen: Boolean(this.craftingModalOpen),
      abilityCooldowns: this.abilityCooldowns,
      knifeCooldownMs: Math.max(0, this.attackCooldownUntil - Date.now()),
      dragon: this.dragonState,
      environment: {
        biome,
        todName: this.todName,
        todClass: this.todClass,
        weather: this.weatherState,
      },
      runnerStats: {
        health: this.runner.health,
        maxHealth: this.runner.maxHealth,
        stamina: this.runner.stamina,
        maxStamina: GAME_CONFIG.RUNNER.STAMINA_MAX,
        sensitivity: this.runner.mouseSensitivity,
        buffs: this.runner.getActiveBuffs(),
        knifeCooldownMs: Math.max(0, this.attackCooldownUntil - Date.now()),
        weapons: this.weapons || ['KNIFE'],
        equippedWeapon: this.equippedWeapon || 'KNIFE',
        ammo: this.playerAmmo || {},
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
      voiceState: this.voiceState,
    };

    this.onStateChange(snapshot);
  }

  toggleVoiceMute() { this.voiceManager?.toggleMute(); }
  setVoiceMuted(muted) { this.voiceManager?.setMuted(muted); }
  toggleVoiceDeafen() { this.voiceManager?.toggleDeafen(); }
  setVoiceDeafened(deafened) { this.voiceManager?.setDeafened(deafened); }
  setVoicePushToTalk(enabled) { this.voiceManager?.setPushToTalk(enabled); }
  setVoicePttActive(active) { this.voiceManager?.setPushToTalkActive(active); }
  setVoiceVolume(volume) { this.voiceManager?.setVolume(volume); }

  destroy() {
    this.destroyed = true;
    if (this.voiceManager) this.voiceManager.destroy();
    if (this.gameOverTimeout) clearTimeout(this.gameOverTimeout);
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
    }
    if (this.onCombatClick && this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onCombatClick);
    }
    if (this.onKeyDownHandler) window.removeEventListener('keydown', this.onKeyDownHandler);
    if (this.onWheelHandler) window.removeEventListener('wheel', this.onWheelHandler);
    this.dragonMixer?.stopAllAction();
    this.clearDragonBreathTelegraph();
    this.scene?.remove(this.dragonMesh, this.dragonBreathBeam, this.dragonTelegraph, this.dragonTelegraphRing);
    disposeThreeObject(this.dragonMesh);
    disposeThreeObject(this.dragonBreathBeam);
    this.dragonTelegraph?.geometry.dispose();
    this.dragonTelegraph?.material.dispose();
    this.dragonTelegraphRing?.geometry.dispose();
    this.dragonTelegraphRing?.material.dispose();
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    if (this.network) this.network.destroy();
  }
}
