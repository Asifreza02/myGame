import * as THREE from 'three';
import { SimplexNoise, getBiomeWeights } from './noise.js';
import { GAME_CONFIG, BIOMES } from './config.js';
import { loadGameModel, normalizeModel, scaleModelToSize, setModelShadows, tintModelMaterials } from './modelAssets.js';

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

    this.boundaryGroup = null;
    this.barrierMesh = null;
    this.barrierTexture = null;
    this.createWorldBoundary();

    // Materials
    this.terrainMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
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

    this.environmentModels = { trees: { LUSH: [], SNOW: [] }, rocks: {} };
    this.loadEnvironmentModels();
  }

  loadEnvironmentModels() {
    const specs = [
      { asset: 'tree', category: 'trees', biome: 'LUSH' },
      { asset: 'tree-tall', category: 'trees', biome: 'LUSH' },
      { asset: 'tree-autumn', category: 'trees', biome: 'SNOW', tint: 0xdce9f2 },
      { asset: 'tree-autumn-tall', category: 'trees', biome: 'SNOW', tint: 0xdce9f2 },
      ...['rock-a', 'rock-b', 'rock-c'].map((asset) => ({
        asset,
        category: 'rocks',
        biome: 'LUSH',
        tint: 0xcac6c1,
      })),
      ...['rock-a', 'rock-b', 'rock-flat'].map((asset) => ({
        asset,
        category: 'rocks',
        biome: 'SNOW',
        tint: 0xdce8ef,
      })),
      ...['rock-sand-a', 'rock-sand-b', 'rock-sand-c'].map((asset) => ({
        asset,
        category: 'rocks',
        biome: 'DESERT',
        tint: 0xe9b994,
      })),
      ...['rock-a', 'rock-c', 'rock-flat'].map((asset) => ({
        asset,
        category: 'rocks',
        biome: 'VOLCANIC',
        tint: 0x403b3b,
      })),
    ];

    Promise.all(specs.map(async (spec) => {
      try {
        const model = normalizeModel(await loadGameModel(spec.asset));
        if (spec.tint) tintModelMaterials(model, spec.tint);
        setModelShadows(model);
        return { ...spec, model };
      } catch (error) {
        console.warn(`Could not load environment model "${spec.asset}".`, error);
        return null;
      }
    })).then((loaded) => {
      for (const entry of loaded) {
        if (!entry) continue;
        this.environmentModels[entry.category][entry.biome] ||= [];
        this.environmentModels[entry.category][entry.biome].push(entry.model);
      }
      this.refreshChunkProps();
    });
  }

  refreshChunkProps() {
    for (const [key, chunk] of this.chunks.entries()) {
      if (chunk.propsGroup) this.scene.remove(chunk.propsGroup);
      for (const collider of chunk.colliders || []) {
        const colliderIndex = this.colliders.indexOf(collider);
        if (colliderIndex !== -1) this.colliders.splice(colliderIndex, 1);
      }

      const [cx, cz] = key.split(',').map(Number);
      chunk.propsGroup = this.createChunkProps(cx, cz);
      chunk.colliders = chunk.propsGroup ? chunk.propsGroup.userData.colliders : [];
    }
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
    return getBiomeWeights(this.noise, x, z);
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
    if (this.barrierTexture && this.barrierMesh) {
      this.barrierTexture.offset.y = -(time * 0.04) % 1;
      this.barrierMesh.material.opacity = 0.28 + Math.sin(time * 2.2) * 0.07;
    }

    // Ripple water on active chunks (low overhead)
    for (const [key, chunk] of this.chunks.entries()) {
      if (chunk.waterMesh) {
        const [cxStr, czStr] = key.split(',');
        const cx = parseFloat(cxStr);
        const cz = parseFloat(czStr);
        chunk.waterMesh.position.y = this.waterLevel + Math.sin(time * 2.5 + cx * 0.7 + cz * 0.7) * 0.04;
      }
    }

    // Throttle chunk and building streaming checks to run at ~3Hz (every 300ms)
    // Eliminates thousands of key string allocations and set operations every frame!
    if (time - (this.lastStreamTime || 0) < 0.3) {
      return;
    }
    this.lastStreamTime = time;

    const activeChunkKeys = new Set();
    const activeBuildingKeys = new Set();

    // Focus streaming on primary players (player & camera)
    const primaryPositions = (focusPositions || []).slice(0, 2);

    // 1. Chunks Streaming
    for (const pos of primaryPositions) {
      if (!pos) continue;
      const centerCX = Math.floor(pos.x / this.chunkSize);
      const centerCZ = Math.floor(pos.z / this.chunkSize);

      for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
        for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
          const cx = centerCX + dx;
          const cz = centerCZ + dz;
          const minX = cx * this.chunkSize;
          const minZ = cz * this.chunkSize;
          const closestX = THREE.MathUtils.clamp(0, minX, minX + this.chunkSize);
          const closestZ = THREE.MathUtils.clamp(0, minZ, minZ + this.chunkSize);
          if (Math.hypot(closestX, closestZ) > GAME_CONFIG.WORLD.RADIUS) continue;
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
      }
    }

    // Unload distant buildings
    for (const [bKey, bld] of this.buildings.entries()) {
      if (!activeBuildingKeys.has(bKey)) {
        this.scene.remove(bld.group);
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
          const rx = 5.0 + rng() * 6.0;
          const ry = 4.0 + rng() * 5.0;
          const rz = 5.0 + rng() * 6.0;
          const rockModels = this.environmentModels.rocks[dominantBiome.id] || [];
          let fallbackRockMaterial = this.bigRockMat;
          if (dominantBiome === BIOMES.DESERT) fallbackRockMaterial = this.desertRockMat;
          else if (dominantBiome === BIOMES.SNOW) fallbackRockMaterial = this.snowRockMat;
          else if (dominantBiome === BIOMES.VOLCANIC) fallbackRockMaterial = this.obsidianMat;
          const rockMesh = rockModels.length > 0
            ? rockModels[Math.floor(rng() * rockModels.length)].clone(true)
            : new THREE.Mesh(this.bigRockGeo, fallbackRockMaterial);
          if (rockModels.length > 0) {
            scaleModelToSize(rockMesh, rx * 2, ry * 2, rz * 2);
          } else {
            rockMesh.scale.set(rx, ry, rz);
          }

          const rotY = rng() * Math.PI * 2;
          rockMesh.rotation.set(rng() * 0.2, rotY, rng() * 0.2);
          rockMesh.position.set(wx, wy + (rockModels.length > 0 ? 0 : ry), wz);
          rockMesh.castShadow = false;
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

      if (dominantBiome === BIOMES.LUSH || dominantBiome === BIOMES.SNOW) {
        const treeModels = this.environmentModels.trees[dominantBiome.id] || [];
        const tree = treeModels.length > 0
          ? treeModels[Math.floor(rng() * treeModels.length)].clone(true)
          : new THREE.Group();
        const s = dominantBiome === BIOMES.SNOW
          ? 0.8 + rng() * 0.6
          : 0.7 + rng() * 0.5;

        if (treeModels.length > 0) {
          tree.scale.setScalar(5.35 * s);
        } else {
          const trunk = new THREE.Mesh(this.trunkGeo, this.trunkMat);
          trunk.position.y = 1.5;
          trunk.castShadow = false;
          tree.add(trunk);
          const foliage = new THREE.Mesh(
            this.foliageGeo,
            dominantBiome === BIOMES.SNOW ? this.snowFoliageMat : this.foliageMat,
          );
          foliage.position.y = 3.6;
          foliage.castShadow = false;
          tree.add(foliage);
          tree.scale.set(s, s, s);
        }

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
        // Sandstone scrub uses the pack's varied desert rock meshes.
        const rockModels = this.environmentModels.rocks.DESERT || [];
        const shrubWidth = 2.2 + rng() * 1.4;
        const shrubHeight = 2.4 + rng() * 1.6;
        const shrubDepth = 2.2 + rng() * 1.4;
        const shrub = rockModels.length > 0
          ? rockModels[Math.floor(rng() * rockModels.length)].clone(true)
          : new THREE.Mesh(this.bigRockGeo, this.desertShrubMat);
        if (rockModels.length > 0) {
          scaleModelToSize(shrub, shrubWidth, shrubHeight, shrubDepth);
          shrub.position.set(wx, wy, wz);
        } else {
          shrub.scale.set(shrubWidth / 1.8, shrubHeight / 1.8, shrubDepth / 1.8);
          shrub.position.set(wx, wy + shrubHeight / 2, wz);
        }
        group.add(shrub);
        const collider = {
          id: `shrub_${cx}_${cz}_${i}`,
          type: 'CYLINDER',
          center: { x: wx, y: wy + shrubHeight / 2, z: wz },
          radius: Math.max(shrubWidth, shrubDepth) * 0.5,
          height: shrubHeight,
        };
        this.colliders.push(collider);
        group.userData.colliders.push(collider);
      } else if (dominantBiome === BIOMES.VOLCANIC) {
        // Glowing magma vent with a dark basalt rock base.
        const rockModels = this.environmentModels.rocks.VOLCANIC || [];
        const vent = rockModels.length > 0
          ? rockModels[Math.floor(rng() * rockModels.length)].clone(true)
          : new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 1.2, 6), this.obsidianMat);
        if (rockModels.length > 0) {
          scaleModelToSize(vent, 2.8, 1.2, 2.8);
          vent.position.set(wx, wy, wz);
        } else {
          vent.position.set(wx, wy + 0.6, wz);
        }
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

    if (Math.hypot(wx, wz) > GAME_CONFIG.WORLD.RADIUS - 20) return;

    // Keep clear from the player spawn
    if (Math.sqrt(wx * wx + wz * wz) < 35) return;

    const wy = this.getHeightAt(wx, wz);
    // Don't build inside water bodies
    if (wy < this.waterLevel + 0.4) return;

    const archetype = Math.floor(rng() * 6);
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

    } else if (archetype === 2) {
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

    } else if (archetype === 3) {
      // Archetype 4: Colony Habitation House (Cyber-Bungalow)
      const width = 11, height = 4.8, depth = 9;
      const houseGeo = new THREE.BoxGeometry(width, height, depth);
      const houseMat = new THREE.MeshStandardMaterial({
        color: 0x424b54,
        roughness: 0.65,
        metalness: 0.35,
      });
      const houseMesh = new THREE.Mesh(houseGeo, houseMat);
      houseMesh.position.y = height / 2;
      houseMesh.castShadow = true;
      houseMesh.receiveShadow = true;
      group.add(houseMesh);

      // Sloped Peaked Roof
      const roofGeo = new THREE.BoxGeometry(width + 0.8, 1.4, depth + 0.8);
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x222c36,
        roughness: 0.5,
        metalness: 0.6,
      });
      const roofMesh = new THREE.Mesh(roofGeo, roofMat);
      roofMesh.position.y = height + 0.7;
      roofMesh.castShadow = true;
      group.add(roofMesh);

      // Front Porch Deck
      const porchGeo = new THREE.BoxGeometry(9.0, 0.4, 3.2);
      const porchMat = new THREE.MeshStandardMaterial({ color: 0x5a483a, roughness: 0.85 });
      const porch = new THREE.Mesh(porchGeo, porchMat);
      porch.position.set(0, 0.2, depth / 2 + 1.6);
      porch.receiveShadow = true;
      group.add(porch);

      // Porch Columns
      const colGeo = new THREE.BoxGeometry(0.35, 3.8, 0.35);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x333b44, metalness: 0.7 });
      for (const cx of [-4.0, 4.0]) {
        const col = new THREE.Mesh(colGeo, colMat);
        col.position.set(cx, 1.9, depth / 2 + 3.0);
        col.castShadow = true;
        group.add(col);
      }

      // Porch Awning
      const awningGeo = new THREE.BoxGeometry(9.4, 0.25, 3.4);
      const awning = new THREE.Mesh(awningGeo, roofMat);
      awning.position.set(0, 3.9, depth / 2 + 1.7);
      awning.castShadow = true;
      group.add(awning);

      // Front Entrance Door
      const doorGeo = new THREE.BoxGeometry(2.2, 3.2, 0.35);
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x1a2634, metalness: 0.8 });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 1.6, depth / 2 + 0.1);
      group.add(door);

      // Electronic Keypad
      const padGeo = new THREE.BoxGeometry(0.3, 0.45, 0.1);
      const padMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(1.4, 1.6, depth / 2 + 0.2);
      group.add(pad);

      // Warm Glowing Windows
      const winGeo = new THREE.BoxGeometry(2.0, 1.4, 0.35);
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
      for (const wx of [-3.2, 3.2]) {
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(wx, 2.2, depth / 2 + 0.1);
        group.add(win);
      }
      const sideWinGeo = new THREE.BoxGeometry(0.35, 1.4, 2.0);
      for (const sx of [-width / 2 - 0.1, width / 2 + 0.1]) {
        const sw = new THREE.Mesh(sideWinGeo, winMat);
        sw.position.set(sx, 2.2, 0);
        group.add(sw);
      }

      // Porch Supply Crate / Loot Stash
      const crateGeo = new THREE.BoxGeometry(1.6, 1.0, 1.0);
      const crateMat = new THREE.MeshStandardMaterial({ color: 0x2e4438, metalness: 0.6, roughness: 0.4 });
      const crate = new THREE.Mesh(crateGeo, crateMat);
      crate.position.set(-2.8, 0.7, depth / 2 + 2.0);
      crate.castShadow = true;
      group.add(crate);

      // Crate Glowing Latch
      const latchGeo = new THREE.BoxGeometry(0.4, 0.2, 0.15);
      const latchMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
      const latch = new THREE.Mesh(latchGeo, latchMat);
      latch.position.set(-2.8, 0.9, depth / 2 + 2.52);
      group.add(latch);

      // Roof Chimney / Air Filtration Unit
      const ventGeo = new THREE.BoxGeometry(1.4, 2.2, 1.4);
      const ventMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.8 });
      const vent = new THREE.Mesh(ventGeo, ventMat);
      vent.position.set(3.0, height + 1.8, -2.0);
      vent.castShadow = true;
      group.add(vent);

      group.position.set(wx, wy, wz);
      collider = {
        id: bKey,
        type: 'BOX',
        center: { x: wx, y: wy + height / 2, z: wz },
        size: { width: width + 2, height, depth: depth + 3 },
        rotationY: rotY,
      };

    } else if (archetype === 4) {
      // Archetype 5: Frontier Settlement Twin-Cabin (Duplex)
      const uAWidth = 8, uAHeight = 4.8, uADepth = 8;
      const cabinMat = new THREE.MeshStandardMaterial({ color: 0x4f433a, roughness: 0.8 });
      const unitAGeo = new THREE.BoxGeometry(uAWidth, uAHeight, uADepth);
      const unitA = new THREE.Mesh(unitAGeo, cabinMat);
      unitA.position.set(-5, uAHeight / 2, 0);
      unitA.castShadow = true;
      unitA.receiveShadow = true;
      group.add(unitA);

      const uBWidth = 6.5, uBHeight = 4.0, uBDepth = 6.5;
      const workshopMat = new THREE.MeshStandardMaterial({ color: 0x38414a, roughness: 0.6, metalness: 0.4 });
      const unitBGeo = new THREE.BoxGeometry(uBWidth, uBHeight, uBDepth);
      const unitB = new THREE.Mesh(unitBGeo, workshopMat);
      unitB.position.set(5, uBHeight / 2, 0);
      unitB.castShadow = true;
      unitB.receiveShadow = true;
      group.add(unitB);

      const bridgeGeo = new THREE.BoxGeometry(4.0, 3.4, 3.8);
      const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x2e353d, metalness: 0.6 });
      const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
      bridge.position.set(0, 1.7, 0);
      bridge.castShadow = true;
      group.add(bridge);

      const roofMat = new THREE.MeshStandardMaterial({ color: 0x1f2730, metalness: 0.8, roughness: 0.3 });
      const roofAGeo = new THREE.BoxGeometry(uAWidth + 0.6, 1.2, uADepth + 0.6);
      const roofA = new THREE.Mesh(roofAGeo, roofMat);
      roofA.position.set(-5, uAHeight + 0.6, 0);
      roofA.castShadow = true;
      group.add(roofA);

      const roofBGeo = new THREE.BoxGeometry(uBWidth + 0.6, 1.2, uBDepth + 0.6);
      const roofB = new THREE.Mesh(roofBGeo, roofMat);
      roofB.position.set(5, uBHeight + 0.6, 0);
      roofB.castShadow = true;
      group.add(roofB);

      const winMat = new THREE.MeshBasicMaterial({ color: 0xffbb44 });
      const winA = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.3), winMat);
      winA.position.set(-5, 2.2, uADepth / 2 + 0.1);
      group.add(winA);

      const winB = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.3), winMat);
      winB.position.set(5, 2.0, uBDepth / 2 + 0.1);
      group.add(winB);

      const barrelGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.3, 10);
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0x6e5239, roughness: 0.7 });
      for (const bx of [-1.5, 1.5]) {
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(bx, 0.65, 2.5);
        barrel.castShadow = true;
        group.add(barrel);
      }

      group.position.set(wx, wy, wz);
      collider = {
        id: bKey,
        type: 'BOX',
        center: { x: wx, y: wy + uAHeight / 2, z: wz },
        size: { width: 17, height: uAHeight, depth: 10 },
        rotationY: rotY,
      };

    } else {
      // Archetype 5: Aether Loot Station / Requisition Depot
      const padRadius = 7.5;
      const padHeight = 1.2;
      const padGeo = new THREE.CylinderGeometry(padRadius, padRadius + 0.4, padHeight, 8);
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x222a35,
        roughness: 0.4,
        metalness: 0.8,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.y = padHeight / 2;
      pad.receiveShadow = true;
      group.add(pad);

      const rimGeo = new THREE.TorusGeometry(padRadius, 0.25, 6, 8);
      rimGeo.rotateX(Math.PI / 2);
      const rimMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.y = padHeight + 0.05;
      group.add(rim);

      const legGeo = new THREE.BoxGeometry(1.2, 4.0, 1.2);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x181e26, metalness: 0.9 });
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(Math.cos(ang) * 5.8, -1.0, Math.sin(ang) * 5.8);
        leg.castShadow = true;
        group.add(leg);
      }

      const rampGeo = new THREE.BoxGeometry(3.5, 0.4, 4.5);
      rampGeo.rotateX(0.22);
      const ramp = new THREE.Mesh(rampGeo, padMat);
      ramp.position.set(0, 0.35, padRadius + 1.8);
      ramp.receiveShadow = true;
      group.add(ramp);

      const corePedestal = new THREE.CylinderGeometry(1.6, 2.0, 2.2, 8);
      const coreMat = new THREE.MeshStandardMaterial({ color: 0x152230, metalness: 0.9, roughness: 0.3 });
      const core = new THREE.Mesh(corePedestal, coreMat);
      core.position.y = padHeight + 1.1;
      core.castShadow = true;
      group.add(core);

      const ringCore = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.2, 8), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      ringCore.position.y = padHeight + 1.9;
      group.add(ringCore);

      // Rotating Holographic Loot Diamond
      const holoGeo = new THREE.OctahedronGeometry(1.3, 0);
      const holoMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
      });
      const holo = new THREE.Mesh(holoGeo, holoMat);
      holo.position.y = padHeight + 3.2;
      group.add(holo);

      const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
      innerCore.position.y = padHeight + 3.2;
      group.add(innerCore);

      // Supply Lockers
      const lockerGeo = new THREE.BoxGeometry(1.8, 2.6, 1.0);
      const lockerMat = new THREE.MeshStandardMaterial({ color: 0x2d3a4b, metalness: 0.7, roughness: 0.4 });
      const lockerGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const lx = Math.cos(ang) * 4.6;
        const lz = Math.sin(ang) * 4.6;
        const locker = new THREE.Mesh(lockerGeo, lockerMat);
        locker.position.set(lx, padHeight + 1.3, lz);
        locker.rotation.y = -ang + Math.PI / 2;
        locker.castShadow = true;
        group.add(locker);

        const strip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.1), lockerGlowMat);
        strip.position.set(0, 0.6, 0.52);
        locker.add(strip);
      }

      // Sky Beacon Light Beam (Visible from afar across the 1km world)
      const beamGeo = new THREE.CylinderGeometry(0.5, 1.4, 100, 12, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = padHeight + 52;
      group.add(beam);

      group.position.set(wx, wy, wz);
      collider = {
        id: bKey,
        type: 'BOX',
        center: { x: wx, y: wy + padHeight + 1.2, z: wz },
        size: { width: 14, height: 5, depth: 14 },
        rotationY: rotY,
      };
    }

    this.scene.add(group);
    this.colliders.push(collider);
    this.buildings.set(bKey, { group, collider, key: bKey });
  }

  // 1km World Boundary Forcefield Cylinder & Perimeter Monoliths
  createWorldBoundary() {
    const boundaryRadius = GAME_CONFIG.WORLD.RADIUS || 1000;
    const boundaryGroup = new THREE.Group();

    // 1. Cylindrical Energy Shield Wall (1000m radius, 140m height)
    const barrierGeo = new THREE.CylinderGeometry(boundaryRadius, boundaryRadius, 140, 80, 1, true);

    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let barrierTexture = null;
    if (canvas) {
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(2, 12, 22, 0.2)';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      for (let y = 0; y < 512; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.2;
      for (let x = 0; x < 512; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      barrierTexture = new THREE.CanvasTexture(canvas);
      barrierTexture.wrapS = THREE.RepeatWrapping;
      barrierTexture.wrapT = THREE.RepeatWrapping;
      barrierTexture.repeat.set(48, 4);
    }

    const barrierMat = new THREE.MeshBasicMaterial({
      map: barrierTexture,
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
    barrierMesh.position.y = 65;
    boundaryGroup.add(barrierMesh);
    this.barrierMesh = barrierMesh;
    this.barrierTexture = barrierTexture;

    // 2. Glowing Ground Perimeter Ring
    const ringGeo = new THREE.RingGeometry(boundaryRadius - 6, boundaryRadius + 2, 96);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 1.2;
    boundaryGroup.add(ringMesh);

    // 3. 8 Perimeter Energy Pylons
    const pylonGeo = new THREE.BoxGeometry(4.5, 36, 4.5);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1f2732, metalness: 0.85, roughness: 0.3 });
    const runeGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const px = Math.cos(angle) * (boundaryRadius - 2);
      const pz = Math.sin(angle) * (boundaryRadius - 2);
      const py = this.getHeightAt(px, pz);

      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(px, py + 18, pz);
      pylon.castShadow = true;
      boundaryGroup.add(pylon);

      // Glowing rune strip
      const strip = new THREE.Mesh(new THREE.BoxGeometry(4.7, 28, 0.4), runeGlowMat);
      strip.position.set(px, py + 18, pz);
      strip.rotation.y = -angle;
      boundaryGroup.add(strip);

      // Sky beam from pylon
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.8, 140, 12, 1, true), beamMat);
      beam.position.set(px, py + 88, pz);
      boundaryGroup.add(beam);
    }

    this.scene.add(boundaryGroup);
    this.boundaryGroup = boundaryGroup;
  }
}
