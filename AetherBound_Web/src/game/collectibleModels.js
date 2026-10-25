import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ITEM_DEFINITIONS } from './data/combat.js';
import { RESOURCE_DEFINITIONS } from './data/world.js';

const loader = new GLTFLoader();
const modelTemplateCache = new Map();
const loadPromises = new Map();

export const COLLECTIBLE_ASSET_CONFIG = {
  HEALTH: {
    modelUrl: '/models/collectibles/survival/bottle.glb',
    scale: 0.95,
    tint: 0xff3860,
    emissive: 0xaa0033,
    emissiveIntensity: 0.85,
    spinSpeed: 1.8,
    bobSpeed: 2.8,
    bobHeight: 0.16,
    hasBeam: true,
    beamColor: 0xff4f7e,
    beamHeight: 3.8,
    groundColor: 0xff4f7e,
    name: 'Vitality Draught',
  },
  SPEED: {
    modelUrl: '/models/collectibles/platformer/star.glb',
    scale: 0.88,
    tint: 0xffea00,
    emissive: 0xbb8800,
    emissiveIntensity: 0.8,
    spinSpeed: 2.4,
    bobSpeed: 3.4,
    bobHeight: 0.18,
    hasBeam: true,
    beamColor: 0xffdf46,
    beamHeight: 3.8,
    groundColor: 0xffdf46,
    name: 'Windrunner Boots',
  },
  RECON: {
    modelUrl: '/models/collectibles/space/satelliteDish.glb',
    scale: 0.92,
    tint: 0xa56aff,
    emissive: 0x5a18b8,
    emissiveIntensity: 0.75,
    spinSpeed: 1.4,
    bobSpeed: 2.2,
    bobHeight: 0.14,
    hasBeam: true,
    beamColor: 0xa56aff,
    beamHeight: 4.2,
    groundColor: 0xa56aff,
    name: 'Seeker Pulse',
  },
  HAZARD: {
    modelUrl: '/models/collectibles/weapon/grenade.glb',
    scale: 1.05,
    tint: 0xff7b29,
    emissive: 0x992800,
    emissiveIntensity: 0.65,
    spinSpeed: 1.6,
    bobSpeed: 2.5,
    bobHeight: 0.14,
    hasBeam: true,
    beamColor: 0xff8038,
    beamHeight: 3.6,
    groundColor: 0xff8038,
    name: 'Snare Mine',
  },
  SHIELD: {
    modelUrl: '/models/collectibles/mini-dungeon/shield-round.glb',
    scale: 0.95,
    tint: 0x39d9ff,
    emissive: 0x006699,
    emissiveIntensity: 0.85,
    spinSpeed: 1.7,
    bobSpeed: 2.4,
    bobHeight: 0.15,
    hasBeam: true,
    beamColor: 0x39d9ff,
    beamHeight: 4.0,
    groundColor: 0x39d9ff,
    name: 'Aegis Ward',
  },
  AETHER_ESSENCE: {
    modelUrl: '/models/collectibles/tower-defense/detail-crystal-large.glb',
    scale: 0.96,
    tint: 0x55eaff,
    emissive: 0x0099cc,
    emissiveIntensity: 1.1,
    spinSpeed: 1.6,
    bobSpeed: 2.6,
    bobHeight: 0.18,
    hasBeam: true,
    beamColor: 0x55eaff,
    beamHeight: 3.5,
    groundColor: 0x55eaff,
    name: 'Aether Essence',
  },
  EMBER_ORE: {
    modelUrl: '/models/collectibles/survival/resource-stone-large.glb',
    scale: 0.88,
    tint: 0xff7138,
    emissive: 0xcc3300,
    emissiveIntensity: 0.95,
    spinSpeed: 1.2,
    bobSpeed: 2.0,
    bobHeight: 0.13,
    hasBeam: false,
    beamColor: 0xff7138,
    groundColor: 0xff7138,
    name: 'Ember Ore',
  },
  IRONWOOD: {
    modelUrl: '/models/collectibles/survival/resource-wood.glb',
    scale: 1.05,
    tint: 0xb58a54,
    emissive: 0x3d240c,
    emissiveIntensity: 0.35,
    spinSpeed: 1.1,
    bobSpeed: 1.8,
    bobHeight: 0.12,
    hasBeam: false,
    beamColor: 0xb58a54,
    groundColor: 0xb58a54,
    name: 'Ironwood',
  },
  MOON_HERB: {
    modelUrl: '/models/collectibles/survival/grass-large.glb',
    scale: 1.1,
    tint: 0x83e879,
    emissive: 0x228833,
    emissiveIntensity: 0.7,
    spinSpeed: 1.3,
    bobSpeed: 2.2,
    bobHeight: 0.14,
    hasBeam: false,
    beamColor: 0x83e879,
    groundColor: 0x83e879,
    name: 'Moon Herb',
  },
  TITANIUM_SCRAP: {
    modelUrl: '/models/collectibles/factory/cog-b.glb',
    scale: 0.9,
    tint: 0x8ea2b8,
    emissive: 0x28425a,
    emissiveIntensity: 0.45,
    spinSpeed: 2.0,
    bobSpeed: 2.0,
    bobHeight: 0.13,
    hasBeam: false,
    beamColor: 0x8ea2b8,
    groundColor: 0x8ea2b8,
    name: 'Titanium Scrap',
  },
  CRYSTAL_LENS: {
    modelUrl: '/models/collectibles/platformer/jewel.glb',
    scale: 0.84,
    tint: 0x00f0ff,
    emissive: 0x0088cc,
    emissiveIntensity: 1.15,
    spinSpeed: 2.2,
    bobSpeed: 3.0,
    bobHeight: 0.18,
    hasBeam: true,
    beamColor: 0x00f0ff,
    beamHeight: 4.2,
    groundColor: 0x00f0ff,
    name: 'Crystal Lens',
  },
  ENERGY_CELL: {
    modelUrl: '/models/collectibles/space-station/container-tall.glb',
    scale: 0.82,
    tint: 0xffe042,
    emissive: 0xaa7700,
    emissiveIntensity: 0.95,
    spinSpeed: 1.8,
    bobSpeed: 2.4,
    bobHeight: 0.15,
    hasBeam: true,
    beamColor: 0xffe042,
    beamHeight: 3.8,
    groundColor: 0xffe042,
    name: 'Energy Cell',
  },
  KINETIC_AMMO: {
    modelUrl: '/models/collectibles/weapon/ammo_machinegun.glb',
    scale: 0.76,
    tint: 0xd49b42,
    emissive: 0x664400,
    emissiveIntensity: 0.5,
    spinSpeed: 1.5,
    bobSpeed: 2.1,
    bobHeight: 0.13,
    hasBeam: false,
    beamColor: 0xd49b42,
    groundColor: 0xd49b42,
    name: 'Blaster Energy Pack',
  },
  ENERGY_AMMO: {
    modelUrl: '/models/collectibles/weapon/ammo_sniper.glb',
    scale: 0.8,
    tint: 0x39ffff,
    emissive: 0x008899,
    emissiveIntensity: 0.8,
    spinSpeed: 1.7,
    bobSpeed: 2.5,
    bobHeight: 0.15,
    hasBeam: true,
    beamColor: 0x39ffff,
    beamHeight: 3.8,
    groundColor: 0x39ffff,
    name: 'Prismatic Cell Pack',
  },
  CHEST: {
    modelUrl: '/models/collectibles/survival/chest.glb',
    scale: 1.1,
    tint: 0xffaa22,
    emissive: 0x553300,
    emissiveIntensity: 0.45,
    spinSpeed: 0.9,
    bobSpeed: 1.6,
    bobHeight: 0.1,
    hasBeam: true,
    beamColor: 0xffaa22,
    beamHeight: 5.0,
    groundColor: 0xffaa22,
    name: 'Aether Supply Cache',
  },
};

