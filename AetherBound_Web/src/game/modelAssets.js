import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const modelCache = new Map();
const MODEL_ROOT = '/models/kenney-survival';

export function loadGameModel(name) {
  const url = `${MODEL_ROOT}/${name}.glb`;
  return loadCustomModel(url);
}

export function loadCustomModel(url) {
  if (!modelCache.has(url)) {
    modelCache.set(url, new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }));
  }
  return modelCache.get(url).then((scene) => scene.clone(true));
}

// Keep the model's proportions while centering it on X/Z and placing its feet
// on Y=0. The outer group remains free to scale each game instance.
export function normalizeModel(scene) {
  const instanceRoot = new THREE.Group();
  const content = new THREE.Group();
  content.add(scene);
  instanceRoot.add(content);
  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 0.0001);
  const fitScale = 1 / height;

  content.scale.setScalar(fitScale);
  content.position.set(
    -center.x * fitScale,
    -bounds.min.y * fitScale,
    -center.z * fitScale,
  );
  instanceRoot.userData.normalizedSize = {
    x: Math.max(size.x * fitScale, 0.0001),
    y: 1,
    z: Math.max(size.z * fitScale, 0.0001),
  };
  return instanceRoot;
}

export function scaleModelToSize(root, width, height, depth) {
  const size = root.userData.normalizedSize || { x: 1, y: 1, z: 1 };
  root.scale.set(width / size.x, height / size.y, depth / size.z);
  return root;
}

export function tintModelMaterials(root, tint) {
  const color = new THREE.Color(tint);
  root.traverse((node) => {
    if (!node.isMesh) return;
    const tintMaterial = (material) => {
      const tinted = material.clone();
      if (tinted.color) tinted.color.multiply(color);
      return tinted;
    };
    node.material = Array.isArray(node.material)
      ? node.material.map(tintMaterial)
      : tintMaterial(node.material);
  });
  return root;
}

export function setModelShadows(root, castShadow = true, receiveShadow = true) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = castShadow;
    node.receiveShadow = receiveShadow;
  });
  return root;
}
