import React, { useState, useMemo } from 'react';
import {
  ARCANE_CRAFTING_RECIPES,
  MAGIC_STICKS,
  MAGIC_POWERS,
  TRAP_DEFINITIONS,
} from '../game/data/combat.js';
import { RESOURCE_DEFINITIONS } from '../game/data/world.js';

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
  backpack = { sticks: [], powers: [], resources: {} },
  onCraft,
  onEquip,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('ALL');

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
              const count = resources[id] || backpack.resources?.[id] || 0;
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
        </div>

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
              const currentStock = resources[resId] || backpack.resources?.[resId] || 0;
              return currentStock >= reqCount;
            });

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
                      {isSlottedPower && <span className="equipped-badge">SLOTTED</span>}
                      {!isSlottedPower && isOwnedPower && <span className="owned-badge">LEARNED</span>}
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
                      const owned = resources[resId] || backpack.resources?.[resId] || 0;
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
                    className="craft-action-btn interactive"
                    disabled={!canCraft}
                    onClick={() => onCraft(recipe.originalIndex)}
                  >
                    {isStickRecipe
                      ? (isOwnedStick ? 'RE-FORGE' : 'FORGE & EQUIP')
                      : (isOwnedPower ? 'ALREADY LEARNED' : 'FORGE SPELL')}
                  </button>
                  {isStickRecipe && isOwnedStick && !isEquippedStick && (
                    <button
                      type="button"
                      className="equip-action-btn interactive"
                      onClick={() => onEquip(recipe.stickId)}
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
            Tip: Press [C] or Click Altar to toggle · Traps & Spells crafted are stored in your Backpack [B] and can be slotted in Hotbar [2-8]
          </span>
        </div>
      </div>
    </div>
  );
}
