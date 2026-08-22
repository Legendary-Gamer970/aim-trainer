import * as THREE from 'three';
import { GAME_CONFIG } from '../config/constants';
import { settingsManager } from '../config/settings';

export type UpdateCallback = (delta: number, elapsed: number) => void;
export type FPSCallback = (fps: number, frameTimeMs: number) => void;

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private totalElapsed: number = 0;

  // Performance & FPS tracking
  private frameCount: number = 0;
  private fpsAccumulator: number = 0;
  private currentFps: number = 60;
  private currentFrameTimeMs: number = 16.6;
  private fpsCallbacks: Set<FPSCallback> = new Set();

  private updateCallbacks: Set<UpdateCallback> = new Set();

  // ADS zoom: amount 0..1, lerped from baseFov toward baseFov * zoomStrength
  private zoomAmount: number = 0;
  private baseFov: number = 90;
  private zoomStrength: number = 0.5;

  constructor(container: HTMLElement) {
    // 1. Scene: warm indoor training hall (subtle haze for depth)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe6dcc8);
    this.scene.fog = new THREE.FogExp2(0xe6dcc8, 0.0035);

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.baseFov = settingsManager.get('fov');
    // Tight far plane (hall is 45m deep) for maximum depth-buffer precision
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.1, 250);
    this.camera.position.set(0, GAME_CONFIG.PLAYER_HEIGHT, 0);

    // Listen to FOV changes from settings (rebase the zoom so ADS still scales correctly)
    settingsManager.subscribe((settings) => {
      this.baseFov = settings.fov;
      this.zoomStrength = settings.adsZoomStrength;
      this.applyFov();
    });

    // 3. Renderer (Optimized for integrated GPUs like Vega 7)
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      depth: true,
      stencil: false,
      alpha: false,
    });

    const pixelRatio = Math.min(window.devicePixelRatio, GAME_CONFIG.MAX_PIXEL_RATIO);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    container.appendChild(this.renderer.domElement);

    // 4. Resize listener
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Bind loop
    this.loop = this.loop.bind(this);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
  }

  public onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  public onFPSUpdate(callback: FPSCallback): () => void {
    this.fpsCallbacks.add(callback);
    return () => this.fpsCallbacks.delete(callback);
  }

  public getFPS(): number {
    return this.currentFps;
  }

  /**
   * Sets the ADS zoom amount (0 = normal FOV, 1 = fully scoped).
   * The FOV is lerped from the configured base FOV toward base * zoomStrength.
   */
  public setZoom(amount: number): void {
    const clamped = Math.max(0, Math.min(1, amount));
    if (clamped !== this.zoomAmount) {
      this.zoomAmount = clamped;
      this.applyFov();
    }
  }

  public getZoomAmount(): number {
    return this.zoomAmount;
  }

  private applyFov(): void {
    const target = this.baseFov * (1 - (1 - this.zoomStrength) * this.zoomAmount);
    if (this.camera.fov !== target) {
      this.camera.fov = target;
      this.camera.updateProjectionMatrix();
    }
  }

  public getFrameTime(): number {
    return this.currentFrameTimeMs;
  }

  /** Total elapsed game time in seconds (dt-clamped, frame-rate independent). */
  public getElapsedTime(): number {
    return this.totalElapsed;
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    requestAnimationFrame(this.loop);

    const deltaMs = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Clamp delta time to avoid large jumps (e.g. if tab is unfocused)
    const deltaSeconds = Math.min(deltaMs / 1000, 0.1);
    this.totalElapsed += deltaSeconds;

    // Performance measurements
    this.frameCount++;
    this.fpsAccumulator += deltaMs;
    if (this.fpsAccumulator >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / this.fpsAccumulator);
      this.currentFrameTimeMs = Number((this.fpsAccumulator / this.frameCount).toFixed(1));
      this.frameCount = 0;
      this.fpsAccumulator = 0;

      for (const cb of this.fpsCallbacks) {
        cb(this.currentFps, this.currentFrameTimeMs);
      }
    }

    // Run updates
    for (const callback of this.updateCallbacks) {
      callback(deltaSeconds, this.totalElapsed);
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  public getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
