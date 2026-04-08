import * as THREE from 'three';
import { createToonMaterial, addOutline } from '../scene/ToonMaterials.js';
import { CONFIG } from '../config.js';

export class Player {
  constructor(scene, statsSystem) {
    this.stats = statsSystem;
    this.scene = scene;
    this.position = new THREE.Vector3(0, 0, 0);
    this.isInCombat = false;
    this.stepsSinceLast = 0;
    this._totalDist = 0;
    this._facing = 0;

    // Gathering state
    this.isGathering = false;
    this._gatherProgress = 0;
    this._gatherTarget = null; // ResourceNode
    this._gatherDuration = 0;

    this.group = new THREE.Group();
    this._buildMesh();
    scene.add(this.group);
  }

  _buildMesh() {
    const bodyGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.7, 10);
    const bodyMat = createToonMaterial(0x4477cc);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    addOutline(body, 0.06);
    this.group.add(body);

    const headGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const headMat = createToonMaterial(0xf5c89a);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.48;
    head.castShadow = true;
    addOutline(head, 0.06);
    this.group.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.055, 6, 4);
    const eyeMat = createToonMaterial(0x111111);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, 1.52, 0.24);
    this.group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.1, 1.52, 0.24);
    this.group.add(eyeR);

    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
    const legMat = createToonMaterial(0x22336a);
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.15, 0.25, 0);
    legL.castShadow = true;
    this.group.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.15, 0.25, 0);
    legR.castShadow = true;
    this.group.add(legR);

    this.group.position.copy(this.position);
  }

  update(keysDown, delta) {
    if (this.isInCombat) return;

    // Gathering — pressing E starts/continues
    if (this.isGathering) {
      if (!keysDown.has('KeyE')) {
        // Released E, cancel gather
        this.isGathering = false;
        this._gatherProgress = 0;
        this._gatherTarget = null;
        return;
      }
      this._gatherProgress += delta;
      if (this._gatherProgress >= this._gatherDuration) {
        // Gather complete — handled externally via getGatherResult()
        return;
      }
      return; // Don't move while gathering
    }

    const speed = this.stats.moveSpeed;
    let dx = 0, dz = 0;

    if (keysDown.has('KeyW') || keysDown.has('ArrowUp'))    dz -= 1;
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown'))  dz += 1;
    if (keysDown.has('KeyA') || keysDown.has('ArrowLeft'))  dx -= 1;
    if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) dx += 1;

    if (dx !== 0 && dz !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dz *= inv;
    }

    if (dx !== 0 || dz !== 0) {
      this._facing = Math.atan2(dx, -dz);
      this.group.rotation.y = this._facing;

      const dist = speed * delta;
      this.position.x += dx * dist;
      this.position.z += dz * dist;

      const half = CONFIG.GROUND_SIZE / 2 - 1;
      this.position.x = Math.max(-half, Math.min(half, this.position.x));
      this.position.z = Math.max(-half, Math.min(half, this.position.z));

      this._totalDist += dist;
      const steps = Math.floor(this._totalDist / CONFIG.STEP_LENGTH);
      if (steps > 0) {
        this.stepsSinceLast += steps;
        this._totalDist -= steps * CONFIG.STEP_LENGTH;
      }
    }

    this.group.position.copy(this.position);
  }

  // ── Gathering ──────────────────────────────────────────────────────────────
  startGathering(resourceNode) {
    this.isGathering = true;
    this._gatherTarget = resourceNode;
    this._gatherProgress = 0;
    // Dexterity reduces gather time
    this._gatherDuration = resourceNode.gatherTime / (1 + this.stats.stats.dexterity.level * 0.15);
  }

  getGatherResult() {
    if (!this.isGathering || this._gatherProgress < this._gatherDuration) return null;
    const result = this._gatherTarget.gather();
    this.isGathering = false;
    this._gatherProgress = 0;
    this._gatherTarget = null;
    return result;
  }

  get gatherProgress() { return this._gatherProgress; }
  get gatherDuration() { return this._gatherDuration; }

  consumeSteps() {
    const s = this.stepsSinceLast;
    this.stepsSinceLast = 0;
    return s;
  }

  teleportTo(x, z) {
    this.position.set(x, 0, z);
    this.group.position.copy(this.position);
  }
}
