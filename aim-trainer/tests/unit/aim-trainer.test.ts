import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_SETTINGS, FLICK_DIFFICULTIES, GAME_CONFIG } from '../../src/config/constants';
import { settingsManager } from '../../src/config/settings';
import { Dummy } from '../../src/entities/Dummy';
import { DummyManager } from '../../src/entities/DummyManager';
import { Player } from '../../src/entities/Player';
import { resolveCircleCollisions } from '../../src/entities/Collision';
import { buildArenaColliders } from '../../src/entities/ArenaColliders';
import { Weapon } from '../../src/entities/Weapon';
import { TracerManager } from '../../src/entities/TracerManager';
import { FlickMode } from '../../src/modes/FlickMode';
import { PracticeMode, PRACTICE_HEADSHOT_SCORE, PRACTICE_BODY_SCORE } from '../../src/modes/PracticeMode';
import { ParticleSystem } from '../../src/entities/ParticleSystem';
import { AimRaycaster } from '../../src/core/Raycaster';
import { inputManager } from '../../src/core/InputManager';

describe('SettingsManager', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should initialize with default settings', () => {
    const settings = settingsManager.getSettings();
    expect(settings.mouseSensitivity).toBe(DEFAULT_SETTINGS.mouseSensitivity);
    expect(settings.sessionDuration).toBe(DEFAULT_SETTINGS.sessionDuration);
    expect(settings.adsSensitivityMultiplier).toBe(DEFAULT_SETTINGS.adsSensitivityMultiplier);
    expect(settings.adsZoomStrength).toBe(DEFAULT_SETTINGS.adsZoomStrength);
    expect(settings.fireRate).toBe(DEFAULT_SETTINGS.fireRate);
  });

  it('should update and notify subscribers when setting changes', () => {
    let notifiedValue = 0;
    const unsubscribe = settingsManager.subscribe((s) => {
      notifiedValue = s.mouseSensitivity;
    });

    settingsManager.set('mouseSensitivity', 2.5);
    expect(notifiedValue).toBe(2.5);
    expect(settingsManager.get('mouseSensitivity')).toBe(2.5);

    settingsManager.update({
      crosshairColor: '#ff0055',
      fov: 100,
    });

    expect(settingsManager.get('crosshairColor')).toBe('#ff0055');
    expect(settingsManager.get('fov')).toBe(100);

    unsubscribe();
  });
});

describe('InputManager', () => {
  it('should scale mouse deltas with sensitivity', () => {
    settingsManager.set('mouseSensitivity', 2.0);
    const deltas = inputManager.consumeMouseDelta();
    expect(deltas.deltaX).toBe(0);
    expect(deltas.deltaY).toBe(0);
  });

  it('should calculate normalized keyboard movement vector', () => {
    const vec = inputManager.getMovementVector();
    expect(vec.x).toBe(0);
    expect(vec.z).toBe(0);
  });

  it('should track left-button hold state and press edge exactly once', () => {
    inputManager.attach(document.createElement('div'));
    inputManager.setInputEnabled(true);

    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    expect(inputManager.isFireHeld()).toBe(true);
    expect(inputManager.consumeFirePressed()).toBe(true);
    // Edge is consumed: subsequent polls return false until the next press
    expect(inputManager.consumeFirePressed()).toBe(false);

    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    expect(inputManager.isFireHeld()).toBe(false);
    expect(inputManager.consumeFirePressed()).toBe(false);
    inputManager.detach();
  });

  it('should track right-button ADS hold state', () => {
    inputManager.attach(document.createElement('div'));
    inputManager.setInputEnabled(true);

    window.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
    expect(inputManager.isADS()).toBe(true);
    // Right-click must not arm the fire trigger
    expect(inputManager.consumeFirePressed()).toBe(false);

    window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));
    expect(inputManager.isADS()).toBe(false);
    inputManager.detach();
  });

  it('should release held buttons when the window loses focus', () => {
    inputManager.attach(document.createElement('div'));
    inputManager.setInputEnabled(true);

    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    window.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
    expect(inputManager.isFireHeld()).toBe(true);
    expect(inputManager.isADS()).toBe(true);

    window.dispatchEvent(new Event('blur'));
    expect(inputManager.isFireHeld()).toBe(false);
    expect(inputManager.isADS()).toBe(false);
    inputManager.detach();
  });

  it('should prevent the context menu while input is enabled (right-click = ADS)', () => {
    inputManager.attach(document.createElement('div'));
    inputManager.setInputEnabled(true);
    const event = new MouseEvent('contextmenu', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    inputManager.setInputEnabled(false);
    const menuEvent = new MouseEvent('contextmenu', { cancelable: true });
    window.dispatchEvent(menuEvent);
    expect(menuEvent.defaultPrevented).toBe(false);
    inputManager.detach();
  });

  it('should scale mouse deltas by the ADS sensitivity multiplier while scoped', () => {
    inputManager.attach(document.createElement('div'));
    settingsManager.set('mouseSensitivity', 1.0);
    settingsManager.set('adsSensitivityMultiplier', 0.5);
    inputManager.setInputEnabled(true);

    // Prime the fallback cursor position
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 5, movementY: 0 }));

    // Hip fire: accumulate 200px of mouse movement
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }));
    const hip = inputManager.consumeMouseDelta();

    // ADS: hold right button, accumulate the same 200px
    window.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }));
    const ads = inputManager.consumeMouseDelta();
    window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));

    expect(ads.deltaX).toBeCloseTo(hip.deltaX * 0.5, 5);
    settingsManager.set('adsSensitivityMultiplier', DEFAULT_SETTINGS.adsSensitivityMultiplier);
    inputManager.detach();
  });
});

