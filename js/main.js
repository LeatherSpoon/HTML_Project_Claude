import { SceneManager } from './scene/SceneManager.js';
import { Environment } from './scene/Environment.js';
import { Player } from './entities/Player.js';
import { EntityManager } from './entities/EntityManager.js';
import { PPSystem } from './systems/PPSystem.js';
import { StatsSystem } from './systems/StatsSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { PedometerSystem } from './systems/PedometerSystem.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { CraftingSystem } from './systems/CraftingSystem.js';
import { DroneSystem } from './systems/DroneSystem.js';
import { EquipmentSystem } from './systems/EquipmentSystem.js';
import { HUD } from './ui/HUD.js';
import { CombatUI } from './ui/CombatUI.js';
import { TouchInput } from './input/TouchInput.js';
import { CONFIG } from './config.js';
import { EnergySystem } from './systems/EnergySystem.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');

// Touch input (no-op on desktop)
const touchInput = new TouchInput();

// Systems
const ppSystem        = new PPSystem();
const statsSystem     = new StatsSystem();
const inventorySystem = new InventorySystem();
const energySystem    = new EnergySystem();
const combatSystem    = new CombatSystem(statsSystem, ppSystem, inventorySystem, energySystem);
const pedometer       = new PedometerSystem(ppSystem);
const craftingSystem  = new CraftingSystem(inventorySystem, statsSystem);
const droneSystem     = new DroneSystem(inventorySystem, ppSystem);
const equipmentSystem = new EquipmentSystem(statsSystem);

// Wire offload EXP callback
ppSystem.onOffloadExp(exp => statsSystem.receiveExp(exp));

// Wire crafting complete callback
craftingSystem.onCraftComplete = (recipe) => {
  if (recipe.type === 'equipment') {
    // Auto-equip or notify player
    const item = {
      label: recipe.label,
      slot: recipe.slot,
      tier: recipe.tier,
      statBonuses: recipe.statBonuses,
    };
    equipmentSystem.equip(item);
  }
};

// Renderer & scene
const sceneManager = new SceneManager(canvas);
const env = new Environment(sceneManager.scene);

// Entities
const player = new Player(sceneManager.scene, statsSystem, energySystem);

const entityManager = new EntityManager(sceneManager.scene, (enemy) => {
  player.isInCombat = true;
  combatUI.show(enemy);
  combatSystem.startCombat(enemy);
});

// Spawn entities for current zone
entityManager.spawnForZone(env.getEnemySpawns(), env.getResourceNodeSpawns(), env.getCurrentZoneId());

// UI
const hud = new HUD(
  statsSystem, ppSystem, pedometer,
  inventorySystem, craftingSystem, droneSystem, equipmentSystem,
  energySystem
);
const combatUI = new CombatUI(
  combatSystem, statsSystem, entityManager, player, inventorySystem
);

hud.setZoneLabel(env.getZoneLabel());

// ── Zone switching ────────────────────────────────────────────────────────────

function switchZone(zoneName) {
  // Remove player mesh temporarily
  sceneManager.scene.remove(player.group);

  // Switch environment
  env.switchZone(zoneName);

  // Re-add player
  sceneManager.scene.add(player.group);
  player.teleportTo(0, 0);

  // Respawn entities for new zone
  entityManager.spawnForZone(env.getEnemySpawns(), env.getResourceNodeSpawns(), env.getCurrentZoneId());

  combatSystem.setWorldSpace(zoneName);
  hud.setZoneLabel(env.getZoneLabel());
}

function checkPortals() {
  const portals = env.getPortals();
  for (const portal of portals) {
    const dist = player.position.distanceTo(portal.position);
    if (dist < 2.5) {
      if (portal.ppRequired > 0 && ppSystem.ppTotal < portal.ppRequired) {
        hud.showInteractHint(`Need ${portal.ppRequired} PP to enter ${portal.label}`);
        return;
      }
      hud.showInteractHint(`[E] Enter ${portal.label}`);
      if (keysDown.has('KeyE') && !player.isInCombat && !player.isGathering) {
        switchZone(portal.targetZone);
      }
      return;
    }
  }
}

// ── Input ─────────────────────────────────────────────────────────────────────

const keysDown = new Set();