// Normalize and center model around (0, 0, 0)
function normalizeAndCenter(scene) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(scene);
  root.add(inner);
  inner.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(inner);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
  const fitScale = 1 / maxDim;

  inner.scale.setScalar(fitScale);
  inner.position.set(
    -center.x * fitScale,
    -center.y * fitScale,
    -center.z * fitScale,
  );
  return root;
}

export function loadCollectibleTemplate(type) {
  if (modelTemplateCache.has(type)) {
    return Promise.resolve(modelTemplateCache.get(type));
  }
  if (loadPromises.has(type)) {
    return loadPromises.get(type);
  }

  const config = COLLECTIBLE_ASSET_CONFIG[type];
  if (!config?.modelUrl) {
    return Promise.reject(new Error(`No asset config for collectible type: ${type}`));
  }

  const promise = new Promise((resolve, reject) => {
    loader.load(
      config.modelUrl,
      (gltf) => {
        const normalized = normalizeAndCenter(gltf.scene);

        // Apply realistic PBR styling, shadows, and subtle emissive glow
        const tintColor = config.tint ? new THREE.Color(config.tint) : null;
        const emissiveColor = config.emissive ? new THREE.Color(config.emissive) : null;

        normalized.traverse((node) => {
          if (!node.isMesh) return;
          node.castShadow = true;
          node.receiveShadow = false;

          const enhanceMaterial = (mat) => {
            const m = mat.clone();
            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
            m.roughness = Math.min(m.roughness ?? 0.6, 0.72);
            m.metalness = Math.max(m.metalness ?? 0.2, 0.18);
            if (tintColor && m.color) {
              m.color.lerp(tintColor, 0.35);
            }
            if (emissiveColor) {
              m.emissive = emissiveColor.clone();
              m.emissiveIntensity = config.emissiveIntensity ?? 0.6;
            }
            return m;
          };

          node.material = Array.isArray(node.material)
            ? node.material.map(enhanceMaterial)
            : enhanceMaterial(node.material);
        });

        modelTemplateCache.set(type, normalized);
        resolve(normalized);
      },
      undefined,
      (err) => {
        console.warn(`Could not load collectible 3D model for "${type}" from ${config.modelUrl}:`, err);
        reject(err);
      }
    );
  });

  loadPromises.set(type, promise);
  return promise;
}

