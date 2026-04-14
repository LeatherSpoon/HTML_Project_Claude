import { Enemy } from './Enemy.js';
import { ResourceNode } from './ResourceNode.js';

export class EntityManager {
  constructor(scene, onAggro) {
    this.scene = scene;
    this.onAggro = onAggro;
    this.enemies = [];
    this.resourceNodes = [];
    this._inCombat = false;
    this._spawnTimer = 0;
    this._spawnInterval = 30;
    this._gracePeriod = 3; // seconds before aggro checks begin
  }

  /**
   * Populate enemies and resource nodes from environment zone data.
   * @param {Array} enemySpawns - Array of {x, z} spawn positions
   * @param {Array} nodeSpawns  - Array of {x, z, type} spawn data
   * @param {string} worldSpaceId - Zone identifier for stable entity IDs
   */
  spawnForZone(enemySpawns, nodeSpawns, worldSpaceId = 'unknown') {
    // Clear existing
    for (const e of this.enemies) {
      if (e.group.parent) this.scene.remove(e.group);
    }
    for (const n of this.resourceNodes) {
      if (n.group.parent) this.scene.remove(n.group);
    }
    this.enemies = [];
    this.resourceNodes = [];
    this._gracePeriod = 3;
    this._currentWorldSpaceId = worldSpaceId;

    // Spawn enemies with stable zone-scoped IDs
    for (let i = 0; i < enemySpawns.length; i++) {
      const s = enemySpawns[i];
      const enemy = new Enemy(this.scene, s.x, s.z, worldSpaceId, i);
      this.enemies.push(enemy);
    }

    // Spawn resource nodes with stable zone-scoped IDs
    for (let i = 0; i < nodeSpawns.length; i++) {
      const s = nodeSpawns[i];
      const node = new ResourceNode(this.scene, s.x, s.z, s.type, worldSpaceId, i);
      this.resourceNodes.push(node);
    }
  }

  update(delta, playerPos) {
    // Update resource nodes
    for (const node of this.resourceNodes) {
      node.update(delta);
    }

    if (this._inCombat) return;

    // Grace period
    if (this._gracePeriod > 0) {
      this._gracePeriod -= delta;
      for (const enemy of this.enemies) {
        enemy.update(delta, playerPos, true);
      }
      return;
    }

    for (const enemy of this.enemies) {
      const triggered = enemy.update(delta, playerPos);
      if (triggered) {
        this._inCombat = true;
        this.onAggro(enemy);
        return;
      }
    }

    // Respawn dead enemies
    this._spawnTimer += delta;
    if (this._spawnTimer >= this._spawnInterval) {
      this._spawnTimer = 0;
      const alive = this.enemies.filter(e => e._state !== 'dead');
      if (alive.length < 3) {
        // Respawn at a dead enemy's spawn position
        const dead = this.enemies.find(e => e._state === 'dead');
        if (dead) {
          const respawnIndex = this.enemies.length;
          const enemy = new Enemy(
            this.scene, dead.spawnPos.x, dead.spawnPos.z,
            dead.worldSpaceId, respawnIndex
          );
          this.enemies = this.enemies.filter(e => e._state !== 'dead');
          this.enemies.push(enemy);
        }
      }
    }
  }

  combatEnded() {
    this._inCombat = false;
    this.enemies = this.enemies.filter(e => e._state !== 'dead');
  }

  /**
   * Find the nearest resource node in interaction range.
   */
  findNearestNode(playerPos) {
    let best = null;
    let bestDist = Infinity;
    for (const node of this.resourceNodes) {
      if (node.isDepleted) continue;
      const d = node.position.distanceTo(playerPos);
      if (d < node.interactRadius && d < bestDist) {
        best = node;
        bestDist = d;
      }
    }
    return best;
  }
}
