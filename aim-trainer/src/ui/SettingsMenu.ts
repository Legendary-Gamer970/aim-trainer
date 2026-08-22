import { CrosshairStyle } from '../config/constants';
import { settingsManager } from '../config/settings';

export interface SettingsMenuCallbacks {
  onClose: () => void;
}

export class SettingsMenu {
  private callbacks: SettingsMenuCallbacks;

  // Form controls
  private sensInput: HTMLInputElement;
  private sensVal: HTMLElement;
  private fovInput: HTMLInputElement;
  private fovVal: HTMLElement;
  private crosshairSizeInput: HTMLInputElement;
  private crosshairSizeVal: HTMLElement;
  private volumeInput: HTMLInputElement;
  private volumeVal: HTMLElement;
  private adsSensInput: HTMLInputElement;
  private adsSensVal: HTMLElement;
  private adsZoomInput: HTMLInputElement;
  private adsZoomVal: HTMLElement;
  private fireRateInput: HTMLInputElement;
  private fireRateVal: HTMLElement;

  private durationGroup: HTMLElement;
  private crosshairStyleGroup: HTMLElement;
  private crosshairColorPalette: HTMLElement;

  constructor(callbacks: SettingsMenuCallbacks) {
    this.callbacks = callbacks;

    this.sensInput = document.getElementById('setting-sens') as HTMLInputElement;
    this.sensVal = document.getElementById('setting-sens-val')!;
    this.fovInput = document.getElementById('setting-fov') as HTMLInputElement;
    this.fovVal = document.getElementById('setting-fov-val')!;
    this.crosshairSizeInput = document.getElementById('setting-crosshair-size') as HTMLInputElement;
    this.crosshairSizeVal = document.getElementById('setting-crosshair-size-val')!;
    this.volumeInput = document.getElementById('setting-volume') as HTMLInputElement;
    this.volumeVal = document.getElementById('setting-volume-val')!;

    this.adsSensInput = document.getElementById('setting-ads-sens') as HTMLInputElement;
    this.adsSensVal = document.getElementById('setting-ads-sens-val')!;
    this.adsZoomInput = document.getElementById('setting-ads-zoom') as HTMLInputElement;
    this.adsZoomVal = document.getElementById('setting-ads-zoom-val')!;
    this.fireRateInput = document.getElementById('setting-fire-rate') as HTMLInputElement;
    this.fireRateVal = document.getElementById('setting-fire-rate-val')!;

    this.durationGroup = document.getElementById('setting-duration-group')!;
    this.crosshairStyleGroup = document.getElementById('setting-crosshair-style-group')!;
    this.crosshairColorPalette = document.getElementById('setting-crosshair-colors')!;

    this.initListeners();
    this.syncUI();
  }

  private initListeners(): void {
    // Close actions
    document.getElementById('btn-close-settings')?.addEventListener('click', () => this.callbacks.onClose());
    document.getElementById('btn-save-settings')?.addEventListener('click', () => this.callbacks.onClose());
    document.getElementById('settings-backdrop')?.addEventListener('click', () => this.callbacks.onClose());

    // Sensitivity slider
    this.sensInput.addEventListener('input', () => {
      const val = parseFloat(this.sensInput.value);
      this.sensVal.textContent = val.toFixed(2);
      settingsManager.set('mouseSensitivity', val);
    });

    // FOV slider
    this.fovInput.addEventListener('input', () => {
      const val = parseInt(this.fovInput.value, 10);
      this.fovVal.textContent = `${val}°`;
      settingsManager.set('fov', val);
    });

    // Crosshair Size slider
    this.crosshairSizeInput.addEventListener('input', () => {
      const val = parseInt(this.crosshairSizeInput.value, 10);
      this.crosshairSizeVal.textContent = `${val}px`;
      settingsManager.set('crosshairSize', val);
    });

    // Master Volume slider
    this.volumeInput.addEventListener('input', () => {
      const val = parseInt(this.volumeInput.value, 10);
      this.volumeVal.textContent = `${val}%`;
      settingsManager.set('masterVolume', val);
    });

    // ADS sensitivity multiplier slider
    this.adsSensInput.addEventListener('input', () => {
      const val = parseFloat(this.adsSensInput.value);
      this.adsSensVal.textContent = `${val.toFixed(2)}x`;
      settingsManager.set('adsSensitivityMultiplier', val);
    });

    // ADS zoom strength slider
    this.adsZoomInput.addEventListener('input', () => {
      const val = parseFloat(this.adsZoomInput.value);
      this.adsZoomVal.textContent = `${val.toFixed(2)}x`;
      settingsManager.set('adsZoomStrength', val);
    });

    // Automatic fire rate slider
    this.fireRateInput.addEventListener('input', () => {
      const val = parseInt(this.fireRateInput.value, 10);
      this.fireRateVal.textContent = `${val} RPM`;
      settingsManager.set('fireRate', val);
    });

    // Duration pill buttons
    this.durationGroup.querySelectorAll('.btn-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-value') || '60', 10);
        settingsManager.set('sessionDuration', val);
        this.updatePillActive(this.durationGroup, btn as HTMLElement);
      });
    });

    // Crosshair style pill buttons
    this.crosshairStyleGroup.querySelectorAll('.btn-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-value') as CrosshairStyle;
        settingsManager.set('crosshairStyle', val);
        this.updatePillActive(this.crosshairStyleGroup, btn as HTMLElement);
      });
    });

    // Crosshair color buttons
    this.crosshairColorPalette.querySelectorAll('.color-circle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color') || '#00ffff';
        settingsManager.set('crosshairColor', color);
        this.crosshairColorPalette.querySelectorAll('.color-circle').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  private syncUI(): void {
    const s = settingsManager.getSettings();

    this.sensInput.value = s.mouseSensitivity.toString();
    this.sensVal.textContent = s.mouseSensitivity.toFixed(2);

    this.fovInput.value = s.fov.toString();
    this.fovVal.textContent = `${s.fov}°`;

    this.crosshairSizeInput.value = s.crosshairSize.toString();
    this.crosshairSizeVal.textContent = `${s.crosshairSize}px`;

    this.volumeInput.value = s.masterVolume.toString();
    this.volumeVal.textContent = `${s.masterVolume}%`;

    this.adsSensInput.value = s.adsSensitivityMultiplier.toString();
    this.adsSensVal.textContent = `${s.adsSensitivityMultiplier.toFixed(2)}x`;

    this.adsZoomInput.value = s.adsZoomStrength.toString();
    this.adsZoomVal.textContent = `${s.adsZoomStrength.toFixed(2)}x`;

    this.fireRateInput.value = s.fireRate.toString();
    this.fireRateVal.textContent = `${s.fireRate} RPM`;

    // Duration active
    this.durationGroup.querySelectorAll('.btn-pill').forEach((b) => {
      if (parseInt(b.getAttribute('data-value') || '', 10) === s.sessionDuration) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    // Crosshair style active
    this.crosshairStyleGroup.querySelectorAll('.btn-pill').forEach((b) => {
      if (b.getAttribute('data-value') === s.crosshairStyle) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    // Color active
    this.crosshairColorPalette.querySelectorAll('.color-circle').forEach((b) => {
      if (b.getAttribute('data-color')?.toLowerCase() === s.crosshairColor.toLowerCase()) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  private updatePillActive(group: HTMLElement, activeBtn: HTMLElement): void {
    group.querySelectorAll('.btn-pill').forEach((b) => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  public open(): void {
    this.syncUI();
  }
}
