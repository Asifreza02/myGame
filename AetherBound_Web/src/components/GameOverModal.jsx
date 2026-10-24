import React from 'react';

export function GameOverModal({ data = null, history = [], onRestart }) {
  if (!data) return null;
  const won = data.winner === 'you';
  const draw = data.winner === 'draw';
  const title = data.kind === 'dragon'
    ? (won ? 'DRAGON SLAIN!' : 'THE DRAGON IS DEFEATED')
    : (draw ? 'MATCH DRAW' : won ? 'LAST ONE STANDING!' : 'YOU WERE ELIMINATED');
  return (
    <div className="modal-overlay" id="game-over-modal">
      <div className="modal-card">
        <h1 className="modal-title" id="game-over-title" style={{ color: won ? '#00ffff' : '#ff6677' }}>{title}</h1>
        <p className="modal-subtitle" id="game-over-desc">{data.reason}</p>
        {data.kind === 'dragon' && <p className="modal-subtitle">Dragon victory credit: {data.dragonRewardPolicy === 'shared' ? 'all living players' : 'final attacker'}.</p>}
        {data.stats && (
          <div className="match-stat-grid" aria-label="Match statistics">
            <span><strong>{data.stats.kills || 0}</strong> Eliminations</span>
            <span><strong>{data.stats.survivalTime || 0}s</strong> Survival</span>
            <span><strong>{data.stats.itemsCollected || 0}</strong> Items found</span>
            <span><strong>{data.stats.damageDealt || 0}</strong> Damage dealt</span>
            <span><strong>{data.stats.dragonDamage || 0}</strong> Dragon damage</span>
          </div>
        )}
        {history.length > 0 && (
          <section className="match-history" aria-label="Recent match history">
            <h2>RECENT MATCHES</h2>
            {history.slice(0, 3).map((match) => (
              <div className="match-history-row" key={match.endedAt}>
                <span>{match.winner === 'you' ? 'VICTORY' : match.winner === 'draw' ? 'DRAW' : 'DEFEAT'}</span>
                <span>{match.stats?.kills || 0} ELIMS</span>
                <span>{match.stats?.damageDealt || 0} DMG</span>
              </div>
            ))}
          </section>
        )}
        <button className="btn-primary interactive" id="restart-btn" onClick={onRestart}>RETURN TO LOBBY</button>
      </div>
    </div>
  );
}
