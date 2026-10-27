import React from 'react';
import { RESOURCE_DEFINITIONS } from '../game/data/world.js';
import { WEAPON_DEFINITIONS } from '../game/data/combat.js';

export function RunnerHudComponent({
  stats = {},
  resources = {},
  equippedWeapon = 'KNIFE',
  weapons = ['KNIFE'],
  ammo = {},
  onOpenCrafting,
  onEquipWeapon,
  onQuickHeal,
}) {
  const { health = 100, maxHealth = 100, stamina = 100, maxStamina = 100, buffs = [], knifeCooldownMs = 0 } = stats;
  const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const staminaPct = Math.max(0, Math.min(100, (stamina / maxStamina) * 100));

  const currentWeaponDef = WEAPON_DEFINITIONS[equippedWeapon] || WEAPON_DEFINITIONS.KNIFE;
  const currentAmmo = currentWeaponDef.ammo === Infinity ? '∞' : (ammo[equippedWeapon] ?? 0);

  return (
    <div id="runner-hud" className="minimal-runner-hud">
      {/* Compact Vitals Cluster */}
      <div className="hud-panel vitals-cluster">
        <div className="vital-row health-row" title={`Health: ${Math.ceil(health)} / ${maxHealth}`}>
          <span className="vital-icon">❤️</span>
          <div className="bar-track health-track">
            <div className="health-fill" style={{ width: `${healthPct}%` }} />
          </div>
          <span className="health-text">{Math.ceil(health)}</span>
          {health < maxHealth && (
            <button
              type="button"
              className="quick-heal-btn interactive"
              onClick={onQuickHeal}
              title="Vital Rejuvenation [H / 5]"
            >
              💚 Heal
            </button>
          )}
        </div>
        <div className="vital-row stamina-row" title={`Stamina: ${Math.round(staminaPct)}%`}>
          <span className="vital-icon">⚡</span>
          <div className="bar-track stamina-track">
            <div id="stamina-fill" style={{ width: `${staminaPct}%` }} />
          </div>
        </div>
      </div>

      {/* Weapon Quick Switcher (Only if multiple weapons) */}
      {weapons.length > 1 && (
        <div className="hud-panel weapon-switcher-bar">
          {weapons.map((wId) => {
            const wDef = WEAPON_DEFINITIONS[wId];
            if (!wDef) return null;
            return (
              <button
                key={wId}
                type="button"
                className={`weapon-switch-btn interactive ${wId === equippedWeapon ? 'active' : ''}`}
                onClick={() => onEquipWeapon && onEquipWeapon(wId)}
                title={wDef.name}
              >
                {wDef.icon}
              </button>
            );
          })}
        </div>
      )}

      {/* Collected Resources Bar */}
      {Object.values(resources).some((count) => count > 0) && (
        <div className="hud-panel resource-counts" aria-label="Collected resources">
          {Object.entries(resources).filter(([, count]) => count > 0).map(([id, count]) => {
            const resource = RESOURCE_DEFINITIONS[id];
            return resource ? (
              <span key={id} title={resource.name} className="resource-pill">
                {resource.icon} {count}
              </span>
            ) : null;
          })}
        </div>
      )}

      {buffs.length > 0 && (
        <div className="buff-container" id="runner-buffs">
          {buffs.map((buff) => (
            <div key={buff.type} className="buff-badge" style={{ border: `1px solid ${buff.color}` }}>
              <span style={{ color: buff.color }}>{buff.name}</span>
              <span className="buff-timer">{buff.timeLeft.toFixed(1)}s</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const RunnerHud = React.memo(RunnerHudComponent);