describe('Humanoid Dummy and DummyManager', () => {
  it('should create dummy with distinct Head and Body hitboxes', () => {
    const dummy = new Dummy();
    dummy.spawn(new THREE.Vector3(0, 0, -10));

    const hitboxes = dummy.getHitboxMeshes();
    expect(hitboxes.length).toBeGreaterThanOrEqual(4);

    expect(dummy.headMesh.userData.isHeadshot).toBe(true);
    expect(dummy.faceVisorMesh.userData.isHeadshot).toBe(true);
    expect(dummy.torsoMesh.userData.isHeadshot).toBe(false);

    // Test headshot reaction
    const headDummy = new Dummy();
    headDummy.spawn(new THREE.Vector3(0, 0, -10));
    headDummy.triggerHit(true);
    headDummy.update(0.05);
    expect(headDummy.headGroup.rotation.x).not.toBe(0);

    // Test body reaction
    const bodyDummy = new Dummy();
    bodyDummy.spawn(new THREE.Vector3(0, 0, -10));
    bodyDummy.triggerHit(false);
    bodyDummy.update(0.05);
    expect(bodyDummy.bodyGroup.rotation.x).not.toBe(0);
  });

  it('should play a knock-down fall after a hit and hide when the down phase ends', () => {
    const dummy = new Dummy();
    dummy.spawn(new THREE.Vector3(0, 0, -10));

    dummy.triggerHit(true);
    expect(dummy.isEliminated).toBe(true);
    expect(dummy.isFallInProgress()).toBe(true);

    // 0–150ms: hit reaction, no tipping yet
    dummy.update(0.1);
    expect(dummy.group.rotation.x).toBeCloseTo(0, 4);
    expect(dummy.group.visible).toBe(true);

    // 150–500ms: tips backward around its feet, stays visible, never leaves the floor
    dummy.update(0.2);
    expect(dummy.group.rotation.x).toBeLessThan(-0.2);
    expect(dummy.group.position.y).toBe(0);
    expect(dummy.group.visible).toBe(true);

    // Reaches the ground (~500ms): lying on its back, still visible
    dummy.update(0.2);
    expect(dummy.group.rotation.x).toBeLessThan(-1.3);
    expect(dummy.group.rotation.x).toBeGreaterThan(-1.5);
    expect(dummy.group.position.y).toBe(0);
    expect(dummy.group.visible).toBe(true);

    // ~500–1200ms: stays down, then disappears/recycles
    dummy.update(0.75);
    expect(dummy.group.visible).toBe(false);
    expect(dummy.isFallInProgress()).toBe(false);
  });

  it('should not re-trigger a fall on a dummy that is already falling', () => {
    const dummy = new Dummy();
    dummy.spawn(new THREE.Vector3(0, 0, -10));
    dummy.triggerHit(false);
    dummy.update(0.3); // visibly falling by now
    const angle = dummy.group.rotation.x;
    expect(angle).toBeLessThan(-0.2);

    dummy.triggerHit(false); // ignored while falling
    dummy.update(0.1);
    // The fall continues (more tipped over); it did not restart from zero
    expect(dummy.group.rotation.x).toBeLessThan(angle);
  });

  it('should setup range dummies across practice range', () => {
    const dummyManager = new DummyManager();
    const hitboxes = dummyManager.getAllHitboxMeshes();
    expect(hitboxes.length).toBeGreaterThan(10);
  });

  it('should move range dummies smoothly within lane bounds, never teleporting', () => {
    const dummyManager = new DummyManager();
    const dummies = dummyManager.getRangeDummies();
    expect(dummies.length).toBeGreaterThanOrEqual(6);

    // Run 300 frames of patrol motion
    const tracks: number[][] = dummies.map(() => []);
    for (let frame = 0; frame < 300; frame++) {
      dummyManager.update(0.016);
      dummies.forEach((d, i) => tracks[i].push(d.group.position.x));
    }

    for (let i = 0; i < dummies.length; i++) {
      const xs = tracks[i];
      // Motion stays inside the shooting lane
      expect(Math.max(...xs)).toBeLessThanOrEqual(6.0);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(-6.0);
      // Vertical position stays stable (no hopping)
      expect(dummies[i].group.position.y).toBe(0);
      // Smooth movement: no teleporting between frames
      for (let f = 1; f < xs.length; f++) {
        expect(Math.abs(xs[f] - xs[f - 1])).toBeLessThan(0.1);
      }
    }
  });

  it('should despawn quickly when the target window expires', () => {
    const dummy = new Dummy();
    dummy.spawn(new THREE.Vector3(0, 0, -10));
    dummy.despawn();
    expect(dummy.isEliminated).toBe(true);
    dummy.update(0.05);
    dummy.update(0.05);
    dummy.update(0.05);
    expect(dummy.group.visible).toBe(false);
  });

  it('should recycle patrol dummies back to their lane after the fall', () => {
    const dummyManager = new DummyManager();
    const dummy = dummyManager.getRangeDummies()[0];
    const baseX = dummy.group.position.x;

    dummy.triggerHit(false);
    expect(dummy.isEliminated).toBe(true);

    // Advance through reaction (0.15s) + fall (0.35s) + down (0.7s)
    for (let i = 0; i < 90; i++) {
      dummy.update(0.02);
    }

    // Respawning: upright, visible, hittable again, patrolling its lane
    expect(dummy.group.visible).toBe(true);
    expect(dummy.group.rotation.x).toBeCloseTo(0, 4);
    expect(dummy.isEliminated).toBe(false);
    expect(dummy.isFallInProgress()).toBe(false);
    expect(Math.abs(dummy.group.position.x - baseX)).toBeLessThan(3);
  });

  it('should exclude falling/eliminated dummies from hitbox queries', () => {
    const dummyManager = new DummyManager();
    const dummy = dummyManager.getRangeDummies()[0];
    const before = dummyManager.getAllHitboxMeshes().length;
    expect(before).toBeGreaterThan(0);

    dummy.triggerHit(false);
    const during = dummyManager.getAllHitboxMeshes();
    expect(during.length).toBe(before - dummy.getHitboxMeshes().length);

    // After the recycle the dummy is hittable again
    for (let i = 0; i < 90; i++) {
      dummy.update(0.02);
    }
    expect(dummyManager.getAllHitboxMeshes().length).toBe(before);
  });

  it('should only generate validated target positions', () => {
    const dummyManager = new DummyManager();
    const { TARGET_SPAWN_X_MIN, TARGET_SPAWN_X_MAX, TARGET_SPAWN_Z_MIN, TARGET_SPAWN_Z_MAX, TARGET_MIN_SEPARATION } = GAME_CONFIG;

    for (let i = 0; i < 50; i++) {
      const pos = dummyManager.generateTargetPosition();
      // Inside the lane width
      expect(pos.x).toBeGreaterThanOrEqual(TARGET_SPAWN_X_MIN);
      expect(pos.x).toBeLessThanOrEqual(TARGET_SPAWN_X_MAX);
      // Always in front of the player (never behind) and never too close/far
      expect(pos.z).toBeLessThanOrEqual(TARGET_SPAWN_Z_MAX);
      expect(pos.z).toBeGreaterThanOrEqual(TARGET_SPAWN_Z_MIN);
      // Minimum distance from the firing line is guaranteed by the z range
      expect(Math.abs(pos.z)).toBeGreaterThanOrEqual(Math.abs(TARGET_SPAWN_Z_MAX));
    }

    // Consecutive flick spawns keep separation from the previous target
    const a = dummyManager.spawnNextFlickDummy().group.position.clone();
    const b = dummyManager.spawnNextFlickDummy().group.position.clone();
    expect(a.distanceTo(b)).toBeGreaterThanOrEqual(TARGET_MIN_SEPARATION * 0.75);
  });
});

