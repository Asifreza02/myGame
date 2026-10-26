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
  onEquipStick,
  onSetPowerSlot,
  onOpenCrafting,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('EQUIPMENT'); // 'EQUIPMENT' | 'RESOURCES' | 'STICKS' | 'POWERS'
  const [selectedPowerToSlot, setSelectedPowerToSlot] = useState(null);
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
    audio.playCraftSuccess();
    onEquipStick?.(stickId);
  };

  const handleAssignPowerToSlot = (slotIdx, powerIdToAssign = selectedPowerToSlot) => {
    if (powerIdToAssign) {
      audio.playPlacement();
      onSetPowerSlot?.(slotIdx, powerIdToAssign);
      setSelectedPowerToSlot(null);
    }
  };

  const handleClearSlot = (slotIdx) => {
    audio.playTick();
    onSetPowerSlot?.(slotIdx, null);
  };

  const handleDragStartPower = (e, powerId, fromSlotIndex = null) => {
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
        audio.playPlacement();
        onSetPowerSlot?.(fromIdx, powerB);
        onSetPowerSlot?.(targetSlotIdx, powerA);
        return;
      }
    }

    if (powerId && (MAGIC_POWERS[powerId] || ownedPowers.includes(powerId))) {
      audio.playPlacement();
      onSetPowerSlot?.(targetSlotIdx, powerId);
      setSelectedPowerToSlot(null);
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
                Drag-and-drop or click to assign spells and staves into your 8-slot action bar.
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
            onClick={() => { setActiveTab('EQUIPMENT'); setSelectedPowerToSlot(null); }}
          >
            ⚡ HOTBAR LOADOUT (1 STICK + 7 POWERS)
          </button>
          <button
            type="button"
            className={`backpack-tab-btn ${activeTab === 'STICKS' ? 'is-active' : ''}`}
            onClick={() => { setActiveTab('STICKS'); setSelectedPowerToSlot(null); }}
          >
            🪄 STICKS & STAVES ({ownedSticks.length})
          </button>
          <button
            type="button"
            className={`backpack-tab-btn ${activeTab === 'POWERS' ? 'is-active' : ''}`}
            onClick={() => { setActiveTab('POWERS'); setSelectedPowerToSlot(null); }}
          >
            🔮 SPELLS & TRAPS ({ownedPowers.length})
          </button>
          <button
            type="button"
            className={`backpack-tab-btn ${activeTab === 'RESOURCES' ? 'is-active' : ''}`}
            onClick={() => { setActiveTab('RESOURCES'); setSelectedPowerToSlot(null); }}
          >
            🪵 RAW MATERIALS
          </button>
        </div>

        {/* ================= TAB 1: EQUIPMENT & HOTBAR SETUP ================= */}
        {activeTab === 'EQUIPMENT' && (
          <div className="backpack-tab-content">
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

            <div className="backpack-section-title" style={{ marginTop: '20px' }}>
              <span>ACTIVE 7-POWER TOGGLE BAR SLOTS</span>
              <span className="section-subtext">
                {selectedPowerToSlot
                  ? `👉 Select a slot below to place "${MAGIC_POWERS[selectedPowerToSlot]?.name || selectedPowerToSlot}"`
                  : 'Drag & drop spells here or drag between slots to reorder'}
              </span>
            </div>

            <div className="backpack-powers-grid">
              {Array.from({ length: 7 }).map((_, slotIdx) => {
                const powerId = powerSlots[slotIdx];
                const def = powerId ? MAGIC_POWERS[powerId] : null;
                const hotkey = POWER_SLOT_HOTKEYS[slotIdx];
                const isDragOver = dragOverSlot === slotIdx;

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
                    className={`backpack-slot-cell ${def ? 'has-power' : 'empty-cell'} ${selectedPowerToSlot ? 'awaiting-assignment' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                    onClick={() => selectedPowerToSlot ? handleAssignPowerToSlot(slotIdx) : null}
                    title={def ? `Drag to re-order, or click remove button` : `Drag a spell or click with a selected spell`}
                  >
                    <div className="slot-cell-header">
                      <span className="slot-number-badge">SLOT {slotIdx + 1}</span>
                      <span className="slot-key-hint">{hotkey}</span>
                    </div>

                    {def ? (
                      <div className="slot-cell-body">
                        <span className="slot-power-icon">{def.icon}</span>
                        <span className="slot-power-name">{def.name}</span>
                        <span className={`slot-kind-badge ${def.kind === 'trap' ? 'trap-badge' : 'spell-badge'}`}>
                          {def.kind.toUpperCase()}
                        </span>
                        <button
                          type="button"
                          className="slot-remove-btn"
                          onClick={(e) => { e.stopPropagation(); handleClearSlot(slotIdx); }}
                          title="Remove from Hotbar"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="slot-cell-empty">
                        <span className="empty-plus">+</span>
                        <span className="empty-text">
                          {selectedPowerToSlot ? 'CLICK TO PLACE' : 'DRAG SPELL HERE'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedPowerToSlot && (
              <div className="slot-assignment-banner">
                <span>Assigning <strong>{MAGIC_POWERS[selectedPowerToSlot]?.name}</strong> to your hotbar.</span>
                <button
                  type="button"
                  className="cancel-assignment-btn"
                  onClick={() => setSelectedPowerToSlot(null)}
                >
                  Cancel
                </button>
              </div>
            )}
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
              {ownedPowers.map((pId) => {
                const def = MAGIC_POWERS[pId];
                if (!def) return null;
                const isSlotted = powerSlots.includes(pId);
                const slotIndex = powerSlots.indexOf(pId);

                return (
                  <div
                    key={pId}
                    draggable={true}
                    onDragStart={(e) => handleDragStartPower(e, pId)}
                    className={`backpack-card power-card ${isSlotted ? 'is-slotted' : ''}`}
                    style={{ cursor: 'grab' }}
                  >
                    <div className="card-top">
                      <span className="card-icon">{def.icon}</span>
                      <div className="card-header-text">
                        <span className="card-name">{def.name}</span>
                        <span className={`card-tag ${def.kind === 'trap' ? 'trap-badge' : 'spell-badge'}`}>
                          {def.kind.toUpperCase()} {def.category ? `· ${def.category.toUpperCase()}` : ''}
                        </span>
                      </div>
                      {isSlotted && <span className="slotted-badge">SLOT {slotIndex + 1}</span>}
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
                      <button
                        type="button"
                        className="card-action-btn btn-assign"
                        onClick={() => {
                          setSelectedPowerToSlot(pId);
                          setActiveTab('EQUIPMENT');
                        }}
                      >
                        {isSlotted ? 'REASSIGN SLOT' : 'ASSIGN TO HOTBAR'}
                      </button>
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
            <span>Spells & Traps: <strong>{ownedPowers.length}</strong></span>
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
