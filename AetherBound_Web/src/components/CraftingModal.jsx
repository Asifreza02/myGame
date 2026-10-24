import React from 'react';
import { WEAPON_CRAFTING_RECIPES, WEAPON_DEFINITIONS } from '../game/data/combat.js';
import { RESOURCE_DEFINITIONS } from '../game/data/world.js';

export function CraftingModal({
  visible = false,
  resources = {},
  weapons = ['KNIFE'],
  ammo = {},
  equippedWeapon = 'KNIFE',
  onCraft,
  onEquip,
  onClose,
}) {
  if (!visible) return null;

  return (
    <div className="crafting-modal-overlay" onClick={onClose}>
      <div className="crafting-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="crafting-header">
          <div className="crafting-title-group">
            <span className="crafting-icon">⚒️</span>
            <div>
              <h2 className="crafting-title">Aetherian Weapon Forge</h2>
              <p className="crafting-subtitle">
                Scavenge scrap & crystals across the battlefield to forge blasters and heavy artillery.
              </p>
            </div>
          </div>
          <button type="button" className="crafting-close-btn interactive" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Material Inventory Bar */}
        <div className="crafting-resources-bar">
          <span className="resources-label">YOUR MATERIALS:</span>
          <div className="resources-pill-grid">
            {Object.entries(RESOURCE_DEFINITIONS).map(([id, def]) => {
              const count = resources[id] || 0;
              return (
                <div key={id} className={`resource-pill ${count > 0 ? 'has-stock' : 'empty-stock'}`} title={def.name}>
                  <span className="res-icon">{def.icon}</span>
                  <span className="res-name">{def.name}:</span>
                  <span className="res-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recipes Grid */}
        <div className="recipes-grid">
          {WEAPON_CRAFTING_RECIPES.map((recipe, index) => {
            const weaponDef = recipe.weaponId ? WEAPON_DEFINITIONS[recipe.weaponId] : null;
            const isOwned = recipe.weaponId ? weapons.includes(recipe.weaponId) : false;
            const isEquipped = recipe.weaponId === equippedWeapon;
            const currentAmmo = recipe.weaponId ? (ammo[recipe.weaponId] || 0) : null;

            // Check if player has all ingredients
            const canCraft = Object.entries(recipe.ingredients).every(
              ([resId, reqCount]) => (resources[resId] || 0) >= reqCount
            );

            return (
              <div
                key={recipe.weaponId || recipe.ammoType || index}
                className={`recipe-card ${canCraft ? 'craftable' : 'locked'} ${isEquipped ? 'is-active-weapon' : ''}`}
              >
                <div className="recipe-card-header">
                  <span className="recipe-weapon-icon">{recipe.icon}</span>
                  <div className="recipe-title-box">
                    <div className="recipe-name-row">
                      <span className="recipe-name">{recipe.name}</span>
                      {isEquipped && <span className="equipped-badge">EQUIPPED</span>}
                      {isOwned && !isEquipped && <span className="owned-badge">OWNED</span>}
                    </div>
                    {weaponDef && (
                      <span className="recipe-stats">
                        {weaponDef.damage} DMG · {weaponDef.range}m RNG · {currentAmmo !== null ? `${currentAmmo} Ammo` : `${weaponDef.ammo} Mag`}
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
                      const owned = resources[resId] || 0;
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

                {/* Action Buttons */}
                <div className="recipe-action-row">
                  <button
                    type="button"
                    className="craft-action-btn interactive"
                    disabled={!canCraft}
                    onClick={() => onCraft(index)}
                  >
                    {isOwned ? `FORGE MORE (+${recipe.ammoGranted || 20})` : 'CRAFT & EQUIP'}
                  </button>
                  {isOwned && !isEquipped && recipe.weaponId && (
                    <button
                      type="button"
                      className="equip-action-btn interactive"
                      onClick={() => onEquip(recipe.weaponId)}
                    >
                      EQUIP
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="crafting-footer">
          <span>Tip: Press [C] or Click Workbench to toggle forge anytime · Switch weapons with [1-5]</span>
        </div>
      </div>
    </div>
  );
}
