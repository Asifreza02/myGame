import * as THREE from 'three';
import { CRAFTING_RECIPES, POWERUPS, RESOURCES } from './config.js';
import { audio } from './audio.js';
import { loadGameModel, normalizeModel, setModelShadows, tintModelMaterials } from './modelAssets.js';
import { loadCollectibleTemplate, COLLECTIBLE_ASSET_CONFIG } from './collectibleModels.js';

function createResourceModels() {
  const material = (color, options = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.12,
    ...options,
  });
  const models = {};

  const essence = new THREE.Group();
  const essenceCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    material(0x7df5ff, { emissive: 0x12cce8, emissiveIntensity: 1.15, roughness: 0.2 }),
  );
  essence.add(essenceCore);
  const essenceHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.025, 5, 20),
    new THREE.MeshBasicMaterial({ color: 0x8dfaff }),
  );
  essenceHalo.rotation.x = Math.PI / 2.8;
  essence.add(essenceHalo);
  models.AETHER_ESSENCE = essence;

  const ore = new THREE.Group();
  ore.add(new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.36, 0),
    material(0x56423d, { roughness: 0.87 }),
  ));
  const oreGlowMaterial = material(0xff7437, {
    emissive: 0xd33412,
    emissiveIntensity: 1.1,
    roughness: 0.3,
  });
  [[-0.1, 0.13, 0.27], [0.2, -0.06, 0.2], [-0.2, -0.1, -0.2]].forEach(([x, y, z]) => {
    const fleck = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), oreGlowMaterial);
    fleck.position.set(x, y, z);
    ore.add(fleck);
  });
  models.EMBER_ORE = ore;

  const wood = new THREE.Group();
  const woodMaterial = material(0x81572f, { roughness: 0.84 });
  [[0, 0, 0, 0.5], [0.22, 0.04, 0.02, -0.8], [-0.2, 0.08, -0.02, 0.9]].forEach(
    ([x, y, z, rotation]) => {
      const twig = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.12, 0.62, 6),
        woodMaterial,
      );
      twig.position.set(x, y, z);
      twig.rotation.z = rotation;
      wood.add(twig);
    },
  );
  const barkBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.025, 5, 8),
    material(0xd1a86a),
  );
  barkBand.rotation.x = Math.PI / 2;
  wood.add(barkBand);
  models.IRONWOOD = wood;

  const herb = new THREE.Group();
  const stemMaterial = material(0x537b3d);
  const leafMaterial = material(0x81dc69, { roughness: 0.42 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.65, 5), stemMaterial);
  herb.add(stem);
  [-1, 1].forEach((side, index) => {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 7, 5),
      leafMaterial,
    );
    leaf.scale.set(0.65, 0.42, 1.3);
    leaf.position.set(side * 0.13, index === 0 ? 0.03 : -0.15, 0);
    leaf.rotation.z = side * -0.52;
    herb.add(leaf);
  });
  const bud = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 7, 6),
    material(0xd6f98b, { emissive: 0x5fae43, emissiveIntensity: 0.35 }),
  );
  bud.position.y = 0.36;
  herb.add(bud);
  models.MOON_HERB = herb;

  // Titanium Scrap
  const scrap = new THREE.Group();
  const scrapMat = material(0x9fb4c7, { metalness: 0.88, roughness: 0.28 });
  const nut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 6), scrapMat);
  nut1.rotation.x = Math.PI / 4;
  const nut2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.14), scrapMat);
  nut2.position.set(0.12, -0.05, 0.08);
  nut2.rotation.z = 0.6;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.26), scrapMat);
  plate.position.set(-0.08, -0.08, -0.06);
  scrap.add(nut1, nut2, plate);
  models.TITANIUM_SCRAP = scrap;

  // Crystal Lens
  const crystal = new THREE.Group();
  const crystalCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00a8d8,
      emissiveIntensity: 1.4,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.9,
    })
  );
  crystalCore.scale.set(0.8, 1.35, 0.8);
  crystal.add(crystalCore);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.022, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x8ef5ff })
  );
  ring.rotation.x = Math.PI / 3;
  crystal.add(ring);
  models.CRYSTAL_LENS = crystal;

  // Energy Cell
  const energyCell = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffe042,
    emissive: 0xff9900,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const capMat = material(0x2a323d, { metalness: 0.82, roughness: 0.3 });
  const cellCore = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.44, 12), coreMat);
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), capMat);
  topCap.position.y = 0.24;
  const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), capMat);
  botCap.position.y = -0.24;
  const energyBand = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.02, 6, 16), new THREE.MeshBasicMaterial({ color: 0xfff3a8 }));
  energyBand.rotation.x = Math.PI / 2;
  energyCell.add(cellCore, topCap, botCap, energyBand);
  models.ENERGY_CELL = energyCell;

  return models;
}

