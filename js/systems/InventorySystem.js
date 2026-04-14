import { CONFIG } from '../config.js';

const CONSUMABLE_DEFS = {
  ration:     { label: 'Ration',      heal: 20,  cures: null,     energy: CONFIG.ENERGY_RESTORE_RATION },
  firstAid:   { label: 'First Aid',   heal: 60,  cures: null },
  repairKit:  { label: 'Repair Kit',  heal: 100, cures: null },
  antidote:   { label: 'Antidote',    heal: 0,   cures: 'poison' },
  energyCell: { label: 'Energy Cell', heal: 0,   cures: null,     energy: CONFIG.ENERGY_RESTORE_CELL },
};

const MATERIAL_NAMES = [
  'copper', 'timber', 'stone', 'iron', 'carbon', 'quartz', 'silica',
  'fiber', 'silver', 'gold', 'titanium', 'tungsten', 'resin', 'epoxy',
  'elastomer', 'magnet', 'glass',
];

export class InventorySystem {
  constructor() {
    this.materials = {};
    for (const m of MATERIAL_NAMES) {
      this.materials[m] = 0;
    }
    this.consumables = {};
    for (const key of Object.keys(CONSUMABLE_DEFS)) {
      this.consumables[key] = 0;
    }
    // Start with 3 rations
    this.consumables.ration = 3;
  }

  static get CONSUMABLE_DEFS() { return CONSUMABLE_DEFS; }
  static get MATERIAL_NAMES() { return MATERIAL_NAMES; }

  addMaterial(name, qty = 1) {
    if (name in this.materials) {
      this.materials[name] += qty;
    }
  }

  removeMaterial(name, qty = 1) {
    if (name in this.materials && this.materials[name] >= qty) {
      this.materials[name] -= qty;
      return true;
    }
    return false;
  }

  hasMaterials(recipe) {
    for (const [mat, qty] of Object.entries(recipe)) {
      if ((this.materials[mat] || 0) < qty) return false;
    }
    return true;
  }

  addConsumable(key, qty = 1) {
    if (key in this.consumables) {
      this.consumables[key] += qty;
    }
  }

  useConsumable(key, statsSystem, energySystem = null) {
    if (!this.consumables[key] || this.consumables[key] <= 0) return null;
    const def = CONSUMABLE_DEFS[key];
    if (!def) return null;

    this.consumables[key]--;

    const result = { label: def.label, healed: 0, cured: null, energyRestored: 0 };
    if (def.heal > 0) {
      const before = statsSystem.currentHP;
      statsSystem.heal(def.heal);
      result.healed = statsSystem.currentHP - before;
    }
    if (def.cures) {
      result.cured = def.cures;
    }
    if (def.energy > 0 && energySystem) {
      energySystem.restore(def.energy);
      result.energyRestored = def.energy;
    }
    return result;
  }

  getConsumableList() {
    const list = [];
    for (const [key, count] of Object.entries(this.consumables)) {
      if (count > 0) {
        const def = CONSUMABLE_DEFS[key];
        list.push({ key, count, label: def.label, heal: def.heal, cures: def.cures });
      }
    }
    return list;
  }

  getMaterialList() {
    const list = [];
    for (const [name, count] of Object.entries(this.materials)) {
      if (count > 0) {
        list.push({ name, count });
      }
    }
    return list;
  }
}
