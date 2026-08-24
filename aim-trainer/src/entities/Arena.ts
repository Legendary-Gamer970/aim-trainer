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

    // Raised concrete firing pad (height 0.15, resting on floor y=0..0.15)
    const platformGeo = new THREE.BoxGeometry(platformW, pHeight, platformD);
    const platform = new THREE.Mesh(platformGeo, concreteMat);
    platform.position.set(platformX, pHeight / 2, platformZ);
    add(platform);

    // Hazard firing line stripe on the platform's front edge
    const hazardTexture = this.createHazardTexture();
    const firingLineGeo = new THREE.PlaneGeometry(platformW, 0.34);
    const firingLine = new THREE.Mesh(firingLineGeo, new THREE.MeshBasicMaterial({ map: hazardTexture }));
    firingLine.rotation.x = -Math.PI / 2;
    firingLine.position.set(platformX, pHeight + 0.005, pzFront + 0.32);
    add(firingLine);

    // Caution blocks at the platform back edge
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const blockGeo = new THREE.BoxGeometry(0.22, 0.06, 0.22);
      const block = new THREE.Mesh(blockGeo, orangeMat);
      block.position.set(platformX + i * 1.1, pHeight + 0.03, pzBack - 0.3);
      add(block);
    }

    // Firing counter bench: wooden tabletop with front skirt and concrete legs
    const benchW = BOOTH_BENCH.maxX - BOOTH_BENCH.minX;
    const benchTopGeo = new THREE.BoxGeometry(benchW, 0.07, 0.5);
    const benchTop = new THREE.Mesh(benchTopGeo, woodMat);
    benchTop.position.set(platformX, 0.72, pzFront - 0.18);
    add(benchTop);

    // Bench front panel: rests flush on platform (y=0.15) and joins bottom of tabletop (y=0.685)
    const benchFrontGeo = new THREE.BoxGeometry(benchW, 0.54, 0.08);
    const benchFront = new THREE.Mesh(benchFrontGeo, graphiteMat);
    benchFront.position.set(platformX, 0.42, pzFront + 0.07);
    add(benchFront);

    // Bench legs: resting on hall floor (y=0..0.72)
    for (const side of [-1, 1]) {
      const legGeo = new THREE.BoxGeometry(0.12, 0.72, 0.5);
      const leg = new THREE.Mesh(legGeo, concreteDarkMat);
      leg.position.set(platformX + side * (benchW / 2 - 0.15), 0.36, pzFront - 0.18);
      add(leg);
    }

    // Bench accent trim (clean inlay along the front edge)
    const benchStripeGeo = new THREE.BoxGeometry(benchW, 0.02, 0.08);
    const benchStripe = new THREE.Mesh(benchStripeGeo, orangeMat);
    benchStripe.position.set(platformX, 0.756, pzFront + 0.04);
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
      topRail.position.set(xPos, 1.09, (BOOTH.wallZFront + BOOTH.wallZBack) / 2);
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
        new THREE.Vector3(BOOTH.grillMinX + i * barGap, 0.54, grillCenterZ),
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

    // Side safety rails (grounded graphite posts + top metal rail + side warning plate)
    for (const side of [-1, 1]) {
      const xPos = (side > 0 ? pxMax : pxMin) + side * 0.12;
      const railGeo = new THREE.BoxGeometry(0.09, 0.09, platformD + 0.8);
      const rail = new THREE.Mesh(railGeo, metalMat);
      // Rail sits firmly on top of posts: y = 0.15 (platform) + 1.02 (posts) + 0.045 = 1.215
      rail.position.set(xPos, 1.215, platformZ);
      add(rail);

      for (let i = 0; i < 4; i++) {
        const postGeo = new THREE.BoxGeometry(0.09, 1.02, 0.09);
        const post = new THREE.Mesh(postGeo, graphiteMat);
        // Posts rest on platform top (y = 0.15..1.17)
        post.position.set(xPos, 0.15 + 0.51, pzFront + 0.35 + i * (platformD / 3.4));
        add(post);
      }

      // Safety warning plate mounted flush to the outer face of the posts
      const plateGeo = new THREE.BoxGeometry(0.04, 0.28, 1.2);
      const plate = new THREE.Mesh(plateGeo, orangeMat);
      plate.position.set(xPos + side * 0.06, 0.15 + 0.51, platformZ);
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
    curbStripe.position.set(0, 0.355, -31.4);
    add(curbStripe);

    // Target holders firmly sitting on top of the concrete curb
    for (const x of [-8, -4, 0, 4, 8]) {
      const holderGeo = new THREE.BoxGeometry(0.32, 0.55, 0.16);
      const holder = new THREE.Mesh(holderGeo, graphiteMat);
      // Curb top is y=0.35, holder height is 0.55 -> center y = 0.35 + 0.275 = 0.625
      holder.position.set(x, 0.625, -31.4);
      add(holder);
    }

    // Dark impact band low on the back wall (behind bots, below head height)
    const bandGeo = new THREE.BoxGeometry(34.2, 3.2, 0.06);
    const band = new THREE.Mesh(bandGeo, concreteDarkMat);
    band.position.set(0, 1.6, -32.97);
    add(band);

    // Bullseye plaques on the back wall (cleanly positioned below the main signboard)
    const plaqueTexture = this.createBullseyeTexture();
    for (const x of [-7, 0, 7]) {
      const plaqueGeo = new THREE.PlaneGeometry(1.4, 1.4);
      const plaque = new THREE.Mesh(plaqueGeo, new THREE.MeshBasicMaterial({ map: plaqueTexture }));
      plaque.position.set(x, 4.8, -32.96);
      add(plaque);
    }

    // Facility signboard: backing board + metal frame, mounted high on the back wall
    const signTexture = this.createFacilitySignTexture();
    const signBoardGeo = new THREE.BoxGeometry(9.6, 2.8, 0.1);
    const signBoard = new THREE.Mesh(signBoardGeo, woodMat);
    signBoard.position.set(0, 7.8, -32.9);
    add(signBoard);

    // Frame strips surrounding the signboard perfectly
    const frameStrips: Array<[number, number, number, number]> = [
      [0, 9.20, 9.6, 0.12],   // Top frame strip
      [0, 6.40, 9.6, 0.12],   // Bottom frame strip
      [-4.75, 7.8, 0.12, 2.92], // Left frame strip
      [4.75, 7.8, 0.12, 2.92],  // Right frame strip
    ];
    for (const [x, y, w, h] of frameStrips) {
      const stripGeo = new THREE.BoxGeometry(w, h, 0.16);
      const strip = new THREE.Mesh(stripGeo, graphiteMat);
      strip.position.set(x, y, -32.88);
      add(strip);
    }

    // High-resolution printed signboard face (y = 6.6..9.0)
    const signGeo = new THREE.PlaneGeometry(9.2, 2.4);
    const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTexture }));
    sign.position.set(0, 7.8, -32.82);
    add(sign);

    // Wall mounting support brackets under the bottom frame
    for (const side of [-1, 1]) {
      const bracketGeo = new THREE.BoxGeometry(0.14, 0.45, 0.22);
      const bracket = new THREE.Mesh(bracketGeo, graphiteMat);
      bracket.position.set(side * 4.4, 6.15, -32.95);
      add(bracket);
    }

    // Over-sign spotlight bar mounted ABOVE the sign (y = 9.45)
    const lightBarGeo = new THREE.BoxGeometry(3.6, 0.12, 0.20);
    const lightBar = new THREE.Mesh(lightBarGeo, graphiteMat);
    lightBar.position.set(0, 9.45, -32.85);
    add(lightBar);

    // Spotlight fixtures shining down on the board
    const spotFixtureGeo = new THREE.BoxGeometry(0.6, 0.16, 0.24);
    const spotFixtureMat = new THREE.MeshBasicMaterial({ color: 0xffe9c4 });
    for (const sx of [-1.2, 1.2]) {
      const spot = new THREE.Mesh(spotFixtureGeo, spotFixtureMat);
      spot.position.set(sx, 9.40, -32.82);
      add(spot);
    }
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

    // Build solid, grounded elevated observation walkways on both side walls
    for (const side of [-1, 1]) {
      const deckWidth = 2.6;
      const deckLength = 16.0;
      const deckHeight = 2.20; // Height of deck bottom above floor
      const deckThickness = 0.20;
      const deckCenterX = side * 15.35; // Extends from x = ±14.05 to ±16.65 (flush with wall kick)
      const deckCenterZ = -12.0;       // Spans z = -20.0 to -4.0

      // 1. Solid Main Catwalk Deck (y = 2.20..2.40)
      const deckGeo = new THREE.BoxGeometry(deckWidth, deckThickness, deckLength);
      const deck = new THREE.Mesh(deckGeo, woodMat);
      deck.position.set(deckCenterX, deckHeight + deckThickness / 2, deckCenterZ);
      add(deck);

      // 2. Heavy Support Columns (5 pairs along Z, resting on floor y=0..2.20)
      const colZPositions = [-20.0, -16.0, -12.0, -8.0, -4.0];
      const colXPositions = [deckCenterX - side * 1.15, deckCenterX + side * 1.15];

      for (const cz of colZPositions) {
        for (const cx of colXPositions) {
          const colGeo = new THREE.BoxGeometry(0.20, deckHeight, 0.20);
          const col = new THREE.Mesh(colGeo, woodDarkMat);
          col.position.set(cx, deckHeight / 2, cz);
          add(col);
        }

        // Cross header beam under deck
        const headerGeo = new THREE.BoxGeometry(deckWidth, 0.18, 0.20);
        const header = new THREE.Mesh(headerGeo, woodDarkMat);
        header.position.set(deckCenterX, deckHeight - 0.09, cz);
        add(header);
      }

      // 3. Continuous Industrial Safety Railing along the full inner edge (z = -20 to -4)
      const railX = deckCenterX - side * (deckWidth / 2 - 0.05); // Inner facing edge

      // Top handrail (y = 2.40 + 1.00 = 3.40)
      const topRailGeo = new THREE.BoxGeometry(0.08, 0.08, deckLength);
      const topRail = new THREE.Mesh(topRailGeo, metalMat);
      topRail.position.set(railX, 3.40, deckCenterZ);
      add(topRail);

      // Mid guardrail (y = 2.40 + 0.50 = 2.90)
      const midRailGeo = new THREE.BoxGeometry(0.06, 0.05, deckLength);
      const midRail = new THREE.Mesh(midRailGeo, metalMat);
      midRail.position.set(railX, 2.90, deckCenterZ);
      add(midRail);

      // Base kickboard along edge (y = 2.40 + 0.10 = 2.50)
      const kickboardGeo = new THREE.BoxGeometry(0.06, 0.20, deckLength);
      const kickboard = new THREE.Mesh(kickboardGeo, woodDarkMat);
      kickboard.position.set(railX, 2.50, deckCenterZ);
      add(kickboard);

      // Vertical baluster posts every 2m
      for (let z = -20.0; z <= -4.0; z += 2.0) {
        const postGeo = new THREE.BoxGeometry(0.08, 1.04, 0.08);
        const post = new THREE.Mesh(postGeo, graphiteMat);
        post.position.set(railX, 2.92, z);
        add(post);
      }

      // End railings across X at z = -20.0 (far end)
      const endRailGeo = new THREE.BoxGeometry(deckWidth, 0.08, 0.08);
      const endTopRail = new THREE.Mesh(endRailGeo, metalMat);
      endTopRail.position.set(deckCenterX, 3.40, -20.0);
      add(endTopRail);

      const endMidRail = new THREE.Mesh(new THREE.BoxGeometry(deckWidth, 0.05, 0.06), metalMat);
      endMidRail.position.set(deckCenterX, 2.90, -20.0);
      add(endMidRail);

      // 4. Grounded Access Stairs at the near end (z = -4.0 to -0.4)
      // Realistic 8-step flight connecting platform deck (y=2.40) to floor (y=0)
      const numSteps = 8;
      const stepRise = 2.40 / numSteps; // 0.30m per step
      const stepRun = 0.45;            // 0.45m tread depth
      const stairWidth = 1.8;

      for (let s = 0; s < numSteps; s++) {
        const stepY = (s + 0.5) * stepRise; // Centers: 0.15, 0.45, ...
        const stepZ = -4.0 + (numSteps - 1 - s) * stepRun + stepRun / 2;
        const stepGeo = new THREE.BoxGeometry(stairWidth, stepRise, stepRun);
        const step = new THREE.Mesh(stepGeo, woodDarkMat);
        step.position.set(deckCenterX, stepY, stepZ);
        add(step);
      }

      // Stair stringer beams and outer handrail
      const stairLength = Math.hypot(numSteps * stepRun, 2.40);
      const stairAngle = Math.atan2(2.40, numSteps * stepRun);

      const stringerGeo = new THREE.BoxGeometry(0.10, 0.22, stairLength);
      const stringerInner = new THREE.Mesh(stringerGeo, graphiteMat);
      stringerInner.position.set(railX, 1.20, -4.0 + (numSteps * stepRun) / 2);
      stringerInner.rotation.x = stairAngle;
      add(stringerInner);

      const stairRailGeo = new THREE.BoxGeometry(0.06, 0.06, stairLength);
      const stairRail = new THREE.Mesh(stairRailGeo, metalMat);
      stairRail.position.set(railX, 2.20, -4.0 + (numSteps * stepRun) / 2);
      stairRail.rotation.x = stairAngle;
      add(stairRail);
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

    // ============================================================
    // Storage: Perfectly grounded wooden crates in rear corners
    // Crate base size: 0.62m. Y position = (0.62 * scale) / 2 for floor crates
    // ============================================================
    const cratePositions: Array<[number, number, number, number]> = [
      // Left rear corner stack (x ~ -9.5..-11.5, z ~ 4.2..5.4)
      [-9.5, 0.31, 5.0, 1.0],      // Base crate 1 (y=0..0.62)
      [-10.3, 0.31, 4.4, 1.0],     // Base crate 2 (y=0..0.62)
      [-11.0, 0.279, 5.1, 0.9],    // Base crate 3 (y=0..0.558)
      [-9.5, 0.868, 5.0, 0.8],     // Stacked crate on Crate 1 (y=0.62..1.116)
      [-10.3, 0.868, 4.4, 0.8],    // Stacked crate on Crate 2 (y=0.62..1.116)

      // Right rear corner stack (x ~ 9.5..11.5, z ~ 4.2..5.4)
      [9.5, 0.31, 5.0, 1.0],       // Base crate 4 (y=0..0.62)
      [10.3, 0.31, 4.4, 1.0],      // Base crate 5 (y=0..0.62)
      [11.0, 0.279, 5.1, 0.9],     // Base crate 6 (y=0..0.558)
      [9.5, 0.868, 5.0, 0.8],      // Stacked crate on Crate 4 (y=0.62..1.116)
      [10.3, 0.868, 4.4, 0.8],     // Stacked crate on Crate 5 (y=0.62..1.116)
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

    // ============================================================
    // Storage: Industrial barrels sitting flat on floor (height 1.0, center y = 0.5)
    // ============================================================
    const barrelPositions: Array<[number, number, number]> = [
      [-11.8, 0.50, 4.2], [-12.5, 0.50, 4.9],
      [11.8, 0.50, 4.2], [12.5, 0.50, 4.9],
    ];
    const barrelGeo = new THREE.CylinderGeometry(0.36, 0.36, 1.0, 12);
    const barrels = new THREE.InstancedMesh(barrelGeo, orangeMat, barrelPositions.length);
    const barrelM = new THREE.Matrix4();
    barrelPositions.forEach(([x, y, z], i) => {
      barrelM.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      barrels.setMatrixAt(i, barrelM);
    });
    barrels.instanceMatrix.needsUpdate = true;
    add(barrels);

    // ============================================================
    // Target transport cart (grounded with 4 wheels + chassis + tray + handle)
    // ============================================================
    const cartX = -12.5;
    const cartZ = 2.6;
    const wheelRadius = 0.12;

    // 4 metal caster wheels resting on floor y=0..0.24
    for (const dx of [-0.55, 0.55]) {
      for (const dz of [-0.32, 0.32]) {
        const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.08, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheel = new THREE.Mesh(wheelGeo, metalMat);
        wheel.position.set(cartX + dx, wheelRadius, cartZ + dz);
        add(wheel);
      }
    }

    // Heavy graphite chassis frame (y = 0.12..0.36)
    const cartBaseGeo = new THREE.BoxGeometry(1.40, 0.24, 0.90);
    const cartBase = new THREE.Mesh(cartBaseGeo, graphiteMat);
    cartBase.position.set(cartX, wheelRadius + 0.12, cartZ);
    add(cartBase);

    // Wooden flatbed tray resting flush on chassis (y = 0.36..0.43)
    const cartTrayGeo = new THREE.BoxGeometry(1.55, 0.07, 1.05);
    const cartTray = new THREE.Mesh(cartTrayGeo, woodMat);
    cartTray.position.set(cartX, wheelRadius + 0.24 + 0.035, cartZ);
    add(cartTray);

    // Metal push handle bar at rear
    const handlePostGeo = new THREE.BoxGeometry(0.05, 0.65, 0.05);
    for (const side of [-1, 1]) {
      const hp = new THREE.Mesh(handlePostGeo, graphiteMat);
      hp.position.set(cartX + side * 0.45, 0.40 + 0.325, cartZ + 0.48);
      add(hp);
    }
    const handleBarGeo = new THREE.BoxGeometry(0.95, 0.05, 0.05);
    const hb = new THREE.Mesh(handleBarGeo, metalMat);
    hb.position.set(cartX, 0.40 + 0.65, cartZ + 0.48);
    add(hb);

    // ============================================================
    // Range safety rules board firmly mounted on two grounded posts
    // Board: 2.6m wide, 1.8m tall, centered at y = 1.90 (y = 1.00..2.80)
    // Posts: height 2.80m, resting on floor y=0..2.80 (ZERO floating gap)
    // ============================================================
    const boardX = -8.9;
    const boardZ = -0.5;
    const boardY = 1.90;

    // Solid wooden backing board (y = 1.00..2.80)
    const boardBackingGeo = new THREE.BoxGeometry(2.64, 1.84, 0.06);
    const boardBacking = new THREE.Mesh(boardBackingGeo, woodMat);
    boardBacking.position.set(boardX, boardY, boardZ - 0.02);
    add(boardBacking);

    // Printed rules sign face
    const boardTexture = this.createRulesTexture();
    const boardGeo = new THREE.PlaneGeometry(2.56, 1.76);
    const board = new THREE.Mesh(boardGeo, new THREE.MeshBasicMaterial({ map: boardTexture }));
    board.position.set(boardX, boardY, boardZ + 0.015);
    add(board);

    // Sturdy vertical posts: grounded at y=0, reaching the top of the board at y=2.80
    const boardPostGeo = new THREE.BoxGeometry(0.12, 2.80, 0.12);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(boardPostGeo, woodDarkMat);
      post.position.set(boardX + side * 1.20, 1.40, boardZ);
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
   * High-resolution crisp signboard texture for the main back wall facility banner.
   */
  private createFacilitySignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;

    // Dark industrial graphite background with inset panel styling
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, 1024, 384);

    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(16, 16, 992, 352);

    ctx.strokeStyle = '#d9702c';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, 976, 336);

    // Decorative corner rivets
    ctx.fillStyle = '#d9702c';
    const corners = [[24, 24], [976, 24], [24, 336], [976, 336]];
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx - 8, cy - 8, 16, 16);
    }

    // Title: APEX AIM RANGE (crisp, bold, centered with ample margin)
    ctx.fillStyle = '#f4efe4';
    ctx.font = '900 82px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('APEX AIM RANGE', 512, 145);

    // Subtle orange separator bar
    ctx.fillStyle = '#d9702c';
    ctx.fillRect(262, 215, 500, 6);

    // Subtitle: SHOOTING FACILITY
    ctx.fillStyle = '#e2ded4';
    ctx.font = '700 42px Arial, sans-serif';
    ctx.fillText('SHOOTING FACILITY', 512, 275);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Small canvas texture with two lines of text (signage) with auto-fitting font sizes.
   */
  private createLabelTexture(title: string, subtitle: string, textColor: string, bgColor: string, flipX = false): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    if (flipX) {
      ctx.translate(512, 0);
      ctx.scale(-1, 1);
    }
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 192);

    // Auto-fit title font size so it never clips
    let titleFontSize = subtitle ? 56 : 72;
    ctx.font = `800 ${titleFontSize}px Arial, sans-serif`;
    while (ctx.measureText(title).width > 470 && titleFontSize > 20) {
      titleFontSize -= 2;
      ctx.font = `800 ${titleFontSize}px Arial, sans-serif`;
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, subtitle ? 74 : 96);

    if (subtitle) {
      let subFontSize = 32;
      ctx.font = `700 ${subFontSize}px Arial, sans-serif`;
      while (ctx.measureText(subtitle).width > 470 && subFontSize > 14) {
        subFontSize -= 2;
        ctx.font = `700 ${subFontSize}px Arial, sans-serif`;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(subtitle, 256, 138);
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