describe('First-Person Weapon & Ammunition', () => {
  const makeWeapon = (camera: THREE.PerspectiveCamera, clock: { t: number }) =>
    new Weapon(camera, () => clock.t);

  it('should manage magazine ammo, recoil, and reload sequence', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const clock = { t: 0 };
    const weapon = makeWeapon(camera, clock);

    expect(camera.children).toContain(weapon.group);
    expect(weapon.magAmmo).toBe(30);
    expect(weapon.reserveAmmo).toBe(120);

    // Shoot 5 rounds (advancing past the fire-rate cooldown between shots)
    for (let i = 0; i < 5; i++) {
      const fired = weapon.shoot();
      expect(fired).toBe(true);
      clock.t += 100;
      weapon.update(0.1, false);
    }
    expect(weapon.magAmmo).toBe(25);

    // Trigger reload
    const reloaded = weapon.reload();
    expect(reloaded).toBe(true);
    expect(weapon.isReloading).toBe(true);

    // Cannot shoot while reloading
    expect(weapon.canShoot()).toBe(false);

    // Advance reload animation to completion (1.7s)
    weapon.update(1.7, false);
    expect(weapon.isReloading).toBe(false);
    expect(weapon.magAmmo).toBe(30);
    expect(weapon.reserveAmmo).toBe(115);

    weapon.dispose();
  });

  it('should enforce the configured fire rate via a real-time cooldown', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const clock = { t: 0 };
    const weapon = makeWeapon(camera, clock);

    // First shot is allowed immediately
    expect(weapon.canShoot()).toBe(true);
    expect(weapon.shoot()).toBe(true);
    expect(weapon.canShoot()).toBe(false); // cooldown blocks a second shot

    // 50ms is short of the ~86ms interval at 700 RPM; 100ms clears it
    clock.t += 50;
    expect(weapon.canShoot()).toBe(false);
    clock.t += 50;
    expect(weapon.canShoot()).toBe(true);

    // Only one bullet per interval
    expect(weapon.shoot()).toBe(true);
    expect(weapon.shoot()).toBe(false);
    expect(weapon.magAmmo).toBe(28);

    // The cadence follows the configured fire rate
    settingsManager.set('fireRate', 400);
    clock.t += 100;
    expect(weapon.shoot()).toBe(true);
    clock.t += 149;
    expect(weapon.canShoot()).toBe(false); // 400 RPM => 150ms interval
    clock.t += 2;
    expect(weapon.canShoot()).toBe(true);
    settingsManager.set('fireRate', DEFAULT_SETTINGS.fireRate);

    weapon.dispose();
  });

  it('should stop firing when the magazine is empty', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const clock = { t: 0 };
    const weapon = makeWeapon(camera, clock);

    for (let i = 0; i < weapon.maxMagAmmo; i++) {
      expect(weapon.shoot()).toBe(true);
      clock.t += 100;
      weapon.update(0.1, false);
    }
    expect(weapon.magAmmo).toBe(0);
    expect(weapon.canShoot()).toBe(false);
    // Dry fire never consumes ammo
    expect(weapon.shoot()).toBe(false);
    expect(weapon.magAmmo).toBe(0);

    weapon.dispose();
  });

  it('should smoothly transition to and from the ADS pose', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const clock = { t: 0 };
    const weapon = makeWeapon(camera, clock);

    expect(weapon.getADSAmount()).toBe(0);
    expect(weapon.isADSActive()).toBe(false);
    const hipX = weapon.group.position.x;

    weapon.setADS(true);
    for (let i = 0; i < 60; i++) {
      weapon.update(1 / 60, false);
    }
    // Fully scoped: weapon pulled toward the screen center
    expect(weapon.getADSAmount()).toBeGreaterThan(0.99);
    expect(weapon.isADSActive()).toBe(true);
    expect(weapon.group.position.x).toBeLessThan(hipX * 0.6);
    expect(Math.abs(weapon.group.rotation.x)).toBeLessThan(0.001);

    weapon.setADS(false);
    for (let i = 0; i < 60; i++) {
      weapon.update(1 / 60, false);
    }
    expect(weapon.getADSAmount()).toBeLessThan(0.01);
    expect(weapon.isADSActive()).toBe(false);
    expect(weapon.group.position.x).toBeCloseTo(hipX, 4);

    weapon.dispose();
  });

  it('should keep the scoped view clear: lowered weapon + retracted scope assembly', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const clock = { t: 0 };
    const weapon = makeWeapon(camera, clock);

    weapon.setADS(true);
    for (let i = 0; i < 60; i++) {
      weapon.update(1 / 60, false);
    }
    camera.updateMatrixWorld(true);

    // The weapon body is lowered out of the optic ring area so it never blocks
    // the magnified view of the target
    expect(weapon.group.position.y).toBeLessThan(-0.1);
    expect(weapon.group.position.z).toBeLessThan(-0.2);

    // The 3D scope assembly retracts to zero at full zoom so the solid housing
    // caps cannot occlude the magnified world inside the CSS optic overlay
    expect(weapon.scopeAssembly.scale.x).toBeLessThan(0.05);

    // While transitioning the eyepiece still sits in front of the camera
    const lensPos = new THREE.Vector3();
    weapon.scopeLensRearMesh.getWorldPosition(lensPos);
    expect(lensPos.z).toBeLessThan(-0.2);

    // Unscoping restores the full physical scope model
    weapon.setADS(false);
    for (let i = 0; i < 60; i++) {
      weapon.update(1 / 60, false);
    }
    expect(weapon.scopeAssembly.scale.x).toBeGreaterThan(0.95);

    weapon.dispose();
  });

  it('should accumulate subtle muzzle climb while firing automatically and recover after', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const clock = { t: 0 };
    const weapon = makeWeapon(camera, clock);

    const restPitch = weapon.group.rotation.x;

    // Sustained automatic fire builds the climb (gun tilts nose-up)
    for (let i = 0; i < 15; i++) {
      clock.t += 100;
      weapon.shoot();
      weapon.update(0.06, false);
    }
    const pitchedUp = weapon.group.rotation.x - restPitch;
    expect(pitchedUp).toBeGreaterThan(0.02);

    // Letting go lets the climb settle back toward the rest pitch
    for (let i = 0; i < 90; i++) {
      weapon.update(1 / 60, false);
    }
    expect(weapon.group.rotation.x - restPitch).toBeLessThan(pitchedUp / 2);

    weapon.dispose();
  });
});

