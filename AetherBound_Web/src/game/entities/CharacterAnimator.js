import * as THREE from 'three';

const smooth = (current, target, dt, rate = 12) => {
  const blend = 1 - Math.exp(-rate * Math.min(dt, 0.1));
  return THREE.MathUtils.lerp(current, target, blend);
};

const mix = (from, to, amount) => THREE.MathUtils.lerp(from, to, amount);

export class CharacterAnimator {
  constructor(root) {
    this.root = root;
    this.torso = root.getObjectByName('anim-torso');
    this.head = root.getObjectByName('anim-head');
    this.leftArm = root.getObjectByName('anim-left-arm');
    this.rightArm = root.getObjectByName('anim-right-arm');
    this.leftElbow = root.getObjectByName('anim-left-elbow');
    this.rightElbow = root.getObjectByName('anim-right-elbow');
    this.leftLeg = root.getObjectByName('anim-left-leg');
    this.rightLeg = root.getObjectByName('anim-right-leg');
    this.leftKnee = root.getObjectByName('anim-left-knee');
    this.rightKnee = root.getObjectByName('anim-right-knee');
    this.cape = root.getObjectByName('anim-cape');
    this.weapon = root.getObjectByName('anim-weapon');
    this.phase = 0;
    this.idlePhase = Math.random() * Math.PI * 2;
    this.weights = {
      move: 0,
      sprint: 0,
      air: 0,
      slide: 0,
      vault: 0,
      attack: 0,
      cast: 0,
      hit: 0,
    };
    this.wasGrounded = true;
    this.landingTime = 1;
  }

