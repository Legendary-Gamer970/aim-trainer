import { SessionStats } from '../modes/TrainingMode';

export interface ResultsCallbacks {
  onRetry: () => void;
  onMenu: () => void;
}

export class ResultsScreen {
  private gradeEl: HTMLElement;
  private rankLabelEl: HTMLElement;
  private finalScoreEl: HTMLElement;
  private accuracyEl: HTMLElement;
  private targetsHitEl: HTMLElement;
  private headshotsEl: HTMLElement;
  private avgRtEl: HTMLElement;
  private bestRtEl: HTMLElement;
  private tpmEl: HTMLElement;

  constructor(callbacks: ResultsCallbacks) {
    this.gradeEl = document.getElementById('results-grade')!;
    this.rankLabelEl = document.getElementById('results-rank-label')!;
    this.finalScoreEl = document.getElementById('results-final-score')!;
    this.accuracyEl = document.getElementById('results-accuracy')!;
    this.targetsHitEl = document.getElementById('results-targets-hit')!;
    this.headshotsEl = document.getElementById('results-headshots')!;
    this.avgRtEl = document.getElementById('results-avg-rt')!;
    this.bestRtEl = document.getElementById('results-best-rt')!;
    this.tpmEl = document.getElementById('results-tpm')!;

    const btnRetry = document.getElementById('btn-retry');
    const btnMenu = document.getElementById('btn-results-menu');

    btnRetry?.addEventListener('click', () => callbacks.onRetry());
    btnMenu?.addEventListener('click', () => callbacks.onMenu());
  }

  public display(stats: SessionStats): void {
    this.gradeEl.textContent = stats.rankGrade;
    this.rankLabelEl.textContent = stats.rankLabel;
    this.finalScoreEl.textContent = stats.score.toLocaleString();
    this.accuracyEl.textContent = `${stats.accuracy.toFixed(1)}%`;
    this.targetsHitEl.textContent = stats.targetsHit.toString();
    if (this.headshotsEl) {
      this.headshotsEl.textContent = stats.headshots.toString();
    }
    this.avgRtEl.textContent = stats.avgReactionTimeMs > 0 ? `${stats.avgReactionTimeMs} ms` : '-- ms';
    this.bestRtEl.textContent = stats.bestReactionTimeMs > 0 ? `${stats.bestReactionTimeMs} ms` : '-- ms';
    this.tpmEl.textContent = stats.targetsPerMinute.toFixed(1);

    // Color grade badge
    switch (stats.rankGrade) {
      case 'S':
        this.gradeEl.style.color = 'var(--accent-gold)';
        break;
      case 'A':
        this.gradeEl.style.color = 'var(--accent-teal)';
        break;
      case 'B':
        this.gradeEl.style.color = 'var(--accent-green)';
        break;
      default:
        this.gradeEl.style.color = '#94a3b8';
        break;
    }
  }
}
