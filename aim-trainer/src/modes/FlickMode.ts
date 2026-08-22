import * as THREE from 'three';
import { DEFAULT_FLICK_DIFFICULTY, FLICK_DIFFICULTIES, FlickDifficulty, GAME_CONFIG } from '../config/constants';
import { settingsManager } from '../config/settings';
import { audioManager } from '../core/AudioManager';
import { aimRaycaster } from '../core/Raycaster';
import type { Dummy } from '../entities/Dummy';
import { DummyManager } from '../entities/DummyManager';
import { ParticleSystem } from '../entities/ParticleSystem';
import { BaseTrainingMode, ModeState, SessionStats, ShotResult, TrainingModeEvents } from './TrainingMode';

export class FlickMode extends BaseTrainingMode {
  private camera: THREE.Camera;
  private dummyManager: DummyManager;
  private particleSystem: ParticleSystem;
  private events: TrainingModeEvents;

  private state: ModeState = 'IDLE';
  private prePauseState: ModeState = 'IDLE';
  private totalDuration: number = 60;
  private timeRemaining: number = 60;
  private countdownTimer: number = 0;
  private lastCountdownInt: number = 0;

  // Difficulty: higher difficulty = less time to hit the target
  private difficulty: FlickDifficulty = DEFAULT_FLICK_DIFFICULTY;

  // Session Statistics
  private score: number = 0;
  private targetsHit: number = 0;
  private targetsMissed: number = 0;
  private headshots: number = 0;
  private shotsFired: number = 0;
  private reactionTimes: number[] = [];

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

