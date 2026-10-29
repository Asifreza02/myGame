import React, { useState } from 'react';
import { MAGIC_STICKS, MAGIC_POWERS } from '../game/data/combat.js';
import { RESOURCE_DEFINITIONS } from '../game/data/world.js';
import { audio } from '../game/audio.js';

const POWER_SLOT_HOTKEYS = ['2 [Q]', '3 [E]', '4 [R]', '5 [F]', '6 [Z]', '7 [X]', '8 [V]'];

export function BackpackModal({
  visible = false,
  backpack = { sticks: ['APPRENTICE_STICK'], powers: ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP'], resources: {} },
  equippedStick = 'APPRENTICE_STICK',
  powerSlots = ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP', null, null, null, null],
  resources = {},
  skillCounts = {},
  onEquipStick,
  onSetPowerSlot,
  onOpenCrafting,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('EQUIPMENT'); // 'EQUIPMENT' | 'RESOURCES' | 'STICKS' | 'POWERS'
  const [selectedPowerToSlot, setSelectedPowerToSlot] = useState(null);
  const [targetSlotForChange, setTargetSlotForChange] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);

  if (!visible) return null;

  const ownedSticks = Array.isArray(backpack.sticks) && backpack.sticks.length > 0
    ? backpack.sticks
    : ['APPRENTICE_STICK'];

  const ownedPowers = Array.isArray(backpack.powers) && backpack.powers.length > 0
    ? backpack.powers
    : ['FIREBALL', 'FROST_LANCE', 'FROST_TRAP'];

  const mergedResources = {
    ...resources,
    ...(backpack.resources || {}),
  };

  const handleStickSelect = (stickId) => {
    audio.playCraftSuccess?.();
    onEquipStick?.(stickId);
  };

  const handleAssignPowerToSlot = (slotIdx, powerIdToAssign = selectedPowerToSlot) => {
    if (powerIdToAssign) {
      const count = skillCounts[powerIdToAssign] ?? 0;
      if (count <= 0) {
        audio.playCooldown?.();
        return;
      }
      audio.playPlacement?.();
      onSetPowerSlot?.(slotIdx, powerIdToAssign);
      setSelectedPowerToSlot(null);
      setTargetSlotForChange(null);
    }
  };

  const handleClearSlot = (slotIdx) => {
    audio.playTick?.();
    onSetPowerSlot?.(slotIdx, null);
    if (targetSlotForChange === slotIdx) {
      setTargetSlotForChange(null);
    }
  };

  const handleDragStartPower = (e, powerId, fromSlotIndex = null) => {
    const count = skillCounts[powerId] ?? 0;
    if (count <= 0) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', powerId);
    e.dataTransfer.setData('powerId', powerId);
    if (fromSlotIndex !== null) {
      e.dataTransfer.setData('fromSlotIndex', fromSlotIndex.toString());
    }
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleSlotDrop = (e, targetSlotIdx) => {
    e.preventDefault();
    setDragOverSlot(null);
    const powerId = e.dataTransfer.getData('powerId') || e.dataTransfer.getData('text/plain');
    const fromSlotIndexStr = e.dataTransfer.getData('fromSlotIndex');

    if (fromSlotIndexStr !== '' && fromSlotIndexStr !== undefined && fromSlotIndexStr !== null) {
      const fromIdx = Number(fromSlotIndexStr);
      if (!isNaN(fromIdx) && fromIdx !== targetSlotIdx) {
        // Swap slots
        const powerA = powerSlots[fromIdx];
        const powerB = powerSlots[targetSlotIdx];
        audio.playPlacement?.();
        onSetPowerSlot?.(fromIdx, powerB);
        onSetPowerSlot?.(targetSlotIdx, powerA);
        return;
      }
    }

    if (powerId && (MAGIC_POWERS[powerId] || ownedPowers.includes(powerId))) {
      const count = skillCounts[powerId] ?? 0;
      if (count <= 0) {
        audio.playCooldown?.();
        return;
      }
      audio.playPlacement?.();
      onSetPowerSlot?.(targetSlotIdx, powerId);
      setSelectedPowerToSlot(null);
      setTargetSlotForChange(null);
    }
  };

  return (
    <div className="crafting-modal-overlay" onClick={onClose}>
      <div
        className="crafting-modal-card backpack-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Arcane Backpack Inventory"
      >
        {/* Modal Header */}
        <div className="crafting-header">
          <div className="crafting-title-group">
            <span className="crafting-icon">🎒</span>
            <div>
              <h2 className="crafting-title">Arcane Backpack & Grimoire</h2>
              <p className="crafting-subtitle">
                Configure your 1-Staff + 7-Skill Hotbar loadout. Skills with zero charges are auto-removed from the loadout.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="crafting-close-btn interactive"
            onClick={onClose}
            aria-label="Close Backpack"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="backpack-tabs-bar">
          <button
            type="button"
            className={`backpack-tab-btn ${activeTab === 'EQUIPMENT' ? 'is-active' : ''}`}
            onClick={() => { setActiveTab('EQUIPMENT'); setSelectedPowerToSlot(null); setTargetSlotForChange(null); }}
          >
            ⚡ HOTBAR LOADOUT (1 STICK + 7 POWERS)
          </button>
          <button
            type="button"
            className={`backpack-tab-btn ${activeTab === 'STICKS' ? 'is-active' : ''}`}
            onClick={() => { setActiveTab('STICKS'); setSelectedPowerToSlot(null); setTargetSlotForChange(null); }}
          >
            🪄 STICKS & STAVES ({ownedSticks.length})
          </button>
          <button
            type="button"
            className={`backpack-tab-btn ${activeTab === 'POWERS' ? 'is-active' : ''}`}
            onClick={() => { setActiveTab('POWERS'); setSelectedPowerToSlot(null); setTargetSlotForChange(null); }}
          >
            🔮 SPELLS & TRAPS ({Object.keys(MAGIC_POWERS).length})
          </button>
          <button
            type="button"
            className={`backpack-tab-btn ${activeTab === 'RESOURCES' ? 'is-active' : ''}`}
            onClick={() => { setActiveTab('RESOURCES'); setSelectedPowerToSlot(null); setTargetSlotForChange(null); }}
          >
            🪵 RAW MATERIALS
          </button>
        </div>

        {/* ================= TAB 1: EQUIPMENT & HOTBAR SETUP ================= */}
        {activeTab === 'EQUIPMENT' && (
          <div className="backpack-tab-content">
            {/* Slot 1: Primary Stick */}
            <div className="backpack-section-title">
              <span>ACTIVE 1-STICK WEAPON SLOT</span>
              <span className="section-subtext">Click any stick to equip into your primary hand</span>
            </div>

            <div className="backpack-stick-row">
              {ownedSticks.map((sId) => {
                const def = MAGIC_STICKS[sId] || MAGIC_STICKS.APPRENTICE_STICK;
                const isEquipped = sId === equippedStick;
                return (
                  <div
                    key={sId}
                    className={`backpack-card stick-card ${isEquipped ? 'is-equipped' : ''}`}
                    onClick={() => handleStickSelect(sId)}
                  >
                    <div className="card-top">
                      <span className="card-icon">{def.icon}</span>
                      <div className="card-header-text">
                        <span className="card-name">{def.name}</span>
                        <span className="card-tag">{def.element.toUpperCase()} ELEMENT</span>
                      </div>
                      {isEquipped && <span className="equipped-badge">EQUIPPED</span>}
                    </div>
                    <div className="card-stats">
                      <span>💥 {def.damage} DMG</span>
                      <span>🎯 {def.range}m RNG</span>
                      <span>⚡ {def.cooldownMs}ms SPD</span>
                    </div>
                    <p className="card-desc">{def.description}</p>
                    <button
                      type="button"
                      className={`card-action-btn ${isEquipped ? 'btn-active' : 'btn-equip'}`}
                      onClick={() => handleStickSelect(sId)}
                    >
                      {isEquipped ? '✓ IN HAND' : 'EQUIP TO HAND'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Slots 2-8: 7 Powers */}
            <div className="backpack-section-title" style={{ marginTop: '20px' }}>
              <span>ACTIVE 7-POWER LOADOUT SLOTS</span>
              <span className="section-subtext">
                {targetSlotForChange !== null
                  ? `👉 Select a skill below to equip into Slot ${targetSlotForChange + 1}`
                  : selectedPowerToSlot
                  ? `👉 Click any slot below to place "${MAGIC_POWERS[selectedPowerToSlot]?.name || selectedPowerToSlot}"`
                  : 'Click [CHANGE] on a slot or click any skill below to equip into your loadout'}
              </span>
            </div>

            <div className="backpack-powers-grid">
              {Array.from({ length: 7 }).map((_, slotIdx) => {
                const powerId = powerSlots[slotIdx];
                const count = powerId ? (skillCounts[powerId] || 0) : 0;
                const def = (powerId && count > 0) ? MAGIC_POWERS[powerId] : null;
                const hotkey = POWER_SLOT_HOTKEYS[slotIdx];
                const isDragOver = dragOverSlot === slotIdx;
                const isTargetSelected = targetSlotForChange === slotIdx;

                return (
                  <div
                    key={slotIdx}
                    draggable={Boolean(def)}
                    onDragStart={(e) => def && handleDragStartPower(e, powerId, slotIdx)}
                    onDragEnter={() => setDragOverSlot(slotIdx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={(e) => handleSlotDrop(e, slotIdx)}
                    className={`backpack-slot-cell ${def ? 'has-power' : 'empty-cell'} ${
                      isTargetSelected ? 'target-for-change is-active-slot' : ''
                    } ${selectedPowerToSlot ? 'awaiting-assignment' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                    onClick={() => {
                      if (selectedPowerToSlot) {
                        handleAssignPowerToSlot(slotIdx);
                      } else {
                        setTargetSlotForChange(isTargetSelected ? null : slotIdx);
                      }
                    }}
                    title={def ? `Slot ${slotIdx + 1}: ${def.name} (${count} charges)` : `Slot ${slotIdx + 1}: Empty`}
                  >
                    <div className="slot-cell-header">
                      <span className="slot-number-badge">SLOT {slotIdx + 1}</span>
                      <span className="slot-key-hint">{hotkey}</span>
                    </div>

                    {def ? (
                      <div className="slot-cell-body">
                        <span className="slot-power-icon">{def.icon}</span>
                        <span className="slot-power-name">{def.name}</span>
                        <span className="slot-charge-badge-lg">⚡ {count} CHARGES</span>
                        <div className="slot-actions-row">
                          <button
                            type="button"
                            className="slot-swap-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetSlotForChange(slotIdx);
                            }}
                            title="Change item in this slot"
                          >
                            CHANGE
                          </button>
                          <button
                            type="button"
                            className="slot-remove-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearSlot(slotIdx);
                            }}
                            title="Remove from Loadout"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="slot-cell-empty">
                        <span className="empty-plus">+</span>
                        <span className="empty-text">
                          {selectedPowerToSlot
                            ? 'CLICK TO PLACE'
                            : isTargetSelected
                            ? 'PICK SKILL BELOW'
                            : 'CLICK TO ASSIGN'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Assignment or Slot Change Guidance Banner */}
            {(targetSlotForChange !== null || selectedPowerToSlot) && (
              <div className="slot-assignment-banner">
                {targetSlotForChange !== null ? (
                  <span>
                    👉 <strong>Slot {targetSlotForChange + 1}</strong> selected. Click any skill below to equip it!
                  </span>
                ) : (
                  <span>
                    Assigning <strong>{MAGIC_POWERS[selectedPowerToSlot]?.name}</strong> to your loadout. Click a slot above.
                  </span>
                )}
                <button
                  type="button"
                  className="cancel-assignment-btn"
                  onClick={() => {
                    setSelectedPowerToSlot(null);
                    setTargetSlotForChange(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Quick Picker for Skills in Equipment Tab */}
            <div className="backpack-section-title" style={{ marginTop: '24px' }}>
              <span>AVAILABLE SKILLS IN YOUR GRIMOIRE</span>
              <span className="section-subtext">
                Craft skills at the Arcane Altar [C] to replenish charges. Zero-charge skills cannot be slotted.
              </span>
            </div>

            <div className="backpack-cards-grid">
              {Object.entries(MAGIC_POWERS).map(([pId, def]) => {
                const count = skillCounts[pId] || 0;
                const hasCharges = count > 0;
                const isSlotted = powerSlots.includes(pId);
                const slotIndex = powerSlots.indexOf(pId);

                return (
                  <div
                    key={pId}
                    draggable={hasCharges}
                    onDragStart={(e) => hasCharges && handleDragStartPower(e, pId)}
                    className={`backpack-card power-card ${isSlotted ? 'is-slotted' : ''} ${!hasCharges ? 'is-depleted' : ''}`}
                    style={{ cursor: hasCharges ? 'grab' : 'not-allowed' }}
                  >
                    <div className="card-top">
                      <span className="card-icon">{def.icon}</span>
                      <div className="card-header-text">
                        <span className="card-name">{def.name}</span>
                        <span className={`card-tag ${def.kind === 'trap' ? 'trap-badge' : 'spell-badge'}`}>
                          {def.kind.toUpperCase()}
                        </span>
                      </div>
                      {hasCharges ? (
                        <span className="charges-stock-badge">⚡ {count} CHARGES</span>
                      ) : (
                        <span className="depleted-stock-badge">0 CHARGES</span>
                      )}
                    </div>

                    <p className="card-desc">{def.description}</p>

                    <div className="card-stats">
                      {def.damage && <span>💥 {def.damage} DMG</span>}
                      {def.burstDamage && <span>💥 {def.burstDamage} BURST</span>}
                      {def.freezeDurationMs && <span>❄️ {(def.freezeDurationMs / 1000).toFixed(1)}s FREEZE</span>}
                      {def.burnDoT && <span>🔥 3s BURN</span>}
                      <span>⏳ {(def.cooldownMs / 1000).toFixed(1)}s CD</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      {hasCharges ? (
                        <button
                          type="button"
                          className="card-action-btn btn-assign"
                          onClick={() => {
                            if (targetSlotForChange !== null) {
                              handleAssignPowerToSlot(targetSlotForChange, pId);
                            } else {
                              // Find first open slot or select
                              const openIdx = powerSlots.findIndex((s) => s === null);
                              if (openIdx !== -1) {
                                handleAssignPowerToSlot(openIdx, pId);
                              } else {
                                setSelectedPowerToSlot(pId);
                              }
                            }
                          }}
                        >
                          {targetSlotForChange !== null
                            ? `EQUIP TO SLOT ${targetSlotForChange + 1}`
                            : isSlotted
                            ? `SLOTTED (SLOT ${slotIndex + 1})`
                            : 'EQUIP TO LOADOUT'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="card-action-btn btn-craft-needed"
                          onClick={() => {
                            onClose();
                            onOpenCrafting?.();
                          }}
                          title="Open Arcane Altar to forge this skill"
                        >
                          ✨ CRAFT AT ALTAR [C]
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 2: STICKS & STAVES ================= */}
        {activeTab === 'STICKS' && (
          <div className="backpack-tab-content">
            <div className="backpack-cards-grid">
              {ownedSticks.map((sId) => {
                const def = MAGIC_STICKS[sId] || MAGIC_STICKS.APPRENTICE_STICK;
                const isEquipped = sId === equippedStick;
                return (
                  <div key={sId} className={`backpack-card stick-card ${isEquipped ? 'is-equipped' : ''}`}>
                    <div className="card-top">
                      <span className="card-icon">{def.icon}</span>
                      <div className="card-header-text">
                        <span className="card-name">{def.name}</span>
                        <span className="card-tag">{def.element.toUpperCase()} ELEMENT</span>
                      </div>
                      {isEquipped && <span className="equipped-badge">EQUIPPED</span>}
                    </div>
                    <div className="card-stats">
                      <span>💥 {def.damage} DMG</span>
                      <span>🎯 {def.range}m RNG</span>
                      <span>⚡ {def.cooldownMs}ms SPD</span>
                    </div>
                    <p className="card-desc">{def.description}</p>
                    <button
                      type="button"
                      className={`card-action-btn ${isEquipped ? 'btn-active' : 'btn-equip'}`}
                      onClick={() => handleStickSelect(sId)}
                    >
                      {isEquipped ? '✓ IN HAND' : 'EQUIP TO HAND'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 3: SPELLS & TRAPS ================= */}
        {activeTab === 'POWERS' && (
          <div className="backpack-tab-content">
            <div className="backpack-cards-grid">
              {Object.entries(MAGIC_POWERS).map(([pId, def]) => {
                const count = skillCounts[pId] || 0;
                const hasCharges = count > 0;
                const isSlotted = powerSlots.includes(pId);
                const slotIndex = powerSlots.indexOf(pId);

                return (
                  <div
                    key={pId}
                    draggable={hasCharges}
                    onDragStart={(e) => hasCharges && handleDragStartPower(e, pId)}
                    className={`backpack-card power-card ${isSlotted ? 'is-slotted' : ''} ${!hasCharges ? 'is-depleted' : ''}`}
                    style={{ cursor: hasCharges ? 'grab' : 'not-allowed' }}
                  >
                    <div className="card-top">
                      <span className="card-icon">{def.icon}</span>
                      <div className="card-header-text">
                        <span className="card-name">{def.name}</span>
                        <span className={`card-tag ${def.kind === 'trap' ? 'trap-badge' : 'spell-badge'}`}>
                          {def.kind.toUpperCase()} {def.category ? `· ${def.category.toUpperCase()}` : ''}
                        </span>
                      </div>
                      {hasCharges ? (
                        <span className="charges-stock-badge">⚡ {count} CHARGES</span>
                      ) : (
                        <span className="depleted-stock-badge">0 CHARGES</span>
                      )}
                    </div>
                    <p className="card-desc">{def.description}</p>
                    <div className="card-stats">
                      {def.damage && <span>💥 {def.damage} DMG</span>}
                      {def.burstDamage && <span>💥 {def.burstDamage} BURST</span>}
                      {def.freezeDurationMs && <span>❄️ {(def.freezeDurationMs / 1000).toFixed(1)}s FREEZE</span>}
                      {def.burnDoT && <span>🔥 3s BURN</span>}
                      <span>⏳ {(def.cooldownMs / 1000).toFixed(1)}s CD</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      {hasCharges ? (
                        <button
                          type="button"
                          className="card-action-btn btn-assign"
                          onClick={() => {
                            setSelectedPowerToSlot(pId);
                            setActiveTab('EQUIPMENT');
                          }}
                        >
                          {isSlotted ? `REASSIGN (SLOT ${slotIndex + 1})` : 'ASSIGN TO HOTBAR'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="card-action-btn btn-craft-needed"
                          onClick={() => {
                            onClose();
                            onOpenCrafting?.();
                          }}
                        >
                          ✨ FORGE AT ALTAR [C]
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 4: RAW MATERIALS ================= */}
        {activeTab === 'RESOURCES' && (
          <div className="backpack-tab-content">
            <div className="backpack-materials-grid">
              {Object.entries(RESOURCE_DEFINITIONS)
                .filter(([, def]) => !def.aliasOf)
                .map(([id, def]) => {
                  const count = mergedResources[id] || 0;
                  return (
                    <div key={id} className={`material-card ${count > 0 ? 'has-stock' : 'empty-stock'}`}>
                      <div className="material-top">
                        <span className="mat-icon">{def.icon}</span>
                        <div className="mat-info">
                          <span className="mat-name">{def.name}</span>
                          <span className="mat-biome">{def.biome?.toUpperCase()} BIOME</span>
                        </div>
                        <span className="mat-count">{count}</span>
                      </div>
                      <p className="mat-desc">{def.description}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Modal Footer Bar */}
        <div className="backpack-footer-bar">
          <div className="footer-stats">
            <span>Sticks: <strong>{ownedSticks.length}</strong></span>
            <span>Spells & Traps: <strong>{Object.keys(MAGIC_POWERS).length}</strong></span>
            <span>Total Resources: <strong>{Object.values(mergedResources).reduce((a, b) => a + (Number(b) || 0), 0)}</strong></span>
          </div>

          <div className="footer-actions">
            <button
              type="button"
              className="open-altar-btn interactive"
              onClick={() => {
                onClose();
                onOpenCrafting?.();
              }}
              title="Open Arcane Crafting Altar"
            >
              ✨ OPEN ARCANE ALTAR [C]
            </button>
            <button
              type="button"
              className="backpack-done-btn interactive"
              onClick={onClose}
            >
              CLOSE BACKPACK [ESC]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
