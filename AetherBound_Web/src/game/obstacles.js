import * as THREE from 'three';
import { OBSTACLES } from './config.js';

export class ObstacleManager {
  constructor(scene, worldManager) {
    this.scene = scene;
    this.worldManager = worldManager;
    this.obstacles = new Map(); // id -> { id, type, mesh, definition, data }
    this.boulders = []; // array of active rolling boulders
    this.barrels = [];  // array of active explosive barrels

    // Holographic placement materials
    this.previewMatValid = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.previewMatValidWire = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.95,
      wireframe: true,
      depthWrite: false,
    });
    this.previewMatInvalid = new THREE.MeshBasicMaterial({
      color: 0xff3344,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.previewMatInvalidWire = new THREE.MeshBasicMaterial({
      color: 0xff3344,
      transparent: true,
      opacity: 0.95,
      wireframe: true,
      depthWrite: false,
    });

    this.previewGroup = new THREE.Group();
    this.previewGroup.visible = false;
    this.scene.add(this.previewGroup);
    this.currentPreviewType = null;
  }

  clear() {
    for (const [id, obs] of this.obstacles.entries()) {
      this.scene.remove(obs.mesh);
      if (obs.mesh.geometry) obs.mesh.geometry.dispose();
    }
    this.obstacles.clear();
    this.boulders = [];
    this.barrels = [];
    this.previewGroup.visible = false;
  }

  // Create physical 3D mesh based on obstacle definition
  createObstacleMesh(type, position, rotation) {
    const def = OBSTACLES[type];
    if (!def) return null;

    const group = new THREE.Group();
    group.position.set(position.x, position.y, position.z);
    if (rotation) {
      group.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    }

    switch (type) {
      case 'WALL': {
        const geo = new THREE.BoxGeometry(def.size.width, def.size.height, def.size.depth);
        const mat = new THREE.MeshStandardMaterial({
          color: def.color,
          roughness: 0.8,
          metalness: 0.2,
        });
        const wallMesh = new THREE.Mesh(geo, mat);
        wallMesh.position.y = def.size.height / 2;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        group.add(wallMesh);

        // Add top energy trim
        const trimGeo = new THREE.BoxGeometry(def.size.width * 1.02, 0.2, def.size.depth * 1.02);
        const trimMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const trim = new THREE.Mesh(trimGeo, trimMat);
        trim.position.y = def.size.height / 2 + 0.1;
        wallMesh.add(trim);
        break;
      }

      case 'MUD': {
        const geo = new THREE.CylinderGeometry(def.size.width / 2, def.size.width / 2 + 0.5, def.size.height, 16);
        const mat = new THREE.MeshStandardMaterial({
          color: def.color,
          roughness: 0.95,
          metalness: 0.05,
        });
        const mudMesh = new THREE.Mesh(geo, mat);
        mudMesh.position.y = 0.1;
        mudMesh.receiveShadow = true;
        group.add(mudMesh);
        break;
      }

      case 'SPIKES': {
        const baseGeo = new THREE.BoxGeometry(def.size.width, 0.4, def.size.depth);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.2;
        group.add(base);

        // Grid of sharp spike cones
        const coneGeo = new THREE.ConeGeometry(0.35, def.size.height - 0.4, 6);
        const coneMat = new THREE.MeshStandardMaterial({
          color: def.color,
          metalness: 0.8,
          roughness: 0.3,
        });

        const rows = 2;
        const cols = 5;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const spike = new THREE.Mesh(coneGeo, coneMat);
            spike.position.set(
              (c - (cols - 1) / 2) * 1.1,
              (def.size.height - 0.4) / 2 + 0.4,
              (r - (rows - 1) / 2) * 0.9
            );
            spike.castShadow = true;
            group.add(spike);
          }
        }
        break;
      }

      case 'BOULDER': {
        const geo = new THREE.DodecahedronGeometry(def.radius, 2);
        const mat = new THREE.MeshStandardMaterial({
          color: def.color,
          roughness: 0.9,
          metalness: 0.1,
          flatShading: true,
        });
        const boulderMesh = new THREE.Mesh(geo, mat);
        boulderMesh.position.y = def.radius;
        boulderMesh.castShadow = true;
        boulderMesh.receiveShadow = true;
        group.add(boulderMesh);
        break;
      }

      case 'BARREL': {
        const barrelGeo = new THREE.CylinderGeometry(def.size.radius, def.size.radius, def.size.height, 16);
        const barrelMat = new THREE.MeshStandardMaterial({
          color: 0x1f2326,
          roughness: 0.6,
          metalness: 0.7,
        });
        const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
        barrelMesh.position.y = def.size.height / 2;
        barrelMesh.castShadow = true;
        barrelMesh.receiveShadow = true;
        group.add(barrelMesh);

        // Glowing red volatile energy ring
        const coreGeo = new THREE.CylinderGeometry(def.size.radius * 1.02, def.size.radius * 1.02, 0.7, 16);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = def.size.height / 2;
        group.add(core);

        // Top hazard warning ring
        const capGeo = new THREE.CylinderGeometry(def.size.radius * 0.92, def.size.radius * 0.92, 0.2, 16);
        const capMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = def.size.height + 0.05;
        group.add(cap);
        break;
      }
    }

    return group;
  }

  // Spawn an obstacle and add to active game
  spawnObstacle(id, type, position, rotation) {
    if (this.obstacles.has(id)) return;

    const def = OBSTACLES[type];
    if (!def) return;

    const mesh = this.createObstacleMesh(type, position, rotation);
    if (!mesh) return;

    this.scene.add(mesh);

    // Spawn puff / flash effect
    this.createSpawnFlash(mesh.position);

    const obsData = {
      id,
      type,
      mesh,
      definition: def,
      position: mesh.position,
      rotation: mesh.rotation,
      durability: def.durability || 100,
      velocity: new THREE.Vector3(0, 0, 0),
    };

    if (type === 'BOULDER') {
      // Calculate downhill initial velocity based on terrain normal
      const eps = 1.0;
      const hC = this.worldManager.getHeightAt(position.x, position.z);
      const hX = this.worldManager.getHeightAt(position.x + eps, position.z);
      const hZ = this.worldManager.getHeightAt(position.x, position.z + eps);
      const slopeX = -(hX - hC) / eps;
      const slopeZ = -(hZ - hC) / eps;

      obsData.velocity.set(slopeX * 6.0, 0, slopeZ * 6.0);
      this.boulders.push(obsData);
    } else if (type === 'BARREL') {
      this.barrels.push(obsData);
    }

    this.obstacles.set(id, obsData);
  }

  createSpawnFlash(pos) {
    const ringGeo = new THREE.RingGeometry(0.5, 4.0, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const flash = new THREE.Mesh(ringGeo, ringMat);
    flash.position.set(pos.x, pos.y + 0.2, pos.z);
    this.scene.add(flash);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.1;
      flash.scale.set(1 + progress * 2, 1 + progress * 2, 1 + progress * 2);
      flash.material.opacity = Math.max(0, 0.8 - progress);
      if (progress >= 1.0) {
        clearInterval(interval);
        this.scene.remove(flash);
        flash.geometry.dispose();
      }
    }, 30);
  }

  // Update rolling boulders and dynamic obstacles
  update(dt) {
    for (let i = this.boulders.length - 1; i >= 0; i--) {
      const b = this.boulders[i];
      const pos = b.mesh.position;

      // Downhill acceleration
      const eps = 1.0;
      const hC = this.worldManager.getHeightAt(pos.x, pos.z);
      const hX = this.worldManager.getHeightAt(pos.x + eps, pos.z);
      const hZ = this.worldManager.getHeightAt(pos.x, pos.z + eps);

      const slopeX = -(hX - hC) / eps;
      const slopeZ = -(hZ - hC) / eps;

      b.velocity.x += slopeX * 12.0 * dt;
      b.velocity.z += slopeZ * 12.0 * dt;

      // Friction
      b.velocity.multiplyScalar(0.98);

      pos.x += b.velocity.x * dt;
      pos.z += b.velocity.z * dt;
      pos.y = this.worldManager.getHeightAt(pos.x, pos.z) + b.definition.radius;

      // Rotation matches velocity
      b.mesh.rotation.x += b.velocity.z * dt * 0.5;
      b.mesh.rotation.z -= b.velocity.x * dt * 0.5;
    }
  }

  // Update placement holographic preview for Saboteur
  updatePreview(type, targetPos, isValid, rotationY = 0) {
    if (!type || !targetPos) {
      this.previewGroup.visible = false;
      return;
    }

    if (this.currentPreviewType !== type) {
      // Rebuild preview mesh
      while (this.previewGroup.children.length > 0) {
        this.previewGroup.remove(this.previewGroup.children[0]);
      }

      const def = OBSTACLES[type];
      const modelGroup = new THREE.Group();

      if (type === 'WALL') {
        const geo = new THREE.BoxGeometry(def.size.width, def.size.height, def.size.depth);
        const meshSolid = new THREE.Mesh(geo, this.previewMatValid);
        meshSolid.position.y = def.size.height / 2;
        modelGroup.add(meshSolid);

        const meshWire = new THREE.Mesh(geo, this.previewMatValidWire);
        meshWire.position.y = def.size.height / 2;
        meshWire.userData.isWire = true;
        modelGroup.add(meshWire);

        // Ground footprint outline
        const groundFootprint = new THREE.Mesh(
          new THREE.BoxGeometry(def.size.width + 0.3, 0.05, def.size.depth + 0.3),
          this.previewMatValid
        );
        groundFootprint.position.y = 0.03;
        modelGroup.add(groundFootprint);
      } else if (type === 'MUD') {
        const geo = new THREE.CylinderGeometry(def.size.width / 2, def.size.width / 2 + 0.4, 0.25, 24);
        const meshSolid = new THREE.Mesh(geo, this.previewMatValid);
        meshSolid.position.y = 0.12;
        modelGroup.add(meshSolid);

        const ringGeo = new THREE.RingGeometry(def.size.width / 2 - 0.2, def.size.width / 2 + 0.3, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeo, this.previewMatValidWire);
        ringMesh.position.y = 0.04;
        ringMesh.userData.isWire = true;
        modelGroup.add(ringMesh);
      } else if (type === 'SPIKES') {
        const baseGeo = new THREE.BoxGeometry(def.size.width, 0.4, def.size.depth);
        const baseSolid = new THREE.Mesh(baseGeo, this.previewMatValid);
        baseSolid.position.y = 0.2;
        modelGroup.add(baseSolid);

        const baseWire = new THREE.Mesh(baseGeo, this.previewMatValidWire);
        baseWire.position.y = 0.2;
        baseWire.userData.isWire = true;
        modelGroup.add(baseWire);

        const coneGeo = new THREE.ConeGeometry(0.35, def.size.height - 0.4, 6);
        for (let c = 0; c < 5; c++) {
          const spikeSolid = new THREE.Mesh(coneGeo, this.previewMatValid);
          spikeSolid.position.set((c - 2) * 1.1, (def.size.height - 0.4) / 2 + 0.4, 0);
          modelGroup.add(spikeSolid);

          const spikeWire = new THREE.Mesh(coneGeo, this.previewMatValidWire);
          spikeWire.position.set((c - 2) * 1.1, (def.size.height - 0.4) / 2 + 0.4, 0);
          spikeWire.userData.isWire = true;
          modelGroup.add(spikeWire);
        }
      } else if (type === 'BOULDER') {
        const geo = new THREE.SphereGeometry(def.radius, 16, 16);
        const meshSolid = new THREE.Mesh(geo, this.previewMatValid);
        meshSolid.position.y = def.radius;
        modelGroup.add(meshSolid);

        const meshWire = new THREE.Mesh(geo, this.previewMatValidWire);
        meshWire.position.y = def.radius;
        meshWire.userData.isWire = true;
        modelGroup.add(meshWire);

        const ringGeo = new THREE.RingGeometry(def.radius * 0.7, def.radius * 1.15, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeo, this.previewMatValidWire);
        ringMesh.position.y = 0.04;
        ringMesh.userData.isWire = true;
        modelGroup.add(ringMesh);
      } else if (type === 'BARREL') {
        const geo = new THREE.CylinderGeometry(def.size.radius, def.size.radius, def.size.height, 16);
        const meshSolid = new THREE.Mesh(geo, this.previewMatValid);
        meshSolid.position.y = def.size.height / 2;
        modelGroup.add(meshSolid);

        const meshWire = new THREE.Mesh(geo, this.previewMatValidWire);
        meshWire.position.y = def.size.height / 2;
        meshWire.userData.isWire = true;
        modelGroup.add(meshWire);

        const ringGeo = new THREE.RingGeometry(def.size.radius * 0.8, def.size.radius * 1.3, 20);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeo, this.previewMatValidWire);
        ringMesh.position.y = 0.04;
        ringMesh.userData.isWire = true;
        modelGroup.add(ringMesh);
      }

      // Vertical central guide laser beacon
      const beaconGeo = new THREE.CylinderGeometry(0.04, 0.04, 6.0, 8);
      const beaconMesh = new THREE.Mesh(beaconGeo, this.previewMatValid);
      beaconMesh.position.y = 3.0;
      modelGroup.add(beaconMesh);

      this.previewGroup.add(modelGroup);
      this.currentPreviewType = type;
    }

    // Update material according to validity
    const targetSolidMat = isValid ? this.previewMatValid : this.previewMatInvalid;
    const targetWireMat = isValid ? this.previewMatValidWire : this.previewMatInvalidWire;

    this.previewGroup.traverse((child) => {
      if (child.isMesh) {
        child.material = child.userData.isWire ? targetWireMat : targetSolidMat;
      }
    });

    this.previewGroup.position.set(targetPos.x, targetPos.y, targetPos.z);
    this.previewGroup.rotation.y = rotationY;
    this.previewGroup.visible = true;
  }

  hidePreview() {
    this.previewGroup.visible = false;
  }

  // Detonate an explosive barrel
  detonateBarrel(id, particles, audio, onExplodeCallback) {
    const obs = this.obstacles.get(id);
    if (!obs || obs.type !== 'BARREL') return;

    const blastPos = obs.mesh.position.clone();
    const blastRadius = obs.definition.blastRadius || 9.0;
    const blastKnockback = obs.definition.blastKnockback || 26.0;

    // Remove detonated barrel immediately
    this.scene.remove(obs.mesh);
    if (obs.mesh.geometry) obs.mesh.geometry.dispose();
    this.obstacles.delete(id);
    const bIdx = this.barrels.findIndex((b) => b.id === id);
    if (bIdx !== -1) this.barrels.splice(bIdx, 1);

    // Audio & Particle Shockwave
    if (particles) particles.emitExplosion(blastPos);
    if (audio) audio.playExplosion();

    // Damage/Destroy nearby destructible obstacles (Walls, Spikes) & trigger chain-reaction barrels
    const chainBarrels = [];
    for (const [otherId, other] of this.obstacles.entries()) {
      const dist = blastPos.distanceTo(other.mesh.position);
      if (dist <= blastRadius) {
        if (other.type === 'BARREL') {
          chainBarrels.push(otherId);
        } else if (other.durability !== undefined) {
          other.durability -= 100;
          if (other.durability <= 0) {
            this.destroyObstacle(otherId, particles);
          }
        }
      }
    }

    if (onExplodeCallback) {
      onExplodeCallback(blastPos, blastRadius, blastKnockback);
    }

    // Chain reaction with small delay
    chainBarrels.forEach((cbId) => {
      setTimeout(() => {
        this.detonateBarrel(cbId, particles, audio, onExplodeCallback);
      }, 120);
    });
  }

  destroyObstacle(id, particles) {
    const obs = this.obstacles.get(id);
    if (!obs) return;

    if (particles) {
      particles.emitObstacleSparks(obs.mesh.position, 20, 0xff9900);
    }

    this.scene.remove(obs.mesh);
    if (obs.mesh.geometry) obs.mesh.geometry.dispose();
    this.obstacles.delete(id);

    const bIdx = this.boulders.findIndex((b) => b.id === id);
    if (bIdx !== -1) this.boulders.splice(bIdx, 1);
    const barIdx = this.barrels.findIndex((b) => b.id === id);
    if (barIdx !== -1) this.barrels.splice(barIdx, 1);
  }
}
