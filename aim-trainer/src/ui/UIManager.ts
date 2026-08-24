import { FlickDifficulty } from '../config/constants';
import { SessionStats } from '../modes/TrainingMode';
import { HUD } from './HUD';
import { MainMenu } from './MainMenu';
import { ResultsScreen } from './ResultsScreen';
import { SettingsMenu } from './SettingsMenu';

export interface UIAppCallbacks {
  onStartRange: () => void;
  onStartFlick: (difficulty: FlickDifficulty) => void;
  onRetrySession: () => void;
  onReturnToMenu: () => void;
  onResumeSession: () => void;
}

export class UIManager {
  private mainMenuEl: HTMLElement;
  private hudEl: HTMLElement;
  private resultsEl: HTMLElement;
  private settingsModalEl: HTMLElement;
  private pauseOverlay: HTMLElement;

  // Guards against the tap on the pause button instantly resuming: the
  // tap's click can land on the overlay that appears mid-tap
  private pauseShownAt: number = -Infinity;

  public hud: HUD;
  public mainMenu: MainMenu;
  public resultsScreen: ResultsScreen;
  public settingsMenu: SettingsMenu;

  constructor(callbacks: UIAppCallbacks) {
    this.mainMenuEl = document.getElementById('main-menu')!;
    this.hudEl = document.getElementById('game-hud')!;
    this.resultsEl = document.getElementById('results-screen')!;
    this.settingsModalEl = document.getElementById('settings-modal')!;
    this.pauseOverlay = document.getElementById('pause-overlay')!;

    this.hud = new HUD();

    this.mainMenu = new MainMenu({
      onStartRange: callbacks.onStartRange,
      onStartFlick: callbacks.onStartFlick,
      onOpenSettings: () => this.openSettings(),
    });

    this.resultsScreen = new ResultsScreen({
      onRetry: callbacks.onRetrySession,
      onMenu: callbacks.onReturnToMenu,
    });

    this.settingsMenu = new SettingsMenu({
      onClose: () => this.closeSettings(),
    });

    // Pause overlay buttons & background click
    document.getElementById('btn-resume-training')?.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onResumeSession();
    });

    document.getElementById('btn-pause-menu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onReturnToMenu();
    });

    this.pauseOverlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'btn-pause-menu' || target.closest('#btn-pause-menu')) {
        return;
      }
      // Ignore clicks that arrive right as the overlay opens (same tap)
      if (performance.now() - this.pauseShownAt < 350) {
        return;
      }
      callbacks.onResumeSession();
    });
  }

  /** Called when the pause overlay becomes visible; opens the resume guard window. */
  public markPauseOverlayShown(): void {
    this.pauseShownAt = performance.now();
  }

  public showMainMenu(): void {
    this.hideAll();
    this.mainMenuEl.classList.remove('hidden');
    this.mainMenuEl.classList.add('active');
  }

  public showHUD(): void {
    this.hideAll();
    this.hudEl.classList.remove('hidden');
    this.hudEl.classList.add('active');
  }

  public showResults(stats: SessionStats): void {
    this.hideAll();
    this.resultsScreen.display(stats);
    this.resultsEl.classList.remove('hidden');
    this.resultsEl.classList.add('active');
  }

  public openSettings(): void {
    this.settingsMenu.open();
    this.settingsModalEl.classList.remove('hidden');
    this.settingsModalEl.classList.add('active');
  }

  public closeSettings(): void {
    this.settingsModalEl.classList.add('hidden');
    this.settingsModalEl.classList.remove('active');
  }

  private hideAll(): void {
    this.mainMenuEl.classList.add('hidden');
    this.mainMenuEl.classList.remove('active');
    this.hudEl.classList.add('hidden');
    this.hudEl.classList.remove('active');
    this.resultsEl.classList.add('hidden');
    this.resultsEl.classList.remove('active');
    this.settingsModalEl.classList.add('hidden');
    this.settingsModalEl.classList.remove('active');
  }
}
