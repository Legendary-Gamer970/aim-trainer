import * as THREE from 'three';
import type { Dummy } from '../entities/Dummy';

export interface SessionStats {
  score: number;
  targetsHit: number;
  targetsMissed: number;
  headshots: number;
  shotsFired: number;
  accuracy: number;
  avgReactionTimeMs: number;
  bestReactionTimeMs: number;
  targetsPerMinute: number;
  durationSeconds: number;
  rankGrade: 'S' | 'A' | 'B' | 'C' | 'D';
  rankLabel: string;
}

export type ModeState = 'IDLE' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export interface ShotResult {
  hit: boolean;
  isHeadshot: boolean;
  point: THREE.Vector3;
  dummy?: Dummy;
}

export interface TrainingModeEvents {
  onStateChange?: (state: ModeState) => void;
  onCountdownTick?: (text: string | null) => void;
  onTimeUpdate?: (timeRemaining: number, totalTime: number) => void;
  onScoreUpdate?: (score: number, hits: number, shots: number, accuracy: number, headshots: number, misses: number) => void;
  onHitFeedback?: (reactionTimeMs: number | null, isHeadshot: boolean) => void;
  onTargetWindowUpdate?: (remainingMs: number, totalMs: number) => void;
  onSessionComplete?: (stats: SessionStats) => void;
}

export abstract class BaseTrainingMode {
  public abstract start(): void;
  public abstract pause(): void;
  public abstract resume(): void;
  public abstract stop(): void;
  public abstract handleShoot(): ShotResult;
  public abstract update(deltaTime: number): void;
  public abstract getState(): ModeState;
}
