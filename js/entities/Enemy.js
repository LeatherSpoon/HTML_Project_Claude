import * as THREE from 'three';
import { createToonMaterial, addOutline } from '../scene/ToonMaterials.js';
import { CONFIG } from '../config.js';

let enemyIdCounter = 0;

export class Enemy {
  constructor(scene, x = 6, z = 4) {
    this.id = ++enemyIdCounter;
    this.scene = scene;
    this.position = new THREE.Vector3(x, 0, z);
    this.spawnPos = new THREE.Vector3(x, 0, z);

    this.maxHP = CONFIG.SCRAPPER_HP;
    this.hp = this.maxHP;
    this.aggroRadius = CONFIG.SCRAPPER_AGGRO_RADIUS;
    this.damage = CONFIG.SCRAPPER_DAMAGE;
    this.attackInterval = CONFIG.ENEMY_ATTACK_MS;
    this.ppReward = CONFIG.SCRAPPER_PP_REWARD;
    this.name = 'SCRAPPER';

    // Patrol state
    this._state = 'patrol'; // 'patrol' | 'aggro' | 'dead'
    this._patrolTarget = this.position.clone();
    this._waitTimer = 0;
    this._isWaiting = false;

    this.group = new THREE.Group();
    this._buildMesh();
    scene.add(this.group);
    this.group.position.copy(this.position);
  }

  _buildMesh() {
    // Scrapper body — boxy rust-orange shape
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.7, 0.45);
    const bodyMat = createToonMaterial(0xc45a1a);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    addOutline(body, 0.07);
    this.group.add(body);

    // Head — angular
    const headGeo = new THREE.BoxGeometry(0.45, 0.4, 0.4);
    const headMat = createToonMaterial(0xd9703a);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.42;
    head.castShadow = true;
    addOutline(head, 0.07);
    this.group.add(head);

    // Visor
    const visorGeo = new THREE.BoxGeometry(0.35, 0.1, 0.08);
    const visorMat = createToonMaterial(0xff4444);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.47, 0.22);
    this.group.add(visor);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.45, 0.18);
    const legMat = createToonMaterial(0x8b3300);
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.17, 0.22, 0);
    legL.castShadow = true;
    this.group.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.17, 0.22, 0);
    legR.castShadow = true;
    this.group.add(legR);

    // Shoulder spikes
    const spikeGeo = new THREE.ConeGeometry(0.08, 0.3, 5);
    const spikeMat = createToonMaterial(0x444444);
    [-1, 1].forEach(side => {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(side * 0.38, 1.05, 0);
      spike.rotation.z = -side * Math.PI / 4;
      this.group.add(spike);
    });
  }

  update(delta, playerPos) {
    if (this._state === 'dead' || this._state === 'aggro') return false;

    // Check aggro
    const dist = this.position.distanceTo(playerPos);
    if (dist < this.aggroRadius) {
      this._state = 'aggro';
      return true; // signal aggro triggered
    }

    // Patrol behaviour
    if (this._isWaiting) {
      this._waitTimer -= delta * 1000;
      if (this._waitTimer <= 0) {
        this._isWaiting = false;
        this._pickPatrolTarget();
      }
      return false;
    }

    // Move toward patrol target
    const toTarget = new THREE.Vector3().subVectors(this._patrolTarget, this.position);
    const distToTarget = toTarget.length();
    if (distToTarget < 0.15) {
      this._isWaiting = true;
      const [min, max] = CONFIG.SCRAPPER_PATROL_WAIT;
      this._waitTimer = min + Math.random() * (max - min);
    } else {
      const speed = 1.2;
      toTarget.normalize().multiplyScalar(speed * delta);
      this.position.add(toTarget);
      this.group.position.copy(this.position);
      // Face movement direction
      this.group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
    }

    return false;
  }

  _pickPatrolTarget() {
    const r = CONFIG.SCRAPPER_PATROL_RADIUS;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * r;
    this._patrolTarget.set(
      this.spawnPos.x + Math.cos(angle) * dist,
      0,
      this.spawnPos.z + Math.sin(angle) * dist
    );
  }

  die() {
    this._state = 'dead';
    this.scene.remove(this.group);
  }

  resetCombatState() {
    this._state = 'patrol';
  }
}
