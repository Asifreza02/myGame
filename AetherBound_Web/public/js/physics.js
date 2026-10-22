import * as THREE from '/three/three.module.js';
import { GAME_CONFIG } from './config.js';

export class PhysicsSystem {
  constructor(worldManager, obstacleManager) {
    this.worldManager = worldManager;
    this.obstacleManager = obstacleManager;
  }

  // Resolve Character movement, terrain height snapping, and obstacle collisions & damage
  updateCharacterPhysics(character, dt) {
    if (!character) return;
    const radius = GAME_CONFIG.RUNNER.RADIUS || 0.8;
    const pos = character.position;

    // Apply gravity
    character.velocity.y -= GAME_CONFIG.RUNNER.GRAVITY * dt;
    pos.y += character.velocity.y * dt;

    // Terrain ground check
    const terrainHeight = this.worldManager.getHeightAt(pos.x, pos.z);

    if (pos.y <= terrainHeight) {
      pos.y = terrainHeight;
      character.velocity.y = 0;
      character.isGrounded = true;
    } else {
      // Small tolerance for grounded state
      character.isGrounded = (pos.y - terrainHeight < 0.2);
    }

    // Check obstacle collisions & damage
    let inMud = false;

    for (const obs of this.obstacleManager.obstacles.values()) {
      const def = obs.definition;

      switch (def.type) {
        case 'SOLID': { // Wall
          this.resolveBoxCollision(pos, radius, obs.mesh.position, def.size, obs.rotation.y);
          break;
        }

        case 'ZONE': { // Mud
          const dx = pos.x - obs.position.x;
          const dz = pos.z - obs.position.z;
          const dist2D = Math.sqrt(dx * dx + dz * dz);
          if (dist2D < def.size.width / 2 + radius) {
            inMud = true;
          }
          break;
        }

        case 'HAZARD': { // Spikes
          const dx = pos.x - obs.position.x;
          const dz = pos.z - obs.position.z;
          const dist2D = Math.sqrt(dx * dx + dz * dz);
          if (dist2D < def.size.width / 2 + radius && Math.abs(pos.y - obs.position.y) < def.size.height) {
            // Apply knockback away from spikes
            const knockAngle = Math.atan2(dz, dx);
            character.velocity.x = Math.cos(knockAngle) * def.knockback;
            character.velocity.z = Math.sin(knockAngle) * def.knockback;
            character.velocity.y = 6.0;
            if (character.takeDamage) character.takeDamage(25, 'spikes');
            else if (character.onHazardHit) character.onHazardHit();
          }
          break;
        }

        case 'DYNAMIC': { // Boulder
          const dx = pos.x - obs.position.x;
          const dy = (pos.y + 0.9) - obs.position.y;
          const dz = pos.z - obs.position.z;
          const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist3D < def.radius + radius) {
            // Boulder hit!
            const hitDir = new THREE.Vector3(dx, 0.5, dz).normalize();
            character.velocity.addScaledVector(hitDir, 16.0);
            if (character.takeDamage) character.takeDamage(35, 'boulder');
            else if (character.onHazardHit) character.onHazardHit();
          }
          break;
        }

        case 'EXPLOSIVE': { // Explosive Barrel
          const dx = pos.x - obs.position.x;
          const dy = (pos.y + 0.9) - obs.position.y;
          const dz = pos.z - obs.position.z;
          const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const triggerDist = (def.size ? def.size.radius : 1.1) + radius + 0.6;
          if (dist3D < triggerDist) {
            // Proximity detonation!
            if (this.obstacleManager && this.obstacleManager.detonateBarrel) {
              this.obstacleManager.detonateBarrel(obs.id, character.particles, character.audio, (blastPos, blastRadius, knockback) => {
                const kx = pos.x - blastPos.x;
                const kz = pos.z - blastPos.z;
                const kDist = Math.max(0.5, Math.sqrt(kx * kx + kz * kz));
                character.velocity.x += (kx / kDist) * knockback;
                character.velocity.z += (kz / kDist) * knockback;
                character.velocity.y = 12.0;
                const dmg = Math.round(Math.max(25, 65 * (1.0 - kDist / blastRadius)));
                if (character.takeDamage) character.takeDamage(dmg, 'explosion');
                else if (character.onHazardHit) character.onHazardHit();
              });
            }
          }
          break;
        }
      }
    }

