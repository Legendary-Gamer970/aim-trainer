import { CrosshairRenderer } from './CrosshairRenderer';
import { ScopeOverlay } from './ScopeOverlay';
import { TouchControls } from './TouchControls';

export class HUD {
  private scoreEl: HTMLElement;
  private timerEl: HTMLElement;
  private timerBarEl: HTMLElement;
  private accuracyEl: HTMLElement;
  private hitsEl: HTMLElement;
  private shotsEl: HTMLElement;
  private headshotsEl: HTMLElement;
  private avgRtEl: HTMLElement;
  private fpsEl: HTMLElement;

  // Ammo elements
  private magAmmoEl: HTMLElement;
  private reserveAmmoEl: HTMLElement;
  private reloadPromptEl: HTMLElement;

  private countdownEl: HTMLElement;
  private reactionBadge: HTMLElement;
  private reactionText: HTMLElement;
  private pauseOverlay: HTMLElement;

  private modeLabelEl: HTMLElement;
  private difficultyLabelEl: HTMLElement;
  private missesEl: HTMLElement;

  // Flick target reaction window (drains under the crosshair)
  private targetWindowEl: HTMLElement;
  private targetWindowFillEl: HTMLElement;

  public crosshair: CrosshairRenderer;
  public scopeOverlay: ScopeOverlay;
  private reactionTimeout: number | null = null;

  constructor() {
    this.scoreEl = document.getElementById('hud-score')!;
    this.timerEl = document.getElementById('hud-timer')!;
    this.timerBarEl = document.getElementById('hud-timer-bar')!;
    this.accuracyEl = document.getElementById('hud-accuracy')!;
    this.hitsEl = document.getElementById('hud-hits')!;
    this.shotsEl = document.getElementById('hud-shots')!;
    this.headshotsEl = document.getElementById('hud-headshots')!;
    this.avgRtEl = document.getElementById('hud-avg-rt')!;
    this.fpsEl = document.getElementById('hud-fps')!;

    this.magAmmoEl = document.getElementById('hud-mag-ammo')!;
    this.reserveAmmoEl = document.getElementById('hud-reserve-ammo')!;
    this.reloadPromptEl = document.getElementById('hud-reload-prompt')!;

    this.countdownEl = document.getElementById('hud-countdown')!;
    this.reactionBadge = document.getElementById('hud-reaction-badge')!;
    this.reactionText = document.getElementById('hud-reaction-text')!;
    this.pauseOverlay = document.getElementById('pause-overlay')!;
    this.modeLabelEl = document.getElementById('hud-mode-label')!;
    this.difficultyLabelEl = document.getElementById('hud-difficulty')!;
    this.missesEl = document.getElementById('hud-misses')!;
    this.targetWindowEl = document.getElementById('target-window')!;
    this.targetWindowFillEl = document.getElementById('target-window-fill')!;

    this.crosshair = new CrosshairRenderer();
    this.scopeOverlay = new ScopeOverlay();
  }

  public updateScore(score: number, hits: number, shots: number, accuracy: number, headshots: number = 0, misses: number = 0): void {
    this.scoreEl.textContent = score.toLocaleString();
    this.hitsEl.textContent = hits.toString();
    this.shotsEl.textContent = shots.toString();
    this.accuracyEl.textContent = `${accuracy.toFixed(1)}%`;
    if (this.headshotsEl) {
      this.headshotsEl.textContent = headshots.toString();
    }
    if (this.missesEl) {
      this.missesEl.textContent = misses.toString();
    }
  }

  public updateAmmo(mag: number, reserve: number, isReloading: boolean): void {
    if (isReloading) {
      this.magAmmoEl.textContent = '--';
      this.reloadPromptEl.textContent = 'RELOADING...';
      this.reloadPromptEl.classList.remove('hidden');
    } else {
      this.magAmmoEl.textContent = mag.toString();
      this.reserveAmmoEl.textContent = Number.isFinite(reserve) ? reserve.toString() : '∞';

      if (mag <= 5 && mag > 0) {
        this.magAmmoEl.style.color = 'var(--accent-gold)';
        this.reloadPromptEl.classList.add('hidden');
      } else if (mag === 0) {
        this.magAmmoEl.style.color = 'var(--accent-coral)';
        this.reloadPromptEl.textContent = TouchControls.isTouchDevice()
          ? 'TAP RELOAD TO RELOAD'
          : 'PRESS [R] TO RELOAD';
        this.reloadPromptEl.classList.remove('hidden');
      } else {
        this.magAmmoEl.style.color = '#ffffff';
        this.reloadPromptEl.classList.add('hidden');
      }
    }
  }

