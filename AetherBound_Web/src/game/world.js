import * as THREE from 'three';
import { SimplexNoise } from './noise.js';
import { GAME_CONFIG, BIOMES } from './config.js';

export class WorldManager {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.seed = seed;
    this.noise = new SimplexNoise(seed);
    this.chunks = new Map(); // key "cx,cz" -> { mesh, waterMesh, propsGroup, key }
    this.buildings = new Map(); // key "bx,bz" -> { group, collider, key }
    this.colliders = []; // active world colliders (buildings & big rocks)

    this.chunkSize = GAME_CONFIG.WORLD.CHUNK_SIZE;
    this.segments = GAME_CONFIG.WORLD.CHUNK_SEGMENTS;
    this.renderDistance = GAME_CONFIG.WORLD.RENDER_DISTANCE;
    this.heightScale = GAME_CONFIG.WORLD.HEIGHT_SCALE;
    this.noiseScale = GAME_CONFIG.WORLD.NOISE_SCALE;
    this.waterLevel = GAME_CONFIG.WORLD.WATER_LEVEL;
    this.buildingGridSize = GAME_CONFIG.WORLD.BUILDING_GRID_SIZE;

    // Materials
    this.terrainMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.9,
    });

    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0088cc,
      roughness: 0.15,
      metalness: 0.4,
      transparent: true,
      opacity: 0.78,
    });

    // Reusable geometries & materials for 4 biomes (Lush, Desert, Snow, Volcanic)
    this.bigRockGeo = new THREE.DodecahedronGeometry(1.0, 1);
    this.bigRockMat = new THREE.MeshStandardMaterial({
      color: 0x58524d,
      roughness: 0.9,
      metalness: 0.15,
      flatShading: true,
    });

    this.desertRockMat = new THREE.MeshStandardMaterial({
      color: 0x8a4b2a, // Terracotta canyon red stone
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });

    this.snowRockMat = new THREE.MeshStandardMaterial({
      color: 0x6e7e8e, // Frosty slate rock
      roughness: 0.9,
      metalness: 0.2,
      flatShading: true,
    });

    this.obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x18181c, // Dark volcanic basalt
      roughness: 0.4,
      metalness: 0.8,
      flatShading: true,
    });

    this.lavaVentMat = new THREE.MeshBasicMaterial({
      color: 0xff4400, // Glowing magma core
    });

    this.trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3, 5);
    this.trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2e18, flatShading: true });

    this.foliageGeo = new THREE.ConeGeometry(1.8, 3.5, 5);
    this.foliageMat = new THREE.MeshLambertMaterial({ color: 0x24582e, flatShading: true });
    this.snowFoliageMat = new THREE.MeshLambertMaterial({ color: 0xd8e8f2, flatShading: true });
    this.desertShrubMat = new THREE.MeshLambertMaterial({ color: 0xa87f44, flatShading: true });
  }

  setSeed(newSeed) {
    this.seed = newSeed;
    this.noise = new SimplexNoise(newSeed);

    // Clear chunks
    for (const chunk of this.chunks.values()) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      if (chunk.waterMesh) {
        this.scene.remove(chunk.waterMesh);
        chunk.waterMesh.geometry.dispose();
      }
      if (chunk.propsGroup) this.scene.remove(chunk.propsGroup);
    }
    this.chunks.clear();

    // Clear buildings
    for (const bld of this.buildings.values()) {
      this.scene.remove(bld.group);
    }
    this.buildings.clear();
    this.colliders = [];
    if (this.onChunksCleared) {
      this.onChunksCleared();
    }
  }

  // Phase 3: Macro-scale climate calculation (Temperature & Moisture) for 4 Biomes
  getBiomeWeights(x, z) {
    const climateScale = 0.0028;
    const temp = this.noise.noise2D(x * climateScale, z * climateScale);
    const moisture = this.noise.noise2D(x * climateScale + 350, z * climateScale + 350);

    // Compute weights
    let weightSnow = Math.max(0, -temp - 0.15);
    let weightDesert = Math.max(0, temp - 0.15) * Math.max(0, -moisture + 0.1);
    let weightVolcanic = Math.max(0, temp - 0.2) * Math.max(0, moisture + 0.1);
    let weightLush = Math.max(0.12, 1.0 - (weightSnow * 1.8 + weightDesert * 1.8 + weightVolcanic * 1.8));

    const total = weightSnow + weightDesert + weightVolcanic + weightLush;
    return {
      snow: weightSnow / total,
      desert: weightDesert / total,
      volcanic: weightVolcanic / total,
      lush: weightLush / total,
    };
  }

  getDominantBiome(x, z) {
    const w = this.getBiomeWeights(x, z);
    if (w.snow > w.desert && w.snow > w.volcanic && w.snow > w.lush) return BIOMES.SNOW;
    if (w.desert > w.snow && w.desert > w.volcanic && w.desert > w.lush) return BIOMES.DESERT;
    if (w.volcanic > w.snow && w.volcanic > w.desert && w.volcanic > w.lush) return BIOMES.VOLCANIC;
    return BIOMES.LUSH;
  }

  // Exact procedural height calculation across multi-biome terrain
  getHeightAt(x, z) {
    const distFromOrigin = Math.sqrt(x * x + z * z);
    if (distFromOrigin < 28) {
      // Flat meadow around initial spawn area
      return 0.8;
    }

    const nx = x * this.noiseScale;
    const nz = z * this.noiseScale;

    // Biome climate weights
    const climate = this.getBiomeWeights(x, z);

    // Baseline rolling terrain
    let baseH = (this.noise.noise2D(nx, nz) * 0.75 + this.noise.noise2D(nx * 2.2, nz * 2.2) * 0.25);
    
    // Scale height by biome: desert canyon mesas, snowy alpine peaks, volcanic craters, lush plains
    const heightMultiplier = climate.lush * 1.8 + climate.desert * 2.5 + climate.snow * 2.9 + climate.volcanic * 2.2;
    let h = baseH * heightMultiplier + 0.8;

    // Desert stepped mesa effect
    if (climate.desert > 0.35) {
      const step = Math.floor(h / 1.35) * 1.35;
      h = THREE.MathUtils.lerp(h, step, (climate.desert - 0.35) * 0.75);
    }

    // Natural Water Source Depressions (Lakes / River Basins) in lush and snow biomes
    if (climate.lush > 0.3 || climate.snow > 0.3) {
      const lakeNoise = this.noise.noise2D(nx * 0.8 + 120, nz * 0.8 + 120);
      if (lakeNoise < -0.24) {
        const depth = ((-0.24 - lakeNoise) / 0.76) * 3.6;
        h -= depth;
      }
    }

    return h;
  }

  // Get active chunk terrain meshes for exact polygon-level cursor raycasting
  getTerrainMeshes() {
    const meshes = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.mesh) meshes.push(chunk.mesh);
    }
    return meshes;
  }

  // Update dynamic chunks and distant buildings around active players
  update(focusPositions, time = 0) {
    const activeChunkKeys = new Set();
    const activeBuildingKeys = new Set();

    // 1. Chunks Streaming
    for (const pos of focusPositions) {
      if (!pos) continue;
      const centerCX = Math.floor(pos.x / this.chunkSize);
      const centerCZ = Math.floor(pos.z / this.chunkSize);

      for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
        for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
          const cx = centerCX + dx;
          const cz = centerCZ + dz;
          const key = `${cx},${cz}`;
          activeChunkKeys.add(key);

          if (!this.chunks.has(key)) {
            this.createChunk(cx, cz);
          }
        }
      }

      // 2. Distant Buildings Streaming (Macro Grid)
      const bGrid = this.buildingGridSize;
      const centerBX = Math.floor(pos.x / bGrid);
      const centerBZ = Math.floor(pos.z / bGrid);

      for (let bdx = -2; bdx <= 2; bdx++) {
        for (let bdz = -2; bdz <= 2; bdz++) {
          const bx = centerBX + bdx;
          const bz = centerBZ + bdz;
          const bKey = `${bx},${bz}`;
          activeBuildingKeys.add(bKey);

          if (!this.buildings.has(bKey)) {
            this.createBuildingInCell(bx, bz);
          }
        }
      }
    }

    // Unload distant chunks
    for (const [key, chunk] of this.chunks.entries()) {
      if (!activeChunkKeys.has(key)) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        if (chunk.waterMesh) {
          this.scene.remove(chunk.waterMesh);
          chunk.waterMesh.geometry.dispose();
        }
        if (chunk.propsGroup) this.scene.remove(chunk.propsGroup);
        for (const collider of chunk.colliders || []) {
          const colliderIndex = this.colliders.indexOf(collider);
          if (colliderIndex !== -1) this.colliders.splice(colliderIndex, 1);
        }
        this.chunks.delete(key);
      } else {
        // Animate water ripple
        if (chunk.waterMesh) {
          const [cxStr, czStr] = key.split(',');
          const cx = parseFloat(cxStr);
          const cz = parseFloat(czStr);
          chunk.waterMesh.position.y = this.waterLevel + Math.sin(time * 2.5 + cx * 0.7 + cz * 0.7) * 0.04;
        }
      }
    }

    // Unload distant buildings
    for (const [bKey, bld] of this.buildings.entries()) {
      if (!activeBuildingKeys.has(bKey)) {
        this.scene.remove(bld.group);
        // Remove collider
        const idx = this.colliders.indexOf(bld.collider);
        if (idx !== -1) this.colliders.splice(idx, 1);
        this.buildings.delete(bKey);
      }
    }
  }

  createChunk(cx, cz) {
    const key = `${cx},${cz}`;
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      this.segments,
      this.segments
    );
    geometry.rotateX(-Math.PI / 2);

    const worldOriginX = cx * this.chunkSize;
    const worldOriginZ = cz * this.chunkSize;

    const posAttr = geometry.attributes.position;
    const vertexCount = posAttr.count;
    const colors = new Float32Array(vertexCount * 3);

    // Biome base colors
    const colorWaterBed = new THREE.Color(0x2d483e); // Silt / lake bed
    const colorShoreSand = new THREE.Color(0xd2b78b); // Golden shoreline sand
    const colLush = new THREE.Color(0x4a7e37);        // Lush meadow grass
    const colDesert = new THREE.Color(0xd49a5b);      // Terracotta canyon sandstone
    const colSnow = new THREE.Color(0xeef5fc);        // Frost snow
    const colVolcanic = new THREE.Color(0x232328);    // Obsidian basalt

    let hasWater = false;

    for (let i = 0; i < vertexCount; i++) {
      const localX = posAttr.getX(i);
      const localZ = posAttr.getZ(i);

      const wx = worldOriginX + localX;
      const wz = worldOriginZ + localZ;

      const wy = this.getHeightAt(wx, wz);
      posAttr.setY(i, wy);

      if (wy <= this.waterLevel + 0.3) {
        hasWater = true;
      }

      const weights = this.getBiomeWeights(wx, wz);

      // Smooth color blending across all 4 biomes
      const c = new THREE.Color();
      c.r = colLush.r * weights.lush + colDesert.r * weights.desert + colSnow.r * weights.snow + colVolcanic.r * weights.volcanic;
      c.g = colLush.g * weights.lush + colDesert.g * weights.desert + colSnow.g * weights.snow + colVolcanic.g * weights.volcanic;
      c.b = colLush.b * weights.lush + colDesert.b * weights.desert + colSnow.b * weights.snow + colVolcanic.b * weights.volcanic;

      // Volcanic glowing magma seams in high-volcanic zones
      if (weights.volcanic > 0.4) {
        const vein = Math.abs(this.noise.noise2D(wx * 0.08, wz * 0.08));
        if (vein < 0.075) {
          c.lerp(new THREE.Color(0xff4400), (0.075 - vein) / 0.075);
        }
      }

      // Shoreline sand & lakebed in lush/snow biomes
      if (wy < this.waterLevel) {
        c.copy(colorWaterBed);
      } else if (wy < this.waterLevel + 0.35 && (weights.lush > 0.25 || weights.snow > 0.25)) {
        c.lerp(colorShoreSand, Math.max(0, 1.0 - (wy - this.waterLevel) / 0.35));
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, this.terrainMaterial);
    mesh.position.set(worldOriginX, 0, worldOriginZ);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Create Water Surface Plane if chunk dips into water
    let waterMesh = null;
    if (hasWater) {
      const waterGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 2, 2);
      waterGeo.rotateX(-Math.PI / 2);
      waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
      waterMesh.position.set(worldOriginX, this.waterLevel, worldOriginZ);
      this.scene.add(waterMesh);
    }

    // Generate biome-specific props & monoliths
    const propsGroup = this.createChunkProps(cx, cz);

    this.chunks.set(key, {
      mesh,
      waterMesh,
      propsGroup,
      colliders: propsGroup ? propsGroup.userData.colliders : [],
      key,
    });
    if (this.onChunkCreated) {
      this.onChunkCreated(cx, cz);
    }
  }

  createChunkProps(cx, cz) {
    const group = new THREE.Group();
    group.userData.colliders = [];
    const worldOriginX = cx * this.chunkSize;
    const worldOriginZ = cz * this.chunkSize;

    let propSeed = Math.abs(cx * 73856093 ^ cz * 19349663 ^ this.seed);
    const rng = () => {
      propSeed = (propSeed * 16807) % 2147483647;
      return (propSeed - 1) / 2147483646;
    };

    const dominantBiome = this.getDominantBiome(worldOriginX, worldOriginZ);

    // 1. Spawn Biome-Specific Monolithic Formations
    const bigRockChance = rng();
    if (bigRockChance > 0.42) {
      const lx = (rng() - 0.5) * (this.chunkSize - 12);
      const lz = (rng() - 0.5) * (this.chunkSize - 12);
      const wx = worldOriginX + lx;
      const wz = worldOriginZ + lz;

      if (Math.sqrt(wx * wx + wz * wz) > 25) {
        const wy = this.getHeightAt(wx, wz);
        if (wy > this.waterLevel + 0.2) {
          let rockMat = this.bigRockMat;
          if (dominantBiome === BIOMES.DESERT) rockMat = this.desertRockMat;
          else if (dominantBiome === BIOMES.SNOW) rockMat = this.snowRockMat;
          else if (dominantBiome === BIOMES.VOLCANIC) rockMat = this.obsidianMat;

          const rockMesh = new THREE.Mesh(this.bigRockGeo, rockMat);
          const rx = 5.0 + rng() * 6.0;
          const ry = 4.0 + rng() * 5.0;
          const rz = 5.0 + rng() * 6.0;
          rockMesh.scale.set(rx, ry, rz);

          const rotY = rng() * Math.PI * 2;
          rockMesh.rotation.set(rng() * 0.2, rotY, rng() * 0.2);
          rockMesh.position.set(wx, wy + ry, wz);
          rockMesh.castShadow = true;
          rockMesh.receiveShadow = true;
          group.add(rockMesh);

          // Register solid cylinder collider for the big rock
          const collider = {
            id: `rock_${cx}_${cz}`,
            type: 'CYLINDER',
            center: { x: wx, y: wy + ry, z: wz },
            radius: Math.max(rx, rz) * 1.05,
            height: ry * 2,
          };
          this.colliders.push(collider);
          group.userData.colliders.push(collider);
        }
      }
    }

    // 2. Biome-Specific Flora & Formations
    const count = dominantBiome.treeDensity || 3;
    for (let i = 0; i < count; i++) {
      const lx = (rng() - 0.5) * (this.chunkSize - 6);
      const lz = (rng() - 0.5) * (this.chunkSize - 6);
      const wx = worldOriginX + lx;
      const wz = worldOriginZ + lz;

      if (Math.sqrt(wx * wx + wz * wz) < 22) continue;

      const wy = this.getHeightAt(wx, wz);
      if (wy <= this.waterLevel + 0.3) continue;

      if (dominantBiome === BIOMES.LUSH) {
        // Lush pine tree
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(this.trunkGeo, this.trunkMat);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        tree.add(trunk);

        const foliage = new THREE.Mesh(this.foliageGeo, this.foliageMat);
        foliage.position.y = 3.6;
        foliage.castShadow = true;
        tree.add(foliage);

        const s = 0.7 + rng() * 0.5;
        tree.scale.set(s, s, s);
        tree.position.set(wx, wy, wz);
        group.add(tree);
        const collider = {
          id: `tree_${cx}_${cz}_${i}`,
          type: 'CYLINDER',
          center: { x: wx, y: wy + 1.5 * s, z: wz },
          radius: 0.5 * s,
          height: 3 * s,
        };
        this.colliders.push(collider);
        group.userData.colliders.push(collider);
      } else if (dominantBiome === BIOMES.SNOW) {
        // Snow-capped conifer
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(this.trunkGeo, this.trunkMat);
        trunk.position.y = 1.5;
        tree.add(trunk);

        const foliage = new THREE.Mesh(this.foliageGeo, this.snowFoliageMat);
        foliage.position.y = 3.6;
        tree.add(foliage);

        const s = 0.8 + rng() * 0.6;
        tree.scale.set(s, s, s);
        tree.position.set(wx, wy, wz);
        group.add(tree);
        const collider = {
          id: `tree_${cx}_${cz}_${i}`,
          type: 'CYLINDER',
          center: { x: wx, y: wy + 1.5 * s, z: wz },
          radius: 0.5 * s,
          height: 3 * s,
        };
        this.colliders.push(collider);
        group.userData.colliders.push(collider);
      } else if (dominantBiome === BIOMES.DESERT) {
        // Sandstone pillar / desert scrub
        const shrubGeo = new THREE.DodecahedronGeometry(0.9, 0);
        const shrub = new THREE.Mesh(shrubGeo, this.desertShrubMat);
        shrub.position.set(wx, wy + 0.8, wz);
        shrub.scale.set(1.2 + rng() * 0.8, 1.4 + rng() * 1.2, 1.2 + rng() * 0.8);
        group.add(shrub);
        const collider = {
          id: `shrub_${cx}_${cz}_${i}`,
          type: 'CYLINDER',
          center: { x: wx, y: wy + shrub.scale.y * 0.9, z: wz },
          radius: Math.max(shrub.scale.x, shrub.scale.z) * 0.65,
          height: shrub.scale.y * 1.8,
        };
        this.colliders.push(collider);
        group.userData.colliders.push(collider);
      } else if (dominantBiome === BIOMES.VOLCANIC) {
        // Glowing magma vent / basalt spire
        const ventGeo = new THREE.CylinderGeometry(0.8, 1.4, 1.2, 6);
        const vent = new THREE.Mesh(ventGeo, this.obsidianMat);
        vent.position.set(wx, wy + 0.6, wz);
        group.add(vent);
        const collider = {
          id: `vent_${cx}_${cz}_${i}`,
          type: 'CYLINDER',
          center: { x: wx, y: wy + 0.6, z: wz },
          radius: 1.4,
          height: 1.2,
        };
        this.colliders.push(collider);
        group.userData.colliders.push(collider);

        const coreGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 6);
        const core = new THREE.Mesh(coreGeo, this.lavaVentMat);
        core.position.set(wx, wy + 1.2, wz);
        group.add(core);
      }
    }

    if (group.children.length > 0) {
      this.scene.add(group);
      return group;
    }
    return null;
  }

  // Generate distant buildings far apart from each other across macro cells
  createBuildingInCell(bx, bz) {
    const bKey = `${bx},${bz}`;
    let bSeed = Math.abs(bx * 389271 ^ bz * 728931 ^ this.seed);
    const rng = () => {
      bSeed = (bSeed * 16807) % 2147483647;
      return (bSeed - 1) / 2147483646;
    };

    const bGrid = this.buildingGridSize;
    const originX = bx * bGrid;
    const originZ = bz * bGrid;

    // Position within macro cell
    const wx = originX + (rng() - 0.5) * (bGrid * 0.6);
    const wz = originZ + (rng() - 0.5) * (bGrid * 0.6);

    // Keep clear from player spawn and beacon
    if (Math.sqrt(wx * wx + wz * wz) < 35) return;

    const wy = this.getHeightAt(wx, wz);
    // Don't build inside water bodies
    if (wy < this.waterLevel + 0.4) return;

    const archetype = Math.floor(rng() * 3);
    const group = new THREE.Group();
    const rotY = rng() * Math.PI * 2;
    group.rotation.y = rotY;

    let collider = null;

    if (archetype === 0) {
      // Archetype 1: Sci-Fi Command Outpost (Two-story structure)
      const width = 14, height = 6.5, depth = 10;
      const baseGeo = new THREE.BoxGeometry(width, height, depth);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x465262,
        roughness: 0.65,
        metalness: 0.4,
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = height / 2;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      // Illuminated Entrance Portal
      const doorGeo = new THREE.BoxGeometry(3.0, 3.2, 0.4);
      const doorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 1.6, depth / 2 + 0.1);
      group.add(door);

      // Roof Antenna / Satellite Dish
      const dishGeo = new THREE.CylinderGeometry(1.8, 0.3, 0.6, 12);
      dishGeo.rotateX(Math.PI / 4);
      const dishMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.8 });
      const dish = new THREE.Mesh(dishGeo, dishMat);
      dish.position.set(3, height + 1.2, 0);
      group.add(dish);

      // Solar Array Wing
      const solarGeo = new THREE.BoxGeometry(5.0, 0.15, 3.0);
      const solarMat = new THREE.MeshStandardMaterial({ color: 0x112244, roughness: 0.2, metalness: 0.9 });
      const solar = new THREE.Mesh(solarGeo, solarMat);
      solar.position.set(-3.5, height + 0.5, 0);
      solar.rotation.z = 0.2;
      group.add(solar);

      group.position.set(wx, wy, wz);
      collider = {
        id: bKey,
        type: 'BOX',
        center: { x: wx, y: wy + height / 2, z: wz },
        size: { width, height, depth },
        rotationY: rotY,
      };

    } else if (archetype === 1) {
      // Archetype 2: Tall Watchtower / Relay Station
      const width = 8, height = 15, depth = 8;
      // Sturdy 4 corner support pillars
      const pillarGeo = new THREE.BoxGeometry(1.2, height, 1.2);
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.8, roughness: 0.4 });
      for (let px of [-3.2, 3.2]) {
        for (let pz of [-3.2, 3.2]) {
          const pillar = new THREE.Mesh(pillarGeo, metalMat);
          pillar.position.set(px, height / 2, pz);
          pillar.castShadow = true;
          group.add(pillar);
        }
      }

      // Observation Deck Cabin on top
      const deckGeo = new THREE.BoxGeometry(9.0, 3.5, 9.0);
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x5a636e, roughness: 0.5 });
      const deck = new THREE.Mesh(deckGeo, deckMat);
      deck.position.y = height - 1.5;
      deck.castShadow = true;
      group.add(deck);

      // Observation Windows Strip
      const winGeo = new THREE.BoxGeometry(9.2, 1.2, 9.2);
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.y = height - 1.5;
      group.add(win);

      // Beacon Light on top
      const beaconGeo = new THREE.SphereGeometry(0.8, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = height + 1.2;
      group.add(beacon);

      group.position.set(wx, wy, wz);
      collider = {
        id: bKey,
        type: 'BOX',
        center: { x: wx, y: wy + height / 2, z: wz },
        size: { width, height, depth },
        rotationY: rotY,
      };

    } else {
      // Archetype 3: Reinforced Military Depot / Warehouse
      const width = 16, height = 5.5, depth = 12;
      const baseGeo = new THREE.BoxGeometry(width, height, depth);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x3d434d,
        roughness: 0.7,
        metalness: 0.3,
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = height / 2;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      // Large Cargo Roller Door
      const bayGeo = new THREE.BoxGeometry(6.0, 4.0, 0.4);
      const bayMat = new THREE.MeshStandardMaterial({ color: 0x887755, metalness: 0.6 });
      const bay = new THREE.Mesh(bayGeo, bayMat);
      bay.position.set(0, 2.0, depth / 2 + 0.1);
      group.add(bay);

      // Yellow Hazard Warning Stripes above bay
      const stripeGeo = new THREE.BoxGeometry(6.2, 0.4, 0.45);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(0, 4.3, depth / 2 + 0.1);
      group.add(stripe);

      group.position.set(wx, wy, wz);
      collider = {
        id: bKey,
        type: 'BOX',
        center: { x: wx, y: wy + height / 2, z: wz },
        size: { width, height, depth },
        rotationY: rotY,
      };
    }

    this.scene.add(group);
    this.colliders.push(collider);
    this.buildings.set(bKey, { group, collider, key: bKey });
  }
}
