import { SkillsMenu } from './SkillsMenu.js';

const CIRCUMFERENCE = 2 * Math.PI * 40; // r=40 matches SVG

export class CombatUI {
  constructor(combatSystem, statsSystem, entityManager, player) {
    this.combat = combatSystem;
    this.stats = statsSystem;
    this.entityManager = entityManager;
    this.player = player;

    this.overlay = document.getElementById('combat-overlay');
    this.skillsMenu = document.getElementById('skills-menu');
    this.itemsMenu = document.getElementById('items-menu');
    this.logEl = document.getElementById('combat-log');

    this.enemyHPFill = document.getElementById('enemy-hp-fill');
    this.enemyHPText = document.getElementById('enemy-hp-text');
    this.playerHPFill = document.getElementById('player-hp-fill');
    this.playerHPText = document.getElementById('player-hp-text');
    this.fpRingFill = document.getElementById('fp-ring-fill');
    this.fpText = document.getElementById('fp-text');
    this.enemyNameEl = document.getElementById('enemy-name');

    this.skillsMenuObj = new SkillsMenu(combatSystem, statsSystem);

    // Expose to global so HTML onclick attributes can reach it
    window.combatUI = this;

    // Wire combat system callbacks
    combatSystem.onLog = (msg) => this._appendLog(msg);
    combatSystem.onFPUpdate = (cur, max) => this._updateFP(cur, max);
    combatSystem.onHPUpdate = (pHP, pMax, eHP, eMax) => this._updateHP(pHP, pMax, eHP, eMax);
    combatSystem.onCombatEnd = (won, fled) => this._onCombatEnd(won, fled);
  }

  show(enemy) {
    this.enemyNameEl.textContent = enemy.name;
    this._clearLog();
    this._updateHP(
      this.stats.currentHP, this.stats.maxHP,
      enemy.maxHP, enemy.maxHP
    );
    this._updateFP(0, this.stats.maxFP);
    this.overlay.hidden = false;
    this.skillsMenu.hidden = true;
    this.itemsMenu.hidden = true;
  }

  hide() {
    this.overlay.hidden = true;
  }

  // ── Button handlers ────────────────────────────────────────────────────────
  onFight() {
    if (this.skillsMenu.hidden === false) return;
    this.combat.fight();
  }

  onSkills() {
    this.skillsMenu.hidden = false;
    this.itemsMenu.hidden = true;
    // Update skill availability immediately
    this.skillsMenuObj.update(this.stats.currentFP);
  }

  closeSkills() {
    this.skillsMenu.hidden = true;
  }

  onItems() {
    this.itemsMenu.hidden = false;
    this.skillsMenu.hidden = true;
  }

  closeItems() {
    this.itemsMenu.hidden = true;
  }

  onRun() {
    this.combat.tryRun();
  }

  // ── Internal update methods ────────────────────────────────────────────────
  _updateHP(pHP, pMax, eHP, eMax) {
    const pPct = Math.max(0, pHP / pMax) * 100;
    const ePct = Math.max(0, eHP / eMax) * 100;
    this.playerHPFill.style.width = pPct + '%';
    this.playerHPText.textContent = `${Math.ceil(pHP)} / ${pMax}`;
    this.enemyHPFill.style.width = ePct + '%';
    this.enemyHPText.textContent = `${Math.ceil(eHP)} / ${eMax}`;
  }

  _updateFP(cur, max) {
    const ratio = Math.min(1, cur / max);
    // stroke-dashoffset = circumference * (1 - ratio)
    this.fpRingFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - ratio);
    this.fpText.textContent = `${Math.floor(cur)} FP`;
    // Update skill buttons if menu is open
    if (!this.skillsMenu.hidden) {
      this.skillsMenuObj.update(cur);
    }
  }

  _appendLog(msg) {
    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = msg;
    this.logEl.appendChild(line);
    // Keep only last 4 lines
    while (this.logEl.children.length > 4) {
      this.logEl.removeChild(this.logEl.firstChild);
    }
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  _clearLog() {
    this.logEl.innerHTML = '';
  }

  _onCombatEnd(won, fled) {
    setTimeout(() => {
      this.hide();
      this.player.isInCombat = false;
      this.entityManager.combatEnded();
      // If player was defeated, teleport home
      if (!won && !fled) {
        this.player.teleportTo(0, 0);
      }
    }, 1200);
  }
}