describe('TracerManager', () => {
  it('should spawn and animate bullet tracers toward hit target', () => {
    const tracers = new TracerManager();
    const start = new THREE.Vector3(0.2, 1.5, -0.4);
    const end = new THREE.Vector3(0, 1.5, -15);

    tracers.spawnTracer(start, end);
    tracers.update(0.02);
    tracers.clearAll();
  });
});

describe('Player Movement and Bounds', () => {
  it('should keep the player stationary and track mouse delta without input', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const player = new Player(camera);

    player.update(0.016);
    const delta = player.getLastMouseDelta();
    expect(delta).toBeDefined();
    expect(player.isMoving()).toBe(false);
    expect(player.position.x).toBe(0);
    expect(player.position.z).toBe(0);
  });

  it('should let the player leave the old firing zone when nothing blocks', () => {
    vi.spyOn(inputManager, 'getMovementVector').mockReturnValue({ x: 0, z: -1 });
    vi.spyOn(inputManager, 'consumeMouseDelta').mockReturnValue({ deltaX: 0, deltaY: 0 });
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const player = new Player(camera);

    for (let i = 0; i < 60; i++) player.update(0.1);

    // The old zone clamped at z = -1.0; the free player walks far beyond it
    expect(player.position.z).toBeLessThan(-10);
    expect(player.position.x).toBe(0);
    vi.restoreAllMocks();
  });

  it('should stop the player at arena geometry instead of a zone box', () => {
    vi.spyOn(inputManager, 'getMovementVector').mockReturnValue({ x: 0, z: -1 });
    vi.spyOn(inputManager, 'consumeMouseDelta').mockReturnValue({ deltaX: 0, deltaY: 0 });
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const player = new Player(camera, [{ minX: -10, maxX: 10, minZ: -3, maxZ: -2 }]);

    for (let i = 0; i < 40; i++) player.update(0.1);

    // Stopped exactly one radius away from the wall face (z=-2), not inside it
    expect(player.position.z).toBeCloseTo(-1.7, 5);
    expect(player.position.x).toBe(0);
    vi.restoreAllMocks();
  });
});

