// World-space guides: glowing destination cylinders, floating arrows and checkpoint rings.

import * as THREE from 'three';

export function createBeacon(scene, color = 0xffd23f, radius = 3) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 4, 32, 1, true), mat);
  tube.position.y = 2;
  g.add(tube);
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.8, radius, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);
  const arrow = createArrow(color);
  arrow.position.y = 6;
  g.add(arrow);
  scene.add(g);
  return {
    group: g,
    update(t) { arrow.position.y = 6 + Math.sin(t * 3) * 0.5; arrow.rotation.y = t * 1.5; mat.opacity = 0.25 + Math.sin(t * 4) * 0.08; },
    dispose() { scene.remove(g); },
  };
}

export function createArrow(color = 0xffd23f) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1); shape.lineTo(1, 0.2); shape.lineTo(0.4, 0.2); shape.lineTo(0.4, 1.2);
  shape.lineTo(-0.4, 1.2); shape.lineTo(-0.4, 0.2); shape.lineTo(-1, 0.2); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  geo.translate(0, 0, -0.15);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
}

/** Arrow that hovers over a moving thing (mission car, target). */
export function createHoverArrow(scene, color) {
  const a = createArrow(color);
  a.scale.setScalar(0.8);
  scene.add(a);
  return {
    mesh: a,
    follow(x, y, z, t) { a.position.set(x, y + Math.sin(t * 3) * 0.3, z); a.rotation.y = t * 2; },
    dispose() { scene.remove(a); },
  };
}

/** Upright ring for race checkpoints. */
export function createCheckpointRing(scene) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 40), new THREE.MeshBasicMaterial({ color: 0xff4fa3 }));
  m.position.y = 5;
  scene.add(m);
  return { mesh: m, dispose() { scene.remove(m); } };
}
