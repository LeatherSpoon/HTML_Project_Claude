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

// ── Bootstrap ────────────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');

// Touch input (no-op on desktop)
const touchInput = new TouchInput();

// Systems
const ppSystem        = new PPSystem();
const statsSystem     = new StatsSystem();
const inventorySystem = new InventorySystem();
const combatSystem    = new CombatSystem(statsSystem, ppSystem, inventorySystem);
const pedometer       = new PedometerSystem(ppSystem);
const craftingSystem  = new CraftingSystem(inventorySystem, statsSystem);
const droneSystem     = new DroneSystem(inventorySystem, ppSystem);
const equipmentSystem = new EquipmentSystem(statsSystem);

// Wire rescue drone — switches zone back to Landing Site after defeat
combatSystem.onRescue = () => {
  setTimeout(() => switchZone('landingSite'), 1200);
};

// Wire crafting complete callback
craftingSystem.onCraftComplete = (recipe) => {
  if (recipe.type === 'equipment') {
    const item = {
      label: recipe.label,
      slot: recipe.slot,
      tier: recipe.tier,
      statBonuses: recipe.statBonuses,
    };
    equipmentSystem.equip(item);
  }
  // Always refresh the crafting panel so it clears the "Crafting..." state
  hud.onCraftingComplete();
};

// Renderer & scene
const sceneManager = new SceneManager(canvas);
const env = new Environment(sceneManager.scene);

// Entities
const player = new Player(sceneManager.scene, statsSystem);

const entityManager = new EntityManager(sceneManager.scene, (enemy) => {
  player.isInCombat = true;
  combatUI.show(enemy);
  combatSystem.startCombat(enemy);
});

// Spawn entities for current zone
entityManager.spawnForZone(env.getEnemySpawns(), env.getResourceNodeSpawns());

// UI
const hud = new HUD(
  statsSystem, ppSystem, pedometer,
  inventorySystem, craftingSystem, droneSystem, equipmentSystem
);
const combatUI = new CombatUI(
  combatSystem, statsSystem, entityManager, player, inventorySystem, ppSystem
);

hud.setZoneLabel(env.getZoneLabel());

// ── Zone switching ─────────────────────────────────────────────────────────────

const ZONE_TERRAIN = {
  landingSite: 'grass',
  mine: 'rock',
  verdantMaw: 'forest',
  lagoonCoast: 'grass',
  frozenTundra: 'rock',
  spaceship: 'rock',
};

// Per-zone player spawn positions — places player near the entry/exit portal
const ZONE_SPAWN_POS = {
  landingSite:  [0, 0],
  mine:         [0, -13],  // near south return portal
  verdantMaw:   [0, 14],   // near south return portal at z=17
  lagoonCoast:  [15, 0],   // near east entry portal
  frozenTundra: [0, -15],  // near north entry portal
  spaceship:    [0, -3],   // near the entry hatch, away from exit portal at (0,6)
};

function switchZone(zoneName) {
  sceneManager.scene.remove(player.group);
  env.switchZone(zoneName);
  sceneManager.scene.add(player.group);

  const spawnPos = ZONE_SPAWN_POS[zoneName] || [0, 0];
  player.teleportTo(spawnPos[0], spawnPos[1]);
  player.currentTerrain = ZONE_TERRAIN[zoneName] || 'grass';

  entityManager.spawnForZone(env.getEnemySpawns(), env.getResourceNodeSpawns());
  hud.setZoneLabel(env.getZoneLabel());
  env.refreshTrackMarkers(pedometer);

  // Reset gather/interaction state on zone switch
  _nearestTree = null;
  _nearestRock = null;
  _gatherTarget = null;
  _gatherTimer = 0;
  _gatherType = null;
  player.isGathering = false;
}

let _pendingZone = null;

// ── Input ──────────────────────────────────────────────────────────────────────

const keysDown = new Set();

