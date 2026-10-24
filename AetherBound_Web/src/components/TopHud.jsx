import React from 'react';

export function TopHud({ timeRemaining = 300, roomCode = 'default', playerCounts = {}, environment = {}, dragon = {}, matchConfig = {}, toastMessage = null, onExitToLobby, onShareRoom }) {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const timerStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  const alive = playerCounts.alive ?? playerCounts.total ?? 1;
  const { biome, todName, todClass } = environment;
  const dragonHealth = Math.max(0, dragon.health ?? 300);
  const dragonMaxHealth = dragon.maxHealth ?? 300;
  const dragonHealthPct = dragonMaxHealth > 0 ? (dragonHealth / dragonMaxHealth) * 100 : 0;
  const modeName = matchConfig.modeName || (matchConfig.mode === 'dragon-hunt'
    ? 'DRAGON HUNT'
    : matchConfig.mode === 'solo' ? 'SOLO SURVIVAL' : 'FREE-FOR-ALL');
  return (
    <>
      <div id="top-hud">
        <div className="hud-panel"><span className="room-tag">ROOM: {roomCode}</span></div>
        <div className="hud-panel" id="timer-box"><span className="hud-label">SURVIVAL</span><span id="hud-timer" className={timeRemaining <= 30 ? 'urgent' : ''}>{timerStr}</span></div>
        <div className="hud-panel"><span className="role-tag player">{modeName.toUpperCase()}</span></div>
        {matchConfig.seed && <div className="hud-panel"><span className="room-tag">SEED: {matchConfig.seed}</span></div>}
        {biome && <div className="hud-panel"><span className="biome-tag">{biome.name}</span></div>}
        <div className="hud-panel">
          <span className={`tod-tag ${todClass || 'clear'}`}>{todName || 'Clear Skies'}</span>
          {environment.weather?.secondsUntilChange > 0 && (
            <span className="weather-countdown">{environment.weather.secondsUntilChange}s</span>
          )}
        </div>
        <div className="hud-panel"><span id="lobby-status">{alive} {matchConfig.mode === 'dragon-hunt' ? 'HUNTERS' : 'SURVIVORS'}</span></div>
        <div className="hud-panel dragon-status" aria-live="polite">
          <div className="dragon-status-heading">DRAGON · {dragon.alive === false ? 'DEFEATED' : (dragon.phase || 'STALKING')}</div>
          <div className="dragon-health-track"><div className="dragon-health-fill" style={{ width: `${dragonHealthPct}%` }} /></div>
          <span className="dragon-health-value">{dragonHealth} / {dragonMaxHealth}</span>
          {dragon.attack && <strong className="dragon-telegraph-copy">⚠ {dragon.attack.name} · DODGE THE MARKED AREA</strong>}
        </div>
        <div className="hud-panel hud-action-buttons">
          <button id="share-room-button" className="interactive" type="button" onClick={onShareRoom}>SHARE MATCH</button>
          <button id="exit-lobby-button" className="interactive" type="button" onClick={onExitToLobby}>EXIT TO LOBBY</button>
        </div>
      </div>
      {toastMessage && <div id="ai-hazard-toast" className="toast-show">{toastMessage}</div>}
    </>
  );
}
