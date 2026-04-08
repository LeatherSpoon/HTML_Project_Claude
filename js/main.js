import { SceneManager } from './scene/SceneManager.js';
import { Environment } from './scene/Environment.js';
import { Player } from './entities/Player.js';
import { EntityManager } from './entities/EntityManager.js';
import { PPSystem } from './systems/PPSystem.js';
import { StatsSystem } from './systems/StatsSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { PedometerSystem } from './systems/PedometerSystem.js';
import { HUD } from './ui/HUD.js';
import { CombatUI } from './ui/CombatUI.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');

// Systems
const ppSystem    = new PPSystem();
const statsSystem = new StatsSystem();
const combatSystem = new CombatSystem(statsSystem, ppSystem);
const pedometer   = new PedometerSystem(ppSystem);

// Wire offload EXP callback
ppSystem.onOffloadExp(exp => statsSystem.receiveExp(exp));

// Renderer & scene
const sceneManager = new SceneManager(canvas);
const env = new Environment(sceneManager.scene);

// Entities
const player = new Player(sceneManager.scene, statsSystem);

const entityManager = new EntityManager(sceneManager.scene, (enemy) => {
  // Aggro triggered
  player.isInCombat = true;
  combatUI.show(enemy);
  combatSystem.startCombat(enemy);
});

// UI
const hud = new HUD(statsSystem, ppSystem, pedometer);
const combatUI = new CombatUI(combatSystem, statsSystem, entityManager, player);

// ── Input ─────────────────────────────────────────────────────────────────────

const keysDown = new Set();

document.addEventListener('keydown', e => {
  keysDown.add(e.code);
  // Prevent arrow keys from scrolling the page
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', e => {
  keysDown.delete(e.code);
});

// Return focus to document after clicking any button so keyboard still works
document.addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') {
    setTimeout(() => document.body.focus(), 0);
  }
});
document.body.tabIndex = -1;

// ── Game loop ─────────────────────────────────────────────────────────────────

let lastTime = performance.now();

function gameLoop(now) {
  const rawDelta = (now - lastTime) / 1000;
  lastTime = now;
  // Cap delta to avoid spiral of death on tab-focus-return
  const delta = Math.min(rawDelta, 0.1);

  // Update player
  player.update(keysDown, delta);

  // Update PP
  ppSystem.update(delta);

  // Update pedometer
  const steps = player.consumeSteps();
  pedometer.update(steps);

  // Update enemies / aggro detection
  entityManager.update(delta, player.position);

  // Camera follows player
  sceneManager.update(player.position);

  // HUD (throttled internally)
  hud.update(now);

  // Render
  sceneManager.render();
}

sceneManager.renderer.setAnimationLoop(gameLoop);

// Show a brief intro message
console.log('%c⚡ Processing Power — ready', 'color:#00ffcc;font-size:1rem;');
console.log('WASD / Arrow keys to move. Walk up to a Scrapper to initiate combat.');