describe('Circle collision resolver', () => {
  it('should push the player out of a wall and cancel inward velocity', () => {
    const pos = { x: 0, z: -1.75 };
    const vel = { x: 0, z: -5 };
    resolveCircleCollisions(pos, vel, 0.3, [{ minX: -10, maxX: 10, minZ: -3, maxZ: -2 }]);
    expect(pos.z).toBeCloseTo(-1.7, 5);
    expect(vel.z).toBe(0);
  });

  it('should preserve sliding along a wall when moving diagonally', () => {
    const pos = { x: 0, z: -1.75 };
    const vel = { x: 5, z: -5 };
    resolveCircleCollisions(pos, vel, 0.3, [{ minX: -10, maxX: 10, minZ: -3, maxZ: -2 }]);
    expect(pos.z).toBeCloseTo(-1.7, 5);
    expect(pos.x).toBe(0);
    expect(vel.x).toBe(5);
    expect(vel.z).toBe(0);
  });

  it('should push the player out of a box corner along the smallest axis', () => {
    const pos = { x: 0.3, z: -0.3 };
    const vel = { x: 2, z: -2 };
    resolveCircleCollisions(pos, vel, 0.3, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }]);
    expect(Math.hypot(pos.x, pos.z)).toBeGreaterThanOrEqual(0.3);
    expect(pos.x).toBeGreaterThan(0.3 - 1e-9);
  });

  it('should leave the player untouched in an open gate between two walls', () => {
    const pos = { x: 0, z: -2 };
    const vel = { x: 0, z: -5 };
    resolveCircleCollisions(pos, vel, 0.3, [
      { minX: -10, maxX: -1, minZ: -10, maxZ: 10 },
      { minX: 1, maxX: 10, minZ: -10, maxZ: 10 },
    ]);
    expect(pos.x).toBe(0);
    expect(pos.z).toBe(-2);
    expect(vel.z).toBe(-5);
  });

  it('should recover a player spawned inside a collider', () => {
    const pos = { x: 0, z: 0 };
    const vel = null;
    resolveCircleCollisions(pos, vel, 0.3, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }]);
    const dist = Math.hypot(pos.x, pos.z);
    expect(dist).toBeGreaterThanOrEqual(0.3);
    expect(dist).toBeLessThan(1.5);
  });
});

