import { CONFIG } from '../config.js';

const STAT_NAMES = [
  'strength', 'health', 'defense', 'constitution',
  'dexterity', 'agility', 'perception',
  'focusRate', 'focus', 'crafting', 'craftingSpeed', 'speed',
];

const STAT_LABELS = {
  strength: 'Strength',
  health: 'Health',
  defense: 'Defense',
  constitution: 'Constitution',
  dexterity: 'Dexterity',
  agility: 'Agility',
  perception: 'Perception',
  focusRate: 'Focus Rate',
  focus: 'Focus',
  crafting: 'Crafting',
  craftingSpeed: 'Craft Speed',
  speed: 'Speed',
};

export class StatsSystem {
  constructor() {
    this.stats = {};
    for (const name of STAT_NAMES) {
      this.stats[name] = { level: 1, exp: 0 };
    }
    // Health starts higher
    this.stats.health.level = 10;
    this.currentHP = this.maxHP;
    this.currentFP = 0;
  }

  get statNames() { return STAT_NAMES; }
  get statLabels() { return STAT_LABELS; }

  // ── Derived values ─────────────────────────────────────────────────────────
  get maxHP() {
    return this.stats.health.level * CONFIG.MAX_HP_PER_LEVEL;
  }
  get maxFP() {
    return CONFIG.BASE_MAX_FP + this.stats.focus.level * CONFIG.FP_PER_FOCUS_LEVEL;
  }
  get fpRate() {
    return CONFIG.BASE_FP_RATE + this.stats.focusRate.level * CONFIG.FP_RATE_PER_LEVEL;
  }
  get moveSpeed() {
    return CONFIG.BASE_MOVE_SPEED + this.stats.speed.level * 0.5;
  }
  get damage() {
    return this.stats.strength.level * CONFIG.BASE_DAMAGE;
  }
  get defense() {
    return this.stats.defense.level;
  }
  get agility() {
    return this.stats.agility.level;
  }

  // ── HP management ──────────────────────────────────────────────────────────
  takeDamage(amount) {
    const effective = Math.max(1, amount - Math.floor(this.defense * 0.5));
    this.currentHP = Math.max(0, this.currentHP - effective);
    return effective;
  }

  heal(amount) {
    this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
  }

  rescueDrone() {
    this.currentHP = Math.max(1, Math.floor(this.maxHP * 0.1));
  }

  // ── FP management ─────────────────────────────────────────────────────────
  tickFP(delta) {
    this.currentFP = Math.min(this.maxFP, this.currentFP + this.fpRate * delta);
  }

  spendFP(amount) {
    if (this.currentFP < amount) return false;
    this.currentFP -= amount;
    return true;
  }

  resetFP() {
    this.currentFP = 0;
  }

  // ── Stat leveling ──────────────────────────────────────────────────────────
  upgradeCost(statName) {
    const level = this.stats[statName].level;
    return Math.ceil(
      CONFIG.STAT_UPGRADE_BASE_COST *
      Math.pow(CONFIG.STAT_UPGRADE_COST_SCALE, level - 1)
    );
  }

  /**
   * Level up a stat. Returns false if ppSystem cannot afford it.
   */
  levelUp(statName, ppSystem) {
    const cost = this.upgradeCost(statName);
    if (!ppSystem.spend(cost)) return false;
    this.stats[statName].level++;
    // Re-clamp HP if health upgraded
    if (statName === 'health') {
      this.currentHP = Math.min(this.currentHP, this.maxHP);
    }
    return true;
  }

  /**
   * Receive EXP from offload mode and distribute evenly across all stats.
   */
  receiveExp(amount) {
    const perStat = amount / STAT_NAMES.length;
    for (const name of STAT_NAMES) {
      const s = this.stats[name];
      s.exp += perStat;
      const threshold = s.level * 100;
      if (s.exp >= threshold) {
        s.exp -= threshold;
        s.level++;
      }
    }
  }
}
