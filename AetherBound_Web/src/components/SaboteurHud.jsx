import React from 'react';
import { OBSTACLES } from '../game/config.js';

export function SaboteurHud({
  stats = {},
  onSelectObstacle,
  onTriggerRecon,
  onCycleSens,
  onLookAtGoal,
  onLookBehind,
}) {
  const {
    health = 100,
    maxHealth = 100,
    stamina = 100,
    maxStamina = 100,
    energy = 100,
    maxEnergy = 100,
    reconCooldown = 14,
    reconCooldownTimer = 0,
    selectedType = 'WALL',
    isPlacing = true,
    sensitivity = 1.2,
    buffs = [],
  } = stats;

  const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const staminaPct = Math.max(0, Math.min(100, (stamina / maxStamina) * 100));
  const energyPct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
  const isLowHealth = health < 30;

  const reconPct = reconCooldown > 0 ? (reconCooldownTimer / reconCooldown) * 100 : 0;
  const isReconCooling = reconCooldownTimer > 0;

  const obstacleTypes = ['WALL', 'MUD', 'SPIKES', 'BOULDER', 'BARREL'];
  const hotkeyMap = { WALL: '1', MUD: '2', SPIKES: '3', BOULDER: '4', BARREL: '5' };
  const iconMap = { WALL: '🧱', MUD: '🧪', SPIKES: '⚡', BOULDER: '☄️', BARREL: '💥' };

  return (
    <div id="saboteur-hud">
      {/* Top row with Health, Stamina, Energy, Recon */}
      <div className="saboteur-top-row">
        {/* Saboteur Health */}
        <div className="hud-panel health-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="hud-label">HEALTH</span>
            <span
              id="saboteur-health-text"
              className="health-text"
              style={{ color: isLowHealth ? '#ff3344' : 'var(--neon-green)' }}
            >
              {Math.ceil(health)} / {maxHealth}
            </span>
          </div>
          <div className="bar-track">
            <div
              id="saboteur-health-fill"
              className="health-fill"
              style={{ width: `${healthPct}%` }}
            />
          </div>
        </div>

        {/* Saboteur Stamina */}
        <div className="hud-panel progress-container">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="hud-label">STAMINA [SHIFT]</span>
          </div>
          <div className="bar-track">
            <div
              id="saboteur-stamina-fill"
              style={{ width: `${staminaPct}%` }}
            />
          </div>
        </div>

        {/* Saboteur Energy */}
        <div className="hud-panel energy-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="hud-label">TACTICAL ENERGY</span>
            <span id="energy-text" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--neon-orange)' }}>
              {Math.floor(energy)} / {maxEnergy}
            </span>
          </div>
          <div className="bar-track">
            <div
              id="energy-fill"
              style={{ width: `${energyPct}%` }}
            />
          </div>
        </div>

        {/* Recon Pulse Scanner */}
        <div className="hud-panel recon-panel">
          <button
            id="btn-recon-pulse"
            className={`recon-btn interactive ${isReconCooling ? 'cooling' : ''}`}
            onClick={onTriggerRecon}
            title="Scan terrain to highlight Runner location through obstacles"
          >
            <div
              id="recon-cooldown-overlay"
              style={{ width: `${reconPct}%` }}
            />
            <span className="recon-label">
              {isReconCooling
                ? `📡 Scanner (${Math.ceil(reconCooldownTimer)}s)`
                : `📡 Recon Pulse`}
            </span>
            <span className="hotkey-pill">[X]</span>
          </button>
        </div>
      </div>

      {/* Active Buffs */}
      {buffs && buffs.length > 0 && (
        <div className="buff-container" id="saboteur-buffs">
          {buffs.map((b) => (
            <div
              key={b.type}
              className="buff-badge"
              style={{ border: `1px solid ${b.color}` }}
            >
              <div className="buff-left">
                <span className="buff-icon">{b.icon}</span>
                <span className="buff-name" style={{ color: b.color }}>
                  {b.name}
                </span>
              </div>
              <span className="buff-timer" style={{ color: b.color }}>
                {b.timeLeft.toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Traversal / Aim controls */}
      <div className="hud-panel view-buttons-row" style={{ padding: '6px 14px' }}>
        <button
          className="view-btn interactive"
          onClick={onLookAtGoal}
          title="Face Beacon Goal"
        >
          <span>🎯 Face Goal</span>
          <span className="hotkey-pill">[F]</span>
        </button>
        <button
          className="view-btn interactive"
          onClick={onLookBehind}
          title="Face Behind"
        >
          <span>🔄 Turn 180°</span>
          <span className="hotkey-pill">[C]</span>
        </button>
        <button
          className="hotkey-pill interactive"
          onClick={onCycleSens}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          ⚡ SENS: {sensitivity}x
        </button>
      </div>

      {/* Obstacles Hotbar */}
      <div className="hotbar-container">
        {obstacleTypes.map((type) => {
          const def = OBSTACLES[type] || {};
          const isSelected = isPlacing && selectedType === type;
          const hasEnoughEnergy = energy >= def.cost;

          return (
            <div
              key={type}
              className={`hotbar-item interactive ${isSelected ? 'active' : ''}`}
              data-type={type}
              onClick={() => onSelectObstacle(type)}
              style={{ opacity: hasEnoughEnergy ? 1 : 0.65 }}
            >
              <span className="hotkey-badge">{hotkeyMap[type]}</span>
              <span className="hotbar-icon">{iconMap[type]}</span>
              <span className="hotbar-name">{def.name || type}</span>
              <span className="hotbar-cost">⚡ {def.cost}</span>
            </div>
          );
        })}
      </div>

      <div className="saboteur-instructions">
        <span>🖱️ AIM WITH POV • [WHEEL / MOUSE-Y] NEAR/FAR • [LEFT-CLICK] PLACE • [R / RIGHT-CLICK] ROTATE • [0] DESELECT</span>
      </div>
    </div>
  );
}
