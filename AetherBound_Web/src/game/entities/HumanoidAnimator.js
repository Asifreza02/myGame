import * as THREE from 'three';

const damp = (current, target, dt, rate = 12) => {
  const blend = 1 - Math.exp(-rate * Math.min(Math.max(dt, 0), 0.1));
  return THREE.MathUtils.lerp(current, target, blend);
};

const getClipActionName = (clip) => clip.name.split('|').at(-1).toLowerCase();

export class HumanoidAnimator {
  constructor(poseRoot, model, clips = model.animations || []) {
    this.poseRoot = poseRoot;
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = new Map();
    this.activeAction = null;
    this.activeKey = null;
    this.weapon = model.getObjectByName('anim-weapon');

    const clipFor = (names) => clips.find((clip) => names.includes(getClipActionName(clip)));
    const idleClip = clipFor(['idle']);
    const walkClip = clipFor(['walk']) || idleClip;
    const runClip = clipFor(['run']) || walkClip;
    const jumpClip = clipFor(['jump']) || runClip;
    const attackClip = clipFor(['punch', 'attack']) || runClip;

    for (const [key, clip] of Object.entries({
      idle: idleClip,
      walk: walkClip,
      run: runClip,
      jump: jumpClip,
      attack: attackClip,
    })) {
      if (clip) this.actions.set(key, this.mixer.clipAction(clip));
    }

    this.update(0, { grounded: true });
  }

  selectAction(key) {
    const action = this.actions.get(key) || this.actions.get('idle');
    if (!action || action === this.activeAction) return;

    const previous = this.activeAction;
    if (key !== 'attack' && key !== 'jump') {
      if (previous && (this.activeKey === 'walk' || this.activeKey === 'run') && (key === 'walk' || key === 'run')) {
        // Synchronize stride phase between walk and run so character limbs don't snap/break
        const prevDuration = previous.getClip().duration || 1;
        const nextDuration = action.getClip().duration || 1;
        const phase = (previous.time / prevDuration) % 1;
        action.time = phase * nextDuration;
      } else {
        action.reset();
      }
    } else {
      action.reset();
    }

    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    if (key === 'attack' || key === 'jump') {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    }
    action.play();
    if (previous) action.crossFadeFrom(previous, 0.18, false);
    this.activeAction = action;
    this.activeKey = key;
  }

  update(dt, state = {}) {
    if (!this.poseRoot || !this.mixer) return;

    const frame = Math.min(Math.max(dt, 0), 0.1);
    const attackProgress = THREE.MathUtils.clamp(state.attackProgress || 0, 0, 1);

    // Airborne hysteresis / coyote time prevents 1-frame terrain bumps from snapping into jump
    if (state.grounded !== false) {
      this.airborneTimer = 0;
    } else {
      this.airborneTimer = (this.airborneTimer || 0) + frame;
    }
    const isReallyAirborne = (!state.grounded && (this.airborneTimer > 0.28 || (state.verticalVelocity && state.verticalVelocity > 2.5))) || Boolean(state.vaulting);

    const actionKey = attackProgress > 0
      ? 'attack'
      : isReallyAirborne
        ? 'jump'
        : state.moving
          ? (state.sprinting ? 'run' : 'walk')
          : 'idle';

    this.selectAction(actionKey);
    if (actionKey === 'attack' && this.activeAction) {
      this.activeAction.time = this.activeAction.getClip().duration * attackProgress;
    }
    this.mixer.update(frame);

    const slide = state.sliding ? 1 : 0;
    const vault = state.vaulting ? 1 : 0;
    const hitProgress = THREE.MathUtils.clamp(state.hitProgress || 0, 0, 1);
    const hit = Math.sin(Math.PI * hitProgress);
    const strafe = THREE.MathUtils.clamp(state.strafe || 0, -1, 1);
    const sprintLean = state.moving && state.sprinting ? 0.07 : 0;
    const aimPitch = THREE.MathUtils.clamp(state.pitch || 0, -0.75, 1.15);

    this.poseRoot.rotation.x = damp(
      this.poseRoot.rotation.x,
      -aimPitch * 0.32 + sprintLean + slide * 0.82 + vault * 0.12,
      frame,
      16,
    );
    this.poseRoot.rotation.z = damp(
      this.poseRoot.rotation.z,
      -strafe * 0.05 + hit * 0.07, // Subtle tactile flinch instead of breaking/twisting the spine
      frame,
      14,
    );
    this.poseRoot.position.y = damp(this.poseRoot.position.y, -slide * 0.16, frame, 16);

    if (this.weapon) {
      const attackEnvelope = Math.sin(Math.PI * attackProgress);
      this.weapon.rotation.z = damp(this.weapon.rotation.z, attackEnvelope * 0.16, frame, 20);
    }
  }
}
