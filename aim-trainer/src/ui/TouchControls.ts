import { inputManager } from '../core/InputManager';

const STICK_ENGAGED_CLASS = 'touch-engaged';
const BTN_PRESSED_CLASS = 'touch-btn-pressed';
const BTN_ACTIVE_CLASS = 'touch-btn-active';

const TOUCH_LOOK_GAIN = 2.6;

export interface TouchActionCallbacks {
  onRequestReload?: () => void;
  onRequestPause?: () => void;
}

export class TouchControls {
  public static isTouchDevice(): boolean {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
    );
  }

  private rootEl: HTMLElement;

  // Left movement zone (entire lower-left area)
  private moveZoneEl: HTMLElement;
  private moveBaseEl: HTMLElement;
  private moveKnobEl: HTMLElement;

  // Right aim/shoot joystick (fixed position)
  private fireAimZoneEl: HTMLElement;
  private fireAimBaseEl: HTMLElement;
  private fireAimKnobEl: HTMLElement;

  // Free-look zone (rest of screen)
  private lookZoneEl: HTMLElement;

  // Action buttons
  private reloadBtnEl: HTMLButtonElement;
  private adsBtnEl: HTMLButtonElement;
  private pauseBtnEl: HTMLButtonElement;

  // Pointer ownership
  private movePointerId: number | null = null;
  private fireAimPointerId: number | null = null;
  private lookPointerId: number | null = null;

  // Geometry
  private moveCenterX: number = 0;
  private moveCenterY: number = 0;
  private moveRadius: number = 1;
  private fireAimCenterX: number = 0;
  private fireAimCenterY: number = 0;
  private fireAimRadius: number = 1;
  private geometryReady: boolean = false;

  // Fire/aim state
  private fireAimLastX: number = 0;
  private fireAimLastY: number = 0;

  // Action button state
  private adsActive: boolean = false;

  // Fullscreen button
  private fullscreenBtnEl: HTMLButtonElement | null = null;

  private resizeObserver: ResizeObserver | null = null;

  constructor(callbacks: TouchActionCallbacks = {}) {
    const root = document.getElementById('touch-controls');
    if (!root) throw new Error('Touch controls root #touch-controls not found');
    this.rootEl = root;

    // LEFT MOVEMENT ZONE (entire lower-left area)
    this.moveZoneEl = document.createElement('div');
    this.moveZoneEl.className = 'touch-move-zone';
    this.moveZoneEl.addEventListener('pointerdown', this.onMoveDown);
    this.moveZoneEl.addEventListener('pointermove', this.onMoveMove);
    this.moveZoneEl.addEventListener('pointerup', this.onMoveUp);
    this.moveZoneEl.addEventListener('pointercancel', this.onMoveUp);
    this.moveZoneEl.addEventListener('contextmenu', (e) => e.preventDefault());

    this.moveBaseEl = document.createElement('div');
    this.moveBaseEl.className = 'touch-joystick-base';

    this.moveKnobEl = document.createElement('div');
    this.moveKnobEl.className = 'touch-joystick-knob';

    this.moveBaseEl.appendChild(this.moveKnobEl);
    this.moveZoneEl.appendChild(this.moveBaseEl);
    this.rootEl.appendChild(this.moveZoneEl);

    // RIGHT AIM/SHOOT JOYSTICK (fixed position)
    this.fireAimZoneEl = document.createElement('div');
    this.fireAimZoneEl.className = 'touch-fire-aim-zone';
    this.fireAimZoneEl.addEventListener('contextmenu', (e) => e.preventDefault());

    this.fireAimBaseEl = document.createElement('div');
    this.fireAimBaseEl.className = 'touch-joystick-base touch-fire-aim-base';
    this.fireAimBaseEl.addEventListener('pointerdown', this.onFireAimDown);
    this.fireAimBaseEl.addEventListener('pointermove', this.onFireAimMove);
    this.fireAimBaseEl.addEventListener('pointerup', this.onFireAimUp);
    this.fireAimBaseEl.addEventListener('pointercancel', this.onFireAimUp);
    this.fireAimBaseEl.addEventListener('contextmenu', (e) => e.preventDefault());

    this.fireAimKnobEl = document.createElement('div');
    this.fireAimKnobEl.className = 'touch-joystick-knob touch-fire-aim-knob';

    this.fireAimBaseEl.appendChild(this.fireAimKnobEl);
    this.fireAimZoneEl.appendChild(this.fireAimBaseEl);
    this.rootEl.appendChild(this.fireAimZoneEl);

    // FREE-LOOK ZONE (rest of screen - for camera control without shooting)
    this.lookZoneEl = document.createElement('div');
    this.lookZoneEl.className = 'touch-look-zone';
    this.lookZoneEl.addEventListener('pointerdown', this.onLookDown);
    this.lookZoneEl.addEventListener('pointermove', this.onLookMove);
    this.lookZoneEl.addEventListener('pointerup', this.onLookUp);
    this.lookZoneEl.addEventListener('pointercancel', this.onLookUp);
    this.lookZoneEl.addEventListener('contextmenu', (e) => e.preventDefault());
    this.rootEl.appendChild(this.lookZoneEl);

    // ACTION BUTTONS (reload, ADS, pause)
    const cluster = document.createElement('div');
    cluster.className = 'touch-action-cluster';

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
    this.rootEl.appendChild(cluster);

    // FULLSCREEN BUTTON (top-right)
    this.fullscreenBtnEl = document.createElement('button');
    this.fullscreenBtnEl.type = 'button';
    this.fullscreenBtnEl.className = 'touch-fullscreen-btn';
    this.fullscreenBtnEl.textContent = '⛶';
    this.fullscreenBtnEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.toggleFullscreen();
    });
    this.fullscreenBtnEl.addEventListener('contextmenu', (e) => e.preventDefault());
    this.rootEl.appendChild(this.fullscreenBtnEl);

    // Observe both joystick bases for geometry
    this.resizeObserver = new ResizeObserver(() => this.updateGeometry());
    this.resizeObserver.observe(this.moveBaseEl);
    this.resizeObserver.observe(this.fireAimBaseEl);

    // Ensure geometry is ready on first load
    if (document.readyState === 'complete') {
      requestAnimationFrame(() => this.updateGeometry());
    } else {
      window.addEventListener('load', () => requestAnimationFrame(() => this.updateGeometry()), { once: true });
    }
  }

  private createActionButton(className: string, label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `touch-btn ${className}`;
    btn.textContent = label;
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    return btn;
  }

  private updateGeometry(): void {
    const moveRect = this.moveBaseEl.getBoundingClientRect();
    const fireRect = this.fireAimBaseEl.getBoundingClientRect();

    if (moveRect.width > 0 && moveRect.height > 0) {
      this.moveCenterX = moveRect.left + moveRect.width / 2;
      this.moveCenterY = moveRect.top + moveRect.height / 2;
      this.moveRadius = moveRect.width / 2;
    }

    if (fireRect.width > 0 && fireRect.height > 0) {
      this.fireAimCenterX = fireRect.left + fireRect.width / 2;
      this.fireAimCenterY = fireRect.top + fireRect.height / 2;
      this.fireAimRadius = fireRect.width / 2;
    }

    this.geometryReady = true;
  }

  public setVisible(visible: boolean): void {
    this.rootEl.classList.toggle('hidden', !visible);
    if (!visible) {
      this.releaseMove();
      this.releaseFireAim();
      this.releaseLook();
      this.releaseActions();
    }
  }

  // ========== LEFT MOVEMENT JOYSTICK (slightly dynamic) ==========

  private onMoveDown = (e: PointerEvent): void => {
    if (this.movePointerId !== null) return;
    if (!this.geometryReady) this.updateGeometry();
    if (!this.geometryReady) return;

    // Ignore if this pointer is already owned by fire/aim or look
    if (e.pointerId === this.fireAimPointerId || e.pointerId === this.lookPointerId) return;

    e.preventDefault();

    this.movePointerId = e.pointerId;
    try {
      this.moveZoneEl.setPointerCapture(e.pointerId);
    } catch {
    }

    // Slightly dynamic: center the joystick base on the initial touch position
    // but constrain it to the lower-left zone
    const zoneRect = this.moveZoneEl.getBoundingClientRect();
    const baseSize = this.moveBaseEl.offsetWidth || 1;
    const margin = baseSize / 2 + 8;

    const localX = Math.min(
      Math.max(e.clientX - zoneRect.left, margin),
      Math.max(zoneRect.width - margin, margin)
    );
    const localY = Math.min(
      Math.max(e.clientY - zoneRect.top, margin),
      Math.max(zoneRect.height - margin, margin)
    );

    this.moveBaseEl.style.left = `${localX}px`;
    this.moveBaseEl.style.top = `${localY}px`;
    this.moveBaseEl.style.bottom = 'auto';
    this.moveBaseEl.style.right = 'auto';
    this.moveBaseEl.classList.add(STICK_ENGAGED_CLASS);

    // Update center after repositioning
    const baseRect = this.moveBaseEl.getBoundingClientRect();
    this.moveCenterX = baseRect.left + baseRect.width / 2;
    this.moveCenterY = baseRect.top + baseRect.height / 2;
    this.moveRadius = baseRect.width / 2;

    this.applyMoveKnob(e.clientX, e.clientY);
  };

  private onMoveMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.movePointerId) return;
    if (!this.geometryReady) return;
    this.applyMoveKnob(e.clientX, e.clientY);
  };

  private applyMoveKnob(pointerX: number, pointerY: number): void {
    let dx = pointerX - this.moveCenterX;
    let dy = pointerY - this.moveCenterY;
    const dist = Math.hypot(dx, dy);
    if (dist > this.moveRadius) {
      dx = (dx / dist) * this.moveRadius;
      dy = (dy / dist) * this.moveRadius;
    }

    this.moveKnobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // x: right+, y: down+ (maps to z: back+)
    inputManager.setTouchMoveVector(dx / this.moveRadius, dy / this.moveRadius);
  }

  private onMoveUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.movePointerId) return;
    this.releaseMove();
  };

  private releaseMove(): void {
    if (this.movePointerId !== null) {
      try {
        this.moveZoneEl.releasePointerCapture(this.movePointerId);
      } catch {
      }
    }
    this.movePointerId = null;
    this.moveBaseEl.classList.remove(STICK_ENGAGED_CLASS);
    this.moveBaseEl.style.left = '';
    this.moveBaseEl.style.top = '';
    this.moveBaseEl.style.bottom = '';
    this.moveBaseEl.style.right = '';
    this.moveKnobEl.style.transform = '';
    inputManager.setTouchMoveVector(0, 0);
  }

  // ========== RIGHT AIM/SHOOT JOYSTICK (fixed, touch=fire, drag=aim) ==========

  private onFireAimDown = (e: PointerEvent): void => {
    if (this.fireAimPointerId !== null) return;
    if (!this.geometryReady) return;

    // Ignore if this pointer is already owned by move
    if (e.pointerId === this.movePointerId) return;

    e.preventDefault();

    this.fireAimPointerId = e.pointerId;
    try {
      this.fireAimBaseEl.setPointerCapture(e.pointerId);
    } catch {
    }

    this.fireAimLastX = e.clientX;
    this.fireAimLastY = e.clientY;

    this.fireAimBaseEl.classList.add(BTN_PRESSED_CLASS);
    this.fireAimKnobEl.style.transform = 'translate(-50%, -50%)'; // Center knob
    inputManager.setVirtualFire(true);
  };

  private onFireAimMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.fireAimPointerId) return;
    if (!this.geometryReady) return;

    // Visual feedback: move knob slightly to show drag direction
    let dx = e.clientX - this.fireAimCenterX;
    let dy = e.clientY - this.fireAimCenterY;
    const dist = Math.hypot(dx, dy);
    if (dist > this.fireAimRadius) {
      dx = (dx / dist) * this.fireAimRadius;
      dy = (dy / dist) * this.fireAimRadius;
    }
    this.fireAimKnobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Camera look delta
    const lookDx = e.clientX - this.fireAimLastX;
    const lookDy = e.clientY - this.fireAimLastY;
    this.fireAimLastX = e.clientX;
    this.fireAimLastY = e.clientY;

    inputManager.addTouchLookDelta(lookDx * TOUCH_LOOK_GAIN, lookDy * TOUCH_LOOK_GAIN);
  };

  private onFireAimUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.fireAimPointerId) return;
    this.releaseFireAim();
  };

  private releaseFireAim(): void {
    if (this.fireAimPointerId !== null) {
      try {
        this.fireAimBaseEl.releasePointerCapture(this.fireAimPointerId);
      } catch {
      }
    }
    this.fireAimPointerId = null;
    this.fireAimBaseEl.classList.remove(BTN_PRESSED_CLASS);
    this.fireAimKnobEl.style.transform = 'translate(-50%, -50%)';
    inputManager.setVirtualFire(false);
  }

  // ========== FREE-LOOK ZONE (camera only, no shooting) ==========

  private onLookDown = (e: PointerEvent): void => {
    if (this.lookPointerId !== null) return;
    if (!this.geometryReady) return;

    // Ignore if this pointer is already owned by move or fire/aim
    if (e.pointerId === this.movePointerId || e.pointerId === this.fireAimPointerId) return;

    e.preventDefault();

    this.lookPointerId = e.pointerId;
    try {
      this.lookZoneEl.setPointerCapture(e.pointerId);
    } catch {
    }

    this.fireAimLastX = e.clientX;
    this.fireAimLastY = e.clientY;
  };

  private onLookMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.lookPointerId) return;
    if (!this.geometryReady) return;

    const dx = e.clientX - this.fireAimLastX;
    const dy = e.clientY - this.fireAimLastY;
    this.fireAimLastX = e.clientX;
    this.fireAimLastY = e.clientY;

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
      }
    }
    this.lookPointerId = null;
  }

  // ========== ACTION BUTTONS ==========

  private releaseActions(): void {
    this.releaseFireAim();
    this.adsActive = false;
    this.adsBtnEl.classList.remove(BTN_ACTIVE_CLASS);
    inputManager.setVirtualADS(false);
  }

  private toggleFullscreen(): void {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {
        // Ignore - some browsers require user gesture
      });
    } else {
      document.exitFullscreen().catch(() => {
      });
    }
  }
}