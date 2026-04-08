import * as THREE from 'three';

/**
 * Creates a DataTexture gradient map for MeshToonMaterial.
 * steps=3 gives a clean two-tone cel look.
 */
function makeGradientMap(steps = 3) {
  const colors = new Uint8Array(steps * 3);
  for (let i = 0; i < steps; i++) {
    const v = Math.round((i / (steps - 1)) * 255);
    colors[i * 3] = v;
    colors[i * 3 + 1] = v;
    colors[i * 3 + 2] = v;
  }
  const tex = new THREE.DataTexture(colors, steps, 1, THREE.RGBFormat);
  tex.needsUpdate = true;
  return tex;
}

const gradientMap = makeGradientMap(3);

/**
 * Returns a MeshToonMaterial with cel-shading gradient.
 */
export function createToonMaterial(color, options = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap,
    ...options,
  });
}

/**
 * Adds a black outline mesh as a child of the given mesh.
 * Uses the inverted-normals (BackSide) trick — no post-processing needed.
 */
export function addOutline(mesh, thickness = 0.04) {
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.BackSide,
  });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.setScalar(1 + thickness);
  outline.renderOrder = -1;
  mesh.add(outline);
  return outline;
}

/**
 * Adds outlines to every Mesh within a Group recursively.
 */
export function addOutlineToGroup(group, thickness = 0.04) {
  group.traverse(child => {
    if (child.isMesh && child.material?.side !== THREE.BackSide) {
      addOutline(child, thickness);
    }
  });
}
