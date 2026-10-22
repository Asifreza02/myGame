import React from 'react';
import { CRAFTING_RECIPES, RESOURCES } from '../game/config.js';

export function RunnerHud({
  stats = {},
  onLookAtGoal,
  onLookBehind,
  onToggleSteering,
  onCycleSens,
  onCraft,
  onUse,
}) {
  const {
    health = 100,
    maxHealth = 100,
    stamina = 100,
    maxStamina = 100,
    distanceToBeacon = 0,
    compassAngle = 0,
    sensitivity = 1.2,
    buffs = [],
    craftingInventory = { resources: {}, items: {} },
  } = stats;

  const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const staminaPct = Math.max(0, Math.min(100, (stamina / maxStamina) * 100));
  const isLowHealth = health < 30;

  return (
    <div id="runner-hud">
      {/* Compass to Beacon */}
      <div className="hud-panel compass-container">
        <div className="compass-dial">
          <div
            id="compass-arrow"
            style={{ transform: `rotate(${compassAngle}rad)` }}
          />
        </div>
        <div className="goal-info">
          <span className="hud-label">BEACON DISTANCE</span>
          <span id="distance-meter">{distanceToBeacon}m</span>
        </div>
      </div>

      {/* Health Bar */}
      <div className="hud-panel health-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="hud-label">HEALTH</span>
          <span
            id="runner-health-text"
            className="health-text"
            style={{ color: isLowHealth ? '#ff3344' : 'var(--neon-green)' }}
          >
            {Math.ceil(health)} / {maxHealth}
          </span>
        </div>
        <div className="bar-track">
          <div
            id="runner-health-fill"
            className="health-fill"
            style={{ width: `${healthPct}%` }}
          />
        </div>
      </div>

      {/* Stamina Bar */}
      <div className="hud-panel progress-container">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="hud-label">STAMINA [SHIFT SPRINT]</span>
        </div>
        <div className="bar-track">
          <div
            id="stamina-fill"
            style={{ width: `${staminaPct}%` }}
          />
        </div>
      </div>

      {/* Active Buffs Badges */}
      {buffs && buffs.length > 0 && (
        <div className="buff-container" id="runner-buffs">
          {buffs.map((b) => (
            <div
              key={b.type}
              className="buff-badge"
              style={{ border: `1px solid ${b.color}` }}
            >
              <div className="buff-left">
                <span className="buff-icon">{b.icon}</span>
                <span className="buff-name" style={{ color: b.color }}>
                  {b.name}
                </span>
              </div>
              <span className="buff-timer" style={{ color: b.color }}>
                {b.timeLeft.toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      )}

      <section className="hud-panel crafting-panel" aria-label="Crafting inventory">
        <div className="crafting-title-row">
          <span className="hud-label">FIELD CRAFTING</span>
          <span className="crafting-hint">Gather ingredients, craft, then use</span>
        </div>
        <div className="resource-inventory">
          {Object.values(RESOURCES).map((resource) => (
            <span className="resource-count" key={resource.id} title={resource.name}>
              <span aria-hidden="true">{resource.icon}</span>
              <span>{craftingInventory.resources?.[resource.id] || 0}</span>
            </span>
          ))}
        </div>
        <div className="recipe-list">
          {Object.values(CRAFTING_RECIPES).map((recipe) => {
            const itemCount = craftingInventory.items?.[recipe.id] || 0;
            const canCraft = Object.entries(recipe.ingredients).every(
              ([resourceId, amount]) => (craftingInventory.resources?.[resourceId] || 0) >= amount,
            );
            const ingredients = Object.entries(recipe.ingredients)
              .map(([resourceId, amount]) => `${RESOURCES[resourceId].icon} ${amount}`)
              .join(' + ');

            return (
              <div className="recipe-row" key={recipe.id}>
                <div className="recipe-info">
                  <span className="recipe-name">{recipe.icon} {recipe.name}</span>
                  <span className="recipe-ingredients">{ingredients} · {recipe.description}</span>
                </div>
                <div className="recipe-actions">
                  <button
                    type="button"
                    className="recipe-button interactive"
                    onClick={() => onCraft(recipe.id)}
                    disabled={!canCraft}
                    title={`Craft ${recipe.name}: ${ingredients}`}
                  >
                    Craft
                  </button>
                  <button
                    type="button"
                    className="recipe-button use-recipe-button interactive"
                    onClick={() => onUse(recipe.id)}
                    disabled={itemCount < 1}
                    title={`Use ${recipe.name} (${itemCount} available)`}
                  >
                    Use {itemCount > 0 ? `(${itemCount})` : ''}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Aim / Traversal Controls */}
      <div className="hud-panel view-controls-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="hud-label">TRAVERSAL &amp; AIM</span>
          <button
            id="sensitivity-badge"
            className="hotkey-pill interactive"
            onClick={onCycleSens}
            style={{ cursor: 'pointer', border: 'none' }}
          >
            ⚡ SENS: {sensitivity}x
          </button>
        </div>

        <div className="view-buttons-row">
          <button
            id="btn-look-goal"
            className="view-btn interactive"
            onClick={onLookAtGoal}
            title="Instantly face directly towards the Beacon Goal"
          >
            <span>🎯 Face Goal</span>
            <span className="hotkey-pill">[F]</span>
          </button>

          <button
            id="btn-look-behind"
            className="view-btn interactive"
            onClick={onLookBehind}
            title="Instantly 180° look behind you"
          >
            <span>🔄 Turn 180°</span>
            <span className="hotkey-pill">[C]</span>
          </button>

          <button
            id="btn-toggle-steering"
            className="view-btn interactive"
            onClick={onToggleSteering}
            title="Slide under obstacles"
          >
            <span>⚡ Slide</span>
            <span className="hotkey-pill">[Ctrl]</span>
          </button>
        </div>
        <div className="view-hint">
          <span>🎮 [WASD] Move • [Space] Jump/Vault • [Shift] Sprint • [Esc] Unlock Cursor</span>
        </div>
      </div>
    </div>
  );
}