export class PowerUpManager {
  constructor(scene, worldManager, particles, onCollectCallback) {
    this.scene = scene;
    this.worldManager = worldManager;
    this.particles = particles;
    this.onCollectCallback = onCollectCallback;
    this.resources = new Map();
    this.spawnedChunks = new Set();
    this.resourceTypes = Object.keys(RESOURCES);
    this.resourceModels = createResourceModels();
    this.externalResourceModels = new Map();
    this.loadResourceModels();
    this.inventoryVersion = 0;
    this.inventory = {
      resources: Object.fromEntries(this.resourceTypes.map((type) => [type, 0])),
      items: Object.fromEntries(Object.keys(CRAFTING_RECIPES).map((type) => [type, 0])),
    };

    this.glowRingGeo = new THREE.RingGeometry(0.36, 0.72, 16);
    this.glowRingGeo.rotateX(-Math.PI / 2);
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  loadResourceModels() {
    const resourceTypes = Object.keys(RESOURCES);
    Promise.all(resourceTypes.map(async (type) => {
      try {
        const config = COLLECTIBLE_ASSET_CONFIG[type];
        const template = await loadCollectibleTemplate(type);
        return [type, { model: template, size: config?.scale || 0.85 }];
      } catch (error) {
        console.warn(`Could not load collectible 3D model for resource "${type}".`, error);
        return null;
      }
    })).then((loaded) => {
      for (const entry of loaded) {
        if (!entry) continue;
        const [type, asset] = entry;
        this.externalResourceModels.set(type, asset);
        for (const resource of this.resources.values()) {
          if (resource.type === type) this.replaceResourceModel(resource);
        }
      }
    });
  }

  createResourceItem(type) {
    const asset = this.externalResourceModels.get(type);
    if (!asset) return this.resourceModels[type].clone(true);

    const item = asset.model.clone(true);
    item.scale.setScalar(asset.size);
    return item;
  }

  replaceResourceModel(resource) {
    const nextItem = this.createResourceItem(resource.type);
    resource.mesh.remove(resource.itemMesh);
    resource.mesh.add(nextItem);
    resource.itemMesh = nextItem;
  }

  spawnResource(id, type, x, z) {
    const def = RESOURCES[type];
    if (!def) return null;

    const y = this.worldManager.getHeightAt(x, z) + 0.48;
    const resourceGroup = new THREE.Group();
    resourceGroup.position.set(x, y, z);
    const itemMesh = this.createResourceItem(type);
    resourceGroup.add(itemMesh);

    const ringMesh = new THREE.Mesh(
      this.glowRingGeo,
      new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      }),
    );
    ringMesh.position.y = -0.43;
    resourceGroup.add(ringMesh);
    this.group.add(resourceGroup);