describe('Arena colliders', () => {
  it('should keep the target lane volume free of colliders', () => {
    const colliders = buildArenaColliders();
    for (const c of colliders) {
      const overlapsLane = c.maxX > -7 && c.minX < 7 && c.maxZ > -27 && c.minZ < -7;
      expect(overlapsLane).toBe(false);
    }
  });

  it('should leave a walkable gate in the booth grill', () => {
    const colliders = buildArenaColliders();
    for (const c of colliders) {
      const blocksGate = c.maxX > -2.5 && c.minX < -0.25 && c.maxZ > -3.2 && c.minZ < -3.0;
      expect(blocksGate).toBe(false);
    }
  });

  it('should keep the gate corridor free of the firing bench', () => {
    const colliders = buildArenaColliders();
    for (const c of colliders) {
      const blocksCorridor = c.maxX > -2.4 && c.minX < -1.1 && c.maxZ > -2.3 && c.minZ < -1.2;
      expect(blocksCorridor).toBe(false);
    }
  });

  it('should block the player at walls and the closed door', () => {
    const colliders = buildArenaColliders();
    expect(colliders.some((c) => c.minX <= -16.7 && c.maxX >= 16.7 && c.maxZ >= 7)).toBe(true);
    expect(colliders.some((c) => c.minX <= -3.6 && c.maxX >= 3.6 && c.minZ >= 6.8 && c.maxZ <= 7.1)).toBe(true);
    expect(colliders.some((c) => c.minX <= -16.7 && c.maxX >= 16.7 && c.minZ <= -33 && c.maxZ >= -33.4)).toBe(true);
  });
});

describe('AimRaycaster with Humanoid Dummies', () => {
  it('should detect headshot when raycast intersects head mesh', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    camera.position.set(0, 1.55, 0); // Eye height aiming at head
    camera.lookAt(0, 1.55, -10);
    camera.updateMatrixWorld(true);

    const dummy = new Dummy();
    dummy.spawn(new THREE.Vector3(0, 0, -10));
    dummy.update(0.2); // Animate spawn scale to 1.0
    dummy.group.updateMatrixWorld(true);

    const raycaster = new AimRaycaster();
    const hits = raycaster.cast(camera, dummy.getHitboxMeshes());

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].object.userData.isHeadshot).toBe(true);
  });
});

