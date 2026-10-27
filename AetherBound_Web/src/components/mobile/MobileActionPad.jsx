import React, { useState } from 'react';
import { WEAPON_DEFINITIONS, MAGIC_STICKS } from '../../game/data/combat.js';

function activateFromPointer(event, action) {
  if (event.button === 0) action?.();
}

function activateFromKeyboard(event, action) {
  if (event.detail === 0) action?.();
}

export function MobileActionPad({
  activeRole = 'runner',
  isPlacing = false,
  isPlacingTrap = false,
  equippedWeapon = 'APPRENTICE_STICK',
  equippedStick = 'APPRENTICE_STICK',
  ammo = {},
  knifeCooldownMs = 0,
  voiceState = {},
  onToggleVoiceMute,
  onVoicePttActive,
  onJump,
  onAttack,
  onConfirmTrap,
  onCancelTrap,
  onSlide,
  onSprintToggle,
  onDeploy,
  onRotate,
  onRecon,
  onToggleFullscreen,
  onOpenBackpack,
  onOpenCrafting,
}) {
  const [sprintActive, setSprintActive] = useState(false);

  const handleSprint = () => {
    const nextState = !sprintActive;
    setSprintActive(nextState);
    if (onSprintToggle) onSprintToggle(nextState);
  };

  const isRunner = activeRole === 'runner' || activeRole === 'player';
  const isSaboteur = activeRole === 'saboteur';

  const currentWeaponDef = MAGIC_STICKS[equippedStick] || WEAPON_DEFINITIONS[equippedWeapon] || MAGIC_STICKS.APPRENTICE_STICK;
  const isStickType = Boolean(MAGIC_STICKS[equippedStick] || currentWeaponDef.element || currentWeaponDef.type === 'wand' || currentWeaponDef.type === 'staff');
  const isMelee = currentWeaponDef.type === 'melee';
  const isUnlimited = isStickType || currentWeaponDef.ammo === Infinity;
  const currentAmmo = isUnlimited ? '∞' : (ammo[equippedWeapon] ?? 0);
  const isAttackCooling = knifeCooldownMs > 0;
  const hasNoAmmo = !isUnlimited && currentAmmo === 0;

  return (
    <>
      {/* Top-Right Fullscreen Toggle */}
      <button
        className="mobile-fullscreen-btn interactive"
        onPointerUp={(event) => activateFromPointer(event, onToggleFullscreen)}
        onClick={(event) => activateFromKeyboard(event, onToggleFullscreen)}
        title="Toggle Fullscreen"
      >
        ⛶
      </button>

      {/* Action Cluster on Bottom-Right */}
      <div className="mobile-action-cluster">
        {/* Runner Actions */}
        {isRunner && (
          <>
            <div className="mobile-action-aux-row">
              <button
                className="mobile-aux-btn interactive"
                onPointerUp={(event) => activateFromPointer(event, onOpenBackpack)}
                onClick={(event) => activateFromKeyboard(event, onOpenBackpack)}
                title="Backpack"
              >
                🎒
              </button>

              <button
                className="mobile-aux-btn interactive"
                onPointerUp={(event) => activateFromPointer(event, onOpenCrafting)}
                onClick={(event) => activateFromKeyboard(event, onOpenCrafting)}
                title="Altar & Crafting"
              >
                ✨
              </button>

              {voiceState.pushToTalk ? (
                <button
                  className={`mobile-aux-btn voice-btn interactive ${voiceState.isPttPressed ? 'active' : ''}`}
                  onPointerDown={() => onVoicePttActive?.(true)}
                  onPointerUp={() => onVoicePttActive?.(false)}
                  onPointerLeave={() => onVoicePttActive?.(false)}
                  onPointerCancel={() => onVoicePttActive?.(false)}
                  title="Push-To-Talk"
                >
                  {voiceState.isSpeaking ? '🎙️' : '🎤'}
                </button>
              ) : (
                <button
                  className={`mobile-aux-btn voice-btn interactive ${voiceState.isMuted ? 'muted' : voiceState.isSpeaking ? 'speaking' : 'active'}`}
                  onPointerUp={(event) => activateFromPointer(event, onToggleVoiceMute)}
                  onClick={(event) => activateFromKeyboard(event, onToggleVoiceMute)}
                  title="Mic"
                >
                  {voiceState.isMuted ? '🔇' : voiceState.isSpeaking ? '🎙️' : '🎤'}
                </button>
              )}
            </div>

            <div className="mobile-action-grid">
              <button
                className={`mobile-round-btn sprint-btn interactive ${sprintActive ? 'active' : ''}`}
                onPointerUp={(event) => activateFromPointer(event, handleSprint)}
                onClick={(event) => activateFromKeyboard(event, handleSprint)}
                title="Sprint"
              >
                ⚡
              </button>

              <button
                className="mobile-round-btn jump-btn interactive"
                onPointerUp={(event) => activateFromPointer(event, onJump)}
                onClick={(event) => activateFromKeyboard(event, onJump)}
                title="Jump"
              >
                🚀
              </button>

              <button
                className="mobile-round-btn slide-btn interactive"
                onPointerUp={(event) => activateFromPointer(event, onSlide)}
                onClick={(event) => activateFromKeyboard(event, onSlide)}
                title="Slide"
              >
                💨
              </button>

              {isPlacingTrap ? (
                <>
                  <button
                    className="mobile-round-btn trap-cancel-btn interactive"
                    onPointerUp={(event) => activateFromPointer(event, onCancelTrap)}
                    onClick={(event) => activateFromKeyboard(event, onCancelTrap)}
                    title="Cancel Placement"
                    style={{ background: 'rgba(230, 40, 40, 0.45)', borderColor: '#ff4444' }}
                  >
                    ❌
                  </button>

                  <button
                    className="mobile-round-btn trap-confirm-btn primary-action interactive"
                    onPointerUp={(event) => activateFromPointer(event, onConfirmTrap || onAttack)}
                    onClick={(event) => activateFromKeyboard(event, onConfirmTrap || onAttack)}
                    title="Confirm Placement"
                    style={{ background: 'rgba(0, 240, 255, 0.45)', borderColor: '#00f0ff' }}
                  >
                    💥
                  </button>
                </>
              ) : (
                <button
                  className={`mobile-round-btn attack-btn primary-action interactive ${hasNoAmmo ? 'no-ammo' : ''} ${isAttackCooling ? 'cooling-down' : ''}`}
                  onPointerUp={(event) => activateFromPointer(event, onAttack)}
                  onClick={(event) => activateFromKeyboard(event, onAttack)}
                  title={`Cast ${currentWeaponDef.name}`}
                >
                  <span className="mobile-btn-icon">{currentWeaponDef.icon || '🪄'}</span>
                  {isAttackCooling && (
                    <span className="mobile-btn-label">
                      {(knifeCooldownMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {/* Saboteur Actions */}
        {isSaboteur && (
          <>
            <div className="mobile-action-aux-row">
              <button
                className="mobile-aux-btn interactive"
                onPointerUp={(event) => activateFromPointer(event, onRecon)}
                onClick={(event) => activateFromKeyboard(event, onRecon)}
                title="Scanner Pulse"
              >
                📡 Scan
              </button>
            </div>

            <div className="mobile-action-main-row">
              <button
                className={`mobile-round-btn sprint-btn interactive ${sprintActive ? 'active' : ''}`}
                onPointerUp={(event) => activateFromPointer(event, handleSprint)}
                onClick={(event) => activateFromKeyboard(event, handleSprint)}
              >
                ⚡ SPRINT
              </button>

              <button
                className="mobile-round-btn slide-btn interactive"
                onPointerUp={(event) => activateFromPointer(event, onSlide)}
                onClick={(event) => activateFromKeyboard(event, onSlide)}
              >
                ⛷️ SLIDE
              </button>

              <button
                className="mobile-round-btn jump-btn interactive"
                onPointerUp={(event) => activateFromPointer(event, onJump)}
                onClick={(event) => activateFromKeyboard(event, onJump)}
              >
                🚀 JUMP
              </button>

              {isPlacing && (
                <>
                  <button
                    className="mobile-round-btn rotate-btn interactive"
                    onPointerUp={(event) => activateFromPointer(event, onRotate)}
                    onClick={(event) => activateFromKeyboard(event, onRotate)}
                  >
                    🔄 45°
                  </button>

                  <button
                    className="mobile-round-btn deploy-btn interactive"
                    onPointerUp={(event) => activateFromPointer(event, onDeploy)}
                    onClick={(event) => activateFromKeyboard(event, onDeploy)}
                  >
                    💥 PLACE
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
