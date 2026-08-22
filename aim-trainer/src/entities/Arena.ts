import * as THREE from 'three';
import { GAME_CONFIG } from '../config/constants';
import { BOOTH, BOOTH_BENCH, DOOR } from './ArenaColliders';

/**
 * Indoor competitive FPS training hall.
 * Warm industrial palette (beige/tan walls, wood beams, gray concrete,
 * orange/red accents). The center of the hall is a protected combat
 * volume: only the player, tracers, particles and bots live there.
 * All decorative geometry sits outside x=[-7,7], z=[-7,-27] so bots are
 * never occluded or intersected. Painted lane markings are baked into a
 * floor texture to eliminate z-fighting.
 */
export class Arena {
  public group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.buildHall();
    this.buildPlatform();
    this.buildTargetArea();
    this.buildSidePlatforms();
    this.buildBackArea();
    this.setupLighting();
  }

  private buildHall(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7d5536, roughness: 0.9 });
    const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x5f3f26, roughness: 0.9 });
    const graphiteMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.65, metalness: 0.35 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xe6e0d2, roughness: 0.95 });

    const add = (mesh: THREE.Mesh | THREE.InstancedMesh) => {
      this.group.add(mesh);
      return mesh;
    };

    // ============================================================
    // Hall floor: 34m wide, 40m deep, markings baked into texture
    // ============================================================
    const floorTexture = this.createFloorTexture();
    const floorGeo = new THREE.PlaneGeometry(34, 40);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -13);
    add(floor);

    // ============================================================
    // Enclosing walls + ceiling
    // ============================================================
    const wallTexture = this.createWallTexture();
    const wallMatTex = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.95 });

    const backWallGeo = new THREE.BoxGeometry(34, 12, 0.5);
    const backWall = new THREE.Mesh(backWallGeo, wallMatTex);
    backWall.position.set(0, 6, -33.25);
    add(backWall);

    const rearWallGeo = new THREE.BoxGeometry(34, 12, 0.5);
    const rearWall = new THREE.Mesh(rearWallGeo, wallMatTex);
    rearWall.position.set(0, 6, 7.25);
    add(rearWall);

    for (const side of [-1, 1]) {
      const wallGeo = new THREE.BoxGeometry(0.5, 12, 40.5);
      const wall = new THREE.Mesh(wallGeo, wallMatTex);
      wall.position.set(side * 17, 6, -13);
      add(wall);
    }

    const ceilingGeo = new THREE.PlaneGeometry(34.5, 40.5);
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 11, -13);
    add(ceiling);

    // Wood structural beams: cross beams along X, longitudinal along Z
    const crossBeams = [-30, -20, -10, 0, 5];
    for (const z of crossBeams) {
      const beamGeo = new THREE.BoxGeometry(36, 0.4, 0.45);
      const beam = new THREE.Mesh(beamGeo, woodMat);
      beam.position.set(0, 10.75, z);
      add(beam);
    }
    for (const x of [-10, 10]) {
      const beamGeo = new THREE.BoxGeometry(0.45, 0.4, 42);
      const beam = new THREE.Mesh(beamGeo, woodDarkMat);
      beam.position.set(x, 10.75, -13);
      add(beam);
    }

    // Warm ceiling light fixtures (subtle, between beams)
    const lightPanelMat = new THREE.MeshBasicMaterial({ color: 0xffe9c4 });
    for (const z of [-25, -15, -5, 3]) {
      for (const x of [-6, 0, 6]) {
        const panelGeo = new THREE.BoxGeometry(1.6, 0.06, 2.6);
        const panel = new THREE.Mesh(panelGeo, lightPanelMat);
        panel.position.set(x, 10.95, z);
        add(panel);
      }
    }

    // Wall base trim (concrete kick along the walls)
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x8f887c, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const trimGeo = new THREE.BoxGeometry(0.55, 0.5, 40.5);
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(side * 17, 0.25, -13);
      add(trim);
    }
    for (const z of [-33.25, 7.25]) {
      const trimGeo = new THREE.BoxGeometry(34, 0.5, 0.55);
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(0, 0.25, z);
      add(trim);
    }

    // Wood columns on the side walls
    for (const side of [-1, 1]) {
      for (const z of [-30, -22, -14, -6, 2]) {
        const columnGeo = new THREE.BoxGeometry(0.55, 11, 0.55);
        const column = new THREE.Mesh(columnGeo, woodMat);
        column.position.set(side * 16.75, 5.5, z);
        add(column);
      }
    }

    // ============================================================
    // Distance signs on the side walls (outside combat volume)
    // ============================================================
    for (const side of [-1, 1]) {
      for (const [zPos, label] of [[-10, '10M'], [-15, '15M'], [-20, '20M'], [-25, '25M'], [-30, '30M']] as Array<[number, string]>) {
        const plateGeo = new THREE.BoxGeometry(1.5, 0.9, 0.06);
        const plate = new THREE.Mesh(plateGeo, graphiteMat);
        plate.position.set(side * 16.2, 2.6, zPos);
        add(plate);
        const labelTexture = this.createLabelTexture(label, '', '#e8e2d4', '#3c4046');
        const labelGeo = new THREE.PlaneGeometry(1.1, 0.6);
        const labelMesh = new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: labelTexture }));
        labelMesh.position.set(side * 16.35, 2.6, zPos);
        add(labelMesh);
      }
    }
  }

  private buildPlatform(): void {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb3ab9c, roughness: 0.92 });
    const concreteDarkMat = new THREE.MeshStandardMaterial({ color: 0x8f887c, roughness: 0.92 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7d5536, roughness: 0.9 });
    const graphiteMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.65, metalness: 0.35 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.55, metalness: 0.55 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xd9702c, roughness: 0.6 });

    const add = (mesh: THREE.Mesh) => {
      this.group.add(mesh);
      return mesh;
    };

    const {
      PLATFORM_X_MIN: pxMin,
      PLATFORM_X_MAX: pxMax,
      PLATFORM_Z_FRONT: pzFront,
      PLATFORM_Z_BACK: pzBack,
      PLATFORM_HEIGHT: pHeight,
    } = GAME_CONFIG;
    const platformW = pxMax - pxMin;
    const platformD = pzBack - pzFront;
    const platformX = (pxMin + pxMax) / 2;
    const platformZ = (pzFront + pzBack) / 2;

    // Raised concrete firing pad
    const platformGeo = new THREE.BoxGeometry(platformW, pHeight, platformD);
    const platform = new THREE.Mesh(platformGeo, concreteMat);
    platform.position.set(platformX, pHeight / 2, platformZ);
    add(platform);

    // Hazard firing line stripe on the platform's front edge
    const hazardTexture = this.createHazardTexture();
    const firingLineGeo = new THREE.PlaneGeometry(platformW, 0.34);
    const firingLine = new THREE.Mesh(firingLineGeo, new THREE.MeshBasicMaterial({ map: hazardTexture }));
    firingLine.rotation.x = -Math.PI / 2;
    firingLine.position.set(platformX, pHeight + 0.02, pzFront + 0.32);
    add(firingLine);

    // Caution blocks at the platform back edge
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const blockGeo = new THREE.BoxGeometry(0.22, 0.06, 0.22);
      const block = new THREE.Mesh(blockGeo, orangeMat);
      block.position.set(platformX + i * 1.1, pHeight + 0.03, pzBack - 0.3);
      add(block);
    }

    // Firing counter bench: low wooden bench, no giant blue wall
    const benchW = BOOTH_BENCH.maxX - BOOTH_BENCH.minX;
    const benchTopGeo = new THREE.BoxGeometry(benchW, 0.07, 0.5);
    const benchTop = new THREE.Mesh(benchTopGeo, woodMat);
    benchTop.position.set(platformX, 0.72, pzFront - 0.18);
    add(benchTop);
    const benchFrontGeo = new THREE.BoxGeometry(benchW, 0.52, 0.08);
    const benchFront = new THREE.Mesh(benchFrontGeo, graphiteMat);
    benchFront.position.set(platformX, 0.43, pzFront + 0.07);
    add(benchFront);
    for (const side of [-1, 1]) {
      const legGeo = new THREE.BoxGeometry(0.12, 0.72, 0.5);
      const leg = new THREE.Mesh(legGeo, concreteDarkMat);
      leg.position.set(platformX + side * (benchW / 2 - 0.15), 0.36, pzFront - 0.18);
      add(leg);
    }
    const benchStripeGeo = new THREE.BoxGeometry(benchW, 0.05, 0.52);
    const benchStripe = new THREE.Mesh(benchStripeGeo, orangeMat);
    benchStripe.position.set(platformX, 0.75, pzFront - 0.18);
    add(benchStripe);

    // Shooting booth: half-height side walls flanking the firing position
    const boothWallLen = BOOTH.wallZBack - BOOTH.wallZFront;
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.7, metalness: 0.4 });
    for (const side of [-1, 1]) {
      const xPos = side * BOOTH.halfWidth;
      for (const zPos of [BOOTH.wallZFront, BOOTH.wallZBack]) {
        const postGeo = new THREE.BoxGeometry(0.12, BOOTH.wallHeight, 0.12);
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.set(xPos, BOOTH.wallHeight / 2, zPos);
        add(post);
      }
      const kickGeo = new THREE.BoxGeometry(BOOTH.wallThickness, 0.14, boothWallLen);
      const kick = new THREE.Mesh(kickGeo, concreteDarkMat);
      kick.position.set(xPos, 0.07, (BOOTH.wallZFront + BOOTH.wallZBack) / 2);
      add(kick);
      const panelGeo = new THREE.BoxGeometry(BOOTH.wallThickness, 0.86, boothWallLen);
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(xPos, 0.61, (BOOTH.wallZFront + BOOTH.wallZBack) / 2);
      add(panel);
      const topRailGeo = new THREE.BoxGeometry(0.16, 0.1, boothWallLen);
      const topRail = new THREE.Mesh(topRailGeo, woodMat);
      topRail.position.set(xPos, 1.13, (BOOTH.wallZFront + BOOTH.wallZBack) / 2);
      add(topRail);
    }

    // Front grill barrier with a walkable gate on the left side
    const grillCenterX = (BOOTH.grillMinX + BOOTH.grillMaxX) / 2;
    const grillCenterZ = (BOOTH.grillZMin + BOOTH.grillZMax) / 2;
    const baseRailGeo = new THREE.BoxGeometry(BOOTH.grillMaxX - BOOTH.grillMinX, 0.12, 0.4);
    const baseRail = new THREE.Mesh(baseRailGeo, graphiteMat);
    baseRail.position.set(grillCenterX, 0.06, grillCenterZ);
    add(baseRail);

    const barCount = 15;
    const barGeo = new THREE.BoxGeometry(0.05, BOOTH.grillHeight - 0.16, 0.05);
    const bars = new THREE.InstancedMesh(barGeo, metalMat, barCount);
    const barM = new THREE.Matrix4();
    const barGap = (BOOTH.grillMaxX - BOOTH.grillMinX) / (barCount - 1);
    for (let i = 0; i < barCount; i++) {
      barM.compose(
        new THREE.Vector3(BOOTH.grillMinX + i * barGap, 0.53, grillCenterZ),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1)
      );
      bars.setMatrixAt(i, barM);
    }
    bars.instanceMatrix.needsUpdate = true;
    add(bars);

    const topRailGeo = new THREE.BoxGeometry(BOOTH.grillMaxX - BOOTH.grillMinX, 0.08, 0.36);
    const topRail = new THREE.Mesh(topRailGeo, orangeMat);
    topRail.position.set(grillCenterX, BOOTH.grillHeight, grillCenterZ);
    add(topRail);

    // Gate post marking the left edge of the grill
    const gatePostGeo = new THREE.BoxGeometry(0.14, BOOTH.grillHeight + 0.06, 0.14);
    const gatePost = new THREE.Mesh(gatePostGeo, graphiteMat);
    gatePost.position.set(BOOTH.grillMinX, 0.53, grillCenterZ);
    add(gatePost);
    const gateCapGeo = new THREE.BoxGeometry(0.18, 0.06, 0.18);
    const gateCap = new THREE.Mesh(gateCapGeo, orangeMat);
    gateCap.position.set(BOOTH.grillMinX, BOOTH.grillHeight + 0.05, grillCenterZ);
    add(gateCap);

    // Lane plate on the left booth wall, visible from inside the booth
    const laneTexture = this.createLabelTexture('LANE 2', '', '#e8e2d4', '#3c4046');
    const laneGeo = new THREE.PlaneGeometry(0.6, 0.3);
    const lane = new THREE.Mesh(laneGeo, new THREE.MeshBasicMaterial({ map: laneTexture }));
    lane.position.set(-BOOTH.halfWidth - 0.06, 0.85, -1.9);
    lane.rotation.y = Math.PI / 2;
    add(lane);

    // Side safety rails (low graphite posts + single rail)
    for (const side of [-1, 1]) {
      const xPos = (side > 0 ? pxMax : pxMin) + side * 0.12;
      const railGeo = new THREE.BoxGeometry(0.09, 0.09, platformD + 0.8);
      const rail = new THREE.Mesh(railGeo, metalMat);
      rail.position.set(xPos, 1.02, platformZ);
      add(rail);
      for (let i = 0; i < 4; i++) {
        const postGeo = new THREE.BoxGeometry(0.09, 1.02, 0.09);
        const post = new THREE.Mesh(postGeo, graphiteMat);
        post.position.set(xPos, 0.51, pzFront + 0.35 + i * (platformD / 3.4));
        add(post);
      }
      const plateGeo = new THREE.BoxGeometry(0.07, 0.34, 1.2);
      const plate = new THREE.Mesh(plateGeo, orangeMat);
      plate.position.set(xPos, 1.35, platformZ + 0.1);
      add(plate);
    }
  }

  private buildTargetArea(): void {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb3ab9c, roughness: 0.92 });
    const concreteDarkMat = new THREE.MeshStandardMaterial({ color: 0x8f887c, roughness: 0.92 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7d5536, roughness: 0.9 });
    const graphiteMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.65, metalness: 0.35 });

    const add = (mesh: THREE.Mesh) => {
      this.group.add(mesh);
      return mesh;
    };

    // Backstop curb at the far end (behind the 30m mark, outside bot zone)
    const curbGeo = new THREE.BoxGeometry(34, 0.35, 0.6);
    const curb = new THREE.Mesh(curbGeo, concreteMat);
    curb.position.set(0, 0.175, -31.4);
    add(curb);
    const hazardTexture = this.createHazardTexture();
    const curbStripeGeo = new THREE.PlaneGeometry(34, 0.22);
    const curbStripe = new THREE.Mesh(curbStripeGeo, new THREE.MeshBasicMaterial({ map: hazardTexture }));
    curbStripe.rotation.x = -Math.PI / 2;
    curbStripe.position.set(0, 0.36, -31.4);
    add(curbStripe);

    // Target holders on the curb
    for (const x of [-8, -4, 0, 4, 8]) {
      const holderGeo = new THREE.BoxGeometry(0.32, 0.55, 0.16);
      const holder = new THREE.Mesh(holderGeo, graphiteMat);
      holder.position.set(x, 0.62, -31.0);
      add(holder);
    }

    // Dark impact band low on the back wall (behind bots, below head height)
    const bandGeo = new THREE.BoxGeometry(34.2, 3.2, 0.06);
    const band = new THREE.Mesh(bandGeo, concreteDarkMat);
    band.position.set(0, 1.6, -32.97);
    add(band);

    // Bullseye plaques high on the back wall (above bot head space)
    const plaqueTexture = this.createBullseyeTexture();
    for (const x of [-6, 0, 6]) {
      const plaqueGeo = new THREE.PlaneGeometry(1.6, 1.6);
      const plaque = new THREE.Mesh(plaqueGeo, new THREE.MeshBasicMaterial({ map: plaqueTexture }));
      plaque.position.set(x, 5.7, -32.96);
      add(plaque);
    }

    // Facility signboard: backing board + metal frame, mounted on the back wall
    const signTexture = this.createLabelTexture('APEX AIM RANGE', 'SHOOTING FACILITY', '#f4efe4', '#3c4046');
    const signBoardGeo = new THREE.BoxGeometry(9.6, 3.0, 0.1);
    const signBoard = new THREE.Mesh(signBoardGeo, woodMat);
    signBoard.position.set(0, 7.6, -32.9);
    add(signBoard);
    const frameStrips: Array<[number, number, number, number]> = [
      [0, 9.17, 9.8, 0.14], [0, 6.03, 9.8, 0.14], [-4.8, 7.6, 0.14, 3.28], [4.8, 7.6, 0.14, 3.28],
    ];
    for (const [x, y, w, h] of frameStrips) {
      const stripGeo = new THREE.BoxGeometry(w, h, 0.16);
      const strip = new THREE.Mesh(stripGeo, graphiteMat);
      strip.position.set(x, y, -32.9);
      add(strip);
    }
    const signGeo = new THREE.PlaneGeometry(9, 2.6);
    const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTexture }));
    sign.position.set(0, 7.6, -32.84);
    add(sign);
    for (const side of [-1, 1]) {
      const bracketGeo = new THREE.BoxGeometry(0.14, 0.5, 0.25);
      const bracket = new THREE.Mesh(bracketGeo, graphiteMat);
      bracket.position.set(side * 4.6, 5.85, -32.97);
      add(bracket);
    }

    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff4d3d });
    const lightGeo = new THREE.BoxGeometry(1.2, 0.3, 0.12);
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(0, 6.35, -32.9);
    add(light);
  }

  private buildSidePlatforms(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7d5536, roughness: 0.9 });
    const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x5f3f26, roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.55, metalness: 0.55 });
    const graphiteMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.65, metalness: 0.35 });

    const add = (mesh: THREE.Mesh) => {
      this.group.add(mesh);
      return mesh;
    };

    for (const side of [-1, 1]) {
      const xPos = side * 14.2;
      // Deck
      const deckGeo = new THREE.BoxGeometry(3.4, 0.18, 15);
      const deck = new THREE.Mesh(deckGeo, woodMat);
      deck.position.set(xPos, 2.55, -12.5);
      add(deck);
      // Support posts
      for (const dz of [-6.5, 0, 6.5]) {
        for (const dx of [-1.4, 1.4]) {
          const postGeo = new THREE.BoxGeometry(0.18, 2.55, 0.18);
          const post = new THREE.Mesh(postGeo, woodDarkMat);
          post.position.set(xPos + dx, 1.27, -12.5 + dz);
          add(post);
        }
      }
      // Edge trim + railing
      const trimGeo = new THREE.BoxGeometry(3.4, 0.1, 0.14);
      for (const dz of [-7.5, 7.5]) {
        const trim = new THREE.Mesh(trimGeo, woodDarkMat);
        trim.position.set(xPos, 2.66, -12.5 + dz);
        add(trim);
      }
      const railGeo = new THREE.BoxGeometry(3.4, 0.08, 0.08);
      for (const dz of [-7.5, 7.5]) {
        const rail = new THREE.Mesh(railGeo, metalMat);
        rail.position.set(xPos, 3.15, -12.5 + dz);
        add(rail);
        for (const dx of [-1.5, 0, 1.5]) {
          const postGeo = new THREE.BoxGeometry(0.08, 0.55, 0.08);
          const post = new THREE.Mesh(postGeo, graphiteMat);
          post.position.set(xPos + dx, 2.88, -12.5 + dz);
          add(post);
        }
      }
      // Stairs at the mid end of the deck
      for (let s = 0; s < 3; s++) {
        const stepGeo = new THREE.BoxGeometry(2.2, 0.24, 0.4);
        const step = new THREE.Mesh(stepGeo, woodDarkMat);
        step.position.set(xPos, 0.12 + s * 0.24 + 0.12, -12.5 - 6.5 + s * 0.4);
        add(step);
      }
    }
  }

  private buildBackArea(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7d5536, roughness: 0.9 });
    const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x5f3f26, roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.55, metalness: 0.55 });
    const graphiteMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.65, metalness: 0.35 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xd9702c, roughness: 0.6 });

    const add = (mesh: THREE.Mesh) => {
      this.group.add(mesh);
      return mesh;
    };

    // Industrial entrance: double door with frame, mounted flush in the rear wall
    const doorTexture = this.createDoorTexture();
    const doorMat = new THREE.MeshStandardMaterial({ map: doorTexture, roughness: 0.7, metalness: 0.4 });
    const doorLeafCenter = DOOR.leafWidth / 2;
    for (const side of [-1, 1]) {
      const jambGeo = new THREE.BoxGeometry(0.28, DOOR.leafHeight + 0.2, 0.32);
      const jamb = new THREE.Mesh(jambGeo, graphiteMat);
      jamb.position.set(side * DOOR.halfOpening, (DOOR.leafHeight + 0.2) / 2, DOOR.z);
      add(jamb);

      const leafGeo = new THREE.BoxGeometry(DOOR.leafWidth, DOOR.leafHeight, DOOR.thickness);
      const leaf = new THREE.Mesh(leafGeo, doorMat);
      leaf.position.set(side * doorLeafCenter, DOOR.leafHeight / 2, DOOR.z);
      add(leaf);

      const handleGeo = new THREE.BoxGeometry(0.07, 0.38, 0.16);
      const handle = new THREE.Mesh(handleGeo, metalMat);
      handle.position.set(side * 0.42, 1.15, DOOR.z + DOOR.thickness / 2 + 0.02);
      add(handle);
    }
    const headerGeo = new THREE.BoxGeometry(DOOR.halfOpening * 2 + 0.5, 0.32, 0.34);
    const header = new THREE.Mesh(headerGeo, woodDarkMat);
    header.position.set(0, DOOR.leafHeight + 0.16, DOOR.z);
    add(header);
    const thresholdGeo = new THREE.BoxGeometry(DOOR.halfOpening * 2 + 0.5, 0.08, 0.5);
    const threshold = new THREE.Mesh(thresholdGeo, graphiteMat);
    threshold.position.set(0, 0.04, DOOR.z + 0.1);
    add(threshold);
    const exitTexture = this.createLabelTexture('EXIT', '', '#f4efe4', '#8a2f2a', true);
    const exitGeo = new THREE.PlaneGeometry(0.9, 0.35);
    const exit = new THREE.Mesh(exitGeo, new THREE.MeshBasicMaterial({ map: exitTexture }));
    exit.rotation.y = Math.PI;
    exit.position.set(0, DOOR.leafHeight + 0.75, DOOR.z - 0.1);
    add(exit);

    // Storage: crates + barrels along the rear corners
    const cratePositions: Array<[number, number, number, number]> = [
      [-8.5, 0.3, 5.2, 1.0], [-9.5, 0.3, 4.6, 0.9], [-8.9, 0.95, 4.9, 0.8],
      [-7.6, 0.3, 3.8, 0.9], [8.6, 0.3, 5.0, 1.0], [9.4, 0.3, 4.4, 0.9],
      [8.9, 0.95, 4.7, 0.8], [7.7, 0.3, 3.9, 0.9],
    ];
    const crateGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
    const crates = new THREE.InstancedMesh(crateGeo, woodMat, cratePositions.length);
    const crateM = new THREE.Matrix4();
    cratePositions.forEach(([x, y, z, s], i) => {
      crateM.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      crates.setMatrixAt(i, crateM);
    });
    crates.instanceMatrix.needsUpdate = true;
    add(crates);

    const barrelPositions: Array<[number, number, number]> = [
      [-11, 0.5, 4.8], [-11.8, 0.5, 4.2], [11.2, 0.5, 4.6], [12, 0.5, 4.0],
    ];
    const barrelGeo = new THREE.CylinderGeometry(0.36, 0.36, 1.0, 10);
    const barrels = new THREE.InstancedMesh(barrelGeo, orangeMat, barrelPositions.length);
    const barrelM = new THREE.Matrix4();
    barrelPositions.forEach(([x, y, z], i) => {
      barrelM.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      barrels.setMatrixAt(i, barrelM);
    });
    barrels.instanceMatrix.needsUpdate = true;
    add(barrels);

    // Target transport cart
    const cartBaseGeo = new THREE.BoxGeometry(1.5, 0.45, 0.9);
    const cartBase = new THREE.Mesh(cartBaseGeo, graphiteMat);
    cartBase.position.set(-12.5, 0.45, 2.6);
    add(cartBase);
    const cartTrayGeo = new THREE.BoxGeometry(1.7, 0.07, 1.1);
    const cartTray = new THREE.Mesh(cartTrayGeo, woodMat);
    cartTray.position.set(-12.5, 0.75, 2.6);
    add(cartTray);
    for (const side of [-1, 1]) {
      const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheel = new THREE.Mesh(wheelGeo, metalMat);
      wheel.position.set(-12.5 + side * 0.6, 0.16, 2.3);
      add(wheel);
    }

    // Range safety rules board near the firing line
    const boardTexture = this.createRulesTexture();
    const boardGeo = new THREE.PlaneGeometry(2.6, 1.9);
    const board = new THREE.Mesh(boardGeo, new THREE.MeshBasicMaterial({ map: boardTexture }));
    board.position.set(-8.9, 2.9, -0.5);
    add(board);
    const boardPostGeo = new THREE.BoxGeometry(0.09, 1.6, 0.09);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(boardPostGeo, woodDarkMat);
      post.position.set(-8.9 + side * 1.1, 0.8, -0.5);
      add(post);
    }
  }

  /**
   * Floor texture with baked lane markings, distance lines and numbers.
   * Baked markings cannot z-fight with the floor.
   */
  private createFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;
    const px = (x: number) => (x + 17) * 30.12;
    const pz = (z: number) => (7 - z) * 51.2;

    ctx.fillStyle = '#b3ab9c';
    ctx.fillRect(0, 0, 1024, 2048);

    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 2048;
      const v = Math.random();
      ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(x, y, 3, 3);
    }

    ctx.strokeStyle = 'rgba(60,45,30,0.10)';
    ctx.lineWidth = 2;
    for (let m = 1; m < 8; m++) {
      ctx.beginPath();
      ctx.moveTo(m * 128, 0);
      ctx.lineTo(m * 128, 2048);
      ctx.stroke();
    }
    for (let m = 1; m < 10; m++) {
      ctx.beginPath();
      ctx.moveTo(0, m * 204.8);
      ctx.lineTo(1024, m * 204.8);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,250,240,0.10)';
    ctx.fillRect(px(-17), pz(3.5), px(17) - px(-17), pz(-1.6) - pz(3.5));

    ctx.strokeStyle = 'rgba(235,232,222,0.85)';
    ctx.lineWidth = 10.5;
    for (const lx of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(px(lx), pz(3.5));
      ctx.lineTo(px(lx), pz(-27));
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(0, 2048);
    ctx.rotate(Math.PI);
    for (const [lx, num] of [[-4, '1'], [0, '2'], [4, '3']] as Array<[number, string]>) {
      ctx.beginPath();
      ctx.arc(px(lx), pz(-2.6), 19, 0, Math.PI * 2);
      ctx.fillStyle = '#d9702c';
      ctx.fill();
      ctx.fillStyle = '#3c4046';
      ctx.font = 'bold 64px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num, px(lx), pz(-2.6));
    }
    ctx.restore();

    ctx.save();
    ctx.translate(0, 2048);
    ctx.rotate(Math.PI);
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const z of [-5, -10, -15, -20, -25]) {
      ctx.strokeStyle = 'rgba(235,232,222,0.75)';
      ctx.lineWidth = 6.6;
      ctx.beginPath();
      ctx.moveTo(px(-7), pz(z));
      ctx.lineTo(px(7), pz(z));
      ctx.stroke();
      ctx.fillStyle = 'rgba(60,64,70,0.55)';
      ctx.fillText(`${-z}M`, px(-6.2), pz(z));
      ctx.fillText(`${-z}M`, px(6.2), pz(z));
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(70,62,50,0.25)';
    ctx.fillRect(px(-17), pz(-27), px(17) - px(-17), pz(-31) - pz(-27));

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Wall texture: tan panels with subtle seams and a base trim line.
   */
  private createWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d3c4a4';
    ctx.fillRect(0, 0, 1024, 512);

    for (let i = 0; i < 2500; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const v = Math.random();
      ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(x, y, 3, 3);
    }

    ctx.strokeStyle = 'rgba(90,75,55,0.22)';
    ctx.lineWidth = 3;
    for (let m = 1; m < 5; m++) {
      ctx.beginPath();
      ctx.moveTo(m * 256, 0);
      ctx.lineTo(m * 256, 512);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,75,55,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, 320);
    ctx.lineTo(1024, 320);
    ctx.stroke();

    ctx.fillStyle = '#8f887c';
    ctx.fillRect(0, 0, 1024, 22);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Diagonal yellow/black hazard stripe texture.
   */
  private createHazardTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e5b83c';
    ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = '#26282c';
    for (let y = -64; y < 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y + 32);
      ctx.lineTo(64, y);
      ctx.lineTo(64, y + 32);
      ctx.lineTo(0, y + 64);
      ctx.closePath();
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Door leaf texture: industrial metal paneling with recessed panels,
   * a center stile and a kick band at the bottom.
   */
  private createDoorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#3c4046';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 248);
    ctx.fillStyle = '#33373c';
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 3; row++) {
        const px = 30 + col * 105;
        const py = 34 + row * 66;
        ctx.fillRect(px, py, 88, 46);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, 88, 46);
      }
    }
    ctx.fillStyle = '#2b2e33';
    ctx.fillRect(0, 216, 256, 36);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 216, 256, 36);
    ctx.fillStyle = 'rgba(217,112,44,0.85)';
    ctx.fillRect(0, 250, 256, 6);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Small canvas texture with two lines of text (signage).
   */
  private createLabelTexture(title: string, subtitle: string, textColor: string, bgColor: string, flipX = false): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    if (flipX) {
      ctx.translate(256, 0);
      ctx.scale(-1, 1);
    }
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = textColor;
    ctx.font = '800 34px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 128, subtitle ? 38 : 50);
    if (subtitle) {
      ctx.font = '700 20px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(subtitle, 128, 72);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Small canvas texture for a target plaque (white with bullseye).
   */
  private createBullseyeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#8a6a43';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, 112, 112);
    ctx.beginPath();
    ctx.arc(64, 64, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e0d0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 64, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#d9702c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 64, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#c94b3f';
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Range safety rules board.
   */
  private createRulesTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(0, 0, 256, 192);
    ctx.strokeStyle = '#c94b3f';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 244, 180);
    ctx.fillStyle = '#3c4046';
    ctx.textAlign = 'center';
    ctx.font = '800 24px Arial, sans-serif';
    ctx.fillText('RANGE SAFETY', 128, 34);
    ctx.font = '600 15px Arial, sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      '1. EYE & HEARING PROTECTION',
      '2. WEAPON SAFE UNTIL LINE',
      '3. FINGER OFF TRIGGER',
      '4. NO LIVE AMMO IN HALL',
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, 22, 70 + i * 30);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private setupLighting(): void {
    // Warm ambient: tan sky bounce + earthy ground bounce
    const hemiLight = new THREE.HemisphereLight(0xfff0d8, 0x9a8a70, 0.95);
    hemiLight.position.set(0, 30, 0);
    this.group.add(hemiLight);

    // Warm key sunlight from the front-right (lights bot fronts)
    const sunLight = new THREE.DirectionalLight(0xffe3b8, 1.35);
    sunLight.position.set(22, 32, 14);
    this.group.add(sunLight);

    // Soft cool fill from the back-left so shadows never go flat black
    const fillLight = new THREE.DirectionalLight(0xe8f0ff, 0.45);
    fillLight.position.set(-16, 12, -28);
    this.group.add(fillLight);
  }
}