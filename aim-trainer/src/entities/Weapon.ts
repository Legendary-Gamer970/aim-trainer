import * as THREE from 'three';
import { audioManager } from '../core/AudioManager';
import { settingsManager } from '../config/settings';

export class Weapon {
  public group: THREE.Group;
  private camera: THREE.Camera;

  // Base rest position relative to camera in first person
  private readonly restPosition = new THREE.Vector3(0.24, -0.21, -0.44);
  private readonly restRotation = new THREE.Euler(0.015, -0.04, 0.02);

  // Aim-down-sights pose (weapon lowered so the weapon body never covers the
  // optic ring; the 3D scope assembly retracts as ADS completes so the
  // magnified world stays fully visible through the CSS optic overlay)
  private readonly adsPosition = new THREE.Vector3(0.02, -0.13, -0.38);
  private readonly adsRotation = new THREE.Euler(0, 0, 0);
  private readonly adsLerpSpeed = 10; // higher = snappier ADS transition
  private adsTarget: number = 0; // 0 = hip, 1 = scoped
  private adsAmount: number = 0; // smoothed

  // Weapon sub-meshes
  private bodyMesh!: THREE.Mesh;
  private handguardMesh!: THREE.Mesh;
  private barrelMesh!: THREE.Mesh;
  private muzzleBrakeMesh!: THREE.Mesh;
  private stockMesh!: THREE.Mesh;
  private gripMesh!: THREE.Mesh;
  private magazineMesh!: THREE.Mesh;
  private scopeTubeMesh!: THREE.Mesh;
  private scopeRingFrontMesh!: THREE.Mesh;
  private scopeRingRearMesh!: THREE.Mesh;
  private scopeLensFrontMesh!: THREE.Mesh;
  public scopeLensRearMesh!: THREE.Mesh;
  private scopeDotMesh!: THREE.Mesh;
  private accentStripeMesh!: THREE.Mesh;

  // Muzzle effects
  private muzzleGroup: THREE.Group;
  private muzzleFlashMesh!: THREE.Mesh;
  private muzzleFlashTimer: number = 0;
  private readonly muzzleFlashDuration: number = 0.045; // seconds

  // Scope assembly (housing + lenses + reticle dot). Retracted as ADS completes
  // so the solid housing caps never block the magnified view inside the optic.
  public scopeAssembly: THREE.Group;