  public updateTimer(timeRemaining: number, totalTime: number): void {
    this.timerEl.textContent = `${timeRemaining.toFixed(1)}s`;
    const percent = Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100));
    this.timerBarEl.style.width = `${percent}%`;

    if (timeRemaining <= 5) {
      this.timerEl.style.color = 'var(--accent-coral)';
    } else {
      this.timerEl.style.color = 'var(--accent-gold)';
    }
  }

  public showCountdown(text: string | null): void {
    if (text) {
      this.countdownEl.textContent = text;
      this.countdownEl.classList.remove('hidden');
      this.countdownEl.classList.remove('pulse');
      void this.countdownEl.offsetWidth;
      this.countdownEl.classList.add('pulse');
    } else {
      this.countdownEl.classList.add('hidden');
    }
  }

  public showHitFeedback(reactionTimeMs: number | null, isHeadshot: boolean = false): void {
    this.crosshair.triggerHitmarker();

    const reactionSuffix = reactionTimeMs !== null ? ` (${reactionTimeMs} ms)` : '';

    if (isHeadshot) {
      this.reactionText.textContent = `⚡ HEADSHOT!${reactionSuffix}`;
      this.reactionBadge.style.borderColor = 'var(--accent-gold)';
      this.reactionBadge.style.color = 'var(--accent-gold)';
    } else {
      this.reactionText.textContent = `BODY HIT${reactionSuffix}`;
      this.reactionBadge.style.borderColor = 'var(--accent-coral)';
      this.reactionBadge.style.color = 'var(--accent-coral)';
    }

    this.reactionBadge.classList.remove('hidden');
    this.reactionBadge.style.animation = 'none';
    void this.reactionBadge.offsetWidth;
    this.reactionBadge.style.animation = 'reactionFade 0.7s forwards cubic-bezier(0.2, 0.8, 0.2, 1)';

    if (this.reactionTimeout) {
      clearTimeout(this.reactionTimeout);
    }
    this.reactionTimeout = window.setTimeout(() => {
      this.reactionBadge.classList.add('hidden');
    }, 700);
  }

  public updateFPS(fps: number, frameTimeMs: number): void {
    this.fpsEl.textContent = `${fps} FPS (${frameTimeMs}ms)`;
  }

  public updateAvgReaction(avgRtMs: number): void {
    this.avgRtEl.textContent = avgRtMs > 0 ? `${avgRtMs} ms` : '-- ms';
  }

  public setModeLabel(mode: 'range' | 'flick', difficultyLabel?: string): void {
    const isRange = mode === 'range';
    this.timerEl.classList.toggle('hidden', isRange);
    this.modeLabelEl.classList.toggle('hidden', !isRange);
    if (isRange) {
      this.modeLabelEl.textContent = 'FREE PRACTICE';
    }

    // Difficulty label shown during Flick Training
    if (this.difficultyLabelEl) {
      if (!isRange && difficultyLabel) {
        this.difficultyLabelEl.textContent = `DIFFICULTY: ${difficultyLabel}`;
        this.difficultyLabelEl.classList.remove('hidden');
      } else {
        this.difficultyLabelEl.classList.add('hidden');
      }
    }
  }

  /**
   * Updates the target reaction window progress bar.
   * Bar starts full when a target appears and drains; the target
   * teleports when it empties.
   */
  public updateTargetWindow(remainingMs: number, totalMs: number): void {
    if (!this.targetWindowEl || !this.targetWindowFillEl) return;
    const percent = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
    this.targetWindowFillEl.style.width = `${percent}%`;
    this.targetWindowEl.classList.remove('hidden');
  }

  public hideTargetWindow(): void {
    if (this.targetWindowEl) {
      this.targetWindowEl.classList.add('hidden');
    }
  }

  public showMiss(): void {
    this.crosshair.triggerMissmarker();
  }

  public showPause(show: boolean): void {
    if (show) {
      this.pauseOverlay.classList.remove('hidden');
    } else {
      this.pauseOverlay.classList.add('hidden');
    }
  }

  public reset(duration: number): void {
    this.updateScore(0, 0, 0, 100, 0, 0);
    this.updateAmmo(30, Infinity, false);
    this.updateTimer(duration, duration);
    this.updateAvgReaction(0);
    this.showPause(false);
    this.showCountdown(null);
    this.reactionBadge.classList.add('hidden');
    this.timerEl.classList.remove('hidden');
    this.modeLabelEl.classList.add('hidden');
    this.hideTargetWindow();
    if (this.difficultyLabelEl) {
      this.difficultyLabelEl.classList.add('hidden');
    }
    if (this.missesEl) {
      this.missesEl.textContent = '0';
    }
  }
}