    // Dynamic Boulder vs Barrels & Walls interaction
    for (const b of this.obstacleManager.boulders) {
      // Check collision with barrels
      for (const bar of this.obstacleManager.barrels) {
        const d = b.mesh.position.distanceTo(bar.mesh.position);
        if (d < b.definition.radius + 1.2) {
          this.obstacleManager.detonateBarrel(bar.id, character.particles, character.audio);
          break;
        }
      }

      // Check collision with walls (crack/damage wall)
      for (const [wId, w] of this.obstacleManager.obstacles.entries()) {
        if (w.type === 'WALL' && w.durability !== undefined) {
          const wd = b.mesh.position.distanceTo(w.mesh.position);
          if (wd < b.definition.radius + 3.0) {
            w.durability -= 50;
            b.velocity.negate().multiplyScalar(0.5); // bounce boulder
            if (w.durability <= 0) {
              this.obstacleManager.destroyObstacle(wId, character.particles);
            }
            break;
          }
        }
      }
    }

    // Check world structures (Buildings & Big Rocks)
    if (this.worldManager.colliders) {
      for (const col of this.worldManager.colliders) {
        if (!col) continue;
        if (col.type === 'BOX') {
          this.resolveBoxCollision(pos, radius, col.center, col.size, col.rotationY);
        } else if (col.type === 'CYLINDER') {
          this.resolveCylinderCollision(pos, radius, col.center, col.radius);
        }
      }
    }

