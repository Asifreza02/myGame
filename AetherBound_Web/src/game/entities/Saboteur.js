import * as THREE from 'three';
import { GAME_CONFIG, OBSTACLES } from '../config.js';
import { audio } from '../audio.js';
import { CharacterAnimator } from './CharacterAnimator.js';

export class SaboteurController {
  constructor(scene, camera, domElement, physicsSystem, obstacleManager, onPlaceCallback) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.physics = physicsSystem;
    this.obstacleManager = obstacleManager;
    this.onPlaceCallback = onPlaceCallback;

    // Callbacks to notify React UI
    this.onDamage = null;
    this.onPointerLockChange = null;
    this.onPlacementUpdate = null;
    this.onSensitivityChange = null;
    this.onToast = null;

    // Feature enablement flag (false when local player is Runner or Spectator)
    this.enabled = false;

    // Saboteur Character Physics & Ground Traversal (Identical to Runner)
    this.position = new THREE.Vector3(20, 10, 20);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotationY = Math.PI;
    this.isGrounded = false;
    this.isSlowed = false;
    this.isInWater = false;
    this.particles = null;
    this.audio = audio;
    this.role = 'saboteur';

    // Phase 3: Active Power-Ups & Buffs
    this.speedBuffTimer = 0;
    this.speedMultiplier = 1.0;
    this.jumpBuffTimer = 0;
    this.bonusJumpForce = 0;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.worldManager = null;

    // Health System
    this.health = 100;
    this.maxHealth = 100;
    this.invulnerableTimer = 0;

    // Stamina System (Identical to Runner)
    this.stamina = GAME_CONFIG.RUNNER.STAMINA_MAX;
    this.isSprinting = false;

    // Single Fixed Third-Person Camera Angle (Identical to Runner)
    this.mouseSensitivity = 1.2;
    this.prevMouseX = 0;
    this.prevMouseY = 0;
    this.cameraDistance = 6.2; // Fixed distance, strictly no zoom in/out
    this.cameraHeight = 2.6;   // Fixed height
    this.cameraPitch = 0.20;   // Fixed pitch, strictly no up/down look
    this.cameraYaw = 0;
    this.isPointerLocked = false;
    this.goalBeacon = null;

    // Advanced Traversal: Slide & Vaulting (Identical to Runner)
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = GAME_CONFIG.RUNNER.SLIDE_DURATION || 0.75;
    this.slideDir = new THREE.Vector2(0, -1);

    this.isVaulting = false;
    this.vaultStart = new THREE.Vector3();
    this.vaultEnd = new THREE.Vector3();
    this.vaultTimer = 0;
    this.vaultDuration = 0.45;

    // Animation & Stepping Timers
    this.animTime = 0;
    this.stepTimer = 0;
    this.castTimer = 0; // Arm raise animation timer for hazard deployment
    this.hitReactTimer = 0;

    // Saboteur Unique Abilities: Tactical Energy & Deployments
    this.energy = GAME_CONFIG.SABOTEUR.MAX_ENERGY;
    this.maxEnergy = GAME_CONFIG.SABOTEUR.MAX_ENERGY;
    this.selectedType = 'WALL';
    this.isPlacing = true;
    this.placementRotation = 0;
    this.placementDistance = 16.0; // Default distance in meters along aim
    this.minPlacementDist = 3.5;   // Minimum distance (right in front of character)
    this.maxPlacementDist = 75.0;  // Maximum placement distance (75m range limit)

    // Recon Pulse Scanner Ability
    this.reconCooldown = (GAME_CONFIG.SABOTEUR && GAME_CONFIG.SABOTEUR.RECON_COOLDOWN) || 14.0;
    this.reconDuration = (GAME_CONFIG.SABOTEUR && GAME_CONFIG.SABOTEUR.RECON_DURATION) || 6.0;
    this.reconCooldownTimer = 0;
    this.reconActiveTimer = 0;
    this.scanWaves = [];
    this.lastRunnerPos = new THREE.Vector3(0, 0, 0);
    this.onReconCallback = null;

