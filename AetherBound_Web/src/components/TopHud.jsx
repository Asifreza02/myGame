import React from 'react';

export function TopHud({
  timeRemaining = 120,
  activeRole = 'runner',
  roomCode = 'default',
  playerCounts = { runner: 1, saboteur: 0, lobby: 0 },
  environment = {},
  aiEnabled = true,
  humanSaboteurAvailable = false,
  onToggleAI,
  toastMessage = null,
  isLocalDual = false,
}) {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const timerStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  const isUrgent = timeRemaining <= 15;

  const { biome, todName, todClass } = environment;
  const biomeIcons = { LUSH: '🌿', DESERT: '🏜️', SNOW: '❄️', VOLCANIC: '🌋' };

  let aiClass = 'ai-disabled';
  let aiText = '🤖 AI Saboteur: DISABLED';

  if (humanSaboteurAvailable) {
    aiClass = 'ai-standby';
    aiText = '👤 Human Saboteur: ACTIVE (AI Standby)';
  } else if (aiEnabled) {
    aiClass = 'ai-active';
    aiText = '🤖 AI Saboteur: ACTIVE (Auto-Hazards)';
  }

  return (
    <>
      <div id="top-hud">
        {/* Room badge */}
        <div className="hud-panel">
          <span className="room-tag">ROOM: {roomCode}</span>
        </div>

        {/* Round Timer */}
        <div className="hud-panel" id="timer-box">
          <span className="hud-label">TIME REMAINING</span>
          <span id="hud-timer" className={isUrgent ? 'urgent' : ''}>
            {timerStr}
          </span>
        </div>

        {/* Active Role */}
        <div className="hud-panel">
          <span className={`role-tag ${activeRole}`}>
            {activeRole.toUpperCase()}
          </span>
        </div>

        {/* Biome Badge */}
        {biome && (
          <div className="hud-panel">
            <span className={`biome-tag ${biome.id ? biome.id.toLowerCase() : 'lush'}`}>
              {biomeIcons[biome.id] || '🌍'} {biome.name}
            </span>
          </div>
        )}

        {/* Fixed daytime lighting badge */}
        <div className="hud-panel">
          <span className={`tod-tag ${todClass || 'noon'}`}>
            {todName || '☀️ DAYTIME'}
          </span>
        </div>

        {/* AI / Human Status Button */}
        <div className="hud-panel">
          <button
            id="ai-saboteur-toggle"
            className={aiClass}
            onClick={onToggleAI}
          >
            {aiText}
          </button>
        </div>

        {/* Player Counts */}
        <div className="hud-panel">
          <span id="lobby-status">
            Players: {playerCounts.runner || 0} Runner | {playerCounts.saboteur || 0} Saboteur
          </span>
        </div>
      </div>

      {/* Local dual hint */}
      {isLocalDual && (
        <div id="local-dual-hint" className="hud-panel">
          <span>👥 LOCAL DUAL: Press <b>[Tab]</b> to switch Runner / Saboteur</span>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div id="ai-hazard-toast" className="toast-show">
          {toastMessage}
        </div>
      )}
    </>
  );
}
