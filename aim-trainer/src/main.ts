import * as THREE from 'three';
import { FLICK_DIFFICULTIES, FlickDifficulty } from './config/constants';
import { settingsManager } from './config/settings';
import { audioManager } from './core/AudioManager';
import { Engine } from './core/Engine';
import { inputManager } from './core/InputManager';
import { Arena } from './entities/Arena';
import { buildArenaColliders } from './entities/ArenaColliders';
import { DummyManager } from './entities/DummyManager';
import { ParticleSystem } from './entities/ParticleSystem';
import { Player } from './entities/Player';
import { TracerManager } from './entities/TracerManager';
import { Weapon } from './entities/Weapon';
import { FlickMode } from './modes/FlickMode';
import { PracticeMode } from './modes/PracticeMode';
import { BaseTrainingMode, ModeState } from './modes/TrainingMode';
import { TouchControls } from './ui/TouchControls';
import { UIManager } from './ui/UIManager';

class AimTrainerApp {
  private engine: Engine;
  private arena: Arena;
  private particleSystem: ParticleSystem;
  private dummyManager: DummyManager;
  private tracerManager: TracerManager;
  private player: Player;
  private weapon: Weapon;
  private practiceMode: PracticeMode;
  private flickMode: FlickMode;
  private uiManager: UIManager;

  /** On-screen controls for touch devices; null on desktop. */
  private touchControls: TouchControls | null = null;

  /** The mode currently receiving shoot/update events, or null when in menu */
  private activeMode: BaseTrainingMode | null = null;

  /** Left-button armed state for automatic fire (cleared on release or reload) */
  private fireQueued: boolean = false;

  constructor() {
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) throw new Error('Canvas container #canvas-container not found');

    // 1. Initialize Engine
    this.engine = new Engine(canvasContainer);

    // CRITICAL for Three.js: Add camera to scene so camera-child objects (the first-person weapon) are rendered!
    this.engine.scene.add(this.engine.camera);

    // 2. Initialize 3D Entities
    this.arena = new Arena();
    this.engine.scene.add(this.arena.group);

    this.particleSystem = new ParticleSystem();
    this.engine.scene.add(this.particleSystem.group);

    this.tracerManager = new TracerManager();
    this.engine.scene.add(this.tracerManager.group);

    this.dummyManager = new DummyManager();
    this.engine.scene.add(this.dummyManager.group);

    this.player = new Player(this.engine.camera, buildArenaColliders());

    // 3. Initialize First-Person Weapon (attached as child to camera)
    this.weapon = new Weapon(this.engine.camera);

    // 4. Attach Input to Canvas
    inputManager.attach(this.engine.getCanvas());

    // 4b. On-screen touch controls (movement joystick) on coarse-pointer devices
    if (TouchControls.isTouchDevice()) {
      this.touchControls = new TouchControls({
        onRequestReload: () => this.reloadWeapon(),
        onRequestPause: () => this.requestPause(),
      });
    }

    // 5. Initialize UI Manager
    this.uiManager = new UIManager({
      onStartRange: () => this.startRangeSession(),
      onStartFlick: (difficulty) => this.startFlickSession(difficulty),
      onRetrySession: () => this.startFlickSession(this.flickMode.getDifficulty()),
      onReturnToMenu: () => this.returnToMenu(),
      onResumeSession: () => this.resumeSession(),
    });

    // 6. Initialize Training Modes
    this.practiceMode = new PracticeMode(
      this.engine.camera,
      this.dummyManager,
      this.particleSystem,
      {
        onStateChange: (state) => this.handleModeStateChange(state),
        onScoreUpdate: (score, hits, shots, accuracy, headshots) => {
          this.uiManager.hud.updateScore(score, hits, shots, accuracy, headshots);
        },
        onHitFeedback: (reactionTimeMs, isHeadshot) => {
          this.uiManager.hud.showHitFeedback(reactionTimeMs, isHeadshot);
        },
      }
    );

