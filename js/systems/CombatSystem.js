import { CONFIG } from '../config.js';

export class CombatSystem {
  constructor(statsSystem, ppSystem) {
    this.stats = statsSystem;
    this.pp = ppSystem;

    this.active = false;
    this.enemy = null;
    this._enemyInterval = null;
    this._fpInterval = null;

    // Callbacks wired by CombatUI
    this.onLog = null;       // fn(msg)
    this.onFPUpdate = null;  // fn(current, max)
    this.onHPUpdate = null;  // fn(playerHP, playerMaxHP, enemyHP, enemyMaxHP)
    this.onCombatEnd = null; // fn(won)
  }

  startCombat(enemy) {
    if (this.active) return;
    this.active = true;
    this.enemy = enemy;
    this.enemyCurrentHP = enemy.maxHP;

    this._log(`A wild ${enemy.name} appears!`);
    this._emitHP();

    // FP accumulation — ticks every 100ms
    this._fpInterval = setInterval(() => {
      if (!this.active) return;
      this.stats.tickFP(CONFIG.FP_TICK_MS / 1000);
      if (this.onFPUpdate) {
        this.onFPUpdate(this.stats.currentFP, this.stats.maxFP);
      }
    }, CONFIG.FP_TICK_MS);

    // Enemy attack interval
    this._enemyInterval = setInterval(() => {
      if (!this.active) return;
      const dmg = this.stats.takeDamage(enemy.damage);
      this._log(`${enemy.name} attacks! You take ${dmg} damage.`);
      this._emitHP();
      if (this.stats.currentHP <= 0) {
        this._endCombat(false);
      }
    }, CONFIG.ENEMY_ATTACK_MS);
  }

  // ── Player actions ─────────────────────────────────────────────────────────
  fight() {
    if (!this.active) return;
    const dmg = this.stats.damage;
    this._dealDamageToEnemy(dmg);
    this._log(`You attack for ${dmg} damage!`);
  }

  useSkill(skillKey) {
    if (!this.active) return;
    const skill = CONFIG.SKILLS[skillKey];
    if (!skill) return;

    if (skillKey === 'scan') {
      if (!this.stats.spendFP(skill.fp)) {
        this._log('Not enough FP!');
        return;
      }
      this._log(`Scan: ${this.enemy.name} — HP ${this.enemyCurrentHP}/${this.enemy.maxHP}, ATK ${this.enemy.damage}`);
      if (this.onFPUpdate) this.onFPUpdate(this.stats.currentFP, this.stats.maxFP);
      return;
    }

    if (!this.stats.spendFP(skill.fp)) {
      this._log('Not enough FP!');
      return;
    }
    const dmg = Math.floor(this.stats.damage * skill.mult);
    this._dealDamageToEnemy(dmg);
    this._log(`${skill.label}! You deal ${dmg} damage.`);
    if (this.onFPUpdate) this.onFPUpdate(this.stats.currentFP, this.stats.maxFP);
  }

  tryRun() {
    if (!this.active) return;
    const chance = CONFIG.RUN_BASE_CHANCE + (this.stats.agility - 1) * 0.05;
    if (Math.random() < chance) {
      this._log('You got away safely!');
      this._endCombat(false, true); // fled
    } else {
      this._log("Can't escape!");
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────────
  _dealDamageToEnemy(dmg) {
    this.enemyCurrentHP = Math.max(0, this.enemyCurrentHP - dmg);
    this._emitHP();
    if (this.enemyCurrentHP <= 0) {
      this._log(`${this.enemy.name} defeated!`);
      this._endCombat(true);
    }
  }

  _endCombat(won, fled = false) {
    if (!this.active) return;
    this.active = false;
    clearInterval(this._fpInterval);
    clearInterval(this._enemyInterval);
    this._fpInterval = null;
    this._enemyInterval = null;

    if (won) {
      const pp = this.enemy.ppReward;
      this.pp.ppTotal += pp;
      this._log(`Victory! +${pp} PP`);
      this.enemy.die();
    } else if (!fled) {
      this._log('Rescue drone activated! Returning to base...');
      this.stats.rescueDrone();
    }

    this.stats.resetFP();
    if (this.onFPUpdate) this.onFPUpdate(0, this.stats.maxFP);
    if (this.onCombatEnd) this.onCombatEnd(won, fled);
  }

  _log(msg) {
    if (this.onLog) this.onLog(msg);
  }

  _emitHP() {
    if (this.onHPUpdate) {
      this.onHPUpdate(
        this.stats.currentHP, this.stats.maxHP,
        this.enemyCurrentHP, this.enemy.maxHP
      );
    }
  }
}
