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
}) {
  const { health = 100, maxHealth = 100, stamina = 100, maxStamina = 100, buffs = [], knifeCooldownMs = 0 } = stats;
  const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const staminaPct = Math.max(0, Math.min(100, (stamina / maxStamina) * 100));

  const currentWeaponDef = WEAPON_DEFINITIONS[equippedWeapon] || WEAPON_DEFINITIONS.KNIFE;
  const currentAmmo = currentWeaponDef.ammo === Infinity ? '∞' : (ammo[equippedWeapon] ?? 0);

  return (
    <div id="runner-hud">
      <div className="hud-panel health-container">
        <div className="player-vitals-heading">
          <span className="hud-label">HEALTH</span>
          <span className="health-text">{Math.ceil(health)} / {maxHealth}</span>
        </div>
        <div className="bar-track"><div className="health-fill" style={{ width: `${healthPct}%` }} /></div>
      </div>

      <div className="hud-panel progress-container">
        <span className="hud-label">STAMINA · SHIFT SPRINT</span>
        <div className="bar-track"><div id="stamina-fill" style={{ width: `${staminaPct}%` }} /></div>
      </div>

      {/* Active Weapon & Forge Toggle */}
      <div className="hud-panel weapon-hud-slot">
        <span className="weapon-hud-icon">{currentWeaponDef.icon}</span>
        <div className="weapon-hud-info">
          <span className="weapon-hud-name">{currentWeaponDef.name}</span>
          <span className="weapon-hud-ammo">{currentWeaponDef.ammo === Infinity ? 'BASIC SPELL: ∞' : `CHARGES: ${currentAmmo}`}</span>
        </div>
        <button
          type="button"
          className="workbench-toggle-btn interactive"
          onClick={onOpenCrafting}
          title="Open Arcane Altar & Crafting (Press C)"
        >
          ✨ ALTAR [C]
        </button>
      </div>

      {/* Weapon Quick Switcher */}
      {weapons.length > 1 && (
        <div className="hud-panel weapon-switcher-bar">
          <span className="hud-label" style={{ fontSize: '10px' }}>WEAPONS:</span>
          {weapons.map((wId) => {
            const wDef = WEAPON_DEFINITIONS[wId];
            if (!wDef) return null;
            const wAmmo = wDef.ammo === Infinity ? '∞' : (ammo[wId] ?? 0);
            return (
              <button
                key={wId}
                type="button"
                className={`weapon-switch-btn interactive ${wId === equippedWeapon ? 'active' : ''}`}
                onClick={() => onEquipWeapon && onEquipWeapon(wId)}
                title={`Switch to ${wDef.name} (${wAmmo} ammo)`}
              >
                {wDef.icon} {wDef.name.split(' ')[0]} ({wAmmo})
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
              <span key={id} title={resource.name} aria-label={`${resource.name}: ${count}`}>
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

      <div className="hud-panel view-controls-panel">
        <span className="hud-label">
          WASD MOVE · SPACE JUMP · CTRL SLIDE · {currentWeaponDef.type === 'melee' ? (knifeCooldownMs > 0 ? `KNIFE READY IN ${(knifeCooldownMs / 1000).toFixed(1)}s` : 'KNIFE READY') : `${currentWeaponDef.name.toUpperCase()} READY`} · CLICK TO SHOOT
        </span>
      </div>
    </div>
  );
}

export const RunnerHud = React.memo(RunnerHudComponent);
