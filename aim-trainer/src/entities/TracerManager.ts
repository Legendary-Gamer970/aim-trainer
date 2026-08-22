import * as THREE from 'three';

interface Tracer {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  direction: THREE.Vector3;
  distance: number;
  progress: number;
  speed: number;
  length: number;
  active: boolean;
}

export class TracerManager {
  public group: THREE.Group;
  private poolSize: number = 15;
  private tracers: Tracer[] = [];

  constructor() {
    this.group = new THREE.Group();

    // Glowing bright tracer material
    const tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6);
    tracerGeo.rotateX(Math.PI / 2); // Align cylinder along Z axis

    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < this.poolSize; i++) {
      const mesh = new THREE.Mesh(tracerGeo, tracerMat.clone());
      mesh.visible = false;
      this.group.add(mesh);

      this.tracers.push({
        mesh,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        direction: new THREE.Vector3(),
        distance: 0,
        progress: 0,
        speed: 180, // m/s
        length: 1.2,
        active: false,
      });
    }
  }

  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    for (const t of this.tracers) {
      if (!t.active) {
        t.active = true;
        t.start.copy(start);
        t.end.copy(end);

        t.direction.subVectors(end, start);
        t.distance = t.direction.length();
        if (t.distance > 0) {
          t.direction.normalize();
        } else {
          t.direction.set(0, 0, -1);
        }

        t.progress = 0;
        t.mesh.visible = true;
        t.mesh.scale.set(1, 1, t.length);
        (t.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;

        // Position at start
        t.mesh.position.copy(start);
        t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), t.direction);
        break;
      }
    }
  }

  public update(deltaTime: number): void {
    for (const t of this.tracers) {
      if (t.active) {
        t.progress += t.speed * deltaTime;

        if (t.progress >= t.distance + t.length) {
          t.active = false;
          t.mesh.visible = false;
        } else {
          // Current position along the ray
          const currentPos = new THREE.Vector3().copy(t.start).addScaledVector(t.direction, t.progress);
          t.mesh.position.copy(currentPos);

          // Fade out as it nears target
          const fadeProgress = Math.min(1.0, t.progress / t.distance);
          (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 1.0 - fadeProgress * 0.5);
        }
      }
    }
  }

  public clearAll(): void {
    for (const t of this.tracers) {
      t.active = false;
      t.mesh.visible = false;
    }
  }
}