document.addEventListener('keydown', e => {
  keysDown.add(e.code);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
    e.preventDefault();
  }

  // Panel toggles
  if (e.code === 'KeyI') togglePanel('inventory-panel');
  if (e.code === 'KeyR' && !player.isInCombat) togglePanel('drone-panel');
  if (e.code === 'KeyL') togglePanel('equipment-panel');
  if (e.code === 'KeyP') togglePanel('pedometer-panel');
  // [S] — toggle stats sidebar
  if (e.code === 'KeyS') {
    const sb = document.getElementById('stat-sidebar');
    if (sb) sb.hidden = !sb.hidden;
  }
  if (e.code === 'KeyB' && !player.isInCombat && env.currentZone !== 'landingSite') {
    _pendingZone = 'landingSite';
  }
  if (e.code === 'KeyT' && !player.isInCombat && pedometer.pendingTracks > 0) {
    const snappedX = Math.round(player.position.x / 2) * 2;
    const snappedZ = Math.round(player.position.z / 2) * 2;
    pedometer.placeTrack(env.currentZone, snappedX, snappedZ, statsSystem);
    env.refreshTrackMarkers(pedometer);
    hud._refreshPanel('pedometer-panel');
  }
  // [G] — remove nearest track
  if (e.code === 'KeyG' && !player.isInCombat) {
    const nearTrack = pedometer.getPlacedTracksForZone(env.currentZone)
      .find(t => Math.hypot(player.position.x - t.x, player.position.z - t.z) < 1.0);
    if (nearTrack) {
      pedometer.removeTrack(env.currentZone, nearTrack.x, nearTrack.z);
      env.refreshTrackMarkers(pedometer);
      hud._refreshPanel('pedometer-panel');
    }
  }
  // [F] key — plant seed
  if (e.code === 'KeyF' && !player.isInCombat && !player.isGathering) {
    _tryPlantSeed();
  }
});

document.addEventListener('keyup', e => {
  keysDown.delete(e.code);
});

document.addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') {
    setTimeout(() => document.body.focus(), 0);
  }
});
document.body.tabIndex = -1;

function togglePanel(panelId) {
  const panels = ['inventory-panel', 'crafting-panel', 'drone-panel', 'equipment-panel', 'pedometer-panel'];
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const wasHidden = panel.hidden;
  for (const id of panels) {
    const p = document.getElementById(id);
    if (p) p.hidden = true;
  }
  panel.hidden = !wasHidden;
  if (!panel.hidden) hud._refreshPanel(panelId);
}

window.togglePanel = togglePanel;

function _tryPlantSeed() {
  if (inventorySystem.materials.seed <= 0) return;
  // Check no collision nearby (don't plant on top of obstacles)
  const px = player.position.x, pz = player.position.z;
  const tooClose = env.getCollisionCircles().some(c =>
    Math.hypot(px - c.x, pz - c.z) < c.r + 1.5
  );
  if (tooClose) {
    hud.showInteractHint('No room to plant here!');
    return;
  }
  inventorySystem.removeMaterial('seed', 1);
  env.plantTree(px, pz);
  hud.showInteractHint('Seed planted!');
}

// ── Extended gathering: trees & rocks ────────────────────────────────────────

let _nearestTree = null;
let _nearestRock = null;
let _gatherTarget = null;  // currently being gathered (tree or rock)
let _gatherTimer  = 0;
let _gatherDuration = 0;
let _gatherType   = null;  // 'tree' | 'rock'
let _gatherHintCooldown = 0;  // suppresses gather hints briefly after completion

