import * as THREE from 'three';
import { GAME_CONFIG } from '../config/constants';
import { audioManager } from '../core/AudioManager';
import { aimRaycaster } from '../core/Raycaster';
import { DummyManager } from '../entities/DummyManager';
import { ParticleSystem } from '../entities/ParticleSystem';
import { BaseTrainingMode, ModeState, ShotResult, TrainingModeEvents } from './TrainingMode';

export const PRACTICE_HEADSHOT_SCORE = 250;
export const PRACTICE_BODY_SCORE = GAME_CONFIG.BASE_SCORE_PER_HIT;

export class PracticeMode extends BaseTrainingMode {
  private camera: THREE.Camera;
  private dummyManager: DummyManager;
  private particleSystem: ParticleSystem;
  private events: TrainingModeEvents;

  private state: ModeState = 'IDLE';

  // Session Statistics
  private score: number = 0;
  private targetsHit: number = 0;
  private headshots: number = 0;
  private shotsFired: number = 0;

  constructor(
    camera: THREE.Camera,
    dummyManager: DummyManager,
    particleSystem: ParticleSystem,
    events: TrainingModeEvents = {}
  ) {
    super();
    this.camera = camera;
    this.dummyManager = dummyManager;
    this.particleSystem = particleSystem;
    this.events = events;
  }

  public start(): void {
    this.state = 'RUNNING';
    this.score = 0;
    this.targetsHit = 0;
    this.headshots = 0;
    this.shotsFired = 0;

    // Standing range dummies are the live practice targets
    this.dummyManager.showRangeDummies();
    this.dummyManager.clearFlickDummy();

    this.events.onStateChange?.(this.state);
    this.events.onScoreUpdate?.(0, 0, 0, 100, 0, 0);
  }

  public pause(): void {
    if (this.state === 'RUNNING') {
      this.state = 'PAUSED';
      this.events.onStateChange?.(this.state);
    }
  }

  public resume(): void {
    if (this.state === 'PAUSED') {
      this.state = 'RUNNING';
      this.events.onStateChange?.(this.state);
    }
  }

  public stop(): void {
    this.state = 'IDLE';
    this.dummyManager.showRangeDummies();
    this.dummyManager.clearFlickDummy();
    this.events.onStateChange?.(this.state);
  }

  public getState(): ModeState {
    return this.state;
  }

  public handleShoot(): ShotResult {
    const defaultPoint = new THREE.Vector3();
    this.camera.getWorldDirection(defaultPoint);
    defaultPoint.multiplyScalar(40).add(this.camera.position);

    if (this.state !== 'RUNNING') {
      return { hit: false, isHeadshot: false, point: defaultPoint };
    }

    this.shotsFired++;

    const hitboxes = this.dummyManager.getAllHitboxMeshes();
    const hits = aimRaycaster.cast(this.camera, hitboxes);

    if (hits.length > 0) {
      const hit = hits[0];
      const isHeadshot = !!hit.object.userData.isHeadshot;
      const dummy = hit.object.userData.dummy;

      this.targetsHit++;
      if (isHeadshot) {
        this.headshots++;
      }

      // Headshot scores more than a body hit
      const points = isHeadshot ? PRACTICE_HEADSHOT_SCORE : PRACTICE_BODY_SCORE;
      this.score += points;

      if (dummy) {
        dummy.triggerHit(isHeadshot);
      }

      if (isHeadshot) {
        audioManager.playHeadshot();
        this.particleSystem.emitBurst(hit.point, 24, 0xffea00); // Gold headshot burst
      } else {
        audioManager.playBodyHit();
        this.particleSystem.emitBurst(hit.point, 16, 0xff4655); // Coral body burst
      }

      this.events.onHitFeedback?.(null, isHeadshot);

      const accuracy = (this.targetsHit / this.shotsFired) * 100;
      this.events.onScoreUpdate?.(this.score, this.targetsHit, this.shotsFired, accuracy, this.headshots, 0);

      return { hit: true, isHeadshot, point: hit.point, dummy };
    }

    // Missed shot
    audioManager.playMiss();
    const accuracy = (this.targetsHit / this.shotsFired) * 100;
    this.events.onScoreUpdate?.(this.score, this.targetsHit, this.shotsFired, accuracy, this.headshots, 0);
    return { hit: false, isHeadshot: false, point: defaultPoint };
  }

  public update(_deltaTime: number): void {
    // Free practice has no timer or dynamic spawn logic
  }
}