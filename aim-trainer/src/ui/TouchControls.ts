import { inputManager } from '../core/InputManager';

const STICK_ENGAGED_CLASS = 'touch-engaged';
const BTN_PRESSED_CLASS = 'touch-btn-pressed';
const BTN_ACTIVE_CLASS = 'touch-btn-active';

// Multiplier applied to raw drag pixels before they enter the shared look
// pipeline. ~2.6 makes a full screen-width swipe turn roughly 130° at the
// default sensitivity, which feels natural for flicks on a phone.
const TOUCH_LOOK_GAIN = 2.6;

/** Gameplay actions the touch controls trigger through the app (same code paths as keyboard). */
export interface TouchActionCallbacks {
  onRequestReload?: () => void;
  onRequestPause?: () => void;
}

/**
 * On-screen controls for coarse-pointer (touch) devices.
 * Currently provides the left-side movement joystick only; it feeds the
 * existing InputManager analog vector so the desktop Player/movement
 * pipeline is reused unchanged.
 */
export class TouchControls {
  /** True on devices whose primary pointer is a finger rather than a mouse. */
  public static isTouchDevice(): boolean {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
    );
  }

  private rootEl: HTMLElement;
  private zoneEl: HTMLElement;
  private baseEl: HTMLElement;
  private knobEl: HTMLElement;
  private lookZoneEl: HTMLElement;

  // Pointer currently driving the stick (multi-touch safe)
  private stickPointerId: number | null = null;
  private centerX: number = 0;
  private centerY: number = 0;
  private radius: number = 1;

  // Pointer currently dragging the look area (independent of the stick)
  private lookPointerId: number | null = null;
  private lookLastX: number = 0;
  private lookLastY: number = 0;

  // Action buttons
  private fireBtnEl: HTMLButtonElement;
  private reloadBtnEl: HTMLButtonElement;
  private adsBtnEl: HTMLButtonElement;
  private pauseBtnEl: HTMLButtonElement;
  private firePointerId: number | null = null;
  private adsActive: boolean = false;

  constructor(callbacks: TouchActionCallbacks = {}) {
    const root = document.getElementById('touch-controls');
    if (!root) throw new Error('Touch controls root #touch-controls not found');
    this.rootEl = root;

    this.zoneEl = document.createElement('div');
    this.zoneEl.className = 'touch-joystick-zone';
    this.zoneEl.addEventListener('pointerdown', this.onStickDown);
    this.zoneEl.addEventListener('pointermove', this.onStickMove);
    this.zoneEl.addEventListener('pointerup', this.onStickUp);
    this.zoneEl.addEventListener('pointercancel', this.onStickUp);
    this.zoneEl.addEventListener('contextmenu', (e) => e.preventDefault());

    this.baseEl = document.createElement('div');
    this.baseEl.className = 'touch-joystick-base';

    this.knobEl = document.createElement('div');
    this.knobEl.className = 'touch-joystick-knob';

    this.baseEl.appendChild(this.knobEl);
    this.zoneEl.appendChild(this.baseEl);
    this.rootEl.appendChild(this.zoneEl);

    this.lookZoneEl = document.createElement('div');
    this.lookZoneEl.className = 'touch-look-zone';
    this.lookZoneEl.addEventListener('pointerdown', this.onLookDown);
    this.lookZoneEl.addEventListener('pointermove', this.onLookMove);
    this.lookZoneEl.addEventListener('pointerup', this.onLookUp);
    this.lookZoneEl.addEventListener('pointercancel', this.onLookUp);
    this.lookZoneEl.addEventListener('contextmenu', (e) => e.preventDefault());
    this.rootEl.appendChild(this.lookZoneEl);

    // Bottom-right action cluster (appended after the look zone so taps on
    // the buttons never reach it). All actions reuse existing gameplay paths.
    const cluster = document.createElement('div');
    cluster.className = 'touch-action-cluster';

    this.fireBtnEl = this.createActionButton('touch-btn-fire', 'FIRE');
    this.fireBtnEl.addEventListener('pointerdown', this.onFireDown);
    this.fireBtnEl.addEventListener('pointerup', this.onFireUp);
    this.fireBtnEl.addEventListener('pointercancel', this.onFireUp);

    this.reloadBtnEl = this.createActionButton('touch-btn-reload', 'RELOAD');
    this.reloadBtnEl.addEventListener('pointerdown', () => callbacks.onRequestReload?.());

    this.adsBtnEl = this.createActionButton('touch-btn-ads', 'ADS');
    this.adsBtnEl.addEventListener('pointerdown', () => {
      this.adsActive = !this.adsActive;
      this.adsBtnEl.classList.toggle(BTN_ACTIVE_CLASS, this.adsActive);
      inputManager.setVirtualADS(this.adsActive);
    });

    this.pauseBtnEl = this.createActionButton('touch-btn-pause', 'II');
    this.pauseBtnEl.addEventListener('pointerdown', () => callbacks.onRequestPause?.());

    cluster.appendChild(this.pauseBtnEl);
    cluster.appendChild(this.reloadBtnEl);
    cluster.appendChild(this.adsBtnEl);
    cluster.appendChild(this.fireBtnEl);
    this.rootEl.appendChild(cluster);
  }

  private createActionButton(className: string, label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `touch-btn ${className}`;
    btn.textContent = label;
    // Canceling pointerdown suppresses the compatibility mouse events that
    // would otherwise re-trigger game handlers (e.g. pause-overlay resume)
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    return btn;
  }

  /** Shows/hides the touch controls (hidden in menus, while paused, on results). */
  public setVisible(visible: boolean): void {
    this.rootEl.classList.toggle('hidden', !visible);
    if (!visible) {
      this.releaseStick();
      this.releaseLook();
      this.releaseActions();
    }
  }

  private onStickDown = (e: PointerEvent): void => {
    if (this.stickPointerId !== null) return; // already tracking a finger
    e.preventDefault(); // suppress compatibility mouse events

    this.stickPointerId = e.pointerId;
    try {
      this.zoneEl.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort; drag still works while the finger stays inside
    }

    // Floating origin: re-anchor the base under the thumb, kept within margins
    const zoneRect = this.zoneEl.getBoundingClientRect();
    const size = this.baseEl.offsetWidth || 1;
    const margin = size / 2 + 8;
    const localX = Math.min(Math.max(e.clientX - zoneRect.left, margin), Math.max(zoneRect.width - margin, margin));
    const localY = Math.min(Math.max(e.clientY - zoneRect.top, margin), Math.max(zoneRect.height - margin, margin));
    this.baseEl.style.left = `${localX}px`;
    this.baseEl.style.top = `${localY}px`;
    this.baseEl.style.bottom = 'auto'; // override the CSS rest anchor
    this.baseEl.classList.add(STICK_ENGAGED_CLASS);

    const baseRect = this.baseEl.getBoundingClientRect();
    this.centerX = baseRect.left + baseRect.width / 2;
    this.centerY = baseRect.top + baseRect.height / 2;
    this.radius = baseRect.width / 2 || 1;

    this.applyKnob(e.clientX, e.clientY);
  };

  private onStickMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickPointerId) return;
    this.applyKnob(e.clientX, e.clientY);
  };

  private applyKnob(pointerX: number, pointerY: number): void {
    let dx = pointerX - this.centerX;
    let dy = pointerY - this.centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > this.radius) {
      dx = (dx / dist) * this.radius;
      dy = (dy / dist) * this.radius;
    }

    this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Normalized analog vector: x right+, y down+ maps to z back+
    // (matches getMovementVector semantics used by Player.update)
    inputManager.setTouchMoveVector(dx / this.radius, dy / this.radius);
  }

  private onStickUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickPointerId) return;
    this.releaseStick();
  };

  private releaseStick(): void {
    if (this.stickPointerId !== null) {
      try {
        this.zoneEl.releasePointerCapture(this.stickPointerId);
      } catch {
        // Already released when the pointer left the document
      }
    }
    this.stickPointerId = null;
    this.baseEl.classList.remove(STICK_ENGAGED_CLASS);
    this.baseEl.style.left = '';
    this.baseEl.style.top = '';
    this.baseEl.style.bottom = '';
    this.knobEl.style.transform = '';
    inputManager.setTouchMoveVector(0, 0);
  }

  private onLookDown = (e: PointerEvent): void => {
    if (this.lookPointerId !== null) return; // already tracking a finger
    e.preventDefault(); // suppress compatibility mouse events

    this.lookPointerId = e.pointerId;
    try {
      this.lookZoneEl.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort; drag still works while the finger stays inside
    }
    this.lookLastX = e.clientX;
    this.lookLastY = e.clientY;
  };

  private onLookMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.lookPointerId) return;

    const dx = e.clientX - this.lookLastX;
    const dy = e.clientY - this.lookLastY;
    this.lookLastX = e.clientX;
    this.lookLastY = e.clientY;

    // Same sign convention as mouse movementX/Y: drag right looks right,
    // drag down looks down. Deltas join the shared pool consumed once per
    // frame by Player.update.
    inputManager.addTouchLookDelta(dx * TOUCH_LOOK_GAIN, dy * TOUCH_LOOK_GAIN);
  };

  private onLookUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.lookPointerId) return;
    this.releaseLook();
  };

  private releaseLook(): void {
    if (this.lookPointerId !== null) {
      try {
        this.lookZoneEl.releasePointerCapture(this.lookPointerId);
      } catch {
        // Already released when the pointer left the document
      }
    }
    this.lookPointerId = null;
  }

  private onFireDown = (e: PointerEvent): void => {
    if (this.firePointerId !== null) return; // already firing

    this.firePointerId = e.pointerId;
    try {
      this.fireBtnEl.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort; release still arrives in normal use
    }
    this.fireBtnEl.classList.add(BTN_PRESSED_CLASS);
    inputManager.setVirtualFire(true);
  };

  private onFireUp = (e: PointerEvent): void => {
    if (this.firePointerId !== null && e.pointerId !== this.firePointerId) return;
    this.releaseFire();
  };

  private releaseActions(): void {
    this.releaseFire();
    this.adsActive = false;
    this.adsBtnEl.classList.remove(BTN_ACTIVE_CLASS);
    inputManager.setVirtualADS(false);
  }

  private releaseFire(): void {
    if (this.firePointerId !== null) {
      try {
        this.fireBtnEl.releasePointerCapture(this.firePointerId);
      } catch {
        // Already released when the pointer left the document
      }
    }
    this.firePointerId = null;
    this.fireBtnEl.classList.remove(BTN_PRESSED_CLASS);
    inputManager.setVirtualFire(false);
  }
}