import * as THREE from 'three';
import { GAME_CONFIG } from './config.js';

export class GoalBeacon {
  constructor(scene, worldManager) {
    this.scene = scene;
    this.worldManager = worldManager;
    this.position = new THREE.Vector3(0, 0, 0);
    this.radius = GAME_CONFIG.GOAL.RADIUS;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.buildMesh();
  }

  buildMesh() {
    // 1. High-reaching glowing beam (cylinder)
    const beamGeo = new THREE.CylinderGeometry(0.8, 1.8, 180, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beam.position.y = 90;
    this.group.add(this.beam);

    // Inner bright core
    const coreGeo = new THREE.CylinderGeometry(0.3, 0.4, 180, 8, 1, true);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    this.core = new THREE.Mesh(coreGeo, coreMat);
    this.core.position.y = 90;
    this.group.add(this.core);

    // 2. Base platform ring
    const baseGeo = new THREE.CylinderGeometry(this.radius, this.radius + 1, 0.8, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0088aa,
      emissive: 0x004455,
      roughness: 0.3,
      metalness: 0.8,
    });
    this.base = new THREE.Mesh(baseGeo, baseMat);
    this.base.position.y = 0.4;
    this.group.add(this.base);

    // 3. Floating rotating energy rings
    this.rings = [];
    const ringGeo = new THREE.TorusGeometry(3.5, 0.15, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x33ffff,
      wireframe: true,
    });

    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 2.0 + i * 2.2;
      this.rings.push(ring);
      this.group.add(ring);
    }

    // 4. Point light for local illumination
    this.light = new THREE.PointLight(0x00ffff, 3.5, 25);
    this.light.position.y = 4.0;
    this.group.add(this.light);

    // 5. 20-Meter Sanctuary Perimeter (No-Obstacle Zone)
    this.protectedRadius = GAME_CONFIG.GOAL.PROTECTED_RADIUS || 20.0;

    // Glowing ground perimeter ring (radius 20m)
    const sanctuaryRingGeo = new THREE.RingGeometry(this.protectedRadius - 0.4, this.protectedRadius, 64);
    const sanctuaryRingMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    this.sanctuaryRing = new THREE.Mesh(sanctuaryRingGeo, sanctuaryRingMat);
    this.sanctuaryRing.rotation.x = -Math.PI / 2;
    this.sanctuaryRing.position.y = 0.15;
    this.group.add(this.sanctuaryRing);

    // Inner subtle sanctuary energy disc
    const sanctuaryDiscGeo = new THREE.CircleGeometry(this.protectedRadius, 48);
    const sanctuaryDiscMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    this.sanctuaryDisc = new THREE.Mesh(sanctuaryDiscGeo, sanctuaryDiscMat);
    this.sanctuaryDisc.rotation.x = -Math.PI / 2;
    this.sanctuaryDisc.position.y = 0.08;
    this.group.add(this.sanctuaryDisc);
  }

  setPosition(x, z) {
    const y = this.worldManager.getHeightAt(x, z);
    this.position.set(x, y, z);
    this.group.position.copy(this.position);
  }

  update(dt, time) {
    // Animate rotating rings and pulsing beam
    if (this.rings) {
      this.rings.forEach((ring, idx) => {
        ring.rotation.x += dt * (1.0 + idx * 0.4);
        ring.rotation.y += dt * (0.8 - idx * 0.3);
      });
    }

    if (this.beam) {
      const pulse = 0.5 + Math.sin(time * 3.0) * 0.15;
      this.beam.material.opacity = pulse;
    }

    if (this.sanctuaryRing) {
      this.sanctuaryRing.material.opacity = 0.5 + Math.sin(time * 2.5) * 0.18;
    }
  }

  isWithinProtectedRadius(x, z) {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    return Math.sqrt(dx * dx + dz * dz) < this.protectedRadius;
  }

  // Check if player position is within the victory radius
  checkRunnerInside(runnerPos) {
    if (!runnerPos) return false;
    const dx = runnerPos.x - this.position.x;
    const dz = runnerPos.z - this.position.z;
    const dist2D = Math.sqrt(dx * dx + dz * dz);
    const winRadius = Math.max(this.radius || 5.0, 6.5);
    return dist2D <= winRadius;
  }

  // Celebratory victory effect when Runner conquers the Beacon
  triggerVictoryEffect(particles) {
    if (this.beam) {
      this.beam.material.color.setHex(0xffffff);
      this.beam.material.opacity = 1.0;
    }
    if (this.light) {
      this.light.color.setHex(0x00ff88);
      this.light.intensity = 8.0;
    }
    if (particles) {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          const burstPos = this.position.clone();
          burstPos.y += 2.0 + i * 2.5;
          particles.emitObstacleSparks(burstPos, 35, 0x00ffff);
          particles.emitObstacleSparks(burstPos, 35, 0xffd700);
        }, i * 140);
      }
    }
  }

  getDistanceTo(runnerPos) {
    const dx = runnerPos.x - this.position.x;
    const dz = runnerPos.z - this.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getCompassAngle(runnerPos, runnerHeading) {
    // Angle from runner towards the goal
    const dx = this.position.x - runnerPos.x;
    const dz = this.position.z - runnerPos.z;
    const targetAngle = Math.atan2(dx, dz);
    // Relative angle against runner facing direction
    let rel = targetAngle - runnerHeading;
    while (rel < -Math.PI) rel += Math.PI * 2;
    while (rel > Math.PI) rel -= Math.PI * 2;
    return rel;
  }
}
