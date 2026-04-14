import { CONFIG } from '../config.js';
import { WorldRegistry } from './WorldRegistry.js';

export class CombatSystem {
  constructor(statsSystem, ppSystem, inventorySystem, energySystem = null) {
    this.stats = statsSystem;
    this.pp = ppSystem;
    this.inventory = inventorySystem;
    this.energy = energySystem;

    this.active = false;
    this.enemy = null;
    this._enemyInterval = null;
    this._fpInterval = null;
    this.worldSpaceId = 'landingSite';

    // Status effects on player: { type, remainingTicks }
    this.playerEffects = [];

    // Callbacks wired by CombatUI
    this.onLog = null;       // fn(msg)
    this.onFPUpdate = null;  // fn(current, max)
    this.onHPUpdate = null;  // fn(playerHP, playerMaxHP, enemyHP, enemyMaxHP)
    this.onCombatEnd = null; // fn(won, fled)
    this.onStatusUpdate = null; // fn(playerEffects)
  }

  setWorldSpace(id) {
    this.worldSpaceId = id;
  }

  startCombat(enemy) {
    if (this.active) return;
    this.active = true;
    this.enemy = enemy;
    this.enemyCurrentHP = enemy.maxHP;
    this.playerEffects = [];

    this._log(`A wild ${enemy.name} appears!`);
    this._emitHP();

    // FP accumulation — ticks every 100ms
    this._fpInterval = setInterval(() => {
      if (!this.active) return;
      // Shock effect slows FP gain
      let fpMultiplier = 1;
      for (const eff of this.playerEffects) {
        if (eff.type === 'shock') {
          fpMultiplier *= (1 - CONFIG.STATUS_EFFECTS.shock.fpSlowPct);
        }
      }
      this.stats.tickFP(CONFIG.FP_TICK_MS / 1000 * fpMultiplier);
      if (this.onFPUpdate) {
        this.onFPUpdate(this.stats.currentFP, this.stats.maxFP);
      }
    }, CONFIG.FP_TICK_MS);

    // Enemy attack interval
    this._enemyInterval = setInterval(() => {
      if (!this.active) return;
      const dmg = this.stats.takeDamage(enemy.damage);
      this._log(`${enemy.name} attacks! You take ${dmg} damage.`);

      // Apply status effects from enemy (Scrapper has none by default,
      // but future enemies can set enemy.statusEffect)
      if (enemy.statusEffect && Math.random() < 0.3) {
        this._applyStatus(enemy.statusEffect);
      }

      // Tick existing status effects
      this._tickStatusEffects();

      this._emitHP();
      if (this.stats.currentHP <= 0) {
        this._endCombat(false);
      }
    }, CONFIG.ENEMY_ATTACK_MS);
  }

  // ── Status Effects ─────────────────────────────────────────────────────────
  _applyStatus(type) {
    const def = CONFIG.STATUS_EFFECTS[type];
    if (!def) return;
    // Don't stack same type
    if (this.playerEffects.find(e => e.type === type)) return;
    // Check world space restrictions
    if (!WorldRegistry.isStatusAllowed(type, this.worldSpaceId)) {
      this._log(`${def.label} fizzles in this environment!`);
      return;
    }
    this.playerEffects.push({ type, remainingTicks: def.durationTicks });
    this._log(`You are afflicted with ${def.label}!`);
    if (this.onStatusUpdate) this.onStatusUpdate(this.playerEffects);
  }

  _tickStatusEffects() {
    for (let i = this.playerEffects.length - 1; i >= 0; i--) {
      const eff = this.playerEffects[i];
      const def = CONFIG.STATUS_EFFECTS[eff.type];

      // Apply tick damage (burn, poison)
      if (def.tickDamage) {
        this.stats.currentHP = Math.max(1, this.stats.currentHP - def.tickDamage);
        this._log(`${def.label} deals ${def.tickDamage} damage!`);
      }

      // Corrosion already factored into takeDamage via defense reduction
      // (defense is checked at damage time, so corrosion just needs to exist)

      eff.remainingTicks--;
      if (eff.remainingTicks <= 0) {
        this.playerEffects.splice(i, 1);
        this._log(`${def.label} wears off.`);
      }
    }
    if (this.onStatusUpdate) this.onStatusUpdate(this.playerEffects);
  }

  _clearStatusEffects() {
    this.playerEffects = [];
    if (this.onStatusUpdate) this.onStatusUpdate(this.playerEffects);
  }

  hasStatus(type) {
    return this.playerEffects.some(e => e.type === type);
  }

  removeStatus(type) {
    this.playerEffects = this.playerEffects.filter(e => e.type !== type);
    if (this.onStatusUpdate) this.onStatusUpdate(this.playerEffects);
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

  useItem(itemKey) {
    if (!this.active || !this.inventory) return;
    const result = this.inventory.useConsumable(itemKey, this.stats, this.energy);
    if (!result) {
      this._log('No item to use!');
      return;
    }
    if (result.healed > 0) {
      this._log(`Used ${result.label}! Healed ${result.healed} HP.`);
    }
    if (result.energyRestored > 0) {
      this._log(`${result.label} restored ${result.energyRestored} EN.`);
    }
    if (result.cured) {
      this.removeStatus(result.cured);
      this._log(`${result.label} cured ${result.cured}!`);
    }
    this._emitHP();
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

    this._clearStatusEffects();

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