describe('FlickMode with Humanoid Dummies', () => {
  it('should run countdown, spawn dummy, and record headshots and score', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const dummyManager = new DummyManager();
    const particleSystem = new ParticleSystem();

    const onStateChange = vi.fn();
    const onSessionComplete = vi.fn();

    const flick = new FlickMode(camera, dummyManager, particleSystem, {
      onStateChange,
      onSessionComplete,
    });

    flick.start();
    expect(flick.getState()).toBe('COUNTDOWN');

    // Advance 3.1s through countdown
    flick.update(3.1);
    expect(flick.getState()).toBe('RUNNING');
    expect(dummyManager.getCurrentFlickDummy()).not.toBeNull();

    // Aim at head & shoot
    const currentDummy = dummyManager.getCurrentFlickDummy()!;
    camera.position.set(0, 1.7, 0);
    camera.lookAt(currentDummy.group.position.x, 1.7, currentDummy.group.position.z);
    camera.updateMatrixWorld(true);
    currentDummy.group.updateMatrixWorld(true);

    const shotResult = flick.handleShoot();
    expect(shotResult).toBeDefined();

    // Advance to end of session
    flick.update(65);
    expect(flick.getState()).toBe('FINISHED');
    expect(onSessionComplete).toHaveBeenCalled();
  });

  it('should configure difficulty reaction windows', () => {
    expect(FLICK_DIFFICULTIES.easy.targetWindowMs).toBe(2000);
    expect(FLICK_DIFFICULTIES.normal.targetWindowMs).toBe(1200);
    expect(FLICK_DIFFICULTIES.hard.targetWindowMs).toBe(750);
    expect(FLICK_DIFFICULTIES.extreme.targetWindowMs).toBe(450);
    // Higher difficulty = shorter window
    expect(FLICK_DIFFICULTIES.easy.targetWindowMs).toBeGreaterThan(FLICK_DIFFICULTIES.normal.targetWindowMs);
    expect(FLICK_DIFFICULTIES.normal.targetWindowMs).toBeGreaterThan(FLICK_DIFFICULTIES.hard.targetWindowMs);
    expect(FLICK_DIFFICULTIES.hard.targetWindowMs).toBeGreaterThan(FLICK_DIFFICULTIES.extreme.targetWindowMs);
  });

  it('should teleport the target when its window expires (no hit granted)', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const dummyManager = new DummyManager();
    const particleSystem = new ParticleSystem();
    let lastMisses = -1;

    const flick = new FlickMode(camera, dummyManager, particleSystem, {
      onScoreUpdate: (_s, _h, _shots, _acc, _hs, misses) => {
        lastMisses = misses;
      },
    });
    flick.setDifficulty('hard'); // 750 ms window

    flick.start();
    flick.update(3.1); // countdown done, first target live
    const firstDummy = dummyManager.getCurrentFlickDummy();
    expect(firstDummy).not.toBeNull();

    // Rewind the target's spawn time past the window: it should expire
    const firstPos = firstDummy!.group.position.clone();
    firstDummy!.spawnTime = performance.now() - 800;
    flick.update(0.016);

    // The expired target is re-spawned immediately at a new position
    // (the same Dummy object is reused and reset by the next spawn)
    const newDummy = dummyManager.getCurrentFlickDummy();
    expect(newDummy).not.toBeNull(); // new target live
    expect(lastMisses).toBe(1); // counted toward session misses
    // New position is separated from the expired one (cannot memorize spots)
    expect(newDummy!.group.position.distanceTo(firstPos)).toBeGreaterThanOrEqual(GAME_CONFIG.TARGET_MIN_SEPARATION * 0.75);
    expect(newDummy!.group.visible).toBe(true);
  });

  it('should keep a target alive while its window has not expired', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const dummyManager = new DummyManager();
    const particleSystem = new ParticleSystem();

    const flick = new FlickMode(camera, dummyManager, particleSystem, {});
    flick.setDifficulty('easy'); // 2000 ms window
    flick.start();
    flick.update(3.1);

    const dummy = dummyManager.getCurrentFlickDummy()!;
    dummy.spawnTime = performance.now() - 500; // well inside the window
    flick.update(0.016);

    expect(dummy.isEliminated).toBe(false);
    expect(dummyManager.getCurrentFlickDummy()).toBe(dummy);
  });

  it('should delay the next flick target until the fallen dummy hits the ground', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const dummyManager = new DummyManager();
    const particleSystem = new ParticleSystem();

    const flick = new FlickMode(camera, dummyManager, particleSystem, {});
    flick.start();
    flick.update(3.1); // countdown done, first target live

    // Advance the spawn pop-in so the hitboxes are at full scale
    dummyManager.update(0.5);
    dummyManager.group.updateMatrixWorld(true);

    const target = dummyManager.getCurrentFlickDummy()!;
    const targetPos = target.group.position.clone();
    camera.position.set(0, 1.55, 0);
    camera.lookAt(targetPos.x, 1.55, targetPos.z);
    camera.updateMatrixWorld(true);
    target.group.updateMatrixWorld(true);

    const shot = flick.handleShoot();
    expect(shot.hit).toBe(true);

    // Immediately after the hit the falling dummy is not a live target
    expect(dummyManager.getCurrentFlickDummy()).toBeNull();

    // Still no new target while the dummy reacts and tips over (0.15s + 0.35s)
    flick.update(0.4);
    dummyManager.update(0.4);
    expect(dummyManager.getCurrentFlickDummy()).toBeNull();

    // The next target spawns when the fallen dummy reaches the ground (~0.5s)
    flick.update(0.2);
    dummyManager.update(0.2);
    const next = dummyManager.getCurrentFlickDummy();
    expect(next).not.toBeNull();
    // New position is separated from the fallen one (cannot memorize spots)
    expect(next!.group.position.distanceTo(targetPos)).toBeGreaterThanOrEqual(
      GAME_CONFIG.TARGET_MIN_SEPARATION * 0.75
    );
    expect(next!.isFallInProgress()).toBe(false);
  });
});

