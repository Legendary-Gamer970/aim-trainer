/**
 * Circular ADS optic overlay: a CSS mask that shows the magnified world
 * through a circular lens while darkening (vignetting) everything outside.
 * The 3D scope housing attached to the weapon provides the physical rim;
 * this overlay completes the optical-scope look.
 */
export class ScopeOverlay {
  private element: HTMLElement;

  constructor() {
    const el = document.getElementById('scope-overlay');
    if (!el) throw new Error('Scope overlay DOM element not found');
    this.element = el;
  }

  /** Toggles the circular scoped view (opacity-faded by CSS). */
  public setADS(active: boolean): void {
    this.element.classList.toggle('active', active);
  }
}