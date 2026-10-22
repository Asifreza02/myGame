import * as THREE from '/three/three.module.js';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.maxParticles = 600;

    // Shared geometry & materials for optimal performance
    this.dustGeo = new THREE.SphereGeometry(0.18, 6, 6);
    this.sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.smokeGeo = new THREE.SphereGeometry(0.35, 6, 6);
    this.debrisGeo = new THREE.DodecahedronGeometry(0.2, 0);

    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  // Dust puff emitted when sprinting or sliding
  emitDust(pos, count = 5) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const mat = new THREE.MeshBasicMaterial({
        color: 0x998877,
        transparent: true,
        opacity: 0.65,
      });
      const mesh = new THREE.Mesh(this.dustGeo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.6,
        pos.y + 0.15 + Math.random() * 0.2,
        pos.z + (Math.random() - 0.5) * 0.6
      );

      const vx = (Math.random() - 0.5) * 2.0;
      const vy = 0.5 + Math.random() * 1.5;
      const vz = (Math.random() - 0.5) * 2.0;

      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        maxLife: 0.55 + Math.random() * 0.3,
        life: 0,
        scaleSpeed: 1.8,
        fadeSpeed: 1.6,
      });
    }
  }

  // Holographic spark burst when an obstacle is placed
  emitObstacleSparks(pos, count = 24, color = 0x00ffff) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(pos);

      const speed = 4.0 + Math.random() * 6.0;
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.2) * Math.PI;

      const vx = Math.cos(angle) * Math.cos(elevation) * speed;
      const vy = Math.abs(Math.sin(elevation) * speed) + 2.0;
      const vz = Math.sin(angle) * Math.cos(elevation) * speed;

      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        gravity: -12.0,
        maxLife: 0.8 + Math.random() * 0.4,
        life: 0,
        fadeSpeed: 1.4,
      });
    }
  }

  // Fiery shockwave and flying debris when an Explosive Barrel detonates
  emitExplosion(pos) {
    // 1. Expanding shockwave ring
    const ringGeo = new THREE.RingGeometry(0.5, 1.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos);
    ring.position.y += 0.2;
    this.group.add(ring);

    this.particles.push({
      mesh: ring,
      vel: new THREE.Vector3(0, 0, 0),
      isRing: true,
      expansionRate: 22.0,
      maxLife: 0.55,
      life: 0,
    });

    // 2. Flying explosive fireball chunks & debris
    for (let i = 0; i < 40; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const isFire = Math.random() > 0.4;
      const color = isFire ? (Math.random() > 0.5 ? 0xff3300 : 0xffaa00) : 0x222222;
      const geo = isFire ? this.smokeGeo : this.debrisGeo;

      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);

      const speed = 6.0 + Math.random() * 12.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() * 0.7 + 0.1) * Math.PI;

      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.cos(phi) * speed + 3.0;
      const vz = Math.sin(phi) * Math.sin(theta) * speed;

      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        gravity: -16.0,
        maxLife: 0.9 + Math.random() * 0.6,
        life: 0,
        scaleSpeed: isFire ? 1.5 : 0.8,
        fadeSpeed: 1.1,
      });
    }
  }

  // Water splash droplets
  emitWaterSplash(pos, count = 12) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const mat = new THREE.MeshBasicMaterial({
        color: 0x44ddff,
        transparent: true,
        opacity: 0.8,
      });
      const mesh = new THREE.Mesh(this.dustGeo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.8,
        pos.y + 0.1,
        pos.z + (Math.random() - 0.5) * 0.8
      );

      const vx = (Math.random() - 0.5) * 3.5;
      const vy = 2.5 + Math.random() * 3.5;
      const vz = (Math.random() - 0.5) * 3.5;

      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        gravity: -15.0,
        maxLife: 0.65,
        life: 0,
        fadeSpeed: 1.6,
      });
    }
  }

  // Phase 3: Shimmering crystal burst on power-up collection
  emitPowerupBurst(pos, color = 0x00ffcc, count = 28) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.set(pos.x, pos.y + 0.8, pos.z);

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 5.0;
      const vy = 2.0 + Math.random() * 4.5;
      const vx = Math.cos(angle) * speed;
      const vz = Math.sin(angle) * speed;

      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        gravity: -8.0,
        maxLife: 0.75 + Math.random() * 0.35,
        life: 0,
        fadeSpeed: 1.5,
      });
    }

    // Expanding light ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, pos.y + 0.3, pos.z);
    this.group.add(ring);
    this.particles.push({
      mesh: ring,
      isRing: true,
      expansionRate: 6.0,
      maxLife: 0.45,
      life: 0,
    });
  }

  // Phase 3: Aegis energy shield shattering effect
  emitShieldBubbleBurst(pos) {
    for (let i = 0; i < 30; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const mat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const r = 1.2;
      mesh.position.set(
        pos.x + Math.cos(theta) * Math.cos(phi) * r,
        pos.y + 1.2 + Math.sin(phi) * r,
        pos.z + Math.sin(theta) * Math.cos(phi) * r
      );

      const speed = 4.0 + Math.random() * 4.0;
      const vx = Math.cos(theta) * Math.cos(phi) * speed;
      const vy = Math.sin(phi) * speed + 1.0;
      const vz = Math.sin(theta) * Math.cos(phi) * speed;

      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        gravity: -5.0,
        maxLife: 0.6 + Math.random() * 0.3,
        life: 0,
        fadeSpeed: 1.8,
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.group.remove(p.mesh);
        if (p.mesh.material) p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      const progress = p.life / p.maxLife;

      if (p.isRing) {
        // Shockwave expansion
        const currentScale = 1.0 + p.life * p.expansionRate;
        p.mesh.scale.set(currentScale, currentScale, 1.0);
        p.mesh.material.opacity = Math.max(0, 1.0 - progress);
      } else {
        // Move particle
        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.y += p.vel.y * dt;
        p.mesh.position.z += p.vel.z * dt;

        if (p.gravity) {
          p.vel.y += p.gravity * dt;
        }

        // Scale & fade
        if (p.scaleSpeed) {
          const s = 1.0 + p.life * p.scaleSpeed;
          p.mesh.scale.set(s, s, s);
        }

        if (p.mesh.material) {
          p.mesh.material.opacity = Math.max(0, 1.0 - progress * (p.fadeSpeed || 1.0));
        }
      }
    }
  }

  clear() {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      if (p.mesh.material) p.mesh.material.dispose();
    }
    this.particles = [];
  }
}
