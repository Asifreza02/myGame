import * as THREE from '/three/three.module.js';
import { GAME_CONFIG, OBSTACLES } from './config.js';
import { audio } from './audio.js';

export class SaboteurController {
  constructor(scene, camera, domElement, physicsSystem, obstacleManager, onPlaceCallback) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.physics = physicsSystem;
    this.obstacleManager = obstacleManager;
    this.onPlaceCallback = onPlaceCallback;

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

    // Build Character Model & Visuals
    this.buildCharacterMesh();
    this.buildReconMarker();
    this.setupInputs();
  }

  // Build the 3D Cyber-Operative Character Mesh for the Saboteur
  buildCharacterMesh() {
    this.mesh = new THREE.Group();

    // 1. Torso / Chassis (Heavy dark carbon armor with glowing orange seams)
    const torsoGeo = new THREE.BoxGeometry(0.85, 1.15, 0.55);
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x18202d,
      roughness: 0.35,
      metalness: 0.8,
    });
    this.torso = new THREE.Mesh(torsoGeo, armorMat);
    this.torso.position.y = 1.35;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.mesh.add(this.torso);

    // Glowing orange energy conduit / chest core
    const coreGeo = new THREE.BoxGeometry(0.4, 0.5, 0.58);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 1.35;
    this.mesh.add(coreMesh);

    // 2. Head & Tactical Visor (Angular helmet with glowing ocular visor)
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x121722,
      roughness: 0.3,
      metalness: 0.85,
    });
    this.head = new THREE.Mesh(headGeo, helmetMat);
    this.head.position.y = 2.15;
    this.head.castShadow = true;
    this.mesh.add(this.head);

    // Glowing orange visor band
    const visorGeo = new THREE.BoxGeometry(0.48, 0.14, 0.25);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.15, 0.22);
    this.mesh.add(visor);

    // Tech antenna fin
    const antGeo = new THREE.BoxGeometry(0.06, 0.35, 0.1);
    const antMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    const antenna = new THREE.Mesh(antGeo, antMat);
    antenna.position.set(0.2, 2.45, -0.1);
    this.mesh.add(antenna);

    // 3. Arms & Holographic Gauntlet Projector
    const armMat = new THREE.MeshStandardMaterial({
      color: 0x242e40,
      roughness: 0.4,
      metalness: 0.7,
    });

    // Left arm
    const leftArmGeo = new THREE.BoxGeometry(0.24, 0.85, 0.26);
    this.leftArm = new THREE.Mesh(leftArmGeo, armMat);
    this.leftArm.position.set(-0.62, 1.3, 0);
    this.leftArm.geometry.translate(0, -0.3, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    // Right arm with Gauntlet Projector
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.62, 1.7, 0);

    const rightArmGeo = new THREE.BoxGeometry(0.26, 0.85, 0.28);
    const rightArmMesh = new THREE.Mesh(rightArmGeo, armMat);
    rightArmMesh.position.y = -0.4;
    rightArmMesh.castShadow = true;
    this.rightArmGroup.add(rightArmMesh);

    // Gauntlet projector emitter lens
    const emitterGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 12);
    const emitterMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    this.gauntletEmitter = new THREE.Mesh(emitterGeo, emitterMat);
    this.gauntletEmitter.position.set(0, -0.85, 0.1);
    this.gauntletEmitter.rotation.x = Math.PI / 2;
    this.rightArmGroup.add(this.gauntletEmitter);

    this.mesh.add(this.rightArmGroup);

    // 4. Cybernetic Legs
    const legGeo = new THREE.BoxGeometry(0.28, 0.85, 0.32);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x18202d,
      roughness: 0.5,
      metalness: 0.7,
    });

    this.leftLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.25, 0.45, 0);
    this.leftLeg.geometry.translate(0, -0.4, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.rightLeg.position.set(0.25, 0.45, 0);
    this.rightLeg.geometry.translate(0, -0.4, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    // 5. Twin Jetpack Thruster Pods (mounted on back)
    const packGeo = new THREE.BoxGeometry(0.6, 0.7, 0.3);
    const packMat = new THREE.MeshStandardMaterial({ color: 0x10151f, metalness: 0.9, roughness: 0.2 });
    const jetpack = new THREE.Mesh(packGeo, packMat);
    jetpack.position.set(0, 1.45, -0.38);
    this.mesh.add(jetpack);

    // Thruster nozzles
    this.thrusters = [];
    const nozzleGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.45, 12);
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x222a38, metalness: 0.9 });
    const flameGeo = new THREE.ConeGeometry(0.14, 0.45, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });

    [-0.22, 0.22].forEach((xOffset) => {
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.position.set(xOffset, 1.35, -0.48);
      this.mesh.add(nozzle);

      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.rotation.x = Math.PI; // point down
      flame.position.set(xOffset, 1.05, -0.48);
      this.mesh.add(flame);
      this.thrusters.push(flame);
    });

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
          this.startSlide();
          break;
        case 'ControlLeft':
        case 'ControlRight':
          this.startSlide();
          break;
        case 'Space':
          this.keys.jump = true;
          // Dynamic vaulting over low obstacle ahead
          if (this.physics && !this.isVaulting) {
            const fwdX = -Math.sin(this.cameraYaw);
            const fwdZ = -Math.cos(this.cameraYaw);
            const vaultTarget = this.physics.checkVaultTarget(this.position, fwdX, fwdZ);
            if (vaultTarget) {
              this.startVault(vaultTarget);
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
        document.body.classList.remove('cursor-unlocked');
        if (document.pointerLockElement !== this.domElement) {
          try { this.domElement.requestPointerLock(); } catch(e) {}
        }
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = (document.pointerLockElement === this.domElement);
      const hint = document.getElementById('cursor-unlock-hint');
      if (this.isPointerLocked) {
        document.body.classList.remove('cursor-unlocked');
        document.body.classList.add('cursor-locked');
        if (hint) hint.innerHTML = '🖱️ Press <b>[Esc]</b> to unlock cursor';
      } else {
        document.body.classList.add('cursor-unlocked');
        document.body.classList.remove('cursor-locked');
        if (hint) hint.innerHTML = '🖱️ Click screen to lock cursor & aim';
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

    // Mouse Look & Distance Control:
    // Mouse Left/Right (dx): turns Saboteur POV & Aim yaw
    // When placing: Mouse Up/Down (dy) adjusts placement distance far / near
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;

      let dx = 0;
      let dy = 0;
      if (this.isPointerLocked) {
        dx = e.movementX;
        dy = e.movementY;
      } else {
        // When cursor is unlocked via Esc, don't spin POV unless player clicks back into game
        return;
      }

      if (dx !== 0 && Math.abs(dx) < 250) {
        const sens = 0.0032 * this.mouseSensitivity;
        this.cameraYaw -= dx * sens;
      }

      if (this.isPlacing && dy !== 0 && Math.abs(dy) < 250) {
        // Moving mouse forward (dy < 0) pushes distance farther, moving back pulls nearer
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
        // Deploy obstacle at exact target pos when placing
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
        // Right click rotates obstacle preview
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
      // Calculate target ground position directly along Saboteur's forward aim vector at placementDistance
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const targetX = this.position.x + forwardX * this.placementDistance;
      const targetZ = this.position.z + forwardZ * this.placementDistance;
      const targetY = this.physics.worldManager.getHeightAt(targetX, targetZ);
      return new THREE.Vector3(targetX, targetY, targetZ);
    }
    // When not placing, standard center raycast
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
      const indicator = document.getElementById('placement-indicator');
      if (indicator) indicator.style.display = 'none';
      return;
    }

    this.currentTargetPos = this.getAimRaycast();
    const indicator = document.getElementById('placement-indicator');
    const titleEl = document.getElementById('placement-title');
    const statusEl = document.getElementById('placement-status');
    const distEl = document.getElementById('placement-dist');

    if (this.currentTargetPos) {
      const def = OBSTACLES[this.selectedType];
      const hasEnergy = def && this.energy >= def.cost;

      // Check distance from Saboteur character to target (Max 75m range)
      const distFromSaboteur = this.position.distanceTo(this.currentTargetPos);
      const inRange = distFromSaboteur <= this.maxPlacementDist;

      const isValidPlacement = hasEnergy && inRange;

      this.obstacleManager.updatePreview(
        this.selectedType,
        this.currentTargetPos,
        isValidPlacement,
        this.placementRotation
      );

      if (indicator && titleEl && statusEl && distEl) {
        indicator.style.display = 'flex';
        const typeIcons = {
          WALL: '🧱 WALL PLACEMENT',
          MUD: '🧪 MUD TRAP PLACEMENT',
          SPIKES: '⚡ SPIKES PLACEMENT',
          BOULDER: '☄️ BOULDER PLACEMENT',
          BARREL: '💥 EXPLOSIVE BARREL PLACEMENT',
        };
        titleEl.innerText = typeIcons[this.selectedType] || `${this.selectedType} PLACEMENT`;
        distEl.innerText = `${distFromSaboteur.toFixed(1)}m / ${this.maxPlacementDist}m [WHEEL: FAR/NEAR]`;

        if (!hasEnergy) {
          statusEl.className = 'placement-status-invalid';
          statusEl.innerText = `⚡ NEED ${def.cost} ENERGY (HAVE ${Math.floor(this.energy)})`;
        } else if (!inRange) {
          statusEl.className = 'placement-status-invalid';
          statusEl.innerText = `⚠️ OUT OF RANGE (> ${this.maxPlacementDist}m)`;
        } else {
          statusEl.className = 'placement-status-valid';
          statusEl.innerText = `● READY TO PLACE [LEFT-CLICK] • [R] ROTATE • [WHEEL / MOUSE-Y] FAR/NEAR`;
        }
      }
    } else {
      this.obstacleManager.hidePreview();
      if (indicator) indicator.style.display = 'none';
    }
  }

  selectObstacle(type) {
    if (!type) {
      this.deselectObstacle();
      return;
    }
    // Clicking or pressing the same type toggles placement off
    if (this.selectedType === type && this.isPlacing) {
      this.deselectObstacle();
      return;
    }

    if (OBSTACLES[type]) {
      this.selectedType = type;
      this.isPlacing = true;
      if (this.enabled) {
        document.body.classList.add('saboteur-placing');
        const aimReticle = document.getElementById('aim-reticle');
        if (aimReticle) aimReticle.style.display = 'block';
      }
      if (window.onObstacleSelected) window.onObstacleSelected(type);
      this.refreshPreview();
    }
  }

  deselectObstacle() {
    this.selectedType = null;
    this.isPlacing = false;
    document.body.classList.remove('saboteur-placing');
    this.obstacleManager.hidePreview();
    const indicator = document.getElementById('placement-indicator');
    if (indicator) indicator.style.display = 'none';
    const aimReticle = document.getElementById('aim-reticle');
    if (aimReticle && this.enabled) aimReticle.style.display = 'block';
    if (window.onObstacleSelected) window.onObstacleSelected(null);
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

  // Direction Steering Helpers (Identical to Runner)
  cycleSensitivity() {
    const levels = [1.2, 1.8, 2.6];
    const idx = levels.indexOf(this.mouseSensitivity);
    this.mouseSensitivity = levels[(idx + 1) % levels.length];
    const badge = document.getElementById('sensitivity-badge');
    if (badge) badge.innerText = `⚡ SENS: ${this.mouseSensitivity}x`;
  }

  // Advanced Traversal: Slide & Vault (Identical to Runner)
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

  // Phase 3: Active Buff Application Methods
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

  // Health Damage & Invulnerability (Identical to Runner)
  takeDamage(amount, source = 'obstacle') {
    if (this.invulnerableTimer > 0) return;

    // Phase 3: Aegis Energy Shield completely deflects and absorbs damage!
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
    this.health = Math.max(0, this.health - amount);
    audio.playDamage();

    // Trigger visual screen damage flash
    const flashEl = document.getElementById('damage-overlay');
    if (flashEl) {
      flashEl.classList.remove('flash');
      void flashEl.offsetWidth;
      flashEl.classList.add('flash');
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

    // Invulnerability cooldown
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }

    // Phase 3: Update Active Buff Timers & Shield Bubble Animation
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

    // Update HUD Recon button cooldown overlay
    if (this.enabled) {
      const reconOverlay = document.getElementById('recon-cooldown-overlay');
      const reconBtn = document.getElementById('btn-recon-pulse');
      if (reconBtn && reconOverlay) {
        if (this.reconCooldownTimer > 0) {
          reconBtn.classList.add('cooling');
          const pct = (this.reconCooldownTimer / this.reconCooldown) * 100;
          reconOverlay.style.width = `${pct}%`;
          const textSpan = reconBtn.querySelector('.recon-label');
          if (textSpan) textSpan.innerText = `📡 Scanner (${Math.ceil(this.reconCooldownTimer)}s)`;
        } else {
          reconBtn.classList.remove('cooling');
          reconOverlay.style.width = '0%';
          const textSpan = reconBtn.querySelector('.recon-label');
          if (textSpan) textSpan.innerText = `📡 Recon Pulse`;
        }
      }
    }

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

        // Vaulting limbs pose
        this.leftLeg.rotation.x = 0.9;
        this.rightLeg.rotation.x = -0.4;
        this.leftArm.rotation.x = -1.1;
        this.rightArmGroup.rotation.x = -1.1;

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
      if (this.keys.sprint && this.stamina > 0 && (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right)) {
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

        // Slide posture
        this.mesh.rotation.x = -0.5;
        this.leftLeg.rotation.x = 1.1;
        this.rightLeg.rotation.x = 0.3;
        this.leftArm.rotation.x = -0.6;
        this.rightArmGroup.rotation.x = -0.6;

        if (this.slideTimer >= this.slideDuration) {
          this.isSliding = false;
          this.mesh.rotation.x = 0;
        }
      } else {
        this.mesh.rotation.x = 0;

        // 7. Normal Ground Movement
        let speed = (this.isSprinting ? GAME_CONFIG.RUNNER.SPRINT_SPEED : GAME_CONFIG.RUNNER.BASE_SPEED) * (this.speedMultiplier || 1.0);
        if (this.isSlowed) {
          speed *= 0.35;
        } else if (this.isInWater) {
          speed *= 0.72;
        }

        // Phase 3: Ice sliding physics on slippery tundra
        if (this.worldManager && typeof this.worldManager.getDominantBiome === 'function') {
          const biome = this.worldManager.getDominantBiome(this.position.x, this.position.z);
          if (biome && biome.isSlippery) {
            speed *= 1.25; // +25% glide traction
          }
        }

        let inputForward = 0;
        let inputRight = 0;
        if (this.keys.forward) inputForward += 1;
        if (this.keys.backward) inputForward -= 1;
        if (this.keys.right) inputRight += 1;
        if (this.keys.left) inputRight -= 1;

        const isMoving = (inputForward !== 0 || inputRight !== 0);

        if (isMoving) {
          const len = Math.sqrt(inputForward * inputForward + inputRight * inputRight);
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

          const animDir = (inputForward < 0) ? -1 : 1;
          this.animTime += dt * speed * 0.9 * animDir;
          this.leftLeg.rotation.x = Math.sin(this.animTime) * 0.8;
          this.rightLeg.rotation.x = -Math.sin(this.animTime) * 0.8;
          this.leftArm.rotation.x = -Math.sin(this.animTime) * 0.7;
          if (this.castTimer <= 0) {
            this.rightArmGroup.rotation.x = Math.sin(this.animTime) * 0.7;
          }
        } else {
          this.leftLeg.rotation.x *= 0.8;
          this.rightLeg.rotation.x *= 0.8;
          this.leftArm.rotation.x *= 0.8;
          if (this.castTimer <= 0) {
            this.rightArmGroup.rotation.x *= 0.8;
          }
        }
      }

      // Knockback horizontal decay
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;

      // Update mesh position and rotation
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotationY;

      // 8. Update Camera: Fixed Third-Person View locked behind Saboteur (Same as Runner)
      this.updateCamera(forwardX, forwardZ);

      // Refresh placement preview
      this.refreshPreview();
    } else {
      // Remote or AI Saboteur in world
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotationY;
    }

    // Cast Animation: Gauntlet Arm Raised
    if (this.castTimer > 0) {
      this.castTimer -= dt;
      this.rightArmGroup.rotation.x = -Math.PI / 2.3;
      this.gauntletEmitter.material.color.setHex(0xffff00);
    } else if (!this.isSliding && !this.isVaulting) {
      this.gauntletEmitter.material.color.setHex(0xff7700);
    }

    // Ground Shadow Disc
    if (this.shadowMesh) {
      const gY = this.physics.worldManager.getHeightAt(this.position.x, this.position.z);
      this.shadowMesh.position.set(this.position.x, gY + 0.06, this.position.z);
    }
  }

  // Camera locked directly behind Saboteur (Identical to Runner)
  updateCamera(forwardX, forwardZ) {
    this.mesh.visible = true;
    const cameraDist = this.cameraDistance; // 6.2
    const cameraHeight = this.cameraHeight; // 2.6

    this.camera.position.set(
      this.position.x - forwardX * cameraDist,
      this.position.y + cameraHeight,
      this.position.z - forwardZ * cameraDist
    );

    // Look target points 25 meters ahead along Saboteur's forward vector at eye level
    const lookTargetX = this.position.x + forwardX * 25.0;
    const lookTargetY = this.position.y + 1.6;
    const lookTargetZ = this.position.z + forwardZ * 25.0;

    this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
  }

  // Network Synchronization
  getState() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      ry: this.rotationY,
      speed: (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) ? 1 : 0,
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

  // AI Saboteur direct control in single-player
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
