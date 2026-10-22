import React, { useState } from 'react';

export function RoleSelectModal({
  visible = true,
  currentRoom = 'default',
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
    <div className="modal-overlay" id="modal-role-select">
      <div className="modal-card">
        <h1 className="modal-title">AETHERBOUND</h1>
        <p className="modal-subtitle">
          Real-Time Asymmetric Survival &amp; Sabotage. Choose your combat operative class and join a match.
        </p>

        {/* Room Code Selector */}
        <div className="room-selector-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="hud-label">MATCHMAKING ROOM CODE:</span>
            <span
              className="hotkey-pill interactive"
              onClick={handleRandomRoom}
              style={{ cursor: 'pointer' }}
            >
              🎲 GENERATE RANDOM
            </span>
          </div>
          <div className="room-input-row">
            <input
              id="room-input"
              type="text"
              placeholder="default"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>
        </div>

        {/* Role Cards */}
        <div className="role-cards">
          <div
            className="role-option-card interactive"
            id="btn-select-runner"
            onClick={() => onSelectRole('runner', room)}
          >
            <div className="card-icon">🏃</div>
            <div className="card-title" style={{ color: 'var(--neon-cyan)' }}>
              THE RUNNER
            </div>
            <div className="card-desc">
              Search the terrain for Aether Essence, Ember Ore, Ironwood, and Moon Herb. Combine resources to craft boots, wards, and healing draughts before reaching the Beacon.
            </div>
          </div>

          <div
            className="role-option-card saboteur-card interactive"
            id="btn-select-saboteur"
            onClick={() => onSelectRole('saboteur', room)}
          >
            <div className="card-icon">⚡</div>
            <div className="card-title" style={{ color: 'var(--neon-orange)' }}>
              THE SABOTEUR
            </div>
            <div className="card-desc">
              Maneuver in full 3D, deploy walls, mud traps, spikes, boulders &amp; explosive barrels along your aim POV to halt the runner before time expires.
            </div>
          </div>
        </div>

        {/* Local Dual / Solo Testing */}
        <button
          className="btn-primary interactive"
          id="btn-select-local"
          onClick={() => onSelectLocalDual(room)}
          style={{ width: '100%', marginBottom: '10px' }}
        >
          🎮 LOCAL DUAL PLAY (Switch with [Tab])
        </button>
      </div>
    </div>
  );
}
