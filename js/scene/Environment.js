import * as THREE from 'three';
import { createToonMaterial, addOutlineToGroup } from './ToonMaterials.js';
import { CONFIG } from '../config.js';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.currentZone = 'landingSite';
    this._zonePortals = []; // { position, targetZone, ppRequired, mesh }
    this._buildLandingSite();
  }

  // ── Zone switching ─────────────────────────────────────────────────────────
  switchZone(zoneName) {
    // Clear current environment
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this._zonePortals = [];
    this.currentZone = zoneName;

    switch (zoneName) {
      case 'landingSite': this._buildLandingSite(); break;
      case 'mine': this._buildMine(); break;
      case 'verdantMaw': this._buildVerdantMaw(); break;
      case 'lagoonCoast': this._buildLagoonCoast(); break;
      default: this._buildLandingSite();
    }
  }

  getPortals() { return this._zonePortals; }

  getZoneLabel() {
    const labels = {
      landingSite: 'Landing Site',
      mine: 'The Mine',
      verdantMaw: 'Verdant Maw',
      lagoonCoast: 'Lagoon Coast',
    };
    return labels[this.currentZone] || 'Unknown';
  }

  // ── Resource node spawn positions per zone ─────────────────────────────────
  getResourceNodeSpawns() {
    switch (this.currentZone) {
      case 'landingSite': return [
        { x: -6, z: -3, type: 'copper' },
        { x: 4, z: -5, type: 'copper' },
        { x: -8, z: 5, type: 'timber' },
        { x: -10, z: 2, type: 'timber' },
        { x: 7, z: 6, type: 'timber' },
        { x: -14, z: -10, type: 'stone' },
        { x: -12, z: -14, type: 'stone' },
        { x: 3, z: 8, type: 'fiber' },
        { x: -3, z: 10, type: 'fiber' },
        { x: 9, z: -6, type: 'fiber' },
      ];
      case 'mine': return [
        { x: 2, z: 3, type: 'iron' },
        { x: -4, z: 5, type: 'iron' },
        { x: 6, z: -2, type: 'iron' },
        { x: -6, z: -4, type: 'stone' },
        { x: 0, z: -6, type: 'stone' },
        { x: 3, z: 7, type: 'carbon' },
        { x: -3, z: 8, type: 'quartz' },
        { x: 8, z: 4, type: 'copper' },
      ];
      case 'verdantMaw': return [
        { x: 3, z: 4, type: 'timber' },
        { x: -5, z: 6, type: 'timber' },
        { x: 7, z: -3, type: 'fiber' },
        { x: -8, z: 3, type: 'fiber' },
        { x: 4, z: -7, type: 'resin' },
        { x: -4, z: -5, type: 'silica' },
        { x: 9, z: 6, type: 'quartz' },
      ];
      case 'lagoonCoast': return [
        { x: 5, z: 5, type: 'silica' },
        { x: -6, z: 4, type: 'silica' },
        { x: 3, z: -6, type: 'copper' },
        { x: -5, z: -3, type: 'quartz' },
        { x: 8, z: -2, type: 'iron' },
      ];
      default: return [];
    }
  }

  // ── Enemy spawn positions per zone ─────────────────────────────────────────
  getEnemySpawns() {
    switch (this.currentZone) {
      case 'landingSite': return [
        { x: 14, z: 10 }, { x: -12, z: 16 }, { x: 16, z: -10 },
      ];
      case 'mine': return [
        { x: 8, z: 8 }, { x: -8, z: 6 }, { x: 6, z: -8 }, { x: -6, z: -6 },
      ];
      case 'verdantMaw': return [
        { x: 10, z: 8 }, { x: -8, z: 10 }, { x: 12, z: -6 }, { x: -10, z: -8 }, { x: 0, z: 14 },
      ];
      case 'lagoonCoast': return [
        { x: 12, z: 6 }, { x: -10, z: 8 }, { x: 8, z: -10 },
      ];
      default: return [];
    }
  }

  // ── Landing Site ───────────────────────────────────────────────────────────
  _buildLandingSite() {
    this._addGround(0x5a8c3c);
    this._addLandingPad();
    this._addForest();
    this._addMountain();
    this._addRocks();

    // Portal to Mine (near mountain)
    this._addPortal(-16, -14, 'mine', 0, 'Mine');
    // Portal to Verdant Maw (south edge)
    this._addPortal(0, 20, 'verdantMaw', CONFIG.ENV_UNLOCK.verdantMaw, 'Verdant Maw');
    // Portal to Lagoon Coast (east edge)
    this._addPortal(20, 0, 'lagoonCoast', CONFIG.ENV_UNLOCK.lagoonCoast, 'Lagoon Coast');
  }

  _addGround(color) {
    const geo = new THREE.PlaneGeometry(CONFIG.GROUND_SIZE, CONFIG.GROUND_SIZE);
    const mat = createToonMaterial(color);
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  _addLandingPad() {
    const geo = new THREE.CylinderGeometry(
      CONFIG.LANDING_PAD_RADIUS, CONFIG.LANDING_PAD_RADIUS, 0.12, 24
    );
    const mat = createToonMaterial(0x8899aa);
    const pad = new THREE.Mesh(geo, mat);
    pad.position.set(0, 0.06, 0);
    pad.receiveShadow = true;
    pad.castShadow = true;
    this.group.add(pad);

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
      if (angle > Math.PI * 0.05 && angle < Math.PI * 0.85) continue;
      const x = Math.cos(angle) * (r + Math.random() * 3 - 1.5);
      const z = Math.sin(angle) * (r + Math.random() * 3 - 1.5);
      this._addTree(x, z);
    }
    for (let i = 0; i < 10; i++) {
      const x = -8 + Math.random() * 10 - 5;
      const z = -8 + Math.random() * 10 - 5;
      this._addTree(x, z);
    }
  }

  _addTree(x, z) {
    const treeGroup = new THREE.Group();
    const h = 1.4 + Math.random() * 0.8;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.22, h, 6);
    const trunkMat = createToonMaterial(0x6b4226);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    treeGroup.add(trunk);

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
    const peakGeo = new THREE.ConeGeometry(7, 14, 8);
    const peakMat = createToonMaterial(0x8899aa);
    const peak = new THREE.Mesh(peakGeo, peakMat);
    peak.position.y = 7;
    peak.castShadow = true;
    group.add(peak);

    const snowGeo = new THREE.ConeGeometry(2.2, 3.5, 8);
    const snowMat = createToonMaterial(0xeeeeff);
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.y = 13.5;
    group.add(snow);

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
    const positions = [[5, 7], [-4, 9], [8, -3], [-9, 4], [3, -8]];
    for (const [x, z] of positions) {
      const geo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.3, 0);
      const mat = createToonMaterial(0x888888);
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(x, 0.3, z);
      rock.rotation.y = Math.random() * Math.PI;
      rock.castShadow = true;
      this.group.add(rock);
    }
  }

  _addPortal(x, z, targetZone, ppRequired, label) {
    const group = new THREE.Group();

    // Glowing ring
    const ringGeo = new THREE.TorusGeometry(1.2, 0.15, 8, 16);
    const ringMat = createToonMaterial(ppRequired === 0 ? 0x00ffcc : 0xff8800);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.5;
    group.add(ring);

    // Inner glow
    const innerGeo = new THREE.CircleGeometry(1.0, 16);
    const innerMat = new THREE.MeshBasicMaterial({
      color: ppRequired === 0 ? 0x004433 : 0x332200,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.x = Math.PI / 2;
    inner.position.y = 1.5;
    group.add(inner);

    // Base pillar
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.5, 8);
    const pillarMat = createToonMaterial(0x556666);
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 0.25;
    group.add(pillar);

    group.position.set(x, 0, z);
    addOutlineToGroup(group, 0.04);
    this.group.add(group);

    this._zonePortals.push({
      position: new THREE.Vector3(x, 0, z),
      targetZone,
      ppRequired,
      label,
      mesh: group,
    });
  }

  // ── Mine zone ──────────────────────────────────────────────────────────────
  _buildMine() {
    this._addGround(0x3a3530);

    // Cave walls
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = 16 + Math.random() * 3;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const geo = new THREE.BoxGeometry(3 + Math.random() * 2, 4 + Math.random() * 3, 3 + Math.random() * 2);
      const mat = createToonMaterial(0x4a4035);
      const wall = new THREE.Mesh(geo, mat);
      wall.position.set(x, 2, z);
      wall.castShadow = true;
      this.group.add(wall);
    }

    // Ore veins (glowing spots)
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.SphereGeometry(0.3, 6, 4);
      const mat = createToonMaterial(0xffcc44);
      const ore = new THREE.Mesh(geo, mat);
      ore.position.set(
        (Math.random() - 0.5) * 20,
        0.3,
        (Math.random() - 0.5) * 20
      );
      this.group.add(ore);
    }

    // Portal back to Landing Site
    this._addPortal(0, -18, 'landingSite', 0, 'Landing Site');
  }

  // ── Verdant Maw zone ──────────────────────────────────────────────────────
  _buildVerdantMaw() {
    this._addGround(0x2a5a1a);

    // Dense jungle canopy
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * 35;
      const z = (Math.random() - 0.5) * 35;
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue; // clear center
      this._addJungleTree(x, z);
    }

    // Vines
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.CylinderGeometry(0.03, 0.03, 3, 4);
      const mat = createToonMaterial(0x336633);
      const vine = new THREE.Mesh(geo, mat);
      vine.position.set(
        (Math.random() - 0.5) * 20,
        1.5,
        (Math.random() - 0.5) * 20
      );
      vine.rotation.z = Math.random() * 0.3 - 0.15;
      this.group.add(vine);
    }

    this._addPortal(0, -18, 'landingSite', 0, 'Landing Site');
  }

  _addJungleTree(x, z) {
    const treeGroup = new THREE.Group();
    const h = 2.5 + Math.random() * 1.5;
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, h, 6);
    const trunkMat = createToonMaterial(0x4a3520);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const crownGeo = new THREE.SphereGeometry(1.2 + Math.random() * 0.5, 8, 6);
    const crownMat = createToonMaterial(0x1a4a1a);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = h + 0.5;
    crown.castShadow = true;
    treeGroup.add(crown);

    treeGroup.position.set(x, 0, z);
    this.group.add(treeGroup);
  }

  // ── Lagoon Coast zone ──────────────────────────────────────────────────────
  _buildLagoonCoast() {
    this._addGround(0xc2b280); // sand

    // Water areas
    for (let i = 0; i < 6; i++) {
      const r = 3 + Math.random() * 4;
      const geo = new THREE.CircleGeometry(r, 16);
      const mat = createToonMaterial(0x2277aa);
      mat.transparent = true;
      mat.opacity = 0.7;
      const water = new THREE.Mesh(geo, mat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(
        (Math.random() - 0.5) * 30,
        0.02,
        (Math.random() - 0.5) * 30
      );
      this.group.add(water);
    }

    // Palm trees
    for (let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 30;
      if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
      this._addPalmTree(x, z);
    }

    // Rocky islands
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.CylinderGeometry(1.5, 2, 0.8, 8);
      const mat = createToonMaterial(0x887766);
      const island = new THREE.Mesh(geo, mat);
      island.position.set(
        8 + (Math.random() - 0.5) * 10,
        0.4,
        (Math.random() - 0.5) * 15
      );
      island.castShadow = true;
      this.group.add(island);
    }

    this._addPortal(0, -18, 'landingSite', 0, 'Landing Site');
  }

  _addPalmTree(x, z) {
    const treeGroup = new THREE.Group();
    const h = 2 + Math.random() * 1;
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, h, 6);
    const trunkMat = createToonMaterial(0x8b6914);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h / 2;
    trunk.rotation.z = Math.random() * 0.2 - 0.1;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Fan leaves
    for (let i = 0; i < 5; i++) {
      const leafGeo = new THREE.ConeGeometry(0.8, 1.5, 4);
      const leafMat = createToonMaterial(0x228833);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = h + 0.2;
      leaf.rotation.z = Math.PI / 4;
      leaf.rotation.y = (i / 5) * Math.PI * 2;
      treeGroup.add(leaf);
    }

    treeGroup.position.set(x, 0, z);
    this.group.add(treeGroup);
  }
}
