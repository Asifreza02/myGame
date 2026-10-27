import React, { useState, useEffect } from 'react';

const WEATHER_ICONS = {
  clear: '☀️',
  rain: '🌧️',
  storm: '⛈️',
  snow: '❄️',
  fog: '🌫️',
};

export function TopHudComponent({
  roomCode = 'default',
  playerCounts = {},
  competitors = [],
  killfeed = [],
  playerId = null,
  environment = {},
  dragon = {},
  nearbyZombies = [],
  matchConfig = {},
  toastMessage = null,
  voiceState = {},
  onToggleVoiceMute,
  onToggleVoiceDeafen,
  onTogglePushToTalk,
  onExitToLobby,
  onShareRoom,
}) {
  const [showRoster, setShowRoster] = useState(false);

  const alive = playerCounts.alive ?? playerCounts.total ?? 1;
  const maxPlayers = matchConfig.maxPlayers || playerCounts.max || 5;
  const { biome, todName, todClass } = environment;
  const dragonHealth = Math.max(0, dragon.health ?? 300);
  const dragonMaxHealth = dragon.maxHealth ?? 300;
  const dragonHealthPct = dragonMaxHealth > 0 ? (dragonHealth / dragonMaxHealth) * 100 : 0;
  const modeName = matchConfig.modeName || (matchConfig.mode === 'dragon-hunt'
    ? 'DRAGON HUNT'
    : matchConfig.mode === 'solo' ? 'SOLO' : 'FFA');

  return (
    <>
      <div id="top-hud" className="minimal-top-hud">
        {/* Room Code Quick Button */}
        <div className="hud-panel">
          <button
            type="button"
            className="room-tag-btn interactive"
            onClick={() => onShareRoom?.(roomCode)}
            title="Room Code (Click to Copy & Share)"
          >
            <span className="room-tag">📋 {String(roomCode).toUpperCase()}</span>
          </button>
        </div>

        {/* Mode & Biome Pill */}
        <div className="hud-panel hud-mode-panel" title={modeName}>
          <span className="role-tag player">⚔️</span>
          {biome && <span className="biome-tag desktop-only" title={biome.name}>🌲 {biome.name.split(' ')[0]}</span>}
        </div>

        {/* Weather Indicator */}
        <div className="hud-panel weather-panel" title={`${todName || 'Clear Skies'} (${environment.weather?.secondsUntilChange || 0}s remaining)`}>
          <span className="weather-icon">{WEATHER_ICONS[todClass] || '☀️'}</span>
          {environment.weather?.secondsUntilChange > 0 && (
            <span className="weather-countdown">{environment.weather.secondsUntilChange}s</span>
          )}
        </div>

        {/* Survivors Count / Roster Toggle */}
        <div className="hud-panel">
          <button
            type="button"
            className="hud-roster-toggle interactive"
            onClick={() => setShowRoster((prev) => !prev)}
            title="Competitor Standings"
            style={{ background: 'transparent', border: 'none', color: '#b8fff0', cursor: 'pointer', font: 'inherit', padding: 0 }}
          >
            <span id="lobby-status">
              👥 {alive}/{maxPlayers}
            </span>
          </button>
        </div>

        {/* Minimal Dragon Boss Indicator */}
        <div className="hud-panel dragon-status" aria-live="polite" title={`Dragon Boss: ${dragonHealth}/${dragonMaxHealth} HP`}>
          <div className="dragon-health-track">
            <div className="dragon-health-fill" style={{ width: `${dragonHealthPct}%` }} />
          </div>
          <div className="dragon-status-row">
            <span className="dragon-icon">🐉</span>
            <span className="dragon-health-value">{dragonHealth}</span>
            {dragon.alive !== false && (
              <span className={`dragon-flight-badge ${dragon.flightPhase === 'GROUNDED' ? 'grounded' : 'aerial'}`}>
                {dragon.flightPhase === 'GROUNDED'
                  ? `⬇ ${dragon.flightPhaseTimer ?? 25}s`
                  : `🦅 ${dragon.flightPhaseTimer ?? 60}s`}
              </span>
            )}
          </div>
          {dragon.attack && <strong className="dragon-telegraph-copy">⚠ {dragon.attack.name}</strong>}
        </div>

        {/* Zombie Threat Radar */}
        {nearbyZombies && nearbyZombies.length > 0 && (
          <div className="hud-panel zombie-radar-panel" title={`Threat: ${nearbyZombies[0].name}`}>
            <span className={`zombie-radar-badge ${nearbyZombies[0].tier === 2 ? 'tier2' : 'tier1'}`}>
              🧟 {nearbyZombies[0].distance}m {nearbyZombies[0].heading}
            </span>
          </div>
        )}

        {/* Room Voice Chat HUD Controls */}
        <div className="hud-panel voice-controls-panel">
          <button
            type="button"
            className={`voice-hud-btn interactive ${voiceState.isMuted ? 'muted' : voiceState.isSpeaking ? 'speaking' : 'active'}`}
            onClick={onToggleVoiceMute}
            title={voiceState.isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            <span className="voice-icon">
              {voiceState.isMuted ? '🔇' : voiceState.isSpeaking ? '🎙️' : '🎤'}
            </span>
          </button>

          <button
            type="button"
            className={`voice-ptt-toggle-btn interactive ${voiceState.pushToTalk ? 'ptt-active' : ''}`}
            onClick={onTogglePushToTalk}
            title={voiceState.pushToTalk ? 'Push-To-Talk [V]' : 'Open Mic'}
          >
            {voiceState.pushToTalk ? 'PTT' : 'OPEN'}
          </button>

          <button
            type="button"
            className={`voice-deafen-btn interactive ${voiceState.isDeafened ? 'deafened' : ''}`}
            onClick={onToggleVoiceDeafen}
            title={voiceState.isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {voiceState.isDeafened ? '🔕' : '🎧'}
          </button>
        </div>

        {/* Quick Action Icon Buttons */}
        <div className="hud-panel hud-action-buttons">
          <button id="share-room-button" className="interactive hud-icon-btn" type="button" onClick={() => onShareRoom?.(roomCode)} title="Share Room Code & Link">
            🔗
          </button>
          <button id="exit-lobby-button" className="interactive hud-icon-btn" type="button" onClick={onExitToLobby} title="Exit to Lobby">
            🚪
          </button>
        </div>
      </div>

      {/* 5-Player Competitor Standings Panel */}
      {showRoster && competitors && competitors.length > 0 && (
        <aside className="competitors-panel" aria-label="5-Player Match Standings">
          <div className="competitors-header">
            <span className="competitors-title">5-PLAYER STANDINGS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="competitors-count">{alive} ALIVE</span>
              <button
                type="button"
                className="competitors-close-btn interactive"
                onClick={() => setShowRoster(false)}
                title="Close Standings"
              >✕</button>
            </div>
          </div>
          <div className="competitors-list">
            {competitors.slice(0, 5).map((comp) => {
              const isYou = comp.id === playerId || comp.isLocal;
              const hpPct = Math.max(0, Math.min(100, ((comp.health ?? 100) / (comp.maxHealth || 100)) * 100));
              const hpColor = hpPct > 50 ? '#00ff88' : hpPct > 25 ? '#ffaa00' : '#ff3344';
              const kills = comp.stats?.kills ?? comp.kills ?? 0;

              return (
                <div
                  key={comp.id}
                  className={`competitor-row ${comp.alive ? 'alive' : 'eliminated'} ${isYou ? 'local-player' : ''}`}
                >
                  <div className="competitor-identity">
                    <span
                      className="competitor-badge-dot"
                      style={{ backgroundColor: comp.color || '#00f0ff', boxShadow: `0 0 8px ${comp.color || '#00f0ff'}` }}
                    />
                    <span className="competitor-name">
                      {comp.name || 'Survivor'}
                      {isYou && <span className="you-pill">YOU</span>}
                      {comp.isBot && <span className="bot-pill">BOT</span>}
                    </span>
                    {!comp.isBot && (
                      <span className="competitor-voice-indicator">
                        {comp.isSpeaking ? (
                          <span className="voice-speaking-badge" title="Speaking">
                            <span className="mini-wave b1" />
                            <span className="mini-wave b2" />
                            <span className="mini-wave b3" />
                          </span>
                        ) : comp.isMuted ? (
                          <span className="voice-muted-badge" title="Muted">🔇</span>
                        ) : null}
                      </span>
                    )}
                    <span className="competitor-kills" title="Eliminations">⚔️ {kills}</span>
                  </div>
                  <div className="competitor-hp-bar-track">
                    <div
                      className="competitor-hp-bar-fill"
                      style={{
                        width: comp.alive ? `${hpPct}%` : '0%',
                        backgroundColor: comp.alive ? hpColor : '#555',
                      }}
                    />
                  </div>
                  <div className="competitor-status-text">
                    {comp.alive ? (
                      <span>{Math.ceil(comp.health ?? 100)} HP</span>
                    ) : (
                      <span className="eliminated-text">💀 ELIMINATED</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* Killfeed Container */}
      {killfeed && killfeed.length > 0 && (
        <div className="killfeed-container" aria-live="polite">
          {killfeed.map((item) => (
            <div key={item.id} className="killfeed-item">
              {item.text}
            </div>
          ))}
        </div>
      )}

      {toastMessage && <div id="ai-hazard-toast" className="toast-show">{toastMessage}</div>}
    </>
  );
}

export const TopHud = React.memo(TopHudComponent);
