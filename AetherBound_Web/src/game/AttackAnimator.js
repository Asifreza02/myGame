// ============================================================================
// AetherBound: High-End Attack Visual Effects & Projectile Animator
// Best-in-class Three.js source-to-target animations, procedural lightning,
// dynamic comet trails, magma shells, nature spirals, and elemental detonations.
// ============================================================================

import * as THREE from 'three';

export class AttackAnimator {
  constructor(scene, particles, worldManager, onCameraShake = null) {
    this.scene = scene;
    this.particles = particles;
    this.worldManager = worldManager;
    this.onCameraShake = onCameraShake;

    this.group = new THREE.Group();
    this.group.name = 'attack-visual-effects-group';
    this.scene.add(this.group);

    this.activeAttacks = [];

    // Reusable shared geometries for low-overhead performance
    this.sharedGeos = {
      sphereSmall: new THREE.SphereGeometry(0.16, 8, 8),
      sphereMedium: new THREE.SphereGeometry(0.28, 10, 8),
      sphereLarge: new THREE.SphereGeometry(0.44, 12, 10),
      dodeca: new THREE.DodecahedronGeometry(0.24, 0),
      dodecaLarge: new THREE.DodecahedronGeometry(0.38, 0),
      ringSmall: new THREE.RingGeometry(0.18, 0.28, 16),
      ringMedium: new THREE.RingGeometry(0.32, 0.48, 20),
      ringLarge: new THREE.RingGeometry(0.5, 0.85, 24),
      torusThin: new THREE.TorusGeometry(0.25, 0.03, 8, 20),
      torusMedium: new THREE.TorusGeometry(0.42, 0.045, 8, 24),
      coneSpike: new THREE.ConeGeometry(0.14, 0.7, 6),
      lanceSpear: new THREE.ConeGeometry(0.16, 1.2, 7),
    };

    // Shared reusable materials
    this.sharedMats = {
      arcaneCore: new THREE.MeshBasicMaterial({ color: 0x55eaff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }),
      arcaneHalo: new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending }),
      natureCore: new THREE.MeshBasicMaterial({ color: 0x83e879, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }),
      natureVine: new THREE.MeshBasicMaterial({ color: 0x228833, transparent: true, opacity: 0.85 }),
      fireCore: new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }),
      fireCorona: new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }),
      celestialCore: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending }),
      celestialShroud: new THREE.MeshBasicMaterial({ color: 0xcc66ff, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending }),
      frostCore: new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending }),
      frostMist: new THREE.MeshBasicMaterial({ color: 0xccf5ff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending }),
      waterCore: new THREE.MeshBasicMaterial({ color: 0x22aaff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }),
      slashBlade: new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    };

    // Dragon fire breath continuous beam group
    this.dragonBreathStream = null;
  }

  // --------------------------------------------------------------------------
  // 1. SOURCE CAST FLARE (Triggered at attack origin on launch)
  // --------------------------------------------------------------------------
  spawnCastFlash(pos, color = 0x55eaff) {
    if (this.particles) {
      this.particles.emitAttackMuzzleFlash(pos, color, 8);
    }

    const flashRing = new THREE.Mesh(
      this.sharedGeos.ringSmall,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    flashRing.position.copy(pos);
    flashRing.rotation.x = -Math.PI / 2;
    this.group.add(flashRing);

    this.activeAttacks.push({
      type: 'flash',
      mesh: flashRing,
      life: 0.16,
      maxLife: 0.16,
      onUpdate: (progress) => {
        const s = 1.0 + (1.0 - progress) * 3.5;
        flashRing.scale.set(s, s, s);
        flashRing.material.opacity = progress * 0.95;
      },
      onDestroy: () => {
        this.group.remove(flashRing);
        flashRing.material.dispose();
      },
    });
  }

  // --------------------------------------------------------------------------
  // 2. WEAPON ATTACK FROM SOURCE TO TARGET
  // --------------------------------------------------------------------------
  spawnWeaponAttack(event) {
    const origin = event.origin || { x: 0, y: 1.2, z: 0 };
    const hitPoint = event.hitPoint || { x: origin.x, y: origin.y, z: origin.z + 20 };
    const weaponId = event.weaponId || 'APPRENTICE_STICK';
    const start = new THREE.Vector3(origin.x, origin.y, origin.z);
    const end = new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z);
    const dist = Math.max(0.1, start.distanceTo(end));
    const dir = end.clone().sub(start).normalize();

    // Spawn source cast ignition
    const weaponColors = {
      APPRENTICE_STICK: 0x55eaff,
      ELDER_STAFF: 0x83e879,
      PYRE_STAFF: 0xff5511,
      CELESTIAL_SCEPTER: 0xcc66ff,
      KNIFE: 0x00f0ff,
      PISTOL: 0x55eaff,
      GUN: 0x83e879,
      LASER_GUN: 0xcc66ff,
      PLASMA_CANNON: 0xff5511,
    };
    const color = weaponColors[weaponId] || 0x55eaff;
    this.spawnCastFlash(start, color);

    if (weaponId === 'CELESTIAL_SCEPTER' || weaponId === 'LASER_GUN') {
      this.spawnCelestialRay(start, end, dist, dir);
    } else if (weaponId === 'PYRE_STAFF' || weaponId === 'PLASMA_CANNON') {
      this.spawnPyreMagmaOrb(start, end, dist, dir);
    } else if (weaponId === 'ELDER_STAFF' || weaponId === 'GUN') {
      this.spawnNatureBolt(start, end, dist, dir);
    } else if (weaponId === 'KNIFE') {
      this.spawnMeleeSlash(start, Math.atan2(dir.x, dir.z));
    } else {
      this.spawnArcaneSpark(start, end, dist, dir);
    }
  }

  // --------------------------------------------------------------------------
  // 2a. ARCANE SPARK: Apprentice Wand (Luminous comet + rune diamond + stardust)
  // --------------------------------------------------------------------------
  spawnArcaneSpark(start, end, dist, dir) {
    const group = new THREE.Group();
    group.position.copy(start);
    group.lookAt(end);

    // Inner glowing core
    const coreMesh = new THREE.Mesh(this.sharedGeos.sphereSmall, this.sharedMats.arcaneCore);
    group.add(coreMesh);

    // Orbiting diamond runic ring
    const runeRing = new THREE.Mesh(this.sharedGeos.ringSmall, this.sharedMats.arcaneHalo);
    runeRing.rotation.x = Math.PI / 4;
    group.add(runeRing);

    // Tapered comet tail
    const tailLen = Math.min(1.8, dist * 0.4);
    const tailGeo = new THREE.ConeGeometry(0.12, tailLen, 6);
    tailGeo.rotateX(Math.PI / 2);
    const tailMesh = new THREE.Mesh(tailGeo, this.sharedMats.arcaneHalo);
    tailMesh.position.z = -tailLen * 0.5;
    group.add(tailMesh);

    this.group.add(group);

    const speed = 72; // m/s
    const totalDuration = dist / speed;
    let elapsed = 0;
    let trailTimer = 0;

    this.activeAttacks.push({
      type: 'projectile',
      mesh: group,
      speed,
      life: totalDuration,
      maxLife: totalDuration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        const t = Math.min(1.0, elapsed / totalDuration);
        group.position.lerpVectors(start, end, t);

        // Spin runic diamond
        runeRing.rotation.z += 10 * dt;
        runeRing.rotation.y += 6 * dt;

        // Emit starlight trail
        trailTimer += dt;
        if (trailTimer >= 0.024 && this.particles) {
          trailTimer = 0;
          this.particles.emitProjectileTrail(group.position, dir, 0x55eaff, 'spark', 1);
        }

        // Arrival at target
        if (t >= 1.0) {
          this.onTargetImpact(end, 'arcane', 0x55eaff);
        }
      },
      onDestroy: () => {
        this.group.remove(group);
        tailGeo.dispose();
      },
    });
  }

  // --------------------------------------------------------------------------
  // 2b. NATURE BOLT: Elder Staff (Living double-helix vine spiral + spore trail)
  // --------------------------------------------------------------------------
  spawnNatureBolt(start, end, dist, dir) {
    const group = new THREE.Group();
    group.position.copy(start);
    group.lookAt(end);

    // Glowing emerald nature orb
    const coreMesh = new THREE.Mesh(this.sharedGeos.sphereSmall, this.sharedMats.natureCore);
    group.add(coreMesh);

    // Dual-helix spiraling emerald vine rings
    const helix1 = new THREE.Mesh(this.sharedGeos.torusThin, this.sharedMats.natureCore);
    const helix2 = new THREE.Mesh(this.sharedGeos.torusThin, this.sharedMats.natureVine);
    helix1.scale.set(0.85, 0.85, 1.4);
    helix2.scale.set(0.85, 0.85, 1.4);
    helix2.rotation.y = Math.PI / 2;
    group.add(helix1, helix2);

    this.group.add(group);

    const speed = 85; // m/s
    const totalDuration = dist / speed;
    let elapsed = 0;
    let trailTimer = 0;

    this.activeAttacks.push({
      type: 'projectile',
      mesh: group,
      speed,
      life: totalDuration,
      maxLife: totalDuration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        const t = Math.min(1.0, elapsed / totalDuration);
        group.position.lerpVectors(start, end, t);

        // Corkscrew vine rotation
        helix1.rotation.z += 14 * dt;
        helix2.rotation.z -= 14 * dt;

        // Trail botanical spores and leaves
        trailTimer += dt;
        if (trailTimer >= 0.022 && this.particles) {
          trailTimer = 0;
          this.particles.emitProjectileTrail(group.position, dir, 0x83e879, 'spore', 1);
        }

        if (t >= 1.0) {
          this.onTargetImpact(end, 'nature', 0x83e879);
        }
      },
      onDestroy: () => {
        this.group.remove(group);
      },
    });
  }

  // --------------------------------------------------------------------------
  // 2c. PYRE MAGMA ORB: Pyre Staff (Volcanic basalt core + plasma aura + embers)
  // --------------------------------------------------------------------------
  spawnPyreMagmaOrb(start, end, dist, dir) {
    const group = new THREE.Group();
    group.position.copy(start);
    group.lookAt(end);

    // Faceted molten lava core
    const magmaCore = new THREE.Mesh(this.sharedGeos.dodeca, this.sharedMats.fireCore);
    group.add(magmaCore);

    // Swirling solar plasma aura
    const plasmaAura = new THREE.Mesh(this.sharedGeos.sphereMedium, this.sharedMats.fireCorona);
    plasmaAura.scale.set(1.15, 1.15, 1.15);
    group.add(plasmaAura);

    // Fiery corona ring
    const coronaRing = new THREE.Mesh(this.sharedGeos.ringMedium, this.sharedMats.fireCore);
    group.add(coronaRing);

    this.group.add(group);

    const speed = 62; // m/s
    const totalDuration = dist / speed;
    let elapsed = 0;
    let trailTimer = 0;

    this.activeAttacks.push({
      type: 'projectile',
      mesh: group,
      speed,
      life: totalDuration,
      maxLife: totalDuration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        const t = Math.min(1.0, elapsed / totalDuration);
        group.position.lerpVectors(start, end, t);

        // Molten tumbling motion
        magmaCore.rotation.x += 8 * dt;
        magmaCore.rotation.y += 10 * dt;
        coronaRing.rotation.z += 12 * dt;
        plasmaAura.scale.setScalar(1.1 + Math.sin(elapsed * 20) * 0.12);

        // Heavy dark smoke & flying embers trail
        trailTimer += dt;
        if (trailTimer >= 0.02 && this.particles) {
          trailTimer = 0;
          this.particles.emitProjectileTrail(group.position, dir, 0xff5511, 'smoke', 1);
          this.particles.emitProjectileTrail(group.position, dir, 0xffaa00, 'spark', 1);
        }

        if (t >= 1.0) {
          this.onTargetImpact(end, 'fire', 0xff5511, true);
        }
      },
      onDestroy: () => {
        this.group.remove(group);
      },
    });
  }

  // --------------------------------------------------------------------------
  // 2d. CELESTIAL RAY: Celestial Scepter (Prismatic beam + hypersonic rings)
  // --------------------------------------------------------------------------
  spawnCelestialRay(start, end, dist, dir) {
    const rayGroup = new THREE.Group();

    // 1. Inner white-hot laser core cylinder
    const coreGeo = new THREE.CylinderGeometry(0.045, 0.045, dist, 8);
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, this.sharedMats.celestialCore);
    coreMesh.position.copy(start).lerp(end, 0.5);
    coreMesh.lookAt(end);
    rayGroup.add(coreMesh);

    // 2. Outer luminous celestial violet shroud
    const shroudGeo = new THREE.CylinderGeometry(0.14, 0.14, dist, 8);
    shroudGeo.rotateX(Math.PI / 2);
    const shroudMesh = new THREE.Mesh(shroudGeo, this.sharedMats.celestialShroud);
    shroudMesh.position.copy(coreMesh.position);
    shroudMesh.quaternion.copy(coreMesh.quaternion);
    rayGroup.add(shroudMesh);

    // 3. Hypersonic energy rings sliding along the beam
    const rings = [];
    for (let i = 0; i < 4; i++) {
      const ringMesh = new THREE.Mesh(this.sharedGeos.ringMedium, this.sharedMats.celestialShroud);
      ringMesh.lookAt(end);
      rayGroup.add(ringMesh);
      rings.push({ mesh: ringMesh, offset: i * 0.25 });
    }

    this.group.add(rayGroup);

    // Instant impact burst at target point!
    this.onTargetImpact(end, 'celestial', 0xcc66ff);

    const duration = 0.26;
    let elapsed = 0;

    this.activeAttacks.push({
      type: 'beam',
      mesh: rayGroup,
      life: duration,
      maxLife: duration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        const norm = elapsed / duration;

        // Slide concentric rings from start to end
        rings.forEach((r) => {
          const t = (norm * 2.8 + r.offset) % 1.0;
          r.mesh.position.lerpVectors(start, end, t);
          r.mesh.scale.setScalar(0.7 + t * 0.6);
        });

        // Beam dissipation fade
        const fade = Math.max(0, 1.0 - norm);
        shroudMesh.material.opacity = fade * 0.88;
        coreMesh.material.opacity = fade * 0.98;
      },
      onDestroy: () => {
        this.group.remove(rayGroup);
        coreGeo.dispose();
        shroudGeo.dispose();
      },
    });
  }

  // --------------------------------------------------------------------------
  // 3. SPELL ATTACKS FROM SOURCE TO TARGET
  // --------------------------------------------------------------------------
  spawnSpellAttack(event) {
    const origin = event.origin || { x: 0, y: 1.2, z: 0 };
    const hitPoint = event.hitPoint || { x: origin.x, y: origin.y, z: origin.z + 25 };
    const powerId = event.powerId || 'FIREBALL';
    const start = new THREE.Vector3(origin.x, origin.y, origin.z);
    const end = new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z);
    const dist = Math.max(0.1, start.distanceTo(end));
    const dir = end.clone().sub(start).normalize();

    const spellColors = {
      FIREBALL: 0xff4411,
      FROST_LANCE: 0x66ddff,
      LIGHTNING_BOLT: 0xffea44,
      AETHER_WAVE: 0x55eaff,
    };
    const color = spellColors[powerId] || 0xff4411;
    this.spawnCastFlash(start, color);

    if (powerId === 'LIGHTNING_BOLT') {
      this.spawnLightningBolt(start, end, dist, dir);
    } else if (powerId === 'FROST_LANCE') {
      this.spawnFrostLance(start, end, dist, dir);
    } else if (powerId === 'AETHER_WAVE') {
      this.spawnAetherWave(start, dir);
    } else {
      // Default: Arcane Fireball
      this.spawnArcaneFireball(start, end, dist, dir);
    }
  }

  // --------------------------------------------------------------------------
  // 3a. ARCANE FIREBALL: Giant roaring flame meteor + jet exhaust + scorch
  // --------------------------------------------------------------------------
  spawnArcaneFireball(start, end, dist, dir) {
    const group = new THREE.Group();
    group.position.copy(start);
    group.lookAt(end);

    // Giant roaring flame core
    const fireCore = new THREE.Mesh(this.sharedGeos.sphereLarge, this.sharedMats.fireCore);
    group.add(fireCore);

    // Churning outer plasma shroud
    const auraMesh = new THREE.Mesh(this.sharedGeos.dodecaLarge, this.sharedMats.fireCorona);
    group.add(auraMesh);

    // Orbiting fire vortex ring
    const vortexRing = new THREE.Mesh(this.sharedGeos.ringLarge, this.sharedMats.fireCore);
    group.add(vortexRing);

    this.group.add(group);

    const speed = 46; // m/s
    const totalDuration = dist / speed;
    let elapsed = 0;
    let trailTimer = 0;

    this.activeAttacks.push({
      type: 'spell',
      mesh: group,
      speed,
      life: totalDuration,
      maxLife: totalDuration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        const t = Math.min(1.0, elapsed / totalDuration);
        group.position.lerpVectors(start, end, t);

        // Fire turbulence & pulse
        fireCore.scale.setScalar(1.0 + Math.sin(elapsed * 24) * 0.15);
        auraMesh.rotation.x += 12 * dt;
        auraMesh.rotation.y += 15 * dt;
        vortexRing.rotation.z += 16 * dt;

        // Heavy jet flame exhaust trail
        trailTimer += dt;
        if (trailTimer >= 0.018 && this.particles) {
          trailTimer = 0;
          this.particles.emitProjectileTrail(group.position, dir, 0xff3300, 'smoke', 2);
          this.particles.emitProjectileTrail(group.position, dir, 0xffaa00, 'spark', 2);
        }

        if (t >= 1.0) {
          this.onTargetImpact(end, 'fire', 0xff4411, true);
        }
      },
      onDestroy: () => {
        this.group.remove(group);
      },
    });
  }

  // --------------------------------------------------------------------------
  // 3b. FROST LANCE: Spinning crystalline icicle spear + cold vapor + shatter
  // --------------------------------------------------------------------------
  spawnFrostLance(start, end, dist, dir) {
    const group = new THREE.Group();
    group.position.copy(start);
    group.lookAt(end);

    // Aerodynamic crystalline ice spear
    const spearGeo = new THREE.ConeGeometry(0.18, 1.4, 6);
    spearGeo.rotateX(Math.PI / 2);
    const spearMesh = new THREE.Mesh(spearGeo, this.sharedMats.frostCore);
    group.add(spearMesh);

    // Trailing ice shaft
    const shaftGeo = new THREE.CylinderGeometry(0.08, 0.03, 1.0, 6);
    shaftGeo.rotateX(Math.PI / 2);
    const shaftMesh = new THREE.Mesh(shaftGeo, this.sharedMats.frostMist);
    shaftMesh.position.z = -0.7;
    group.add(shaftMesh);

    // Rotating frost rings
    const ring1 = new THREE.Mesh(this.sharedGeos.ringSmall, this.sharedMats.frostCore);
    const ring2 = new THREE.Mesh(this.sharedGeos.ringMedium, this.sharedMats.frostMist);
    ring1.position.z = -0.3;
    ring2.position.z = -0.6;
    group.add(ring1, ring2);

    this.group.add(group);

    const speed = 65; // m/s
    const totalDuration = dist / speed;
    let elapsed = 0;
    let trailTimer = 0;

    this.activeAttacks.push({
      type: 'spell',
      mesh: group,
      speed,
      life: totalDuration,
      maxLife: totalDuration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        const t = Math.min(1.0, elapsed / totalDuration);
        group.position.lerpVectors(start, end, t);

        // Rapid axial spin
        group.rotation.z += 16 * dt;
        ring1.rotation.z += 12 * dt;
        ring2.rotation.z -= 18 * dt;

        // Cold mist & frost needle trail
        trailTimer += dt;
        if (trailTimer >= 0.02 && this.particles) {
          trailTimer = 0;
          this.particles.emitProjectileTrail(group.position, dir, 0x66ddff, 'frost', 1);
        }

        if (t >= 1.0) {
          this.onTargetImpact(end, 'frost', 0x66ddff);
        }
      },
      onDestroy: () => {
        this.group.remove(group);
        spearGeo.dispose();
        shaftGeo.dispose();
      },
    });
  }

  // --------------------------------------------------------------------------
  // 3c. LIGHTNING BOLT: Procedural branching jagged electric arcs
  // --------------------------------------------------------------------------
  spawnLightningBolt(start, end, dist, dir) {
    const lightningGroup = new THREE.Group();
    const segments = 16;
    const points = new Float32Array((segments + 1) * 3);

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(points, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffea44,
      linewidth: 3,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.98,
    });
    const mainLine = new THREE.Line(lineGeo, lineMat);
    lightningGroup.add(mainLine);

    // Inner bright white plasma core line
    const coreLineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 1.0,
    });
    const coreLine = new THREE.Line(lineGeo, coreLineMat);
    lightningGroup.add(coreLine);

    // Secondary tributary branching fork
    const branchSegments = 8;
    const branchPoints = new Float32Array((branchSegments + 1) * 3);
    const branchGeo = new THREE.BufferGeometry();
    branchGeo.setAttribute('position', new THREE.BufferAttribute(branchPoints, 3));
    const branchLine = new THREE.Line(branchGeo, lineMat);
    lightningGroup.add(branchLine);

    this.group.add(lightningGroup);

    // Immediate electric detonation at target!
    this.onTargetImpact(end, 'lightning', 0xffea44);

    const duration = 0.22;
    let elapsed = 0;

    // Helper to regenerate jagged erratic lightning points
    const regenerateLightning = () => {
      const posAttr = lineGeo.attributes.position;
      const bPosAttr = branchGeo.attributes.position;
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();

      let branchMid = start.clone().lerp(end, 0.45);

      for (let i = 0; i <= segments; i++) {
        const fraction = i / segments;
        const base = start.clone().lerp(end, fraction);

        // Lateral zigzag displacement (pinned at ends)
        const envelope = Math.sin(fraction * Math.PI);
        const jitterX = (Math.random() - 0.5) * 1.6 * envelope;
        const jitterY = (Math.random() - 0.5) * 1.6 * envelope;

        base.addScaledVector(right, jitterX);
        base.y += jitterY;

        posAttr.setXYZ(i, base.x, base.y, base.z);

        if (i === Math.floor(segments * 0.45)) {
          branchMid = base.clone();
        }
      }
      posAttr.needsUpdate = true;

      // Generate secondary tributary fork
      const forkDir = right.clone().multiplyScalar(Math.random() > 0.5 ? 1 : -1).add(dir).normalize();
      for (let i = 0; i <= branchSegments; i++) {
        const fraction = i / branchSegments;
        const bPos = branchMid.clone().addScaledVector(forkDir, fraction * 4.5);
        bPos.x += (Math.random() - 0.5) * 0.8;
        bPos.y += (Math.random() - 0.5) * 0.8;
        bPos.z += (Math.random() - 0.5) * 0.8;
        bPosAttr.setXYZ(i, bPos.x, bPos.y, bPos.z);
      }
      bPosAttr.needsUpdate = true;
    };

    regenerateLightning();

    this.activeAttacks.push({
      type: 'lightning',
      mesh: lightningGroup,
      life: duration,
      maxLife: duration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        regenerateLightning(); // Jitters every frame for crackling high-voltage look

        const fade = Math.max(0, 1.0 - elapsed / duration);
        lineMat.opacity = fade * 0.98;
        coreLineMat.opacity = fade * 1.0;
      },
      onDestroy: () => {
        this.group.remove(lightningGroup);
        lineGeo.dispose();
        branchGeo.dispose();
        lineMat.dispose();
        coreLineMat.dispose();
      },
    });
  }

  // --------------------------------------------------------------------------
  // 3d. AETHER REPULSION WAVE: Conical/radial shockwave ring advancing forward
  // --------------------------------------------------------------------------
  spawnAetherWave(start, dir) {
    const waveRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.6, 32),
      new THREE.MeshBasicMaterial({
        color: 0x55eaff,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    waveRing.position.copy(start);
    waveRing.lookAt(start.clone().add(dir));
    this.group.add(waveRing);

    const duration = 0.45;
    let elapsed = 0;

    this.activeAttacks.push({
      type: 'wave',
      mesh: waveRing,
      life: duration,
      maxLife: duration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        const t = elapsed / duration;
        waveRing.position.addScaledVector(dir, 32 * dt);
        const s = 1.0 + t * 9.0;
        waveRing.scale.set(s, s, 1.0);
        waveRing.material.opacity = Math.max(0, (1.0 - t) * 0.92);
      },
      onDestroy: () => {
        this.group.remove(waveRing);
        waveRing.geometry.dispose();
        waveRing.material.dispose();
      },
    });
  }

  // --------------------------------------------------------------------------
  // 4. MOB ATTACKS: Aqua Fiend Water Spit & Flame Brute Molten Spit
  // --------------------------------------------------------------------------
  spawnMobAttack(event) {
    const origin = event.origin || { x: 0, y: 1.0, z: 0 };
    const target = event.target || { x: origin.x, y: origin.y, z: origin.z + 15 };
    const isFire = event.attackType === 'FIRE_SPIT' || event.isFire;
    const start = new THREE.Vector3(origin.x, origin.y, origin.z);
    const end = new THREE.Vector3(target.x, target.y, target.z);
    const dist = Math.max(0.1, start.distanceTo(end));
    const dir = end.clone().sub(start).normalize();

    this.spawnCastFlash(start, isFire ? 0xff5511 : 0x22aaff);

    const group = new THREE.Group();
    group.position.copy(start);
    group.lookAt(end);

    let coreMesh;
    let ringMesh;

    if (isFire) {
      // Molten magma projectile with fiery crust
      coreMesh = new THREE.Mesh(this.sharedGeos.dodeca, this.sharedMats.fireCore);
      ringMesh = new THREE.Mesh(this.sharedGeos.ringMedium, this.sharedMats.fireCorona);
    } else {
      // Hydrodynamic water torpedo bubble with ripple wake
      coreMesh = new THREE.Mesh(this.sharedGeos.sphereMedium, this.sharedMats.waterCore);
      ringMesh = new THREE.Mesh(this.sharedGeos.ringSmall, this.sharedMats.waterCore);
    }

    group.add(coreMesh);
    if (ringMesh) group.add(ringMesh);
    this.group.add(group);

    const speed = isFire ? 30 : 26; // m/s
    const totalDuration = dist / speed;
    let elapsed = 0;
    let trailTimer = 0;

    this.activeAttacks.push({
      type: 'mob-projectile',
      mesh: group,
      speed,
      life: totalDuration,
      maxLife: totalDuration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        const t = Math.min(1.0, elapsed / totalDuration);
        group.position.lerpVectors(start, end, t);

        if (isFire) {
          coreMesh.rotation.x += 10 * dt;
          coreMesh.rotation.y += 12 * dt;
          if (ringMesh) ringMesh.rotation.z += 14 * dt;
        } else {
          coreMesh.scale.setScalar(0.95 + Math.sin(elapsed * 18) * 0.15);
          if (ringMesh) ringMesh.rotation.z -= 12 * dt;
        }

        trailTimer += dt;
        if (trailTimer >= 0.024 && this.particles) {
          trailTimer = 0;
          this.particles.emitProjectileTrail(group.position, dir, isFire ? 0xff5511 : 0x22aaff, isFire ? 'smoke' : 'water', 1);
        }

        if (t >= 1.0) {
          this.onTargetImpact(end, isFire ? 'fire' : 'water', isFire ? 0xff5511 : 0x22aaff);
        }
      },
      onDestroy: () => {
        this.group.remove(group);
      },
    });
  }

  // --------------------------------------------------------------------------
  // 5. MELEE / KNIFE ATTACK: Sweeping glowing crescent energy blade arc
  // --------------------------------------------------------------------------
  spawnMeleeSlash(origin, facingAngle, color = 0x00f0ff) {
    const slashGroup = new THREE.Group();
    const eyeHeight = 1.15;
    slashGroup.position.set(origin.x, origin.y + eyeHeight, origin.z);
    slashGroup.rotation.y = facingAngle;

    // Curved crescent blade geometry
    const crescentGeo = new THREE.RingGeometry(1.2, 2.4, 24, 1, -Math.PI / 3, (2 * Math.PI) / 3);
    const crescentMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const crescentMesh = new THREE.Mesh(crescentGeo, crescentMat);
    crescentMesh.rotation.x = -Math.PI / 2;
    crescentMesh.position.z = 1.1; // Extends forward
    slashGroup.add(crescentMesh);

    this.group.add(slashGroup);

    // Forward fan spray of cutting blade sparks
    const forwardDir = new THREE.Vector3(Math.sin(facingAngle), 0, Math.cos(facingAngle));
    if (this.particles) {
      const contactPos = origin.clone().add(forwardDir.clone().multiplyScalar(1.8));
      contactPos.y += eyeHeight;
      this.particles.emitSlashSparks(contactPos, forwardDir, 16);
    }

    const duration = 0.20;
    let elapsed = 0;

    this.activeAttacks.push({
      type: 'melee-slash',
      mesh: slashGroup,
      life: duration,
      maxLife: duration,
      onUpdate: (progress, dt) => {
        elapsed += dt;
        const t = elapsed / duration;
        crescentMesh.rotation.z = -0.5 + t * 1.8; // Sweeps dynamically from right to left
        const s = 1.0 + t * 0.45;
        crescentMesh.scale.set(s, s, s);
        crescentMat.opacity = Math.max(0, (1.0 - t) * 0.95);
      },
      onDestroy: () => {
        this.group.remove(slashGroup);
        crescentGeo.dispose();
        crescentMat.dispose();
      },
    });
  }

  // --------------------------------------------------------------------------
  // 6. TARGET IMPACT DETONATION: Triggers when projectile arrives at target
  // --------------------------------------------------------------------------
  onTargetImpact(pos, element = 'arcane', color = 0x55eaff, causesScreenShake = false) {
    if (this.particles) {
      this.particles.emitElementalImpact(pos, element, element === 'fire' ? 32 : 22);
    }

    // Flash sphere at impact epicenter
    const impactGeo = new THREE.SphereGeometry(0.35, 10, 8);
    const impactMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const impactMesh = new THREE.Mesh(impactGeo, impactMat);
    impactMesh.position.copy(pos);
    this.group.add(impactMesh);

    this.activeAttacks.push({
      type: 'impact-flash',
      mesh: impactMesh,
      life: 0.18,
      maxLife: 0.18,
      onUpdate: (progress) => {
        const s = 1.0 + (1.0 - progress) * 2.8;
        impactMesh.scale.set(s, s, s);
        impactMat.opacity = progress * 0.95;
      },
      onDestroy: () => {
        this.group.remove(impactMesh);
        impactGeo.dispose();
        impactMat.dispose();
      },
    });

    if (causesScreenShake && this.onCameraShake) {
      this.onCameraShake(0.35, 0.28);
    }
  }

  // --------------------------------------------------------------------------
  // 7. MAIN UPDATE LOOP (Called every frame)
  // --------------------------------------------------------------------------
  update(dt, camera) {
    for (let i = this.activeAttacks.length - 1; i >= 0; i--) {
      const attack = this.activeAttacks[i];
      attack.life -= dt;

      const progress = Math.max(0, attack.life / attack.maxLife);
      if (attack.onUpdate) {
        attack.onUpdate(progress, dt);
      }

      if (attack.life <= 0) {
        if (attack.onDestroy) {
          attack.onDestroy();
        }
        this.activeAttacks.splice(i, 1);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 8. DISPOSE & CLEANUP
  // --------------------------------------------------------------------------
  destroy() {
    for (const attack of this.activeAttacks) {
      if (attack.onDestroy) attack.onDestroy();
    }
    this.activeAttacks = [];

    // Dispose shared geometries
    for (const geo of Object.values(this.sharedGeos)) {
      geo.dispose();
    }

    // Dispose shared materials
    for (const mat of Object.values(this.sharedMats)) {
      mat.dispose();
    }

    this.scene.remove(this.group);
  }
}
