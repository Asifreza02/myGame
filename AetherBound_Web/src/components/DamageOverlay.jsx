import React, { useEffect, useState } from 'react';

export function DamageOverlay({ damageFlash, statusEffects = [] }) {
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (!damageFlash) return;
    setIsFlashing(true);
    const timer = setTimeout(() => {
      setIsFlashing(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [damageFlash]);

  const isBurning = statusEffects.some((e) => e.type === 'BURN');
  const isFrozen = statusEffects.some((e) => e.type === 'FREEZE');

  return (
    <>
      <div
        id="damage-overlay"
        className={`${isFlashing ? 'flash' : ''} ${isBurning ? 'burning' : ''} ${isFrozen ? 'frozen' : ''}`}
      />
      {statusEffects.length > 0 && (
        <div className="status-effects-bar">
          {statusEffects.map((effect, idx) => (
            <div key={`${effect.type}-${idx}`} className={`status-pill ${effect.type.toLowerCase()}`}>
              {effect.type === 'BURN' && '🔥 Burning'}
              {effect.type === 'FREEZE' && '❄️ Frozen'}
              {effect.type === 'SLOW' && '🕸️ Slowed'}
              {effect.type !== 'BURN' && effect.type !== 'FREEZE' && effect.type !== 'SLOW' && `✨ ${effect.type}`}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
