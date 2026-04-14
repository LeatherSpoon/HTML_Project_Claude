import { CONFIG } from '../config.js';

export class WorldRegistry {
  static getWorldSpace(id) {
    return CONFIG.WORLD_SPACES[id] || null;
  }

  static isStatusAllowed(statusType, worldSpaceId) {
    const ws = CONFIG.WORLD_SPACES[worldSpaceId];
    if (!ws) return true;
    for (const cond of ws.statusConditions) {
      const blocked = CONFIG.STATUS_BLOCKED_BY_CONDITION[cond] || [];
      if (blocked.includes(statusType)) return false;
    }
    return true;
  }

  static getConditions(worldSpaceId) {
    return CONFIG.WORLD_SPACES[worldSpaceId]?.statusConditions || [];
  }
}
