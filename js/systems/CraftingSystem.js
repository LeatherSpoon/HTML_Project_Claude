const RECIPES = {
  ration: {
    label: 'Ration',
    type: 'consumable',
    key: 'ration',
    materials: { timber: 2, fiber: 1 },
    baseTime: 3, // seconds
    minCraftingLevel: 1,
  },
  firstAid: {
    label: 'First Aid',
    type: 'consumable',
    key: 'firstAid',
    materials: { copper: 2, fiber: 2 },
    baseTime: 5,
    minCraftingLevel: 2,
  },
  repairKit: {
    label: 'Repair Kit',
    type: 'consumable',
    key: 'repairKit',
    materials: { iron: 3, copper: 2, resin: 1 },
    baseTime: 8,
    minCraftingLevel: 4,
  },
  antidote: {
    label: 'Antidote',
    type: 'consumable',
    key: 'antidote',
    materials: { fiber: 3, quartz: 1 },
    baseTime: 6,
    minCraftingLevel: 3,
  },
  basicBlade: {
    label: 'Basic Blade',
    type: 'equipment',
    slot: 'weapon',
    tier: 'Basic',
    statBonuses: { strength: 2 },
    materials: { iron: 4, timber: 2 },
    baseTime: 10,
    minCraftingLevel: 2,
  },
  basicShield: {
    label: 'Basic Shield',
    type: 'equipment',
    slot: 'offhand',
    tier: 'Basic',
    statBonuses: { defense: 2 },
    materials: { iron: 3, timber: 3 },
    baseTime: 10,
    minCraftingLevel: 2,
  },
  basicArmor: {
    label: 'Basic Armor',
    type: 'equipment',
    slot: 'body',
    tier: 'Basic',
    statBonuses: { defense: 3, health: 1 },
    materials: { iron: 5, fiber: 3 },
    baseTime: 12,
    minCraftingLevel: 3,
  },
  copperRing: {
    label: 'Copper Ring',
    type: 'equipment',
    slot: 'accessory',
    tier: 'Basic',
    statBonuses: { focusRate: 1 },
    materials: { copper: 4 },
    baseTime: 6,
    minCraftingLevel: 1,
  },
  energyCell: {
    label: 'Energy Cell',
    type: 'consumable',
    key: 'energyCell',
    materials: { quartz: 2, copper: 1, carbon: 1 },
    baseTime: 6,
    minCraftingLevel: 2,
  },
};

export class CraftingSystem {
  constructor(inventorySystem, statsSystem) {
    this.inventory = inventorySystem;
    this.stats = statsSystem;
    this._isCrafting = false;
    this._craftingRecipe = null;
    this._craftingProgress = 0;
    this._craftingDuration = 0;
    this.onCraftComplete = null; // fn(recipe)
    this.onCraftProgress = null; // fn(progress, duration)
  }

  static get RECIPES() { return RECIPES; }

  getAvailableRecipes() {
    const craftLevel = this.stats.stats.crafting.level;
    return Object.entries(RECIPES)
      .filter(([, r]) => r.minCraftingLevel <= craftLevel)
      .map(([id, r]) => ({
        id,
        ...r,
        canCraft: this.inventory.hasMaterials(r.materials),
        craftTime: this._calcCraftTime(r.baseTime),
      }));
  }

  _calcCraftTime(baseTime) {
    return baseTime / (1 + this.stats.stats.craftingSpeed.level * 0.2);
  }

  startCraft(recipeId) {
    if (this._isCrafting) return false;
    const recipe = RECIPES[recipeId];
    if (!recipe) return false;
    if (recipe.minCraftingLevel > this.stats.stats.crafting.level) return false;
    if (!this.inventory.hasMaterials(recipe.materials)) return false;

    // Consume materials
    for (const [mat, qty] of Object.entries(recipe.materials)) {
      this.inventory.removeMaterial(mat, qty);
    }

    this._isCrafting = true;
    this._craftingRecipe = { id: recipeId, ...recipe };
    this._craftingProgress = 0;
    this._craftingDuration = this._calcCraftTime(recipe.baseTime);
    return true;
  }

  update(delta) {
    if (!this._isCrafting) return;

    this._craftingProgress += delta;
    if (this.onCraftProgress) {
      this.onCraftProgress(this._craftingProgress, this._craftingDuration);
    }

    if (this._craftingProgress >= this._craftingDuration) {
      this._completeCraft();
    }
  }

  _completeCraft() {
    const recipe = this._craftingRecipe;
    this._isCrafting = false;
    this._craftingRecipe = null;

    if (recipe.type === 'consumable') {
      this.inventory.addConsumable(recipe.key, 1);
    }
    // Equipment items are added to inventory as well
    // (handled externally through the callback)
    if (this.onCraftComplete) {
      this.onCraftComplete(recipe);
    }
  }

  get isCrafting() { return this._isCrafting; }
  get craftProgress() { return this._craftingProgress; }
  get craftDuration() { return this._craftingDuration; }
  get craftingRecipeName() { return this._craftingRecipe?.label || ''; }
}
