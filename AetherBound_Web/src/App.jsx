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
import { EquipmentToggleBar } from './components/EquipmentToggleBar.jsx';
import { BackpackModal } from './components/BackpackModal.jsx';
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
    hasTarget: false,
    aimAssistActive: false,
    targetName: '',
    backpackModalOpen: false,
    equippedStick: 'APPRENTICE_STICK',
    powerSlots: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', null, null, null, null],
    backpack: {
      sticks: ['APPRENTICE_STICK'],
      powers: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP'],
      resources: {},
    },
    statusEffects: [],
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
    if (engineRef.current) {
      engineRef.current.launchGame(role, room, matchConfig, playerName);
      return;
    }
    const cleanRoom = String(room || 'DEFAULT').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
    const query = new URLSearchParams({
      role: 'player',
      room: cleanRoom,
      mode: matchConfig?.mode || 'ffa',
    });
    if (matchConfig?.seed) query.set('seed', String(matchConfig.seed));
    if (matchConfig?.fillBots !== undefined) query.set('bots', String(matchConfig.fillBots));
    if (playerName) query.set('name', playerName.trim().slice(0, 20));
    window.location.href = `?${query.toString()}`;
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

  const handleOpenBackpack = useCallback(() => {
    if (engineRef.current) engineRef.current.setBackpackModalOpen(true);
    else setEngineState((prev) => ({ ...prev, backpackModalOpen: true }));
  }, []);

  const handleCloseBackpack = useCallback(() => {
    if (engineRef.current) engineRef.current.setBackpackModalOpen(false);
    else setEngineState((prev) => ({ ...prev, backpackModalOpen: false }));
  }, []);

  const handleEquipStick = useCallback((stickId) => {
    if (engineRef.current?.selectStickSlot) {
      engineRef.current.selectStickSlot();
      if (stickId && stickId !== engineRef.current.equippedStick) {
        engineRef.current.equipStick(stickId);
      }
    } else {
      engineRef.current?.equipStick(stickId);
    }
  }, []);

  const handleSetPowerSlot = useCallback((slotIndex, powerId) => {
    if (engineRef.current) {
      engineRef.current.setPowerSlot(slotIndex, powerId);
    } else {
      setEngineState((prev) => {
        const nextSlots = [...(prev.powerSlots || [null, null, null, null, null, null, null])];
        nextSlots[slotIndex] = powerId;
        return { ...prev, powerSlots: nextSlots };
      });
    }
  }, []);

  const handleActivatePower = useCallback((powerId, slotIndex) => {
    if (engineRef.current) {
      if (typeof slotIndex === 'number') {
        if (engineRef.current.selectPowerSlot) {
          engineRef.current.selectPowerSlot(slotIndex);
        } else {
          engineRef.current.usePowerSlot(slotIndex);
        }
      } else if (powerId) {
        if (engineRef.current.selectPower) {
          engineRef.current.selectPower(powerId);
        } else {
          engineRef.current.activateAbility(powerId);
        }
      }
    }
  }, []);

  const handleCraftWeapon = useCallback((recipeIndex) => {
    if (engineRef.current) engineRef.current.craftWeapon(recipeIndex);
  }, []);

  const handleChannelAltar = useCallback(() => {
    if (engineRef.current) engineRef.current.channelAltarEssence();
  }, []);

  const handleQuickHeal = useCallback(() => {
    if (engineRef.current) engineRef.current.activateAbility('REJUVENATION');
  }, []);

  const handleEquipWeapon = useCallback((weaponId) => {
    if (engineRef.current) engineRef.current.equipWeapon(weaponId);
  }, []);

  const handleActivateAbility = useCallback((abilityId) => {
    if (engineRef.current) engineRef.current.activateAbility(abilityId);
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
  const [dismissOrientation, setDismissOrientation] = useState(false);
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

  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'KeyB' || e.code === 'KeyI') {
        e.preventDefault();
        setEngineState((prev) => {
          const next = !prev.backpackModalOpen;
          if (next && document.pointerLockElement) document.exitPointerLock?.();
          return { ...prev, backpackModalOpen: next };
        });
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
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

  const handleConfirmTrap = useCallback(() => {
    if (engineRef.current?.isPlacingTrap) engineRef.current.confirmTrapPlacement();
  }, []);

  const handleCancelTrap = useCallback(() => {
    if (engineRef.current?.isPlacingTrap) engineRef.current.cancelTrapTargeting();
  }, []);

  const handleToggleVoiceMute = useCallback(() => {
    engineRef.current?.toggleVoiceMute();
  }, []);

  const handleToggleVoiceDeafen = useCallback(() => {
    engineRef.current?.toggleVoiceDeafen();
  }, []);

  const handleTogglePushToTalk = useCallback(() => {
    if (engineRef.current && engineRef.current.voiceState) {
      engineRef.current.setVoicePushToTalk(!engineRef.current.voiceState.pushToTalk);
    }
  }, []);

  const handleVoicePttActive = useCallback((active) => {
    engineRef.current?.setVoicePttActive(active);
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
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Three.js Container */}
      <div id="canvas-container" ref={containerRef} />

      {/* Orientation hint for portrait gameplay */}
      {engineState.gameState === 'PLAYING' && !dismissOrientation && (
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
          <button
            type="button"
            className="orientation-dismiss-btn interactive"
            onClick={() => setDismissOrientation(true)}
          >
            CONTINUE IN PORTRAIT
          </button>
        </div>
      )}

      {/* Reticle */}
      <AimReticle
        visible={engineState.gameState === 'PLAYING'}
        isPointerLocked={engineState.isPointerLocked}
        hasTarget={engineState.hasTarget}
        aimAssistActive={engineState.aimAssistActive}
        targetName={engineState.targetName}
        onLockRequest={handleLockRequest}
      />

      {/* Damage & Status Effects Overlay */}
      <DamageOverlay
        damageFlash={engineState.damageFlash}
        statusEffects={engineState.statusEffects || []}
      />

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
          nearbyZombies={engineState.nearbyZombies || []}
          matchConfig={engineState.matchConfig}
          toastMessage={engineState.toastMessage}
          voiceState={engineState.voiceState || {}}
          onToggleVoiceMute={handleToggleVoiceMute}
          onToggleVoiceDeafen={handleToggleVoiceDeafen}
          onTogglePushToTalk={handleTogglePushToTalk}
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
          onQuickHeal={handleQuickHeal}
        />
      )}

      {/* On-Screen 1-Stick + 7-Powers Toggle Bar */}
      {engineState.gameState === 'PLAYING' && isRunner && (
        <EquipmentToggleBar
          equippedStick={engineState.equippedStick || engineState.equippedWeapon || 'APPRENTICE_STICK'}
          powerSlots={engineState.powerSlots || ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION', null, null, null]}
          selectedSlotIndex={engineState.selectedSlotIndex ?? 0}
          backpack={engineState.backpack || { sticks: ['APPRENTICE_STICK'], powers: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION'], resources: {} }}
          skillCounts={engineState.skillCounts || engineState.backpack?.skillCounts || {}}
          abilityCooldowns={engineState.abilityCooldowns || {}}
          stickCooldownMs={engineState.knifeCooldownMs || 0}
          onEquipStick={handleEquipStick}
          onActivatePower={handleActivatePower}
          onSetPowerSlot={handleSetPowerSlot}
          onOpenBackpack={handleOpenBackpack}
          onOpenCrafting={handleOpenCrafting}
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
            isPlacingTrap={Boolean(engineState.isPlacingTrap)}
            equippedWeapon={engineState.equippedWeapon || 'APPRENTICE_STICK'}
            equippedStick={engineState.equippedStick || engineState.equippedWeapon || 'APPRENTICE_STICK'}
            ammo={engineState.playerAmmo || {}}
            knifeCooldownMs={engineState.knifeCooldownMs || 0}
            voiceState={engineState.voiceState || {}}
            onToggleVoiceMute={handleToggleVoiceMute}
            onVoicePttActive={handleVoicePttActive}
            onJump={handleJump}
            onAttack={handleKnifeAttack}
            onConfirmTrap={handleConfirmTrap}
            onCancelTrap={handleCancelTrap}
            onSlide={handleSlide}
            onSprintToggle={handleSprintToggle}
            onDeploy={handleDeploy}
            onRotate={handleRotate}
            onRecon={handleTriggerRecon}
            onToggleFullscreen={handleToggleFullscreen}
            onOpenBackpack={handleOpenBackpack}
            onOpenCrafting={handleOpenCrafting}
            onQuickHeal={handleQuickHeal}
          />
        </>
      )}

      {/* Arcane Spell & Stick Altar */}
      <CraftingModal
        visible={Boolean(engineState.craftingModalOpen)}
        resources={engineState.playerResources || {}}
        weapons={engineState.weapons || ['APPRENTICE_STICK']}
        equippedStick={engineState.equippedStick || 'APPRENTICE_STICK'}
        powerSlots={engineState.powerSlots || []}
        skillCounts={engineState.skillCounts || engineState.backpack?.skillCounts || {}}
        backpack={engineState.backpack || { sticks: ['APPRENTICE_STICK'], powers: [], resources: {} }}
        onCraft={handleCraftWeapon}
        onEquip={handleEquipStick}
        onChannelAltar={handleChannelAltar}
        onClose={handleCloseCrafting}
      />

      {/* Arcane Backpack Inventory Modal */}
      <BackpackModal
        visible={Boolean(engineState.backpackModalOpen)}
        backpack={engineState.backpack || { sticks: ['APPRENTICE_STICK'], powers: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION'], resources: {} }}
        equippedStick={engineState.equippedStick || engineState.equippedWeapon || 'APPRENTICE_STICK'}
        powerSlots={engineState.powerSlots || ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', 'REJUVENATION', null, null, null]}
        skillCounts={engineState.skillCounts || engineState.backpack?.skillCounts || {}}
        resources={engineState.playerResources || {}}
        onEquipStick={handleEquipStick}
        onSetPowerSlot={handleSetPowerSlot}
        onOpenCrafting={handleOpenCrafting}
        onClose={handleCloseBackpack}
      />

      {/* Role Select Modal */}
      {engineState.gameState === 'ROLE_SELECT' && (
        <RoleSelectModal
          visible={true}
          currentRoom={engineState.roomCode}
          currentConfig={engineState.matchConfig}
          message={engineState.roleSelectMessage}
          onSelectRole={handleSelectRole}
        />
      )}

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