describe('PracticeMode Training Range', () => {
  it('should start running with range dummies visible and reset stats', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const dummyManager = new DummyManager();
    const particleSystem = new ParticleSystem();
    const onScoreUpdate = vi.fn();

    const practice = new PracticeMode(camera, dummyManager, particleSystem, { onScoreUpdate });

    practice.start();
    expect(practice.getState()).toBe('RUNNING');
    expect(onScoreUpdate).toHaveBeenCalledWith(0, 0, 0, 100, 0, 0);

    // Range dummies must be visible and hittable
    expect(dummyManager.getAllHitboxMeshes().length).toBeGreaterThan(10);
  });

  it('should score headshot hits higher than body hits', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    camera.position.set(0, 1.55, 0);
    camera.updateMatrixWorld(true);

    const dummyManager = new DummyManager();
    const particleSystem = new ParticleSystem();
    let lastScore = 0;

    const practice = new PracticeMode(camera, dummyManager, particleSystem, {
      onScoreUpdate: (score) => {
        lastScore = score;
      },
    });

    practice.start();

    // Animate spawn pop-in + patrol and update world matrices so hitboxes are live
    dummyManager.update(1.0);
    dummyManager.group.updateMatrixWorld(true);

    // Pin two dummies at fixed, non-occluding positions so the test is
    // deterministic regardless of random patrol phases (a hit eliminates a dummy)
    const dummies = dummyManager.getRangeDummies();
    const headDummy = dummies[0]; // left lane (z = -12)
    const bodyDummy = dummies[1]; // center lane (z = -10), pushed right
    headDummy.group.position.x = -4;
    bodyDummy.group.position.x = 4;
    dummyManager.group.updateMatrixWorld(true);

    // Headshot: aim at the first dummy's head world position
    const headPos = headDummy.getHeadWorldPosition();
    camera.lookAt(headPos);
    camera.updateMatrixWorld(true);

    const result = practice.handleShoot();
    expect(result.hit).toBe(true);
    expect(result.isHeadshot).toBe(true);
    expect(lastScore).toBe(PRACTICE_HEADSHOT_SCORE);

    // Body shot: aim at the other dummy's torso world position
    const torsoPos = bodyDummy.getBodyWorldPosition();
    camera.lookAt(torsoPos);
    camera.updateMatrixWorld(true);
    const bodyResult = practice.handleShoot();
    expect(bodyResult.hit).toBe(true);
    expect(bodyResult.isHeadshot).toBe(false);
    expect(lastScore).toBe(PRACTICE_HEADSHOT_SCORE + PRACTICE_BODY_SCORE);
  });

  it('should register a miss with no score when shooting into the void', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    camera.position.set(0, 1.7, 0);
    camera.lookAt(0, 1.7, 100);
    camera.updateMatrixWorld(true);

    const dummyManager = new DummyManager();
    const particleSystem = new ParticleSystem();
    let lastScore = 0;
    let lastShots = 0;

    const practice = new PracticeMode(camera, dummyManager, particleSystem, {
      onScoreUpdate: (score, _hits, shots) => {
        lastScore = score;
        lastShots = shots;
      },
    });

    practice.start();
    const result = practice.handleShoot();
    expect(result.hit).toBe(false);
    expect(lastScore).toBe(0);
    expect(lastShots).toBe(1);
  });

  it('should pause and resume without resetting score', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    const dummyManager = new DummyManager();
    const particleSystem = new ParticleSystem();
    const onStateChange = vi.fn();

    const practice = new PracticeMode(camera, dummyManager, particleSystem, { onStateChange });

    practice.start();
    practice.pause();
    expect(practice.getState()).toBe('PAUSED');

    // No shooting while paused
    const result = practice.handleShoot();
    expect(result.hit).toBe(false);

    practice.resume();
    expect(practice.getState()).toBe('RUNNING');
    expect(onStateChange).toHaveBeenCalledWith('RUNNING');
  });
});
