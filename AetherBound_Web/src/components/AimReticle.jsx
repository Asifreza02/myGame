import React from 'react';

export function AimReticleComponent({
  visible = true,
  isPointerLocked = false,
  hasTarget = false,
  aimAssistActive = false,
  targetName = '',
  onLockRequest,
}) {
  if (!visible) return null;

  return (
    <>
      <div
        className={`aim-reticle ${hasTarget ? 'target-locked' : ''} ${aimAssistActive ? 'aim-assist-active' : ''}`}
        id="aim-reticle"
      >
        <div className="aim-dot" />
        <div className="aim-circle" />
        <div className="aim-bracket top" />
        <div className="aim-bracket bottom" />
        <div className="aim-bracket left" />
        <div className="aim-bracket right" />

        {/* Tactical Corner Brackets for Target Lock */}
        <div className="aim-corner top-left" />
        <div className="aim-corner top-right" />
        <div className="aim-corner bottom-left" />
        <div className="aim-corner bottom-right" />

        {/* Target Lock Badge */}
        <div className="aim-target-tag">
          🎯 {targetName || 'TARGET LOCKED'}
        </div>
      </div>

      <div
        id="cursor-unlock-hint"
        className="hud-panel interactive"
        onClick={onLockRequest}
      >
        {isPointerLocked ? (
          hasTarget ? (
            <span style={{ color: '#ff3355' }}>🎯 <b>TARGET LOCKED</b> · Aim will hit target · [Esc] unlock</span>
          ) : (
            <span>🖱️ <b>Aim Active</b> · Move mouse to aim in 3D · [Esc] unlock</span>
          )
        ) : (
          <span>🖱️ Click to lock cursor & aim (Mouse / Touch / WASD)</span>
        )}
      </div>
    </>
  );
}

export const AimReticle = React.memo(AimReticleComponent);
