import { settingsManager } from '../config/settings';

export type LockChangeCallback = (isLocked: boolean) => void;

/** Chrome/Edge expose touch-origin info on synthesized mouse events. */
interface InputDeviceCapabilitiesLike {
  firesTouchEvents?: boolean;
}

/** True for compatibility mouse events that were synthesized from touch input. */
function isTouchSynthesized(e: MouseEvent): boolean {
  const caps = (e as MouseEvent & { sourceCapabilities?: InputDeviceCapabilitiesLike | null }).sourceCapabilities;
  return caps?.firesTouchEvents === true;
}
export class InputManager {
  private targetElement: HTMLElement | null = null;
  private isPointerLocked: boolean = false;

  // Raw mouse deltas accumulated per frame
  private mouseDeltaX: number = 0;
  private mouseDeltaY: number = 0;

  // Fallback mouse coordinates for unlocked movement
  private lastClientX: number | null = null;
  private lastClientY: number | null = null;

  // Keyboard movement flags
  private keys: Record<string, boolean> = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  // Analog touch movement from the on-screen joystick. A zero vector means
  // released, in which case keyboard flags drive movement exactly as before.
  private touchMoveX: number = 0;
  private touchMoveZ: number = 0;

  // Mouse button held state (auto-fire + ADS)
  private fireHeld: boolean = false;
  private adsHeld: boolean = false;
  private firePressed: boolean = false; // edge-triggered, consumed once per press

  private sensitivity: number = 1.0;
  private adsSensitivityMultiplier: number = 1.0;
  private ignoreNextMouseMove: boolean = false;
  private inputEnabled: boolean = false;
  // Timestamp of the last touch-originated pointerdown, used to filter the
  // compatibility mouse events some browsers synthesize right after it
  private lastTouchPointerDownAt: number = -Infinity;
  private lockChangeCallbacks: Set<LockChangeCallback> = new Set();

  constructor() {
    this.sensitivity = settingsManager.get('mouseSensitivity');
    this.adsSensitivityMultiplier = settingsManager.get('adsSensitivityMultiplier');
    settingsManager.subscribe((settings) => {
      this.sensitivity = settings.mouseSensitivity;
      this.adsSensitivityMultiplier = settings.adsSensitivityMultiplier;
    });

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onPointerLockError = this.onPointerLockError.bind(this);
    this.onTouchPointerDown = this.onTouchPointerDown.bind(this);
  }

