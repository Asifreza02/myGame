import * as THREE from 'three';
import { requestPointerLock } from '../pointerLock.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { GAME_CONFIG } from '../config.js';
import { audio } from '../audio.js';
import { CharacterAnimator } from './CharacterAnimator.js';
import { HumanoidAnimator } from './HumanoidAnimator.js';

const ONLINE_HUMAN_MODEL_URL = '/models/animated-human/quaternius-animated-human.fbx';
const ONLINE_HUMAN_TEXTURE_URL = '/models/animated-human/quaternius-clothed-light-skin.png';
let onlineHumanTemplatePromise;
let onlineHumanTexturePromise;

const loadOnlineHumanTemplate = () => {
  if (!onlineHumanTemplatePromise) {
    onlineHumanTemplatePromise = new FBXLoader().loadAsync(ONLINE_HUMAN_MODEL_URL);
  }
  return onlineHumanTemplatePromise;
};

const loadOnlineHumanTexture = () => {
  if (!onlineHumanTexturePromise) {
    onlineHumanTexturePromise = new THREE.TextureLoader().loadAsync(ONLINE_HUMAN_TEXTURE_URL);
  }
  return onlineHumanTexturePromise;
};

export const createMagicStick = (stickId = 'APPRENTICE_STICK') => {
  const stick = new THREE.Group();
  stick.name = 'anim-weapon';

  if (stickId === 'ELDER_STAFF') {
    // Elder Runed Staff: Tall living elder wood with emerald nature crystal
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.032, 0.96, 10),
      new THREE.MeshStandardMaterial({ color: 0x422a14, roughness: 0.85, metalness: 0.05 }),
    );
    shaft.position.y = 0.35;
    shaft.castShadow = true;

    const vine = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.007, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x2e5c1e, roughness: 0.7 }),
    );
    vine.position.y = 0.45;
    vine.rotation.x = Math.PI / 4;

    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.08, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.8 }),
    );
    head.position.y = 0.82;

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.065, 0),
      new THREE.MeshStandardMaterial({
        color: 0x83e879,
        emissive: 0x33cc44,
        emissiveIntensity: 2.2,
        roughness: 0.15,
        metalness: 0.2,
      }),
    );
    crystal.position.y = 0.88;

    const light = new THREE.PointLight(0x83e879, 1.2, 3.5);
    light.position.y = 0.88;

    stick.add(shaft, vine, head, crystal, light);
  } else if (stickId === 'PYRE_STAFF') {
    // Pyre Flame Staff: Basalt & Burning Magma Core
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.036, 0.92, 10),
      new THREE.MeshStandardMaterial({ color: 0x1c1716, roughness: 0.9, metalness: 0.2 }),
    );
    shaft.position.y = 0.34;
    shaft.castShadow = true;

    const emberCore = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.068, 0),
      new THREE.MeshStandardMaterial({
        color: 0xff5511,
        emissive: 0xff3300,
        emissiveIntensity: 2.8,
        roughness: 0.2,
      }),
    );
    emberCore.position.y = 0.84;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.085, 0.008, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x3a2c26, roughness: 0.6 }),
    );
    ring.position.y = 0.84;
    ring.rotation.x = Math.PI / 2;

    const light = new THREE.PointLight(0xff5511, 1.8, 4.0);
    light.position.y = 0.84;

    stick.add(shaft, emberCore, ring, light);
  } else if (stickId === 'CELESTIAL_SCEPTER') {
    // Celestial Archmage Scepter: Silver & Violet Prismatic Core
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.026, 0.88, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8e8f8, metalness: 0.85, roughness: 0.15 }),
    );
    shaft.position.y = 0.32;
    shaft.castShadow = true;

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07, 0),
      new THREE.MeshStandardMaterial({
        color: 0xcc66ff,
        emissive: 0x9911ff,
        emissiveIntensity: 3.2,
        roughness: 0.1,
      }),
    );
    crystal.position.y = 0.80;

    const light = new THREE.PointLight(0xcc66ff, 2.0, 4.5);
    light.position.y = 0.80;

    stick.add(shaft, crystal, light);
  } else {
    // APPRENTICE_STICK (Default Wand)
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.026, 0.66, 12),
      new THREE.MeshStandardMaterial({ color: 0x543a2e, roughness: 0.78, metalness: 0.08 }),
    );
    shaft.position.y = 0.24;
    shaft.castShadow = true;

    const ferrule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.027, 0.027, 0.045, 12),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.75, roughness: 0.25 }),
    );
    ferrule.position.y = 0.44;

    const socket = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.05, 6),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.3 }),
    );
    socket.position.y = 0.57;

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.048, 0),
      new THREE.MeshStandardMaterial({
        color: 0x55eaff,
        emissive: 0x00e5ff,
        emissiveIntensity: 2.2,
        roughness: 0.1,
        metalness: 0.1,
      }),
    );
    gem.position.y = 0.61;

    const glow = new THREE.PointLight(0x55eaff, 1.2, 2.8);
    glow.position.y = 0.61;

    stick.add(shaft, ferrule, socket, gem, glow);
  }

  stick.rotation.x = 0.18;
  stick.rotation.z = -0.06;
  return stick;
};

const createRunnerKnife = () => createMagicStick('APPRENTICE_STICK');

export class RunnerController {
  constructor(scene, camera, domElement) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;

