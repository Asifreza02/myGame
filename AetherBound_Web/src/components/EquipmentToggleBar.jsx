import React, { useState, useEffect } from 'react';
import { MAGIC_STICKS, MAGIC_POWERS, WEAPON_DEFINITIONS } from '../game/data/combat.js';
import { audio } from '../game/audio.js';

const POWER_SLOT_HOTKEYS = ['2', '3', '4', '5', '6', '7', '8'];
const POWER_SLOT_SUBKEYS = ['Q', 'E', 'R', 'F', 'Z', 'X', 'V'];

export function EquipmentToggleBarComponent({
  equippedStick = 'APPRENTICE_STICK',
  powerSlots = ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', null, null, null, null],
  backpack = { sticks: ['APPRENTICE_STICK'], powers: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP'], resources: {} },
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

  // Check if any ability or stick is actively on cooldown
  const hasActiveCooldown = stickCooldownMs > 0 || Object.values(abilityCooldowns).some((readyAt) => readyAt > now);

  // High-frequency refresh ONLY while abilities/sticks are on active cooldown
  useEffect(() => {
    if (!hasActiveCooldown) return;
    const timer = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(timer);
  }, [hasActiveCooldown]);

  const stickDef = MAGIC_STICKS[equippedStick] || WEAPON_DEFINITIONS[equippedStick] || MAGIC_STICKS.APPRENTICE_STICK;

  const handlePowerClick = (powerId, slotIndex) => {
    if (!powerId) {
      onOpenBackpack?.();
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
        audio.playPlacement();
        onSetPowerSlot?.(fromIdx, toPower);
        onSetPowerSlot?.(targetIndex, fromPower);
      }
    }
  };

  // Ensure exactly 7 power slots are rendered
  const normalizedPowerSlots = Array.from({ length: 7 }).map((_, i) => powerSlots[i] ?? null);

  return (
    <nav className="equipment-toggle-dock magic-toggle-dock" aria-label="Magical Stick and 7 Powers Bar">
      {/* ================= DEDICATED 1-STICK WEAPON SLOT ================= */}
      <div className="equipment-group stick-group">
        <div className="equipment-group-header">
          <span className="group-label">🪄 STICK [1]</span>
          <span className="group-hint">BASIC CAST: ∞</span>
        </div>

        <div className="equipment-slots-row">
          <button
            type="button"
            className="equip-slot-btn stick-slot interactive is-equipped"
            onClick={() => onEquipStick?.(equippedStick)}
            title={`[1] ${stickDef.name} (${stickDef.damage} DMG · ${stickDef.range}m RNG)`}
          >
            <span className="slot-hotkey-badge">1</span>
            <span className="slot-icon">{stickDef.icon || '🪄'}</span>
            <div className="slot-details">
              <span className="slot-name">{stickDef.name?.split(' ')[0] || 'Wand'}</span>
              <span className="slot-ammo">SPARK ∞</span>
            </div>
            <span className="equipped-pill">ACTIVE</span>
          </button>
        </div>
      </div>

      {/* ================= RUNIC DIVIDER ================= */}
      <div className="equipment-divider" aria-hidden="true">
        <span className="divider-line" />
        <span className="divider-rune">❖</span>
        <span className="divider-line" />
      </div>

      {/* ================= STRICT 7-POWER SYSTEM SLOTS ================= */}
      <div className="equipment-group powers-group">
        <div className="equipment-group-header">
          <span className="group-label">⚡ 7 MAGICAL POWERS & TRAPS</span>
          <span className="group-hint">KEYS [2-8] · [Q,E,R,F,Z,X,V]</span>
        </div>

        <div className="equipment-slots-row">
          {normalizedPowerSlots.map((powerId, index) => {
            const def = powerId ? MAGIC_POWERS[powerId] : null;
            const readyAt = powerId ? (abilityCooldowns[powerId] || 0) : 0;
            const remainingMs = Math.max(0, readyAt - now);
            const isCoolingDown = remainingMs > 0;
            const cooldownSeconds = Math.ceil(remainingMs / 1000);
            const totalCooldownMs = (def?.cooldownMs) || 5000;
            const remainingRatio = Math.min(1, Math.max(0, remainingMs / totalCooldownMs));
            const numKey = POWER_SLOT_HOTKEYS[index];
            const subKey = POWER_SLOT_SUBKEYS[index];
            const isDragOver = dragOverIndex === index;

            if (!def) {
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragOver={handleDragOver}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`equip-slot-btn power-slot empty-power-slot interactive ${isDragOver ? 'is-drag-over' : ''}`}
                  onClick={() => onOpenBackpack?.()}
                  title={`[${numKey} or ${subKey}] Empty Slot ${index + 1}. Click or drag from Backpack [B]`}
                >
                  <span className="slot-hotkey-badge">{numKey}</span>
                  <span className="slot-icon empty-icon">+</span>
                  <div className="slot-details">
                    <span className="slot-name">SLOT {index + 1}</span>
                    <span className="slot-status empty-hint">ASSIGN</span>
                  </div>
                </button>
              );
            }

            const isTrap = def.kind === 'trap';

            return (
              <button
                key={`${powerId}-${index}`}
                type="button"
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleDrop(e, index)}
                className={`equip-slot-btn power-slot interactive ${isTrap ? 'is-trap-slot' : 'is-spell-slot'} ${isCoolingDown ? 'is-cooldown' : 'is-ready'} ${isDragOver ? 'is-drag-over' : ''}`}
                disabled={isCoolingDown}
                onClick={() => handlePowerClick(powerId, index)}
                style={{
                  '--power-color': `#${(def.color || 0x00f0ff).toString(16).padStart(6, '0')}`,
                }}
                title={
                  isCoolingDown
                    ? `${def.name} cooling down (${cooldownSeconds}s)`
                    : `[${numKey} or ${subKey}] Activate ${def.name} (${def.kind.toUpperCase()}) · Drag to swap`
                }
              >
                <span className="slot-hotkey-badge">{numKey}</span>
                <span className="slot-icon">{def.icon || '✦'}</span>
                <div className="slot-details">
                  <span className="slot-name">{def.name.split(' ')[0]}</span>
                  <span className={`slot-status ${isCoolingDown ? 'cooldown-text' : 'ready-text'}`}>
                    {isCoolingDown ? `${cooldownSeconds}s` : (isTrap ? 'TRAP' : 'READY')}
                  </span>
                </div>
                {isCoolingDown && (
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

      {/* ================= RUNIC DIVIDER ================= */}
      <div className="equipment-divider" aria-hidden="true">
        <span className="divider-line" />
        <span className="divider-rune">❖</span>
        <span className="divider-line" />
      </div>

      {/* ================= BACKPACK & ALTAR SHORTCUTS ================= */}
      <div className="equipment-group shortcuts-group">
        <div className="equipment-group-header">
          <span className="group-label">INVENTORY</span>
        </div>

        <div className="equipment-slots-row">
          {/* Backpack Full Inventory Button */}
          <button
            type="button"
            className="equip-slot-btn backpack-shortcut-btn interactive"
            onClick={onOpenBackpack}
            title="Open Arcane Backpack [Press B]"
          >
            <span className="slot-hotkey-badge">B</span>
            <span className="slot-icon">🎒</span>
            <div className="slot-details">
              <span className="slot-name">BAG</span>
              <span className="slot-ammo">{backpack.powers?.length || 0} POW</span>
            </div>
          </button>

          {/* Arcane Altar Crafting Shortcut Button */}
          <button
            type="button"
            className="equip-slot-btn forge-shortcut-btn interactive"
            onClick={onOpenCrafting}
            title="Open Arcane Crafting Altar [Press C]"
          >
            <span className="slot-hotkey-badge">C</span>
            <span className="slot-icon">✨</span>
            <div className="slot-details">
              <span className="slot-name">ALTAR</span>
              <span className="slot-ammo">CRAFT</span>
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
}

export const EquipmentToggleBar = React.memo(EquipmentToggleBarComponent);
