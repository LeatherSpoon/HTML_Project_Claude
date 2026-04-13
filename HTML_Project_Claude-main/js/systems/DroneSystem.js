import { CONFIG } from '../config.js';

export class DroneSystem {
  constructor(inventorySystem, ppSystem) {
    this.inventory = inventorySystem;
    this.pp = ppSystem;

    this.drones = [
      { id: 1, name: 'Drone Alpha', assignedMaterial: null, efficiency: 1, gatherTimer: 0 },
    ];

    this.baseGatherTime = 30; // seconds per unit of material
    this.upgradeCost = 50; // PP to unlock next drone
    this.maxDrones = 5;
  }

  assignDrone(droneId, materialType) {
    const drone = this.drones.find(d => d.id === droneId);
    if (!drone) return false;
    drone.assignedMaterial = materialType;
    drone.gatherTimer = 0;
    return true;
  }

  unassignDrone(droneId) {
    const drone = this.drones.find(d => d.id === droneId);
    if (!drone) return false;
    drone.assignedMaterial = null;
    drone.gatherTimer = 0;
    return true;
  }

  upgradeDroneEfficiency(droneId) {
    const drone = this.drones.find(d => d.id === droneId);
    if (!drone) return false;
    const cost = this._efficiencyUpgradeCost(drone.efficiency);
    if (!this.pp.spend(cost)) return false;
    drone.efficiency++;
    return true;
  }

  _efficiencyUpgradeCost(currentLevel) {
    return Math.ceil(30 * Math.pow(1.8, currentLevel - 1));
  }

  buyNewDrone() {
    if (this.drones.length >= this.maxDrones) return false;
    if (!this.pp.spend(this.upgradeCost)) return false;
    const id = this.drones.length + 1;
    this.drones.push({
      id,
      name: `Drone ${['Alpha','Beta','Gamma','Delta','Epsilon'][id - 1] || id}`,
      assignedMaterial: null,
      efficiency: 1,
      gatherTimer: 0,
    });
    this.upgradeCost = Math.ceil(this.upgradeCost * 2.5);
    return true;
  }

  update(delta) {
    for (const drone of this.drones) {
      if (!drone.assignedMaterial) continue;

      const gatherTime = this.baseGatherTime / drone.efficiency;
      drone.gatherTimer += delta;

      if (drone.gatherTimer >= gatherTime) {
        drone.gatherTimer -= gatherTime;
        this.inventory.addMaterial(drone.assignedMaterial, 1);
      }
    }
  }

  getDroneStatus() {
    return this.drones.map(d => ({
      id: d.id,
      name: d.name,
      assignedMaterial: d.assignedMaterial,
      efficiency: d.efficiency,
      gatherProgress: d.assignedMaterial
        ? d.gatherTimer / (this.baseGatherTime / d.efficiency)
        : 0,
      efficiencyUpgradeCost: this._efficiencyUpgradeCost(d.efficiency),
    }));
  }

  get nextDroneCost() { return this.upgradeCost; }
  get canBuyDrone() { return this.drones.length < this.maxDrones; }
}