    // Water wading detection
    const isInWater = (pos.y <= this.worldManager.waterLevel + 0.25);
    character.isInWater = isInWater;
    character.isSlowed = inMud;
  }

  // Alias for backward compatibility
  updateRunnerPhysics(runner, dt) {
    return this.updateCharacterPhysics(runner, dt);
  }

  // Cylindrical collision resolution for big monolithic rocks
  resolveCylinderCollision(playerPos, playerRadius, cylCenter, cylRadius) {
    const dx = playerPos.x - cylCenter.x;
    const dz = playerPos.z - cylCenter.z;
    const distSq = dx * dx + dz * dz;
    const minDist = cylRadius + playerRadius;

    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const pushX = (dx / dist) * (minDist - dist);
      const pushZ = (dz / dist) * (minDist - dist);
      playerPos.x += pushX;
      playerPos.z += pushZ;
    }
  }

  // AABB / Oriented Box collision resolution
  resolveBoxCollision(playerPos, playerRadius, boxCenter, boxSize, boxRotationY = 0) {
    // Relative vector from box center to player
    let rx = playerPos.x - boxCenter.x;
    let rz = playerPos.z - boxCenter.z;

    // Rotate into box's local space if rotated
    if (boxRotationY !== 0) {
      const cos = Math.cos(-boxRotationY);
      const sin = Math.sin(-boxRotationY);
      const tempX = rx * cos - rz * sin;
      const tempZ = rx * sin + rz * cos;
      rx = tempX;
      rz = tempZ;
    }

    const halfW = boxSize.width / 2 + playerRadius;
    const halfD = boxSize.depth / 2 + playerRadius;

    // Check if player is inside expanded 2D footprint
    if (Math.abs(rx) < halfW && Math.abs(rz) < halfD) {
      // Find penetration depth along X and Z
      const penX = halfW - Math.abs(rx);
      const penZ = halfD - Math.abs(rz);

      // Push out along the shallowest axis
      if (penX < penZ) {
        rx += (rx > 0 ? 1 : -1) * penX;
      } else {
        rz += (rz > 0 ? 1 : -1) * penZ;
      }

      // Rotate back to world space
      if (boxRotationY !== 0) {
        const cos = Math.cos(boxRotationY);
        const sin = Math.sin(boxRotationY);
        playerPos.x = boxCenter.x + (rx * cos - rz * sin);
        playerPos.z = boxCenter.z + (rx * sin + rz * cos);
      } else {
        playerPos.x = boxCenter.x + rx;
        playerPos.z = boxCenter.z + rz;
      }
    }
  }

  // Exact Raycast from camera and normalized mouse screen coordinates to open-world terrain
  raycastTerrain(camera, mouseNdc) {
    if (!camera || !mouseNdc) return null;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouseNdc, camera);

    // 1. High precision mesh raycast against active terrain chunks
    const terrainMeshes = this.worldManager.getTerrainMeshes();
    if (terrainMeshes.length > 0) {
      const intersects = raycaster.intersectObjects(terrainMeshes, false);
      if (intersects.length > 0) {
        return intersects[0].point;
      }
    }

    // 2. Fallback to analytical heightmap raymarching
    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;

    let t = 1.0;
    const maxDist = 350.0;
    const step = 0.5;

    while (t < maxDist) {
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;

      const th = this.worldManager.getHeightAt(px, pz);

      if (py <= th) {
        let tLow = t - step;
        let tHigh = t;
        for (let b = 0; b < 6; b++) {
          const tMid = (tLow + tHigh) * 0.5;
          const mx = origin.x + dir.x * tMid;
          const my = origin.y + dir.y * tMid;
          const mz = origin.z + dir.z * tMid;
          const mh = this.worldManager.getHeightAt(mx, mz);
          if (my <= mh) tHigh = tMid;
          else tLow = tMid;
        }

        const finalT = (tLow + tHigh) * 0.5;
        const hitX = origin.x + dir.x * finalT;
        const hitZ = origin.z + dir.z * finalT;
        const hitY = this.worldManager.getHeightAt(hitX, hitZ);

        return new THREE.Vector3(hitX, hitY, hitZ);
      }

      t += step;
    }

    return null;
  }

  // Check if there is a waist-height obstacle ahead suitable for vaulting
  checkVaultTarget(runnerPos, forwardX, forwardZ) {
    const checkDist = 1.6;
    const testX = runnerPos.x + forwardX * checkDist;
    const testZ = runnerPos.z + forwardZ * checkDist;

    // Check obstacles
    for (const obs of this.obstacleManager.obstacles.values()) {
      if (obs.type === 'WALL' || obs.type === 'SPIKES' || obs.type === 'BARREL') {
        const dx = testX - obs.position.x;
        const dz = testZ - obs.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const halfW = obs.definition.size ? (obs.definition.size.width / 2 || obs.definition.size.radius || 1.5) : 1.5;

        if (dist <= halfW + 0.8) {
          const topY = obs.mesh.position.y + (obs.definition.size.height || 2.2);
          const heightDiff = topY - runnerPos.y;
          // Can vault obstacles between 0.7m and 2.3m high
          if (heightDiff >= (GAME_CONFIG.RUNNER.VAULT_MIN_HEIGHT || 0.7) &&
              heightDiff <= (GAME_CONFIG.RUNNER.VAULT_MAX_HEIGHT || 2.3)) {
            return new THREE.Vector3(
              runnerPos.x + forwardX * 2.8,
              topY + 0.1,
              runnerPos.z + forwardZ * 2.8
            );
          }
        }
      }
    }

    // Check world rock colliders
    if (this.worldManager.colliders) {
      for (const col of this.worldManager.colliders) {
        if (col && col.type === 'CYLINDER') {
          const dx = testX - col.center.x;
          const dz = testZ - col.center.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= col.radius + 0.8) {
            const rockGroundY = this.worldManager.getHeightAt(col.center.x, col.center.z);
            const topY = rockGroundY + 1.8;
            const heightDiff = topY - runnerPos.y;
            if (heightDiff >= 0.7 && heightDiff <= 2.3) {
              return new THREE.Vector3(
                runnerPos.x + forwardX * 2.8,
                topY + 0.1,
                runnerPos.z + forwardZ * 2.8
              );
            }
          }
        }
      }
    }

    return null;
  }
}