    // Targeting raycast coordinates
    this.mouseNdc = new THREE.Vector2(0, 0);
    this.currentTargetPos = null;

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      slide: false,
      turnLeft: false,
      turnRight: false,
    };
    this.joystickVector = { x: 0, y: 0 };

    // Build Character Model & Visuals
    this.buildCharacterMesh();
    this.animator = new CharacterAnimator(this.mesh);
    this.buildReconMarker();
    this.setupInputs();
  }

  // Build the human adventurer mesh for the Saboteur.
  buildCharacterMesh() {
    this.mesh = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xb97955, roughness: 0.9 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x241b22, roughness: 0.92 });
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x382d48, roughness: 0.9 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x25232f, roughness: 0.94 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x513c32, roughness: 0.92 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xc45a32, roughness: 0.72 });

    // Layered travel clothes distinguish the saboteur without hiding their face.
    const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.48, 4, 10);
    const armorMat = coatMat;
    this.torso = new THREE.Mesh(torsoGeo, armorMat);
    this.torso.name = 'anim-torso';
    this.torso.position.y = 1.08;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.mesh.add(this.torso);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.22, 10), skinMat);
    neck.position.y = 1.67;
    this.mesh.add(neck);

    this.head = new THREE.Group();
    this.head.name = 'anim-head';
    this.head.position.y = 1.87;
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.235, 14, 12), skinMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    this.mesh.add(this.head);

    const earGeo = new THREE.SphereGeometry(0.07, 8, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x261d1b, roughness: 0.55 });
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(side * 0.22, 0, 0);
      this.head.add(ear);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 6), eyeMat);
      eye.position.set(side * 0.085, 0.02, 0.213);
      this.head.add(eye);
    });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skinMat);
    nose.scale.set(0.72, 0.8, 0.8);
    nose.position.set(0, -0.05, 0.23);
    this.head.add(nose);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.247, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hair.position.set(0, 0.04, -0.005);
    this.head.add(hair);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), coatMat);
    hood.scale.set(1.08, 0.72, 0.72);
    hood.position.set(0, 0.02, -0.12);
    this.head.add(hood);

    const collar = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.12, 3, 8), leatherMat);
    collar.rotation.z = Math.PI / 2;
    collar.position.set(0, 1.56, 0);
    this.mesh.add(collar);

    const capeShape = new THREE.Shape();
    capeShape.moveTo(-0.3, 1.5);
    capeShape.lineTo(0.3, 1.5);
    capeShape.lineTo(0.42, 0.7);
    capeShape.lineTo(0, 0.82);
    capeShape.lineTo(-0.42, 0.7);
    capeShape.closePath();
    const cape = new THREE.Mesh(
      new THREE.ShapeGeometry(capeShape),
      new THREE.MeshStandardMaterial({ color: 0x30273a, roughness: 0.96, side: THREE.DoubleSide })
    );
    cape.position.z = -0.34;
    cape.name = 'anim-cape';
    cape.castShadow = true;
    this.mesh.add(cape);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.12, 0.45), leatherMat);
    belt.position.set(0, 0.61, 0);
    this.mesh.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.045), accentMat);
    buckle.position.set(0, 0.61, 0.24);
    this.mesh.add(buckle);
    [-1, 1].forEach((side) => {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.16), leatherMat);
      pouch.position.set(side * 0.31, 0.58, 0.04);
      this.mesh.add(pouch);
    });

    const makeArm = (x, withGauntlet = false) => {
      const arm = new THREE.Group();
      arm.position.set(x, 1.43, 0);
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.34, 4, 8), coatMat);
      sleeve.position.y = -0.27;
      sleeve.castShadow = true;
      arm.add(sleeve);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), skinMat);
      hand.position.y = -0.57;
      arm.add(hand);
      if (withGauntlet) {
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.17, 8), leatherMat);
        cuff.position.y = -0.47;
        arm.add(cuff);
      }
      return arm;
    };
    this.leftArm = makeArm(-0.48);

    this.rightArmGroup = makeArm(0.48, true);
    this.leftArm.name = 'anim-left-arm';
    this.rightArmGroup.name = 'anim-right-arm';

    const emitterGeo = new THREE.SphereGeometry(0.12, 10, 8);
    const emitterMat = new THREE.MeshStandardMaterial({ color: 0xc45a32, roughness: 0.7 });
    this.gauntletEmitter = new THREE.Mesh(emitterGeo, emitterMat);
    this.gauntletEmitter.position.set(0, -0.49, 0.1);
    this.rightArmGroup.add(this.gauntletEmitter);

    this.mesh.add(this.leftArm, this.rightArmGroup);

    const makeLeg = (x) => {
      const leg = new THREE.Group();
      leg.position.set(x, 0.62, 0);
      const trousers = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.36, 4, 8), clothMat);
      trousers.position.y = -0.3;
      trousers.castShadow = true;
      leg.add(trousers);
      const boot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), leatherMat);
      boot.scale.set(0.9, 0.62, 1.35);
      boot.position.set(0, -0.57, 0.065);
      leg.add(boot);
      return leg;
    };
    this.leftLeg = makeLeg(-0.19);
    this.rightLeg = makeLeg(0.19);
    this.leftLeg.name = 'anim-left-leg';
    this.rightLeg.name = 'anim-right-leg';
    this.mesh.add(this.leftLeg, this.rightLeg);

    // 6. Ground Shadow Disc
    const shadowGeo = new THREE.CircleGeometry(0.85, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x050a12,
      transparent: true,
      opacity: 0.5,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.position.y = 0.05;
    this.scene.add(this.shadowMesh);

    // Phase 3: 3D Aegis Energy Shield Bubble
    const shieldGeo = new THREE.IcosahedronGeometry(1.4, 2);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0xff5500, // glowing amber/orange energy field
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.2;
    this.shieldMesh.visible = false;
    this.mesh.add(this.shieldMesh);

    // Add character mesh to scene
    this.scene.add(this.mesh);
  }

  buildReconMarker() {
    const markerGroup = new THREE.Group();
    const diamondGeo = new THREE.OctahedronGeometry(1.2, 0);
    const diamondMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const diamondMesh = new THREE.Mesh(diamondGeo, diamondMat);
    diamondMesh.renderOrder = 9999;
    markerGroup.add(diamondMesh);

    const beamGeo = new THREE.ConeGeometry(0.5, 1.8, 4);
    beamGeo.rotateX(Math.PI);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      depthTest: false,
      transparent: true,
      opacity: 0.85,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.y = -1.2;
    beamMesh.renderOrder = 9999;
    markerGroup.add(beamMesh);

    markerGroup.visible = false;
    this.reconMarker = markerGroup;
    this.scene.add(this.reconMarker);
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
          this.keys.left = true;
          break;
        case 'KeyD':
          this.keys.right = true;
          break;
        case 'ArrowLeft':
        case 'KeyQ':
          this.keys.turnLeft = true;
          break;
        case 'ArrowRight':
        case 'KeyE':
          this.keys.turnRight = true;
          break;
        case 'KeyC':
          if (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) {
            this.startSlide();
          } else {
            this.lookBehind();
          }
          break;
        case 'ControlLeft':
        case 'ControlRight':
          this.startSlide();
          break;
        case 'Space':
          this.keys.jump = true;
          if (this.physics && !this.isVaulting) {
            const fwdX = -Math.sin(this.cameraYaw);
            const fwdZ = -Math.cos(this.cameraYaw);
            const vaultTarget = this.physics.checkVaultTarget(this.position, fwdX, fwdZ);
            if (vaultTarget) {
              this.startVault({ landingPoint: vaultTarget });
              break;
            }
          }
          if (this.isGrounded && !this.isVaulting && !this.isSliding) {
            this.velocity.y = GAME_CONFIG.RUNNER.JUMP_FORCE + (this.bonusJumpForce || 0);
            this.isGrounded = false;
            audio.playJump();
          }
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = true;
          break;
        // Saboteur unique abilities hotkeys
        case 'Digit1': this.selectObstacle('WALL'); break;
        case 'Digit2': this.selectObstacle('MUD'); break;
        case 'Digit3': this.selectObstacle('SPIKES'); break;
        case 'Digit4': this.selectObstacle('BOULDER'); break;
        case 'Digit5': this.selectObstacle('BARREL'); break;
        case 'Digit0': this.deselectObstacle(); break;
        case 'KeyR':
          this.placementRotation += Math.PI / 4;
          this.refreshPreview();
          break;
        case 'KeyX':
          e.preventDefault();
          this.triggerReconPulse();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.enabled) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
          this.keys.left = false;
          break;
        case 'KeyD':
          this.keys.right = false;
          break;
        case 'ArrowLeft':
        case 'KeyQ':
          this.keys.turnLeft = false;
          break;
        case 'ArrowRight':
        case 'KeyE':
          this.keys.turnRight = false;
          break;
        case 'Space':
          this.keys.jump = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = false;
          break;
      }
    });

    // Pointer Lock Management: Click to lock & hide cursor; Esc unlocks cursor
    this.domElement.addEventListener('click', () => {
      if (this.enabled) {
        if (typeof document !== 'undefined') {
          document.body.classList.remove('cursor-unlocked');
          if (document.pointerLockElement !== this.domElement) {
            try { this.domElement.requestPointerLock(); } catch(e) {}
          }
        }
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = (document.pointerLockElement === this.domElement);
      if (this.isPointerLocked) {
        document.body.classList.remove('cursor-unlocked');
        document.body.classList.add('cursor-locked');
      } else {
        document.body.classList.add('cursor-unlocked');
        document.body.classList.remove('cursor-locked');
      }
      if (this.onPointerLockChange) {
        this.onPointerLockChange(this.isPointerLocked);
      }
    });

    // Explicit ESC key listener: unlocks cursor so player can click lobby/menus
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (document.pointerLockElement && document.exitPointerLock) {
          document.exitPointerLock();
        }
        document.body.classList.add('cursor-unlocked');
        document.body.classList.remove('cursor-locked');
      }
    });

    // Mouse Look & Distance Control
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;

      let dx = 0;
      let dy = 0;
      if (this.isPointerLocked) {
        dx = e.movementX;
        dy = e.movementY;
      } else {
        return;
      }

      if (dx !== 0 && Math.abs(dx) < 250) {
        const sens = 0.0032 * this.mouseSensitivity;
        this.cameraYaw -= dx * sens;
      }

      if (this.isPlacing && dy !== 0 && Math.abs(dy) < 250) {
        this.placementDistance = Math.min(
          this.maxPlacementDist,
          Math.max(this.minPlacementDist, this.placementDistance - dy * 0.09)
        );
      }

      this.refreshPreview();
    });

    // Mouse Wheel: Scroll up = farther, Scroll down = nearer
    window.addEventListener('wheel', (e) => {
      if (!this.enabled || !this.isPlacing) return;
      const delta = Math.sign(e.deltaY) * 2.5;
      this.placementDistance = Math.min(
        this.maxPlacementDist,
        Math.max(this.minPlacementDist, this.placementDistance - delta)
      );
      this.refreshPreview();
    }, { passive: true });

    // Trap Deployment on Left Click & Rotation on Right Click
    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;

      if (e.button === 0) {
        if (this.isPlacing) {
          if (this.currentTargetPos) {
            this.attemptPlaceObstacle(this.currentTargetPos);
          } else {
            const rayPos = this.getAimRaycast();
            if (rayPos) {
              this.attemptPlaceObstacle(rayPos);
            }
          }
        }
      } else if (e.button === 2) {
        e.preventDefault();
        if (this.isPlacing) {
          this.placementRotation += Math.PI / 4;
          this.refreshPreview();
        }
      }
    });

    this.domElement.addEventListener('contextmenu', (e) => {
      if (this.enabled) e.preventDefault();
    });
  }

  getAimRaycast() {
    if (this.isPlacing) {
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const targetX = this.position.x + forwardX * this.placementDistance;
      const targetZ = this.position.z + forwardZ * this.placementDistance;
      const targetY = this.physics.worldManager.getHeightAt(targetX, targetZ);
      return new THREE.Vector3(targetX, targetY, targetZ);
    }
    return this.physics.raycastTerrain(this.camera, new THREE.Vector2(0, 0));
  }

  updateMouseNdc(e) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  refreshPreview() {
    if (!this.enabled || !this.isPlacing || !this.selectedType) {
      this.obstacleManager.hidePreview();
      if (this.onPlacementUpdate) {
        this.onPlacementUpdate({ visible: false });
      }
      return;
    }

    this.currentTargetPos = this.getAimRaycast();

    if (this.currentTargetPos) {
      const def = OBSTACLES[this.selectedType];
      const hasEnergy = def && this.energy >= def.cost;

      // Distance from Saboteur character to target (Max 75m range)
      const distFromSaboteur = this.position.distanceTo(this.currentTargetPos);
      const inRange = distFromSaboteur <= this.maxPlacementDist;

      // Disallow placement within 20m protected sanctuary of Goal Beacon
      let isInsideSanctuary = false;
      if (this.goalBeacon) {
        const dx = this.currentTargetPos.x - this.goalBeacon.position.x;
        const dz = this.currentTargetPos.z - this.goalBeacon.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const protectedRadius = GAME_CONFIG.GOAL.PROTECTED_RADIUS || 20.0;
        if (dist < protectedRadius) {
          isInsideSanctuary = true;
        }
      }

      const isValidPlacement = hasEnergy && inRange && !isInsideSanctuary;

      this.obstacleManager.updatePreview(
        this.selectedType,
        this.currentTargetPos,
        isValidPlacement,
        this.placementRotation
      );

      if (this.onPlacementUpdate) {
        this.onPlacementUpdate({
          visible: true,
          selectedType: this.selectedType,
          dist: distFromSaboteur,
          maxDist: this.maxPlacementDist,
          hasEnergy,
          cost: def ? def.cost : 0,
          currentEnergy: this.energy,
          inRange,
          isInsideSanctuary,
          isValidPlacement,
        });
      }
    } else {
      this.obstacleManager.hidePreview();
      if (this.onPlacementUpdate) {
        this.onPlacementUpdate({ visible: false });
      }
    }
  }

  selectObstacle(type) {
    if (!type) {
      this.deselectObstacle();
      return;
    }
    if (this.selectedType === type && this.isPlacing) {
      this.deselectObstacle();
      return;
    }

    if (OBSTACLES[type]) {
      this.selectedType = type;
      this.isPlacing = true;
      if (this.enabled) {
        document.body.classList.add('saboteur-placing');
      }
      this.refreshPreview();
    }
  }

  deselectObstacle() {
    this.selectedType = null;
    this.isPlacing = false;
    document.body.classList.remove('saboteur-placing');
    this.obstacleManager.hidePreview();
    if (this.onPlacementUpdate) {
      this.onPlacementUpdate({ visible: false });
    }
  }

  attemptPlaceObstacle(customPos = null) {
    if (!this.enabled) return;

    const targetPos = customPos || this.currentTargetPos;
    if (!targetPos) return;

    // Check casting distance from Saboteur character
    const distFromSaboteur = this.position.distanceTo(targetPos);
    if (distFromSaboteur > this.maxPlacementDist) {
      audio.playLose();
      this.showToastWarning(`⚠️ OUT OF RANGE: Saboteur must be within ${this.maxPlacementDist}m to deploy! (${distFromSaboteur.toFixed(0)}m away)`);
      return;
    }

    // Disallow placement within 20-meter protected sanctuary of Goal Beacon
    if (this.goalBeacon) {
      const dx = targetPos.x - this.goalBeacon.position.x;
      const dz = targetPos.z - this.goalBeacon.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const protectedRadius = GAME_CONFIG.GOAL.PROTECTED_RADIUS || 20.0;
      if (dist < protectedRadius) {
        audio.playLose();
        this.showToastWarning(`🚫 GOAL SANCTUARY: Cannot place obstacles within ${protectedRadius}m of the Beacon Goal! (${dist.toFixed(1)}m away)`);
        return;
      }
    }

    const def = OBSTACLES[this.selectedType];
    if (!def) return;

    if (this.energy < def.cost) {
      audio.playLose();
      return;
    }

    // Deduct energy
    this.energy -= def.cost;
    audio.playPlacement();

    // Trigger cast animation
    this.castTimer = 0.45;

    // Call placement callback (sends to network & local world)
    if (this.onPlaceCallback) {
      this.onPlaceCallback(this.selectedType, targetPos, {
        x: 0,
        y: this.placementRotation,
        z: 0,
      });
    }
    this.refreshPreview();
  }

  showToastWarning(text) {
    if (this.onToast) {
      this.onToast(text);
    } else {
      const toast = document.getElementById('ai-hazard-toast');
      if (toast) {
        toast.innerText = text;
        toast.className = 'toast-show';
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
          toast.className = 'toast-hide';
        }, 3500);
      }
    }
  }

  triggerReconPulse(customOrigin = null) {
    if (this.reconCooldownTimer > 0) return false;

    this.reconCooldownTimer = this.reconCooldown;
    this.reconActiveTimer = this.reconDuration;
    audio.playReconScan();

    const origin = customOrigin || (this.lastRunnerPos.lengthSq() > 0 ? this.lastRunnerPos : this.position);
    this.createScanWave(origin);

    if (this.onReconCallback) {
      this.onReconCallback(origin);
    }
    return true;
  }

  receiveReconPulse(origin) {
    this.createScanWave(origin || this.lastRunnerPos);
    this.reconActiveTimer = this.reconDuration;
  }

  createScanWave(origin) {
    const waveGeo = new THREE.RingGeometry(1.0, 3.5, 32);
    waveGeo.rotateX(-Math.PI / 2);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.position.set(origin.x, origin.y + 0.3, origin.z);
    this.scene.add(waveMesh);

    this.scanWaves.push({
      mesh: waveMesh,
      radius: 1.0,
      maxRadius: 160.0,
      speed: 95.0,
      alpha: 0.85,
    });
  }

  lookAtGoal() {
    if (!this.goalBeacon) return;
    const dx = this.goalBeacon.position.x - this.position.x;
    const dz = this.goalBeacon.position.z - this.position.z;
    this.cameraYaw = Math.atan2(-dx, -dz);
  }

  lookBehind() {
    this.cameraYaw += Math.PI;
    while (this.cameraYaw > Math.PI) this.cameraYaw -= Math.PI * 2;
    while (this.cameraYaw < -Math.PI) this.cameraYaw += Math.PI * 2;
  }

  cycleSensitivity() {
    const levels = [1.2, 1.8, 2.6];
    const idx = levels.indexOf(this.mouseSensitivity);
    this.mouseSensitivity = levels[(idx + 1) % levels.length];
    if (this.onSensitivityChange) {
      this.onSensitivityChange(this.mouseSensitivity);
    }
  }

  // Mobile & Virtual Controls Support
  setJoystick(x, y) {
    this.joystickVector.x = x;
    this.joystickVector.y = y;
  }

  addCameraYaw(deltaYaw) {
    this.cameraYaw += deltaYaw;
    this.refreshPreview();
  }

  // Controls item placement by screen drag (horizontal rotates POV, vertical changes distance)
  dragItemPlacement(deltaX, deltaY) {
    if (deltaX !== 0) {
      const sens = 0.0032 * this.mouseSensitivity;
      this.cameraYaw -= deltaX * sens;
    }
    if (deltaY !== 0) {
      // Swipe up (deltaY < 0) pushes distance farther, swipe down (deltaY > 0) pulls nearer
      this.placementDistance = Math.min(
        this.maxPlacementDist,
        Math.max(this.minPlacementDist, this.placementDistance - deltaY * 0.12)
      );
    }
    this.refreshPreview();
  }

  adjustPlacementDistance(delta) {
    this.placementDistance = Math.min(
      this.maxPlacementDist,
      Math.max(this.minPlacementDist, this.placementDistance + delta)
    );
    this.refreshPreview();
  }

  rotatePlacement() {
    this.placementRotation += Math.PI / 4;
    this.refreshPreview();
  }

  triggerDeploy() {
    this.attemptPlaceObstacle();
  }

  setSprinting(active) {
    this.keys.sprint = Boolean(active);
  }

  triggerJump() {
    if (!this.enabled) return;
    if (this.physics && !this.isVaulting) {
      const fwdX = -Math.sin(this.cameraYaw);
      const fwdZ = -Math.cos(this.cameraYaw);
      const vaultTarget = this.physics.checkVaultTarget(this.position, fwdX, fwdZ);
      if (vaultTarget) {
        this.startVault({ landingPoint: vaultTarget });
        return;
      }
    }
    if (this.isGrounded && !this.isVaulting && !this.isSliding) {
      this.velocity.y = GAME_CONFIG.RUNNER.JUMP_FORCE + (this.bonusJumpForce || 0);
      this.isGrounded = false;
      audio.playJump();
    }
  }

  startSlide() {
    if (this.isSliding || !this.isGrounded) return;
    this.isSliding = true;
    this.slideTimer = 0;

    let fwd = 0;
    let rt = 0;
    if (this.keys.forward) fwd += 1;
    if (this.keys.backward) fwd -= 1;
    if (this.keys.right) rt += 1;
    if (this.keys.left) rt -= 1;
    if (fwd === 0 && rt === 0) fwd = 1;

    const len = Math.sqrt(fwd * fwd + rt * rt);
    const forwardX = -Math.sin(this.cameraYaw);
    const forwardZ = -Math.cos(this.cameraYaw);
    const rightX = Math.cos(this.cameraYaw);
    const rightZ = -Math.sin(this.cameraYaw);

    this.slideDir.x = (forwardX * (fwd / len) + rightX * (rt / len));
    this.slideDir.y = (forwardZ * (fwd / len) + rightZ * (rt / len));

    audio.playSlide();
    if (this.particles) {
      this.particles.emitDust(this.position, 8);
    }
  }

  startVault(vaultData) {
    if (this.isVaulting) return;
    this.isVaulting = true;
    this.vaultTimer = 0;
    this.vaultDuration = 0.42;
    this.vaultStart.copy(this.position);
    this.vaultEnd.copy(vaultData.landingPoint);
    audio.playVault();
    if (this.particles) {
      this.particles.emitDust(this.position, 6);
    }
  }

  applySpeedBuff(duration, multiplier) {
    this.speedBuffTimer = Math.max(this.speedBuffTimer, duration);
    this.speedMultiplier = multiplier;
  }

  applyJumpBuff(duration, jumpForce) {
    this.jumpBuffTimer = Math.max(this.jumpBuffTimer, duration);
    this.bonusJumpForce = jumpForce - GAME_CONFIG.RUNNER.JUMP_FORCE;
  }

  applyShield(duration) {
    this.hasShield = true;
    this.shieldTimer = Math.max(this.shieldTimer, duration);
    if (this.shieldMesh) this.shieldMesh.visible = true;
  }

  applyHealth(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  getActiveBuffs() {
    const buffs = [];
    if (this.speedBuffTimer > 0) {
      buffs.push({
        type: 'SPEED',
        name: 'Speed Surge',
        icon: '⚡',
        color: '#ffea00',
        timeLeft: this.speedBuffTimer,
        desc: `+60% Sprint (${this.speedBuffTimer.toFixed(1)}s)`
      });
    }
    if (this.jumpBuffTimer > 0) {
      buffs.push({
        type: 'JUMP',
        name: 'High Jump',
        icon: '🦘',
        color: '#00ff88',
        timeLeft: this.jumpBuffTimer,
        desc: `Kinetic Leap (${this.jumpBuffTimer.toFixed(1)}s)`
      });
    }
    if (this.hasShield && this.shieldTimer > 0) {
      buffs.push({
        type: 'SHIELD',
        name: 'Aegis Shield',
        icon: '🛡️',
        color: '#ff5500',
        timeLeft: this.shieldTimer,
        desc: `Hit Absorber (${this.shieldTimer.toFixed(1)}s)`
      });
    }
    return buffs;
  }

  takeDamage(amount, source = 'obstacle') {
    if (this.invulnerableTimer > 0) return;

    if (this.hasShield) {
      this.hasShield = false;
      this.shieldTimer = 0;
      if (this.shieldMesh) this.shieldMesh.visible = false;
      this.invulnerableTimer = 0.65;
      audio.playShieldDeflect();
      if (this.particles) {
        this.particles.emitShieldBubbleBurst(this.position);
      }
      return;
    }

    this.invulnerableTimer = 0.55;
    this.hitReactTimer = 0.24;
    this.health = Math.max(0, this.health - amount);
    audio.playDamage();

    if (this.onDamage) {
      this.onDamage(amount, source);
    } else {
      const flashEl = document.getElementById('damage-overlay');
      if (flashEl) {
        flashEl.classList.remove('flash');
        void flashEl.offsetWidth;
        flashEl.classList.add('flash');
      }
    }

    if (this.particles) {
      this.particles.emitDust(this.position, 10);
    }
  }

  onHazardHit() {
    this.takeDamage(25, 'hazard');
  }

  update(dt, runnerPos) {
    if (runnerPos) {
      this.lastRunnerPos.copy(runnerPos);
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }
    this.hitReactTimer = Math.max(0, this.hitReactTimer - dt);

    if (this.speedBuffTimer > 0) {
      this.speedBuffTimer -= dt;
      if (this.speedBuffTimer <= 0) {
        this.speedBuffTimer = 0;
        this.speedMultiplier = 1.0;
      }
    }

    if (this.jumpBuffTimer > 0) {
      this.jumpBuffTimer -= dt;
      if (this.jumpBuffTimer <= 0) {
        this.jumpBuffTimer = 0;
        this.bonusJumpForce = 0;
      }
    }

    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldTimer = 0;
        this.hasShield = false;
        if (this.shieldMesh) this.shieldMesh.visible = false;
      }
    }

    if (this.hasShield && this.shieldMesh) {
      this.shieldMesh.rotation.y += 1.8 * dt;
      this.shieldMesh.rotation.x += 0.9 * dt;
    }

    // 1. Energy Regeneration
    this.energy = Math.min(this.maxEnergy, this.energy + GAME_CONFIG.SABOTEUR.ENERGY_REGEN * dt);

    // 2. Recon Timers & Markers
    if (this.reconCooldownTimer > 0) {
      this.reconCooldownTimer = Math.max(0, this.reconCooldownTimer - dt);
    }
    if (this.reconActiveTimer > 0) {
      this.reconActiveTimer = Math.max(0, this.reconActiveTimer - dt);
    }

    if (this.reconActiveTimer > 0 && runnerPos) {
      this.reconMarker.visible = true;
      this.reconMarker.position.set(runnerPos.x, runnerPos.y + 3.2, runnerPos.z);
      this.reconMarker.rotation.y += dt * 3.5;
      const s = 1.0 + Math.sin(Date.now() * 0.012) * 0.2;
      this.reconMarker.scale.set(s, s, s);
    } else {
      this.reconMarker.visible = false;
    }

    // Update Expanding Recon Scan Waves
    for (let i = this.scanWaves.length - 1; i >= 0; i--) {
      const w = this.scanWaves[i];
      w.radius += w.speed * dt;
      const progress = w.radius / w.maxRadius;
      w.mesh.scale.set(w.radius, w.radius, w.radius);
      w.mesh.material.opacity = Math.max(0, w.alpha * (1.0 - progress));
      if (progress >= 1.0) {
        this.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
        this.scanWaves.splice(i, 1);
      }
    }

    let inputForward = 0;
    let inputRight = 0;
    let isMoving = false;

    // 3. Movement & Kinematics (When player controls Saboteur on ground)
    if (this.enabled) {
      // Keyboard Camera Turn Inputs (Q / E or Left / Right Arrows)
      if (this.keys.turnLeft) {
        this.cameraYaw += 2.4 * dt;
      }
      if (this.keys.turnRight) {
        this.cameraYaw -= 2.4 * dt;
      }

      // Seeing Direction & Heading Vectors
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);
      inputForward = (this.joystickVector.y || 0) + Number(this.keys.forward) - Number(this.keys.backward);
      inputRight = (this.joystickVector.x || 0) + Number(this.keys.right) - Number(this.keys.left);
      isMoving = Math.abs(inputForward) > 0.05 || Math.abs(inputRight) > 0.05;

      this.rotationY = this.cameraYaw + Math.PI;
      this.mesh.rotation.y = this.rotationY;

      // 4. Vaulting Kinematics (Overrides normal traversal while active)
      if (this.isVaulting) {
        this.vaultTimer += dt;
        const progress = Math.min(1.0, this.vaultTimer / this.vaultDuration);
        const t = 1.0 - Math.pow(1.0 - progress, 3); // cubic ease-out

        this.position.x = THREE.MathUtils.lerp(this.vaultStart.x, this.vaultEnd.x, t);
        this.position.z = THREE.MathUtils.lerp(this.vaultStart.z, this.vaultEnd.z, t);

        const peakY = Math.max(this.vaultStart.y, this.vaultEnd.y) + 0.5;
        if (t < 0.5) {
          this.position.y = THREE.MathUtils.lerp(this.vaultStart.y, peakY, t * 2);
        } else {
          this.position.y = THREE.MathUtils.lerp(peakY, this.vaultEnd.y, (t - 0.5) * 2);
        }

        this.velocity.set(0, 0, 0);

        this.animator.update(dt, {
          grounded: false,
          verticalVelocity: this.velocity.y,
          vaulting: true,
          vaultProgress: progress,
          casting: this.castTimer > 0,
          hitProgress: this.hitReactTimer > 0 ? 1 - this.hitReactTimer / 0.24 : 0,
        });

        this.mesh.position.copy(this.position);

        if (progress >= 1.0) {
          this.isVaulting = false;
          this.isGrounded = true;
        }
        this.updateCamera(forwardX, forwardZ);
        this.refreshPreview();
        return;
      }

      // 5. Stamina handling
      const hasMoveInput = (
        this.keys.forward || this.keys.backward || this.keys.left || this.keys.right ||
        Math.abs(this.joystickVector.x) > 0.1 || Math.abs(this.joystickVector.y) > 0.1
      );

      if (this.keys.sprint && this.stamina > 0 && hasMoveInput) {
        this.isSprinting = true;
        this.stamina = Math.max(0, this.stamina - GAME_CONFIG.RUNNER.STAMINA_DRAIN * dt);
      } else {
        this.isSprinting = false;
        this.stamina = Math.min(GAME_CONFIG.RUNNER.STAMINA_MAX, this.stamina + GAME_CONFIG.RUNNER.STAMINA_RECOVERY * dt);
      }

      // 6. Slide Mechanic Execution
      if (this.isSliding) {
        this.slideTimer += dt;
        const progress = this.slideTimer / this.slideDuration;
        const burstSpeed = GAME_CONFIG.RUNNER.SPRINT_SPEED * (GAME_CONFIG.RUNNER.SLIDE_BURST || 1.35) * (1.0 - progress * 0.65);

        this.position.x += this.slideDir.x * burstSpeed * dt;
        this.position.z += this.slideDir.y * burstSpeed * dt;

        if (this.particles && Math.random() > 0.4) {
          this.particles.emitDust(this.position, 2);
        }

        if (this.slideTimer >= this.slideDuration) {
          this.isSliding = false;
        }
      } else {
        let speed = (this.isSprinting ? GAME_CONFIG.RUNNER.SPRINT_SPEED : GAME_CONFIG.RUNNER.BASE_SPEED) * (this.speedMultiplier || 1.0);
        if (this.isSlowed) {
          speed *= 0.35;
        } else if (this.isInWater) {
          speed *= 0.72;
        }

        if (this.worldManager && typeof this.worldManager.getDominantBiome === 'function') {
          const biome = this.worldManager.getDominantBiome(this.position.x, this.position.z);
          if (biome && biome.isSlippery) {
            speed *= 1.25;
          }
        }

        if (isMoving) {
          const len = Math.max(1.0, Math.sqrt(inputForward * inputForward + inputRight * inputRight));
          const normFwd = inputForward / len;
          const normRt = inputRight / len;

          const moveX = forwardX * normFwd + rightX * normRt;
          const moveZ = forwardZ * normFwd + rightZ * normRt;

          this.position.x += moveX * speed * dt;
          this.position.z += moveZ * speed * dt;

          if (this.isGrounded) {
            this.stepTimer += dt * (this.isSprinting ? 1.6 : 1.0);
            if (this.stepTimer > 0.35) {
              if (this.isInWater) {
                audio.playSplash();
                if (this.particles) this.particles.emitWaterSplash(this.position, 6);
              } else {
                audio.playFootstep();
                if (this.isSprinting && this.particles) this.particles.emitDust(this.position, 2);
              }
              this.stepTimer = 0;
            }
          }

        }
      }

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;

      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotationY;

      this.updateCamera(forwardX, forwardZ);
      this.refreshPreview();
    } else {
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotationY;
    }

    if (this.castTimer > 0) {
      this.castTimer = Math.max(0, this.castTimer - dt);
    }
    if (this.castTimer > 0) {
      this.gauntletEmitter.material.color.setHex(0xffff00);
    } else {
      this.gauntletEmitter.material.color.setHex(0xff7700);
    }

    this.animator.update(dt, {
      moving: isMoving && this.enabled && !this.isSliding,
      sprinting: this.isSprinting,
      forward: inputForward,
      strafe: inputRight,
      grounded: this.isGrounded,
      verticalVelocity: this.velocity.y,
      sliding: this.isSliding,
      slideProgress: this.slideTimer / this.slideDuration,
      casting: this.castTimer > 0,
      castProgress: 1 - this.castTimer / 0.45,
      hitProgress: this.hitReactTimer > 0 ? 1 - this.hitReactTimer / 0.24 : 0,
    });

    if (this.shadowMesh) {
      const gY = this.physics.worldManager.getHeightAt(this.position.x, this.position.z);
      this.shadowMesh.position.set(this.position.x, gY + 0.06, this.position.z);
    }
  }

  updateCamera(forwardX, forwardZ) {
    this.mesh.visible = true;
    const cameraDist = this.cameraDistance; // 6.2
    const cameraHeight = this.cameraHeight; // 2.6

    this.camera.position.set(
      this.position.x - forwardX * cameraDist,
      this.position.y + cameraHeight,
      this.position.z - forwardZ * cameraDist
    );

    const lookTargetX = this.position.x + forwardX * 25.0;
    const lookTargetY = this.position.y + 1.6;
    const lookTargetZ = this.position.z + forwardZ * 25.0;

    this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
  }

  getState() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      ry: this.rotationY,
      speed: (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right || Math.abs(this.joystickVector.x) > 0.1 || Math.abs(this.joystickVector.y) > 0.1) ? 1 : 0,
      isGrounded: this.isGrounded,
      stamina: this.stamina,
      health: this.health,
      energy: this.energy,
    };
  }

  setState(remoteState) {
    if (!remoteState) return;
    this.position.set(remoteState.x, remoteState.y, remoteState.z);
    this.rotationY = remoteState.ry || 0;
    if (remoteState.health !== undefined) this.health = remoteState.health;
    if (remoteState.energy !== undefined) this.energy = remoteState.energy;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
    if (this.shadowMesh) {
      this.shadowMesh.position.set(this.position.x, this.position.y + 0.06, this.position.z);
    }
  }

  setAIState(x, z, targetFaceX = null, targetFaceZ = null, isCasting = false) {
    this.position.x = x;
    this.position.z = z;
    const groundY = this.physics.worldManager.getHeightAt(x, z);
    this.position.y = groundY;

    if (targetFaceX !== null && targetFaceZ !== null) {
      this.rotationY = Math.atan2(targetFaceX - x, targetFaceZ - z);
    }

    if (isCasting) {
      this.castTimer = 0.5;
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;

    if (this.shadowMesh) {
      this.shadowMesh.position.set(x, groundY + 0.06, z);
    }
  }
}
