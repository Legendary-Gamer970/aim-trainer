import * as THREE from 'three';
import { GAME_CONFIG } from '../config/constants';
import { inputManager } from '../core/InputManager';
import { ARENA_BOUNDS } from './ArenaColliders';
import { ColliderBox, resolveCircleCollisions } from './Collision';

export class Player {
  public camera: THREE.PerspectiveCamera;
  public position: THREE.Vector3;
  private velocity: THREE.Vector3;
  private colliders: ColliderBox[];

  private yaw: number = 0;
  private pitch: number = 0;
  private lastDeltaX: number = 0;
  private lastDeltaY: number = 0;

  // Max pitch clamp in radians (~88 degrees)
  private readonly maxPitch = Math.PI / 2 - 0.02;

  // Player footprint radius for collision against the arena geometry
  private static readonly COLLISION_RADIUS = GAME_CONFIG.PLAYER_RADIUS;

  // Longest collision sub-step in meters (prevents tunneling through thin walls)
  private static readonly MAX_SUBSTEP = 0.25;

  constructor(camera: THREE.PerspectiveCamera, colliders: ColliderBox[] = []) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, GAME_CONFIG.PLAYER_HEIGHT, 0);
    this.velocity = new THREE.Vector3();
    this.colliders = colliders;

    this.reset();
  }

  public reset(): void {
    this.position.set(0, GAME_CONFIG.PLAYER_HEIGHT + GAME_CONFIG.PLATFORM_HEIGHT, 0);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.lastDeltaX = 0;
    this.lastDeltaY = 0;
    this.updateCameraTransform();
  }

  public getLastMouseDelta(): { deltaX: number; deltaY: number } {
    return { deltaX: this.lastDeltaX, deltaY: this.lastDeltaY };
  }

  public isMoving(): boolean {
    return Math.hypot(this.velocity.x, this.velocity.z) > 0.2;
  }

  public update(deltaTime: number): void {
    // 1. Process Mouse Look
    const { deltaX, deltaY } = inputManager.consumeMouseDelta();
    this.lastDeltaX = deltaX;
    this.lastDeltaY = deltaY;

    this.yaw -= deltaX;
    this.pitch -= deltaY;

    // Clamp pitch (vertical look)
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));

    // 2. Process WASD Movement
    const moveInput = inputManager.getMovementVector();

    // Direction relative to player's horizontal yaw
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wishDir = new THREE.Vector3();
    wishDir.addScaledVector(forward, -moveInput.z);
    wishDir.addScaledVector(right, moveInput.x);

    if (wishDir.lengthSq() > 0) {
      wishDir.normalize();
      // Accelerate towards desired direction
      this.velocity.x += wishDir.x * GAME_CONFIG.PLAYER_ACCEL * deltaTime;
      this.velocity.z += wishDir.z * GAME_CONFIG.PLAYER_ACCEL * deltaTime;

      // Cap max speed
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (speed > GAME_CONFIG.PLAYER_SPEED) {
        this.velocity.x = (this.velocity.x / speed) * GAME_CONFIG.PLAYER_SPEED;
        this.velocity.z = (this.velocity.z / speed) * GAME_CONFIG.PLAYER_SPEED;
      }
    } else {
      // Friction / Deceleration
      const frictionFactor = Math.max(0, 1 - GAME_CONFIG.PLAYER_FRICTION * deltaTime);
      this.velocity.x *= frictionFactor;
      this.velocity.z *= frictionFactor;
    }

    // Apply movement in small sub-steps so fast frames cannot tunnel
    // through thin geometry (grill bars, rails, walls)
    const totalX = this.velocity.x * deltaTime;
    const totalZ = this.velocity.z * deltaTime;
    const stepDist = Math.hypot(totalX, totalZ);
    const steps = Math.max(1, Math.ceil(stepDist / Player.MAX_SUBSTEP));
    for (let i = 0; i < steps; i++) {
      this.position.x += totalX / steps;
      this.position.z += totalZ / steps;

      // 3. Environment collision: resolve the player circle against the
      // arena's solid geometry (walls, booth grill, door, props). Open
      // gateways stay walkable; walls and barriers stop the player.
      resolveCircleCollisions(this.position, this.velocity, Player.COLLISION_RADIUS, this.colliders);
    }

    // 3b. Safety net: keep the player inside the building envelope.
    // The walls already block movement; this only guards against
    // numeric drift or future geometry edits.
    this.position.x = Math.max(ARENA_BOUNDS.xMin, Math.min(ARENA_BOUNDS.xMax, this.position.x));
    this.position.z = Math.max(ARENA_BOUNDS.zMin, Math.min(ARENA_BOUNDS.zMax, this.position.z));

    this.position.y = GAME_CONFIG.PLAYER_HEIGHT + GAME_CONFIG.PLATFORM_HEIGHT;

    // 4. Sync Three.js Camera
    this.updateCameraTransform();
  }

  private updateCameraTransform(): void {
    this.camera.position.copy(this.position);

    // Apply Euler rotation in YXZ order (standard FPS camera)
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }
}
