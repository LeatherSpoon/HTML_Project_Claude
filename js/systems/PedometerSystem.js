import { CONFIG } from '../config.js';

export class PedometerSystem {
  constructor(ppSystem) {
    this.ppSystem = ppSystem;
    this.totalSteps = 0;
    this._ppBonusPerStep = CONFIG.PP_PER_STEP;
    this._ppBonusPurchases = 0;
    this._nextBonusCost = CONFIG.PEDOMETER_PP_BONUS_BASE_COST;
  }

  update(newSteps) {
    if (newSteps <= 0) return;
    this.totalSteps += newSteps;
    this.ppSystem.addStepPP(newSteps, this._ppBonusPerStep);
  }

  canBuyPPBonus() {
    return this.totalSteps >= this._nextBonusCost;
  }

  buyPPBonus() {
    if (!this.canBuyPPBonus()) return false;
    this.totalSteps -= this._nextBonusCost;
    this._ppBonusPurchases++;
    this._ppBonusPerStep += CONFIG.PEDOMETER_PP_BONUS_AMOUNT;
    this._nextBonusCost = Math.ceil(this._nextBonusCost * 2);
    return true;
  }

  get nextBonusCost() { return this._nextBonusCost; }
  get ppBonusPerStep() { return this._ppBonusPerStep; }
}