    this.position = new THREE.Vector3(0, 10, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotationY = 0;
    this.isGrounded = false;
    this.isSlowed = false;
    this.isInWater = false;

    // Health & Damage
    this.health = 100;
    this.maxHealth = 100;
    this.invulnerableTimer = 0;

    // Stamina
    this.stamina = GAME_CONFIG.RUNNER.STAMINA_MAX;
    this.isSprinting = false;
    this.role = 'runner';

    // Phase 3: Active Power-Ups & Buffs
    this.speedBuffTimer = 0;
    this.speedMultiplier = 1.0;
    this.weatherSpeedMultiplier = 1.0;
    this.jumpBuffTimer = 0;
    this.bonusJumpForce = 0;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.worldManager = null;

    // Callbacks to notify React UI
    this.onDamage = null;
    this.onPointerLockChange = null;
    this.onSensitivityChange = null;

    // Third-Person Camera with full Yaw & 3D Pitch Aiming (Near-FPP over-the-shoulder)
    this.mouseSensitivity = 1.2;
    this.prevMouseX = 0;
    this.prevMouseY = 0;
    this.cameraDistance = 1.95; // Close orbit distance (near-FPP view, reduced from 6.2)
    this.cameraHeight = 1.82;   // Eye-level camera height (reduced from 2.6)
    this.cameraPitch = 0.05;   // Pitch angle in radians (down < 0, up > 0)
    this.cameraYaw = 0;
    this.isPointerLocked = false;
    this.aimFriction = 1.0; // Dynamic aim assist friction multiplier

    // Advanced Traversal: Slide & Vaulting
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = GAME_CONFIG.RUNNER.SLIDE_DURATION || 0.75;
    this.slideDir = new THREE.Vector2(0, -1);

    this.isVaulting = false;
    this.vaultStart = new THREE.Vector3();
    this.vaultEnd = new THREE.Vector3();
    this.vaultTimer = 0;
    this.vaultDuration = 0.45;

    this.particles = null; // Assigned from GameEngine
    this.audio = audio;
    this.physics = null;   // Assigned from GameEngine
    this.enabled = true;   // Only active when player is Runner

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      slide: false,
      turnLeft: false,
      turnRight: false,
      pitchUp: false,
      pitchDown: false,
    };
    this.joystickVector = { x: 0, y: 0 };

    // Animation timers
    this.animTime = 0;
    this.stepTimer = 0;
    this.hitReactTimer = 0;
    this.characterModelLoaded = false;
    this.onCharacterModelLoaded = null;

