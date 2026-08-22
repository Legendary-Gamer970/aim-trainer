import * as THREE from 'three';
import { GAME_CONFIG } from '../config/constants';
import { Dummy } from './Dummy';

export class DummyManager {
  public group: THREE.Group;
  private rangeDummies: Dummy[] = [];
  private flickDummy: Dummy | null = null;
  private lastSpawnPosition: THREE.Vector3 = new THREE.Vector3();

  constructor() {
    this.group = new THREE.Group();
    this.setupRangeDummies();
  }

  /**
   * Spawns standing training dummies stationed across the practice range lanes.
   * Each dummy patrols smoothly left/right within its lane at its own speed.
   */
  public setupRangeDummies(): void {
    // Clear existing
    this.clearRangeDummies();

    // Default range dummy positions across practice lanes
    const rangePositions = [
      new THREE.Vector3(-4.5, 0, -12), // 12m Left Lane
      new THREE.Vector3(0.0, 0, -10),  // 10m Center Lane
      new THREE.Vector3(4.5, 0, -14),  // 14m Right Lane
      new THREE.Vector3(-2.8, 0, -18), // 18m Mid-Left
      new THREE.Vector3(3.2, 0, -22),  // 22m Mid-Right
      new THREE.Vector3(0.0, 0, -26),  // 26m Long Range Center
    ];

    rangePositions.forEach((pos) => {
      const dummy = new Dummy();
      dummy.spawn(pos);

      // Lane-bounded patrol: amplitude keeps motion inside the target lane
      const maxAmplitude = Math.max(1.2, 6.0 - Math.abs(pos.x) - 0.6);
      const amplitude = 1.4 + Math.random() * Math.min(0.8, maxAmplitude - 1.4);
      const speed = 0.7 + Math.random() * 0.7; // m/s, slightly different per dummy
      const phase = Math.random() * Math.PI * 2;
      dummy.setPatrol(pos.x, amplitude, speed, phase);

      this.rangeDummies.push(dummy);
      this.group.add(dummy.group);
    });
  }

  public spawnNextFlickDummy(): Dummy {
    if (!this.flickDummy) {
      this.flickDummy = new Dummy();
      this.group.add(this.flickDummy.group);
    }

    const pos = this.generateTargetPosition();
    this.lastSpawnPosition.copy(pos);
    this.flickDummy.spawn(pos);
    return this.flickDummy;
  }

  public getCurrentFlickDummy(): Dummy | null {
    return this.flickDummy && !this.flickDummy.isEliminated ? this.flickDummy : null;
  }

  public getRangeDummies(): Dummy[] {
    return [...this.rangeDummies];
  }

  public getAllHitboxMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];

    // Range dummies
    for (const d of this.rangeDummies) {
      if (d.group.visible && !d.isEliminated) {
        meshes.push(...d.getHitboxMeshes());
      }
    }

    // Flick dummy
    if (this.flickDummy && this.flickDummy.group.visible && !this.flickDummy.isEliminated) {
      meshes.push(...this.flickDummy.getHitboxMeshes());
    }

    return meshes;
  }

  public update(deltaTime: number): void {
    for (const d of this.rangeDummies) {
      d.update(deltaTime);
    }
    if (this.flickDummy) {
      this.flickDummy.update(deltaTime);
    }
  }

  public hideRangeDummies(): void {
    for (const d of this.rangeDummies) {
      d.group.visible = false;
    }
  }

  public showRangeDummies(): void {
    for (const d of this.rangeDummies) {
      d.group.visible = true;
    }
  }

  public clearRangeDummies(): void {
    for (const d of this.rangeDummies) {
      this.group.remove(d.group);
      d.dispose();
    }
    this.rangeDummies = [];
  }

  public clearFlickDummy(): void {
    if (this.flickDummy) {
      this.group.remove(this.flickDummy.group);
      this.flickDummy.dispose();
      this.flickDummy = null;
    }
  }

  public clearAll(): void {
    this.clearRangeDummies();
    this.clearFlickDummy();
  }

  /**
   * Generates a validated target position:
   * - Always in front of the player (never behind)
   * - Inside the shooting lane bounds (x within range width)
   * - Minimum distance so targets can never be shot from an unintended angle
   * - Maximum distance keeps targets within the visible/aimable area
   * - Keeps separation from the previous target so positions cannot be memorized
   */
  public generateTargetPosition(): THREE.Vector3 {
    const {
      TARGET_SPAWN_X_MIN: minX,
      TARGET_SPAWN_X_MAX: maxX,
      TARGET_SPAWN_Z_MIN: minZ,
      TARGET_SPAWN_Z_MAX: maxZ,
      TARGET_MIN_SEPARATION: minSeparation,
    } = GAME_CONFIG;

    let x = 0;
    let z = 0;
    let attempts = 0;

    do {
      x = minX + Math.random() * (maxX - minX);
      z = minZ + Math.random() * (maxZ - minZ);
      attempts++;
    } while (
      attempts < 10 &&
      this.lastSpawnPosition.distanceTo(new THREE.Vector3(x, 0, z)) < minSeparation
    );

    return new THREE.Vector3(x, 0, z);
  }
}