  private onTouchPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      this.lastTouchPointerDownAt = performance.now();
    }
  }

  public attach(element: HTMLElement): void {
    this.targetElement = element;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    document.addEventListener('pointerdown', this.onTouchPointerDown, true);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    document.removeEventListener('pointerdown', this.onTouchPointerDown, true);
  }

  public requestLock(): void {
    try {
      const target = this.targetElement || document.body;
      if (target && target.requestPointerLock) {
        const res = target.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            // Silently handle rejection - gameplay continues smoothly without interruption
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  public exitLock(): void {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch {
      // Ignore
    }
    this.isPointerLocked = false;
  }

  public isLocked(): boolean {
    return this.isPointerLocked;
  }

  public setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
      // Release any buttons that are being held when input is disabled
      this.fireHeld = false;
      this.adsHeld = false;
      this.touchMoveX = 0;
      this.touchMoveZ = 0;
    }
  }

  /**
   * Sets the analog movement vector from the on-screen joystick.
   * x: right positive, z: backward positive (same convention as getMovementVector).
   * While non-zero it takes priority over keyboard flags; desktop is unaffected.
   */
  public setTouchMoveVector(x: number, z: number): void {
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    this.touchMoveX = x;
    this.touchMoveZ = z;
  }

  /**
   * Adds camera-look deltas from touch drag (already gain-adjusted).
   * They join the same per-frame pool the mouse path drains from, so
   * sensitivity, the ADS multiplier, and pitch clamping all apply unchanged.
   */
  public addTouchLookDelta(deltaX: number, deltaY: number): void {
    if (!this.inputEnabled) return;
    this.mouseDeltaX += deltaX;
    this.mouseDeltaY += deltaY;
  }

  /**
   * Virtual fire button state from touch controls. Drives the same
   * fireHeld/firePressed pipeline as the left mouse button (edge + hold).
   */
  public setVirtualFire(held: boolean): void {
    if (!this.inputEnabled) return;
    if (held) {
      this.fireHeld = true;
      this.firePressed = true;
    } else {
      this.fireHeld = false;
    }
  }

  /** Virtual aim-down-sights state from touch controls (same path as right mouse). */
  public setVirtualADS(active: boolean): void {
    this.adsHeld = active && this.inputEnabled;
  }

  public onLockChange(callback: LockChangeCallback): () => void {
    this.lockChangeCallbacks.add(callback);
    return () => this.lockChangeCallbacks.delete(callback);
  }

  /** True while the left mouse button is held down (auto-fire). */
  public isFireHeld(): boolean {
    return this.fireHeld;
  }

  /** True while the right mouse button is held down (aim down sights). */
  public isADS(): boolean {
    return this.adsHeld;
  }

  /** Returns true exactly once per left-button press (edge trigger). */
  public consumeFirePressed(): boolean {
    const pressed = this.firePressed;
    this.firePressed = false;
    return pressed;
  }

  /**
   * Consumes and resets the mouse deltas for the current frame.
   * While aiming down sights the sensitivity is scaled by the ADS multiplier.
   */
  public consumeMouseDelta(): { deltaX: number; deltaY: number } {
    const baseSensitivity = 0.0022; // Standard FPS base radians multiplier
    const effective = this.adsHeld
      ? this.sensitivity * this.adsSensitivityMultiplier
      : this.sensitivity;
    const deltaX = this.mouseDeltaX * effective * baseSensitivity;
    const deltaY = this.mouseDeltaY * effective * baseSensitivity;

    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    return { deltaX, deltaY };
  }

  public getMovementVector(): { x: number; z: number } {
    // Active analog stick overrides digital keyboard input (mobile joystick)
    if (this.touchMoveX !== 0 || this.touchMoveZ !== 0) {
      return { x: this.touchMoveX, z: this.touchMoveZ };
    }

    let x = 0;
    let z = 0;

    if (this.keys.forward) z -= 1;
    if (this.keys.backward) z += 1;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;

    // Normalize diagonal movement
    const len = Math.hypot(x, z);
    if (len > 0) {
      x /= len;
      z /= len;
    }

    return { x, z };
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.inputEnabled) {
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;
      return;
    }

    // Ignore the single teleport event that browsers fire right after a pointer lock change
    if (this.ignoreNextMouseMove) {
      this.ignoreNextMouseMove = false;
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;
      return;
    }

    if (this.isPointerLocked) {
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      // Drop cursor teleports (e.g. window focus changes), keep genuine aim movement
      if (Math.abs(dx) < 200 && Math.abs(dy) < 200) {
        this.mouseDeltaX += dx;
        this.mouseDeltaY += dy;
      }
    } else {
      // Seamless fallback if pointer lock is not active
      if (this.lastClientX !== null && this.lastClientY !== null) {
        const dx = e.movementX !== undefined && e.movementX !== 0 ? e.movementX : (e.clientX - this.lastClientX);
        const dy = e.movementY !== undefined && e.movementY !== 0 ? e.movementY : (e.clientY - this.lastClientY);
        // Filter out extreme jumps when cursor enters window
        if (Math.abs(dx) < 300 && Math.abs(dy) < 300) {
          this.mouseDeltaX += dx;
          this.mouseDeltaY += dy;
        }
      }
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;
    }
  }

  private onMouseDown(e: MouseEvent): void {
    // If target is an interactive UI button, let normal click happen
    const target = e.target as HTMLElement | null;
    if (
      target?.tagName === 'BUTTON' ||
      target?.tagName === 'INPUT' ||
      target?.closest?.('button')
    ) {
      return;
    }

    // Ignore synthetic mouse events generated by touch-control gestures
    if (target?.closest?.('#touch-controls')) {
      return;
    }

    // Ignore compatibility mouse events synthesized from touch input
    // (explicit flag on Chrome/Edge; recency fallback for Safari/Firefox)
    if (isTouchSynthesized(e) || performance.now() - this.lastTouchPointerDownAt < 500) {
      return;
    }

    // Attempt pointer lock on any gameplay click if not locked yet
    if (!this.isPointerLocked) {
      this.requestLock();
    }

    if (e.button === 0) {
      this.fireHeld = true;
      this.firePressed = true;
    } else if (e.button === 2) {
      this.adsHeld = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.fireHeld = false;
    } else if (e.button === 2) {
      this.adsHeld = false;
    }
  }

  private onContextMenu(e: MouseEvent): void {
    // Right-click is used for ADS while playing; never show the browser menu then
    if (this.inputEnabled) {
      e.preventDefault();
    }
  }

  private onWindowBlur(): void {
    // The browser may not deliver mouseup when focus is lost mid-hold
    this.fireHeld = false;
    this.adsHeld = false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
  }

  private onPointerLockChange(): void {
    const locked = document.pointerLockElement !== null && document.pointerLockElement !== undefined;
    this.isPointerLocked = locked;

    if (locked) {
      // Clear pre-lock accumulation and drop the teleport event that follows
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
      this.ignoreNextMouseMove = true;
    } else {
      this.ignoreNextMouseMove = true;
      this.lastClientX = null;
      this.lastClientY = null;
      // Pointer lock can be lost (e.g. ESC) while buttons are held
      this.fireHeld = false;
      this.adsHeld = false;
    }
    for (const cb of this.lockChangeCallbacks) {
      cb(locked);
    }
  }

  private onPointerLockError(): void {
    this.isPointerLocked = false;
    this.ignoreNextMouseMove = true;
    this.lastClientX = null;
    this.lastClientY = null;
  }
}

export const inputManager = new InputManager();