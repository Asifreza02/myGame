import React from 'react';

export function PlacementIndicator({ data = {} }) {
  const {
    visible = false,
    selectedType = 'WALL',
    dist = 16.0,
    maxDist = 75.0,
    hasEnergy = true,
    cost = 30,
    currentEnergy = 100,
    inRange = true,
  } = data;

  if (!visible) return null;

  const typeIcons = {
    WALL: '🧱 WALL PLACEMENT',
    MUD: '🧪 MUD TRAP PLACEMENT',
    SPIKES: '⚡ SPIKES PLACEMENT',
    BOULDER: '☄️ BOULDER PLACEMENT',
    BARREL: '💥 EXPLOSIVE BARREL PLACEMENT',
  };

  let statusClass = 'placement-status-valid';
  let statusText = '● READY TO PLACE • DRAG SCREEN TO AIM/DIST • TAP [PLACE] OR CLICK';

  if (!hasEnergy) {
    statusClass = 'placement-status-invalid';
    statusText = `⚡ NEED ${cost} ENERGY (HAVE ${Math.floor(currentEnergy)})`;
  } else if (!inRange) {
    statusClass = 'placement-status-invalid';
    statusText = `⚠️ OUT OF RANGE (> ${maxDist}m)`;
  }

  return (
    <div
      id="placement-indicator"
      className="placement-indicator"
      style={{
        position: 'fixed',
        bottom: '168px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
      }}
    >
      <div className="placement-title" id="placement-title">
        {typeIcons[selectedType] || `${selectedType} PLACEMENT`}
      </div>

      <div className={statusClass} id="placement-status">
        {statusText}
      </div>

      <div className="placement-dist" id="placement-dist">
        {dist ? dist.toFixed(1) : '0.0'}m / {maxDist}m [DRAG / WHEEL: FAR/NEAR]
      </div>
    </div>
  );
}
