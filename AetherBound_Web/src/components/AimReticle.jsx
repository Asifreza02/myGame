import React from 'react';

export function AimReticle({ visible = true, isPointerLocked = false, onLockRequest }) {
  if (!visible) return null;

  return (
    <>
      <div className="aim-reticle" id="aim-reticle">
        <div className="aim-dot" />
        <div className="aim-circle" />
        <div className="aim-bracket top" />
        <div className="aim-bracket bottom" />
        <div className="aim-bracket left" />
        <div className="aim-bracket right" />
      </div>

      <div
        id="cursor-unlock-hint"
        className="hud-panel interactive"
        onClick={onLockRequest}
      >
        {isPointerLocked ? (
          <span>🖱️ Press <b>[Esc]</b> to unlock cursor</span>
        ) : (
          <span>🖱️ Click screen to lock cursor & aim</span>
        )}
      </div>
    </>
  );
}
