import React, { useState } from 'react';

export function MobileActionPad({
  activeRole = 'runner',
  isPlacing = false,
  onJump,
  onSlide,
  onSprintToggle,
  onDeploy,
  onRotate,
  onRecon,
  onFaceGoal,
  onTurnBehind,
  onToggleFullscreen,
}) {
  const [sprintActive, setSprintActive] = useState(false);

  const handleSprint = () => {
    const nextState = !sprintActive;
    setSprintActive(nextState);
    if (onSprintToggle) onSprintToggle(nextState);
  };

  const isRunner = activeRole === 'runner';
  const isSaboteur = activeRole === 'saboteur';

  return (
    <>
      {/* Top-Right Fullscreen Toggle */}
      <button
        className="mobile-fullscreen-btn interactive"
        onClick={onToggleFullscreen}
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
                onClick={onFaceGoal}
                title="Face Goal"
              >
                🎯 Goal
              </button>
              <button
                className="mobile-aux-btn interactive"
                onClick={onTurnBehind}
                title="Turn 180°"
              >
                🔄 180°
              </button>
            </div>

            <div className="mobile-action-main-row">
              <button
                className={`mobile-round-btn sprint-btn interactive ${sprintActive ? 'active' : ''}`}
                onClick={handleSprint}
              >
                ⚡ SPRINT
              </button>

              <button
                className="mobile-round-btn slide-btn interactive"
                onClick={onSlide}
              >
                ⛷️ SLIDE
              </button>

              <button
                className="mobile-round-btn jump-btn interactive"
                onClick={onJump}
              >
                🚀 JUMP
              </button>
            </div>
          </>
        )}

        {/* Saboteur Actions */}
        {isSaboteur && (
          <>
            <div className="mobile-action-aux-row">
              <button
                className="mobile-aux-btn interactive"
                onClick={onRecon}
                title="Scanner Pulse"
              >
                📡 Scan
              </button>
              <button
                className="mobile-aux-btn interactive"
                onClick={onFaceGoal}
                title="Face Goal"
              >
                🎯 Goal
              </button>
              <button
                className="mobile-aux-btn interactive"
                onClick={onTurnBehind}
                title="Turn 180°"
              >
                🔄 180°
              </button>
            </div>

            <div className="mobile-action-main-row">
              <button
                className={`mobile-round-btn sprint-btn interactive ${sprintActive ? 'active' : ''}`}
                onClick={handleSprint}
              >
                ⚡ SPRINT
              </button>

              <button
                className="mobile-round-btn slide-btn interactive"
                onClick={onSlide}
              >
                ⛷️ SLIDE
              </button>

              <button
                className="mobile-round-btn jump-btn interactive"
                onClick={onJump}
              >
                🚀 JUMP
              </button>

              {isPlacing && (
                <>
                  <button
                    className="mobile-round-btn rotate-btn interactive"
                    onClick={onRotate}
                  >
                    🔄 45°
                  </button>

                  <button
                    className="mobile-round-btn deploy-btn interactive"
                    onClick={onDeploy}
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
