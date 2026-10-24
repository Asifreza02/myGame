import React, { useEffect, useState } from 'react';
import { CURATED_CHALLENGES, MATCH_DURATIONS, MATCH_MODES } from '../game/data/matchModes.js';

export function RoleSelectModal({ visible = true, currentRoom = 'default', currentConfig = {}, message = '', onSelectRole }) {
  const [room, setRoom] = useState(currentRoom);
  const [mode, setMode] = useState(currentConfig.mode || 'ffa');
  const [durationSeconds, setDurationSeconds] = useState(currentConfig.durationSeconds || 300);
  const [seed, setSeed] = useState(currentConfig.seed ? String(currentConfig.seed) : '');
  const [challengeId, setChallengeId] = useState('');
  useEffect(() => {
    setRoom(currentRoom);
    setMode(currentConfig.mode || 'ffa');
    setDurationSeconds(currentConfig.durationSeconds || 300);
    setSeed(currentConfig.seed ? String(currentConfig.seed) : '');
  }, [currentRoom, currentConfig.mode, currentConfig.durationSeconds, currentConfig.seed]);
  if (!visible) return null;

  const getConfig = () => ({
    mode,
    durationSeconds: Number(durationSeconds),
    seed: seed.trim() ? Number(seed) : null,
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
        <div className="menu-kicker"><span className="brand-mark">A</span> MULTIPLAYER SURVIVAL</div>
        <h1 className="modal-title" id="role-select-title">AETHERBOUND</h1>
        <p className="modal-subtitle">Scavenge. Survive. Hunt the dragon.</p>
        {message && <p className="modal-subtitle" role="status">{message}</p>}
        <div className="room-selector-box">
          <div className="room-selector-heading">
            <label className="hud-label" htmlFor="room-input">MATCH ROOM</label>
            <span className="room-helper">Share this code to meet friends</span>
          </div>
          <div className="room-input-row">
            <input id="room-input" type="text" placeholder="Enter a room code" value={room} maxLength={24} autoComplete="off" onChange={(event) => setRoom(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
            <button type="button" className="generate-room-button interactive" onClick={createRoom} aria-label="Create a new room">NEW</button>
          </div>
        </div>
        <div className="match-config-grid">
          <label>
            <span className="hud-label">MATCH MODE</span>
            <select value={mode} onChange={(event) => { setMode(event.target.value); setChallengeId(''); }}>
              {Object.values(MATCH_MODES).map((matchMode) => (
                <option key={matchMode.id} value={matchMode.id}>{matchMode.name}</option>
              ))}
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
          <button type="button" className="role-option-card runner-card interactive" onClick={() => onSelectRole('player', room, getConfig())} disabled={!room.trim()}>
            <span className="role-card-topline"><span>JOIN THE MATCH</span><span className="role-card-arrow">↗</span></span>
            <span className="card-icon" aria-hidden="true">⚔️</span>
            <span className="card-title">ENTER THE WILDS</span>
            <span className="card-desc">Every contender starts on equal footing with a knife. Find gear, survive the hunt, or take on the dragon.</span>
            <span className="role-card-cta">JOIN ROOM <span aria-hidden="true">→</span></span>
          </button>
        </div>
        <button type="button" className="quick-play-button interactive" onClick={joinQuickPlay}>
          QUICK PLAY · {MATCH_MODES[mode]?.name}
        </button>
        <p className="menu-footer">WASD MOVE <span>·</span> SHIFT SPRINT <span>·</span> CLICK ATTACK <span>·</span> BUILT FOR DESKTOP &amp; TOUCH</p>
      </div>
    </div>
  );
}
