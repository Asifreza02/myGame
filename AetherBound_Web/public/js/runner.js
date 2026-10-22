import * as THREE from '/three/three.module.js';
import { GAME_CONFIG } from './config.js';
import { audio } from './audio.js';

export class RunnerController {
  constructor(scene, camera, domElement) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;

    this.position = new THREE.Vector3(0, 10, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotationY = 0;
    this.isGrounded = false;
    this.isSlowed = false;
    this.isInWater = false;

    // Health & Damage
    this.health = 100;
    this.maxHealth = 100;
    this.invulnerableTimer = 0;

    // Stamina
    this.stamina = GAME_CONFIG.RUNNER.STAMINA_MAX;
    this.isSprinting = false;
    this.role = 'runner';

    // Phase 3: Active Power-Ups & Buffs
    this.speedBuffTimer = 0;
    this.speedMultiplier = 1.0;
    this.jumpBuffTimer = 0;
    this.bonusJumpForce = 0;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.worldManager = null;

    // Single Fixed Third-Person Camera Angle (Left/Right POV Only, No Zoom, Fixed Aim Point)
    this.mouseSensitivity = 1.2;
    this.prevMouseX = 0;
    this.prevMouseY = 0;
    this.cameraDistance = 6.2; // Fixed distance, no zoom in/out
    this.cameraHeight = 2.6;   // Fixed height
    this.cameraPitch = 0.20;   // Fixed pitch, no up/down look
    this.cameraYaw = 0;
    this.isPointerLocked = false;
    this.goalBeacon = null; // Set from main.js

    // Advanced Traversal: Slide & Vaulting
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = GAME_CONFIG.RUNNER.SLIDE_DURATION || 0.75;
    this.slideDir = new THREE.Vector2(0, -1);

    this.isVaulting = false;
    this.vaultStart = new THREE.Vector3();
    this.vaultEnd = new THREE.Vector3();
    this.vaultTimer = 0;
    this.vaultDuration = 0.45;

    this.particles = null; // Assigned from main.js
    this.audio = audio;
    this.physics = null;   // Assigned from main.js
    this.enabled = true;   // Only active when player is Runner

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

    // Animation timers
    this.animTime = 0;
    this.stepTimer = 0;

    this.buildAvatar();
    this.setupInputs();
  }

  buildAvatar() {
    this.group = new THREE.Group();

    // Stylized Cyber-Runner Avatar
    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.0, 0.5);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.torso = new THREE.Mesh(torsoGeo, torsoMat);
    this.torso.position.y = 1.1;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // Glowing Core Reactor on chest
    const coreGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
    coreGeo.rotateX(Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 1.2, 0.28);
    this.group.add(core);