    this.buildAvatar();
    this.animator = new CharacterAnimator(this.group);
    this.loadOnlineCharacter();
    this.setupInputs();
  }

  buildAvatar() {
    this.group = new THREE.Group();
    this.avatarRoot = new THREE.Group();
    this.avatarRoot.name = 'anim-avatar-root';
    this.fallbackAvatar = new THREE.Group();
    this.fallbackAvatar.name = 'anim-fallback-human';
    this.avatarRoot.add(this.fallbackAvatar);
    this.group.add(this.avatarRoot);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98661, roughness: 0.88 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x39251d, roughness: 0.92 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x087f91, roughness: 0.86 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x37d6d0, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x263443, roughness: 0.92 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x49342c, roughness: 0.94 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x332720, roughness: 0.8 });

    // A fitted travel jacket gives the runner a clear human silhouette.
    const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.48, 4, 10);
    const torsoMat = jacketMat;
    this.torso = new THREE.Mesh(torsoGeo, torsoMat);
    this.torso.name = 'anim-torso';
    this.torso.position.y = 1.08;
    this.torso.castShadow = true;
    this.fallbackAvatar.add(this.torso);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), jacketMat);
    chest.scale.set(1.2, 0.68, 0.84);
    chest.position.y = 0.27;
    chest.castShadow = true;
    this.torso.add(chest);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.22, 10), skinMat);
    neck.position.y = 1.67;
    this.fallbackAvatar.add(neck);

    // Face, ears, eyes and hair keep the character recognizably human at game distance.
    this.head = new THREE.Group();
    this.head.name = 'anim-head';
    this.head.position.y = 1.87;
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.235, 14, 12), skinMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    this.fallbackAvatar.add(this.head);

    const earGeo = new THREE.SphereGeometry(0.07, 8, 6);
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(side * 0.22, 0, 0);
      this.head.add(ear);

      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xf5e8d8, roughness: 0.5 })
      );
      eye.position.set(side * 0.085, 0.025, 0.204);
      this.head.add(eye);

      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x36505a, roughness: 0.45 })
      );
      iris.position.set(side * 0.085, 0.025, 0.241);
      this.head.add(iris);

      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.078, 0.018, 0.025),
        hairMat
      );
      brow.position.set(side * 0.085, 0.092, 0.225);
      brow.rotation.z = side * -0.08;
      this.head.add(brow);
    });

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skinMat);
    nose.scale.set(0.72, 0.8, 0.8);
    nose.position.set(0, -0.05, 0.23);
    this.head.add(nose);

    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.012, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x743f3b, roughness: 0.8 })
    );
    mouth.position.set(0, -0.12, 0.218);
    this.head.add(mouth);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.247, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hair.position.set(0, 0.04, -0.005);
    this.head.add(hair);
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6), hairMat);
    fringe.scale.set(1.35, 0.42, 0.8);
    fringe.position.set(0, 0.155, 0.145);
    this.head.add(fringe);

    const jacketZip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.48, 0.025), trimMat);
    jacketZip.position.set(0, 0.04, 0.328);
    this.torso.add(jacketZip);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.11, 0.44), darkMat);
    belt.position.set(0, -0.47, 0);
    this.torso.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.045), trimMat);
    buckle.position.set(0, -0.47, 0.235);
    this.torso.add(buckle);

    const makeArm = (x) => {
      const side = Math.sign(x);
      const sideName = side < 0 ? 'left' : 'right';
      const arm = new THREE.Group();
      arm.position.set(x, 1.43, 0);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), jacketMat);
      shoulder.scale.set(1, 0.9, 0.88);
      shoulder.position.y = -0.015;
      shoulder.castShadow = true;
      arm.add(shoulder);

      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.22, 4, 8), jacketMat);
      upperArm.position.y = -0.18;
      upperArm.castShadow = true;
      arm.add(upperArm);

      const elbow = new THREE.Group();
      elbow.name = `anim-${sideName}-elbow`;
      elbow.position.y = -0.36;
      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.092, 9, 7), jacketMat);
      elbow.add(elbowJoint);

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.086, 0.21, 4, 8), jacketMat);
      forearm.position.y = -0.16;
      forearm.castShadow = true;
      elbow.add(forearm);

      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.091, 0.091, 0.065, 10), trimMat);
      cuff.position.y = -0.29;
      elbow.add(cuff);

      const hand = new THREE.Group();
      hand.name = `anim-${sideName}-hand`;
      hand.position.set(0, -0.35, 0.005);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skinMat);
      palm.scale.set(0.82, 0.74, 0.58);
      palm.position.z = 0.015;
      hand.add(palm);

      [-0.052, -0.017, 0.017, 0.052].forEach((fingerX) => {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.055, 2, 5), skinMat);
        finger.position.set(fingerX, -0.064, 0.075);
        finger.rotation.x = -0.16;
        hand.add(finger);
      });
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.052, 2, 5), skinMat);
      thumb.position.set(side * 0.072, 0.006, 0.045);
      thumb.rotation.set(-0.2, 0, side * -0.82);
      hand.add(thumb);

      elbow.add(hand);
      arm.add(elbow);
      if (side < 0) this.leftHand = hand;
      else this.rightHand = hand;
      return arm;
    };
    this.leftArm = makeArm(-0.48);
    this.rightArm = makeArm(0.48);
    this.leftArm.name = 'anim-left-arm';
    this.rightArm.name = 'anim-right-arm';
    this.fallbackAvatar.add(this.leftArm, this.rightArm);

    const makeLeg = (x) => {
      const sideName = x < 0 ? 'left' : 'right';
      const leg = new THREE.Group();
      leg.position.set(x, 0.62, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.22, 4, 8), pantsMat);
      thigh.position.y = -0.14;
      thigh.castShadow = true;
      leg.add(thigh);

      const knee = new THREE.Group();
      knee.name = `anim-${sideName}-knee`;
      knee.position.y = -0.32;
      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.102, 9, 7), pantsMat);
      knee.add(kneeJoint);

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.096, 0.22, 4, 8), pantsMat);
      shin.position.y = -0.15;
      shin.castShadow = true;
      knee.add(shin);
      const boot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bootMat);
      boot.scale.set(0.9, 0.62, 1.35);
      boot.position.set(0, -0.27, 0.08);
      knee.add(boot);
      leg.add(knee);
      return leg;
    };
    this.leftLeg = makeLeg(-0.19);
    this.rightLeg = makeLeg(0.19);
    this.leftLeg.name = 'anim-left-leg';
    this.rightLeg.name = 'anim-right-leg';
    this.fallbackAvatar.add(this.leftLeg, this.rightLeg);

    const knife = createRunnerKnife();
    knife.position.set(0, 0, 0.025);
    knife.rotation.z = 0.38;
    this.rightHand.add(knife);
    this.knife = knife;
    this.knifeSwingTimer = 0;

    // Phase 3: 3D Aegis Energy Shield Bubble
    const shieldGeo = new THREE.IcosahedronGeometry(1.35, 2);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.1;
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    this.scene.add(this.group);
  }

  async loadOnlineCharacter() {
    try {
      const [template, skinTexture] = await Promise.all([
        loadOnlineHumanTemplate(),
        loadOnlineHumanTexture(),
      ]);
      skinTexture.colorSpace = THREE.SRGBColorSpace;
      skinTexture.magFilter = THREE.NearestFilter;
      skinTexture.minFilter = THREE.NearestFilter;
      skinTexture.generateMipmaps = false;

      const model = cloneSkinned(template);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 2.18 / Math.max(bounds.getSize(new THREE.Vector3()).y, 0.001);
      model.name = 'anim-human-model';
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      model.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.isSkinnedMesh) {
          node.frustumCulled = false;
        }
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          material.map = skinTexture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
        }
      });

      const poseRoot = new THREE.Group();
      poseRoot.name = 'anim-human-pose';
      poseRoot.add(model);
      this.avatarRoot.add(poseRoot);
      model.updateMatrixWorld(true);

      const rightHand = model.getObjectByName('RightHand');
      if (rightHand) {
        this.rightHand = rightHand;
        const knife = createRunnerKnife();
        const handScale = Math.max(rightHand.getWorldScale(new THREE.Vector3()).x, 0.001);
        const modelUnitsPerMeter = 1 / handScale;
        knife.scale.setScalar(modelUnitsPerMeter);
        knife.position.set(0, 0.13 * modelUnitsPerMeter, 0);
        rightHand.add(knife);
        this.knife = knife;
      }

      this.characterAnimations = template.animations || [];
      this.fallbackAvatar.visible = false;
      this.characterModelLoaded = true;
      this.group.rotation.x = 0;
      this.group.rotation.z = 0;
      this.animator = this.createCharacterAnimator(this.group);
      if (this.onCharacterModelLoaded) this.onCharacterModelLoaded();
    } catch (error) {
      console.warn('Could not load the online human model; keeping the built-in character.', error);
    }
  }

  createCharacterAnimator(group) {
    const model = group.getObjectByName('anim-human-model');
    const poseRoot = group.getObjectByName('anim-human-pose');
    if (model && poseRoot && this.characterAnimations) {
      return new HumanoidAnimator(poseRoot, model, this.characterAnimations);
    }
    return new CharacterAnimator(group);
  }

  cloneCharacterGroup() {
    return cloneSkinned(this.group);
  }

  async setEquippedWeapon(weaponId) {
    this.equippedWeaponId = weaponId;
    if (!this.weaponMeshes) this.weaponMeshes = new Map();

    const hand = this.rightHand;
    if (!hand) return;

    const isBasicStick = (weaponId === 'KNIFE' || weaponId === 'APPRENTICE_STICK');
    if (this.knife) this.knife.visible = isBasicStick;
    for (const [id, mesh] of this.weaponMeshes.entries()) {
      mesh.visible = (id === weaponId);
    }

    if (isBasicStick || this.weaponMeshes.has(weaponId)) return;

    if (['ELDER_STAFF', 'PYRE_STAFF', 'CELESTIAL_SCEPTER'].includes(weaponId)) {
      const staffGroup = createMagicStick(weaponId);
      const handScale = Math.max(hand.getWorldScale(new THREE.Vector3()).x, 0.001);
      const modelUnits = 1 / handScale;
      staffGroup.scale.setScalar(modelUnits);
      hand.add(staffGroup);
      this.weaponMeshes.set(weaponId, staffGroup);
      staffGroup.visible = (this.equippedWeaponId === weaponId);
      if (this.knife) this.knife.visible = false;
      return;
    }

    try {
      const { loadCustomModel, normalizeModel, setModelShadows, tintModelMaterials } = await import('../modelAssets.js');
      let url = '/models/weapons/blaster-smg.glb';
      let scale = 0.38;
      let tint = null;

      if (weaponId === 'PISTOL') {
        url = '/models/weapons/blaster-smg.glb';
        scale = 0.38;
      } else if (weaponId === 'GUN') {
        url = '/models/weapons/blaster-rifle.glb';
        scale = 0.54;
        tint = 0xffb84d;
      } else if (weaponId === 'LASER_GUN') {
        url = '/models/weapons/blaster-rifle.glb';
        scale = 0.58;
        tint = 0x00f0ff;
      } else if (weaponId === 'PLASMA_CANNON') {
        url = '/models/weapons/blaster-heavy.glb';
        scale = 0.65;
        tint = 0xff5268;
      }

      const scene = await loadCustomModel(url);
      const normalized = normalizeModel(scene);
      if (tint) tintModelMaterials(normalized, tint);
      setModelShadows(normalized, true, false);

      const weaponGroup = new THREE.Group();
      weaponGroup.name = `weapon-${weaponId}`;
      normalized.scale.setScalar(scale);
      normalized.rotation.y = Math.PI;
      normalized.position.set(0, 0.05, 0.15);
      weaponGroup.add(normalized);

      const handScale = Math.max(hand.getWorldScale(new THREE.Vector3()).x, 0.001);
      const modelUnits = 1 / handScale;
      weaponGroup.scale.setScalar(modelUnits);

      hand.add(weaponGroup);
      this.weaponMeshes.set(weaponId, weaponGroup);
      weaponGroup.visible = (this.equippedWeaponId === weaponId);
      if (this.knife && this.equippedWeaponId !== 'KNIFE') this.knife.visible = false;
    } catch (err) {
      console.warn(`Could not load weapon model for ${weaponId}:`, err);
    }
  }

  setCharacterModelReadyHandler(handler) {
    this.onCharacterModelLoaded = handler;
    if (this.characterModelLoaded && this.onCharacterModelLoaded) this.onCharacterModelLoaded();
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      switch (e.code) {
        case 'KeyW': this.keys.forward = true; break;
        case 'KeyS': this.keys.backward = true; break;
        case 'KeyA': this.keys.left = true; break;
        case 'KeyD': this.keys.right = true; break;
        case 'ArrowUp': this.keys.forward = true; break;
        case 'ArrowDown': this.keys.backward = true; break;
        case 'ArrowLeft': this.keys.turnLeft = true; break;
        case 'ArrowRight': this.keys.turnRight = true; break;
        case 'KeyQ': this.keys.turnLeft = true; break;
        case 'KeyE': this.keys.turnRight = true; break;
        case 'PageUp':
        case 'KeyR':
          this.keys.pitchUp = true;
          break;
        case 'PageDown':
        case 'KeyF':
          this.keys.pitchDown = true;
          break;
        case 'Home':
          this.cameraPitch = 0.05;
          break;
        case 'KeyC':
          this.startSlide();
          break;
        case 'ControlLeft':
        case 'ControlRight':
          this.startSlide();
          break;
        case 'Space':
          this.keys.jump = true;
          // Check for vaulting over low obstacle ahead
          if (this.physics && !this.isVaulting) {
            const fwdX = -Math.sin(this.cameraYaw);
            const fwdZ = -Math.cos(this.cameraYaw);
            const vaultTarget = this.physics.checkVaultTarget(this.position, fwdX, fwdZ);
            if (vaultTarget) {
              this.startVault(vaultTarget);
              break;
            }
          }
          if (this.isGrounded && !this.isVaulting && !this.isSliding) {
            this.velocity.y = GAME_CONFIG.RUNNER.JUMP_FORCE + (this.bonusJumpForce || 0);
            this.isGrounded = false;
            audio.playJump();
          }
          break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = true; break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.enabled) return;
      switch (e.code) {
        case 'KeyW': this.keys.forward = false; break;
        case 'KeyS': this.keys.backward = false; break;
        case 'KeyA': this.keys.left = false; break;
        case 'KeyD': this.keys.right = false; break;
        case 'ArrowUp': this.keys.forward = false; break;
        case 'ArrowDown': this.keys.backward = false; break;
        case 'ArrowLeft': this.keys.turnLeft = false; break;
        case 'ArrowRight': this.keys.turnRight = false; break;
        case 'KeyQ': this.keys.turnLeft = false; break;
        case 'KeyE': this.keys.turnRight = false; break;
        case 'PageUp':
        case 'KeyR':
          this.keys.pitchUp = false;
          break;
        case 'PageDown':
        case 'KeyF':
          this.keys.pitchDown = false;
          break;
        case 'Space': this.keys.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = false; break;
      }
    });

    // Pointer Lock Management: Click to lock & hide cursor; Esc unlocks and shows cursor
    this.domElement.addEventListener('click', () => {
      if (this.enabled) {
        if (typeof document !== 'undefined') {
          document.body.classList.remove('cursor-unlocked');
          if (document.pointerLockElement !== this.domElement) {
            requestPointerLock(this.domElement);
          }
        }
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = (document.pointerLockElement === this.domElement);
      if (this.isPointerLocked) {
        document.body.classList.remove('cursor-unlocked');
        document.body.classList.add('cursor-locked');
      } else {
        document.body.classList.add('cursor-unlocked');
        document.body.classList.remove('cursor-locked');
      }
      if (this.onPointerLockChange) {
        this.onPointerLockChange(this.isPointerLocked);
      }
    });

    // Explicit ESC key listener to release pointer lock and show cursor
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (document.pointerLockElement && document.exitPointerLock) {
          document.exitPointerLock();
        }
        document.body.classList.add('cursor-unlocked');
        document.body.classList.remove('cursor-locked');
      }
    });

    // 1. Mouse Movement: Look Yaw & Pitch (Active when pointer locked)
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;

      let dx = 0;
      let dy = 0;
      if (this.isPointerLocked) {
        dx = e.movementX;
        dy = e.movementY;
      } else {
        // When cursor is unlocked via Esc, user can freely use the cursor without spinning POV
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;
        return;
      }

      const sens = 0.0032 * this.mouseSensitivity * (this.aimFriction || 1.0);
      if (dx !== 0 && Math.abs(dx) < 250) {
        this.cameraYaw -= dx * sens;
      }
      if (dy !== 0 && Math.abs(dy) < 250) {
        this.cameraPitch -= dy * sens;
        this.cameraPitch = Math.max(-0.75, Math.min(1.15, this.cameraPitch));
      }
    });

    // 2. Touchpad Two-Finger Pan / Swipe (deltaX) - NO ZOOM
    window.addEventListener('wheel', (e) => {
      if (!this.enabled) return;

      if (Math.abs(e.deltaX) > 1.0) {
        this.cameraYaw -= e.deltaX * 0.003 * this.mouseSensitivity * (this.aimFriction || 1.0);
      }
    }, { passive: true });

    // 3. Touchpad / Touchscreen Horizontal & Vertical Swipe Handling
    let touchStartX = 0;
    let touchStartY = 0;
    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.domElement.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      if (e.touches.length > 0) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        const sens = 0.005 * this.mouseSensitivity * (this.aimFriction || 1.0);
        this.cameraYaw -= dx * sens;
        this.cameraPitch -= dy * sens;
        this.cameraPitch = Math.max(-0.75, Math.min(1.15, this.cameraPitch));
      }
    }, { passive: true });
  }

  // Cycle mouse / touchpad sensitivity: 1.0x -> 1.8x -> 2.6x
  cycleSensitivity() {
    if (this.mouseSensitivity === 1.2) this.mouseSensitivity = 1.8;
    else if (this.mouseSensitivity === 1.8) this.mouseSensitivity = 2.6;
    else this.mouseSensitivity = 1.2;

    if (this.onSensitivityChange) {
      this.onSensitivityChange(this.mouseSensitivity);
    }
    audio.playPlacement();
  }

  // Initiate power slide
  startSlide() {
    if (this.isSliding || this.isVaulting || !this.isGrounded) return;
    if (this.stamina < 10) return;

    this.isSliding = true;
    this.slideTimer = 0;
    this.stamina = Math.max(0, this.stamina - 15);

    const fwdX = -Math.sin(this.cameraYaw);
    const fwdZ = -Math.cos(this.cameraYaw);
    this.slideDir.set(fwdX, fwdZ).normalize();

    audio.playSlide();
    if (this.particles) {
      this.particles.emitDust(this.position, 8);
    }
  }

  // Initiate vault over low obstacle
  startVault(targetPos) {
    if (this.isVaulting) return;
    this.isVaulting = true;
    this.isSliding = false;
    this.vaultTimer = 0;
    this.vaultStart.copy(this.position);
    this.vaultEnd.copy(targetPos);

    audio.playVault();
    if (this.particles) {
      this.particles.emitDust(this.position, 6);
    }
  }

  // Mobile & Virtual Controls Support
  setJoystick(x, y) {
    this.joystickVector.x = x;
    this.joystickVector.y = y;
  }

  addCameraYaw(deltaYaw) {
    this.cameraYaw += deltaYaw;
  }

  addCameraPitch(deltaPitch) {
    this.cameraPitch = Math.max(-0.75, Math.min(1.15, this.cameraPitch + deltaPitch));
  }

  addCameraLook(deltaYaw, deltaPitch) {
    const f = this.aimFriction || 1.0;
    if (deltaYaw) this.cameraYaw += deltaYaw * f;
    if (deltaPitch) {
      this.cameraPitch = Math.max(-0.75, Math.min(1.15, this.cameraPitch + deltaPitch * f));
    }
  }

  setSprinting(active) {
    this.keys.sprint = Boolean(active);
  }

  triggerJump() {
    if (!this.enabled) return;
    if (this.physics && !this.isVaulting) {
      const fwdX = -Math.sin(this.cameraYaw);
      const fwdZ = -Math.cos(this.cameraYaw);
      const vaultTarget = this.physics.checkVaultTarget(this.position, fwdX, fwdZ);
      if (vaultTarget) {
        this.startVault(vaultTarget);
        return;
      }
    }
    if (this.isGrounded && !this.isVaulting && !this.isSliding) {
      this.velocity.y = GAME_CONFIG.RUNNER.JUMP_FORCE + (this.bonusJumpForce || 0);
      this.isGrounded = false;
      audio.playJump();
    }
  }

  // Phase 3: Active Buff Application Methods
  applySpeedBuff(duration, multiplier) {
    this.speedBuffTimer = Math.max(this.speedBuffTimer, duration);
    this.speedMultiplier = multiplier;
  }

  applyJumpBuff(duration, jumpForce) {
    this.jumpBuffTimer = Math.max(this.jumpBuffTimer, duration);
    this.bonusJumpForce = jumpForce - GAME_CONFIG.RUNNER.JUMP_FORCE;
  }

  applyShield(duration) {
    this.hasShield = true;
    this.shieldTimer = Math.max(this.shieldTimer, duration);
    if (this.shieldMesh) this.shieldMesh.visible = true;
  }

  applyHealth(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  getActiveBuffs() {
    const buffs = [];
    if (this.speedBuffTimer > 0) {
      buffs.push({
        type: 'SPEED',
        name: 'Speed Surge',
        icon: '⚡',
        color: '#ffea00',
        timeLeft: this.speedBuffTimer,
        desc: `+60% Sprint (${this.speedBuffTimer.toFixed(1)}s)`
      });
    }
    if (this.jumpBuffTimer > 0) {
      buffs.push({
        type: 'JUMP',
        name: 'High Jump',
        icon: '🦘',
        color: '#00ff88',
        timeLeft: this.jumpBuffTimer,
        desc: `Kinetic Leap (${this.jumpBuffTimer.toFixed(1)}s)`
      });
    }
    if (this.hasShield && this.shieldTimer > 0) {
      buffs.push({
        type: 'SHIELD',
        name: 'Aegis Shield',
        icon: '🛡️',
        color: '#00d4ff',
        timeLeft: this.shieldTimer,
        desc: `Hit Absorber (${this.shieldTimer.toFixed(1)}s)`
      });
    }
    return buffs;
  }

  takeDamage(amount, source = 'obstacle') {
    if (this.invulnerableTimer > 0) return;

    // Phase 3: Aegis Energy Shield completely deflects and absorbs damage!
    if (this.hasShield) {
      this.hasShield = false;
      this.shieldTimer = 0;
      if (this.shieldMesh) this.shieldMesh.visible = false;
      this.invulnerableTimer = 0.65;
      audio.playShieldDeflect();
      if (this.particles) {
        this.particles.emitShieldBubbleBurst(this.position);
      }
      return;
    }

    this.invulnerableTimer = 0.55;
    this.hitReactTimer = 0.24;
    this.health = Math.max(0, this.health - amount);
    audio.playDamage();

    if (this.onDamage) {
      this.onDamage(amount, source);
    } else {
      const flashEl = document.getElementById('damage-overlay');
      if (flashEl) {
        flashEl.classList.remove('flash');
        void flashEl.offsetWidth;
        flashEl.classList.add('flash');
      }
    }

    if (this.particles) {
      this.particles.emitDust(this.position, 10);
    }
  }

  onHazardHit() {
    this.takeDamage(25, 'hazard');
  }

  playKnifeSwing() {
    this.knifeSwingTimer = 0.28;
    audio.playKnifeSwing();
  }

  playCastGesture(duration = 0.25) {
    this.castTimer = duration;
    this.castDuration = duration;
  }

  triggerCameraShake(intensity = 0.35, duration = 0.25) {
    this.cameraShake = { intensity, duration, timer: duration };
  }

  update(dt) {
    if (this.castTimer > 0) {
      this.castTimer = Math.max(0, this.castTimer - dt);
    }
    if (this.cameraShake && this.cameraShake.timer > 0) {
      this.cameraShake.timer = Math.max(0, this.cameraShake.timer - dt);
    }
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }
    this.hitReactTimer = Math.max(0, this.hitReactTimer - dt);

    // Phase 3: Update Active Buff Timers & Shield Bubble Animation
    if (this.speedBuffTimer > 0) {
      this.speedBuffTimer -= dt;
      if (this.speedBuffTimer <= 0) {
        this.speedBuffTimer = 0;
        this.speedMultiplier = 1.0;
      }
    }

    if (this.jumpBuffTimer > 0) {
      this.jumpBuffTimer -= dt;
      if (this.jumpBuffTimer <= 0) {
        this.jumpBuffTimer = 0;
        this.bonusJumpForce = 0;
      }
    }

    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldTimer = 0;
        this.hasShield = false;
        if (this.shieldMesh) this.shieldMesh.visible = false;
      }
    }

    if (this.hasShield && this.shieldMesh) {
      this.shieldMesh.rotation.y += 1.8 * dt;
      this.shieldMesh.rotation.x += 0.9 * dt;
    }

    this.knifeSwingTimer = Math.max(0, this.knifeSwingTimer - dt);

    // 1. Keyboard Camera Turn & Pitch Inputs
    const kFriction = this.aimFriction || 1.0;
    if (this.keys.turnLeft) {
      this.cameraYaw += 2.4 * dt * kFriction;
    }
    if (this.keys.turnRight) {
      this.cameraYaw -= 2.4 * dt * kFriction;
    }
    if (this.keys.pitchUp) {
      this.cameraPitch = Math.min(1.15, this.cameraPitch + 1.8 * dt * kFriction);
    }
    if (this.keys.pitchDown) {
      this.cameraPitch = Math.max(-0.75, this.cameraPitch - 1.8 * dt * kFriction);
    }

    // 2. Player Seeing Direction & Heading Vectors
    const forwardX = -Math.sin(this.cameraYaw);
    const forwardZ = -Math.cos(this.cameraYaw);
    const rightX = Math.cos(this.cameraYaw);
    const rightZ = -Math.sin(this.cameraYaw);
    let inputForward = this.joystickVector.y || 0;
    let inputRight = this.joystickVector.x || 0;
    if (this.keys.forward) inputForward += 1;
    if (this.keys.backward) inputForward -= 1;
    if (this.keys.right) inputRight += 1;
    if (this.keys.left) inputRight -= 1;
    const isMoving = Math.abs(inputForward) > 0.05 || Math.abs(inputRight) > 0.05;

    this.rotationY = this.cameraYaw + Math.PI;
    this.group.rotation.y = this.rotationY;

    // 3. Vaulting Kinematics (Overrides normal traversal while active)
    if (this.isVaulting) {
      this.vaultTimer += dt;
      const progress = Math.min(1.0, this.vaultTimer / this.vaultDuration);
      const t = 1.0 - Math.pow(1.0 - progress, 3); // cubic ease-out

      this.position.x = THREE.MathUtils.lerp(this.vaultStart.x, this.vaultEnd.x, t);
      this.position.z = THREE.MathUtils.lerp(this.vaultStart.z, this.vaultEnd.z, t);

      const peakY = Math.max(this.vaultStart.y, this.vaultEnd.y) + 0.5;
      if (t < 0.5) {
        this.position.y = THREE.MathUtils.lerp(this.vaultStart.y, peakY, t * 2);
      } else {
        this.position.y = THREE.MathUtils.lerp(peakY, this.vaultEnd.y, (t - 0.5) * 2);
      }

      this.velocity.set(0, 0, 0);

      this.animator.update(dt, {
        grounded: false,
        verticalVelocity: this.velocity.y,
        vaulting: true,
        vaultProgress: progress,
        attackProgress: this.knifeSwingTimer > 0 ? 1 - this.knifeSwingTimer / 0.28 : 0,
        hitProgress: this.hitReactTimer > 0 ? 1 - this.hitReactTimer / 0.24 : 0,
      });

      this.constrainToWorld();
      this.group.position.copy(this.position);

      if (progress >= 1.0) {
        this.isVaulting = false;
        this.isGrounded = true;
      }
      this.updateCamera(forwardX, forwardZ);
      return;
    }

    // 4. Stamina handling
    const hasMoveInput = (
      this.keys.forward || this.keys.backward || this.keys.left || this.keys.right ||
      Math.abs(this.joystickVector.x) > 0.1 || Math.abs(this.joystickVector.y) > 0.1
    );

    if (this.keys.sprint && this.stamina > 0 && hasMoveInput) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - GAME_CONFIG.RUNNER.STAMINA_DRAIN * dt);
    } else {
      this.isSprinting = false;
      this.stamina = Math.min(GAME_CONFIG.RUNNER.STAMINA_MAX, this.stamina + GAME_CONFIG.RUNNER.STAMINA_RECOVERY * dt);
    }

    // Low stamina warning heartbeat
    if (this.stamina < 18 && this.isSprinting && Math.random() > 0.94) {
      audio.playTick();
    }

    // 5. Slide Mechanic Execution
    if (this.isSliding) {
      this.slideTimer += dt;
      const progress = this.slideTimer / this.slideDuration;
      const burstSpeed = GAME_CONFIG.RUNNER.SPRINT_SPEED * (GAME_CONFIG.RUNNER.SLIDE_BURST || 1.35) * (1.0 - progress * 0.65);

      this.position.x += this.slideDir.x * burstSpeed * dt;
      this.position.z += this.slideDir.y * burstSpeed * dt;

      if (this.particles && Math.random() > 0.4) {
        this.particles.emitDust(this.position, 2);
      }

      if (this.slideTimer >= this.slideDuration) {
        this.isSliding = false;
      }
    } else {
      // 6. Normal Movement
      let speed = (this.isSprinting ? GAME_CONFIG.RUNNER.SPRINT_SPEED : GAME_CONFIG.RUNNER.BASE_SPEED)
        * (this.speedMultiplier || 1.0)
        * (this.weatherSpeedMultiplier || 1.0);
      if (this.isSlowed) {
        speed *= 0.35;
      } else if (this.isInWater) {
        speed *= 0.72;
      }

      // Phase 3: Ice sliding physics on slippery tundra
      if (this.worldManager && typeof this.worldManager.getDominantBiome === 'function') {
        const biome = this.worldManager.getDominantBiome(this.position.x, this.position.z);
        if (biome && biome.isSlippery) {
          speed *= 1.25; // +25% glide traction
        }
      }

      if (isMoving) {
        const len = Math.max(1.0, Math.sqrt(inputForward * inputForward + inputRight * inputRight));
        const normFwd = inputForward / len;
        const normRt = inputRight / len;

        const moveX = forwardX * normFwd + rightX * normRt;
        const moveZ = forwardZ * normFwd + rightZ * normRt;

        this.position.x += moveX * speed * dt;
        this.position.z += moveZ * speed * dt;

        if (this.isGrounded) {
          this.stepTimer += dt * (this.isSprinting ? 1.6 : 1.0);
          if (this.stepTimer > 0.35) {
            if (this.isInWater) {
              audio.playSplash();
              if (this.particles) this.particles.emitWaterSplash(this.position, 6);
            } else {
              audio.playFootstep();
              if (this.isSprinting && this.particles) this.particles.emitDust(this.position, 2);
            }
            this.stepTimer = 0;
          }
        }

      }
    }

    this.animator.update(dt, {
      moving: isMoving && !this.isSliding,
      sprinting: this.isSprinting,
      forward: inputForward,
      strafe: inputRight,
      grounded: this.isGrounded,
      verticalVelocity: this.velocity.y,
      sliding: this.isSliding,
      slideProgress: this.slideTimer / this.slideDuration,
      pitch: this.cameraPitch,
      attackProgress: this.knifeSwingTimer > 0 ? 1 - this.knifeSwingTimer / 0.28 : 0,
      casting: this.castTimer > 0,
      castProgress: (this.castDuration && this.castTimer > 0) ? (1 - this.castTimer / this.castDuration) : 0,
      hitProgress: this.hitReactTimer > 0 ? 1 - this.hitReactTimer / 0.24 : 0,
    });

    // Decay horizontal knockback velocity
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.velocity.x *= 0.85;
    this.velocity.z *= 0.85;

    this.lastForwardX = forwardX;
    this.lastForwardZ = forwardZ;
    this.finalizeTransform(dt);
  }

  finalizeTransform(dt = 0.016) {
    this.constrainToWorld();
    // Synchronize avatar group with authoritative position
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;

    const fwdX = this.lastForwardX !== undefined ? this.lastForwardX : -Math.sin(this.cameraYaw);
    const fwdZ = this.lastForwardZ !== undefined ? this.lastForwardZ : -Math.cos(this.cameraYaw);
    this.updateCamera(fwdX, fwdZ, dt);
  }

  constrainToWorld() {
    const maxRadius = GAME_CONFIG.WORLD.RADIUS - 2;
    const radius = Math.hypot(this.position.x, this.position.z);
    if (radius <= maxRadius) return;

    const scale = maxRadius / radius;
    this.position.x *= scale;
    this.position.z *= scale;
    const outwardVelocity = this.velocity.x * this.position.x + this.velocity.z * this.position.z;
    if (outwardVelocity > 0) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  updateCamera(forwardX, forwardZ, dt = 0.016) {
    this.group.visible = true;
    const pitch = this.cameraPitch || 0;
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    // 3D Aim forward unit vector
    const aimDirX = forwardX * cosPitch;
    const aimDirY = sinPitch;
    const aimDirZ = forwardZ * cosPitch;

    // Perpendicular Right unit vector for over-the-shoulder near-FPP alignment
    const rightX = Math.cos(this.cameraYaw);
    const rightZ = -Math.sin(this.cameraYaw);
    const shoulderOffset = 0.40; // 0.40m offset to right shoulder so character does not occlude the reticle

    // Camera orbit positioning:
    // Snug orbit distance close behind character's head/shoulder
    const horizDist = this.cameraDistance * Math.cos(pitch * 0.45);
    let camX = this.position.x - forwardX * horizDist + rightX * shoulderOffset;
    let camZ = this.position.z - forwardZ * horizDist + rightZ * shoulderOffset;

    // Pitch height adjustment:
    let camY = this.position.y + this.cameraHeight - sinPitch * 0.45;

    // Smooth, harmonic camera shake (smooth sine waves instead of violent random position spikes)
    if (this.cameraShake && this.cameraShake.timer > 0) {
      const shakeProgress = this.cameraShake.timer / this.cameraShake.duration;
      const shakeAmt = shakeProgress * Math.min(this.cameraShake.intensity, 0.12);
      camX += Math.sin(this.cameraShake.timer * 40) * shakeAmt;
      camY += Math.cos(this.cameraShake.timer * 30) * shakeAmt * 0.45;
      camZ += Math.sin(this.cameraShake.timer * 36) * shakeAmt;
    }

    // Prevent camera from clipping through terrain with smooth damped elevation
    let minGroundY = this.position.y + 0.5;
    if (this.worldManager && typeof this.worldManager.getHeightAt === 'function') {
      const terrainY = this.worldManager.getHeightAt(camX, camZ);
      minGroundY = Math.max(minGroundY, terrainY + 0.7);
    }
    const targetCamY = Math.max(minGroundY, camY);
    if (this.currentCamY === undefined || Number.isNaN(this.currentCamY)) {
      this.currentCamY = targetCamY;
    } else {
      const blend = 1 - Math.exp(-20 * Math.min(dt || 0.016, 0.05));
      this.currentCamY = THREE.MathUtils.lerp(this.currentCamY, targetCamY, blend);
    }
    camY = this.currentCamY;

    this.camera.position.set(camX, camY, camZ);

    // Look target points 35 meters ahead along the player's 3D aim direction from eye level
    const eyeHeight = 1.70;
    const lookDist = 35.0;
    const lookTargetX = this.position.x + aimDirX * lookDist;
    const lookTargetY = this.position.y + eyeHeight + aimDirY * lookDist;
    const lookTargetZ = this.position.z + aimDirZ * lookDist;

    this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
  }

  // Get network sync payload
  getState() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      ry: this.rotationY,
      pitch: this.cameraPitch || 0,
      speed: (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right || Math.abs(this.joystickVector.x) > 0.1 || Math.abs(this.joystickVector.y) > 0.1) ? 1 : 0,
      isGrounded: this.isGrounded,
      stamina: this.stamina,
      health: this.health,
    };
  }

  // Set position when synced from network (or respawn)
  setState(st) {
    this.position.set(st.x, st.y, st.z);
    this.rotationY = st.ry || 0;
    if (st.pitch !== undefined) this.cameraPitch = st.pitch;
    if (st.health !== undefined) this.health = st.health;
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;
    this.group.visible = true;
    if (this.enabled) {
      const fwdX = -Math.sin(this.cameraYaw);
      const fwdZ = -Math.cos(this.cameraYaw);
      this.updateCamera(fwdX, fwdZ);
    }
  }
}