function handleExtendedGather(delta) {
  if (player.isInCombat) return false;
  if (player.isGathering) {
    // Clear stale interaction targets so hints don't linger
    _nearestRock = null;
    _nearestTree = null;
    return false;
  }

  // Tick down hint cooldown
  if (_gatherHintCooldown > 0) _gatherHintCooldown -= delta;

  // If mid-gather (tree or rock)
  if (_gatherType) {
    _gatherTimer += delta;
    hud.showGatherProgress(_gatherTimer, _gatherDuration);

    if (_gatherTimer >= _gatherDuration) {
      // Complete the action
      if (_gatherType === 'tree') {
        const result = env.clearTree(_gatherTarget);
        if (result) {
          inventorySystem.addMaterial('timber', result.timber);
          if (result.seed > 0) inventorySystem.addMaterial('seed', result.seed);
          hud.showInteractHint(`+${result.timber} timber${result.seed > 0 ? ' +1 seed' : ''}`);
        }
      } else if (_gatherType === 'rock') {
        const result = env.drillRock(_gatherTarget);
        _nearestRock = null;
        if (result) {
          inventorySystem.addMaterial('stone', result.stone);
          hud.showInteractHint(`+${result.stone} stone`);
        }
      }
      _gatherHintCooldown = 1.5;  // suppress next-gather hint for 1.5s
      _gatherTimer = 0;
      _gatherType = null;
      _gatherTarget = null;
      hud.hideGatherProgress();
    }
    return true; // consuming interaction
  }

  // Check for nearest tree (only if Terrain Cutter owned)
  const hasCutter = inventorySystem.hasTool('terrainCutter');
  _nearestTree = hasCutter ? env.findNearestTree(player.position) : null;
  _nearestRock = env.findNearestRock(player.position);

  // Priority: tree > rock (rock prompt shown only if no tree nearby)
  if (_nearestTree && _gatherHintCooldown <= 0) {
    hud.showInteractHint('[E/ACT] Clear Tree');
    if (keysDown.has('KeyE') || touchInput.actionPressed) {
      _gatherTarget = _nearestTree;
      _gatherTimer = 0;
      _gatherDuration = 2.5;
      _gatherType = 'tree';
    }
    return true;
  }

  if (_nearestRock && _gatherHintCooldown <= 0) {
    hud.showInteractHint('[E/ACT] Drill Rock');
    if (keysDown.has('KeyE') || touchInput.actionPressed) {
      _gatherTarget = _nearestRock;
      _gatherTimer = 0;
      _gatherDuration = 3.0;
      _gatherType = 'rock';
    }
    return true;
  }

  return false;
}

// ── Spaceship station interactions ────────────────────────────────────────────

function handleSpaceshipInteractions() {
  if (env.currentZone !== 'spaceship') return false;
  if (player.isInCombat || player.isGathering) return false;

  const px = player.position.x, pz = player.position.z;

  // Offload Station — Prestige: sacrifice PP for a permanent cumulative PP rate bonus
  const offloadPos = env.getOffloadStationPos();
  if (offloadPos && Math.hypot(px - offloadPos.x, pz - offloadPos.z) < 2.2) {
    const ppAvail = Math.floor(ppSystem.ppTotal);
    if (ppAvail >= 1) {
      const previewGain = (Math.sqrt(ppAvail / 100) * 0.1).toFixed(3);
      hud.showInteractHint(`[E/ACT] Prestige: −${ppAvail} PP → +${previewGain} PP/s forever`);
    } else {
      hud.showInteractHint('Offload Station (need PP to prestige)');
    }
    if (keysDown.has('KeyE') || touchInput.actionPressed) {
      const result = ppSystem.prestige();
      if (result) {
        hud.showInteractHint(`Prestige! −${result.taken} PP → +${result.gain} PP/s (total: +${result.totalBonus} PP/s)`);
      }
    }
    return true;
  }

  // Fabricator (Workbench) — open crafting panel (never toggle closed)
  const fabPos = env.getFabricatorPos();
  if (fabPos && Math.hypot(px - fabPos.x, pz - fabPos.z) < 2.2) {
    hud.showInteractHint('[E/ACT] Open Fabricator');
    if (keysDown.has('KeyE') || touchInput.actionPressed) {
      const panel = document.getElementById('crafting-panel');
      if (panel && panel.hidden) togglePanel('crafting-panel');
    }
    return true;
  }

  return false;
}

// ── Gathering logic ───────────────────────────────────────────────────────────

let nearestNode = null;

function handleGathering(delta) {
  if (player.isInCombat) return;

  // Check resource nodes first
  nearestNode = entityManager.findNearestNode(player.position);

  if (player.isGathering) {
    hud.showGatherProgress(player.gatherProgress, player.gatherDuration);
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
    return;
  }

  // No resource node — try tree/rock extended gather
  if (_gatherType) {
    // Already doing extended gather — handled above
    return;
  }
}

// ── Game loop ──────────────────────────────────────────────────────────────────

let lastTime = performance.now();
let _actionCooldown = 0; // prevents instant re-trigger of [E] across interaction types