    const resource = {
      id,
      type,
      mesh: resourceGroup,
      itemMesh,
      position: new THREE.Vector3(x, y, z),
      baseY: y,
      def,
      active: true,
      respawnTimer: 0,
      animOffset: Math.random() * Math.PI * 2,
    };
    this.resources.set(id, resource);
    return resource;
  }

  populateChunk(cx, cz) {
    const chunkKey = `${cx},${cz}`;
    if (this.spawnedChunks.has(chunkKey)) return;
    this.spawnedChunks.add(chunkKey);

    const chunkSize = this.worldManager.chunkSize;
    const originX = cx * chunkSize;
    const originZ = cz * chunkSize;
    let seed = Math.abs(cx * 15485863 ^ cz * 32452843 ^ this.worldManager.seed) || 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    if (rng() < 0.72) {
      const count = rng() > 0.82 ? 2 : 1;
      for (let index = 0; index < count; index += 1) {
        const x = originX + (rng() - 0.5) * (chunkSize - 8);
        const z = originZ + (rng() - 0.5) * (chunkSize - 8);
        if (Math.hypot(x, z) <= 24) continue;
        const biomeId = this.worldManager.getDominantBiome(x, z)?.id;
        const biomeResources = {
          LUSH: ['IRONWOOD', 'MOON_HERB'],
          DESERT: ['EMBER_ORE', 'AETHER_ESSENCE'],
          SNOW: ['AETHER_ESSENCE', 'MOON_HERB'],
          VOLCANIC: ['EMBER_ORE', 'IRONWOOD'],
        };
        const resourcePool = biomeResources[biomeId] || this.resourceTypes;
        const type = resourcePool[Math.floor(rng() * resourcePool.length)];
        this.spawnResource(`resource_${cx}_${cz}_${index}`, type, x, z);
      }
    }
  }

  update(dt, characters = [], elapsedTime = 0) {
    for (const [id, resource] of this.resources.entries()) {
      if (!resource.active) {
        if (resource.respawnTimer > 0) {
          resource.respawnTimer -= dt;
          if (resource.respawnTimer <= 0) {
            resource.active = true;
            resource.mesh.visible = true;
          }
        }
        continue;
      }

      resource.itemMesh.rotation.y += 1.1 * dt;
      resource.itemMesh.rotation.x = Math.sin(elapsedTime * 1.4 + resource.animOffset) * 0.08;
      resource.mesh.position.y = resource.baseY
        + Math.sin(elapsedTime * 2.4 + resource.animOffset) * 0.13;

      for (const character of characters) {
        if (!character || character.role !== 'runner' || !character.position) continue;
        const dx = character.position.x - resource.position.x;
        const dz = character.position.z - resource.position.z;
        if (dx * dx + dz * dz < 2.2 * 2.2) {
          this.collectResource(id, character);
          break;
        }
      }
    }
  }

  collectResource(id, character) {
    const resource = this.resources.get(id);
    if (!resource || !resource.active || character?.role !== 'runner') return false;

    resource.active = false;
    resource.mesh.visible = false;
    resource.respawnTimer = 45;
    this.inventory.resources[resource.type] += 1;
    this.inventoryVersion += 1;
    audio.playPowerupPickup();
    if (this.particles) {
      this.particles.emitPowerupBurst(resource.position, resource.def.color, 18);
    }
    if (this.onCollectCallback) {
      this.onCollectCallback(id, resource.type, character.role);
    }
    return true;
  }

  craft(recipeId) {
    const recipe = CRAFTING_RECIPES[recipeId];
    if (!recipe) return { success: false, reason: 'Unknown recipe.' };

    const missing = Object.entries(recipe.ingredients)
      .filter(([type, amount]) => this.inventory.resources[type] < amount)
      .map(([type, amount]) => `${RESOURCES[type].name} x${amount - this.inventory.resources[type]}`);
    if (missing.length > 0) {
      return { success: false, reason: `Need ${missing.join(', ')}.` };
    }

    Object.entries(recipe.ingredients).forEach(([type, amount]) => {
      this.inventory.resources[type] -= amount;
    });
    this.inventory.items[recipeId] += 1;
    this.inventoryVersion += 1;
    return { success: true, item: recipe };
  }

  useItem(itemId, character) {
    if (!POWERUPS[itemId] || !character || this.inventory.items[itemId] < 1) {
      return { success: false, reason: 'Craft this item first.' };
    }
    const def = POWERUPS[itemId];
    if (itemId === 'HEALTH' && character.health >= character.maxHealth) {
      return { success: false, reason: 'Health is already full.' };
    }

    if (itemId === 'SPEED') character.applySpeedBuff(def.duration, def.multiplier);
    if (itemId === 'JUMP') character.applyJumpBuff(def.duration, def.jumpForce);
    if (itemId === 'SHIELD') character.applyShield(def.duration);
    if (itemId === 'HEALTH') character.applyHealth(def.amount);
    this.inventory.items[itemId] -= 1;
    this.inventoryVersion += 1;
    return { success: true, item: CRAFTING_RECIPES[itemId] };
  }

  getInventory() {
    return {
      resources: { ...this.inventory.resources },
      items: { ...this.inventory.items },
    };
  }

  handleRemoteCollect(id) {
    const resource = this.resources.get(id);
    if (!resource || !resource.active) return;
    resource.active = false;
    resource.mesh.visible = false;
    resource.respawnTimer = 45;
    audio.playPowerupPickup();
    if (this.particles) {
      this.particles.emitPowerupBurst(resource.position, resource.def.color, 14);
    }
  }

  clear() {
    for (const resource of this.resources.values()) {
      this.group.remove(resource.mesh);
    }
    this.resources.clear();
    this.spawnedChunks.clear();
    this.inventory.resources = Object.fromEntries(this.resourceTypes.map((type) => [type, 0]));
    this.inventory.items = Object.fromEntries(
      Object.keys(CRAFTING_RECIPES).map((type) => [type, 0]),
    );
    this.inventoryVersion += 1;
  }
}
