import { CONFIG } from '../config.js';

export class EnergySystem {
  constructor() {
    this.maxEnergy = CONFIG.ENERGY_MAX;
    this.currentEnergy = this.maxEnergy;
  }

  get isExhausted() { return this.currentEnergy <= 0; }

  drain(amount) {
    this.currentEnergy = Math.max(0, this.currentEnergy - amount);
  }

  restore(amount) {
    this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + amount);
  }

  restoreOverTime(delta) {
    this.restore(CONFIG.ENERGY_LANDING_PAD_RESTORE_RATE * delta);
  }

  get displayValue() { return Math.floor(this.currentEnergy); }
  get displayMax()   { return this.maxEnergy; }
}
