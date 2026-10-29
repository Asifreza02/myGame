import React, { useState, useEffect } from 'react';
import { MAGIC_STICKS, MAGIC_POWERS, WEAPON_DEFINITIONS } from '../game/data/combat.js';
import { audio } from '../game/audio.js';

const POWER_SLOT_HOTKEYS = ['2', '3', '4', '5', '6', '7', '8'];
const POWER_SLOT_SUBKEYS = ['Q', 'E', 'R', 'F', 'Z', 'X', 'V'];

export function EquipmentToggleBarComponent({
  equippedStick = 'APPRENTICE_STICK',
  powerSlots = ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', null, null, null, null],
  selectedSlotIndex = 0,
  backpack = { sticks: ['APPRENTICE_STICK'], powers: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP'], resources: {} },
  skillCounts = {},
  abilityCooldowns = {},
  stickCooldownMs = 0,
  onEquipStick,
  onActivatePower,
  onSetPowerSlot,
  onOpenBackpack,
  onOpenCrafting,
}) {
  const [now, setNow] = useState(Date.now());
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isChangeMode, setIsChangeMode] = useState(false);
  const [changingSlot, setChangingSlot] = useState(null); // null | { type: 'stick' } | { type: 'power', index: number }

  // Check if any ability or stick is actively on cooldown
  const hasActiveCooldown = stickCooldownMs > 0 || Object.values(abilityCooldowns).some((readyAt) => readyAt > now);

  // High-frequency refresh ONLY while abilities/sticks are on active cooldown
  useEffect(() => {
    if (!hasActiveCooldown) return;
    const timer = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(timer);
  }, [hasActiveCooldown]);

  const stickDef = MAGIC_STICKS[equippedStick] || WEAPON_DEFINITIONS[equippedStick] || MAGIC_STICKS.APPRENTICE_STICK;

  const handleStickClick = () => {
    if (isChangeMode) {
      setChangingSlot({ type: 'stick' });
      audio.playTick?.();
    } else {
      onEquipStick?.(equippedStick);
    }
  };

  const handlePowerClick = (powerId, slotIndex, count) => {
    if (isChangeMode || !powerId || count <= 0) {
      // In change mode or empty slot, open quick loadout switcher for this slot
      setChangingSlot({ type: 'power', index: slotIndex });
      audio.playTick?.();
      return;
    }
    const readyAt = abilityCooldowns[powerId] || 0;
    if (now >= readyAt) {
      onActivatePower?.(powerId, slotIndex);
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.setData('sourceSlot', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e, index) => {
    setDragOverIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    const sourceSlotStr = e.dataTransfer.getData('sourceSlot') || e.dataTransfer.getData('text/plain');
    if (sourceSlotStr !== '' && sourceSlotStr !== undefined && sourceSlotStr !== null) {
      const fromIdx = Number(sourceSlotStr);
      if (!isNaN(fromIdx) && fromIdx !== targetIndex) {
        const fromPower = powerSlots[fromIdx];
        const toPower = powerSlots[targetIndex];
        audio.playPlacement?.();
        onSetPowerSlot?.(fromIdx, toPower);
        onSetPowerSlot?.(targetIndex, fromPower);
      }
    }
  };

  const handleSelectSkillForSlot = (targetSlotIdx, selectedPowerId) => {
    audio.playPlacement?.();
    onSetPowerSlot?.(targetSlotIdx, selectedPowerId);
    setChangingSlot(null);
  };

  const handleClearSlot = (targetSlotIdx) => {
    audio.playTick?.();
    onSetPowerSlot?.(targetSlotIdx, null);
    setChangingSlot(null);
  };

  const handleSelectStick = (stickId) => {
    audio.playPlacement?.();
    onEquipStick?.(stickId);
    setChangingSlot(null);
  };

  // Filter skills that have count > 0 for equipping into loadout
  const availableSkillsWithCharges = Object.entries(MAGIC_POWERS)
    .filter(([pId]) => (skillCounts[pId] || 0) > 0)
    .map(([pId, def]) => ({ id: pId, ...def, count: skillCounts[pId] || 0 }));

  const ownedSticks = Array.isArray(backpack.sticks) && backpack.sticks.length > 0
    ? backpack.sticks
    : ['APPRENTICE_STICK'];

  // Ensure exactly 7 power slots are rendered
  const normalizedPowerSlots = Array.from({ length: 7 }).map((_, i) => powerSlots[i] ?? null);

  return (
    <nav className="equipment-toggle-dock magic-toggle-dock minimal-toggle-dock" aria-label="Powers Hotbar">
      {/* Quick Loadout Changer Popover Drawer */}
      {changingSlot && (
        <div className="quick-loadout-popover" role="dialog" aria-label="Change Loadout Item">
          <div className="quick-loadout-header">
            <span className="quick-loadout-title">
              {changingSlot.type === 'stick'
                ? '🪄 CHANGE PRIMARY WEAPON'
                : `⚡ CHANGE SLOT ${changingSlot.index + 1} (${POWER_SLOT_HOTKEYS[changingSlot.index]} / [${POWER_SLOT_SUBKEYS[changingSlot.index]}])`}
            </span>
            <button
              type="button"
              className="quick-loadout-close-btn"
              onClick={() => setChangingSlot(null)}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="quick-loadout-body">
            {changingSlot.type === 'stick' ? (
              <div className="quick-loadout-grid">
                {ownedSticks.map((sId) => {
                  const sDef = MAGIC_STICKS[sId] || WEAPON_DEFINITIONS[sId] || { name: sId, icon: '🪄' };
                  const isEquipped = sId === equippedStick;
                  return (
                    <button
                      key={sId}
                      type="button"
                      className={`quick-loadout-item-btn ${isEquipped ? 'is-selected' : ''}`}
                      onClick={() => handleSelectStick(sId)}
                      title={`${sDef.name} (${sDef.damage || 20} DMG)`}
                    >
                      <span className="item-icon">{sDef.icon || '🪄'}</span>
                      <span className="item-name">{sDef.name}</span>
                      {isEquipped && <span className="equipped-tag">EQUIPPED</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {availableSkillsWithCharges.length > 0 ? (
                  <div className="quick-loadout-grid">
                    {availableSkillsWithCharges.map((skill) => {
                      const isCurrentInSlot = normalizedPowerSlots[changingSlot.index] === skill.id;
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          className={`quick-loadout-item-btn ${isCurrentInSlot ? 'is-selected' : ''}`}
                          onClick={() => handleSelectSkillForSlot(changingSlot.index, skill.id)}
                          title={`${skill.name} (${skill.count} charges)`}
                        >
                          <span className="item-icon">{skill.icon || '✨'}</span>
                          <div className="item-details">
                            <span className="item-name">{skill.name}</span>
                            <span className="item-charges">⚡ {skill.count} charges</span>
                          </div>
                          {isCurrentInSlot && <span className="equipped-tag">SLOTTED</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="quick-loadout-empty-hint">
                    <p>⚠️ No crafted skills with charges available!</p>
                    <button
                      type="button"
                      className="quick-open-altar-btn"
                      onClick={() => {
                        setChangingSlot(null);
                        onOpenCrafting?.();
                      }}
                    >
                      ✨ Open Arcane Altar [C] to Forge Skills
                    </button>
                  </div>
                )}

                {normalizedPowerSlots[changingSlot.index] && (
                  <div className="quick-loadout-slot-footer">
                    <button
                      type="button"
                      className="quick-clear-slot-btn"
                      onClick={() => handleClearSlot(changingSlot.index)}
                    >
                      ✕ Unequip / Clear Slot {changingSlot.index + 1}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="quick-loadout-footer">
            <button
              type="button"
              className="quick-full-backpack-link"
              onClick={() => {
                setChangingSlot(null);
                onOpenBackpack?.();
              }}
            >
              🎒 Open Full Arcane Backpack & Grimoire [B]
            </button>
          </div>
        </div>
      )}

      {/* 1-Stick Weapon Slot */}
      <div className="equipment-group stick-group">
        <button
          type="button"
          className={`equip-slot-btn stick-slot interactive is-equipped ${selectedSlotIndex === 0 ? 'active-selected-slot' : ''} ${isChangeMode ? 'is-change-mode-slot' : ''}`}
          onClick={handleStickClick}
          title={isChangeMode ? 'Click to change primary staff' : `[1] ${stickDef.name} (${stickDef.damage} DMG) · Active Staff`}
        >
          <span className="slot-hotkey-badge">1</span>
          <span className="slot-icon">{stickDef.icon || '🪄'}</span>
          <span className="slot-ammo-badge">∞</span>
          {isChangeMode && <span className="slot-edit-indicator" title="Change Weapon">🔄</span>}
        </button>
      </div>

      <div className="equipment-divider" aria-hidden="true" />

      {/* 7-Power System Slots */}
      <div className="equipment-group powers-group">
        <div className="equipment-slots-row">
          {normalizedPowerSlots.map((powerId, index) => {
            const count = powerId ? (skillCounts[powerId] || 0) : 0;
            // If player has 0 count, skill is not active in loadout
            const hasCharges = count > 0;
            const def = (powerId && hasCharges) ? MAGIC_POWERS[powerId] : null;
            const readyAt = def ? (abilityCooldowns[powerId] || 0) : 0;
            const remainingMs = Math.max(0, readyAt - now);
            const isCoolingDown = remainingMs > 0;
            const cooldownSeconds = Math.ceil(remainingMs / 1000);
            const totalCooldownMs = (def?.cooldownMs) || 5000;
            const remainingRatio = Math.min(1, Math.max(0, remainingMs / totalCooldownMs));
            const numKey = POWER_SLOT_HOTKEYS[index];
            const isDragOver = dragOverIndex === index;
            const isTargetChanging = changingSlot?.type === 'power' && changingSlot.index === index;
            const isSelected = selectedSlotIndex === (index + 1);

            if (!def) {
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragOver={handleDragOver}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`equip-slot-btn power-slot empty-power-slot interactive ${isSelected ? 'active-selected-slot' : ''} ${isDragOver ? 'is-drag-over' : ''} ${isTargetChanging ? 'is-target-slot' : ''}`}
                  onClick={() => setChangingSlot({ type: 'power', index })}
                  title={`[${numKey}] Empty Slot. Click to change / assign a skill`}
                >
                  <span className="slot-hotkey-badge">{numKey}</span>
                  <span className="slot-icon empty-icon">+</span>
                  <span className="slot-assign-hint">SET</span>
                </button>
              );
            }

            const isTrap = def.kind === 'trap';

            return (
              <button
                key={`${powerId}-${index}`}
                type="button"
                draggable={!isChangeMode}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleDrop(e, index)}
                className={`equip-slot-btn power-slot interactive ${isTrap ? 'is-trap-slot' : 'is-spell-slot'} ${isCoolingDown ? 'is-cooldown' : 'is-ready'} ${isSelected ? 'active-selected-slot' : ''} ${isDragOver ? 'is-drag-over' : ''} ${isTargetChanging ? 'is-target-slot' : ''} ${isChangeMode ? 'is-change-mode-slot' : ''}`}
                disabled={!isChangeMode && isCoolingDown}
                onClick={() => handlePowerClick(powerId, index, count)}
                style={{
                  '--power-color': `#${(def.color || 0x00f0ff).toString(16).padStart(6, '0')}`,
                }}
                title={
                  isChangeMode
                    ? `Click to change slot ${index + 1}`
                    : isCoolingDown
                    ? `${def.name} (${cooldownSeconds}s) · ${count} charges`
                    : `[${numKey}] ${def.name} · ${count} charges ${isSelected ? '(Primed - Press Fire/Attack to use)' : ''}`
                }
              >
                <span className="slot-hotkey-badge">{numKey}</span>
                <span className="slot-icon">{def.icon || '✦'}</span>
                {isCoolingDown && !isChangeMode && (
                  <span className="slot-cooldown-num">{cooldownSeconds}</span>
                )}
                {/* Skill Count / Charge Badge */}
                <span className="slot-ammo-badge slot-charge-badge" title={`${count} charges remaining`}>
                  {count}
                </span>
                {isChangeMode && (
                  <span className="slot-edit-indicator" title="Click to change item">🔄</span>
                )}
                {isCoolingDown && !isChangeMode && (
                  <div
                    className="cooldown-overlay-sweep"
                    style={{
                      background: `conic-gradient(rgba(0, 0, 0, 0.78) ${remainingRatio * 360}deg, transparent 0deg)`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="equipment-divider" aria-hidden="true" />

      {/* Change Loadout & Modals Shortcuts */}
      <div className="equipment-group shortcuts-group">
        <div className="equipment-slots-row">
          {/* Change Loadout Toggle Button */}
          <button
            type="button"
            className={`equip-slot-btn loadout-toggle-btn interactive ${isChangeMode ? 'is-active-mode' : ''}`}
            onClick={() => {
              const next = !isChangeMode;
              setIsChangeMode(next);
              if (!next) setChangingSlot(null);
            }}
            title={isChangeMode ? 'Finish Changing Loadout' : 'Change Items in Loadout'}
          >
            <span className="slot-hotkey-badge">L</span>
            <span className="slot-icon">🔄</span>
            <span className="slot-label-small">{isChangeMode ? 'DONE' : 'SWAP'}</span>
          </button>

          <button
            type="button"
            className="equip-slot-btn backpack-shortcut-btn interactive"
            onClick={onOpenBackpack}
            title="Arcane Backpack & Grimoire [B]"
          >
            <span className="slot-hotkey-badge">B</span>
            <span className="slot-icon">🎒</span>
          </button>

          <button
            type="button"
            className="equip-slot-btn forge-shortcut-btn interactive"
            onClick={onOpenCrafting}
            title="Arcane Crafting Altar [C]"
          >
            <span className="slot-hotkey-badge">C</span>
            <span className="slot-icon">✨</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export const EquipmentToggleBar = React.memo(EquipmentToggleBarComponent);