export function preloadAllCollectibleModels() {
  const types = Object.keys(COLLECTIBLE_ASSET_CONFIG);
  return Promise.allSettled(types.map((t) => loadCollectibleTemplate(t)));
}

// Shared Geometries for visual rings and beams
const sharedGlowRingGeo = new THREE.RingGeometry(0.45, 0.85, 24);
sharedGlowRingGeo.rotateX(-Math.PI / 2);

const sharedHaloGeo = new THREE.TorusGeometry(0.55, 0.024, 8, 28);
const sharedBeamGeo = new THREE.CylinderGeometry(0.08, 0.38, 3.8, 16, 1, true);

/**
 * Creates a rich, realistic 3D collectible entity with ground runes,
 * light beam for rare/abilities, orbiting energy halo, and loaded GLB model.
 */
export function createCollectibleEntity(item, worldY) {
  const type = item.type;
  const config = COLLECTIBLE_ASSET_CONFIG[type] || {
    scale: 0.9,
    spinSpeed: 1.6,
    bobSpeed: 2.4,
    bobHeight: 0.15,
    hasBeam: item.rarity === 'Rare',
    beamColor: 0x55eaff,
    beamHeight: 3.5,
    groundColor: 0x55eaff,
  };

  const group = new THREE.Group();
  const floatingGroup = new THREE.Group();
  group.add(floatingGroup);

  const definition = ITEM_DEFINITIONS[type] || RESOURCE_DEFINITIONS[type];
  const themeColor = config.beamColor || definition?.color || 0x55eaff;

  // 1. Ground Projector Rune Ring
  const groundMat = new THREE.MeshBasicMaterial({
    color: config.groundColor || themeColor,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const groundRing = new THREE.Mesh(sharedGlowRingGeo, groundMat);
  groundRing.position.y = 0.08;
  group.add(groundRing);

  // 2. Vertical Light Pillar Beacon (High-tier items / Abilities / Crystals)
  let lightBeam = null;
  if (config.hasBeam || item.rarity === 'Rare' || item.rarity === 'Uncommon') {
    const beamHeight = config.beamHeight || (item.rarity === 'Rare' ? 4.5 : 3.5);
    const beamMat = new THREE.MeshBasicMaterial({
      color: themeColor,
      transparent: true,
      opacity: item.rarity === 'Rare' ? 0.32 : 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    lightBeam = new THREE.Mesh(sharedBeamGeo, beamMat);
    lightBeam.scale.set(1, beamHeight / 3.8, 1);
    lightBeam.position.y = beamHeight * 0.5;
    group.add(lightBeam);
  }

  // 3. Orbiting Energy Halo
  const haloMat = new THREE.MeshBasicMaterial({
    color: themeColor,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(sharedHaloGeo, haloMat);
  halo.rotation.x = Math.PI / 3;
  floatingGroup.add(halo);

  // 4. Fallback Stylized Shape (shown immediately while async GLB loads)
  const placeholderMat = new THREE.MeshStandardMaterial({
    color: themeColor,
    emissive: themeColor,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.4,
  });
  const placeholder = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), placeholderMat);
  placeholder.scale.setScalar(config.scale || 0.85);
  floatingGroup.add(placeholder);

  // 5. 3D Model Container
  const modelHolder = new THREE.Group();
  floatingGroup.add(modelHolder);

  const animOffset = Math.random() * Math.PI * 2;
  const baseY = worldY + 1.15;
  group.position.set(item.x, baseY, item.z);

  // Async Model Loading & Smooth Replacement
  loadCollectibleTemplate(type)
    .then((template) => {
      const modelInstance = template.clone(true);
      modelInstance.scale.setScalar(config.scale || 1.0);
      modelHolder.add(modelInstance);
      // Remove placeholder once authentic 3D model is mounted
      floatingGroup.remove(placeholder);
      placeholder.geometry?.dispose();
      placeholder.material?.dispose();
    })
    .catch(() => {
      // Keep placeholder if load fails
    });

  group.userData = {
    type,
    config,
    baseY,
    animOffset,
    spinSpeed: config.spinSpeed || 1.6,
    bobSpeed: config.bobSpeed || 2.4,
    bobHeight: config.bobHeight || 0.16,
    floatingGroup,
    halo,
    lightBeam,
    groundRing,
  };

  return group;
}

export function updateCollectibleEntity(group, dt, elapsedTime) {
  const data = group.userData;
  if (!data) return;

  const { baseY, animOffset, spinSpeed, bobSpeed, bobHeight, floatingGroup, halo, lightBeam, groundRing } = data;

  // Floating hover animation
  floatingGroup.position.y = Math.sin(elapsedTime * bobSpeed + animOffset) * bobHeight;
  floatingGroup.rotation.y += dt * spinSpeed;
  floatingGroup.rotation.x = Math.sin(elapsedTime * 1.6 + animOffset) * 0.08;
  floatingGroup.rotation.z = Math.cos(elapsedTime * 1.3 + animOffset) * 0.06;

  // Orbiting energy halo
  if (halo) {
    halo.rotation.z += dt * 2.2;
    halo.rotation.y = Math.sin(elapsedTime * 1.8 + animOffset) * 0.25;
  }

  // Pulsing ground projector ring
  if (groundRing) {
    const pulse = 1.0 + Math.sin(elapsedTime * 2.4 + animOffset) * 0.12;
    groundRing.scale.set(pulse, pulse, pulse);
    groundRing.rotation.z -= dt * 0.5;
  }

  // Shimmering vertical light beam
  if (lightBeam) {
    const beamPulse = 0.8 + Math.sin(elapsedTime * 3.2 + animOffset) * 0.2;
    lightBeam.material.opacity = (data.config?.hasBeam ? 0.28 : 0.18) * beamPulse;
    lightBeam.rotation.y += dt * 0.3;
  }
}
