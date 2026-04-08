import { Enemy } from './Enemy.js';

export class EntityManager {
  constructor(scene, onAggro) {
    this.scene = scene;
    this.onAggro = onAggro; // callback(enemy)
    this.enemies = [];
    this._inCombat = false;
    this._spawnTimer = 0;
    this._spawnInterval = 30; // seconds between respawns
    this._spawnPositions = [
      [6, 4], [-5, 7], [8, -3], [-7, -5], [4, 9],
    ];
    this._spawnIndex = 0;

    // Spawn initial scrappers
    this._spawnEnemy(6, 4);
    this._spawnEnemy(-5, 7);
    this._spawnEnemy(8, -3);
  }

  _spawnEnemy(x, z) {
    const enemy = new Enemy(this.scene, x, z);
    this.enemies.push(enemy);
    return enemy;
  }

  update(delta, playerPos) {
    if (this._inCombat) return;

    for (const enemy of this.enemies) {
      const triggered = enemy.update(delta, playerPos);
      if (triggered) {
        this._inCombat = true;
        this.onAggro(enemy);
        return;
      }
    }

    // Respawn dead enemies over time
    this._spawnTimer += delta;
    if (this._spawnTimer >= this._spawnInterval) {
      this._spawnTimer = 0;
      this.enemies = this.enemies.filter(e => e._state !== 'dead');
      if (this.enemies.length < 4) {
        const pos = this._spawnPositions[this._spawnIndex % this._spawnPositions.length];
        this._spawnEnemy(...pos);
        this._spawnIndex++;
      }
    }
  }

  combatEnded() {
    this._inCombat = false;
    // Remove dead enemies from list
    this.enemies = this.enemies.filter(e => e._state !== 'dead');
  }
}