    this.flickMode = new FlickMode(
      this.engine.camera,
      this.dummyManager,
      this.particleSystem,
      {
        onStateChange: (state) => this.handleModeStateChange(state),
        onCountdownTick: (text) => {
          this.uiManager.hud.showCountdown(text);
        },
        onTimeUpdate: (remaining, total) => {
          this.uiManager.hud.updateTimer(remaining, total);
        },
        onScoreUpdate: (score, hits, shots, accuracy, headshots, misses) => {
          this.uiManager.hud.updateScore(score, hits, shots, accuracy, headshots, misses);
        },
        onTargetWindowUpdate: (remainingMs, totalMs) => {
          this.uiManager.hud.updateTargetWindow(remainingMs, totalMs);
        },
        onHitFeedback: (reactionTimeMs, isHeadshot) => {
          this.uiManager.hud.showHitFeedback(reactionTimeMs, isHeadshot);
        },
        onSessionComplete: (stats) => {
          inputManager.setInputEnabled(false);
          inputManager.exitLock();
          this.touchControls?.setVisible(false);
          this.uiManager.showResults(stats);
        },
      }
    );

    // 7. Keyboard Controls: R for Reload, Escape for Pause
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') {
        this.reloadWeapon();
      } else if (e.code === 'Escape') {
        this.requestPause();
      }
    });

    // 8. Connect Engine Game Loop
    this.engine.onUpdate((deltaTime) => {
      // Only accept look/movement input while a session is live (not in menu or paused)
      const inSession = this.activeMode !== null && this.activeMode.getState() !== 'PAUSED';
      if (inSession) {
        this.player.update(deltaTime);
      }

      // Aim down sights: right mouse button scopes in while a session is live
      this.weapon.setADS(inSession && inputManager.isADS());
      this.engine.setZoom(this.weapon.getADSAmount());
      this.uiManager.hud.crosshair.setADS(this.weapon.isADSActive());
      this.uiManager.hud.scopeOverlay.setADS(this.weapon.isADSActive());

      // Automatic fire: hold left mouse to keep firing at the configured rate.
      // The first shot fires immediately on press (even if the press is shorter
      // than one frame); holding continues the cadence.
      if (inputManager.consumeFirePressed()) {
        if (this.weapon.magAmmo === 0 && !this.weapon.isReloading) {
          audioManager.playDryFire();
        }
        this.fireQueued = true;
        if (inSession && this.weapon.canShoot()) {
          this.handlePlayerFire();
        }
      }
      // Require a release (or reload) to re-arm the trigger
      if (!inputManager.isFireHeld() || this.weapon.isReloading) {
        this.fireQueued = false;
      }
      if (this.fireQueued && inputManager.isFireHeld() && inSession && this.weapon.canShoot()) {
        this.handlePlayerFire();
      }

      // Weapon procedural sway & movement bobbing
      const mouseDelta = this.player.getLastMouseDelta();
      this.weapon.applyMouseSway(mouseDelta.deltaX, mouseDelta.deltaY);
      this.weapon.update(deltaTime, this.player.isMoving());

      // Update Tracers, Dummies, Particles, Active Mode
      this.tracerManager.update(deltaTime);
      this.dummyManager.update(deltaTime);
      this.particleSystem.update(deltaTime);
      this.activeMode?.update(deltaTime);

      // Keep HUD Ammo Display synchronized
      this.uiManager.hud.updateAmmo(
        this.weapon.magAmmo,
        this.weapon.reserveAmmo,
        this.weapon.isReloading
      );
    });

    // 10. Connect FPS Monitor
    this.engine.onFPSUpdate((fps, frameTimeMs) => {
      this.uiManager.hud.updateFPS(fps, frameTimeMs);
    });

    // 11. Start Engine & show Main Menu
    this.engine.start();
    this.uiManager.showMainMenu();

    // Opt-in diagnostics (nothing exposed without ?debug=1 in the URL)
    if (new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as Record<string, unknown>).__debug = {
        engine: this.engine,
        camera: this.engine.camera,
        renderer: this.engine.renderer,
        player: this.player,
        dummyManager: this.dummyManager,
        weapon: this.weapon,
        getActiveMode: () => this.activeMode,
        getFireGate: () => ({
          fireQueued: this.fireQueued,
          fireHeld: inputManager.isFireHeld(),
          adsHeld: inputManager.isADS(),
          reloading: this.weapon.isReloading,
          cooldown: this.weapon.isOnCooldown(),
          mag: this.weapon.magAmmo,
          inSession: this.activeMode !== null && this.activeMode.getState() !== 'PAUSED',
          modeState: this.activeMode?.getState(),
          gameTime: this.engine.getElapsedTime(),
        }),
      };
    }
  }

  private handleModeStateChange(state: ModeState): void {
    if (state === 'PAUSED') {
      inputManager.setInputEnabled(false);
      this.touchControls?.setVisible(false);
      this.uiManager.hud.showPause(true);
      this.uiManager.markPauseOverlayShown();
    } else {
      inputManager.setInputEnabled(true);
      this.uiManager.hud.showPause(false);
    }
  }

  /** Shared reload path for the R key and the touch reload button. */
  private reloadWeapon(): void {
    if (this.weapon.reload()) {
      this.uiManager.hud.updateAmmo(this.weapon.magAmmo, this.weapon.reserveAmmo, true);
    }
  }

  /** Shared pause/resume toggle for Escape and the touch pause button. */
  private requestPause(): void {
    const modeState = this.activeMode?.getState();
    if (modeState === 'RUNNING' || modeState === 'COUNTDOWN') {
      this.activeMode?.pause();
      inputManager.exitLock();
    } else if (modeState === 'PAUSED') {
      this.resumeSession();
    }
  }

  private handlePlayerFire(): void {
    if (!this.weapon.canShoot()) {
      if (this.weapon.magAmmo === 0) {
        audioManager.playDryFire();
      }
      return;
    }

    // 1. Fire Weapon (Decrements ammo, triggers recoil, muzzle flash, smoke, gunshot sound)
    const fired = this.weapon.shoot();
    if (!fired) return;

    this.uiManager.hud.updateAmmo(this.weapon.magAmmo, this.weapon.reserveAmmo, false);

    // 2. Compute World Muzzle Point for bullet tracer streak
    const muzzlePos = this.weapon.getMuzzleWorldPosition();

    // 3. Check Hit Detection against the active mode
    const activeMode = this.activeMode;
    if (!activeMode || activeMode.getState() !== 'RUNNING') {
      const forward = new THREE.Vector3();
      this.engine.camera.getWorldDirection(forward);
      const endPos = new THREE.Vector3().copy(this.engine.camera.position).addScaledVector(forward, 45);
      this.tracerManager.spawnTracer(muzzlePos, endPos);
      return;
    }

    const result = activeMode.handleShoot();

    if (result.hit) {
      this.tracerManager.spawnTracer(muzzlePos, result.point);
    } else {
      this.uiManager.hud.crosshair.triggerMissmarker();
      this.tracerManager.spawnTracer(muzzlePos, result.point);
    }
  }

  private startRangeSession(): void {
    this.startMode(this.practiceMode);
    this.uiManager.hud.setModeLabel('range');
    this.uiManager.showHUD();
  }

  private startFlickSession(difficulty?: FlickDifficulty): void {
    if (difficulty) {
      this.flickMode.setDifficulty(difficulty);
    }
    this.startMode(this.flickMode);
    this.uiManager.hud.setModeLabel('flick', FLICK_DIFFICULTIES[this.flickMode.getDifficulty()].label);
    this.uiManager.showHUD();
  }

  private startMode(mode: BaseTrainingMode): void {
    this.practiceMode.stop();
    this.flickMode.stop();

    const duration = settingsManager.get('sessionDuration');
    this.player.reset();
    this.weapon.reset();
    this.uiManager.hud.reset(duration);
    this.activeMode = mode;
    inputManager.setInputEnabled(true);
    inputManager.requestLock();
    this.touchControls?.setVisible(true);
    mode.start();
  }

  private resumeSession(): void {
    this.activeMode?.resume();
    inputManager.requestLock();
    this.touchControls?.setVisible(true);
  }

  private returnToMenu(): void {
    this.practiceMode.stop();
    this.flickMode.stop();
    this.activeMode = null;
    this.weapon.reset();
    inputManager.setInputEnabled(false);
    inputManager.exitLock();
    this.touchControls?.setVisible(false);
    this.uiManager.showMainMenu();
  }
}

// Bootstrap on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  new AimTrainerApp();
});
