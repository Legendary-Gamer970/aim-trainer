import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ParticleSystem {
  public group: THREE.Group;
  private particles: Particle[] = [];
  private poolSize: number = 60;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.MeshBasicMaterial;

  constructor() {
    this.group = new THREE.Group();

    // Shared geometry and material for maximum performance
    this.particleGeo = new THREE.SphereGeometry(0.035, 6, 6);
    this.particleMat = new THREE.MeshBasicMaterial({
      color: 0xff4655,
      transparent: true,
      opacity: 1.0,
    });

    // Initialize particle pool
    for (let i = 0; i < this.poolSize; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, this.particleMat.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.28,
        active: false,
      });
    }
  }

  public emitBurst(position: THREE.Vector3, count: number = 14, color: number = 0xff4655): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.25 + Math.random() * 0.2;
        p.mesh.position.copy(position);
        p.mesh.visible = true;
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0;

        // Random spherical burst velocity
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 4.0 + Math.random() * 6.0;

        p.velocity.set(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed
        );

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  public update(deltaTime: number): void {
    for (const p of this.particles) {
      if (p.active) {
        p.life += deltaTime;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          // Move
          p.mesh.position.addScaledVector(p.velocity, deltaTime);
          // Fade out
          const progress = p.life / p.maxLife;
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - progress;
          // Scale down
          const scale = 1.0 - progress * 0.5;
          p.mesh.scale.set(scale, scale, scale);
        }
      }
    }
  }
}
