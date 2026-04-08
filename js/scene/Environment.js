import * as THREE from 'three';
import { createToonMaterial, addOutlineToGroup } from './ToonMaterials.js';
import { CONFIG } from '../config.js';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._build();
  }

  _build() {
    this._addGround();
    this._addLandingPad();
    this._addForest();
    this._addMountain();
    this._addRocks();
  }

  _addGround() {
    const geo = new THREE.PlaneGeometry(CONFIG.GROUND_SIZE, CONFIG.GROUND_SIZE);
    const mat = createToonMaterial(0x5a8c3c);
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  _addLandingPad() {
    const geo = new THREE.CylinderGeometry(
      CONFIG.LANDING_PAD_RADIUS,
      CONFIG.LANDING_PAD_RADIUS,
      0.12,
      24
    );
    const mat = createToonMaterial(0x8899aa);
    const pad = new THREE.Mesh(geo, mat);
    pad.position.set(0, 0.06, 0);
    pad.receiveShadow = true;
    pad.castShadow = true;
    this.group.add(pad);

    // Center marking
    const markGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.14, 16);
    const markMat = createToonMaterial(0xccddee);
    const mark = new THREE.Mesh(markGeo, markMat);
    mark.position.set(0, 0.07, 0);
    this.group.add(mark);
  }

  _addForest() {
    const r = CONFIG.FOREST_RADIUS;
    const count = CONFIG.TREE_COUNT;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      // Forest occupies a ~270° arc on the north/west/east, leaving south open
      if (angle > Math.PI * 0.05 && angle < Math.PI * 0.85) continue;
      const x = Math.cos(angle) * (r + Math.random() * 3 - 1.5);
      const z = Math.sin(angle) * (r + Math.random() * 3 - 1.5);
      this._addTree(x, z);
    }
    // Extra forest density around mountain side
    for (let i = 0; i < 10; i++) {
      const x = -8 + Math.random() * 10 - 5;
      const z = -8 + Math.random() * 10 - 5;
      this._addTree(x, z);
    }
  }

  _addTree(x, z) {
    const treeGroup = new THREE.Group();
    const h = 1.4 + Math.random() * 0.8;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.22, h, 6);
    const trunkMat = createToonMaterial(0x6b4226);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Crown (two stacked cones for variety)
    const crownColors = [0x2d6a2d, 0x3a8c3a, 0x245224];
    const crownColor = crownColors[Math.floor(Math.random() * crownColors.length)];
    const crownMat = createToonMaterial(crownColor);
    const crownH = 1.8 + Math.random() * 0.6;
    const crown1Geo = new THREE.ConeGeometry(0.9, crownH, 7);
    const crown1 = new THREE.Mesh(crown1Geo, crownMat);
    crown1.position.y = h + crownH * 0.4;
    crown1.castShadow = true;
    treeGroup.add(crown1);

    const crown2Geo = new THREE.ConeGeometry(0.65, crownH * 0.7, 7);
    const crown2 = new THREE.Mesh(crown2Geo, crownMat);
    crown2.position.y = h + crownH * 0.85;
    treeGroup.add(crown2);

    treeGroup.position.set(x, 0, z);
    treeGroup.rotation.y = Math.random() * Math.PI * 2;
    addOutlineToGroup(treeGroup, 0.035);
    this.group.add(treeGroup);
  }

  _addMountain() {
    const { x, z } = CONFIG.MOUNTAIN_POS;
    const group = new THREE.Group();

    // Main peak
    const peakGeo = new THREE.ConeGeometry(7, 14, 8);
    const peakMat = createToonMaterial(0x8899aa);
    const peak = new THREE.Mesh(peakGeo, peakMat);
    peak.position.y = 7;
    peak.castShadow = true;
    group.add(peak);

    // Snow cap
    const snowGeo = new THREE.ConeGeometry(2.2, 3.5, 8);
    const snowMat = createToonMaterial(0xeeeeff);
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.y = 13.5;
    group.add(snow);

    // Base foothills
    const hillGeo = new THREE.ConeGeometry(9, 5, 8);
    const hillMat = createToonMaterial(0x6d7d88);
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.y = 2.5;
    group.add(hill);

    group.position.set(x, 0, z);
    addOutlineToGroup(group, 0.03);
    this.group.add(group);
  }

  _addRocks() {
    const positions = [
      [5, 7], [-4, 9], [8, -3], [-9, 4], [3, -8],
    ];
    for (const [x, z] of positions) {
      const geo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.3, 0);
      const mat = createToonMaterial(0x888888);
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(x, 0.3, z);
      rock.rotation.y = Math.random() * Math.PI;
      rock.castShadow = true;
      addOutlineToGroup(new THREE.Group(), 0.03);
      this.group.add(rock);
    }
  }
}
