import { GAME_CONFIG, OBSTACLES } from './config.js';
import { audio } from './audio.js';

export class AISaboteur {
  constructor(worldManager, obstacleManager, onPlaceCallback, saboteurController = null, onToast = null) {
    this.worldManager = worldManager;
    this.obstacleManager = obstacleManager;
    this.onPlaceCallback = onPlaceCallback;
    this.saboteurController = saboteurController;
    this.onToast = onToast;

    this.enabled = true;
    this.timer = 0;
    this.interval = 5.5; // Every 5.5 seconds, deploy an obstacle in front of runner
    this.minDistanceAhead = 14;
    this.maxDistanceAhead = 22;

    this.obstaclePool = ['WALL', 'MUD', 'SPIKES', 'BOULDER', 'BARREL', 'WALL'];
    this.poolIndex = 0;

    // Tactical AI character maneuver state
    this.currentPos = { x: 25, z: 25 };
    this.flankAngle = 0.6;
  }

  update(dt, runner, goalBeacon, isSinglePlayer) {
    if (!this.enabled || !isSinglePlayer || !runner) return;

    this.timer += dt;

    // Animate AI Saboteur Character position in world
    if (this.saboteurController) {
      const runnerPos = runner.position;
      const runnerHeading = runner.rotationY;

      // Position Saboteur at an elevated tactical flanking angle ahead of the Runner
      const aheadDist = 28.0;
      const lateralDist = 12.0 * Math.sin(Date.now() * 0.001);

      const fX = Math.sin(runnerHeading);
      const fZ = Math.cos(runnerHeading);
      const pX = -fZ;
      const pZ = fX;

      const targetX = runnerPos.x + fX * aheadDist + pX * lateralDist;
      const targetZ = runnerPos.z + fZ * aheadDist + pZ * lateralDist;

      // Smooth interpolation toward target position
      this.currentPos.x += (targetX - this.currentPos.x) * 2.0 * dt;
      this.currentPos.z += (targetZ - this.currentPos.z) * 2.0 * dt;

      this.saboteurController.setAIState(
        this.currentPos.x,
        this.currentPos.z,
        runnerPos.x,
        runnerPos.z,
        false
      );
    }

    if (this.timer >= this.interval) {
      this.timer = 0;
      this.deployObstacleAhead(runner, goalBeacon);
    }
  }

  deployObstacleAhead(runner, goalBeacon) {
    const runnerPos = runner.position;
    const runnerHeading = runner.rotationY;

    // Determine forward vector
    let forwardX = Math.sin(runnerHeading);
    let forwardZ = Math.cos(runnerHeading);

    // If runner is not actively moving, aim in the direction of the Beacon Goal
    const isMoving = runner.keys.forward || runner.keys.backward || runner.keys.left || runner.keys.right;
    if (!isMoving && goalBeacon) {
      const dx = goalBeacon.position.x - runnerPos.x;
      const dz = goalBeacon.position.z - runnerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 1) {
        forwardX = dx / dist;
        forwardZ = dz / dist;
      }
    }

    // Distance in front of the player
    const distAhead = this.minDistanceAhead + Math.random() * (this.maxDistanceAhead - this.minDistanceAhead);

    // Add a slight natural lateral variance (-3 to +3 meters)
    const perpX = -forwardZ;
    const perpZ = forwardX;
    const lateralOffset = (Math.random() - 0.5) * 4.0;

    const targetX = runnerPos.x + forwardX * distAhead + perpX * lateralOffset;
    const targetZ = runnerPos.z + forwardZ * distAhead + perpZ * lateralOffset;

    // Disallow placement within 20m of Goal Beacon
    if (goalBeacon) {
      const dx = targetX - goalBeacon.position.x;
      const dz = targetZ - goalBeacon.position.z;
      const distToGoal = Math.sqrt(dx * dx + dz * dz);
      const sanctuaryRadius = GAME_CONFIG.GOAL.PROTECTED_RADIUS || 20.0;
      if (distToGoal < sanctuaryRadius) {
        return; // Target falls inside 20m sanctuary zone - do not deploy
      }
    }

    const targetY = this.worldManager.getHeightAt(targetX, targetZ);

    // Perpendicular angle so walls & spikes block the pathway
    const pathAngle = Math.atan2(forwardX, forwardZ);
    const placementRotationY = pathAngle + Math.PI / 2;

    // Pick obstacle
    const type = this.obstaclePool[this.poolIndex % this.obstaclePool.length];
    this.poolIndex++;

    const targetPos = { x: targetX, y: targetY, z: targetZ };
    const rotation = { x: 0, y: placementRotationY, z: 0 };

    // Trigger AI Saboteur character cast animation
    if (this.saboteurController) {
      this.saboteurController.setAIState(
        this.currentPos.x,
        this.currentPos.z,
        targetX,
        targetZ,
        true
      );
    }

    // Place obstacle
    if (this.onPlaceCallback) {
      this.onPlaceCallback(type, targetPos, rotation);
    }

    // Trigger HUD warning and sound
    this.showWarningToast(type, distAhead);
    audio.playTrapTrigger();
  }

  showWarningToast(type, distance) {
    const def = OBSTACLES[type];
    const name = def ? def.name : type;
    const msg = `⚠️ AI SABOTEUR: ${name.toUpperCase()} DEPLOYED ${Math.round(distance)}M AHEAD!`;
    if (this.onToast) {
      this.onToast(msg);
    } else if (typeof document !== 'undefined') {
      const toast = document.getElementById('ai-hazard-toast');
      if (toast) {
        toast.innerText = msg;
        toast.className = 'toast-show';
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
          toast.className = 'toast-hide';
        }, 2800);
      }
    }
  }
}
