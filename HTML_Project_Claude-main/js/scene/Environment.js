import * as THREE from 'three';
import { createToonMaterial, addOutline, addOutlineToGroup } from './ToonMaterials.js';
import { CONFIG } from '../config.js';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.currentZone = 'landingSite';
    this._zonePortals = []; // { position, targetZone, ppRequired, mesh }
    this._collisionCircles = []; // { x, z, r }
    this._trackGroup = new THREE.Group(); // track markers live here, separate from env
    scene.add(this._trackGroup);

    // Trees in current zone — tracked for Terrain Cutter clearing
    this._trees = []; // { group, x, z, alive, collisionIdx }

    // Rocks in current zone — tracked for drilling
    this._rocks = []; // { mesh, x, z, alive, collisionIdx }

    // Growing trees (planted from seeds)
    this._growingTrees = []; // { group, targetScale, currentScale, x, z }

    this._buildLandingSite();
  }

  // ── Zone switching ─────────────────────────────────────────────────────────
  switchZone(zoneName) {
    // Clear current environment
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this._zonePortals = [];
    this._collisionCircles = [];
    this._trees = [];
    this._rocks = [];
    this._growingTrees = [];
    this.currentZone = zoneName;

    switch (zoneName) {
      case 'landingSite': this._buildLandingSite(); break;
      case 'mine': this._buildMine(); break;
      case 'verdantMaw': this._buildVerdantMaw(); break;
      case 'lagoonCoast': this._buildLagoonCoast(); break;
      case 'frozenTundra': this._buildFrozenTundra(); break;
      case 'spaceship': this._buildSpaceship(); break;
      default: this._buildLandingSite();
    }
  }

  // ── Per-frame environment update (growing trees, etc.) ─────────────────────
  update(delta) {
    for (const t of this._growingTrees) {
      if (t.currentScale < t.targetScale) {
        t.currentScale = Math.min(t.targetScale, t.currentScale + delta * (t.targetScale / 60));
        t.group.scale.setScalar(t.currentScale);
      }
    }
  }

  // ── Terrain Cutter interactions ────────────────────────────────────────────
  findNearestTree(playerPos) {
    let best = null, bestDist = Infinity;
    for (const t of this._trees) {
      if (!t.alive) continue;
      const d = Math.hypot(playerPos.x - t.x, playerPos.z - t.z);
      if (d < 2.5 && d < bestDist) { best = t; bestDist = d; }
    }
    return best;
  }

  clearTree(tree) {
    if (!tree || !tree.alive) return null;
    tree.alive = false;
    tree.group.visible = false;
    // Remove collision circle for this tree
    const idx = this._collisionCircles.indexOf(tree.collision);
    if (idx !== -1) this._collisionCircles.splice(idx, 1);

    const timber = 1 + Math.floor(Math.random() * 2); // 1–2 timber
    const hasSeed = Math.random() < 0.7;               // 70% chance of seed
    return { timber, seed: hasSeed ? 1 : 0 };
  }

  plantTree(x, z) {
    // Spawn a tiny tree that grows to full size over 60s
    const treeGroup = new THREE.Group();
    const h = 1.4 + Math.random() * 0.8;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.22, h, 6);
    const trunkMat = createToonMaterial(0x6b4226);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h / 2;
    treeGroup.add(trunk);

    const crownColors = [0x2d6a2d, 0x3a8c3a, 0x245224];
    const crownMat = createToonMaterial(crownColors[Math.floor(Math.random() * crownColors.length)]);
    const crownH = 1.8 + Math.random() * 0.6;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9, crownH, 7), crownMat);
    crown.position.y = h + crownH * 0.4;
    treeGroup.add(crown);

    treeGroup.position.set(x, 0, z);
    treeGroup.scale.setScalar(0.1);
    this.group.add(treeGroup);

    const collision = { x, z, r: 0.55 };
    this._collisionCircles.push(collision);

    const entry = { group: treeGroup, x, z, alive: true, collision };
    this._trees.push(entry);
    this._growingTrees.push({ group: treeGroup, currentScale: 0.1, targetScale: 1.0, x, z });
  }

  // ── Rock drilling interactions ─────────────────────────────────────────────
  findNearestRock(playerPos) {
    let best = null, bestDist = Infinity;
    for (const r of this._rocks) {
      if (!r.alive) continue;
      const d = Math.hypot(playerPos.x - r.x, playerPos.z - r.z);
      if (d < 2.0 && d < bestDist) { best = r; bestDist = d; }
    }
    return best;
  }

  drillRock(rock) {
    if (!rock || !rock.alive) return null;
    rock.alive = false;
    rock.mesh.visible = false;
    const idx = this._collisionCircles.indexOf(rock.collision);
    if (idx !== -1) this._collisionCircles.splice(idx, 1);
    return { stone: 2 };
  }

  getPortals() { return this._zonePortals; }

  getCollisionCircles() { return this._collisionCircles; }

  /**
   * Rebuild track marker meshes for the current zone from pedometer data.
   * Call after zone switch or after placing a new track.
   */
  refreshTrackMarkers(pedometer) {
    // Clear previous markers
    while (this._trackGroup.children.length > 0) {
      this._trackGroup.remove(this._trackGroup.children[0]);
    }
    const tracks = pedometer.getPlacedTracksForZone(this.currentZone);
    for (const t of tracks) {
      this._addTrackMarker(t.x, t.z);
    }
  }

  _addTrackMarker(x, z) {
    // Single tile matching one background grid cell (GridHelper: GROUND_SIZE / (GROUND_SIZE/2) = 2 units per cell)
    const tileMat = createToonMaterial(0x00ddaa);
    tileMat.transparent = true;
    tileMat.opacity = 0.55;

    const tileGeo = new THREE.PlaneGeometry(2.0, 2.0);
    const tile = new THREE.Mesh(tileGeo, tileMat);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(x, 0.03, z);
    this._trackGroup.add(tile);

    const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.0, 2.0));
    const borderMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.9 });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(x, 0.04, z);
    this._trackGroup.add(border);
  }

  getZoneLabel() {
    const labels = {
      landingSite: 'Landing Site',
      mine: 'The Mine',
      verdantMaw: 'Verdant Maw',
      lagoonCoast: 'Lagoon Coast',
      frozenTundra: 'Frozen Tundra',
      spaceship: 'Spaceship Interior',
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
        // Stone nodes kept clear of the Mine portal at (-13, -13) so
        // gathering doesn't steal the [E] interact from the portal.
        { x: -16, z: -9, type: 'stone' },
        { x: -9, z: -16, type: 'stone' },
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
        { x: -8, z: -12, type: 'gold' },  // replaces decorative ore vein
        { x: 10, z: 9, type: 'gold' },    // replaces decorative ore vein
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
      case 'frozenTundra': return [
        { x: 4, z: 3, type: 'titanium' },
        { x: -5, z: 5, type: 'titanium' },
        { x: 7, z: -4, type: 'tungsten' },
        { x: -8, z: -3, type: 'tungsten' },
        { x: 2, z: -7, type: 'silver' },
        { x: -3, z: 7, type: 'silver' },
        { x: 9, z: 5, type: 'iron' },
        { x: -6, z: -6, type: 'quartz' },
      ];
      case 'spaceship': return []; // no gatherables inside the ship
      default: return [];
    }
  }

  // ── Enemy spawn positions per zone (with archetype for variety) ───────────
  getEnemySpawns() {
    switch (this.currentZone) {
      // T1 — Rushers only (safe starter zone)
      case 'landingSite': return [
        { x: 14, z: 10,  archetype: 'rusher' },
        { x: -12, z: 16, archetype: 'rusher' },
      ];
      // T2 — 2 Rushers + 1 Swinger
      case 'mine': return [
        { x: 8,  z: 8,  archetype: 'rusher' },
        { x: -8, z: 6,  archetype: 'rusher' },
        { x: 6,  z: -8, archetype: 'swinger' },
      ];
      // T3 — 2 Rushers + 1 Swinger + 1 Burst
      case 'verdantMaw': return [
        { x: 10,  z: 8,  archetype: 'rusher' },
        { x: -8,  z: 10, archetype: 'rusher' },
        { x: 12,  z: -6, archetype: 'swinger' },
        { x: -10, z: -8, archetype: 'burst' },
      ];
      // T4 — 1 Swinger + 2 Burst (synergy pressure)
      case 'lagoonCoast': return [
        { x: 12, z: 6,  archetype: 'swinger' },
        { x: -10, z: 8, archetype: 'burst' },
        { x: 8, z: -10, archetype: 'burst' },
      ];
      // T5 — 2 Swingers + 2 Bursts
      case 'frozenTundra': return [
        { x: 10, z: 6,  archetype: 'swinger' },
        { x: -10, z: 6, archetype: 'burst' },
        { x: 8, z: -10, archetype: 'burst' },
        { x: -8, z: -8, archetype: 'swinger' },
      ];
      case 'spaceship': return []; // no enemies in the ship
      default: return [];
    }
  }

  // ── Landing Site ───────────────────────────────────────────────────────────
  _buildLandingSite() {
    this._addGround(0x5a8c3c);
    this._addLandingPad();
    this._addSpaceshipHatch();
    this._addPathToMountain();
    this._addForest();
    this._addMountain();
    this._addRocks();

    // Portal into the Spaceship (on the landing pad)
    this._addPortal(0, -3, 'spaceship', 0, 'Spaceship');
    // Portal to Mine (at mouth of cave on the mountain's near side)
    this._addPortal(-13, -13, 'mine', 0, 'Mine');
    // Portal to Verdant Maw (south edge)
    this._addPortal(0, 20, 'verdantMaw', CONFIG.ENV_UNLOCK.verdantMaw, 'Verdant Maw');
    // Portal to Lagoon Coast (east edge)
    this._addPortal(20, 0, 'lagoonCoast', CONFIG.ENV_UNLOCK.lagoonCoast, 'Lagoon Coast');
    // Portal to Frozen Tundra (north edge)
    this._addPortal(0, -20, 'frozenTundra', CONFIG.ENV_UNLOCK.frozenTundra, 'Frozen Tundra');
  }

  _addSpaceshipHatch() {
    // A raised hatch door on the landing pad indicating the spaceship entrance
    const hatchGroup = new THREE.Group();

    // Hatch floor panel
    const hatchGeo = new THREE.BoxGeometry(1.2, 0.1, 1.6);
    const hatchMat = createToonMaterial(0x556677);
    const hatch = new THREE.Mesh(hatchGeo, hatchMat);
    hatch.position.y = 0.1;
    hatch.castShadow = true;
    addOutline(hatch, 0.04);
    hatchGroup.add(hatch);

    // Cyan glow border strips
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const edges = [
      { w: 1.2, x: 0, z: 0.8 }, { w: 1.2, x: 0, z: -0.8 },
    ];
    for (const e of edges) {
      const eGeo = new THREE.BoxGeometry(e.w, 0.05, 0.08);
      const em = new THREE.Mesh(eGeo, glowMat);
      em.position.set(e.x, 0.15, e.z);
      hatchGroup.add(em);
    }

    // Arrow pointing down (entry cue)
    const arrowGeo = new THREE.ConeGeometry(0.18, 0.35, 4);
    const arrowMat = createToonMaterial(0x00ffcc);
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.z = Math.PI; // point down
    arrow.position.y = 0.9;
    hatchGroup.add(arrow);

    hatchGroup.position.set(0, 0, -3);
    this.group.add(hatchGroup);
  }

  _addGround(color) {
    const geo = new THREE.PlaneGeometry(CONFIG.GROUND_SIZE, CONFIG.GROUND_SIZE);
    const mat = createToonMaterial(color);
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Subtle grid overlay so players can read distances and plan movement
    const grid = new THREE.GridHelper(CONFIG.GROUND_SIZE, CONFIG.GROUND_SIZE / 2, 0x000000, 0x000000);
    grid.position.y = 0.01;
    const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
    mats.forEach(m => { m.transparent = true; m.opacity = 0.08; });
    this.group.add(grid);
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

  /**
   * Dirt/stone path running southwest from the landing pad to the mountain
   * cave entrance at roughly (-13, -13). Creates a long dirt plane plus a
   * scattering of stone tiles along the route.
   */
  _addPathToMountain() {
    // Path endpoints
    const endX = -13;
    const endZ = -13;
    const len = Math.hypot(endX, endZ); // ≈ 18.38
    const angle = Math.atan2(endX, endZ); // world-angle for the southwest diagonal

    // Main dirt strip
    const stripGeo = new THREE.PlaneGeometry(1.6, len);
    const stripMat = createToonMaterial(0x8a7d6b);
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = -angle; // align plane's +Y axis with the path direction
    strip.position.set(endX / 2, 0.02, endZ / 2);
    strip.receiveShadow = true;
    this.group.add(strip);

    // Stepping stones scattered along the path (reproducible jitter)
    const tileMat = createToonMaterial(0x9a9a9a);
    for (let i = 1; i <= 8; i++) {
      const t = i / 9;
      const jx = (Math.sin(i * 2.7) * 0.22);
      const jz = (Math.cos(i * 1.9) * 0.22);
      const tileGeo = new THREE.BoxGeometry(0.45, 0.08, 0.45);
      const tile = new THREE.Mesh(tileGeo, tileMat);
      tile.position.set(endX * t + jx, 0.05, endZ * t + jz);
      tile.rotation.y = i * 0.4;
      tile.receiveShadow = true;
      tile.castShadow = true;
      this.group.add(tile);
    }
  }

  _addForest() {
    const r = CONFIG.FOREST_RADIUS;
    const count = CONFIG.TREE_COUNT;

    // Carve a narrow gap in the forest aligned with the path that runs
    // southwest from the landing pad to the mountain cave. In this scene
    // (x, z) map to angle = atan2(z, x); southwest is angle = -3π/4.
    const pathAngle = -3 * Math.PI / 4;
    const gapHalfWidth = Math.PI * 0.12;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI; // [-π, π)
      // angular distance to path direction, wrapped
      let d = Math.abs(angle - pathAngle);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < gapHalfWidth) continue;

      const x = Math.cos(angle) * (r + Math.random() * 3 - 1.5);
      const z = Math.sin(angle) * (r + Math.random() * 3 - 1.5);
      this._addTree(x, z);
    }

    // Scattered inner trees, but avoid anything sitting on top of the
    // pad or the path line from (0,0) to (-13,-13).
    const pathDX = -13, pathDZ = -13;
    const pathLenSq = pathDX * pathDX + pathDZ * pathDZ;
    for (let i = 0; i < 14; i++) {
      const x = -8 + Math.random() * 16;
      const z = -8 + Math.random() * 16;
      // Keep clear of the landing pad
      if (Math.hypot(x, z) < CONFIG.LANDING_PAD_RADIUS + 1.2) continue;
      // Project (x,z) onto the path line segment and skip if too close
      const t = Math.max(0, Math.min(1, (x * pathDX + z * pathDZ) / pathLenSq));
      const px = pathDX * t, pz = pathDZ * t;
      if (Math.hypot(x - px, z - pz) < 1.3) continue;
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
    const collision = { x, z, r: 0.55 };
    this._collisionCircles.push(collision);
    this._trees.push({ group: treeGroup, x, z, alive: true, collision });
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
    this._collisionCircles.push({ x, z, r: 7 });

    // Cave mouth: a dark tunnel opening boring into the base of the
    // mountain, facing the landing pad (northeast). Built as a separate
    // group in world space so the dark-interior basic material is not
    // wrapped with a cel outline.
    this._addCaveEntrance(x, z);
  }

  /**
   * Dark cave entrance at the base of the mountain, facing the landing pad.
   * Consists of a hollow stone arch (open-ended cylinder) with a pitch-dark
   * interior disk and two flanking stone pillars.
   */
  _addCaveEntrance(mountainX, mountainZ) {
    // Direction from the mountain center toward the origin (pad), normalized.
    const dx = -mountainX;
    const dz = -mountainZ;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;

    // Place the cave mouth just outside the hill base (hill radius ≈ 9).
    const mouthR = 6.8;
    const cx = mountainX + nx * mouthR;
    const cz = mountainZ + nz * mouthR;

    // Orient so the cylinder's length axis points toward the pad.
    const yaw = Math.atan2(nx, nz);

    const caveGroup = new THREE.Group();

    // Hollow stone archway (open-ended cylinder rotated on its side)
    const archGeo = new THREE.CylinderGeometry(1.4, 1.4, 3.2, 14, 1, true);
    const archMat = createToonMaterial(0x4a4a55);
    archMat.side = THREE.DoubleSide;
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.rotation.z = Math.PI / 2; // lay the cylinder on its side (axis → X)
    arch.position.y = 1.4;
    arch.castShadow = true;
    arch.receiveShadow = true;
    caveGroup.add(arch);
    addOutline(arch, 0.03);

    // Pitch-dark interior disk sealing the back of the tunnel (no outline).
    const darkGeo = new THREE.CircleGeometry(1.28, 18);
    const darkMat = new THREE.MeshBasicMaterial({
      color: 0x050505,
      side: THREE.DoubleSide,
    });
    const dark = new THREE.Mesh(darkGeo, darkMat);
    dark.rotation.y = Math.PI / 2;
    dark.position.set(-1.2, 1.4, 0); // set back into the mountain (local -X)
    caveGroup.add(dark);

    // Flanking stone pillars
    const pillarMat = createToonMaterial(0x6d7d88);
    for (const side of [-1, 1]) {
      const pillarGeo = new THREE.BoxGeometry(0.55, 2.4, 0.55);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(0.15, 1.2, side * 1.75);
      pillar.castShadow = true;
      caveGroup.add(pillar);
      addOutline(pillar, 0.04);
    }

    // Lintel across the top
    const lintelGeo = new THREE.BoxGeometry(0.9, 0.35, 3.8);
    const lintel = new THREE.Mesh(lintelGeo, pillarMat);
    lintel.position.set(0.15, 2.55, 0);
    lintel.castShadow = true;
    caveGroup.add(lintel);
    addOutline(lintel, 0.04);

    caveGroup.position.set(cx, 0, cz);
    caveGroup.rotation.y = yaw;
    this.group.add(caveGroup);
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
      addOutline(rock, 0.04);
      this.group.add(rock);
      const collision = { x, z, r: 0.7 };
      this._collisionCircles.push(collision);
      this._rocks.push({ mesh: rock, x, z, alive: true, collision });
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

    // Block player from walking into the portal hole
    this._collisionCircles.push({ x, z, r: 0.9 });

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

    // Cave perimeter walls — half-ring of large boulders around the north/east/west edges
    for (let i = 0; i < 14; i++) {
      // Span from 30° to 210° (north half) — leave the south open for the entrance
      const angle = (Math.PI * (30 + i * (180 / 13))) / 180;
      const r = 15 + Math.random() * 3;
      const wx = Math.cos(angle) * r;
      const wz = -Math.sin(angle) * r; // negative z = north
      const geo = new THREE.BoxGeometry(3 + Math.random() * 2, 5 + Math.random() * 3, 3 + Math.random() * 2);
      const mat = createToonMaterial(0x4a4035);
      const wall = new THREE.Mesh(geo, mat);
      wall.position.set(wx, 2.5, wz);
      wall.castShadow = true;
      this.group.add(wall);
      this._collisionCircles.push({ x: wx, z: wz, r: 2.5 });
    }

    // Cave entrance — wide low boulder clusters flanking the gap, readable from top-down
    const boulderMat = createToonMaterial(0x3a3028);
    // Left cluster (3 staggered blocks)
    const leftCluster = [
      { x: -5.0, z: -13.5, w: 3.2, h: 2.0, d: 3.8 },
      { x: -6.5, z: -15.0, w: 2.8, h: 1.8, d: 3.2 },
      { x: -4.5, z: -16.2, w: 2.4, h: 1.6, d: 2.6 },
    ];
    // Right cluster (mirror)
    const rightCluster = leftCluster.map(b => ({ ...b, x: -b.x }));
    for (const b of [...leftCluster, ...rightCluster]) {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mesh = new THREE.Mesh(geo, boulderMat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      addOutline(mesh, 0.07);
      this.group.add(mesh);
      this._collisionCircles.push({ x: b.x, z: b.z, r: 1.6 });
    }
    // Low lintel beam across the gap — y=2 so it's visible from top-down camera
    const lintelMat = createToonMaterial(0x2e2218);
    const lintelGeo = new THREE.BoxGeometry(8.0, 1.4, 1.6);
    const lintel = new THREE.Mesh(lintelGeo, lintelMat);
    lintel.position.set(0, 2.0, -14.5);
    lintel.castShadow = true;
    addOutline(lintel, 0.06);
    this.group.add(lintel);
    // Large dark ground shadow patch — visually implies the cave opening from above
    const shadowGeo = new THREE.PlaneGeometry(7.0, 5.5);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.02, -16.0);
    this.group.add(shadow);

    // Decorative amber wall-glow patches (replaces old unidentifiable yellow spheres)
    // Actual gold ore nodes are now resource nodes via getResourceNodeSpawns()
    const glowPositions = [[-12, 3], [14, -2], [-14, 6], [6, 13]];
    for (const [ox, oz] of glowPositions) {
      const geo = new THREE.PlaneGeometry(0.8, 0.5);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.3 });
      const glow = new THREE.Mesh(geo, mat);
      glow.position.set(ox, 0.8, oz);
      glow.rotation.x = -Math.PI / 2;
      this.group.add(glow);
    }

    // Stalactites hanging from the ceiling (visual depth cue)
    for (let i = 0; i < 8; i++) {
      const h = 1 + Math.random() * 1.2;
      const geo = new THREE.ConeGeometry(0.18, h, 5);
      const mat = createToonMaterial(0x332820);
      const stalacc = new THREE.Mesh(geo, mat);
      stalacc.rotation.z = Math.PI; // point downward
      stalacc.position.set(
        (Math.random() - 0.5) * 22,
        5 + h / 2,
        (Math.random() - 0.5) * 22
      );
      this.group.add(stalacc);
    }

    // Portal back to Landing Site — close to entrance (south gap), at -16 not -18
    this._addPortal(0, -16, 'landingSite', 0, 'Landing Site');
    this._addReturnBeacon(0, -16);
  }

  // ── Verdant Maw zone ──────────────────────────────────────────────────────
  _buildVerdantMaw() {
    this._addGround(0x2a5a1a);

    // Dense jungle canopy
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * 35;
      const z = (Math.random() - 0.5) * 35;
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue; // clear center
      if (Math.hypot(x - 0, z - 17) < 3) continue; // keep south portal clear
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

    this._addPortal(0, 17, 'landingSite', 0, 'Landing Site');
    this._addReturnBeacon(0, 17);
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
    this._collisionCircles.push({ x, z, r: 0.6 });
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
      if (Math.hypot(x - 0, z - (-18)) < 3) continue; // keep portal clear
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
    this._addReturnBeacon(0, -18);
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
    this._collisionCircles.push({ x, z, r: 0.4 });
  }

  // ── Frozen Tundra zone ─────────────────────────────────────────────────────
  _buildFrozenTundra() {
    this._addGround(0xdce8f0); // pale icy blue-white

    // Snow drifts — flat rounded mounds
    for (let i = 0; i < 12; i++) {
      const w = 2 + Math.random() * 3;
      const d = 1.5 + Math.random() * 2;
      const geo = new THREE.CylinderGeometry(w, w * 1.1, 0.4, 10);
      const mat = createToonMaterial(0xeef4ff);
      const drift = new THREE.Mesh(geo, mat);
      drift.position.set(
        (Math.random() - 0.5) * 35,
        0.2,
        (Math.random() - 0.5) * 35
      );
      drift.scale.z = d / w;
      drift.rotation.y = Math.random() * Math.PI;
      drift.receiveShadow = true;
      this.group.add(drift);
    }

    // Dead bare trees (skeletal, no leaves)
    for (let i = 0; i < 14; i++) {
      const x = (Math.random() - 0.5) * 32;
      const z = (Math.random() - 0.5) * 32;
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
      if (Math.hypot(x - 0, z - (-18)) < 3) continue; // keep portal clear
      this._addDeadTree(x, z);
    }

    // Ice formations — jagged vertical spikes
    for (let i = 0; i < 8; i++) {
      const spikeGroup = new THREE.Group();
      const count = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < count; j++) {
        const h = 0.8 + Math.random() * 1.4;
        const geo = new THREE.ConeGeometry(0.18, h, 5);
        const mat = createToonMaterial(0xa8d8f0);
        const spike = new THREE.Mesh(geo, mat);
        spike.position.set((j - count / 2) * 0.35, h / 2, 0);
        spike.rotation.z = (Math.random() - 0.5) * 0.3;
        spike.castShadow = true;
        addOutline(spike, 0.04);
        spikeGroup.add(spike);
      }
      spikeGroup.position.set(
        (Math.random() - 0.5) * 30,
        0,
        (Math.random() - 0.5) * 30
      );
      spikeGroup.rotation.y = Math.random() * Math.PI;
      this.group.add(spikeGroup);
    }

    // Frozen lake (flat transparent disc)
    const lakeGeo = new THREE.CircleGeometry(6, 20);
    const lakeMat = createToonMaterial(0x7ab8d4);
    lakeMat.transparent = true;
    lakeMat.opacity = 0.6;
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(8, 0.01, 8);
    this.group.add(lake);

    // Crack lines on the lake (thin dark strips)
    for (let i = 0; i < 4; i++) {
      const crackGeo = new THREE.PlaneGeometry(0.08, 4 + Math.random() * 3);
      const crackMat = new THREE.MeshBasicMaterial({ color: 0x4488aa });
      const crack = new THREE.Mesh(crackGeo, crackMat);
      crack.rotation.x = -Math.PI / 2;
      crack.rotation.z = Math.random() * Math.PI;
      crack.position.set(8 + (Math.random() - 0.5) * 8, 0.02, 8 + (Math.random() - 0.5) * 8);
      this.group.add(crack);
    }

    // Portal back to Landing Site
    this._addPortal(0, -18, 'landingSite', 0, 'Landing Site');
    this._addReturnBeacon(0, -18);
  }

  _addDeadTree(x, z) {
    const treeGroup = new THREE.Group();
    const h = 2 + Math.random() * 1.5;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, h, 6);
    const trunkMat = createToonMaterial(0x4a3830);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    addOutline(trunk, 0.04);
    treeGroup.add(trunk);

    // Two bare branches
    const branchMat = createToonMaterial(0x4a3830);
    for (let s of [-1, 1]) {
      const bh = 0.6 + Math.random() * 0.5;
      const bGeo = new THREE.CylinderGeometry(0.05, 0.08, bh, 5);
      const branch = new THREE.Mesh(bGeo, branchMat);
      branch.position.set(s * 0.4, h * 0.75, 0);
      branch.rotation.z = s * (Math.PI / 4 + Math.random() * 0.2);
      branch.castShadow = true;
      treeGroup.add(branch);
    }

    // Light snow cap on top of trunk
    const snowCapGeo = new THREE.SphereGeometry(0.16, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const snowCapMat = createToonMaterial(0xeef4ff);
    const snowCap = new THREE.Mesh(snowCapGeo, snowCapMat);
    snowCap.position.y = h;
    treeGroup.add(snowCap);

    treeGroup.position.set(x, 0, z);
    treeGroup.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(treeGroup);
    this._collisionCircles.push({ x, z, r: 0.35 });
  }

  // ── Spaceship Interior ─────────────────────────────────────────────────────
  _buildSpaceship() {
    // Dark metal floor
    const floorGeo = new THREE.PlaneGeometry(22, 22);
    const floorMat = createToonMaterial(0x1a1a2e);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Subtle grid on floor
    const grid = new THREE.GridHelper(22, 11, 0x00ffcc, 0x00ffcc);
    grid.position.y = 0.01;
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMats.forEach(m => { m.transparent = true; m.opacity = 0.12; });
    this.group.add(grid);

    // Solid perimeter collision — dense ring of overlapping circles along all 4 walls
    for (let wx = -11; wx <= 11; wx += 2) {
      this._collisionCircles.push({ x: wx, z: -11, r: 1.2 }); // north wall
      this._collisionCircles.push({ x: wx, z:  11, r: 1.2 }); // south wall
    }
    for (let wz = -9; wz <= 9; wz += 2) {
      this._collisionCircles.push({ x: -11, z: wz, r: 1.2 }); // west wall
      this._collisionCircles.push({ x:  11, z: wz, r: 1.2 }); // east wall
    }

    // Ambient cyan accent strips along floor edges
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const stripPositions = [
      { x: 0, z: -10, rx: 0, len: 20 }, { x: 0, z: 10, rx: 0, len: 20 },
      { x: -10, z: 0, rx: Math.PI / 2, len: 20 }, { x: 10, z: 0, rx: Math.PI / 2, len: 20 },
    ];
    for (const s of stripPositions) {
      const geo = new THREE.PlaneGeometry(s.len, 0.15);
      const strip = new THREE.Mesh(geo, accentMat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = s.rx;
      strip.position.set(s.x, 0.02, s.z);
      this.group.add(strip);
    }

    // ── Offload Station ──────────────────────────────────────────────────────
    this._addOffloadStation(-5, -3);

    // ── Fabricator (Workbench) ───────────────────────────────────────────────
    this._addFabricator(5, -3);

    // ── Holographic wall panels (decorative) ─────────────────────────────────
    for (const [px, pz, ry] of [[-9, -5, 0.3], [9, -5, -0.3], [0, -9, 0]]) {
      const panelGeo = new THREE.BoxGeometry(2.5, 1.8, 0.1);
      const panelMat = createToonMaterial(0x0a2233);
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(px, 1.5, pz);
      panel.rotation.y = ry;
      addOutline(panel, 0.04);
      this.group.add(panel);
      // Cyan inner screen
      const screenGeo = new THREE.PlaneGeometry(2.2, 1.4);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x003322, transparent: true, opacity: 0.8 });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(px, 1.5, pz + (ry > 0 ? -0.1 : 0.1));
      screen.rotation.y = ry;
      this.group.add(screen);
    }

    // Hatch back to Landing Site (north side, near spawn)
    this._addPortal(0, 6, 'landingSite', 0, 'Exit Ship');
    this._addReturnBeacon(0, 6);
  }

  _addOffloadStation(x, z) {
    const g = new THREE.Group();

    // Main console body
    const bodyGeo = new THREE.BoxGeometry(1.4, 1.2, 0.8);
    const bodyMat = createToonMaterial(0x223344);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    addOutline(body, 0.05);
    g.add(body);

    // Glowing top panel
    const topGeo = new THREE.BoxGeometry(1.2, 0.08, 0.6);
    const topMat = createToonMaterial(0x00ffcc);
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.24;
    g.add(top);

    // Screen
    const screenGeo = new THREE.PlaneGeometry(0.9, 0.6);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x004433 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.85, 0.41);
    g.add(screen);

    // Label above
    const labelGeo = new THREE.BoxGeometry(1.2, 0.25, 0.05);
    const labelMat = createToonMaterial(0x005544);
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.set(0, 1.6, 0.3);
    g.add(label);

    // Floating indicator
    const indGeo = new THREE.OctahedronGeometry(0.12, 0);
    const indMat = createToonMaterial(0x00ffcc);
    const ind = new THREE.Mesh(indGeo, indMat);
    ind.position.y = 2.0;
    g.add(ind);

    g.position.set(x, 0, z);
    this.group.add(g);
    this._collisionCircles.push({ x, z, r: 1.0 });

    // Register as interactable station
    this._offloadStationPos = { x, z };
  }

  _addFabricator(x, z) {
    const g = new THREE.Group();

    // Base platform
    const baseGeo = new THREE.CylinderGeometry(0.9, 1.0, 0.2, 10);
    const baseMat = createToonMaterial(0x334455);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    base.castShadow = true;
    g.add(base);

    // Main body — wider workbench shape
    const bodyGeo = new THREE.BoxGeometry(1.6, 1.0, 1.0);
    const bodyMat = createToonMaterial(0x334455);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    addOutline(body, 0.05);
    g.add(body);

    // Glowing work surface
    const surfaceGeo = new THREE.BoxGeometry(1.4, 0.06, 0.8);
    const surfaceMat = createToonMaterial(0x4488ff);
    const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
    surface.position.y = 1.23;
    g.add(surface);

    // Arm / crane element
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6);
    const armMat = createToonMaterial(0x445566);
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0.5, 1.95, 0);
    arm.rotation.z = Math.PI / 8;
    g.add(arm);

    // End effector glow
    const effGeo = new THREE.SphereGeometry(0.12, 6, 4);
    const effMat = createToonMaterial(0x4488ff);
    const eff = new THREE.Mesh(effGeo, effMat);
    eff.position.set(0.9, 2.5, 0);
    g.add(eff);

    // Label indicator
    const indGeo = new THREE.OctahedronGeometry(0.12, 0);
    const indMat = createToonMaterial(0x4488ff);
    const ind = new THREE.Mesh(indGeo, indMat);
    ind.position.y = 2.8;
    g.add(ind);

    g.position.set(x, 0, z);
    this.group.add(g);
    this._collisionCircles.push({ x, z, r: 1.0 });

    // Register as interactable fabricator
    this._fabricatorPos = { x, z };
  }

  getOffloadStationPos() { return this._offloadStationPos || null; }
  getFabricatorPos() { return this._fabricatorPos || null; }

  /**
   * Tall glowing cyan beacon placed above the return portal so mobile players
   * can spot it from the spawn point at (0, 0).
   */
  _addReturnBeacon(x, z) {
    const group = new THREE.Group();

    // Tall thin pillar
    const pillarGeo = new THREE.CylinderGeometry(0.12, 0.18, 5, 8);
    const pillarMat = createToonMaterial(0x00ffcc);
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 2.5 + 1.5; // sit above portal ring (which is at y=1.5)
    group.add(pillar);
    addOutline(pillar, 0.04);

    // Arrowhead cone pointing upward
    const arrowGeo = new THREE.ConeGeometry(0.35, 0.7, 8);
    const arrowMat = createToonMaterial(0x00ffcc);
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.y = 2.5 + 1.5 + 2.5 + 0.35; // on top of pillar
    group.add(arrow);
    addOutline(arrow, 0.04);

    // Floor ring to draw attention
    const ringGeo = new THREE.TorusGeometry(1.6, 0.1, 6, 20);
    const ringMat = createToonMaterial(0x00ffcc);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    group.add(ring);

    group.position.set(x, 0, z);
    this.group.add(group);
  }
}
