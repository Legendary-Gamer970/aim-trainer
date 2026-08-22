import * as THREE from 'three';

export class AimRaycaster {
  private raycaster: THREE.Raycaster;
  private centerCoord: THREE.Vector2;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.centerCoord = new THREE.Vector2(0, 0); // Exact screen center for crosshair
  }

  /**
   * Casts a ray from the camera center into the scene
   * @param camera The player's active camera
   * @param objects The target objects to test intersection against
   * @returns Intersection list sorted by distance
   */
  public cast(camera: THREE.Camera, objects: THREE.Object3D[]): THREE.Intersection[] {
    this.raycaster.setFromCamera(this.centerCoord, camera);
    return this.raycaster.intersectObjects(objects, true);
  }
}

export const aimRaycaster = new AimRaycaster();
