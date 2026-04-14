import { CONFIG } from '../config.js';

export class PPSystem {
  constructor() {
    this.ppTotal = 0;
    this.ppRate = CONFIG.INITIAL_PP_RATE;
    this._accumulator = 0;
    this.offloadMode = false;
    this._offloadCallback = null; // fn(expAmount)
    this._rateModifiers = {}; // key → rate delta
  }

  onOffloadExp(cb) {
    this._offloadCallback = cb;
  }

  update(delta) {
    if (this.offloadMode) {
      const exp = this.ppRate * delta;
      if (this._offloadCallback) this._offloadCallback(exp);
      return;
    }
    this._accumulator += this.ppRate * delta;
    if (this._accumulator >= 1) {
      const gained = Math.floor(this._accumulator);
      this.ppTotal += gained;
      this._accumulator -= gained;
    }
  }

  addStepPP(steps, rate = CONFIG.PP_PER_STEP) {
    this.ppTotal += steps * rate;
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

  get displayTotal() {
    return Math.floor(this.ppTotal);
  }
}
