import * as THREE from '/three/three.module.js';
import { POWERUPS } from './config.js';
import { audio } from './audio.js';

export class PowerUpManager {
  constructor(scene, worldManager, particles, onCollectCallback) {
    this.scene = scene;
    this.worldManager = worldManager;
    this.particles = particles;
    this.onCollectCallback = onCollectCallback;

    this.crystals = new Map(); // id -> { id, type, mesh, innerMesh, ringMesh, position, def, active, respawnTimer }
    this.spawnedChunks = new Set();
    this.types = ['SPEED', 'JUMP', 'SHIELD', 'HEALTH'];

    // Shared crystal geometries
    this.crystalGeo = new THREE.OctahedronGeometry(0.55, 0);
    this.outerWireGeo = new THREE.OctahedronGeometry(0.75, 0);
    this.glowRingGeo = new THREE.RingGeometry(0.4, 0.9, 16);
    this.glowRingGeo.rotateX(-Math.PI / 2);

    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  // Create a 3D glowing energy crystal in the world
  spawnCrystal(id, type, x, z) {
    const def = POWERUPS[type] || POWERUPS.SPEED;
    const y = this.worldManager.getHeightAt(x, z) + 1.25;

    const crystalGroup = new THREE.Group();
    crystalGroup.position.set(x, y, z);

    // Inner glowing solid core
    const coreMat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.8,
    });
    const coreMesh = new THREE.Mesh(this.crystalGeo, coreMat);
    coreMesh.scale.set(0.7, 1.2, 0.7);
    crystalGroup.add(coreMesh);

    // Outer rotating holographic wireframe
    const wireMat = new THREE.MeshBasicMaterial({
      color: def.color,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    const wireMesh = new THREE.Mesh(this.outerWireGeo, wireMat);
    crystalGroup.add(wireMesh);

    // Base aura ring on terrain
    const ringMat = new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(this.glowRingGeo, ringMat);
    ringMesh.position.y = -1.15;
    crystalGroup.add(ringMesh);

    this.group.add(crystalGroup);

    const crystalData = {
      id,
      type,
      mesh: crystalGroup,
      coreMesh,
      wireMesh,
      position: new THREE.Vector3(x, y, z),
      baseY: y,
      def,
      active: true,
      respawnTimer: 0,
      animOffset: Math.random() * Math.PI * 2,
    };

    this.crystals.set(id, crystalData);
    return crystalData;
  }

  // Generate crystals in chunk if applicable
  populateChunk(cx, cz) {
    const chunkKey = `${cx},${cz}`;
    if (this.spawnedChunks.has(chunkKey)) return;
    this.spawnedChunks.add(chunkKey);

    const chunkSize = this.worldManager.chunkSize;
    const originX = cx * chunkSize;
    const originZ = cz * chunkSize;

    let seed = Math.abs(cx * 15485863 ^ cz * 32452843 ^ this.worldManager.seed);
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // ~35% chance to spawn an energy crystal in this chunk
    if (rng() > 0.65) {
      const lx = (rng() - 0.5) * (chunkSize - 8);
      const lz = (rng() - 0.5) * (chunkSize - 8);
      const wx = originX + lx;
      const wz = originZ + lz;

      // Don't spawn on spawn area
      if (Math.sqrt(wx * wx + wz * wz) > 24) {
        const typeIdx = Math.floor(rng() * this.types.length);
        const type = this.types[typeIdx];
        const crystalId = `crystal_${cx}_${cz}`;
        this.spawnCrystal(crystalId, type, wx, wz);
      }
    }
  }

  // Update crystal rotation, bobbing, and collision check with characters
  update(dt, characters = [], elapsedTime = 0) {
    for (const [id, c] of this.crystals.entries()) {
      if (!c.active) {
        if (c.respawnTimer > 0) {
          c.respawnTimer -= dt;
          if (c.respawnTimer <= 0) {
            c.active = true;
            c.mesh.visible = true;
          }
        }
        continue;
      }

      // 1. Continuous rotation & hovering bobbing motion
      c.coreMesh.rotation.y += 2.2 * dt;
      c.wireMesh.rotation.y -= 1.6 * dt;
      c.wireMesh.rotation.x += 0.8 * dt;

      const bob = Math.sin(elapsedTime * 2.8 + c.animOffset) * 0.22;
      c.mesh.position.y = c.baseY + bob;

      // 2. Collision check against active characters
      for (const char of characters) {
        if (!char || !char.position) continue;
        const dx = char.position.x - c.position.x;
        const dz = char.position.z - c.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Pickup threshold: 2.2 meters
        if (dist < 2.2) {
          this.collectCrystal(id, char);
          break;
        }
      }
    }
  }

  collectCrystal(id, char) {
    const c = this.crystals.get(id);
    if (!c || !c.active) return;

    c.active = false;
    c.mesh.visible = false;
    c.respawnTimer = 35.0; // Respawns after 35 seconds

    // Audio & Particle Shockwave
    audio.playPowerupPickup();
    if (this.particles) {
      this.particles.emitPowerupBurst(c.position, c.def.color, 24);
    }

    // Apply specific buff to character
    if (char) {
      if (c.type === 'SPEED' && char.applySpeedBuff) {
        char.applySpeedBuff(c.def.duration, c.def.multiplier);
      } else if (c.type === 'JUMP' && char.applyJumpBuff) {
        char.applyJumpBuff(c.def.duration, c.def.jumpForce);
      } else if (c.type === 'SHIELD' && char.applyShield) {
        char.applyShield(c.def.duration);
      } else if (c.type === 'HEALTH' && char.applyHealth) {
        char.applyHealth(c.def.amount);
      }
    }

    // Broadcast collection via callback
    if (this.onCollectCallback) {
      this.onCollectCallback(id, c.type, char ? char.role : 'runner');
    }
  }

  // Handle remote crystal collection from network WebSocket
  handleRemoteCollect(id) {
    const c = this.crystals.get(id);
    if (!c || !c.active) return;

    c.active = false;
    c.mesh.visible = false;
    c.respawnTimer = 35.0;

    audio.playPowerupPickup();
    if (this.particles) {
      this.particles.emitPowerupBurst(c.position, c.def.color, 18);
    }
  }

  clear() {
    for (const c of this.crystals.values()) {
      this.group.remove(c.mesh);
    }
    this.crystals.clear();
    this.spawnedChunks.clear();
  }
}
