import { settingsManager } from '../config/settings';

export class CrosshairRenderer {
  private element: HTMLElement;
  private hitmarker: HTMLElement;

  constructor() {
    const el = document.getElementById('crosshair-element');
    const hm = document.getElementById('hitmarker');
    if (!el || !hm) throw new Error('Crosshair DOM elements not found');

    this.element = el;
    this.hitmarker = hm;

    this.render();

    // Re-render when crosshair settings change
    settingsManager.subscribe(() => {
      this.render();
    });
  }

  public render(): void {
    const settings = settingsManager.getSettings();
    const { crosshairStyle, crosshairColor, crosshairSize, crosshairGap, crosshairThickness } = settings;

    // Set CSS custom properties
    this.element.style.setProperty('--crosshair-color', crosshairColor);
    this.element.style.setProperty('--crosshair-size', `${crosshairSize}px`);
    this.element.style.setProperty('--crosshair-gap', `${crosshairGap}px`);
    this.element.style.setProperty('--crosshair-thickness', `${crosshairThickness}px`);

    this.element.className = '';
    this.element.innerHTML = '';

    switch (crosshairStyle) {
      case 'cross':
        this.element.classList.add('crosshair-cross');
        this.element.innerHTML = `
          <div class="crosshair-bar top"></div>
          <div class="crosshair-bar bottom"></div>
          <div class="crosshair-bar left"></div>
          <div class="crosshair-bar right"></div>
        `;
        break;

      case 'dot':
        this.element.classList.add('crosshair-dot');
        this.element.innerHTML = `<div class="dot"></div>`;
        break;

      case 'plus':
        this.element.classList.add('crosshair-cross');
        this.element.style.setProperty('--crosshair-gap', '0px');
        this.element.innerHTML = `
          <div class="crosshair-bar top"></div>
          <div class="crosshair-bar bottom"></div>
          <div class="crosshair-bar left"></div>
          <div class="crosshair-bar right"></div>
        `;
        break;

      case 'circle-dot':
        this.element.classList.add('crosshair-circle-dot');
        this.element.innerHTML = `
          <div class="circle"></div>
          <div class="dot"></div>
        `;
        break;
    }
  }

  public triggerHitmarker(): void {
    this.hitmarker.classList.remove('hidden', 'active', 'miss');
    // Force reflow
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add('active');

    setTimeout(() => {
      this.hitmarker.classList.remove('active');
    }, 120);
  }

  public triggerMissmarker(): void {
    this.hitmarker.classList.remove('hidden', 'active', 'miss');
    // Force reflow
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add('active', 'miss');

    setTimeout(() => {
      this.hitmarker.classList.remove('active', 'miss');
    }, 110);
  }

  /** Toggles the compact ADS reticle style while scoped. */
  public setADS(active: boolean): void {
    this.element.classList.toggle('ads', active);
  }
}
