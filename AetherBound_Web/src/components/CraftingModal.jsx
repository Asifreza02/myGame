import React, { useState, useMemo, useEffect } from 'react';
import {
  ARCANE_CRAFTING_RECIPES,
  MAGIC_STICKS,
  MAGIC_POWERS,
  TRAP_DEFINITIONS,
} from '../game/data/combat.js';
import { RESOURCE_DEFINITIONS } from '../game/data/world.js';
import { audio } from '../game/audio.js';

const TABS = [
  { id: 'ALL', label: 'All Recipes', icon: '✨' },
  { id: 'STICKS', label: 'Staves & Sticks', icon: '🪄' },
  { id: 'SPELLS', label: 'Spells', icon: '⚡' },
  { id: 'TRAPS', label: 'Ground Traps', icon: '🕸️' },
];

export function CraftingModal({
  visible = false,
  resources = {},
  weapons = ['APPRENTICE_STICK'],
  equippedStick = 'APPRENTICE_STICK',
  powerSlots = [],
  skillCounts = {},
  backpack = { sticks: [], powers: [], resources: {} },
  onCraft,
  onEquip,
  onChannelAltar,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('ALL');
  const [feedback, setFeedback] = useState(null);

  // Clear feedback on tab switch or visibility change
  useEffect(() => {
    setFeedback(null);
  }, [activeTab, visible]);

  const filteredRecipes = useMemo(() => {
    return ARCANE_CRAFTING_RECIPES.map((recipe, index) => ({ ...recipe, originalIndex: index }))
      .filter((recipe) => {
        if (activeTab === 'ALL') return true;
        if (activeTab === 'STICKS') return recipe.type === 'stick';
        if (activeTab === 'SPELLS') {
          return recipe.type === 'power' && !TRAP_DEFINITIONS[recipe.powerId];
        }
        if (activeTab === 'TRAPS') {
          return recipe.type === 'power' && Boolean(TRAP_DEFINITIONS[recipe.powerId]);
        }
        return true;
      });
  }, [activeTab]);

  if (!visible) return null;

  const handleCraftAttempt = (recipe, canCraft, isStickRecipe, isOwnedStick, isEquippedStick) => {
    if (!canCraft) {
      const missing = Object.entries(recipe.ingredients).map(([resId, reqCount]) => {
        const owned = Math.max(resources[resId] || 0, backpack.resources?.[resId] || 0);
        const def = RESOURCE_DEFINITIONS[resId];
        return owned < reqCount ? `${reqCount - owned}x ${def?.name || resId}` : null;
      }).filter(Boolean);

      audio.playCooldown?.();
      setFeedback({
        type: 'warn',
        message: `⚠️ Missing: ${missing.join(', ')}. Gather from the wilderness or tap "Channel Altar Aether"!`,
      });
      return;
    }

    // Call engine craft
    onCraft?.(recipe.originalIndex);
    audio.playCraftSuccess?.();

    if (isStickRecipe) {
      setFeedback({
        type: 'success',
        message: `✨ Forged ${recipe.name}! It is now equipped as your primary weapon.`,
      });
    } else {
      const currentCount = skillCounts[recipe.powerId] || 0;
      setFeedback({
        type: 'success',
        message: `✨ Forged ${recipe.name}! (+1 charge, total: ${currentCount + 1}). Added to active loadout!`,
      });
    }
  };

  const handleChannelAltarClick = () => {
    audio.playPowerupPickup?.();
    onChannelAltar?.();
    setFeedback({
      type: 'info',
      message: '✨ Channelled ambient Aether! Natural crafting essences added to your inventory.',
    });
  };

  return (
    <div className="crafting-modal-overlay" onClick={onClose}>
      <div className="crafting-modal-card arcane-altar-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="crafting-header">
          <div className="crafting-title-group">
            <span className="crafting-icon">✨</span>
            <div>
              <h2 className="crafting-title">Arcane Spell & Stick Altar</h2>
              <p className="crafting-subtitle">
                Harness harvested natural resources to forge enchanted staves, offensive spells, and tactical ground traps.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="crafting-close-btn interactive"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Natural Resource Stock Inventory Bar */}
        <div className="crafting-resources-bar arcane-resources-bar">
          <span className="resources-label">NATURAL RESOURCES:</span>
          <div className="resources-pill-grid">
            {Object.entries(RESOURCE_DEFINITIONS).map(([id, def]) => {
              if (def.aliasOf) return null; // Skip duplicate aliases
              const count = Math.max(resources[id] || 0, backpack.resources?.[id] || 0);
              return (
                <div
                  key={id}
                  className={`resource-pill ${count > 0 ? 'has-stock' : 'empty-stock'}`}
                  title={`${def.name} (${def.biome || 'Wilderness'})`}
                >
                  <span className="res-icon">{def.icon}</span>
                  <span className="res-name">{def.name}:</span>
                  <span className="res-count">{count}</span>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="altar-channel-btn interactive"
            onClick={handleChannelAltarClick}
            title="Channel ambient mana from the Altar to replenish basic crafting essences"
          >
            ⚡ Channel Altar Aether
          </button>
        </div>

        {/* Feedback / Guidance Banner */}
        {feedback && (
          <div className={`crafting-feedback-banner ${feedback.type}`}>
            <span>{feedback.message}</span>
            <button
              type="button"
              className="feedback-dismiss-btn"
              onClick={() => setFeedback(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '13px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Category Tabs */}
        <div className="crafting-tabs-row">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`crafting-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Recipes Grid */}
        <div className="recipes-grid arcane-recipes-grid">
          {filteredRecipes.map((recipe) => {
            const isStickRecipe = recipe.type === 'stick';
            const stickDef = isStickRecipe ? MAGIC_STICKS[recipe.stickId] : null;
            const powerDef = !isStickRecipe ? (MAGIC_POWERS[recipe.powerId] || TRAP_DEFINITIONS[recipe.powerId]) : null;
            const isTrapRecipe = Boolean(TRAP_DEFINITIONS[recipe.powerId]);

            // Ownership check
            const isOwnedStick = isStickRecipe && (
              weapons.includes(recipe.stickId) ||
              (backpack.sticks && backpack.sticks.includes(recipe.stickId))
            );
            const isEquippedStick = isStickRecipe && equippedStick === recipe.stickId;

            const isOwnedPower = !isStickRecipe && (
              backpack.powers && backpack.powers.includes(recipe.powerId)
            );
            const isSlottedPower = !isStickRecipe && powerSlots.includes(recipe.powerId);

            // Can craft check
            const canCraft = Object.entries(recipe.ingredients).every(([resId, reqCount]) => {
              const currentStock = Math.max(resources[resId] || 0, backpack.resources?.[resId] || 0);
              return currentStock >= reqCount;
            });

            // Action label
            let actionLabel = 'FORGE';
            if (isStickRecipe) {
              if (isEquippedStick) actionLabel = 'EQUIPPED ✨';
              else if (isOwnedStick) actionLabel = 'RE-FORGE 🪄';
              else if (canCraft) actionLabel = 'FORGE & EQUIP 🔮';
              else actionLabel = 'NEED MATERIALS 🔒';
            } else if (isTrapRecipe) {
              if (canCraft) actionLabel = 'FORGE TRAP (+1) 🕸️';
              else actionLabel = 'NEED MATERIALS 🔒';
            } else {
              if (canCraft) actionLabel = 'FORGE SPELL (+1) ✨';
              else actionLabel = 'NEED MATERIALS 🔒';
            }

            const currentCharges = !isStickRecipe ? (skillCounts[recipe.powerId] || 0) : null;

            return (
              <div
                key={recipe.stickId || recipe.powerId || recipe.originalIndex}
                className={`recipe-card arcane-recipe-card ${canCraft ? 'craftable' : 'locked'} ${
                  isEquippedStick || isSlottedPower ? 'is-active-item' : ''
                }`}
              >
                <div className="recipe-card-header">
                  <span className="recipe-weapon-icon">{recipe.icon}</span>
                  <div className="recipe-title-box">
                    <div className="recipe-name-row">
                      <span className="recipe-name">{recipe.name}</span>
                      {isEquippedStick && <span className="equipped-badge">EQUIPPED</span>}
                      {!isEquippedStick && isOwnedStick && <span className="owned-badge">OWNED</span>}
                      {currentCharges !== null && currentCharges > 0 && (
                        <span className="charges-stock-badge">⚡ {currentCharges} OWNED</span>
                      )}
                      {currentCharges !== null && currentCharges === 0 && (
                        <span className="depleted-stock-badge">0 CHARGES</span>
                      )}
                      {isTrapRecipe && <span className="trap-badge">GROUND TRAP</span>}
                    </div>

                    {/* Stats summary */}
                    {stickDef && (
                      <span className="recipe-stats">
                        {stickDef.damage} DMG · {stickDef.range}m RNG · {stickDef.element.toUpperCase()}
                      </span>
                    )}
                    {powerDef && (
                      <span className="recipe-stats">
                        {powerDef.damage || powerDef.burstDamage ? `${powerDef.damage || powerDef.burstDamage} DMG · ` : ''}
                        {powerDef.triggerRadius ? `${powerDef.triggerRadius}m Radius · ` : ''}
                        {Math.round((powerDef.cooldownMs || 10000) / 1000)}s Cooldown
                      </span>
                    )}
                  </div>
                </div>

                <p className="recipe-description">{recipe.description}</p>

                {/* Required Ingredients */}
                <div className="recipe-ingredients">
                  <span className="ingredients-label">Requires:</span>
                  <div className="ingredients-list">
                    {Object.entries(recipe.ingredients).map(([resId, reqCount]) => {
                      const owned = Math.max(resources[resId] || 0, backpack.resources?.[resId] || 0);
                      const hasEnough = owned >= reqCount;
                      const def = RESOURCE_DEFINITIONS[resId];
                      return (
                        <span
                          key={resId}
                          className={`ingredient-chip ${hasEnough ? 'satisfied' : 'missing'}`}
                        >
                          {def?.icon || '📦'} {def?.name || resId} ({owned}/{reqCount})
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Action Row */}
                <div className="recipe-action-row">
                  <button
                    type="button"
                    className={`craft-action-btn interactive ${!canCraft ? 'is-locked' : ''}`}
                    onClick={() => handleCraftAttempt(recipe, canCraft, isStickRecipe, isOwnedStick, isEquippedStick)}
                    title={!canCraft ? 'Click to see missing ingredients' : 'Click to forge item'}
                  >
                    {actionLabel}
                  </button>
                  {isStickRecipe && isOwnedStick && !isEquippedStick && (
                    <button
                      type="button"
                      className="equip-action-btn interactive"
                      onClick={() => onEquip?.(recipe.stickId)}
                    >
                      EQUIP
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="crafting-footer">
          <span>
            Tip: Press [C] or Click Altar to toggle · Traps & Spells crafted are stored in Backpack [B] and can be slotted in Hotbar [2-8]
          </span>
        </div>
      </div>
    </div>
  );
}