function gameLoop(now) {
  if (_pendingZone) {
    switchZone(_pendingZone);
    _pendingZone = null;
  }

  const rawDelta = (now - lastTime) / 1000;
  lastTime = now;
  const delta = Math.min(rawDelta, 0.1);
  if (_actionCooldown > 0) _actionCooldown -= delta;

  // Update player
  player.update(keysDown, delta, touchInput);

  // Collision resolution
  if (!player.isInCombat) {
    const PLAYER_R = 0.35;
    for (const c of env.getCollisionCircles()) {
      const cdx = player.position.x - c.x;
      const cdz = player.position.z - c.z;
      const dist = Math.hypot(cdx, cdz);
      if (dist < c.r + PLAYER_R && dist > 0.001) {
        const nx = cdx / dist, nz = cdz / dist;
        player.position.x = c.x + nx * (c.r + PLAYER_R);
        player.position.z = c.z + nz * (c.r + PLAYER_R);
        player.group.position.copy(player.position);
      }
    }
  }

  // Track proximity — speed boost
  const nearTracks = pedometer.getPlacedTracksForZone(env.currentZone)
    .filter(t => Math.hypot(player.position.x - t.x, player.position.z - t.z) < 1.0).length;
  statsSystem.setTrackBonus(nearTracks * CONFIG.PEDOMETER_TRACK_SPEED_BONUS);

  // Update PP
  ppSystem.update(delta);

  // Update pedometer
  const steps = player.consumeSteps();
  pedometer.update(steps);

  // Update entities
  entityManager.update(delta, player.position);

  // Update drone gathering
  droneSystem.update(delta);

  // Update crafting progress
  craftingSystem.update(delta);

  // Update environment (growing trees, etc.)
  env.update(delta);

  // ── Interaction priority chain ──────────────────────────────────────────────
  let showingHint = false;

  // Extended gather (tree clear / rock drill) — takes priority over portals
  if (!player.isInCombat) {
    if (_gatherType || handleExtendedGather(delta)) {
      showingHint = true;
    }
  }

  // Spaceship station interactions
  if (!showingHint && !player.isInCombat) {
    if (handleSpaceshipInteractions()) showingHint = true;
  }

  // Resource node gathering
  if (!showingHint && !player.isInCombat) {
    nearestNode = entityManager.findNearestNode(player.position);
    if (nearestNode || player.isGathering) {
      handleGathering(delta);
      showingHint = true;
    }
  }

  // Zone portals
  let showingPortalHint = false;
  if (!player.isInCombat && !player.isGathering && !_gatherType && !showingHint) {
    const portals = env.getPortals();
    for (const portal of portals) {
      const dist = player.position.distanceTo(portal.position);
      if (dist < 2.5) {
        showingHint = true;
        showingPortalHint = true;
        const zoneUnlocked = portal.ppRequired === 0
          || ppSystem.ppTotal >= portal.ppRequired
          || pedometer.isZoneUnlocked(portal.targetZone);
        if (!zoneUnlocked) {
          hud.showInteractHint(`Need ${portal.ppRequired} PP (or steps) for ${portal.label}`);
        } else {
          hud.showInteractHint(`[E/ACT] Enter ${portal.label}`);
          if (keysDown.has('KeyE') || touchInput.actionPressed) {
            _pendingZone = portal.targetZone;
          }
        }
        break;
      }
    }
  }

  // Seed planting hint
  if (!showingHint && !player.isGathering && inventorySystem.materials.seed > 0) {
    hud.showInteractHint(`[F] Plant Seed (${inventorySystem.materials.seed})`);
    showingHint = true;
  }

  // Track placement / removal hints
  if (!showingHint && !player.isInCombat) {
    const nearTrackHint = pedometer.getPlacedTracksForZone(env.currentZone)
      .find(t => Math.hypot(player.position.x - t.x, player.position.z - t.z) < 1.0);
    if (nearTrackHint) {
      hud.showInteractHint('[G] Remove Track');
      showingHint = true;
    } else if (pedometer.pendingTracks > 0 && !showingPortalHint) {
      hud.showInteractHint(`[T] Place Track (${pedometer.pendingTracks} ready)`);
      showingHint = true;
    }
  }

  if (!showingHint) hud.hideInteractHint();
  if (!player.isGathering && !_gatherType) hud.hideGatherProgress();

  // Camera follows player
  sceneManager.update(player.position);

  // HUD update
  hud.update(now);

  // Render
  sceneManager.render();
}

sceneManager.renderer.setAnimationLoop(gameLoop);

console.log('%c⚡ Processing Power — ready', 'color:#00ffcc;font-size:1rem;');
console.log('WASD/Arrows: move | E: interact/gather | T: place track | F: plant seed | B: return to base | I: inventory | C: craft | R: drones | L: equipment');
