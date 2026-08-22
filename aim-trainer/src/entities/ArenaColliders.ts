import type { ColliderBox } from './Collision';

/**
 * Single source of truth for the environment layout that blocks the
 * player. The Arena builds matching visual geometry from these constants
 * and the collider list below defines where the player may not go.
 */

export const BOOTH = {
  halfWidth: 2.7,
  wallThickness: 0.1,
  wallZFront: -3.35,
  wallZBack: 1.25,
  wallHeight: 1.12,
  grillMinX: -0.15,
  grillMaxX: 2.75,
  grillZMin: -3.25,
  grillZMax: -2.95,
  grillHeight: 1.0,
};

export const BOOTH_BENCH = {
  // Left edge inset so the grill gate corridor (x -2.65..-0.15) stays
  // fully walkable: a player crossing at the gate center (x=-1.4) must
  // clear the bench with a radius margin.
  minX: -1.1,
  maxX: 1.9,
  minZ: -2.05,
  maxZ: -1.45,
};

export const DOOR = {
  halfOpening: 3.6,
  leafWidth: 3.5,
  leafHeight: 3.6,
  z: 6.95,
  thickness: 0.12,
};

export const DECK_SIDE = {
  minX: 12.45,
  maxX: 15.95,
  minZ: -20.7,
  maxZ: -4.3,
};

export const ARENA_BOUNDS = {
  xMin: -16.6,
  xMax: 16.6,
  zMin: -32.9,
  zMax: 6.9,
};

const BOX = (minX: number, maxX: number, minZ: number, maxZ: number): ColliderBox => ({ minX, maxX, minZ, maxZ });

export function buildArenaColliders(): ColliderBox[] {
  return [
    // Building envelope (walls)
    BOX(-17, 17, -33.5, -33.0),
    BOX(-17, 17, 7.0, 7.5),
    BOX(16.75, 17.25, -33.5, 7.5),
    BOX(-17.25, -16.75, -33.5, 7.5),

    // Industrial entrance door (closed)
    BOX(-DOOR.halfOpening, DOOR.halfOpening, DOOR.z - 0.13, DOOR.z + 0.13),

    // Backstop curb + target holders (target wall stays untouched)
    BOX(-17, 17, -31.75, -31.05),
    BOX(-8.16, -7.84, -31.1, -30.9),
    BOX(-4.16, -3.84, -31.1, -30.9),
    BOX(-0.16, 0.16, -31.1, -30.9),
    BOX(3.84, 4.16, -31.1, -30.9),
    BOX(7.84, 8.16, -31.1, -30.9),

    // Side storage decks (blocked so the player cannot climb or pass under)
    BOX(DECK_SIDE.minX, DECK_SIDE.maxX, DECK_SIDE.minZ, DECK_SIDE.maxZ),
    BOX(-DECK_SIDE.maxX, -DECK_SIDE.minX, DECK_SIDE.minZ, DECK_SIDE.maxZ),

    // Shooting booth: grill + side walls, gate left of the grill
    BOX(BOOTH.grillMinX, BOOTH.grillMaxX, BOOTH.grillZMin, BOOTH.grillZMax),
    BOX(-BOOTH.halfWidth - BOOTH.wallThickness / 2, -BOOTH.halfWidth + BOOTH.wallThickness / 2, BOOTH.wallZFront, BOOTH.wallZBack),
    BOX(BOOTH.halfWidth - BOOTH.wallThickness / 2, BOOTH.halfWidth + BOOTH.wallThickness / 2, BOOTH.wallZFront, BOOTH.wallZBack),

    // Firing counter bench
    BOX(BOOTH_BENCH.minX, BOOTH_BENCH.maxX, BOOTH_BENCH.minZ, BOOTH_BENCH.maxZ),

    // Platform side rails
    BOX(3.27, 3.37, -1.7, 2.1),
    BOX(-3.37, -3.27, -1.7, 2.1),

    // Storage props at the rear
    BOX(-10.0, -7.4, 3.6, 5.5),
    BOX(7.4, 10.0, 3.6, 5.4),
    BOX(-12.2, -10.8, 3.85, 5.0),
    BOX(10.9, 12.3, 3.7, 4.9),
    BOX(-13.35, -11.65, 2.1, 3.1),

    // Range safety board posts
    BOX(-10.05, -9.95, -0.55, -0.45),
    BOX(-7.85, -7.75, -0.55, -0.45),
  ];
}