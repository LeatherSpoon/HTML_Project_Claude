import { CONFIG } from '../config.js';

export class PPSystem {
  constructor() {
    this.ppTotal = 0;
    this.ppRate = CONFIG.INITIAL_PP_RATE;
    this._accumulator = 0;
    this.prestigeBonus = 0; // cumulative permanent PP/s bonus from all prestiges
    this._rateModifiers = {}; // key → rate delta
  }

  /**
   * Prestige: sacrifice current ppTotal for a permanent cumulative PP rate bonus.
   * gain = sqrt(ppTotal / 100) * 0.1 PP/s added permanently.
   */
  prestige() {
    if (this.ppTotal < 1) return null;
    const taken = Math.floor(this.ppTotal);
    const gain = Math.sqrt(taken / 100) * 0.1;
    this.prestigeBonus += gain;
    this.setModifier('prestige', this.prestigeBonus);
    this.ppTotal -= taken;
    return { taken, gain: +gain.toFixed(4), totalBonus: +this.prestigeBonus.toFixed(4) };
  }

  update(delta) {
    this._accumulator += this.ppRate * delta;
    if (this._accumulator >= 1) {
      const gained = Math.floor(this._accumulator);
      this.ppTotal += gained;
      this._accumulator -= gained;
    }
  }

  addStepPP(steps) {
    this.ppTotal += steps * CONFIG.PP_PER_STEP;
  }

  /**
   * Attempt to spend `cost` PP. Returns true on success.
   */
  spend(cost) {
    if (this.ppTotal < cost) return false;
    this.ppTotal -= cost;
    return true;
  }

  /**
   * Add/remove a named rate modifier (delta PP/s).
   */
  setModifier(key, value) {
    const old = this._rateModifiers[key] || 0;
    this._rateModifiers[key] = value;
    this.ppRate += (value - old);
    if (this.ppRate < 0) this.ppRate = 0;
  }

  removeModifier(key) {
    if (key in this._rateModifiers) {
      this.ppRate -= this._rateModifiers[key];
      delete this._rateModifiers[key];
      if (this.ppRate < 0) this.ppRate = 0;
    }
  }

  /**
   * Temporarily boost PP rate by `rate` PP/s for `duration` seconds.
   */
  addTemporaryBoost(rate, duration) {
    const key = `_tempBoost_${Date.now()}`;
    this.setModifier(key, rate);
    setTimeout(() => this.removeModifier(key), duration * 1000);
  }

  get displayTotal() {
    return Math.floor(this.ppTotal);
  }
}
