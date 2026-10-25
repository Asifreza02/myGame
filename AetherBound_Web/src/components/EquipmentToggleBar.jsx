import React, { useState, useEffect } from 'react';
import { WEAPON_DEFINITIONS, ITEM_DEFINITIONS } from '../game/data/combat.js';

const SKILL_HOTKEYS = ['Q', 'E', 'R', 'F', 'Z', 'X'];

export function EquipmentToggleBar({
  weapons = ['KNIFE'],
  equippedWeapon = 'KNIFE',
  ammo = {},
  inventory = [],
  abilityCooldowns = {},
  knifeCooldownMs = 0,
  onEquipWeapon,
  onActivateAbility,
  onOpenCrafting,
}) {
  const [now, setNow] = useState(Date.now());

  // High-frequency refresh for ability cooldown timers
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  const handleWeaponClick = (wId) => {
    onEquipWeapon?.(wId);
  };

  const handleAbilityClick = (abilityId) => {
    const readyAt = abilityCooldowns[abilityId] || 0;
    if (now >= readyAt) {
      onActivateAbility?.(abilityId);
    }
  };

  return (
    <nav className="equipment-toggle-dock" aria-label="Weapons and Skills Quick-Select Bar">
      {/* ================= WEAPONS SECTION ================= */}
      <div className="equipment-group weapons-group">
        <div className="equipment-group-header">
          <span className="group-label">⚔️ WEAPONS</span>
          <span className="group-hint">KEYS [1-5] · SCROLL</span>
        </div>

        <div className="equipment-slots-row">
          {weapons.map((wId, index) => {
            const def = WEAPON_DEFINITIONS[wId] || WEAPON_DEFINITIONS.KNIFE;
            const isEquipped = wId === equippedWeapon;
            const isKnife = def.ammo === Infinity;
            const currentAmmo = isKnife ? '∞' : (ammo[wId] ?? 0);
            const hotkey = index + 1;

            return (
              <button
                key={wId}
                type="button"
                className={`equip-slot-btn weapon-slot interactive ${isEquipped ? 'is-equipped' : ''}`}
                onClick={() => handleWeaponClick(wId)}
                title={`[${hotkey}] Equip ${def.name} (${currentAmmo} ammo)`}
              >
                <span className="slot-hotkey-badge">{hotkey}</span>
                <span className="slot-icon">{def.icon}</span>
                <div className="slot-details">
                  <span className="slot-name">{def.name.split(' ')[0]}</span>
                  <span className={`slot-ammo ${!isKnife && currentAmmo === 0 ? 'empty-ammo' : ''}`}>
                    {currentAmmo}
                  </span>
                </div>
                {isEquipped && <span className="equipped-pill">ACTIVE</span>}
              </button>
            );
          })}

          {/* Quick Workbench Forge Button */}
          <button
            type="button"
            className="equip-slot-btn forge-shortcut-btn interactive"
            onClick={onOpenCrafting}
            title="Open Weapon Forge & Workbench [Press C]"
          >
            <span className="slot-hotkey-badge">C</span>
            <span className="slot-icon">⚒️</span>
            <div className="slot-details">
              <span className="slot-name">FORGE</span>
              <span className="slot-ammo">CRAFT</span>
            </div>
          </button>
        </div>
      </div>

      {/* ================= DIVIDER ================= */}
      <div className="equipment-divider" aria-hidden="true">
        <span className="divider-line" />
        <span className="divider-rune">❖</span>
        <span className="divider-line" />
      </div>

      {/* ================= SKILLS / ABILITIES SECTION ================= */}
      <div className="equipment-group skills-group">
        <div className="equipment-group-header">
          <span className="group-label">⚡ SKILLS</span>
          <span className="group-hint">KEYS [Q, E, R, F]</span>
        </div>

        <div className="equipment-slots-row">
          {inventory.length > 0 ? (
            inventory.map((abilityId, index) => {
              const def = ITEM_DEFINITIONS[abilityId] || { name: abilityId, icon: '✦', color: 0x00f0ff };
              const readyAt = abilityCooldowns[abilityId] || 0;
              const remainingMs = Math.max(0, readyAt - now);
              const isCoolingDown = remainingMs > 0;
              const cooldownSeconds = Math.ceil(remainingMs / 1000);
              const hotkey = SKILL_HOTKEYS[index] || (index + 1);

              return (
                <button
                  key={`${abilityId}-${index}`}
                  type="button"
                  className={`equip-slot-btn skill-slot interactive ${isCoolingDown ? 'is-cooldown' : 'is-ready'}`}
                  disabled={isCoolingDown}
                  onClick={() => handleAbilityClick(abilityId)}
                  style={{
                    '--skill-color': `#${(def.color || 0x00f0ff).toString(16).padStart(6, '0')}`,
                  }}
                  title={isCoolingDown ? `${def.name} cooling down (${cooldownSeconds}s)` : `[${hotkey}] Activate ${def.name}`}
                >
                  <span className="slot-hotkey-badge">{hotkey}</span>
                  <span className="slot-icon">{def.icon || '✦'}</span>
                  <div className="slot-details">
                    <span className="slot-name">{def.name.split(' ')[0]}</span>
                    <span className={`slot-status ${isCoolingDown ? 'cooldown-text' : 'ready-text'}`}>
                      {isCoolingDown ? `${cooldownSeconds}s` : 'READY'}
                    </span>
                  </div>
                  {isCoolingDown && (
                    <div
                      className="cooldown-overlay-sweep"
                      style={{
                        animationDuration: `${(def.cooldownMs || 10000) / 1000}s`,
                      }}
                    />
                  )}
                </button>
              );
            })
          ) : (
            <div className="empty-skill-hint" title="Explore the wilds to scavenge glowing Aether rune abilities!">
              <span className="empty-hint-icon">✦</span>
              <span className="empty-hint-text">LOOT RUNES IN THE WILDS</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
