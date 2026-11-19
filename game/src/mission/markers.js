// Glowing light beams with ground rings that mark contacts and objectives in the world.
import * as THREE from 'three';

export class Marker {
  constructor(scene, color = 0xffd166) {
    this.group = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beamGeo = new THREE.CylinderGeometry(1.1, 1.1, 40, 20, 1, true); beamGeo.translate(0, 20, 0);
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    const ringGeo = new THREE.TorusGeometry(2.2, 0.16, 8, 40); ringGeo.rotateX(Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.chevron = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 4), new THREE.MeshBasicMaterial({ color }));
    this.chevron.rotation.x = Math.PI;
    this.group.add(this.beam, this.ring, this.chevron);
    this.group.visible = false;
    this.t = 0;
    scene.add(this.group);
  }
  setColor(c) { this.beam.material.color.set(c); this.ring.material.color.set(c); this.chevron.material.color.set(c); }
  show(x, y, z, small = false) {
    this.group.visible = true;
    this.group.position.set(x, y, z);
    const s = small ? 0.6 : 1;
    this.group.scale.set(s, 1, s);
  }
  hide() { this.group.visible = false; }
  update(dt) {
    if (!this.group.visible) return;
    this.t += dt;
    this.ring.position.y = 0.15 + Math.sin(this.t * 3) * 0.08;
    this.ring.scale.setScalar(1 + Math.sin(this.t * 3) * 0.06);
    this.chevron.position.y = 3.2 + Math.sin(this.t * 2.5) * 0.35;
    this.chevron.rotation.y += dt * 2;
    this.beam.material.opacity = 0.22 + Math.sin(this.t * 2) * 0.06;
  }
}
