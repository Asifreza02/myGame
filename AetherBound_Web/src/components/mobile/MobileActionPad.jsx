import React, { useState } from 'react';

function activateFromPointer(event, action) {
  if (event.button === 0) action?.();
}

function activateFromKeyboard(event, action) {
  if (event.detail === 0) action?.();
}

export function MobileActionPad({
  activeRole = 'runner',
  isPlacing = false,
  voiceState = {},
  onToggleVoiceMute,
  onVoicePttActive,
  onJump,
  onAttack,
  onSlide,
  onSprintToggle,
  onDeploy,
  onRotate,
  onRecon,
  onToggleFullscreen,
}) {
  const [sprintActive, setSprintActive] = useState(false);

  const handleSprint = () => {
    const nextState = !sprintActive;
    setSprintActive(nextState);
    if (onSprintToggle) onSprintToggle(nextState);
  };

  const isRunner = activeRole === 'runner' || activeRole === 'player';
  const isSaboteur = activeRole === 'saboteur';

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
              {voiceState.pushToTalk ? (
                <button
                  className={`mobile-aux-btn voice-btn interactive ${voiceState.isPttPressed ? 'active' : ''}`}
                  onPointerDown={() => onVoicePttActive?.(true)}
                  onPointerUp={() => onVoicePttActive?.(false)}
                  onPointerLeave={() => onVoicePttActive?.(false)}
                  onPointerCancel={() => onVoicePttActive?.(false)}
                  title="Hold to Talk"
                >
                  {voiceState.isSpeaking ? '🎙️ TALKING' : '🎙️ HOLD PTT'}
                </button>
              ) : (
                <button
                  className={`mobile-aux-btn voice-btn interactive ${voiceState.isMuted ? 'muted' : voiceState.isSpeaking ? 'speaking' : 'active'}`}
                  onPointerUp={(event) => activateFromPointer(event, onToggleVoiceMute)}
                  onClick={(event) => activateFromKeyboard(event, onToggleVoiceMute)}
                  title="Toggle Microphone"
                >
                  {voiceState.isMuted ? '🔇 MUTED' : voiceState.isSpeaking ? '🎙️ TALKING' : '🎤 MIC ON'}
                </button>
              )}
            </div>

            <div className="mobile-action-main-row">
              <button
                className="mobile-round-btn interactive"
                onPointerUp={(event) => activateFromPointer(event, onAttack)}
                onClick={(event) => activateFromKeyboard(event, onAttack)}
              >
                🗡️ KNIFE
              </button>
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