document.addEventListener('keydown', e => {
  keysDown.add(e.code);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
    e.preventDefault();
  }

  // Panel toggles
  if (e.code === 'KeyI') togglePanel('inventory-panel');
  if (e.code === 'KeyC' && !player.isInCombat) togglePanel('crafting-panel');
  if (e.code === 'KeyR' && !player.isInCombat) togglePanel('drone-panel');
  if (e.code === 'KeyL') togglePanel('equipment-panel');
  if (e.code === 'KeyP') togglePanel('step-shop-panel');
});

document.addEventListener('keyup', e => {
  keysDown.delete(e.code);
});

document.addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') {
    setTimeout(() => document.body.focus(), 0);
  }
});
document.body.tabIndex = -1;

function checkLandingPadRestore(delta) {
  if (env.currentZone !== 'landingSite') return;
  // player.position.length() = distance from origin (the landing pad center)
  if (player.position.length() < CONFIG.ENERGY_LANDING_PAD_RADIUS) {
    energySystem.restoreOverTime(delta);
  }
}

function togglePanel(panelId) {
  const panels = ['inventory-panel', 'crafting-panel', 'drone-panel', 'equipment-panel', 'step-shop-panel'];
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const wasHidden = panel.hidden;
  // Close all
  for (const id of panels) {
    const p = document.getElementById(id);
    if (p) p.hidden = true;
  }
  panel.hidden = !wasHidden;
  if (!panel.hidden) hud._refreshPanel(panelId);
}

// Expose for mobile button onclick handlers
window.togglePanel = togglePanel;

// ── Gathering logic ──────────────────────────────────────────────────────────

let nearestNode = null;

function handleGathering(delta) {
  if (player.isInCombat) return;

  // Check if near a resource node
  nearestNode = entityManager.findNearestNode(player.position);

  if (player.isGathering) {
    // Update gather progress in HUD
    hud.showGatherProgress(player.gatherProgress, player.gatherDuration);

    // Check if complete
    const result = player.getGatherResult();
    if (result) {
      inventorySystem.addMaterial(result.material, result.amount);
      hud.hideGatherProgress();
    }
    return;
  }

  if (nearestNode) {
    hud.showInteractHint(`[E/ACT] Gather ${nearestNode.materialType}`);
    if (keysDown.has('KeyE') || touchInput.actionPressed) {
      player.startGathering(nearestNode);
    }
  }
}

// ── Game loop ─────────────────────────────────────────────────────────────────

let lastTime = performance.now();

function gameLoop(now) {
  const rawDelta = (now - lastTime) / 1000;
  lastTime = now;
  const delta = Math.min(rawDelta, 0.1);

  // Update player (pass touch input for mobile movement + action button)
  player.update(keysDown, delta, touchInput);

  // Update PP
  ppSystem.update(delta);

  // Update pedometer
  const steps = player.consumeSteps();
  pedometer.update(steps);

  // Update entities (enemies + resource nodes)
  entityManager.update(delta, player.position);

  // Update drone gathering
  droneSystem.update(delta);

  // Restore energy near landing pad
  checkLandingPadRestore(delta);

  // Update crafting progress
  craftingSystem.update(delta);

  // Handle resource gathering
  handleGathering(delta);

  // Check zone portals (only when not gathering/combat)
  let showingPortalHint = false;
  if (!player.isInCombat && !player.isGathering) {
    const portals = env.getPortals();
    for (const portal of portals) {
      const dist = player.position.distanceTo(portal.position);
      if (dist < 2.5) {
        showingPortalHint = true;
        if (portal.ppRequired > 0 && ppSystem.ppTotal < portal.ppRequired) {
          hud.showInteractHint(`Need ${portal.ppRequired} PP for ${portal.label}`);
        } else {
          hud.showInteractHint(`[E/ACT] Enter ${portal.label}`);
          if (keysDown.has('KeyE') || touchInput.actionPressed) {
            switchZone(portal.targetZone);
          }
        }
        break;
      }
    }
  }

  // Hide hints when not near anything
  if (!nearestNode && !showingPortalHint && !player.isGathering) {
    hud.hideInteractHint();
  }
  if (!player.isGathering) {
    hud.hideGatherProgress();
  }

  // Camera follows player
  sceneManager.update(player.position);

  // HUD (throttled internally)
  hud.update(now);

  // Render
  sceneManager.render();
}

sceneManager.renderer.setAnimationLoop(gameLoop);

console.log('%c⚡ Processing Power — ready', 'color:#00ffcc;font-size:1rem;');
console.log('WASD/Arrows: move | E: interact/gather | I: inventory | C: craft | R: drones | L: equipment | P: step shop');
