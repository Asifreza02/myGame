import React, { useEffect, useState } from 'react';

export function DamageOverlay({ damageFlash }) {
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (!damageFlash) return;
    setIsFlashing(true);
    const timer = setTimeout(() => {
      setIsFlashing(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [damageFlash]);

  return (
    <div
      id="damage-overlay"
      className={isFlashing ? 'flash' : ''}
    />
  );
}
