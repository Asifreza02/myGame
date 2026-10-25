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
import { CraftingModal } from './components/CraftingModal.jsx';
import { GameOverModal } from './components/GameOverModal.jsx';
import { VirtualJoystick } from './components/mobile/VirtualJoystick.jsx';
import { TouchLookZone } from './components/mobile/TouchLookZone.jsx';
import { MobileActionPad } from './components/mobile/MobileActionPad.jsx';
import { ITEM_DEFINITIONS } from './game/data/combat.js';

export function App() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);

  const [engineState, setEngineState] = useState({
    gameState: 'ROLE_SELECT',
    activeRole: 'player',
    roomCode: 'default',
    matchConfig: { mode: 'ffa', seed: null, maxPlayers: 5 },
    playerCounts: { total: 1, alive: 1, max: 5 },
    competitors: [],
    killfeed: [],
    inventory: [],
    weapons: ['KNIFE'],
    equippedWeapon: 'KNIFE',
    playerAmmo: {},
    craftingModalOpen: false,
    abilityCooldowns: {},
    environment: { biome: null, todName: '☀️ DAYTIME', todClass: 'noon' },
    runnerStats: {
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
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

    return () => {
      engine.destroy();
    };
  }, []);

  const handleSelectRole = useCallback((role, room, matchConfig = engineRef.current?.matchConfig, playerName = '') => {
    if (!engineRef.current) return;
    if (room) {
      const cleanRoom = String(room).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
      const query = new URLSearchParams({
        role: 'player',
        room: cleanRoom,
        mode: matchConfig?.mode || 'ffa',
      });
      if (matchConfig?.seed) query.set('seed', String(matchConfig.seed));
      if (matchConfig?.fillBots !== undefined) query.set('bots', String(matchConfig.fillBots));
      if (playerName) query.set('name', playerName.trim().slice(0, 20));
      window.location.href = `?${query.toString()}`;
      return;
    }
    engineRef.current.selectRole(role);
  }, []);

  const handleShareRoom = useCallback(async (customCode = null) => {
    try {
      const currentCode = (customCode || engineState.roomCode || 'default').toUpperCase();
      const inviteUrl = window.location.href;
      await navigator.clipboard.writeText(inviteUrl);
      engineRef.current?.showToast(`Room code ${currentCode} & link copied! Share with up to 4 rivals.`);
    } catch (error) {
      console.warn('Could not copy the room link:', error);
      engineRef.current?.showToast(`Room code: ${engineState.roomCode}`);
    }
  }, [engineState.roomCode]);

  const handleToggleAI = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.toggleAISaboteur();
    }
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

  const handleOpenCrafting = useCallback(() => {
    if (engineRef.current) engineRef.current.setCraftingModalOpen(true);
  }, []);

  const handleCloseCrafting = useCallback(() => {
    if (engineRef.current) engineRef.current.setCraftingModalOpen(false);
  }, []);

  const handleCraftWeapon = useCallback((recipeIndex) => {
    if (engineRef.current) engineRef.current.craftWeapon(recipeIndex);
  }, []);

  const handleEquipWeapon = useCallback((weaponId) => {
    if (engineRef.current) engineRef.current.equipWeapon(weaponId);
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

  const handleLookDrag = useCallback((deltaYaw, deltaPitch) => {
    if (engineRef.current) engineRef.current.addLook(deltaYaw, deltaPitch);
  }, []);

  const handleDragItemPlacement = useCallback((deltaX, deltaY) => {
    if (engineRef.current) engineRef.current.dragItemPlacement(deltaX, deltaY);
  }, []);

  const handleJump = useCallback(() => {
    if (engineRef.current) engineRef.current.jump();
  }, []);

  const handleKnifeAttack = useCallback(() => {
    if (engineRef.current) engineRef.current.attack();
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

  const isRunner = engineState.activeRole === 'player';
  const isSaboteur = false;
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
          roomCode={engineState.roomCode}
          playerCounts={engineState.playerCounts}
          competitors={engineState.competitors}
          killfeed={engineState.killfeed}
          playerId={engineState.playerId}
          environment={engineState.environment}
          dragon={engineState.dragon}
          matchConfig={engineState.matchConfig}
          toastMessage={engineState.toastMessage}
          onExitToLobby={handleRestart}
          onShareRoom={handleShareRoom}
        />
      )}

      {/* Runner HUD */}
      {engineState.gameState === 'PLAYING' && isRunner && (
        <RunnerHud
          stats={engineState.runnerStats}
          resources={engineState.playerResources}
          equippedWeapon={engineState.equippedWeapon || 'KNIFE'}
          weapons={engineState.weapons || ['KNIFE']}
          ammo={engineState.playerAmmo || {}}
          onOpenCrafting={handleOpenCrafting}
          onEquipWeapon={handleEquipWeapon}
          onToggleSteering={handleToggleSteering}
          onCycleSens={handleCycleRunnerSens}
          onCraft={handleCraftPowerUp}
          onUse={handleUsePowerUp}
        />
      )}

      {engineState.gameState === 'PLAYING' && isRunner && engineState.inventory?.length > 0 && (
        <div id="ability-hotbar" aria-label="Scavenged abilities">
          {engineState.inventory.map((ability, index) => {
            const definition = ITEM_DEFINITIONS[ability];
            const readyAt = engineState.abilityCooldowns?.[ability] || 0;
            const cooldownSeconds = Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
            return (
              <button key={ability} type="button" className="interactive" disabled={cooldownSeconds > 0} onClick={() => engineRef.current?.activateAbility(ability)} title={definition?.description || ability}>
                {index + 1} · {definition?.name || ability} {cooldownSeconds > 0 ? `${cooldownSeconds}s` : 'READY'}
              </button>
            );
          })}
        </div>
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
            onAttack={handleKnifeAttack}
            onSlide={handleSlide}
            onSprintToggle={handleSprintToggle}
            onDeploy={handleDeploy}
            onRotate={handleRotate}
            onRecon={handleTriggerRecon}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </>
      )}

      {/* Weapon Forge / Crafting Modal */}
      <CraftingModal
        visible={Boolean(engineState.craftingModalOpen)}
        resources={engineState.playerResources || {}}
        weapons={engineState.weapons || ['KNIFE']}
        ammo={engineState.playerAmmo || {}}
        equippedWeapon={engineState.equippedWeapon || 'KNIFE'}
        onCraft={handleCraftWeapon}
        onEquip={handleEquipWeapon}
        onClose={handleCloseCrafting}
      />

      {/* Role Select Modal */}
      <RoleSelectModal
        visible={engineState.gameState === 'ROLE_SELECT'}
        currentRoom={engineState.roomCode}
        currentConfig={engineState.matchConfig}
        message={engineState.roleSelectMessage}
        onSelectRole={handleSelectRole}
      />

      {/* Game Over Modal */}
      <GameOverModal
        data={engineState.gameOverData}
        history={engineState.matchHistory}
        onRestart={handleRestart}
      />
    </div>
  );
}

export default App;
