export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Vec2Like {
  x: number;
  z: number;
}

/**
 * Resolves a moving circle (the player footprint) against a set of
 * axis-aligned collider boxes in the XZ plane.
 *
 * Overlaps are pushed out along the axis of least penetration, which
 * produces natural wall sliding. The inward velocity component is
 * cancelled so the player stops (but keeps sliding along the surface).
 */
export function resolveCircleCollisions(
  position: Vec2Like,
  velocity: Vec2Like | null,
  radius: number,
  colliders: ColliderBox[]
): void {
  for (const box of colliders) {
    const nearestX = Math.max(box.minX, Math.min(position.x, box.maxX));
    const nearestZ = Math.max(box.minZ, Math.min(position.z, box.maxZ));
    const dx = position.x - nearestX;
    const dz = position.z - nearestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq >= radius * radius) continue;

    if (distSq > 0) {
      const dist = Math.sqrt(distSq);
      const push = radius - dist;
      const nx = dx / dist;
      const nz = dz / dist;
      position.x += nx * push;
      position.z += nz * push;
      if (velocity) {
        const inward = velocity.x * nx + velocity.z * nz;
        if (inward < 0) {
          velocity.x -= inward * nx;
          velocity.z -= inward * nz;
        }
      }
    } else {
      const penLeft = position.x - (box.minX - radius);
      const penRight = box.maxX + radius - position.x;
      const penNear = position.z - (box.minZ - radius);
      const penFar = box.maxZ + radius - position.z;
      const minPen = Math.min(penLeft, penRight, penNear, penFar);
      if (minPen === penLeft) {
        position.x = box.minX - radius;
        if (velocity && velocity.x < 0) velocity.x = 0;
      } else if (minPen === penRight) {
        position.x = box.maxX + radius;
        if (velocity && velocity.x > 0) velocity.x = 0;
      } else if (minPen === penNear) {
        position.z = box.minZ - radius;
        if (velocity && velocity.z < 0) velocity.z = 0;
      } else {
        position.z = box.maxZ + radius;
        if (velocity && velocity.z > 0) velocity.z = 0;
      }
    }
  }
}