  // Muzzle smoke particles (pooled)
  private smokeParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number; active: boolean }[] = [];

  // Ammo & Reload state
  public magAmmo: number = 30;
  public readonly maxMagAmmo: number = 30;
  public reserveAmmo: number = 120;
  public isReloading: boolean = false;
  private reloadTime: number = 0;
  private readonly reloadDuration: number = 1.6; // 1.6 seconds reload

  // Sway & Recoil states
  private currentSway = new THREE.Vector3();
  private targetSway = new THREE.Vector3();
  private recoilZ: number = 0;
  private recoilPitch: number = 0;
  private recoilYaw: number = 0;
  private bobTime: number = 0;

  // Automatic fire rate (real-time clock so the cadence holds regardless of frame rate)
  private fireRate: number = 700; // rounds per minute
  private shotInterval: number = 60000 / 700; // ms between shots
  private nextShotRealMs: number = 0;
  private readonly now: () => number;

  // Subtle automatic-fire muzzle climb (builds while firing, settles after release)
  private autoRecoilY: number = 0;
  private readonly autoRecoilPerShot: number = 0.01;
  private readonly autoRecoilMax: number = 0.06;
  private readonly autoRecoilDecaySpeed: number = 2.0; // exponential settling per second

  constructor(camera: THREE.Camera, now: () => number = () => performance.now()) {
    this.camera = camera;
    this.now = now;
    this.group = new THREE.Group();
    this.muzzleGroup = new THREE.Group();

    this.fireRate = settingsManager.get('fireRate');
    this.shotInterval = 60000 / this.fireRate;
    settingsManager.subscribe((settings) => {
      this.fireRate = settings.fireRate;
      this.shotInterval = 60000 / this.fireRate;
    });

    this.buildRifleModel();
    this.buildMuzzleFlash();
    this.buildMuzzleSmoke();

    // Position gun at default first-person rest position
    this.group.position.copy(this.restPosition);
    this.group.rotation.copy(this.restRotation);

    // Attach weapon directly as a child of the camera
    this.camera.add(this.group);
  }

  private buildRifleModel(): void {
    // --- Tactical Stylized Materials ---
    // 1. Matte tactical polymer (deep slate charcoal)
    const polymerMat = new THREE.MeshStandardMaterial({
      color: 0x181f2b,
      roughness: 0.5,
      metalness: 0.3,
    });

    // 2. Gunmetal receiver alloy
    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x2b3445,
      roughness: 0.35,
      metalness: 0.8,
    });

    // 3. Polished steel barrel / chamber
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.25,
      metalness: 0.9,
    });

    // 4. Vibrant modern competition accent stripe (Coral Red)
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xff4655,
      roughness: 0.3,
      metalness: 0.4,
    });

    // 5. Glowing reticle dot
    const opticDotMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
    });

    // --- A. Main Receiver / Upper Body ---
    const bodyGeo = new THREE.BoxGeometry(0.048, 0.055, 0.26);
    this.bodyMesh = new THREE.Mesh(bodyGeo, gunmetalMat);
    this.bodyMesh.position.set(0, 0, 0);
    this.group.add(this.bodyMesh);

    // --- B. Handguard / Barrel Shroud ---
    const handguardGeo = new THREE.BoxGeometry(0.044, 0.048, 0.22);
    this.handguardMesh = new THREE.Mesh(handguardGeo, polymerMat);
    this.handguardMesh.position.set(0, 0.002, -0.22);
    this.group.add(this.handguardMesh);

    // --- C. Barrel ---
    const barrelGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 12);
    barrelGeo.rotateX(Math.PI / 2);
    this.barrelMesh = new THREE.Mesh(barrelGeo, steelMat);
    this.barrelMesh.position.set(0, 0.005, -0.38);
    this.group.add(this.barrelMesh);

    // --- D. Muzzle Brake / Compensator ---
    const brakeGeo = new THREE.BoxGeometry(0.024, 0.026, 0.045);
    this.muzzleBrakeMesh = new THREE.Mesh(brakeGeo, gunmetalMat);
    this.muzzleBrakeMesh.position.set(0, 0.005, -0.48);
    this.group.add(this.muzzleBrakeMesh);

    // --- E. Tactical Shoulder Stock ---
    const stockGeo = new THREE.BoxGeometry(0.038, 0.085, 0.18);
    this.stockMesh = new THREE.Mesh(stockGeo, polymerMat);
    this.stockMesh.position.set(0, -0.015, 0.21);
    this.group.add(this.stockMesh);

    // --- F. Ergonomic Pistol Grip ---
    const gripGeo = new THREE.BoxGeometry(0.036, 0.12, 0.052);
    this.gripMesh = new THREE.Mesh(gripGeo, polymerMat);
    this.gripMesh.position.set(0, -0.08, 0.07);
    this.gripMesh.rotation.x = -0.36; // Ergonomic backward angle
    this.group.add(this.gripMesh);

    // --- F2. Trigger Guard ---
    const guardGeo = new THREE.BoxGeometry(0.034, 0.05, 0.09);
    const triggerGuardMesh = new THREE.Mesh(guardGeo, polymerMat);
    triggerGuardMesh.position.set(0, -0.058, 0.045);
    this.group.add(triggerGuardMesh);

    // --- F3. Trigger ---
    const triggerGeo = new THREE.BoxGeometry(0.02, 0.032, 0.02);
    const triggerMesh = new THREE.Mesh(triggerGeo, steelMat);
    triggerMesh.position.set(0, -0.062, 0.075);
    triggerMesh.rotation.x = 0.3;
    this.group.add(triggerMesh);

    // --- G. Curved Tactical Magazine ---
    const magGeo = new THREE.BoxGeometry(0.032, 0.15, 0.065);
    this.magazineMesh = new THREE.Mesh(magGeo, polymerMat);
    this.magazineMesh.position.set(0, -0.09, -0.05);
    this.magazineMesh.rotation.x = 0.18; // Slight forward curve
    this.group.add(this.magazineMesh);

    // --- H. 2x Tactical Optical Scope (circular housing + glass lenses) ---
    const scopeHousingMat = new THREE.MeshStandardMaterial({
      color: 0x0c1016, // Deep matte black housing
      roughness: 0.4,
      metalness: 0.75,
    });

    const scopeGlassMat = new THREE.MeshStandardMaterial({
      color: 0x10151c, // Dark smoked glass
      roughness: 0.05,
      metalness: 0.5,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    // The whole optical assembly lives in its own group so it can retract
    // (scale to zero) as ADS completes, keeping the magnified view unobstructed
    this.scopeAssembly = new THREE.Group();

    // Mount rail bridging the scope to the receiver
    const scopeMountGeo = new THREE.BoxGeometry(0.014, 0.032, 0.1);
    const scopeMountMesh = new THREE.Mesh(scopeMountGeo, gunmetalMat);
    scopeMountMesh.position.set(0, 0.03, 0.008);
    this.scopeAssembly.add(scopeMountMesh);

    // Scope tube (cylinder aligned with the camera/bore axis)
    const scopeTubeGeo = new THREE.CylinderGeometry(0.023, 0.023, 0.12, 24);
    scopeTubeGeo.rotateX(Math.PI / 2);
    this.scopeTubeMesh = new THREE.Mesh(scopeTubeGeo, scopeHousingMat);
    this.scopeTubeMesh.position.set(0, 0.054, 0.008);
    this.scopeAssembly.add(this.scopeTubeMesh);

    // Front & rear housing rings
    const scopeRingGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.014, 24);
    scopeRingGeo.rotateX(Math.PI / 2);
    this.scopeRingFrontMesh = new THREE.Mesh(scopeRingGeo, scopeHousingMat);
    this.scopeRingFrontMesh.position.set(0, 0.054, -0.052);
    this.scopeAssembly.add(this.scopeRingFrontMesh);

    this.scopeRingRearMesh = new THREE.Mesh(scopeRingGeo.clone(), scopeHousingMat);
    this.scopeRingRearMesh.position.set(0, 0.054, 0.068);
    this.scopeAssembly.add(this.scopeRingRearMesh);

    // Front objective lens (faces the target)
    const scopeLensGeo = new THREE.CircleGeometry(0.02, 24);
    const scopeLensFrontMat = scopeGlassMat.clone();
    scopeLensFrontMat.opacity = 0.65;
    this.scopeLensFrontMesh = new THREE.Mesh(scopeLensGeo, scopeLensFrontMat);
    this.scopeLensFrontMesh.rotation.y = Math.PI;
    this.scopeLensFrontMesh.position.set(0, 0.054, -0.062);
    this.scopeAssembly.add(this.scopeLensFrontMesh);

    // Rear eyepiece lens (faces the camera; world stays visible through it)
    this.scopeLensRearMesh = new THREE.Mesh(scopeLensGeo, scopeGlassMat);
    this.scopeLensRearMesh.position.set(0, 0.054, 0.062);
    this.scopeAssembly.add(this.scopeLensRearMesh);

    // Glowing reticle dot inside the tube
    const dotGeo = new THREE.SphereGeometry(0.0025, 8, 8);
    this.scopeDotMesh = new THREE.Mesh(dotGeo, opticDotMat);
    this.scopeDotMesh.position.set(0, 0.054, 0.028);
    this.scopeAssembly.add(this.scopeDotMesh);

    this.group.add(this.scopeAssembly);

    // --- I. Accent Competition Stripe ---
    const accentGeo = new THREE.BoxGeometry(0.05, 0.008, 0.32);
    this.accentStripeMesh = new THREE.Mesh(accentGeo, accentMat);
    this.accentStripeMesh.position.set(0, 0.028, -0.08);
    this.group.add(this.accentStripeMesh);

    // Muzzle tip position for flash, tracers, and smoke
    this.muzzleGroup.position.set(0, 0.005, -0.51);
    this.group.add(this.muzzleGroup);
  }

  private buildMuzzleFlash(): void {
    const flashGeo = new THREE.OctahedronGeometry(0.055, 0);
    flashGeo.scale(1.4, 1.4, 3.2);

    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.95,
    });

    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.visible = false;
    this.muzzleGroup.add(this.muzzleFlashMesh);
  }

  private buildMuzzleSmoke(): void {
    const smokeGeo = new THREE.SphereGeometry(0.018, 6, 6);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xd8e2ec,
      transparent: true,
      opacity: 0.5,
    });

    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
      mesh.visible = false;
      this.muzzleGroup.add(mesh);
      this.smokeParticles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.2,
        active: false,
      });
    }
  }

  public canShoot(): boolean {
    return !this.isReloading && this.magAmmo > 0 && this.now() >= this.nextShotRealMs;
  }

  public shoot(): boolean {
    if (this.isReloading) return false;

    if (this.magAmmo <= 0) {
      audioManager.playDryFire();
      return false;
    }

    // Enforce the configured fire rate (one bullet per interval, real time)
    const now = this.now();
    if (now < this.nextShotRealMs) return false;

    // Decrement magazine ammo
    this.magAmmo--;
    this.nextShotRealMs = now + this.shotInterval;

    // Accumulate subtle muzzle climb while firing automatically
    this.autoRecoilY = Math.min(this.autoRecoilMax, this.autoRecoilY + this.autoRecoilPerShot);

    // Play synthesized punchy gunshot audio
    audioManager.playGunshot();

    // 1. Recoil impulse (snappy kick back & muzzle rise)
    this.recoilZ = 0.065;
    this.recoilPitch = 0.095;
    this.recoilYaw = (Math.random() - 0.5) * 0.015;

    // 2. Muzzle Flash
    this.muzzleFlashMesh.visible = true;
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    const s = 0.9 + Math.random() * 0.4;
    this.muzzleFlashMesh.scale.set(s, s, s * 1.8);
    this.muzzleFlashTimer = this.muzzleFlashDuration;

    // 3. Muzzle Smoke Puff
    for (const p of this.smokeParticles) {
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.18 + Math.random() * 0.08;
        p.mesh.position.set(0, 0, 0);
        p.mesh.visible = true;
        p.mesh.scale.set(1, 1, 1);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.5;

        p.velocity.set(
          (Math.random() - 0.5) * 0.25,
          0.2 + Math.random() * 0.25,
          -0.6 - Math.random() * 0.6
        );
        break;
      }
    }

    return true;
  }

  public reload(): boolean {
    if (this.isReloading || this.magAmmo === this.maxMagAmmo || this.reserveAmmo <= 0) {
      return false;
    }

    this.isReloading = true;
    this.reloadTime = 0;
    audioManager.playReload();
    return true;
  }

  public getMuzzleWorldPosition(): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    this.muzzleGroup.getWorldPosition(worldPos);
    return worldPos;
  }

  /** Requests the ADS pose (true = scoped). Transition is smoothed over time. */
  public setADS(active: boolean): void {
    this.adsTarget = active ? 1 : 0;
  }

  /** Current smoothed ADS amount (0 = hip fire, 1 = fully scoped). */
  public getADSAmount(): number {
    return this.adsAmount;
  }

  /** True once the weapon is effectively scoped in. */
  public isADSActive(): boolean {
    return this.adsAmount > 0.5;
  }

  /** True while the real-time fire-rate gate blocks the next shot. */
  public isOnCooldown(): boolean {
    return this.now() < this.nextShotRealMs;
  }

  /** Milliseconds until the next shot is allowed. */
  public getTimeUntilNextShot(): number {
    return Math.max(0, this.nextShotRealMs - this.now());
  }

  public applyMouseSway(deltaX: number, deltaY: number): void {
    if (this.isReloading) return;

    this.targetSway.x = -deltaX * 0.06;
    this.targetSway.y = deltaY * 0.06;

    const maxSway = 0.045;
    this.targetSway.x = Math.max(-maxSway, Math.min(maxSway, this.targetSway.x));
    this.targetSway.y = Math.max(-maxSway, Math.min(maxSway, this.targetSway.y));
  }

  public update(deltaTime: number, isMoving: boolean): void {
    // 1. Muzzle Flash Timer
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= deltaTime;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
      }
    }

    // 2. Muzzle Smoke Particles Update
    for (const p of this.smokeParticles) {
      if (p.active) {
        p.life += deltaTime;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.mesh.position.addScaledVector(p.velocity, deltaTime);
          const progress = p.life / p.maxLife;
          const scale = 1.0 + progress * 2.5;
          p.mesh.scale.set(scale, scale, scale);
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - progress) * 0.45;
        }
      }
    }

    // 3. Reload Animation & Logic
    let reloadOffsetY = 0;
    let reloadOffsetPitch = 0;
    let reloadOffsetRoll = 0;

    if (this.isReloading) {
      this.reloadTime += deltaTime;
      const progress = Math.min(1.0, this.reloadTime / this.reloadDuration);

      if (progress < 0.3) {
        // Phase 1: Lower gun, tilt left
        const t = progress / 0.3;
        reloadOffsetY = -0.12 * Math.sin(t * Math.PI * 0.5);
        reloadOffsetPitch = -0.25 * Math.sin(t * Math.PI * 0.5);
        reloadOffsetRoll = -0.35 * Math.sin(t * Math.PI * 0.5);
        this.magazineMesh.position.y = -0.09 - t * 0.08;
      } else if (progress < 0.7) {
        // Phase 2: Mag insertion
        const t = (progress - 0.3) / 0.4;
        reloadOffsetY = -0.12;
        reloadOffsetPitch = -0.25;
        reloadOffsetRoll = -0.35;
        this.magazineMesh.position.y = -0.17 + t * 0.08;
      } else if (progress < 1.0) {
        // Phase 3: Rack bolt & raise back to ready
        const t = (progress - 0.7) / 0.3;
        reloadOffsetY = -0.12 * (1 - t);
        reloadOffsetPitch = -0.25 * (1 - t);
        reloadOffsetRoll = -0.35 * (1 - t);
        this.magazineMesh.position.y = -0.09;
      } else {
        // Reload complete: replenish ammo from reserve
        const needed = this.maxMagAmmo - this.magAmmo;
        const available = Math.min(needed, this.reserveAmmo);
        this.magAmmo += available;
        this.reserveAmmo -= available;

        this.isReloading = false;
        this.reloadTime = 0;
        this.magazineMesh.position.set(0, -0.09, -0.05);
      }
    }

    // 4. Fire-rate cooldown no longer lives here: the fire gate uses the real-time
    //    clock so the cadence holds regardless of the dt-clamped frame rate.

    // 4b. ADS transition smoothing
    this.adsAmount += (this.adsTarget - this.adsAmount) * (1 - Math.exp(-this.adsLerpSpeed * deltaTime));

    // 4b2. Retract the 3D scope assembly as ADS completes so the solid housing
    // caps never block the magnified view inside the optic. The CSS ring,
    // vignette, and reticle replace the physical housing at full zoom.
    const retractAmount = Math.min(1, Math.max(0, (this.adsAmount - 0.5) * 2));
    this.scopeAssembly.scale.setScalar(1 - retractAmount);

    // 4c. Automatic-fire muzzle climb recovery (exponential settling)
    this.autoRecoilY *= Math.max(0, 1 - this.autoRecoilDecaySpeed * deltaTime);

    // 4d. Smooth Mouse Sway Interpolation (damped while scoped)
    const swayDamp = 1 - this.adsAmount * 0.7;
    const swaySpeed = 10.0;
    this.currentSway.x += (this.targetSway.x - this.currentSway.x) * swaySpeed * deltaTime;
    this.currentSway.y += (this.targetSway.y - this.currentSway.y) * swaySpeed * deltaTime;
    this.targetSway.multiplyScalar(Math.max(0, 1 - 12 * deltaTime));

    // 5. Recoil Recovery (clamped so recoil never inverts below its rest pose)
    const recoilRecoverSpeed = 16.0;
    this.recoilZ = Math.max(0, this.recoilZ + (0 - this.recoilZ) * recoilRecoverSpeed * deltaTime);
    this.recoilPitch = Math.max(0, this.recoilPitch + (0 - this.recoilPitch) * (recoilRecoverSpeed + 4) * deltaTime);
    this.recoilYaw += (0 - this.recoilYaw) * recoilRecoverSpeed * deltaTime;

    // 6. Movement Bobbing
    let bobX = 0;
    let bobY = 0;
    if (isMoving && !this.isReloading) {
      this.bobTime += deltaTime * 8.0;
      bobX = Math.sin(this.bobTime) * 0.005;
      bobY = Math.abs(Math.cos(this.bobTime)) * 0.006;
    } else {
      this.bobTime = 0;
    }

    // 7. Apply Final Transform to Gun Group (interpolated between hip and ADS poses)
    const ads = this.adsAmount;
    const swayX = this.currentSway.x * swayDamp;
    const swayY = this.currentSway.y * swayDamp;
    const climbDamp = 1 - ads * 0.5;
    const posX = THREE.MathUtils.lerp(this.restPosition.x, this.adsPosition.x, ads) + swayX + bobX;
    const posY = THREE.MathUtils.lerp(this.restPosition.y, this.adsPosition.y, ads) + swayY - bobY + reloadOffsetY;
    const posZ = THREE.MathUtils.lerp(this.restPosition.z, this.adsPosition.z, ads) + this.recoilZ;

    this.group.position.set(posX, posY, posZ);

    this.group.rotation.set(
      THREE.MathUtils.lerp(this.restRotation.x, this.adsRotation.x, ads) + this.recoilPitch + this.autoRecoilY * climbDamp - swayY * 0.8 + reloadOffsetPitch,
      THREE.MathUtils.lerp(this.restRotation.y, this.adsRotation.y, ads) + this.recoilYaw + swayX * 0.8,
      THREE.MathUtils.lerp(this.restRotation.z, this.adsRotation.z, ads) - swayX * 1.2 + reloadOffsetRoll
    );
  }

  public reset(): void {
    this.magAmmo = this.maxMagAmmo;
    this.reserveAmmo = 120;
    this.isReloading = false;
    this.reloadTime = 0;
    this.recoilZ = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.nextShotRealMs = 0;
    this.autoRecoilY = 0;
    this.adsTarget = 0;
    this.adsAmount = 0;
    this.scopeAssembly.scale.setScalar(1);
    this.currentSway.set(0, 0, 0);
    this.targetSway.set(0, 0, 0);
    this.group.position.copy(this.restPosition);
    this.group.rotation.copy(this.restRotation);
    this.magazineMesh.position.set(0, -0.09, -0.05);
  }

  public dispose(): void {
    this.camera.remove(this.group);
  }
}
