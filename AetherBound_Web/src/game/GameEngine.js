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
import {
  ITEM_DEFINITIONS,
  KNIFE_RULES,
  WEAPON_DEFINITIONS,
  WEAPON_CRAFTING_RECIPES,
  MAGIC_STICKS,
  MAGIC_POWERS,
  TRAP_DEFINITIONS,
  MOB_SYSTEM_CONFIG,
  ARCANE_CRAFTING_RECIPES,
} from './data/combat.js';
import { RESOURCE_DEFINITIONS, getWeatherState } from './data/world.js';
import { normalizeMatchConfig } from './data/matchModes.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { VoiceManager } from './voice/VoiceManager.js';
import { createCollectibleEntity, updateCollectibleEntity, preloadAllCollectibleModels } from './collectibleModels.js';
import { AttackAnimator } from './AttackAnimator.js';

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

// Module-level scratch vectors for zero-allocation performance in render loops
const _scratchCamDir = new THREE.Vector3();
const _scratchTargetPos = new THREE.Vector3();
const _scratchToTarget = new THREE.Vector3();
const _scratchProj = new THREE.Vector3();

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

function drawMobNameplate(canvas, ctx, name, health, maxHealth, tier) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const isFire = tier === 2;
  const borderColor = isFire ? '#ff5511' : '#22aaff';

  ctx.fillStyle = 'rgba(8, 14, 22, 0.9)';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 10);
  ctx.fill();
  ctx.stroke();

  // Tier Icon Dot
  ctx.fillStyle = isFire ? '#ff5511' : '#22aaff';
  ctx.beginPath();
  ctx.arc(24, 24, 8, 0, Math.PI * 2);
  ctx.fill();

  // Mob Name Text with Zombie icon
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🧟 ${name}`, 38, 24);

  // Health Bar
  const barX = 14;
  const barY = 44;
  const barW = w - 28;
  const barH = 16;
  ctx.fillStyle = 'rgba(20, 28, 38, 0.95)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 4);
  ctx.fill();

  const pct = Math.max(0, Math.min(1, (health ?? maxHealth) / (maxHealth || 1)));
  ctx.fillStyle = isFire ? '#ff6622' : '#33ccff';
  if (pct > 0) {
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * pct, barH, 4);
    ctx.fill();
  }

  // HP Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(health)} / ${maxHealth}`, barX + barW / 2, barY + barH / 2);
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
    this.returningToMenu = params.get('menu') === '1';
    const preferredRole = this.returningToMenu ? null : params.get('role');
    this.roleSelectMessage = '';

    if (preferredRole) {
      this.activeRole = preferredRole;
    }
    this.localPlayerName = (params.get('name') || (typeof window !== 'undefined' ? localStorage.getItem('aetherbound_player_name') : '') || 'Survivor').trim().slice(0, 20);

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
    this.equippedStick = 'APPRENTICE_STICK';
    this.equippedWeapon = 'APPRENTICE_STICK';
    this.weapons = ['APPRENTICE_STICK', 'KNIFE'];
    this.powerSlots = ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION', null, null, null];
    this.skillCounts = {
      FIREBALL: 3,
      FROST_LANCE: 3,
      FROST_TRAP: 2,
      REJUVENATION: 2,
    };
    this.backpack = {
      sticks: ['APPRENTICE_STICK'],
      powers: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION'],
      skillCounts: {
        FIREBALL: 3,
        FROST_LANCE: 3,
        FROST_TRAP: 2,
        REJUVENATION: 2,
      },
      resources: {},
    };
    this.statusEffects = [];
    this.playerAmmo = { PISTOL: 0, GUN: 0, LASER_GUN: 0, PLASMA_CANNON: 0 };
    this.activeTracers = [];
    this.craftingModalOpen = false;
    this.backpackModalOpen = false;
    this.matchHistory = this.loadMatchHistory();

    // Aim Target & Aim Assist State
    this.hasTarget = false;
    this.aimAssistActive = false;
    this.targetInfo = null;
    this.targetName = '';
    this.wasTargetLocked = false;

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

    const isMobile = window.innerWidth < 768;
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      powerPreference: 'high-performance',
      precision: isMobile ? 'mediump' : 'highp',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const pixelRatioLimit = isMobile ? 1.0 : (window.innerWidth < 1400 ? 1.25 : 1.5);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.ambientLight = new THREE.HemisphereLight(0xd9e8e5, 0x53614a, 1.45);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7e2, 2.2);
    this.sunLight.position.set(50, 110, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.bias = -0.00015;
    this.sunLight.shadow.normalBias = 0.025;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 250;
    const shadowDist = 55;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.onResize = () => {
      if (!this.camera || !this.renderer) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.onResize);
  }

  shakeCamera(intensity = 0.35, duration = 0.25) {
    if (this.runner?.triggerCameraShake) {
      this.runner.triggerCameraShake(intensity, duration);
    }
  }

  initGameSystems() {
    this.particles = new ParticleSystem(this.scene);
    this.attackAnimator = new AttackAnimator(
      this.scene,
      this.particles,
      this.worldManager,
      (intensity, duration) => this.shakeCamera(intensity, duration)
    );
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
    this.zombieGltf = null;
    this.zombieClip = null;
    this.loadZombieModel();

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

    // Dragon 3s Pre-Landing Warning Decal
    const landingRingMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.dragonLandingRing = new THREE.Mesh(new THREE.RingGeometry(8.0, 8.5, 48), landingRingMat);
    this.dragonLandingRing.rotation.x = -Math.PI / 2;
    this.dragonLandingRing.visible = false;
    this.scene.add(this.dragonLandingRing);

    const landingDiscMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.dragonLandingDisc = new THREE.Mesh(new THREE.CircleGeometry(8.0, 48), landingDiscMat);
    this.dragonLandingDisc.rotation.x = -Math.PI / 2;
    this.dragonLandingDisc.visible = false;
    this.scene.add(this.dragonLandingDisc);

    this.initTrapSystems();
    this.initMobSystems();

    this.onCombatClick = (e) => {
      if (this.gameState !== 'PLAYING' || this.activeRole !== 'player') return;
      if (e && e.button === 2) {
        if (this.isPlacingTrap) {
          this.cancelTrapTargeting();
          return;
        }
      }
      if (this.isPlacingTrap) {
        this.confirmTrapPlacement();
        return;
      }
      this.attack();
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onCombatClick);
    this.onKeyDownHandler = (event) => {
      if (this.gameState !== 'PLAYING') return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (event.code === 'Escape') {
        if (this.isPlacingTrap) {
          this.cancelTrapTargeting();
          return;
        }
        if (this.craftingModalOpen) {
          this.setCraftingModalOpen(false);
          return;
        }
        if (this.backpackModalOpen) {
          this.setBackpackModalOpen(false);
          return;
        }
      }
      if (event.code === 'KeyC') {
        this.toggleCraftingModal();
        return;
      }
      if (event.code === 'KeyB' || event.code === 'KeyI') {
        this.toggleBackpackModal();
        return;
      }
      // Slot 0 (Key 1): Dedicated Magical Stick
      if (event.code === 'Digit1') {
        this.equipStick(this.equippedStick || 'APPRENTICE_STICK');
        return;
      }
      // Power Slots 1 to 7 (Number Keys 2 to 8, or letter hotkeys Q, E, R, F, Z, X, V)
      const digitCodes = ['Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];
      const abilityKeys = ['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyZ', 'KeyX', 'KeyV'];

      let powerSlotIndex = digitCodes.indexOf(event.code);
      if (powerSlotIndex === -1) {
        powerSlotIndex = abilityKeys.indexOf(event.code);
      }

      if (powerSlotIndex !== -1 && powerSlotIndex < 7) {
        const slots = this.powerSlots || [];
        const powerId = slots[powerSlotIndex];
        if (powerId) {
          this.activateAbility(powerId);
        } else {
          this.toggleBackpackModal();
        }
        return;
      }
      if (event.code === 'KeyH') {
        this.activateAbility('REJUVENATION');
        return;
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
    preloadAllCollectibleModels();

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

  loadZombieModel() {
    const loader = new GLTFLoader();
    loader.load('/models/mobs/zombie_realistic.glb', (gltf) => {
      if (this.destroyed) {
        disposeThreeObject(gltf.scene);
        return;
      }
      this.zombieGltf = gltf;
      this.zombieClip = gltf.animations?.[0];

      // Upgrade any active world mobs to realistic 3D zombie models
      if (this.worldMobs) {
        for (const mobGroup of this.worldMobs.values()) {
          this.setupZombieModelForMob(mobGroup, mobGroup.userData.mob);
        }
      }
    }, undefined, (error) => {
      console.warn('Could not load realistic 3D zombie model:', error);
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
    }, this.roomCode, this.matchConfig, this.localPlayerName);
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
        this.equippedStick = player.equippedStick || player.equippedWeapon || 'APPRENTICE_STICK';
        this.equippedWeapon = this.equippedStick;
        this.powerSlots = player.powerSlots || ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION', null, null, null];
        this.skillCounts = player.skillCounts || player.backpack?.skillCounts || this.skillCounts || {};
        // If player has zero count of any skill, remove it from loadout!
        for (let i = 0; i < this.powerSlots.length; i++) {
          const pId = this.powerSlots[i];
          if (pId && (this.skillCounts[pId] ?? 0) <= 0) {
            this.powerSlots[i] = null;
          }
        }
        this.backpack = player.backpack || {
          sticks: [this.equippedStick],
          powers: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION'],
          skillCounts: this.skillCounts,
          resources: this.playerResources,
        };
        if (this.backpack && !this.backpack.skillCounts) {
          this.backpack.skillCounts = this.skillCounts;
        }
        this.statusEffects = player.statusEffects || [];
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
          const terrainY = this.worldManager.getHeightAt(item.x, item.z);
          mesh = createCollectibleEntity(item, terrainY);
          mesh.visible = false; // Initialized hidden; animated distance culling will toggle visible
          this.scene.add(mesh);
          this.pickupMeshes.set(item.id, mesh);
        }
        if (!item.active) {
          mesh.visible = false;
        }
      }
    }
    const activeHazards = new Set((snapshot.hazards || []).map((hazard) => hazard.id));
    for (const [id, mesh] of this.hazardMeshes) {
      if (activeHazards.has(id)) continue;
      this.scene.remove(mesh);
      this.hazardMeshes.delete(id);
    }
    if (this.worldTraps) {
      const activeTraps = new Set((snapshot.traps || []).map((trap) => trap.id));
      for (const [id, mesh] of this.worldTraps) {
        if (activeTraps.has(id)) continue;
        this.scene.remove(mesh);
        this.worldTraps.delete(id);
      }
      if (Array.isArray(snapshot.traps)) {
        for (const trap of snapshot.traps) {
          if (!this.worldTraps.has(trap.id)) {
            const mesh = this.createWorldTrapMesh(trap);
            this.worldTraps.set(trap.id, mesh);
          }
        }
      }
    }
    if (this.worldMobs && Array.isArray(snapshot.mobs)) {
      const activeMobIds = new Set(snapshot.mobs.filter((m) => m.alive).map((m) => m.id));
      for (const [id, group] of this.worldMobs) {
        if (!activeMobIds.has(id)) {
          this.scene.remove(group);
          group.userData?.labelTexture?.dispose();
          this.worldMobs.delete(id);
        }
      }
      for (const mob of snapshot.mobs) {
        if (!mob.alive) continue;
        let mobGroup = this.worldMobs.get(mob.id);
        if (!mobGroup) {
          mobGroup = this.createMobMesh(mob);
          this.worldMobs.set(mob.id, mobGroup);
        }
        mobGroup.userData.targetPos.set(mob.x, mob.y, mob.z);
        mobGroup.userData.targetYaw = mob.ry || 0;
        if (mobGroup.userData.lastHealth !== mob.health) {
          mobGroup.userData.lastHealth = mob.health;
          drawMobNameplate(mobGroup.userData.labelCanvas, mobGroup.userData.labelCtx, mob.name, mob.health, mob.maxHealth, mob.tier);
          mobGroup.userData.labelTexture.needsUpdate = true;
        }
      }
    }
    if (this.dragonMesh && this.dragonState) {
      const isGrounded = this.dragonState.flightPhase === 'GROUNDED';
      const altitude = Number.isFinite(this.dragonState.altitude)
        ? this.dragonState.altitude
        : (isGrounded ? 0.6 : 14.0);
      this.dragonBaseY = this.worldManager.getHeightAt(this.dragonState.x, this.dragonState.z) + altitude;
      this.dragonTargetPosition.set(this.dragonState.x, this.dragonBaseY, this.dragonState.z);
      this.dragonTargetYaw = this.dragonState.ry || 0;
      this.dragonMesh.visible = this.dragonState.alive;
      this.updateDragonTelegraph(this.dragonState.attack);
    }
    if (previousPhase && previousPhase !== this.dragonState.phase) this.showToast(`Dragon phase: ${this.dragonState.phase}.`);
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
      audio.playDragonRoar();
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

  showLandingWarningDecal(pos, durationMs = 3000) {
    if (!this.dragonLandingRing || !this.dragonLandingDisc) return;
    const y = this.worldManager.getHeightAt(pos.x, pos.z) + 0.18;
    this.dragonLandingRing.position.set(pos.x, y, pos.z);
    this.dragonLandingDisc.position.set(pos.x, y - 0.02, pos.z);
    this.dragonLandingRing.visible = true;
    this.dragonLandingDisc.visible = true;

    if (this.landingWarningTimeout) clearTimeout(this.landingWarningTimeout);
    this.landingWarningTimeout = setTimeout(() => {
      if (this.dragonLandingRing) this.dragonLandingRing.visible = false;
      if (this.dragonLandingDisc) this.dragonLandingDisc.visible = false;
    }, durationMs);
  }

  spawnGroundImpactShockwaveVFX(pos) {
    if (this.dragonLandingRing) this.dragonLandingRing.visible = false;
    if (this.dragonLandingDisc) this.dragonLandingDisc.visible = false;

    if (this.particles) {
      const pY = this.worldManager.getHeightAt(pos.x, pos.z) + 0.2;
      this.particles.emitExplosion({ x: pos.x, y: pY, z: pos.z });
      this.particles.emitPowerupBurst({ x: pos.x, y: pY + 0.6, z: pos.z }, 0xff5511, 40);
    }
    // Screen / camera shockwave reaction if local player is within blast range
    const dist = Math.hypot(this.runner.position.x - pos.x, this.runner.position.z - pos.z);
    if (dist < 40) {
      this.damageFlash = Math.max(this.damageFlash || 0, Date.now() - 60);
    }
  }

  handleGameEvent(event) {
    if (event.type === 'WEAPON_CRAFTED') {
      if (event.playerId === this.playerId) {
        this.weapons = event.weapons || this.weapons;
        this.playerAmmo = event.ammo || this.playerAmmo;
        this.playerResources = event.resources || this.playerResources;
        if (event.equippedStick || event.equippedWeapon) {
          const stick = event.equippedStick || event.equippedWeapon;
          this.equippedStick = stick;
          this.equippedWeapon = stick;
          this.runner?.setEquippedWeapon(stick);
        }
        if (event.backpack) this.backpack = event.backpack;
        if (event.powerSlots) this.powerSlots = event.powerSlots;
        if (event.skillCounts) this.skillCounts = event.skillCounts;
        if (this.backpack && this.skillCounts) this.backpack.skillCounts = this.skillCounts;
        audio.playCraftSuccess();
        const def = WEAPON_DEFINITIONS[event.weaponId] || MAGIC_STICKS[event.stickId] || MAGIC_POWERS[event.powerId];
        this.showToast(def ? `Forged ${def.name}!` : `Crafted successfully!`);
      } else {
        const rival = this.remotePlayers.get(event.playerId)?.state?.name || 'A rival';
        const def = WEAPON_DEFINITIONS[event.weaponId] || MAGIC_STICKS[event.stickId] || MAGIC_POWERS[event.powerId];
        if (def) this.showToast(`${rival} crafted ${def.name}!`);
      }
      this.emitState();
      return;
    }
    if (event.type === 'STICK_EQUIPPED') {
      if (event.playerId === this.playerId) {
        this.equippedStick = event.stickId;
        this.equippedWeapon = event.stickId;
        this.runner?.setEquippedWeapon(event.stickId);
      }
      this.emitState();
      return;
    }
    if (event.type === 'POWER_SLOT_CHANGED') {
      if (event.playerId === this.playerId) {
        if (event.powerSlots) this.powerSlots = event.powerSlots;
        if (event.skillCounts) this.skillCounts = event.skillCounts;
        if (this.backpack && this.skillCounts) this.backpack.skillCounts = this.skillCounts;
      }
      this.emitState();
      return;
    }
    if (event.type === 'SKILL_COUNT_CHANGED') {
      if (event.playerId === this.playerId) {
        if (event.skillCounts) this.skillCounts = event.skillCounts;
        if (event.powerSlots) this.powerSlots = event.powerSlots;
        if (this.backpack && this.skillCounts) this.backpack.skillCounts = this.skillCounts;
      }
      this.emitState();
      return;
    }
    if (event.type === 'PLAYER_HEALED') {
      if (event.playerId === this.playerId) {
        this.runner.health = event.health;
        audio.playPowerupPickup?.();
        if (this.particles) {
          this.particles.emitPowerupBurst(this.runner.position, 0x44ff88, 24);
        }
        if (!event.isHot) {
          this.showToast(`💚 Vital Rejuvenation restored +${event.amount} Health! (${event.health}/${this.runner.maxHealth})`);
        }
      } else {
        const rival = this.remotePlayers.get(event.playerId)?.state?.name || 'A rival';
        if (!event.isHot) this.showToast(`💚 ${rival} restored +${event.amount} HP.`);
      }
      this.emitState();
      return;
    }
    if (event.type === 'STATUS_EFFECT_APPLIED') {
      if (event.playerId === this.playerId && event.effect) {
        this.statusEffects = this.statusEffects || [];
        const existing = this.statusEffects.find((e) => e.type === event.effect.type);
        if (existing) {
          existing.expiresAt = event.effect.expiresAt;
        } else {
          this.statusEffects.push(event.effect);
        }
        if (event.effect.type === 'BURN') {
          this.damageFlash = Date.now();
          this.showToast('🔥 Burning! Taking fire damage over time.');
        } else if (event.effect.type === 'FREEZE' || event.effect.type === 'FROST_FREEZE') {
          this.showToast('❄️ Frozen! Rooted in place by frost.');
        }
      }
      this.emitState();
      return;
    }
    if (event.type === 'TRAP_DEPLOYED') {
      if (event.trap) this.handleTrapDeployed(event.trap);
      return;
    }
    if (event.type === 'TRAP_TRIGGERED') {
      this.handleTrapTriggered(event);
      return;
    }
    if (event.type === 'SPELL_CAST') {
      this.spawnSpellTracer(event);
      return;
    }
    if (event.type === 'DRAGON_STUNNED') {
      this.showToast(`❄️ ${event.reason || 'Dragon is frozen on the ground!'}`);
      return;
    }
    if (event.type === 'DRAGON_LANDING_TELEGRAPH') {
      const pos = event.position || {
        x: this.dragonMesh ? this.dragonMesh.position.x : 42,
        y: this.worldManager.getHeightAt(42, -34),
        z: this.dragonMesh ? this.dragonMesh.position.z : -34,
      };
      this.showLandingWarningDecal(pos, (event.durationSeconds || 3) * 1000);
      this.showToast('⚠️ WARNING: Dragon crash-landing imminent in 3s! Clear the impact zone!');
      audio.playExplosion();
      return;
    }
    if (event.type === 'DRAGON_LANDED') {
      if (this.dragonState) {
        this.dragonState.flightPhase = 'GROUNDED';
        this.dragonState.flightPhaseTimer = event.durationSeconds || 25;
      }
      this.playDragonAnimation('idle_loop', true);
      const pos = event.position || {
        x: this.dragonMesh ? this.dragonMesh.position.x : 42,
        y: this.worldManager.getHeightAt(42, -34),
        z: this.dragonMesh ? this.dragonMesh.position.z : -34,
      };
      this.spawnGroundImpactShockwaveVFX(pos);
      audio.playExplosion();
      this.showToast('🐉 THE DRAGON HAS LANDED! 1.25x Vulnerability & Ground Traps Active for 25s!');
      this.emitState();
      return;
    }
    if (event.type === 'DRAGON_TAKEOFF') {
      if (this.dragonState) {
        this.dragonState.flightPhase = 'AERIAL';
        this.dragonState.flightPhaseTimer = event.durationSeconds || 60;
      }
      this.playDragonAnimation('takeoff', false);
      setTimeout(() => {
        if (this.dragonState?.flightPhase === 'AERIAL') {
          this.playDragonAnimation('fly_loop', true);
        }
      }, 1500);
      audio.playWingsFlap();
      this.showToast('🦅 The dragon ascends into the skies! Prepare for aerial attacks.');
      this.emitState();
      return;
    }
    if (event.type === 'MOB_ATTACK') {
      const origin = event.origin || { x: 0, y: 1.0, z: 0 };
      const target = event.target || { x: this.runner.position.x, y: this.runner.position.y + 1.0, z: this.runner.position.z };
      const isFire = event.attackType === 'FIRE_SPIT';

      audio.playZombieAttack(isFire);

      this.spawnMobProjectileTracer(origin, target, isFire);

      if (event.targetId === this.playerId) {
        this.damageFlash = Date.now();
        this.showToast(isFire ? `🔥 Struck by Flame Zombie! (-${event.damage} DMG)` : `💧 Struck by Aqua Zombie! (-${event.damage} DMG)`);
      }
      return;
    }
    if (event.type === 'MOB_DAMAGED') {
      audio.playZombieHit();
      const mobGroup = this.worldMobs?.get(event.mobId);
      if (mobGroup) {
        mobGroup.userData.hitFlashTimer = 0.18;
        if (mobGroup.userData.bodyMesh?.material) {
          mobGroup.userData.bodyMesh.material.emissiveIntensity = 2.4;
        }
        mobGroup.userData.lastHealth = event.health;
        drawMobNameplate(mobGroup.userData.labelCanvas, mobGroup.userData.labelCtx, mobGroup.userData.mob.name, event.health, event.maxHealth, mobGroup.userData.mob.tier);
        mobGroup.userData.labelTexture.needsUpdate = true;
      }
      return;
    }
    if (event.type === 'MOB_DEFEATED') {
      const mobGroup = this.worldMobs?.get(event.mobId);
      if (mobGroup) {
        const pos = mobGroup.position.clone();
        if (event.tier === 2) {
          this.spawnFlameEruptionVFX(pos);
        } else {
          this.spawnFrostCageVFX(pos);
        }
        this.scene.remove(mobGroup);
        mobGroup.userData?.labelTexture?.dispose();
        this.worldMobs.delete(event.mobId);
      }
      if (event.killerId === this.playerId) {
        this.showToast(`✨ Defeated ${event.mobType === 'FLAME_BRUTE' ? 'Flame Zombie' : 'Aqua Zombie'}! Natural resources dropped.`);
        audio.playCraftSuccess();
      }
      return;
    }
    if (event.type === 'MOB_ESCALATION') {
      this.showToast(event.message || '⚠️ Mob escalation active!');
      return;
    }
    if (event.type === 'WEAPON_EQUIPPED') {
      if (event.playerId === this.playerId) {
        this.equippedWeapon = event.weaponId;
        this.equippedStick = event.weaponId;
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
      if (event.reason) {
        this.showToast(event.reason);
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
      if (remote) {
        remote.attackTimer = 0.28;
        if (this.attackAnimator && remote.group) {
          this.attackAnimator.spawnMeleeSlash(remote.group.position, remote.group.rotation.y);
        }
      }
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
      if (mesh) {
        mesh.visible = false;
        if (this.particles) {
          const def = ITEM_DEFINITIONS[event.itemType] || RESOURCE_DEFINITIONS[event.itemType];
          this.particles.emitPowerupBurst(mesh.position, def?.color || 0x55eaff, 18);
        }
      }
      this.pendingPickups?.delete(event.id);
      if (event.playerId === this.playerId) {
        audio.playPowerupPickup();
        this.runner.inventory = event.inventory || this.runner.inventory || [];
        this.runner.health = event.health ?? this.runner.health;
        this.playerResources = event.resources || this.playerResources;
        if (event.backpack) this.backpack = event.backpack;
        if (event.ammo) this.playerAmmo = { ...this.playerAmmo, ...event.ammo };
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
      const vulnText = event.isVulnerable ? ' (💥 CRITICAL HIT · 1.25x Grounded DMG)' : '';
      this.showToast(`Dragon took ${event.damage || 0} damage${vulnText} · ${event.health} health left.`);
    } else if (event.type === 'DRAGON_ATTACK_TELEGRAPH') {
      this.dragonState.attack = event.attack;
      this.updateDragonTelegraph(event.attack);
    } else if (event.type === 'DRAGON_ATTACK_RESOLVED') {
      const resolvedAttack = this.dragonState.attack;
      this.dragonState.attack = null;
      this.updateDragonTelegraph(null);
      if (resolvedAttack && this.particles) {
        if (resolvedAttack.type === 'FIRE_BREATH' && resolvedAttack.target) {
          const { x, z } = resolvedAttack.target;
          this.particles.emitExplosion({ x, y: this.worldManager.getHeightAt(x, z) + 0.1, z });
        } else if (resolvedAttack.type === 'GROUND_SLAM') {
          const origin = resolvedAttack.target || resolvedAttack.origin || this.dragonMesh.position;
          this.particles.emitExplosion({ x: origin.x, y: this.worldManager.getHeightAt(origin.x, origin.z) + 0.2, z: origin.z });
          this.particles.emitPowerupBurst({ x: origin.x, y: this.worldManager.getHeightAt(origin.x, origin.z) + 0.5, z: origin.z }, 0xffaa22, 35);
        } else if (resolvedAttack.type === 'TAIL_SWEEP') {
          const origin = this.dragonMesh.position;
          this.particles.emitPowerupBurst({ x: origin.x, y: this.worldManager.getHeightAt(origin.x, origin.z) + 0.5, z: origin.z }, 0xff6622, 25);
        }
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

  launchGame(role = 'player', room = 'default', matchConfig = null, playerName = '') {
    this.returningToMenu = false;
    this.roleSelectMessage = '';
    const cleanRoom = (room || 'default').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) || 'DEFAULT';
    this.roomCode = cleanRoom;
    if (matchConfig) {
      this.matchConfig = normalizeMatchConfig(matchConfig);
    }
    if (playerName) {
      this.localPlayerName = playerName.trim().slice(0, 20);
    } else if (typeof window !== 'undefined') {
      this.localPlayerName = localStorage.getItem('aetherbound_player_name') || this.localPlayerName || 'Survivor';
    }

    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const query = new URLSearchParams({
        role: 'player',
        room: this.roomCode,
        mode: this.matchConfig?.mode || 'ffa',
      });
      if (this.matchConfig?.seed) query.set('seed', String(this.matchConfig.seed));
      if (this.matchConfig?.fillBots !== undefined) query.set('bots', String(this.matchConfig.fillBots));
      if (this.localPlayerName) query.set('name', this.localPlayerName);
      window.history.replaceState({}, '', `?${query.toString()}`);
    }

    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
    this.initNetwork('player');
    this.setRole('player');
    this.requestPointerLock();
    this.emitState();
  }

  selectRole(role) {
    if (this.returningToMenu) {
      if (this.network && this.network.connected && this.network.requestRole(role)) {
        this.roleSelectMessage = '';
        this.emitState();
        return;
      }
      this.launchGame(role, this.roomCode, this.matchConfig, this.localPlayerName);
      return;
    }
    this.setRole(role);
  }

  returnToMenu(notifyServer = true, resetData = {}) {
    if (this.gameOverTimeout) {
      clearTimeout(this.gameOverTimeout);
      this.gameOverTimeout = null;
    }
    if (notifyServer && this.network) {
      this.network.destroy();
      this.network = null;
    }
    this.resetRound({ seed: resetData.seed });
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
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
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
    if (this.activeRole !== 'player') return;

    this.skillCounts = this.skillCounts || {};
    const count = this.skillCounts[ability] ?? 0;
    if (count <= 0) {
      const def = MAGIC_POWERS[ability] || TRAP_DEFINITIONS[ability];
      this.showToast(`⚠️ No charges remaining for ${def?.name || ability}! Craft more at the Arcane Altar [C].`);
      for (let i = 0; i < this.powerSlots.length; i++) {
        if (this.powerSlots[i] === ability) this.powerSlots[i] = null;
      }
      this.emitState();
      return;
    }

    if (TRAP_DEFINITIONS[ability]) {
      this.startTrapTargeting(ability);
      return;
    }

    if (MAGIC_POWERS[ability]) {
      const def = MAGIC_POWERS[ability];

      // Optimistically decrement count for spell
      this.skillCounts[ability] = Math.max(0, count - 1);
      if (this.backpack) this.backpack.skillCounts = this.skillCounts;
      if (this.skillCounts[ability] === 0) {
        for (let i = 0; i < this.powerSlots.length; i++) {
          if (this.powerSlots[i] === ability) this.powerSlots[i] = null;
        }
        this.showToast(`⚠️ ${def.name} charges depleted and removed from loadout!`);
      }

      if (def.category === 'defense') {
        this.network?.castSpell(ability, this.runner.position, { x: 0, y: 1, z: 0 });
        if (audio.playShield) audio.playShield();
      } else if (def.category === 'heal' || ability === 'REJUVENATION') {
        this.network?.castSpell(ability, this.runner.position, { x: 0, y: 1, z: 0 });
        if (audio.playPowerupPickup) audio.playPowerupPickup();
      } else {
        const origin = new THREE.Vector3(this.runner.position.x, this.runner.position.y + 1.2, this.runner.position.z);
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        this.network?.castSpell(ability, origin, camDir);
        if (def.color === 0xff4411) audio.playPlasma();
        else audio.playSpark();
      }
      this.emitState();
      return;
    }
    this.network?.useAbility(ability);
    this.emitState();
  }

  initTrapSystems() {
    this.worldTraps = new Map();
    this.isPlacingTrap = false;
    this.activeTargetingTrap = null;

    this.trapTargetingGroup = new THREE.Group();
    const outerRingGeo = new THREE.RingGeometry(2.4, 2.7, 36);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x33ccff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.trapTargetingOuter = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.trapTargetingOuter.rotation.x = -Math.PI / 2;
    this.trapTargetingGroup.add(this.trapTargetingOuter);

    const innerRingGeo = new THREE.RingGeometry(0.75, 0.95, 24);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x33ccff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.trapTargetingInner = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.trapTargetingInner.rotation.x = -Math.PI / 2;
    this.trapTargetingGroup.add(this.trapTargetingInner);

    this.trapTargetingLight = new THREE.PointLight(0x33ccff, 2.2, 9);
    this.trapTargetingLight.position.y = 0.5;
    this.trapTargetingGroup.add(this.trapTargetingLight);

    this.trapTargetingGroup.visible = false;
    this.scene.add(this.trapTargetingGroup);
  }

  startTrapTargeting(trapType) {
    const def = TRAP_DEFINITIONS[trapType] || MAGIC_POWERS[trapType];
    if (!def) return;
    this.isPlacingTrap = true;
    this.activeTargetingTrap = trapType;
    const color = def.color || 0x33ccff;
    if (this.trapTargetingOuter) this.trapTargetingOuter.material.color.setHex(color);
    if (this.trapTargetingInner) this.trapTargetingInner.material.color.setHex(color);
    if (this.trapTargetingLight) this.trapTargetingLight.color.setHex(color);
    this.trapTargetingGroup.visible = true;
    this.showToast(`[LMB / TAP] Place ${def.name} · [RMB / ESC] Cancel`);
    this.emitState();
  }

  cancelTrapTargeting() {
    this.isPlacingTrap = false;
    this.activeTargetingTrap = null;
    if (this.trapTargetingGroup) this.trapTargetingGroup.visible = false;
    this.emitState();
  }

  confirmTrapPlacement() {
    if (!this.isPlacingTrap || !this.activeTargetingTrap) return;
    const trapType = this.activeTargetingTrap;
    const trapPos = this.trapTargetingGroup.position.clone();

    // Optimistically decrement count for trap
    this.skillCounts = this.skillCounts || {};
    const count = this.skillCounts[trapType] ?? 0;
    this.skillCounts[trapType] = Math.max(0, count - 1);
    if (this.backpack) this.backpack.skillCounts = this.skillCounts;

    if (this.skillCounts[trapType] === 0) {
      const def = TRAP_DEFINITIONS[trapType] || MAGIC_POWERS[trapType];
      for (let i = 0; i < this.powerSlots.length; i++) {
        if (this.powerSlots[i] === trapType) this.powerSlots[i] = null;
      }
      this.showToast(`⚠️ ${def?.name || trapType} depleted and removed from loadout!`);
    }

    this.network?.deployTrap(trapType, trapPos);
    audio.playTrapArm();
    this.cancelTrapTargeting();
  }

  updateTrapTargeting(dt) {
    if (!this.isPlacingTrap || !this.trapTargetingGroup.visible) return;
    if (this.trapTargetingOuter) this.trapTargetingOuter.rotation.z += 1.2 * dt;
    if (this.trapTargetingInner) this.trapTargetingInner.rotation.z -= 1.8 * dt;

    this.camera.getWorldDirection(_scratchCamDir);

    const targetDist = 12.0;
    const groundX = this.runner.position.x + _scratchCamDir.x * targetDist;
    const groundZ = this.runner.position.z + _scratchCamDir.z * targetDist;
    const groundY = this.worldManager.getHeightAt(groundX, groundZ) + 0.12;

    this.trapTargetingGroup.position.set(groundX, groundY, groundZ);
  }

  createWorldTrapMesh(trap) {
    const def = TRAP_DEFINITIONS[trap.trapType] || MAGIC_POWERS[trap.trapType] || {};
    const color = trap.color || def.color || 0x33ccff;

    const group = new THREE.Group();
    group.position.set(trap.x, trap.y + 0.08, trap.z);

    const discGeo = new THREE.RingGeometry(0.2, trap.radius || 2.8, 28);
    const discMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = -Math.PI / 2;
    group.add(discMesh);

    const coreGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.15, 8);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x222233,
      emissive: color,
      emissiveIntensity: 0.8,
      roughness: 0.4,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 0.08;
    group.add(coreMesh);

    const runeLight = new THREE.PointLight(color, 1.5, 6);
    runeLight.position.y = 0.4;
    group.add(runeLight);

    group.userData = {
      trap,
      discMesh,
      runeLight,
      color,
      spawnedAt: Date.now(),
    };
    this.scene.add(group);
    return group;
  }

  handleTrapDeployed(trap) {
    if (this.worldTraps.has(trap.id)) return;
    const mesh = this.createWorldTrapMesh(trap);
    this.worldTraps.set(trap.id, mesh);
    if (trap.ownerId === this.playerId) {
      this.showToast(`Placed ${trap.name || 'Magical Trap'}! Arms in 1s.`);
    }
  }

  handleTrapTriggered(event) {
    const trapMesh = this.worldTraps.get(event.trapId);
    if (trapMesh) {
      this.scene.remove(trapMesh);
      this.worldTraps.delete(event.trapId);
    }

    const pos = new THREE.Vector3(event.x, event.y || this.worldManager.getHeightAt(event.x, event.z), event.z);

    if (event.trapType === 'FROST_TRAP') {
      audio.playFrostFreeze();
      this.spawnFrostCageVFX(pos);
    } else if (event.trapType === 'FLAME_SIGIL') {
      audio.playFlameExplosion();
      this.spawnFlameEruptionVFX(pos);
    } else if (event.trapType === 'GRAVITY_SNARE') {
      audio.playGravityVortex();
      this.spawnGravityVortexVFX(pos);
    }

    if (event.victimId === this.playerId) {
      this.showToast(`⚠️ You stepped into a ${event.trapType}!`);
      this.damageFlash = Date.now();
    } else if (event.attackerId === this.playerId) {
      this.showToast(`💥 Your ${event.trapType} triggered! (+${event.damage} DMG)`);
    } else if (event.victimId === 'dragon') {
      this.showToast(`🐉 Dragon struck by ${event.trapType}!`);
    }
    this.emitState();
  }

  spawnFrostCageVFX(pos) {
    const cageGroup = new THREE.Group();
    cageGroup.position.copy(pos);
    const iceGeo = new THREE.ConeGeometry(0.25, 2.8, 5);
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x88eeff,
      emissive: 0x33ccff,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.82,
      roughness: 0.1,
    });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(iceGeo, iceMat);
      spike.position.set(Math.cos(angle) * 1.5, 1.4, Math.sin(angle) * 1.5);
      spike.rotation.x = (Math.random() - 0.5) * 0.2;
      spike.rotation.z = (Math.random() - 0.5) * 0.2;
      cageGroup.add(spike);
    }
    this.scene.add(cageGroup);
    this.activeTracers.push({
      mesh: cageGroup,
      life: 2.2,
      maxLife: 2.2,
      onUpdate: (progress) => {
        cageGroup.scale.setScalar(Math.min(1.0, (1 - progress) * 4));
      },
    });
  }

  spawnFlameEruptionVFX(pos) {
    const fireGeo = new THREE.SphereGeometry(2.5, 12, 10);
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const fireSphere = new THREE.Mesh(fireGeo, fireMat);
    fireSphere.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0));
    this.scene.add(fireSphere);
    this.activeTracers.push({
      mesh: fireSphere,
      life: 0.55,
      maxLife: 0.55,
      onUpdate: (progress) => {
        fireSphere.scale.setScalar(1.0 + (1 - progress) * 2.5);
        fireMat.opacity = progress * 0.85;
      },
    });
  }

  spawnGravityVortexVFX(pos) {
    const vortexGeo = new THREE.RingGeometry(0.2, 3.2, 24);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0xaa22ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
    vortexMesh.position.copy(pos).add(new THREE.Vector3(0, 0.2, 0));
    vortexMesh.rotation.x = -Math.PI / 2;
    this.scene.add(vortexMesh);
    this.activeTracers.push({
      mesh: vortexMesh,
      life: 1.8,
      maxLife: 1.8,
      onUpdate: (progress, dt) => {
        vortexMesh.rotation.z += 8 * dt;
        vortexMat.opacity = progress * 0.8;
      },
    });
  }

  spawnSpellTracer(event) {
    if (event.playerId === this.playerId) {
      this.runner?.playCastGesture(0.28);
    } else {
      const remote = this.remotePlayers?.get(event.playerId);
      if (remote) remote.castTimer = 0.28;
    }

    const powerId = event.powerId || 'FIREBALL';
    if (powerId === 'LIGHTNING_BOLT') audio.playLaser();
    else if (powerId === 'FIREBALL') audio.playPlasma();
    else audio.playSpark();

    if (this.attackAnimator) {
      this.attackAnimator.spawnSpellAttack(event);
    }
  }

  initMobSystems() {
    this.worldMobs = new Map();
  }

  createMobMesh(mob) {
    const isFire = mob.tier === 2;
    const group = new THREE.Group();
    group.position.set(mob.x, mob.y, mob.z);
    group.rotation.y = mob.ry || 0;

    // Overhead 3D Canvas Nameplate / Healthbar
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 240;
    labelCanvas.height = 70;
    const labelCtx = labelCanvas.getContext('2d');
    drawMobNameplate(labelCanvas, labelCtx, mob.name, mob.health, mob.maxHealth, mob.tier);
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }));
    labelSprite.position.y = isFire ? 1.7 : 1.25;
    labelSprite.scale.set(2.4, 0.7, 1);
    group.add(labelSprite);

    group.userData = {
      mob,
      labelCanvas,
      labelCtx,
      labelTexture,
      labelSprite,
      lastHealth: mob.health,
      targetPos: new THREE.Vector3(mob.x, mob.y, mob.z),
      targetYaw: mob.ry || 0,
      hitFlashTimer: 0,
      orbitingParts: [],
      emissiveParts: [],
      emissiveMaterials: [],
    };

    if (this.zombieGltf) {
      this.setupZombieModelForMob(group, mob);
    } else {
      this.setupFallbackMob(group, mob);
    }

    this.scene.add(group);
    return group;
  }

  setupZombieModelForMob(group, mob) {
    const isFire = mob.tier === 2;
    if (group.userData.modelRoot) {
      group.remove(group.userData.modelRoot);
      disposeThreeObject(group.userData.modelRoot);
      group.userData.modelRoot = null;
    }
    if (group.userData.groundRing) {
      group.remove(group.userData.groundRing);
      group.userData.groundRing.geometry?.dispose();
      group.userData.groundRing.material?.dispose();
      group.userData.groundRing = null;
    }
    if (group.userData.emissiveParts) {
      for (const part of group.userData.emissiveParts) {
        group.remove(part);
      }
      group.userData.emissiveParts = [];
    }
    if (group.userData.orbitingParts) {
      for (const drop of group.userData.orbitingParts) {
        group.remove(drop);
        drop.geometry?.dispose();
        drop.material?.dispose();
      }
      group.userData.orbitingParts = [];
    }

    const zombieScene = SkeletonUtils.clone(this.zombieGltf.scene);
    const modelRoot = new THREE.Group();
    // Realistic scale: the raw gltf.scene is 3.08m tall. Scale to ~1.88m (Aqua) or ~2.38m (Flame Brute)
    const scale = isFire ? 0.77 : 0.61;
    modelRoot.scale.setScalar(scale);
    // mob.y is getTerrainHeight + 1.0 (waist level). Set position.y to -1.0 so zombie feet stand firmly on the ground terrain!
    modelRoot.position.y = -1.0;
    modelRoot.add(zombieScene);

    const emissiveMaterials = [];
    const orbitingParts = [];
    const emissiveParts = [];

    // Distinct realistic zombie shaders and textures (Optimized for 60 FPS)
    zombieScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false; // Prevents 33k skinned vertices from executing duplicate shadow map passes
        child.receiveShadow = false;
        child.frustumCulled = true; // Enables camera frustum culling when offscreen
        if (child.material) {
          const origMat = child.material;
          child.material = new THREE.MeshStandardMaterial({
            map: origMat?.map || null,
            normalMap: origMat?.normalMap || null,
            roughnessMap: origMat?.roughnessMap || null,
            metalnessMap: origMat?.metalnessMap || null,
            aoMap: origMat?.aoMap || null,
            roughness: isFire ? 0.75 : 0.65,
            metalness: 0.05,
            color: isFire ? 0xffddcc : 0xffffff,
            emissive: isFire ? 0xff2200 : 0x000000,
            emissiveIntensity: isFire ? 0.35 : 0.0,
            side: THREE.DoubleSide,
          });
          emissiveMaterials.push(child.material);
        }
      }
    });

    // Locate head bone to attach glowing zombie eyes
    let headBone = null;
    zombieScene.traverse((child) => {
      if (child.name === 'mixamorig:Head_06' || (child.name && child.name.toLowerCase().includes('head'))) {
        headBone = child;
      }
    });

    if (headBone) {
      const eyeGeo = new THREE.SphereGeometry(0.8, 6, 6);
      const eyeColor = isFire ? 0xff4400 : 0x00f0ff;
      const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-2.6, 8.5, 9.6);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(2.6, 8.5, 9.6);
      headBone.add(leftEye, rightEye);
    }

    if (isFire) {
      // Magma Basalt Spikes protruding from brute shoulders & back
      const spikeGeo = new THREE.ConeGeometry(3.5, 12, 5);
      const spikeMat = new THREE.MeshStandardMaterial({
        color: 0x1f1410,
        emissive: 0xff4400,
        emissiveIntensity: 1.5,
        roughness: 0.7,
      });
      zombieScene.traverse((child) => {
        if (child.name && (child.name.includes('Shoulder') || child.name.includes('Spine2'))) {
          const spike = new THREE.Mesh(spikeGeo, spikeMat);
          spike.rotation.x = -0.5;
          spike.rotation.z = child.name.includes('Left') ? -0.4 : 0.4;
          child.add(spike);
        }
      });

      // Swirling molten ground ring at ground surface (serves as high-visibility contact aura)
      const magmaRingGeo = new THREE.RingGeometry(0.4, 1.8, 20);
      const magmaRingMat = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const magmaRing = new THREE.Mesh(magmaRingGeo, magmaRingMat);
      magmaRing.rotation.x = -Math.PI / 2;
      magmaRing.position.y = -0.96;
      group.add(magmaRing);
      group.userData.groundRing = magmaRing;
    } else {
      // Tier 1: Aqua Water Zombie - Orbiting water droplets and swirling ground pool
      const dropletGeo = new THREE.SphereGeometry(0.18, 6, 6);
      const dropletMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.88,
        emissive: 0x0284c7,
        emissiveIntensity: 0.9,
        roughness: 0.1,
      });
      for (let i = 0; i < 3; i++) {
        const drop = new THREE.Mesh(dropletGeo, dropletMat);
        group.add(drop);
        orbitingParts.push(drop);
      }

      // Swirling water aura ring at ground surface
      const waterRingGeo = new THREE.RingGeometry(0.3, 1.5, 20);
      const waterRingMat = new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const waterRing = new THREE.Mesh(waterRingGeo, waterRingMat);
      waterRing.rotation.x = -Math.PI / 2;
      waterRing.position.y = -0.96;
      group.add(waterRing);
      group.userData.groundRing = waterRing;
    }

    // Animation Mixer with walking shambling zombie animation
    if (this.zombieClip) {
      const mixer = new THREE.AnimationMixer(zombieScene);
      const action = mixer.clipAction(this.zombieClip);
      action.timeScale = isFire ? 0.82 : 1.05;
      action.play();
      group.userData.mixer = mixer;
    }

    group.add(modelRoot);
    group.userData.modelRoot = modelRoot;
    group.userData.emissiveMaterials = emissiveMaterials;
    group.userData.orbitingParts = orbitingParts;
    group.userData.emissiveParts = emissiveParts;
    group.userData.isFallback = false;
  }

  setupFallbackMob(group, mob) {
    const isFire = mob.tier === 2;
    const modelRoot = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isFire ? 0x2e1a12 : 0x1d4ed8,
      emissive: isFire ? 0xff4400 : 0x00aaff,
      emissiveIntensity: 0.7,
      roughness: isFire ? 0.8 : 0.2,
    });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 1.1, 8), bodyMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    modelRoot.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), bodyMat);
    head.position.y = 1.85;
    head.castShadow = true;
    modelRoot.add(head);

    group.add(modelRoot);
    group.userData.modelRoot = modelRoot;
    group.userData.bodyMesh = torso;
    group.userData.isFallback = true;
  }

  updateMobsVisuals(dt, elapsedTime) {
    if (!this.worldMobs) return;
    const playerPos = this.runner?.position;
    let closestDist = Infinity;
    let closestMob = null;

    for (const mobGroup of this.worldMobs.values()) {
      const data = mobGroup.userData;
      if (!data) continue;

      if (data.targetPos) {
        mobGroup.position.lerp(data.targetPos, Math.min(1.0, 8 * dt));
      }
      if (data.targetYaw !== undefined) {
        const yawDelta = Math.atan2(Math.sin(data.targetYaw - mobGroup.rotation.y), Math.cos(data.targetYaw - mobGroup.rotation.y));
        mobGroup.rotation.y += yawDelta * Math.min(1.0, 10 * dt);
      }

      let d = 0;
      if (playerPos) {
        d = playerPos.distanceTo(mobGroup.position);
        if (d < closestDist) {
          closestDist = d;
          closestMob = data.mob;
        }
      }

      // Distance Culling (LOD):
      // Beyond 85m: hide mesh completely and skip all skeletal/droplet math (massive FPS win)
      if (d > 85) {
        if (mobGroup.visible) mobGroup.visible = false;
        continue;
      }
      if (!mobGroup.visible) mobGroup.visible = true;

      // Update walking skeletal animation mixer with distance-based frame pacing
      if (data.mixer) {
        if (d > 35) {
          data.mixerThrottle = (data.mixerThrottle || 0) + 1;
          if (data.mixerThrottle % 2 === 0) {
            data.mixer.update(dt * 2);
          }
        } else {
          data.mixer.update(dt);
        }
      }

      // Rotate ground aura ring (only if within 50m)
      if (data.groundRing && d <= 50) {
        data.groundRing.rotation.z += (data.mob?.tier === 2 ? 0.9 : 1.4) * dt;
      }

      // Orbiting water droplets for Aqua Zombie (only if close <= 30m)
      if (data.orbitingParts && data.orbitingParts.length) {
        if (d <= 30) {
          data.orbitingParts.forEach((drop, idx) => {
            if (!drop.visible) drop.visible = true;
            const angle = elapsedTime * 2.5 + (idx * Math.PI / 2);
            const orbitRadius = 1.35 + Math.sin(elapsedTime * 3 + idx) * 0.15;
            drop.position.set(
              Math.cos(angle) * orbitRadius,
              0.2 + Math.sin(elapsedTime * 2 + idx) * 0.25,
              Math.sin(angle) * orbitRadius
            );
          });
        } else {
          data.orbitingParts.forEach((drop) => {
            if (drop.visible) drop.visible = false;
          });
        }
      }

      // Hit flash visual feedback with single-event transition (no per-frame uniform updates)
      if (data.hitFlashTimer > 0) {
        data.hitFlashTimer -= dt;
        data.needsFlashReset = true;
        if (data.emissiveMaterials && data.emissiveMaterials.length) {
          for (const mat of data.emissiveMaterials) {
            mat.emissive.setHex(0xffffff);
            mat.emissiveIntensity = 1.8;
          }
        }
      } else if (data.needsFlashReset) {
        data.needsFlashReset = false;
        if (data.emissiveMaterials && data.emissiveMaterials.length) {
          const baseColor = data.mob?.tier === 2 ? 0xff2200 : 0x000000;
          const baseIntensity = data.mob?.tier === 2 ? 0.35 : 0.0;
          for (const mat of data.emissiveMaterials) {
            mat.emissive.setHex(baseColor);
            mat.emissiveIntensity = baseIntensity;
          }
        }
      }
    }

    // Atmospheric ambient zombie groans when within 22m of any zombie
    const now = Date.now();
    if (closestDist <= 22 && now >= (this.nextZombieGroanAt || 0)) {
      this.nextZombieGroanAt = now + 7000 + Math.random() * 5000;
      audio.playZombieGroan(closestMob?.tier === 2);
    }
  }

  spawnMobProjectileTracer(origin, target, isFire) {
    if (this.attackAnimator) {
      this.attackAnimator.spawnMobAttack({
        origin,
        target,
        isFire,
        attackType: isFire ? 'FIRE_SPIT' : 'WATER_SPIT',
      });
    }
  }

  spawnWeaponTracer(event) {
    if (event.playerId === this.playerId) {
      this.runner?.playCastGesture(0.24);
    } else {
      const remote = this.remotePlayers?.get(event.playerId);
      if (remote) remote.castTimer = 0.24;
    }

    const weaponId = event.weaponId || 'APPRENTICE_STICK';
    const def = WEAPON_DEFINITIONS[weaponId] || MAGIC_STICKS[weaponId] || WEAPON_DEFINITIONS.APPRENTICE_STICK;

    if (def.sound === 'laser') audio.playLaser();
    else if (def.sound === 'plasma' || def.sound === 'fire_blast') audio.playPlasma();
    else if (def.sound === 'pistol' || def.sound === 'spark') audio.playPistol();
    else if (def.sound === 'rifle' || def.sound === 'nature_bolt') audio.playRifle();

    if (this.attackAnimator) {
      this.attackAnimator.spawnWeaponAttack(event);
    }
  }

  updateTargetingAndAimAssist(dt) {
    if (this.gameState !== 'PLAYING' || this.activeRole !== 'player' || this.runner?.health <= 0) {
      if (this.hasTarget || this.aimAssistActive) {
        this.hasTarget = false;
        this.aimAssistActive = false;
        this.targetInfo = null;
        this.targetName = '';
        this.wasTargetLocked = false;
        if (typeof document !== 'undefined') {
          const reticle = document.getElementById('aim-reticle');
          if (reticle) {
            reticle.classList.remove('target-locked', 'aim-assist-active');
          }
        }
      }
      return;
    }

    const camPos = this.camera.position;
    this.camera.getWorldDirection(_scratchCamDir);

    const currentWeapon = this.equippedWeapon || 'APPRENTICE_STICK';
    const def = WEAPON_DEFINITIONS[currentWeapon] || MAGIC_STICKS[currentWeapon] || WEAPON_DEFINITIONS.APPRENTICE_STICK;
    const isMelee = def.type === 'melee';
    const maxRange = isMelee ? 5.5 : (def.range || 80);

    const candidates = [];

    // 1. Dragon Boss Target
    if (this.dragonMesh && this.dragonMesh.visible && this.dragonState?.alive) {
      _scratchTargetPos.copy(this.dragonMesh.position);
      _scratchTargetPos.y += 2.0;
      _scratchToTarget.subVectors(_scratchTargetPos, camPos);
      const distAlong = _scratchToTarget.dot(_scratchCamDir);

      if (distAlong > 0 && distAlong <= maxRange + 12) {
        _scratchProj.copy(camPos).addScaledVector(_scratchCamDir, distAlong);
        const perpDist = _scratchProj.distanceTo(_scratchTargetPos);
        const hitRadius = 5.5; // Dragon hit radius
        const assistRadius = hitRadius * 1.5; // 8.25m assist radius

        if (perpDist <= assistRadius) {
          candidates.push({
            type: 'dragon',
            name: 'THE DRAGON',
            center: _scratchTargetPos.clone(),
            distAlong,
            perpDist,
            hitRadius,
            assistRadius,
            isHit: perpDist <= hitRadius,
            score: perpDist / hitRadius,
          });
        }
      }
    }

    // 2. Remote Competitors
    for (const remote of this.remotePlayers.values()) {
      if (!remote.state?.alive || !remote.group?.visible) continue;
      _scratchTargetPos.copy(remote.group.position);
      _scratchTargetPos.y += 1.0;
      _scratchToTarget.subVectors(_scratchTargetPos, camPos);
      const distAlong = _scratchToTarget.dot(_scratchCamDir);

      if (distAlong > 0 && distAlong <= maxRange) {
        _scratchProj.copy(camPos).addScaledVector(_scratchCamDir, distAlong);
        const perpDist = _scratchProj.distanceTo(_scratchTargetPos);
        const hitRadius = 1.6; // Player capsule hit radius
        const assistRadius = 3.2; // Generous aim assist window

        if (perpDist <= assistRadius) {
          candidates.push({
            type: 'player',
            name: remote.name || 'ENEMY RUNNER',
            center: _scratchTargetPos.clone(),
            distAlong,
            perpDist,
            hitRadius,
            assistRadius,
            isHit: perpDist <= hitRadius,
            score: perpDist / hitRadius,
          });
        }
      }
    }

    // 3. Living World Mobs
    if (this.worldMobs) {
      for (const mobGroup of this.worldMobs.values()) {
        const mob = mobGroup.userData?.mob;
        if (!mob || mob.health <= 0) continue;
        _scratchTargetPos.copy(mobGroup.position);
        _scratchTargetPos.y += 1.2;
        _scratchToTarget.subVectors(_scratchTargetPos, camPos);
        const distAlong = _scratchToTarget.dot(_scratchCamDir);

        if (distAlong > 0 && distAlong <= maxRange + 5) {
          _scratchProj.copy(camPos).addScaledVector(_scratchCamDir, distAlong);
          const perpDist = _scratchProj.distanceTo(_scratchTargetPos);
          const hitRadius = 2.0;
          const assistRadius = 3.6;

          if (perpDist <= assistRadius) {
            candidates.push({
              type: 'mob',
              name: mob.name || 'WILD MOB',
              center: _scratchTargetPos.clone(),
              distAlong,
              perpDist,
              hitRadius,
              assistRadius,
              isHit: perpDist <= hitRadius,
              score: perpDist / hitRadius,
            });
          }
        }
      }
    }

    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];

    const hasTarget = Boolean(best && best.isHit);
    const aimAssistActive = Boolean(best && (best.isHit || best.perpDist <= best.assistRadius));

    // Audio cue on new target acquisition
    if (hasTarget && !this.wasTargetLocked) {
      this.wasTargetLocked = true;
      audio.playTargetLock();
    } else if (!hasTarget) {
      this.wasTargetLocked = false;
    }

    this.hasTarget = hasTarget;
    this.aimAssistActive = aimAssistActive;
    this.targetInfo = best || null;
    this.targetName = best ? best.name : '';

    // Direct DOM fast-path for zero-latency 60fps class toggling
    if (typeof document !== 'undefined') {
      const reticle = document.getElementById('aim-reticle');
      if (reticle) {
        reticle.classList.toggle('target-locked', hasTarget);
        reticle.classList.toggle('aim-assist-active', aimAssistActive);

        const tagEl = reticle.querySelector('.aim-target-tag');
        if (tagEl && best) {
          tagEl.textContent = `🎯 ${best.name} [LOCKED]`;
        }
      }
    }

    // Aim Friction: Slows crosshair sensitivity over/near targets
    if (this.runner) {
      if (hasTarget) {
        this.runner.aimFriction = 0.58; // 42% slowdown for precise tracking on target
      } else if (aimAssistActive) {
        this.runner.aimFriction = 0.78; // 22% slowdown when entering assist cone
      } else {
        this.runner.aimFriction = 1.0;
      }
    }

    // Aim Assist Magnetism: Gentle rotational guidance towards target center
    if (aimAssistActive && best && this.runner) {
      _scratchToTarget.subVectors(best.center, camPos).normalize();
      const targetYaw = Math.atan2(-_scratchToTarget.x, -_scratchToTarget.z);
      const targetPitch = Math.asin(THREE.MathUtils.clamp(_scratchToTarget.y, -0.99, 0.99));

      let diffYaw = Math.atan2(
        Math.sin(targetYaw - this.runner.cameraYaw),
        Math.cos(targetYaw - this.runner.cameraYaw)
      );
      let diffPitch = targetPitch - this.runner.cameraPitch;

      // Soft pull within angular cone (~8 degrees = ~0.14 rad)
      if (Math.abs(diffYaw) < 0.16 && Math.abs(diffPitch) < 0.16) {
        const pullSpeed = hasTarget ? 2.2 : 3.5;
        const pullFactor = THREE.MathUtils.clamp(pullSpeed * dt, 0, 0.12);

        const nudgeYaw = THREE.MathUtils.clamp(diffYaw * pullFactor, -0.045, 0.045);
        const nudgePitch = THREE.MathUtils.clamp(diffPitch * pullFactor, -0.035, 0.035);

        this.runner.cameraYaw += nudgeYaw;
        this.runner.cameraPitch = Math.max(-0.75, Math.min(1.15, this.runner.cameraPitch + nudgePitch));
      }
    }
  }

  attack() {
    if (this.activeRole !== 'player' || this.runner.health <= 0) return;
    if (!this.network?.connected) {
      this.showToast('Connecting to the match server…');
      return;
    }

    const currentWeapon = this.equippedWeapon || 'APPRENTICE_STICK';
    const def = WEAPON_DEFINITIONS[currentWeapon] || MAGIC_STICKS[currentWeapon] || WEAPON_DEFINITIONS.APPRENTICE_STICK;

    if (def.type === 'melee') {
      const remaining = this.attackCooldownUntil - Date.now();
      if (remaining > 0) {
        this.showToast(`Strike ready in ${(remaining / 1000).toFixed(1)}s.`);
        return;
      }
      this.attackCooldownUntil = Date.now() + (def.cooldownMs || KNIFE_RULES.cooldownMs);

      // Aim assist facing snap for melee strike
      if (this.targetInfo && this.targetInfo.distAlong <= 4.2) {
        const toT = this.targetInfo.center.clone().sub(this.runner.position);
        this.runner.rotationY = Math.atan2(toT.x, toT.z);
      }

      this.network?.attack();
      this.runner.playKnifeSwing();
      if (this.attackAnimator) {
        this.attackAnimator.spawnMeleeSlash(this.runner.position, this.runner.rotationY);
      }
    } else {
      if (def.ammo !== Infinity) {
        const currentAmmo = this.playerAmmo[currentWeapon] || 0;
        if (currentAmmo <= 0) {
          audio.playEmptyAmmo();
          this.showToast(`No charges! Collect natural resources to recharge.`);
          return;
        }
        this.playerAmmo[currentWeapon] = currentAmmo - 1;
        this.emitState();
      }

      const remaining = this.attackCooldownUntil - Date.now();
      if (remaining > 0) return;
      this.attackCooldownUntil = Date.now() + (def.cooldownMs || 350);

      if (def.sound === 'spark' || def.id === 'APPRENTICE_STICK') audio.playArcaneSpark();
      else if (def.sound === 'pistol') audio.playPistol();
      else if (def.sound === 'rifle' || def.sound === 'nature_bolt') audio.playRifle();
      else if (def.sound === 'laser') audio.playLaser();
      else if (def.sound === 'plasma' || def.sound === 'fire_blast') audio.playPlasma();
      else audio.playArcaneSpark();

      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const origin = new THREE.Vector3(this.runner.position.x, this.runner.position.y + 1.2, this.runner.position.z);

      // Third-person reticle convergence: Raycast from camera along center reticle
      const maxRayDist = def.range || 70;
      let targetPoint = this.camera.position.clone().addScaledVector(camDir, maxRayDist);

      let closestHitDist = maxRayDist;
      const camPos = this.camera.position;

      // 1. Dragon target convergence with aim assist
      if (this.dragonMesh && this.dragonMesh.visible && this.dragonState?.alive) {
        const dragonPos = this.dragonMesh.position.clone();
        dragonPos.y += 2.0;
        const toDragon = dragonPos.clone().sub(camPos);
        const distAlong = toDragon.dot(camDir);
        if (distAlong > 0 && distAlong < closestHitDist) {
          const proj = camPos.clone().addScaledVector(camDir, distAlong);
          const pDist = proj.distanceTo(dragonPos);
          if (pDist <= 7.5) {
            closestHitDist = distAlong;
            targetPoint = pDist <= 5.5 ? proj : proj.clone().lerp(dragonPos, 0.72);
          }
        }
      }

      // 2. Remote competitor contenders convergence with aim assist
      for (const remote of this.remotePlayers.values()) {
        if (!remote.state?.alive || !remote.group.visible) continue;
        const pPos = remote.group.position.clone();
        pPos.y += 1.0;
        const toPlayer = pPos.clone().sub(camPos);
        const distAlong = toPlayer.dot(camDir);
        if (distAlong > 0 && distAlong < closestHitDist) {
          const proj = camPos.clone().addScaledVector(camDir, distAlong);
          const pDist = proj.distanceTo(pPos);
          if (pDist <= 2.8) {
            closestHitDist = distAlong;
            targetPoint = pDist <= 1.6 ? proj : proj.clone().lerp(pPos, 0.75);
          }
        }
      }

      // Calculate weapon ray from player's weapon towards target point
      const fireDir = targetPoint.clone().sub(origin).normalize();
      const finalDir = fireDir.dot(camDir) > 0.2 ? fireDir : camDir;

      this.network?.fireWeapon(currentWeapon, origin, finalDir);
      this.runner.playCastGesture(0.24);
    }
  }

  craftWeapon(recipeIndex) {
    if (!this.network?.connected) return;
    this.network.craftWeapon(recipeIndex);
  }

  channelAltarEssence() {
    if (!this.network?.connected) return;
    this.network.channelAltarEssence();
  }

  equipWeapon(weaponId) {
    if (weaponId === this.equippedWeapon) return;
    this.equippedWeapon = weaponId;
    this.equippedStick = weaponId;
    this.network?.equipWeapon(weaponId);
    this.runner?.setEquippedWeapon(weaponId);
    this.emitState();
  }

  equipStick(stickId) {
    if (stickId === this.equippedStick) return;
    this.equippedStick = stickId;
    this.equippedWeapon = stickId;
    this.network?.equipStick(stickId);
    this.runner?.setEquippedWeapon(stickId);
    this.emitState();
  }

  setPowerSlot(slotIndex, powerId) {
    if (slotIndex < 0 || slotIndex >= 7) return;
    this.powerSlots = this.powerSlots || [null, null, null, null, null, null, null];
    if (powerId) {
      const count = this.skillCounts?.[powerId] ?? 0;
      if (count <= 0) {
        const def = MAGIC_POWERS[powerId] || TRAP_DEFINITIONS[powerId];
        this.showToast(`⚠️ Cannot equip ${def?.name || powerId}: 0 charges available! Craft at Arcane Altar [C].`);
        return;
      }
    }
    this.powerSlots[slotIndex] = powerId;
    this.network?.setPowerSlot(slotIndex, powerId);
    this.emitState();
  }

  usePowerSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= 7) return;
    const powerId = this.powerSlots?.[slotIndex];
    if (!powerId) return;
    this.activateAbility(powerId);
  }

  toggleCraftingModal() {
    this.craftingModalOpen = !this.craftingModalOpen;
    if (this.craftingModalOpen && document.pointerLockElement) document.exitPointerLock?.();
    this.emitState();
  }

  setCraftingModalOpen(open) {
    this.craftingModalOpen = Boolean(open);
    if (this.craftingModalOpen && document.pointerLockElement) document.exitPointerLock?.();
    this.emitState();
  }

  toggleBackpackModal() {
    this.backpackModalOpen = !this.backpackModalOpen;
    if (this.backpackModalOpen && document.pointerLockElement) document.exitPointerLock?.();
    this.emitState();
  }

  setBackpackModalOpen(open) {
    this.backpackModalOpen = Boolean(open);
    if (this.backpackModalOpen && document.pointerLockElement) document.exitPointerLock?.();
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
      const isGrounded = this.dragonState?.flightPhase === 'GROUNDED';
      const dragonLerp = 1 - Math.exp(-dt * (isGrounded ? 5 : 8));
      this.dragonRenderPosition.lerp(this.dragonTargetPosition, dragonLerp);
      this.dragonMesh.position.copy(this.dragonRenderPosition);
      if (!isGrounded) {
        this.dragonMesh.position.y += Math.sin(elapsedTime * 2.2) * 0.38;
      } else {
        this.dragonMesh.position.y += Math.sin(elapsedTime * 1.4) * 0.05;
      }
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
        remote.castTimer = Math.max(0, (remote.castTimer || 0) - dt);
        remote.hitReactTimer = Math.max(0, remote.hitReactTimer - dt);
        remote.animator?.update(dt, {
          ...remote.animationState,
          pitch: remote.pitch,
          attackProgress: remote.attackTimer > 0 ? 1 - remote.attackTimer / 0.28 : 0,
          casting: remote.castTimer > 0,
          castProgress: remote.castTimer > 0 ? 1 - remote.castTimer / 0.24 : 0,
          hitProgress: remote.hitReactTimer > 0 ? 1 - remote.hitReactTimer / 0.24 : 0,
        });
      }

      this.obstacleManager.update(dt);

      if (this.worldTraps) {
        for (const trapGroup of this.worldTraps.values()) {
          const disc = trapGroup.userData?.discMesh;
          if (disc) disc.rotation.z += 0.8 * dt;
          const light = trapGroup.userData?.runeLight;
          if (light) {
            light.intensity = 1.2 + Math.sin(elapsedTime * 4) * 0.5;
          }
        }
      }

      this.updateMobsVisuals(dt, elapsedTime);

      if (this.particles) {
        this.particles.update(dt);
      }

      if (this.attackAnimator) {
        this.attackAnimator.update(dt, this.camera);
      }

      // Update active legacy tracers / VFX
      for (let i = this.activeTracers.length - 1; i >= 0; i--) {
        const tracer = this.activeTracers[i];
        tracer.life -= dt;
        const progress = Math.max(0, tracer.life / tracer.maxLife);
        if (tracer.onUpdate) tracer.onUpdate(progress, dt);
        if (tracer.life <= 0) {
          this.scene.remove(tracer.mesh);
          tracer.mesh.geometry?.dispose();
          tracer.mesh.material?.dispose();
          this.activeTracers.splice(i, 1);
        } else {
          if (tracer.mesh?.material?.opacity !== undefined) {
            tracer.mesh.material.opacity = progress * (tracer.isPlasma ? 0.95 : 0.85);
          }
          if (tracer.isPlasma && tracer.velocity) {
            tracer.mesh.position.addScaledVector(tracer.velocity, dt);
          }
        }
      }

      if (this.activeRole === 'player' && this.runner.health > 0) {
        this.runner.weatherSpeedMultiplier = this.weatherState.movementMultiplier;
        this.runner.update(dt);
        this.physics.updateCharacterPhysics(this.runner, dt);

        // Update aim targeting and aim assist
        this.updateTargetingAndAimAssist(dt);
        this.updateTrapTargeting(dt);

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

        // High-performance distance-culled pickups update (throttled to 12Hz, avoids looping 700+ meshes at 60fps)
        if (!this.lastPickupCheck || elapsedTime - this.lastPickupCheck > 0.08) {
          this.lastPickupCheck = elapsedTime;
          const px = this.runner.position.x;
          const pz = this.runner.position.z;
          const cullDistSq = 55 * 55; // 55m culling radius
          const collectDistSq = 2.8 * 2.8;

          this.nearbyVisiblePickups = [];
          for (let i = 0; i < this.pickups.length; i++) {
            const item = this.pickups[i];
            if (!item.active) continue;
            const dx = item.x - px;
            const dz = item.z - pz;
            const distSq = dx * dx + dz * dz;

            if (distSq < collectDistSq && !this.pendingPickups?.has(item.id)) {
              this.pendingPickups ||= new Set();
              this.pendingPickups.add(item.id);
              this.network.collectItem(item.id);
            }

            const mesh = this.pickupMeshes.get(item.id);
            if (mesh) {
              if (distSq <= cullDistSq) {
                mesh.visible = true;
                this.nearbyVisiblePickups.push(mesh);
              } else {
                mesh.visible = false;
              }
            }
          }
        }

        // Animate only the nearby visible pickups (drops active mesh updates from 743 to ~20)
        if (this.nearbyVisiblePickups && this.nearbyVisiblePickups.length > 0) {
          for (let i = 0; i < this.nearbyVisiblePickups.length; i++) {
            updateCollectibleEntity(this.nearbyVisiblePickups[i], dt, elapsedTime);
          }
        }

        // 1km World Boundary Proximity Warning
        const px = this.runner.position.x;
        const pz = this.runner.position.z;
        const playerRadiusSq = px * px + pz * pz;
        if (playerRadiusSq > 940 * 940) {
          const playerRadius = Math.sqrt(playerRadiusSq);
          const distRemaining = Math.max(0, Math.round(1000 - playerRadius));
          if (!this.lastBoundaryWarningAt || Date.now() - this.lastBoundaryWarningAt > 4000) {
            this.showToast(`⚠ APPROACHING 1KM WORLD BARRIER (${distRemaining}m to boundary)`);
            this.lastBoundaryWarningAt = Date.now();
          }
        }
      } else {
        this.updateTargetingAndAimAssist(dt);
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
      if (!this.worldFocusPositions) {
        this.worldFocusPositions = [this.runner.position, this.camera.position];
      }
      this.worldManager.update(this.worldFocusPositions, elapsedTime);

      // Throttle React state emission to ~10Hz (every 100ms) to eliminate React re-render thrashing
      if (elapsedTime - this.lastStateEmit > 0.1) {
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

    let nearbyZombies = this.cachedNearbyZombies || [];
    if (this.worldMobs && activeChar) {
      const px = activeChar.position.x;
      const pz = activeChar.position.z;
      let closestMobData = null;
      let minDistance = 65; // Threat radar range 65m

      for (const mobGroup of this.worldMobs.values()) {
        const mob = mobGroup.userData?.mob;
        if (!mob || mob.health <= 0) continue;
        const dx = mobGroup.position.x - px;
        const dz = mobGroup.position.z - pz;
        const dist = Math.round(Math.hypot(dx, dz));
        if (dist < minDistance) {
          minDistance = dist;
          const angle = Math.atan2(dx, -dz);
          let heading = 'N';
          if (angle > -Math.PI / 8 && angle <= Math.PI / 8) heading = 'N';
          else if (angle > Math.PI / 8 && angle <= 3 * Math.PI / 8) heading = 'NE';
          else if (angle > 3 * Math.PI / 8 && angle <= 5 * Math.PI / 8) heading = 'E';
          else if (angle > 5 * Math.PI / 8 && angle <= 7 * Math.PI / 8) heading = 'SE';
          else if (angle > -3 * Math.PI / 8 && angle <= -Math.PI / 8) heading = 'NW';
          else if (angle > -5 * Math.PI / 8 && angle <= -3 * Math.PI / 8) heading = 'W';
          else if (angle > -7 * Math.PI / 8 && angle <= -5 * Math.PI / 8) heading = 'SW';
          else heading = 'S';

          closestMobData = {
            id: mob.id,
            name: mob.name || (mob.tier === 2 ? 'Flame Zombie' : 'Aqua Zombie'),
            tier: mob.tier,
            health: mob.health,
            maxHealth: mob.maxHealth,
            distance: dist,
            heading,
          };
        }
      }

      if (!closestMobData) {
        if (!this.cachedNearbyZombies || this.cachedNearbyZombies.length > 0) {
          this.cachedNearbyZombies = [];
        }
        nearbyZombies = this.cachedNearbyZombies;
      } else {
        const last = this.cachedNearbyZombies?.[0];
        if (
          last &&
          last.id === closestMobData.id &&
          last.heading === closestMobData.heading &&
          Math.abs(last.distance - closestMobData.distance) < 2
        ) {
          nearbyZombies = this.cachedNearbyZombies;
        } else {
          this.cachedNearbyZombies = [closestMobData];
          nearbyZombies = this.cachedNearbyZombies;
        }
      }
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
      weapons: this.weapons || ['APPRENTICE_STICK', 'KNIFE'],
      equippedWeapon: this.equippedWeapon || 'APPRENTICE_STICK',
      equippedStick: this.equippedStick || 'APPRENTICE_STICK',
      powerSlots: this.powerSlots || ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION', null, null, null],
      skillCounts: this.skillCounts || {},
      backpack: {
        ...(this.backpack || {
          sticks: ['APPRENTICE_STICK'],
          powers: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION'],
          resources: this.playerResources || {},
        }),
        skillCounts: this.skillCounts || {},
      },
      statusEffects: this.statusEffects || [],
      playerAmmo: this.playerAmmo || {},
      craftingModalOpen: Boolean(this.craftingModalOpen),
      backpackModalOpen: Boolean(this.backpackModalOpen),
      isPlacingTrap: Boolean(this.isPlacingTrap),
      activeTargetingTrap: this.activeTargetingTrap || null,
      abilityCooldowns: this.abilityCooldowns,
      knifeCooldownMs: Math.max(0, this.attackCooldownUntil - Date.now()),
      dragon: this.dragonState,
      nearbyZombies: nearbyZombies.slice(0, 3),
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
        equippedStick: this.equippedStick || 'APPRENTICE_STICK',
        powerSlots: this.powerSlots || [],
        backpack: this.backpack || {},
        statusEffects: this.statusEffects || [],
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
      hasTarget: Boolean(this.hasTarget),
      aimAssistActive: Boolean(this.aimAssistActive),
      targetName: this.targetName || '',
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
    if (this.landingWarningTimeout) clearTimeout(this.landingWarningTimeout);
    this.scene?.remove(this.dragonMesh, this.dragonBreathBeam, this.dragonTelegraph, this.dragonTelegraphRing, this.dragonLandingRing, this.dragonLandingDisc);
    disposeThreeObject(this.dragonMesh);
    disposeThreeObject(this.dragonBreathBeam);
    this.dragonTelegraph?.geometry.dispose();
    this.dragonTelegraph?.material.dispose();
    this.dragonTelegraphRing?.geometry.dispose();
    this.dragonTelegraphRing?.material.dispose();
    this.dragonLandingRing?.geometry.dispose();
    this.dragonLandingRing?.material.dispose();
    this.dragonLandingDisc?.geometry.dispose();
    this.dragonLandingDisc?.material.dispose();
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    for (const mesh of this.pickupMeshes.values()) {
      this.scene?.remove(mesh);
      disposeThreeObject(mesh);
    }
    this.pickupMeshes.clear();
    if (this.zombieGltf?.scene) {
      disposeThreeObject(this.zombieGltf.scene);
      this.zombieGltf = null;
    }
    if (this.worldMobs) {
      for (const mobGroup of this.worldMobs.values()) {
        this.scene?.remove(mobGroup);
        mobGroup.userData?.labelTexture?.dispose();
        disposeThreeObject(mobGroup);
      }
      this.worldMobs.clear();
    }
    if (this.attackAnimator) this.attackAnimator.destroy();
    if (this.network) this.network.destroy();
  }
}
