export const GAME_CONFIG = {
  // Arena dimensions
  ARENA_WIDTH: 30,
  ARENA_HEIGHT: 12,
  ARENA_DEPTH: 36,

  // Player defaults
  PLAYER_SPEED: 8.0,
  PLAYER_ACCEL: 25.0,
  PLAYER_FRICTION: 12.0,
  PLAYER_HEIGHT: 1.7,
  PLAYER_RADIUS: 0.3,

  // Shooting platform (the designated firing zone)
  PLATFORM_X_MIN: -3.2,
  PLATFORM_X_MAX: 3.2,
  PLATFORM_Z_FRONT: -1.6,
  PLATFORM_Z_BACK: 2.0,
  PLATFORM_HEIGHT: 0.15,

  // Target spawn area (in front of player)
  TARGET_SPAWN_X_MIN: -6.0,
  TARGET_SPAWN_X_MAX: 6.0,
  TARGET_SPAWN_Y_MIN: 1.0,
  TARGET_SPAWN_Y_MAX: 3.8,
  TARGET_SPAWN_Z_MIN: -14.0,
  TARGET_SPAWN_Z_MAX: -8.0,
  TARGET_MIN_SEPARATION: 3.0,

  // Scoring
  BASE_SCORE_PER_HIT: 100,
  MAX_REACTION_BONUS: 200,
  REACTION_TIME_THRESHOLD_FAST: 200, // ms
  REACTION_TIME_THRESHOLD_SLOW: 800, // ms

  // Graphics & Performance (Optimized for integrated GPUs like AMD Vega 7)
  MAX_PIXEL_RATIO: 1.5,
  SHADOWS_ENABLED: false, // Keep shadows disabled for lightweight 100+ FPS on iGPUs
  TARGET_SEGMENTS: 24, // Optimized sphere geometry
} as const;

/**
 * Flick Training difficulties.
 * Higher difficulty = shorter window to hit the target before it teleports.
 */
export type FlickDifficulty = 'easy' | 'normal' | 'hard' | 'extreme';

export interface FlickDifficultyConfig {
  label: string;
  targetWindowMs: number;
  description: string;
}

export const FLICK_DIFFICULTIES: Record<FlickDifficulty, FlickDifficultyConfig> = {
  easy: { label: 'EASY', targetWindowMs: 2000, description: 'Long reaction window' },
  normal: { label: 'NORMAL', targetWindowMs: 1200, description: 'Medium reaction window' },
  hard: { label: 'HARD', targetWindowMs: 750, description: 'Short reaction window' },
  extreme: { label: 'EXTREME', targetWindowMs: 450, description: 'Very short reaction window' },
};

export const DEFAULT_FLICK_DIFFICULTY: FlickDifficulty = 'normal';

export type CrosshairStyle = 'cross' | 'dot' | 'plus' | 'circle-dot';

export interface GameSettings {
  mouseSensitivity: number;
  fov: number;
  sessionDuration: number;
  crosshairStyle: CrosshairStyle;
  crosshairColor: string;
  crosshairSize: number;
  crosshairGap: number;
  crosshairThickness: number;
  masterVolume: number;
  adsSensitivityMultiplier: number;
  adsZoomStrength: number;
  fireRate: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  fov: 90,
  sessionDuration: 60,
  crosshairStyle: 'cross',
  crosshairColor: '#00ffff',
  crosshairSize: 12,
  crosshairGap: 4,
  crosshairThickness: 2,
  masterVolume: 70,
  adsSensitivityMultiplier: 0.5,
  adsZoomStrength: 0.5,
  fireRate: 700,
};
