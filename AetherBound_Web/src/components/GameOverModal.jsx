import React from 'react';

export function GameOverModal({ data = null, onRestart }) {
  if (!data) return null;

  const {
    winner = 'runner',
    reason = '',
    scores = { runner: 0, saboteur: 0 },
    metrics = {},
  } = data;

  const isRunnerWin = winner === 'runner';
  const titleColor = isRunnerWin ? '#00ffff' : '#ff3344';
  const titleText = isRunnerWin ? 'RUNNER ESCAPED!' : 'SABOTEUR VICTORIOUS!';

  const {
    dist = 0,
    resources = 0,
    traps = 0,
    timeElapsed = 0,
    bestDist = dist,
    bestResources = resources,
    isNewBestDist = false,
    isNewBestResources = false,
  } = metrics;

  return (
    <div className="modal-overlay" id="game-over-modal">
      <div className="modal-card">
        <h1 className="modal-title" id="game-over-title" style={{ color: titleColor }}>
          {titleText}
        </h1>
        <p className="modal-subtitle" id="game-over-desc">
          {reason}
        </p>

        <div
          id="game-over-score"
          style={{
            fontSize: '18px',
            color: 'var(--neon-green)',
            marginBottom: '16px',
            fontWeight: 800,
          }}
        >
          Score — Runner: {scores.runner || 0} | Saboteur: {scores.saboteur || 0}
        </div>

        {/* Phase 3 Match Performance Stats & Records */}
        <div className="match-stats-container" id="match-stats-container">
          <div className="match-stats-title">📊 MATCH PERFORMANCE METRICS</div>
          <div className="match-stats-grid">
            <div className="stat-item">
              <span className="stat-name">🏃 Traversed Distance:</span>
              <span className="stat-value">
                {dist}m {isNewBestDist && <span className="stat-best">★ RECORD</span>}
              </span>
            </div>

            <div className="stat-item">
              <span className="stat-name">🧰 Resources Gathered:</span>
              <span className="stat-value">
                {resources} {isNewBestResources && <span className="stat-best">★ RECORD</span>}
              </span>
            </div>

            <div className="stat-item">
              <span className="stat-name">🧱 Traps Deployed:</span>
              <span className="stat-value">{traps}</span>
            </div>

            <div className="stat-item">
              <span className="stat-name">⏱️ Match Duration:</span>
              <span className="stat-value">{timeElapsed}s</span>
            </div>

            <div className="stat-item">
              <span className="stat-name">🏆 All-Time Record Distance:</span>
              <span className="stat-value" style={{ color: '#ffaa00' }}>
                {bestDist}m
              </span>
            </div>

            <div className="stat-item">
              <span className="stat-name">⭐ All-Time Resource Record:</span>
              <span className="stat-value" style={{ color: '#00d4ff' }}>
                {bestResources}
              </span>
            </div>
          </div>
        </div>

        <button
          className="btn-primary interactive"
          id="restart-btn"
          onClick={onRestart}
        >
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}