  update(dt, state = {}) {
    if (!this.root) return;

    const frame = Math.min(Math.max(dt, 0), 0.1);
    const moving = Boolean(state.moving);
    const sprinting = Boolean(state.sprinting);
    const grounded = state.grounded !== false;
    const sliding = Boolean(state.sliding);
    const vaulting = Boolean(state.vaulting);
    const casting = Boolean(state.casting);
    const forward = THREE.MathUtils.clamp(state.forward || 0, -1, 1);
    const strafe = THREE.MathUtils.clamp(state.strafe || 0, -1, 1);
    const verticalVelocity = state.verticalVelocity || 0;

    if (!this.wasGrounded && grounded) this.landingTime = 0;
    this.wasGrounded = grounded;
    this.landingTime = Math.min(1, this.landingTime + frame / 0.22);

    const targets = {
      move: moving && grounded && !sliding && !vaulting ? 1 : 0,
      sprint: moving && sprinting && grounded && !sliding && !vaulting ? 1 : 0,
      air: !grounded && !vaulting ? 1 : 0,
      slide: sliding ? 1 : 0,
      vault: vaulting ? 1 : 0,
      attack: (state.attackProgress || 0) > 0 ? 1 : 0,
      cast: casting ? 1 : 0,
      hit: (state.hitProgress || 0) > 0 ? 1 : 0,
    };
    for (const key of Object.keys(this.weights)) {
      this.weights[key] = smooth(this.weights[key], targets[key], frame, key === 'hit' ? 22 : 13);
    }

    const gaitRate = mix(7.8, 12.6, this.weights.sprint);
    const direction = forward < -0.1 ? -1 : 1;
    this.phase += frame * gaitRate * direction;
    this.idlePhase += frame * 1.8;

    const w = this.weights;
    const gait = Math.sin(this.phase);
    const counterGait = Math.sin(this.phase + Math.PI);
    const stride = mix(0.56, 0.9, w.sprint) * w.move;
    const armSwing = mix(0.42, 0.68, w.sprint) * w.move;
    const idleBreath = Math.sin(this.idlePhase);
    const slideProgress = THREE.MathUtils.clamp(state.slideProgress || 0, 0, 1);
    const vaultProgress = THREE.MathUtils.clamp(state.vaultProgress || 0, 0, 1);
    const attackEnvelope = Math.sin(Math.PI * THREE.MathUtils.clamp(state.attackProgress || 0, 0, 1));
    const hitEnvelope = Math.sin(Math.PI * THREE.MathUtils.clamp(state.hitProgress || 0, 0, 1)) * w.hit;
    const landing = (1 - this.landingTime) * (grounded ? 1 : 0);
    const rising = verticalVelocity > 0.5 ? 1 : 0;

    let leftLegX = gait * stride;
    let rightLegX = counterGait * stride;
    let leftKneeX = 0.04 + Math.max(0, -gait) * 0.48 * w.move;
    let rightKneeX = 0.04 + Math.max(0, -counterGait) * 0.48 * w.move;
    let leftArmX = -gait * armSwing;
    let rightArmX = -counterGait * armSwing;
    let leftElbowX = 0.08 + 0.22 * w.move + 0.12 * w.sprint;
    let rightElbowX = 0.08 + 0.22 * w.move + 0.12 * w.sprint;
    let leftArmZ = 0.04 + strafe * 0.1 * w.move;
    let rightArmZ = -0.04 + strafe * 0.1 * w.move;
    let torsoX = -0.15 * w.sprint + 0.018 * idleBreath;
    let torsoZ = -strafe * 0.13 * w.move + Math.sin(this.phase * 2) * 0.025 * w.move;
    let headX = 0.015 * idleBreath;
    let headZ = strafe * 0.035 * w.move;
    let rootX = -0.72 * w.slide;
    let rootZ = -strafe * 0.1 * w.move;

    // Airborne poses tuck the legs and keep the arms out for balance.
    leftLegX = mix(leftLegX, 0.78 + rising * 0.12, w.air);
    rightLegX = mix(rightLegX, -0.48 + rising * 0.12, w.air);
    leftKneeX = mix(leftKneeX, 0.9, w.air);
    rightKneeX = mix(rightKneeX, 0.9, w.air);
    leftArmX = mix(leftArmX, -0.92, w.air);
    rightArmX = mix(rightArmX, -0.92, w.air);
    leftElbowX = mix(leftElbowX, 0.22, w.air);
    rightElbowX = mix(rightElbowX, 0.22, w.air);
    leftArmZ = mix(leftArmZ, 0.38, w.air);
    rightArmZ = mix(rightArmZ, -0.38, w.air);
    torsoX = mix(torsoX, -0.2, w.air);

    // A vault reaches forward, then draws the knees in for a clean landing.
    leftLegX = mix(leftLegX, mix(0.88, 0.34, vaultProgress), w.vault);
    rightLegX = mix(rightLegX, mix(-0.52, 0.28, vaultProgress), w.vault);
    leftKneeX = mix(leftKneeX, 0.84, w.vault);
    rightKneeX = mix(rightKneeX, 0.84, w.vault);
    leftArmX = mix(leftArmX, -1.08, w.vault);
    rightArmX = mix(rightArmX, -1.08, w.vault);
    leftElbowX = mix(leftElbowX, 0.38, w.vault);
    rightElbowX = mix(rightElbowX, 0.38, w.vault);
    torsoX = mix(torsoX, -0.28, w.vault);

    // Sliding lowers the center of mass and sweeps the arms back.
    leftLegX = mix(leftLegX, mix(0.95, 0.68, slideProgress), w.slide);
    rightLegX = mix(rightLegX, mix(0.22, -0.08, slideProgress), w.slide);
    leftKneeX = mix(leftKneeX, 0.75, w.slide);
    rightKneeX = mix(rightKneeX, 0.75, w.slide);
    leftArmX = mix(leftArmX, -0.62, w.slide);
    rightArmX = mix(rightArmX, -0.62, w.slide);
    leftElbowX = mix(leftElbowX, 0.2, w.slide);
    rightElbowX = mix(rightElbowX, 0.2, w.slide);
    torsoX = mix(torsoX, 0.36, w.slide);

    // Brief compression sells the impact when a jump or vault lands.
    leftLegX += 0.42 * landing;
    rightLegX += 0.42 * landing;
    leftKneeX += 0.28 * landing;
    rightKneeX += 0.28 * landing;
    torsoX += 0.08 * landing;

    // The saboteur's gauntlet stays raised while a placement is being cast.
    rightArmX = mix(rightArmX, -1.22 + Math.sin(this.idlePhase * 5) * 0.06, w.cast);
    rightArmZ = mix(rightArmZ, -0.18, w.cast);

    // Knife attacks add a quick shoulder turn and a broad arm sweep.
    rightArmX += -1.15 * attackEnvelope * w.attack;
    rightArmZ += -0.72 * attackEnvelope * w.attack;
    rightElbowX += 0.2 * attackEnvelope * w.attack;
    torsoZ += 0.22 * attackEnvelope * w.attack;

    // A short flinch follows damage, with the head and shoulder leading.
    torsoX += 0.12 * hitEnvelope;
    torsoZ += 0.32 * hitEnvelope;
    headX += 0.18 * hitEnvelope;

    if (this.leftLeg) this.leftLeg.rotation.set(leftLegX, 0, 0);
    if (this.rightLeg) this.rightLeg.rotation.set(rightLegX, 0, 0);
    if (this.leftKnee) this.leftKnee.rotation.set(leftKneeX, 0, 0);
    if (this.rightKnee) this.rightKnee.rotation.set(rightKneeX, 0, 0);
    if (this.leftArm) this.leftArm.rotation.set(leftArmX + 0.018 * idleBreath, 0, leftArmZ);
    if (this.rightArm) this.rightArm.rotation.set(rightArmX + 0.018 * idleBreath, 0, rightArmZ);
    if (this.leftElbow) this.leftElbow.rotation.set(leftElbowX, 0, 0);
    if (this.rightElbow) this.rightElbow.rotation.set(rightElbowX, 0, 0);
    if (this.torso) {
      this.torso.rotation.set(torsoX, 0, torsoZ);
      this.torso.position.y = 1.08 + 0.012 * idleBreath + 0.025 * w.move * Math.abs(gait);
    }
    if (this.head) this.head.rotation.set(headX, 0, headZ);
    this.root.rotation.x = rootX;
    this.root.rotation.z = rootZ;

    if (this.weapon) {
      this.weapon.rotation.x = smooth(this.weapon.rotation.x, -1.6 * attackEnvelope * w.attack, frame, 20);
      this.weapon.rotation.z = smooth(this.weapon.rotation.z, 0.38 + 0.7 * attackEnvelope * w.attack, frame, 20);
    }

    if (this.cape) {
      this.cape.rotation.x = 0.08 + w.move * (0.12 + w.sprint * 0.2) + w.slide * 0.16;
      this.cape.rotation.z = -strafe * 0.12 * w.move + Math.sin(this.phase * 0.7) * 0.05;
    }
  }
}