    // Head + Visor
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x22222b, metalness: 0.5 });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.y = 1.85;
    this.head.castShadow = true;
    this.group.add(this.head);

    const visorGeo = new THREE.BoxGeometry(0.46, 0.14, 0.25);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.87, 0.16);
    this.group.add(visor);

    // Left & Right Arms
    const armGeo = new THREE.BoxGeometry(0.24, 0.8, 0.24);
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x1a2b3c, metalness: 0.6 });

    this.leftArm = new THREE.Mesh(armGeo, limbMat);
    this.leftArm.position.set(-0.55, 1.1, 0);
    this.leftArm.geometry.translate(0, -0.3, 0);
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, limbMat);
    this.rightArm.position.set(0.55, 1.1, 0);
    this.rightArm.geometry.translate(0, -0.3, 0);
    this.group.add(this.rightArm);

    // Left & Right Legs
    const legGeo = new THREE.BoxGeometry(0.28, 0.9, 0.28);
    this.leftLeg = new THREE.Mesh(legGeo, limbMat);
    this.leftLeg.position.set(-0.25, 0.6, 0);
    this.leftLeg.geometry.translate(0, -0.4, 0);
    this.leftLeg.castShadow = true;
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, limbMat);
    this.rightLeg.position.set(0.25, 0.6, 0);
    this.rightLeg.geometry.translate(0, -0.4, 0);
    this.rightLeg.castShadow = true;
    this.group.add(this.rightLeg);

    // Phase 3: 3D Aegis Energy Shield Bubble
    const shieldGeo = new THREE.IcosahedronGeometry(1.35, 2);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.1;
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    this.scene.add(this.group);
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      switch (e.code) {
        case 'KeyW': this.keys.forward = true; break;
        case 'KeyS': this.keys.backward = true; break;
        case 'KeyA': this.keys.left = true; break;
        case 'KeyD': this.keys.right = true; break;
        case 'ArrowUp': this.keys.forward = true; break;
        case 'ArrowDown': this.keys.backward = true; break;
        case 'ArrowLeft': this.keys.turnLeft = true; break;
        case 'ArrowRight': this.keys.turnRight = true; break;
        case 'KeyQ': this.keys.turnLeft = true; break;
        case 'KeyE': this.keys.turnRight = true; break;
        case 'KeyF':
          this.lookAtGoal();
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
          // Check for vaulting over low obstacle ahead
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
        case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = true; break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.enabled) return;
      switch (e.code) {
        case 'KeyW': this.keys.forward = false; break;
        case 'KeyS': this.keys.backward = false; break;
        case 'KeyA': this.keys.left = false; break;
        case 'KeyD': this.keys.right = false; break;
        case 'ArrowUp': this.keys.forward = false; break;
        case 'ArrowDown': this.keys.backward = false; break;
        case 'ArrowLeft': this.keys.turnLeft = false; break;
        case 'ArrowRight': this.keys.turnRight = false; break;
        case 'KeyQ': this.keys.turnLeft = false; break;
        case 'KeyE': this.keys.turnRight = false; break;
        case 'Space': this.keys.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = false; break;
      }
    });

    // Pointer Lock Management: Click to lock & hide cursor; Esc unlocks and shows cursor
    this.domElement.addEventListener('click', () => {
      if (window.gameApp && window.gameApp.activeRole === 'runner') {
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

    // Explicit ESC key listener to release pointer lock and show cursor
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (document.pointerLockElement && document.exitPointerLock) {
          document.exitPointerLock();
        }
        document.body.classList.add('cursor-unlocked');
        document.body.classList.remove('cursor-locked');
      }
    });

    // 1. Mouse Movement: Left/Right POV Rotation Only (Active when pointer locked)
    window.addEventListener('mousemove', (e) => {
      if (window.gameApp && window.gameApp.activeRole !== 'runner') return;

      let dx = 0;
      if (this.isPointerLocked) {
        dx = e.movementX;
      } else {
        // When cursor is unlocked via Esc, user can freely use the cursor without spinning POV
        this.prevMouseX = e.clientX;
        return;
      }

      if (dx !== 0 && Math.abs(dx) < 250) {
        const sens = 0.0032 * this.mouseSensitivity;
        this.cameraYaw -= dx * sens;
        // Pitch is fixed: strictly no up/down camera pitch change
      }
    });

    // 2. Touchpad Two-Finger Pan / Swipe (deltaX) - NO ZOOM
    window.addEventListener('wheel', (e) => {
      if (window.gameApp && window.gameApp.activeRole !== 'runner') return;

      // Touchpad horizontal swipe directly rotates seeing direction left/right!
      if (Math.abs(e.deltaX) > 1.0) {
        this.cameraYaw -= e.deltaX * 0.003 * this.mouseSensitivity;
      }
      // Note: Zoom in / Zoom out feature has been removed as requested.
    }, { passive: true });

    // 3. Touchpad / Touchscreen Horizontal Swipe Handling
    let touchStartX = 0;
    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
      }
    }, { passive: true });

    this.domElement.addEventListener('touchmove', (e) => {
      if (window.gameApp && window.gameApp.activeRole !== 'runner') return;
      if (e.touches.length > 0) {
        const dx = e.touches[0].clientX - touchStartX;
        touchStartX = e.touches[0].clientX;

        const sens = 0.005 * this.mouseSensitivity;
        this.cameraYaw -= dx * sens;
        // Strictly no up/down pitch change
      }
    }, { passive: true });
  }

  // Toggle Steering Mode: Free Mouse/Touchpad vs Click-Drag
  toggleSteeringMode() {
    this.steeringMode = (this.steeringMode === 'FREE_MOUSE') ? 'CLICK_DRAG' : 'FREE_MOUSE';
    const badge = document.getElementById('steering-mode-badge');
    if (badge) {
      badge.innerText = (this.steeringMode === 'FREE_MOUSE') ? '🖱️ FREE MOUSE/TOUCHPAD' : '🖱️ CLICK & DRAG';
    }
    audio.playPlacement();
  }

  // Cycle mouse / touchpad sensitivity: 1.0x -> 1.8x -> 2.6x
  cycleSensitivity() {
    if (this.mouseSensitivity === 1.2) this.mouseSensitivity = 1.8;
    else if (this.mouseSensitivity === 1.8) this.mouseSensitivity = 2.6;
    else this.mouseSensitivity = 1.2;

    const badge = document.getElementById('sensitivity-badge');
    if (badge) {
      badge.innerText = `⚡ SENS: ${this.mouseSensitivity}x`;
    }
    audio.playPlacement();
  }


  // Snap viewing direction directly towards the Beacon Goal
  lookAtGoal() {
    if (!this.goalBeacon) return;
    const goalPos = this.goalBeacon.position;
    const dx = goalPos.x - this.position.x;
    const dz = goalPos.z - this.position.z;
    // Align camera yaw directly facing the goal (left/right only)
    this.cameraYaw = Math.atan2(dx, dz) + Math.PI;
    audio.playPlacement();
  }

  // Reverse viewing direction 180° to look behind
  lookBehind() {
    this.cameraYaw += Math.PI;
    audio.playPlacement();
  }

  // Initiate power slide
  startSlide() {
    if (this.isSliding || this.isVaulting || !this.isGrounded) return;
    if (this.stamina < 10) return;

    this.isSliding = true;
    this.slideTimer = 0;
    this.stamina = Math.max(0, this.stamina - 15);

    const fwdX = -Math.sin(this.cameraYaw);
    const fwdZ = -Math.cos(this.cameraYaw);
    this.slideDir.set(fwdX, fwdZ).normalize();

    audio.playSlide();
    if (this.particles) {
      this.particles.emitDust(this.position, 8);
    }
  }

  // Initiate vault over low obstacle
  startVault(targetPos) {
    if (this.isVaulting) return;
    this.isVaulting = true;
    this.isSliding = false;
    this.vaultTimer = 0;
    this.vaultStart.copy(this.position);
    this.vaultEnd.copy(targetPos);

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
        color: '#00d4ff',
        timeLeft: this.shieldTimer,
        desc: `Hit Absorber (${this.shieldTimer.toFixed(1)}s)`
      });
    }
    return buffs;
  }

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
      void flashEl.offsetWidth; // trigger reflow
      flashEl.classList.add('flash');
    }

    if (this.particles) {
      this.particles.emitDust(this.position, 10);
    }
  }

  onHazardHit() {
    this.takeDamage(25, 'hazard');
  }

  update(dt) {
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

    // 1. Keyboard Camera Turn Inputs (Q / E or Left / Right Arrows)
    if (this.keys.turnLeft) {
      this.cameraYaw += 2.4 * dt;
    }
    if (this.keys.turnRight) {
      this.cameraYaw -= 2.4 * dt;
    }

    // 2. Player Seeing Direction & Heading Vectors
    const forwardX = -Math.sin(this.cameraYaw);
    const forwardZ = -Math.cos(this.cameraYaw);
    const rightX = Math.cos(this.cameraYaw);
    const rightZ = -Math.sin(this.cameraYaw);

    this.rotationY = this.cameraYaw + Math.PI;
    this.group.rotation.y = this.rotationY;

    // 3. Vaulting Kinematics (Overrides normal traversal while active)
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
      this.rightArm.rotation.x = -1.1;

      this.group.position.copy(this.position);

      if (progress >= 1.0) {
        this.isVaulting = false;
        this.isGrounded = true;
      }
      this.updateCamera(forwardX, forwardZ);
      return;
    }

    // 4. Stamina handling
    if (this.keys.sprint && this.stamina > 0 && (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right)) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - GAME_CONFIG.RUNNER.STAMINA_DRAIN * dt);
    } else {
      this.isSprinting = false;
      this.stamina = Math.min(GAME_CONFIG.RUNNER.STAMINA_MAX, this.stamina + GAME_CONFIG.RUNNER.STAMINA_RECOVERY * dt);
    }

    // Low stamina warning heartbeat
    if (this.stamina < 18 && this.isSprinting && Math.random() > 0.94) {
      audio.playTick();
    }

    // 5. Slide Mechanic Execution
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
      this.group.rotation.x = -0.5;
      this.leftLeg.rotation.x = 1.1;
      this.rightLeg.rotation.x = 0.3;
      this.leftArm.rotation.x = -0.6;
      this.rightArm.rotation.x = -0.6;

      if (this.slideTimer >= this.slideDuration) {
        this.isSliding = false;
        this.group.rotation.x = 0;
      }
    } else {
      this.group.rotation.x = 0;

      // 6. Normal Movement
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
        this.rightArm.rotation.x = Math.sin(this.animTime) * 0.7;
      } else {
        this.leftLeg.rotation.x *= 0.8;
        this.rightLeg.rotation.x *= 0.8;
        this.leftArm.rotation.x *= 0.8;
        this.rightArm.rotation.x *= 0.8;
      }
    }

    // Decay horizontal knockback velocity
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.velocity.x *= 0.85;
    this.velocity.z *= 0.85;

    // Update avatar mesh position and rotation
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;

    // 6. Update Camera: Fixed Third-Person View locked behind the player aiming at the center reticle
    this.updateCamera(forwardX, forwardZ);
  }

  updateCamera(forwardX, forwardZ) {
    this.group.visible = true;
    const cameraDist = this.cameraDistance; // 6.2
    const cameraHeight = this.cameraHeight; // 2.6

    this.camera.position.set(
      this.position.x - forwardX * cameraDist,
      this.position.y + cameraHeight,
      this.position.z - forwardZ * cameraDist
    );

    // Look target points 25 meters ahead along the player's forward vector at eye level
    const lookTargetX = this.position.x + forwardX * 25.0;
    const lookTargetY = this.position.y + 1.6;
    const lookTargetZ = this.position.z + forwardZ * 25.0;

    this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
  }

  // Get network sync payload
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
    };
  }

  // Set position when synced from network (or respawn)
  setState(st) {
    this.position.set(st.x, st.y, st.z);
    this.rotationY = st.ry || 0;
    if (st.health !== undefined) this.health = st.health;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;
    this.group.visible = true;
    if (this.enabled) {
      const fwdX = -Math.sin(this.cameraYaw);
      const fwdZ = -Math.cos(this.cameraYaw);
      this.updateCamera(fwdX, fwdZ);
    }
  }
}
