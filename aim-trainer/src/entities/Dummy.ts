import * as THREE from 'three';

export class Dummy {
  public group: THREE.Group;

  // Sub-groups for modular animation
  public headGroup: THREE.Group;
  public bodyGroup: THREE.Group;

  // Hitbox meshes
  public headMesh: THREE.Mesh;
  public faceVisorMesh: THREE.Mesh;
  public torsoMesh: THREE.Mesh;
  public chestTargetMesh: THREE.Mesh;
  public leftArmMesh: THREE.Mesh;
  public rightArmMesh: THREE.Mesh;
  public legsMesh: THREE.Mesh;

  // Materials
  private headMat: THREE.MeshStandardMaterial;
  private visorMat: THREE.MeshStandardMaterial;
  private torsoMat: THREE.MeshStandardMaterial;
  private chestTargetMat: THREE.MeshStandardMaterial;
  private limbsMat: THREE.MeshStandardMaterial;

  // State
  public spawnTime: number = 0;
  public isEliminated: boolean = false;
  public isRespawning: boolean = false;

  // Smooth horizontal patrol (Free Training moving dummies)
  private patrolEnabled: boolean = false;
  private patrolBaseX: number = 0;
  private patrolAmplitude: number = 2.0;
  private patrolSpeed: number = 1.0;
  private patrolPhase: number = 0;
  private patrolTime: number = 0;

  // Quick despawn (Flick target window expiry)
  private isDespawning: boolean = false;
  private despawnTimer: number = 0;

  // Knock-down fall timeline (seconds)
  private static readonly FALL_REACTION_DURATION = 0.15; // hit reaction before tipping
  private static readonly FALL_DURATION = 0.35; // tip backward to the ground
  private static readonly FALL_DOWN_DURATION = 0.7; // stays down before recycle
  private static readonly FALL_MAX_ANGLE = -1.4; // radians (~80 deg), lies on its back
  private static readonly FALL_KNOCKBACK = 0.07; // meters pushed backward

  // Reaction animations
  private headSnapTime: number = 0;
  private bodyWobbleTime: number = 0;
  private spawnScale: number = 1.0;
  private respawnTimer: number = 0;

  // Fall state machine ('idle' | 'reacting' | 'falling' | 'down')
  private fallState: 'idle' | 'reacting' | 'falling' | 'down' = 'idle';
  private fallElapsed: number = 0;
  private fallBaseZ: number = 0;

  /**
   * Fired once when the fall reaches the ground (falling -> down transition).
   * Used by Flick Training to spawn the next target without overlapping the
   * falling dummy. Recycles on respawn.
   */
  public onFallReachedGround: (() => void) | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.bodyGroup = new THREE.Group();

