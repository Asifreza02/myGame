'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine.js';
import { AimReticle } from './components/AimReticle.jsx';
import { DamageOverlay } from './components/DamageOverlay.jsx';
import { TopHud } from './components/TopHud.jsx';
import { RunnerHud } from './components/RunnerHud.jsx';
import { SaboteurHud } from './components/SaboteurHud.jsx';
import { PlacementIndicator } from './components/PlacementIndicator.jsx';
import { RoleSelectModal } from './components/RoleSelectModal.jsx';
import { GameOverModal } from './components/GameOverModal.jsx';
import { VirtualJoystick } from './components/mobile/VirtualJoystick.jsx';
import { TouchLookZone } from './components/mobile/TouchLookZone.jsx';
import { MobileActionPad } from './components/mobile/MobileActionPad.jsx';

export function App() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);

  const [engineState, setEngineState] = useState({
    gameState: 'ROLE_SELECT',
    activeRole: 'runner',
    isLocalDual: false,
    roomCode: 'default',
    timeRemaining: 120,
    playerCounts: { runner: 1, saboteur: 0, spectator: 0 },
    environment: { biome: null, todName: '☀️ DAYTIME', todClass: 'noon' },
    runnerStats: {
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
      distanceToBeacon: 0,
      compassAngle: 0,
      sensitivity: 1.2,
      buffs: [],
      craftingInventory: { resources: {}, items: {} },
    },
    saboteurStats: {
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
      energy: 100,
      maxEnergy: 100,
      reconCooldown: 14,
      reconCooldownTimer: 0,
      selectedType: 'WALL',
      isPlacing: true,
      sensitivity: 1.2,
      buffs: [],
    },
    placementData: {
      visible: false,
      selectedType: 'WALL',
      dist: 16.0,
      maxDist: 75.0,
      hasEnergy: true,
      cost: 30,
      currentEnergy: 100,
      inRange: true,
      isInsideSanctuary: false,
      isValidPlacement: true,
    },
    gameOverData: null,
    isPointerLocked: false,
    damageFlash: 0,
    toastMessage: null,
    aiEnabled: true,
    humanSaboteurAvailable: false,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new GameEngine(containerRef.current, (snapshot) => {
      setEngineState((prev) => ({ ...prev, ...snapshot }));
    });
    engineRef.current = engine;

    // Handle Tab key in Local Dual mode
    const handleKeyDown = (e) => {
      if (e.code === 'Tab' && engine.isLocalDual) {
        e.preventDefault();
        const nextRole = engine.activeRole === 'runner' ? 'saboteur' : 'runner';
        engine.setRole(nextRole);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      engine.destroy();
    };
  }, []);

  const handleSelectRole = useCallback((role, room) => {
    if (!engineRef.current) return;
    if (room && room !== engineRef.current.roomCode) {
      window.location.href = `?role=${encodeURIComponent(role)}&room=${encodeURIComponent(room)}`;
      return;
    }
    engineRef.current.selectRole(role);
  }, []);

  const handleSelectLocalDual = useCallback((room) => {
    if (!engineRef.current) return;
    if (engineRef.current.returningToMenu) {
      window.location.href = '?mode=local';
      return;
    }
    if (room && room !== engineRef.current.roomCode) {
      window.location.href = `?mode=local&room=${encodeURIComponent(room)}`;
      return;
    }
    engineRef.current.setLocalDual(true);
  }, []);

  const handleToggleAI = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.toggleAISaboteur();
    }
  }, []);

  const handleLookAtGoal = useCallback(() => {
    if (engineRef.current) engineRef.current.lookAtGoal();
  }, []);

  const handleLookBehind = useCallback(() => {
    if (engineRef.current) engineRef.current.lookBehind();
  }, []);

  const handleToggleSteering = useCallback(() => {
    if (engineRef.current && engineRef.current.runner) {
      engineRef.current.runner.startSlide();
    }
  }, []);

  const handleCycleRunnerSens = useCallback(() => {
    if (engineRef.current) engineRef.current.cycleRunnerSensitivity();
  }, []);

  const handleCraftPowerUp = useCallback((recipeId) => {
    if (engineRef.current) engineRef.current.craftPowerUp(recipeId);
  }, []);

  const handleUsePowerUp = useCallback((itemId) => {
    if (engineRef.current) engineRef.current.usePowerUp(itemId);
  }, []);

  const handleCycleSaboteurSens = useCallback(() => {
    if (engineRef.current) engineRef.current.cycleSaboteurSensitivity();
  }, []);

  const handleSelectObstacle = useCallback((type) => {
    if (engineRef.current) engineRef.current.selectObstacle(type);
  }, []);

  const handleTriggerRecon = useCallback(() => {
    if (engineRef.current) engineRef.current.triggerReconPulse();
  }, []);

  const handleRestart = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.returnToMenu();
  }, []);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [orientationMessage, setOrientationMessage] = useState(
    'If your phone does not rotate, enable Auto-rotate and turn it sideways.',
  );

  useEffect(() => {
    const checkTouch = () => {
      return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 1024
      );
    };
    setIsTouchDevice(checkTouch());

    const handleResize = () => {
      setIsTouchDevice(checkTouch());
    };
    const handleTouch = () => setIsTouchDevice(true);

    window.addEventListener('resize', handleResize);
    window.addEventListener('touchstart', handleTouch, { once: true, passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, []);

  const handleJoystickChange = useCallback((vec) => {
    if (engineRef.current) engineRef.current.setJoystick(vec.x, vec.y);
  }, []);

  const handleLookDrag = useCallback((deltaYaw) => {
    if (engineRef.current) engineRef.current.addLookYaw(deltaYaw);
  }, []);

  const handleDragItemPlacement = useCallback((deltaX, deltaY) => {
    if (engineRef.current) engineRef.current.dragItemPlacement(deltaX, deltaY);
  }, []);

  const handleJump = useCallback(() => {
    if (engineRef.current) engineRef.current.jump();
  }, []);

  const handleSlide = useCallback(() => {
    if (engineRef.current) engineRef.current.slide();
  }, []);

  const handleSprintToggle = useCallback((active) => {
    if (engineRef.current) engineRef.current.setSprint(active);
  }, []);

  const handleDeploy = useCallback(() => {
    if (engineRef.current) engineRef.current.deployObstacle();
  }, []);

  const handleRotate = useCallback(() => {
    if (engineRef.current) engineRef.current.rotatePlacement();
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (engineRef.current) engineRef.current.toggleFullscreen();
  }, []);

  const handleRequestLandscape = useCallback(async () => {
    try {
      const root = document.documentElement;
      if (!document.fullscreenElement && root.requestFullscreen) {
        await root.requestFullscreen();
      }

      if (screen.orientation?.lock) {
        await screen.orientation.lock('landscape');
        setOrientationMessage('Landscape enabled. Rotate your phone if the screen does not turn.');
      } else {
        setOrientationMessage(
          'This browser cannot rotate automatically. Enable Auto-rotate and turn your phone sideways.',
        );
      }
    } catch (error) {
      console.warn('Could not lock the screen to landscape:', error);
      setOrientationMessage(
        'Landscape lock was blocked. Enable Auto-rotate and turn your phone sideways.',
      );
    }
  }, []);

  const handleLockRequest = useCallback(() => {
    if (engineRef.current) engineRef.current.requestPointerLock();
  }, []);

  const isRunner = engineState.activeRole === 'runner' || engineState.isLocalDual;
  const isSaboteur = engineState.activeRole === 'saboteur' || (engineState.isLocalDual && engineState.activeRole === 'saboteur');
  const isPlacingMode =
    isSaboteur &&
    engineState.saboteurStats.isPlacing &&
    Boolean(engineState.saboteurStats.selectedType);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Three.js Container */}
      <div id="canvas-container" ref={containerRef} />
      <div className="orientation-hint" role="status">
        <span className="orientation-icon" aria-hidden="true">↻</span>
        <span>Play AetherBound in landscape</span>
        <button
          type="button"
          className="orientation-button interactive"
          onClick={handleRequestLandscape}
        >
          TRY LANDSCAPE
        </button>
        <span className="orientation-message">{orientationMessage}</span>
      </div>

      {/* Reticle */}
      <AimReticle
        visible={engineState.gameState === 'PLAYING'}
        isPointerLocked={engineState.isPointerLocked}
        onLockRequest={handleLockRequest}
      />

      {/* Damage Flash */}
      <DamageOverlay damageFlash={engineState.damageFlash} />

      {/* Top HUD */}
      {engineState.gameState !== 'ROLE_SELECT' && (
        <TopHud
          timeRemaining={engineState.timeRemaining}
          activeRole={engineState.activeRole}
          roomCode={engineState.roomCode}
          playerCounts={engineState.playerCounts}
          environment={engineState.environment}
          aiEnabled={engineState.aiEnabled}
          humanSaboteurAvailable={engineState.humanSaboteurAvailable}
          onToggleAI={handleToggleAI}
          toastMessage={engineState.toastMessage}
          isLocalDual={engineState.isLocalDual}
        />
      )}

      {/* Runner HUD */}
      {engineState.gameState === 'PLAYING' && isRunner && engineState.activeRole === 'runner' && (
        <RunnerHud
          stats={engineState.runnerStats}
          onLookAtGoal={handleLookAtGoal}
          onLookBehind={handleLookBehind}
          onToggleSteering={handleToggleSteering}
          onCycleSens={handleCycleRunnerSens}
          onCraft={handleCraftPowerUp}
          onUse={handleUsePowerUp}
        />
      )}

      {/* Saboteur HUD */}
      {engineState.gameState === 'PLAYING' && isSaboteur && (
        <>
          <PlacementIndicator data={engineState.placementData} />
          <SaboteurHud
            stats={engineState.saboteurStats}
            onSelectObstacle={handleSelectObstacle}
            onTriggerRecon={handleTriggerRecon}
            onCycleSens={handleCycleSaboteurSens}
            onLookAtGoal={handleLookAtGoal}
            onLookBehind={handleLookBehind}
          />
        </>
      )}

      {/* Mobile Touch Controls */}
      {engineState.gameState === 'PLAYING' && isTouchDevice && (
        <>
          <TouchLookZone
            isPlacing={isPlacingMode}
            onLookDrag={handleLookDrag}
            onDragItemPlacement={handleDragItemPlacement}
          />
          <VirtualJoystick onChange={handleJoystickChange} />
          <MobileActionPad
            activeRole={engineState.activeRole}
            isPlacing={isPlacingMode}
            onJump={handleJump}
            onSlide={handleSlide}
            onSprintToggle={handleSprintToggle}
            onDeploy={handleDeploy}
            onRotate={handleRotate}
            onRecon={handleTriggerRecon}
            onFaceGoal={handleLookAtGoal}
            onTurnBehind={handleLookBehind}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </>
      )}

      {/* Role Select Modal */}
      <RoleSelectModal
        visible={engineState.gameState === 'ROLE_SELECT'}
        currentRoom={engineState.roomCode}
        message={engineState.roleSelectMessage}
        onSelectRole={handleSelectRole}
        onSelectLocalDual={handleSelectLocalDual}
      />

      {/* Game Over Modal */}
      <GameOverModal
        data={engineState.gameOverData}
        onRestart={handleRestart}
      />
    </div>
  );
}

export default App;
