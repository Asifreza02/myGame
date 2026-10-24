import React, { useEffect, useState } from 'react';
import { CURATED_CHALLENGES, MATCH_DURATIONS, MATCH_MODES } from '../game/data/matchModes.js';

export function RoleSelectModal({ visible = true, currentRoom = 'default', currentConfig = {}, message = '', onSelectRole }) {
  const [room, setRoom] = useState(currentRoom);
  const [mode, setMode] = useState(currentConfig.mode || 'ffa');
  const [durationSeconds, setDurationSeconds] = useState(currentConfig.durationSeconds || 300);
  const [seed, setSeed] = useState(currentConfig.seed ? String(currentConfig.seed) : '');
  const [challengeId, setChallengeId] = useState('');
  const [fillBots, setFillBots] = useState(currentConfig.fillBots !== false);

  useEffect(() => {
    setRoom(currentRoom);
    setMode(currentConfig.mode || 'ffa');
    setDurationSeconds(currentConfig.durationSeconds || 300);
    setSeed(currentConfig.seed ? String(currentConfig.seed) : '');
    if (currentConfig.fillBots !== undefined) setFillBots(currentConfig.fillBots !== false);
  }, [currentRoom, currentConfig.mode, currentConfig.durationSeconds, currentConfig.seed, currentConfig.fillBots]);

  if (!visible) return null;

  const getConfig = () => ({
    mode,
    durationSeconds: Number(durationSeconds),
    seed: seed.trim() ? Number(seed) : null,
    fillBots,
  });

  const createRoom = () => {
    const code = `hunt-${Math.random().toString(36).slice(2, 6)}`;
    setRoom(code);
    onSelectRole('player', code, getConfig());
  };

  const joinQuickPlay = () => {
    onSelectRole('player', 'quickplay', getConfig());
  };

  const selectChallenge = (id) => {
    setChallengeId(id);
    const challenge = CURATED_CHALLENGES.find((entry) => entry.id === id);
    if (!challenge) return;
    setMode(challenge.mode);
    setDurationSeconds(challenge.durationSeconds);
    setSeed(String(challenge.seed));
  };

  return (
    <div className="modal-overlay" id="modal-role-select" role="dialog" aria-modal="true" aria-labelledby="role-select-title">
      <div className="modal-card role-select-card">
        <div className="menu-kicker"><span className="brand-mark">⚔️</span> 5-PLAYER MULTIPLAYER SURVIVAL</div>
        <h1 className="modal-title" id="role-select-title">AETHERBOUND</h1>
        <p className="modal-subtitle">5 Contenders. 1 Arena. Free-for-all or defeat the dragon.</p>
        {message && <p className="modal-subtitle" role="status" style={{ color: '#ff6677' }}>{message}</p>}

        <div className="room-selector-box">
          <div className="room-selector-heading">
            <label className="hud-label" htmlFor="room-input">MATCH ROOM</label>
            <span className="room-helper">Share code with up to 4 rivals (Max 5 players)</span>
          </div>
          <div className="room-input-row">
            <input
              id="room-input"
              type="text"
              placeholder="Enter a room code"
              value={room}
              maxLength={24}
              autoComplete="off"
              onChange={(event) => setRoom(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
            <button type="button" className="generate-room-button interactive" onClick={createRoom} aria-label="Create a new room">NEW</button>
          </div>
        </div>

        <div className="match-config-grid">
          <label>
            <span className="hud-label">MATCH MODE (MAX 5)</span>
            <select value={mode} onChange={(event) => { setMode(event.target.value); setChallengeId(''); }}>
              {Object.values(MATCH_MODES).map((matchMode) => (
                <option key={matchMode.id} value={matchMode.id}>{matchMode.name} (Max {matchMode.maxPlayers})</option>
              ))}
            </select>
          </label>
          <label>
            <span className="hud-label">RIVALS (MAX 5)</span>
            <select value={fillBots ? 'fill' : 'none'} onChange={(event) => setFillBots(event.target.value === 'fill')}>
              <option value="fill">Auto-fill up to 5 players (Bots)</option>
              <option value="none">Humans only (Wait for players)</option>
            </select>
          </label>
          <label>
            <span className="hud-label">MATCH LENGTH</span>
            <select value={durationSeconds} onChange={(event) => { setDurationSeconds(Number(event.target.value)); setChallengeId(''); }}>
              {MATCH_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration / 60} minutes</option>)}
            </select>
          </label>
          <label>
            <span className="hud-label">CURATED CHALLENGE</span>
            <select value={challengeId} onChange={(event) => selectChallenge(event.target.value)}>
              <option value="">Custom match</option>
              {CURATED_CHALLENGES.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>{challenge.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="hud-label">WORLD SEED</span>
            <input type="number" min="1" max="2147483646" step="1" value={seed} placeholder="Random world" onChange={(event) => { setSeed(event.target.value); setChallengeId(''); }} />
          </label>
          <p className="match-mode-description">{MATCH_MODES[mode]?.description}</p>
        </div>

        <div className="role-cards">
          <button
            type="button"
            className="role-option-card runner-card interactive"
            onClick={() => onSelectRole('player', room, getConfig())}
            disabled={!room.trim()}
          >
            <span className="role-card-topline"><span>ENTER 5-PLAYER ARENA</span><span className="role-card-arrow">↗</span></span>
            <span className="card-icon" aria-hidden="true">⚔️</span>
            <span className="card-title">JOIN BATTLE</span>
            <span className="card-desc">Compete against up to 4 rivals. Every contender starts with a knife. Slay competitors or fell the dragon to win.</span>
            <span className="role-card-cta">JOIN ROOM <span aria-hidden="true">→</span></span>
          </button>
        </div>

        <button type="button" className="quick-play-button interactive" onClick={joinQuickPlay}>
          QUICK PLAY 5-PLAYER MATCH · {MATCH_MODES[mode]?.name}
        </button>
        <p className="menu-footer">MAX 5 PLAYERS <span>·</span> WASD MOVE <span>·</span> SHIFT SPRINT <span>·</span> CLICK KNIFE ATTACK <span>·</span> 1-5 ABILITIES</p>
      </div>
    </div>
  );
}
