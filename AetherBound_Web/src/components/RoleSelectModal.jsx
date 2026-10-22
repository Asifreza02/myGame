import React, { useState } from 'react';

export function RoleSelectModal({
  visible = true,
  currentRoom = 'default',
  message = '',
  onSelectRole,
  onSelectLocalDual,
}) {
  const [room, setRoom] = useState(currentRoom);

  if (!visible) return null;

  const handleRandomRoom = () => {
    const adjectives = ['alpha', 'delta', 'vortex', 'cyber', 'titan', 'apex', 'sol', 'nova'];
    const num = Math.floor(100 + Math.random() * 900);
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    setRoom(`${adj}-${num}`);
  };

  return (
    <div className="modal-overlay" id="modal-role-select" role="dialog" aria-modal="true" aria-labelledby="role-select-title">
      <div className="modal-card role-select-card">
        <div className="menu-kicker"><span className="brand-mark">A</span> AN ASYMMETRIC OPEN-WORLD SHOWDOWN</div>
        <h1 className="modal-title" id="role-select-title">AETHERBOUND</h1>
        <p className="modal-subtitle">
          One world. Two sides. Choose how the run unfolds.
        </p>
        {message && <p className="modal-subtitle" role="status">{message}</p>}

        <div className="room-selector-box">
          <div className="room-selector-heading">
            <label className="hud-label" htmlFor="room-input">MATCH ROOM</label>
            <span className="room-helper">Share this code to play together</span>
          </div>
          <div className="room-input-row">
            <input
              id="room-input"
              type="text"
              placeholder="Enter a room name"
              value={room}
              maxLength={24}
              autoComplete="off"
              onChange={(e) => setRoom(e.target.value)}
            />
            <button
              type="button"
              className="generate-room-button interactive"
              onClick={handleRandomRoom}
              aria-label="Generate a random room code"
              title="Generate a random room code"
            >
              DICE
            </button>
          </div>
        </div>

        <div className="role-cards">
          <button
            type="button"
            className="role-option-card runner-card interactive"
            id="btn-select-runner"
            onClick={() => onSelectRole('runner', room)}
          >
            <span className="role-card-topline"><span>01 / RUN THE GAUNTLET</span><span className="role-card-arrow">↗</span></span>
            <span className="card-icon" aria-hidden="true">🏃</span>
            <span className="card-title">THE RUNNER</span>
            <span className="card-desc">
              Outrun the traps. Scavenge rare resources, craft your edge, and reach the Beacon.
            </span>
            <span className="role-card-cta">PLAY AS RUNNER <span aria-hidden="true">→</span></span>
          </button>

          <button
            type="button"
            className="role-option-card saboteur-card interactive"
            id="btn-select-saboteur"
            onClick={() => onSelectRole('saboteur', room)}
          >
            <span className="role-card-topline"><span>02 / CONTROL THE TERRAIN</span><span className="role-card-arrow">↗</span></span>
            <span className="card-icon" aria-hidden="true">⚡</span>
            <span className="card-title">THE SABOTEUR</span>
            <span className="card-desc">
              Read the route. Build a deadly gauntlet of barriers, traps, and rolling hazards.
            </span>
            <span className="role-card-cta">PLAY AS SABOTEUR <span aria-hidden="true">→</span></span>
          </button>
        </div>

        <button
          type="button"
          className="btn-secondary local-play-button interactive"
          id="btn-select-local"
          onClick={() => onSelectLocalDual(room)}
        >
          <span aria-hidden="true">⌘</span> PLAY LOCAL • SWITCH SIDES WITH TAB
        </button>
        <p className="menu-footer">WASD TO MOVE <span>·</span> SHIFT TO SPRINT <span>·</span> BUILT FOR DESKTOP &amp; TOUCH</p>
      </div>
    </div>
  );
}
