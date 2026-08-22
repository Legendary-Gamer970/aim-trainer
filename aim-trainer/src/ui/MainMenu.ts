import { DEFAULT_FLICK_DIFFICULTY, FLICK_DIFFICULTIES, FlickDifficulty } from '../config/constants';
import { settingsManager } from '../config/settings';

export interface MainMenuCallbacks {
  onStartRange: () => void;
  onStartFlick: (difficulty: FlickDifficulty) => void;
  onOpenSettings: () => void;
}

export class MainMenu {
  private durationBadge: HTMLElement;
  private difficulty: FlickDifficulty = DEFAULT_FLICK_DIFFICULTY;
  private difficultyGroup: HTMLElement;

  constructor(callbacks: MainMenuCallbacks) {
    const btnStartRange = document.getElementById('btn-start-range');
    const btnStartFlick = document.getElementById('btn-start-flick');
    const btnSettings = document.getElementById('btn-settings');
    this.durationBadge = document.getElementById('menu-duration-badge')!;
    this.difficultyGroup = document.getElementById('flick-difficulty-group')!;

    btnStartRange?.addEventListener('click', () => callbacks.onStartRange());
    btnStartFlick?.addEventListener('click', () => callbacks.onStartFlick(this.difficulty));
    btnSettings?.addEventListener('click', () => callbacks.onOpenSettings());

    // Difficulty selection: higher difficulty = less time to hit each target
    this.difficultyGroup.querySelectorAll('.btn-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.getAttribute('data-value') as FlickDifficulty | null;
        if (value && FLICK_DIFFICULTIES[value]) {
          this.difficulty = value;
          this.difficultyGroup.querySelectorAll('.btn-pill').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    // Update duration badge on settings change
    settingsManager.subscribe((settings) => {
      if (this.durationBadge) {
        this.durationBadge.textContent = `${settings.sessionDuration} SECONDS`;
      }
    });
  }
}