    // 1. Stylized Materials
    this.torsoMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Deep tactical slate
      roughness: 0.5,
      metalness: 0.2,
    });

    this.headMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.3,
    });

    this.visorMat = new THREE.MeshStandardMaterial({
      color: 0xff4655, // Vibrant competition coral face visor
      roughness: 0.25,
      metalness: 0.4,
    });

    this.chestTargetMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Crisp white chest plate with coral bullseye
      roughness: 0.3,
      metalness: 0.1,
    });

    this.limbsMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, // Stylized competition teal accents
      roughness: 0.5,
      metalness: 0.15,
    });

    // --- 2. Build Legs / Pedestal Base (Y: 0 to 0.75m) ---
    const legsGeo = new THREE.BoxGeometry(0.38, 0.75, 0.26);
    this.legsMesh = new THREE.Mesh(legsGeo, this.torsoMat);
    this.legsMesh.position.set(0, 0.375, 0);
    this.group.add(this.legsMesh);

    // Stand base plate
    const basePlateGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.08, 16);
    const basePlate = new THREE.Mesh(basePlateGeo, this.limbsMat);
    basePlate.position.set(0, 0.04, 0);
    this.group.add(basePlate);

    // --- 3. Build Body / Torso (Y: 0.75 to 1.35m) ---
    this.bodyGroup.position.set(0, 0.75, 0);
    this.group.add(this.bodyGroup);

    const torsoGeo = new THREE.BoxGeometry(0.48, 0.60, 0.28);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.torsoMat);
    this.torsoMesh.position.set(0, 0.30, 0);
    this.bodyGroup.add(this.torsoMesh);

    // Chest Target Plate (Front Bullseye)
    const chestPlateGeo = new THREE.BoxGeometry(0.32, 0.38, 0.04);
    this.chestTargetMesh = new THREE.Mesh(chestPlateGeo, this.chestTargetMat);
    this.chestTargetMesh.position.set(0, 0.32, 0.14);
    this.bodyGroup.add(this.chestTargetMesh);

    // Center Chest Coral Ring
    const bullseyeGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16);
    bullseyeGeo.rotateX(Math.PI / 2);
    const chestBullseye = new THREE.Mesh(bullseyeGeo, this.visorMat);
    chestBullseye.position.set(0, 0.32, 0.165);
    this.bodyGroup.add(chestBullseye);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.12, 0.52, 0.16);
    this.leftArmMesh = new THREE.Mesh(armGeo, this.limbsMat);
    this.leftArmMesh.position.set(-0.31, 0.30, 0);
    this.bodyGroup.add(this.leftArmMesh);

    this.rightArmMesh = new THREE.Mesh(armGeo, this.limbsMat);
    this.rightArmMesh.position.set(0.31, 0.30, 0);
    this.bodyGroup.add(this.rightArmMesh);

    // --- 4. Build Head (Y: 1.35m to 1.75m) ---
    this.headGroup.position.set(0, 0.60, 0);
    this.bodyGroup.add(this.headGroup);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12);
    const neck = new THREE.Mesh(neckGeo, this.torsoMat);
    neck.position.set(0, 0.04, 0);
    this.headGroup.add(neck);

    // Head Block / Helmet
    const headGeo = new THREE.BoxGeometry(0.26, 0.28, 0.26);
    this.headMesh = new THREE.Mesh(headGeo, this.headMat);
    this.headMesh.position.set(0, 0.20, 0);
    this.headGroup.add(this.headMesh);

    // Contrasting Face Visor (Target Zone)
    const visorGeo = new THREE.BoxGeometry(0.22, 0.14, 0.05);
    this.faceVisorMesh = new THREE.Mesh(visorGeo, this.visorMat);
    this.faceVisorMesh.position.set(0, 0.22, 0.12);
    this.headGroup.add(this.faceVisorMesh);

    // Tag Hitbox UserData
    this.headMesh.userData = { dummy: this, isHeadshot: true };
    this.faceVisorMesh.userData = { dummy: this, isHeadshot: true };

    this.torsoMesh.userData = { dummy: this, isHeadshot: false };
    this.chestTargetMesh.userData = { dummy: this, isHeadshot: false };
    this.leftArmMesh.userData = { dummy: this, isHeadshot: false };
    this.rightArmMesh.userData = { dummy: this, isHeadshot: false };
    this.legsMesh.userData = { dummy: this, isHeadshot: false };
  }

  public spawn(position: THREE.Vector3): void {
    this.group.position.copy(position);
    this.spawnTime = performance.now();
    this.isEliminated = false;
    this.isRespawning = false;
    this.isDespawning = false;
    this.despawnTimer = 0;
    this.spawnScale = 0.001;
    this.group.scale.set(0.001, 0.001, 0.001);
    this.group.visible = true;

    this.group.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.bodyGroup.rotation.set(0, 0, 0);

    // Reset reaction & fall state
    this.headSnapTime = 0;
    this.bodyWobbleTime = 0;
    this.respawnTimer = 0;
    this.fallState = 'idle';
    this.fallElapsed = 0;
    this.fallBaseZ = position.z;
    this.onFallReachedGround = null;

    // Reset material colors
    this.visorMat.color.setHex(0xff4655);
    this.chestTargetMat.color.setHex(0xf8fafc);
  }

  /**
   * Enables smooth sinusoidal patrol movement around the base X position.
   * The dummy glides left/right continuously within a bounded lane.
   */
  public setPatrol(baseX: number, amplitude: number, speed: number, phase: number = 0): void {
    this.patrolEnabled = true;
    this.patrolBaseX = baseX;
    this.patrolAmplitude = amplitude;
    this.patrolSpeed = speed;
    this.patrolPhase = phase;
    this.patrolTime = 0;
  }

  public disablePatrol(): void {
    this.patrolEnabled = false;
  }

  /**
   * Quickly scales the dummy down and hides it (used when a Flick target
   * window expires). The dummy is eliminated the moment it starts despawning.
   */
  public despawn(duration: number = 0.12): void {
    if (this.isDespawning || this.isEliminated) return;
    this.isEliminated = true;
    this.isDespawning = true;
    this.despawnTimer = duration;
  }

  public triggerHit(isHeadshot: boolean, autoRespawnDelay: number = 0): void {
    // A hit on a dummy that is already falling/down/despawning is ignored
    if (this.isEliminated || this.isDespawning) return;

    if (isHeadshot) {
      // Headshot: Snap head back
      this.headSnapTime = 0.18;
      this.visorMat.color.setHex(0xffffff);
    } else {
      // Body hit: Wobble torso
      this.bodyWobbleTime = 0.16;
      this.chestTargetMat.color.setHex(0xffffff);
    }

    // Knock-down: react briefly, tip backward around the feet, stay down,
    // then disappear/recycle. The dummy stops being hittable immediately.
    this.isEliminated = true;
    this.fallState = 'reacting';
    this.fallElapsed = 0;
    this.fallBaseZ = this.group.position.z;

    if (autoRespawnDelay > 0) {
      this.respawnTimer = autoRespawnDelay;
    }
  }

  /** True while the knock-down fall animation is playing (react/fall/down). */
  public isFallInProgress(): boolean {
    return this.fallState !== 'idle';
  }

  public update(deltaTime: number): void {
    // 0. Smooth horizontal patrol movement (Free Training tracking dummies)
    if (this.patrolEnabled) {
      this.patrolTime += deltaTime;
      this.group.position.x = this.patrolBaseX + Math.sin(this.patrolTime * this.patrolSpeed + this.patrolPhase) * this.patrolAmplitude;
    }

    // 0b. Quick despawn animation (shrink then hide)
    if (this.isDespawning) {
      this.despawnTimer -= deltaTime;
      const progress = Math.max(0, this.despawnTimer / 0.12);
      const s = Math.max(0.001, progress);
      this.group.scale.set(s, s, s);
      if (this.despawnTimer <= 0) {
        this.isDespawning = false;
        this.group.visible = false;
      }
      return;
    }

    // 1. Spawn Pop-in Animation
    if (this.spawnScale < 1.0) {
      this.spawnScale += deltaTime * 12.0;
      if (this.spawnScale >= 1.0) {
        this.spawnScale = 1.0;
        this.group.scale.set(1, 1, 1);
      } else {
        const s = 1.0 + Math.sin(this.spawnScale * Math.PI) * 0.18;
        this.group.scale.set(s, s, s);
      }
    }

    // 2. Headshot Reaction (Head snaps back & recovers)
    if (this.headSnapTime > 0) {
      this.headSnapTime -= deltaTime;
      const progress = 1.0 - this.headSnapTime / 0.18;
      const angle = Math.sin(progress * Math.PI) * -0.45; // ~25 deg tilt back
      this.headGroup.rotation.x = angle;

      if (this.headSnapTime <= 0) {
        this.headGroup.rotation.x = 0;
        this.visorMat.color.setHex(0xff4655);
      }
    }

    // 3. Body Hit Reaction (Torso wobbles back & recovers)
    if (this.bodyWobbleTime > 0) {
      this.bodyWobbleTime -= deltaTime;
      const progress = 1.0 - this.bodyWobbleTime / 0.16;
      const angle = Math.sin(progress * Math.PI) * -0.18; // ~10 deg wobble
      this.bodyGroup.rotation.x = angle;

      if (this.bodyWobbleTime <= 0) {
        this.bodyGroup.rotation.x = 0;
        this.chestTargetMat.color.setHex(0xf8fafc);
      }
    }

    // 3b. Knock-down fall animation (react -> tip backward -> stay down -> recycle)
    if (this.fallState === 'reacting') {
      this.fallElapsed += deltaTime;
      if (this.fallElapsed >= Dummy.FALL_REACTION_DURATION) {
        this.fallElapsed -= Dummy.FALL_REACTION_DURATION;
        this.fallState = 'falling';
        this.updateFallPose();
      }
    } else if (this.fallState === 'falling') {
      this.fallElapsed += deltaTime;
      this.updateFallPose();
      if (this.fallElapsed >= Dummy.FALL_DURATION) {
        // Reached the ground: keep lying down, notify (next flick target can spawn)
        this.fallState = 'down';
        this.fallElapsed = 0;
        this.onFallReachedGround?.();
      }
    } else if (this.fallState === 'down') {
      this.fallElapsed += deltaTime;
      if (this.fallElapsed >= Dummy.FALL_DOWN_DURATION) {
        this.finishFall();
      }
    }

    // 4. Auto Respawn Timer
    if (this.isEliminated && this.respawnTimer > 0) {
      this.respawnTimer -= deltaTime;
      if (this.respawnTimer <= 0) {
        this.spawn(this.group.position.clone());
      }
    }
  }

  /**
   * Applies the backward tip rotation around the feet plus a small backward
   * push. Progress eases in (accelerating) so the fall feels natural.
   */
  private updateFallPose(): void {
    const progress = Math.min(1, this.fallElapsed / Dummy.FALL_DURATION);
    const eased = progress * progress;
    this.group.rotation.x = Dummy.FALL_MAX_ANGLE * eased;
    this.group.position.z = this.fallBaseZ - Dummy.FALL_KNOCKBACK * eased;
  }

  /**
   * Ends the knock-down: hides the dummy and recycles patrol dummies back to
   * their lane base so Free Practice stays populated.
   */
  private finishFall(): void {
    this.fallState = 'idle';
    this.fallElapsed = 0;
    this.group.visible = false;
    if (this.patrolEnabled) {
      this.patrolTime = 0;
      this.spawn(new THREE.Vector3(this.patrolBaseX, 0, this.fallBaseZ));
    }
  }

  public getHitboxMeshes(): THREE.Object3D[] {
    return [
      this.headMesh,
      this.faceVisorMesh,
      this.torsoMesh,
      this.chestTargetMesh,
      this.leftArmMesh,
      this.rightArmMesh,
      this.legsMesh,
    ];
  }

  public getHeadWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    this.headMesh.getWorldPosition(pos);
    return pos;
  }

  public getBodyWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    this.torsoMesh.getWorldPosition(pos);
    return pos;
  }

  public dispose(): void {
    this.headMesh.geometry.dispose();
    this.faceVisorMesh.geometry.dispose();
    this.torsoMesh.geometry.dispose();
    this.chestTargetMesh.geometry.dispose();
    this.leftArmMesh.geometry.dispose();
    this.rightArmMesh.geometry.dispose();
    this.legsMesh.geometry.dispose();

    this.headMat.dispose();
    this.visorMat.dispose();
    this.torsoMat.dispose();
    this.chestTargetMat.dispose();
    this.limbsMat.dispose();
  }
}