    this.totalDuration = settingsManager.get('sessionDuration');
  }

  public setDifficulty(difficulty: FlickDifficulty): void {
    this.difficulty = difficulty;
  }

  public getDifficulty(): FlickDifficulty {
    return this.difficulty;
  }

  public getTargetWindowMs(): number {
    return FLICK_DIFFICULTIES[this.difficulty].targetWindowMs;
  }

  public start(): void {
    console.log('[CYBER AIM] Transition: -> COUNTDOWN');
    this.totalDuration = settingsManager.get('sessionDuration');
    this.timeRemaining = this.totalDuration;
    this.score = 0;
    this.targetsHit = 0;
    this.targetsMissed = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.reactionTimes = [];

    // Hide ambient range dummies and prepare flick dummy
    this.dummyManager.hideRangeDummies();
    this.dummyManager.clearFlickDummy();

    this.state = 'COUNTDOWN';
    this.countdownTimer = 3.0;
    this.lastCountdownInt = 3;

    audioManager.playCountdown(false);
    this.events.onCountdownTick?.('3');
    this.events.onStateChange?.(this.state);
    this.events.onScoreUpdate?.(0, 0, 0, 100, 0, 0);
    this.events.onTimeUpdate?.(this.totalDuration, this.totalDuration);
  }

  public pause(): void {
    if (this.state === 'RUNNING' || this.state === 'COUNTDOWN') {
      console.log(`[CYBER AIM] Transition: ${this.state} -> PAUSED`);
      this.prePauseState = this.state;
      this.state = 'PAUSED';
      this.events.onStateChange?.(this.state);
    }
  }

  public resume(): void {
    if (this.state === 'PAUSED') {
      const nextState = this.prePauseState === 'COUNTDOWN' ? 'COUNTDOWN' : 'RUNNING';
      console.log(`[CYBER AIM] Transition: PAUSED -> ${nextState}`);
      this.state = nextState;
      this.events.onStateChange?.(this.state);
    }
  }

  public stop(): void {
    console.log(`[CYBER AIM] Transition: ${this.state} -> IDLE`);
    this.state = 'IDLE';
    this.events.onCountdownTick?.(null);
    this.dummyManager.clearFlickDummy();
    this.dummyManager.showRangeDummies();
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

    const flickDummy = this.dummyManager.getCurrentFlickDummy();
    if (!flickDummy) {
      audioManager.playMiss();
      return { hit: false, isHeadshot: false, point: defaultPoint };
    }

    const hitboxes = flickDummy.getHitboxMeshes();
    const hits = aimRaycaster.cast(this.camera, hitboxes);

    if (hits.length > 0) {
      const hit = hits[0];
      const isHeadshot = !!hit.object.userData.isHeadshot;
      const reactionTimeMs = Math.round(performance.now() - flickDummy.spawnTime);

      this.reactionTimes.push(reactionTimeMs);
      this.targetsHit++;
      if (isHeadshot) {
        this.headshots++;
      }

      // Calculate score (Headshot = 250 base, Body = 100 base + speed bonus)
      const basePoints = isHeadshot ? 250 : GAME_CONFIG.BASE_SCORE_PER_HIT;
      const speedBonus = this.calculateSpeedBonus(reactionTimeMs);
      this.score += basePoints + speedBonus;

      // Audio & Particle feedback
      if (isHeadshot) {
        audioManager.playHeadshot();
        this.particleSystem.emitBurst(hit.point, 24, 0xffea00); // Gold spark burst
      } else {
        audioManager.playBodyHit();
        this.particleSystem.emitBurst(hit.point, 16, 0xff4655); // Coral burst
      }

      // Dummy reaction + knock-down fall animation
      flickDummy.triggerHit(isHeadshot);

      // The next target spawns only once the fallen dummy reaches the ground,
      // so it never visually overlaps the fall. Difficulty timing is untouched.
      flickDummy.onFallReachedGround = () => {
        if (this.state === 'RUNNING') {
          this.dummyManager.spawnNextFlickDummy();
        }
      };

      // Trigger UI feedback
      this.events.onHitFeedback?.(reactionTimeMs, isHeadshot);

      const accuracy = this.shotsFired > 0 ? (this.targetsHit / this.shotsFired) * 100 : 100;
      this.events.onScoreUpdate?.(this.score, this.targetsHit, this.shotsFired, accuracy, this.headshots, this.targetsMissed);

      return { hit: true, isHeadshot, point: hit.point, dummy: flickDummy };
    } else {
      // Missed shot
      audioManager.playMiss();
      const accuracy = this.shotsFired > 0 ? (this.targetsHit / this.shotsFired) * 100 : 100;
      this.events.onScoreUpdate?.(this.score, this.targetsHit, this.shotsFired, accuracy, this.headshots, this.targetsMissed);
      return { hit: false, isHeadshot: false, point: defaultPoint };
    }
  }

  public update(deltaTime: number): void {
    if (this.state === 'COUNTDOWN') {
      this.countdownTimer -= deltaTime;
      const currentInt = Math.ceil(this.countdownTimer);

      if (currentInt !== this.lastCountdownInt && currentInt > 0) {
        this.lastCountdownInt = currentInt;
        audioManager.playCountdown(false);
        this.events.onCountdownTick?.(currentInt.toString());
      }

      if (this.countdownTimer <= 0) {
        console.log('[CYBER AIM] Transition: COUNTDOWN -> RUNNING');
        this.state = 'RUNNING';
        audioManager.playCountdown(true);
        this.events.onCountdownTick?.('START!');
        setTimeout(() => {
          if (this.state === 'RUNNING') {
            this.events.onCountdownTick?.(null);
          }
        }, 600);

        this.dummyManager.spawnNextFlickDummy();
        this.events.onTargetWindowUpdate?.(this.getTargetWindowMs(), this.getTargetWindowMs());
        this.events.onStateChange?.(this.state);
      }
      return;
    }

    if (this.state === 'RUNNING') {
      this.timeRemaining = Math.max(0, this.timeRemaining - deltaTime);
      this.events.onTimeUpdate?.(this.timeRemaining, this.totalDuration);

      // Target reaction window: shoot before the target disappears
      const flickDummy = this.dummyManager.getCurrentFlickDummy();
      if (flickDummy) {
        const windowMs = this.getTargetWindowMs();
        const remainingMs = Math.max(0, windowMs - (performance.now() - flickDummy.spawnTime));
        this.events.onTargetWindowUpdate?.(remainingMs, windowMs);

        if (remainingMs <= 0) {
          this.expireTarget(flickDummy);
        }
      }

      if (this.timeRemaining <= 0) {
        this.finishSession();
      }
    }
  }

  /**
   * Target window expired without being hit:
   * - Deactivate the old target (no hit is granted)
   * - Count it toward session misses
   * - Play a subtle expired feedback
   * - Immediately spawn the next target at a new valid position
   */
  private expireTarget(dummy: Dummy): void {
    this.targetsMissed++;
    audioManager.playMiss();

    dummy.despawn();
    this.dummyManager.spawnNextFlickDummy();

    const accuracy = this.shotsFired > 0 ? (this.targetsHit / this.shotsFired) * 100 : 100;
    this.events.onScoreUpdate?.(this.score, this.targetsHit, this.shotsFired, accuracy, this.headshots, this.targetsMissed);
    this.events.onTargetWindowUpdate?.(this.getTargetWindowMs(), this.getTargetWindowMs());
  }

  private calculateSpeedBonus(reactionTimeMs: number): number {
    const { REACTION_TIME_THRESHOLD_FAST: fast, REACTION_TIME_THRESHOLD_SLOW: slow, MAX_REACTION_BONUS: maxBonus } = GAME_CONFIG;

    if (reactionTimeMs <= fast) return maxBonus;
    if (reactionTimeMs >= slow) return 0;

    const ratio = 1 - (reactionTimeMs - fast) / (slow - fast);
    return Math.round(ratio * maxBonus);
  }

  private finishSession(): void {
    console.log('[CYBER AIM] Transition: RUNNING -> FINISHED');
    this.state = 'FINISHED';
    this.events.onCountdownTick?.(null);
    this.dummyManager.clearFlickDummy();
    this.dummyManager.showRangeDummies();
    audioManager.playVictory();

    const accuracy = this.shotsFired > 0 ? (this.targetsHit / this.shotsFired) * 100 : 0;
    const avgReactionTimeMs = this.reactionTimes.length > 0
      ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length)
      : 0;
    const bestReactionTimeMs = this.reactionTimes.length > 0
      ? Math.min(...this.reactionTimes)
      : 0;

    const elapsedMin = this.totalDuration / 60;
    const targetsPerMinute = Number((this.targetsHit / elapsedMin).toFixed(1));

    const { grade, label } = this.calculateRank(this.score, accuracy, avgReactionTimeMs, this.headshots);

    const stats: SessionStats = {
      score: this.score,
      targetsHit: this.targetsHit,
      targetsMissed: this.targetsMissed,
      headshots: this.headshots,
      shotsFired: this.shotsFired,
      accuracy: Number(accuracy.toFixed(1)),
      avgReactionTimeMs,
      bestReactionTimeMs,
      targetsPerMinute,
      durationSeconds: this.totalDuration,
      rankGrade: grade,
      rankLabel: label,
    };

    this.events.onStateChange?.(this.state);
    this.events.onSessionComplete?.(stats);
  }

  private calculateRank(score: number, accuracy: number, avgRt: number, headshots: number): { grade: 'S' | 'A' | 'B' | 'C' | 'D'; label: string } {
    if (this.targetsHit >= 40 && accuracy >= 85 && avgRt > 0 && avgRt <= 320 && headshots >= 15) {
      return { grade: 'S', label: 'IMMORTAL MARKSMAN' };
    }
    if (this.targetsHit >= 28 && accuracy >= 75 && avgRt <= 420 && score >= 5000) {
      return { grade: 'A', label: 'ELITE DUELIST' };
    }
    if (this.targetsHit >= 16 && accuracy >= 60 && score >= 2500) {
      return { grade: 'B', label: 'ADEPT SHOOTER' };
    }
    if (this.targetsHit >= 8) {
      return { grade: 'C', label: 'RANGE OPERATOR' };
    }
    return { grade: 'D', label: 'RECRUIT' };
  }
}
