import React from 'react';
import { RESOURCE_DEFINITIONS } from '../game/data/world.js';

export function RunnerHud({ stats = {}, resources = {} }) {
  const { health = 100, maxHealth = 100, stamina = 100, maxStamina = 100, buffs = [], knifeCooldownMs = 0 } = stats;
  const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const staminaPct = Math.max(0, Math.min(100, (stamina / maxStamina) * 100));
  return (
    <div id="runner-hud">
      <div className="hud-panel health-container">
        <div className="player-vitals-heading"><span className="hud-label">HEALTH</span><span className="health-text">{Math.ceil(health)} / {maxHealth}</span></div>
        <div className="bar-track"><div className="health-fill" style={{ width: `${healthPct}%` }} /></div>
      </div>
      <div className="hud-panel progress-container">
        <span className="hud-label">STAMINA · SHIFT SPRINT</span>
        <div className="bar-track"><div id="stamina-fill" style={{ width: `${staminaPct}%` }} /></div>
      </div>
      {Object.values(resources).some((count) => count > 0) && (
        <div className="hud-panel resource-counts" aria-label="Collected resources">
          {Object.entries(resources).filter(([, count]) => count > 0).map(([id, count]) => {
            const resource = RESOURCE_DEFINITIONS[id];
            return resource ? <span key={id} title={resource.name} aria-label={`${resource.name}: ${count}`}>{resource.icon} {count}</span> : null;
          })}
        </div>
      )}
      {buffs.length > 0 && <div className="buff-container" id="runner-buffs">{buffs.map((buff) => (
        <div key={buff.type} className="buff-badge" style={{ border: `1px solid ${buff.color}` }}>
          <span style={{ color: buff.color }}>{buff.name}</span><span className="buff-timer">{buff.timeLeft.toFixed(1)}s</span>
        </div>
      ))}</div>}
      <div className="hud-panel view-controls-panel">
        <span className="hud-label">WASD MOVE · SPACE JUMP / VAULT · CTRL SLIDE · KNIFE {knifeCooldownMs > 0 ? `READY IN ${(knifeCooldownMs / 1000).toFixed(1)}s` : 'READY'} · CLICK TO ATTACK</span>
      </div>
    </div>
  );
}
