import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Attraction,
  CATEGORY_META,
} from '../data/ugandaAttractions';
import { ChevronDown, ChevronUp, Compass, Mountain, Sun, Eye } from 'lucide-react';

interface Uganda3DSceneProps {
  attractions: Attraction[];
  selectedAttraction: Attraction | null;
  onSelectAttraction: (attraction: Attraction) => void;
}

// Pre-allocated scratch vectors at module scope for zero GC inside tick()
const _targetCamPos = new THREE.Vector3(0, 18, 26);
const _targetLookAt = new THREE.Vector3(0, 0, 0);
const _vehiclePos = new THREE.Vector3();
const _vehicleNextPos = new THREE.Vector3();
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();
const _dummyColor = new THREE.Color();

/**
 * Maps Uganda geographic coordinates (lat: -1.5..4.2, lng: 29.5..35.0)
 * onto the 3D topographic relief table (-16..+16 on X and Z).
 */
function latLngToWorldXZ(lat: number, lng: number): [number, number] {
  const x = ((lng - 32.25) / 2.75) * 14;
  const z = -((lat - 1.35) / 2.85) * 14;
  return [x, z];
}

/**
 * Procedural topographic elevation function representing Uganda's true geography:
 * - Western Rift mountains: Rwenzori (west) & Virunga/Bwindi (southwest)
 * - Eastern volcano: Mount Elgon (east) & Mount Moroto (northeast)
 * - Lake Victoria basin (southeast) & Lake Albert trench (northwest)
 */
function ugandaElevationAt(x: number, z: number): number {
  // Base central plateau
  let h = 0.35 + 0.12 * Math.sin(x * 0.35) * Math.cos(z * 0.35);

  // Rwenzori Mountains (West: x ~ -12, z ~ +4.8)
  const distRwenzori = Math.hypot(x - -12.1, z - 4.7);
  if (distRwenzori < 4.2) {
    h += Math.pow(1 - distRwenzori / 4.2, 2) * 4.4;
  }

  // Bwindi & Virunga Volcanoes (Southwest: x ~ -13, z ~ +12.5)
  const distVirunga = Math.hypot(x - -13.2, z - 12.8);
  if (distVirunga < 4.0) {
    h += Math.pow(1 - distVirunga / 4.0, 1.8) * 3.5;
  }

  // Mount Elgon Caldera (East: x ~ +11.6, z ~ +1.1)
  const distElgon = Math.hypot(x - 11.6, z - 1.1);
  if (distElgon < 3.8) {
    const rim = Math.pow(1 - distElgon / 3.8, 1.6) * 3.2;
    const calderaDip = distElgon < 0.9 ? (1 - distElgon / 0.9) * 0.7 : 0;
    h += rim - calderaDip;
  }

  // Mount Moroto & Kidepo Highlands (Northeast: x ~ +11, z ~ -9)
  const distKaramoja = Math.hypot(x - 10.5, z - -8.5);
  if (distKaramoja < 4.5) {
    h += Math.pow(1 - distKaramoja / 4.5, 2) * 2.4;
  }

  // Lake Victoria Basin depression (Southeast: x > 0, z > 5)
  const distVictoria = Math.hypot(x - 3.5, z - 9.5);
  if (distVictoria < 6.5) {
    h -= Math.pow(1 - distVictoria / 6.5, 1.5) * 0.55;
  }

  return Math.max(0.08, h);
}

/**
 * Builds a procedural high-resolution albedo texture for Uganda's terrain
 * with snow-capped peaks, lush montane rainforests, golden savannas, and Nile/Lake waters.
 */
function createUgandaTerrainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base savanna-emerald gradient
  const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, '#365314'); // Northern Karamoja/Murchison olive
  grad.addColorStop(0.5, '#15803d'); // Central equatorial lush belt
  grad.addColorStop(1, '#166534'); // Southern forest & lake rim
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle topographic contour lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1.5;
  for (let r = 40; r < 980; r += 36) {
    ctx.beginPath();
    ctx.arc(512, 512, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Lake Victoria water sheen in southeast quadrant
  const lakeGrad = ctx.createRadialGradient(640, 820, 20, 640, 820, 240);
  lakeGrad.addColorStop(0, '#0284c7');
  lakeGrad.addColorStop(0.75, '#0369a1');
  lakeGrad.addColorStop(1, 'rgba(3, 105, 161, 0)');
  ctx.fillStyle = lakeGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Victoria Nile river ribbon from Jinja (SE) through Kyoga to Murchison (NW)
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(610, 670);
  ctx.bezierCurveTo(560, 520, 520, 420, 440, 310);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Builds a soft radial contact shadow texture to ground 3D props with zero floating.
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  g.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Composite 9-Part Procedural 4x4 Safari Land Cruiser (`THREE.Group`)
 * Pivoted at bottom-center (y = 0) with varied roughness and metalness.
 */
function buildSafariLandCruiserGroup(
  isSoftwareGl: boolean,
  shadowTex: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();

  // Contact shadow plane at y = 0.02
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);

  // 1. Primary Silhouette: Main Safari Body Hull
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xd6d3d1, // Classic sand-beige safari cruiser
    roughness: 0.42,
    metalness: 0.25,
  });
  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.36, 1.45),
    bodyMat
  );
  bodyMesh.position.set(0, 0.32, 0);
  bodyMesh.castShadow = !isSoftwareGl;
  bodyMesh.receiveShadow = !isSoftwareGl;
  group.add(bodyMesh);

  // 2. Secondary Read: Pop-Up Safari Viewing Cabin
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5f4,
    roughness: 0.7,
    metalness: 0.05,
  });
  const cabinMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.28, 0.88),
    cabinMat
  );
  cabinMesh.position.set(0, 0.62, -0.14);
  cabinMesh.castShadow = !isSoftwareGl;
  group.add(cabinMesh);

  // 3. Secondary Read: Elevated Pop-Up Game-Viewing Roof Canopy
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.85,
    metalness: 0.05,
  });
  const canopyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.06, 0.78),
    canopyMat
  );
  canopyMesh.position.set(0, 0.84, -0.15);
  group.add(canopyMesh);

  // 4. Secondary Read: 4 Rugged Off-Road Wheels
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.9,
    metalness: 0.1,
  });
  const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelOffsets: [number, number, number][] = [
    [-0.38, 0.18, 0.45],
    [0.38, 0.18, 0.45],
    [-0.38, 0.18, -0.45],
    [0.38, 0.18, -0.45],
  ];
  wheelOffsets.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(wx, wy, wz);
    group.add(wheel);
  });

  // 5. Accent Detail: Rear-Mounted Spare Tire
  const spareWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16),
    tireMat
  );
  spareWheel.rotation.x = Math.PI / 2;
  spareWheel.position.set(0, 0.38, -0.76);
  group.add(spareWheel);

  // 6. Accent Detail: Front Bull-Bar & Brushed Steel Grille
  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe7e5e4,
    metalness: 0.9,
    roughness: 0.15,
    clearcoat: 1.0,
  });
  const bullBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.18, 0.08),
    chromeMat
  );
  bullBar.position.set(0, 0.26, 0.75);
  group.add(bullBar);

  // 7. Accent Detail: Dual Warm Headlights
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.9,
    roughness: 0.1,
  });
  const hlGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12);
  hlGeo.rotateX(Math.PI / 2);
  [-0.24, 0.24].forEach((lx) => {
    const hl = new THREE.Mesh(hlGeo, lightMat);
    hl.position.set(lx, 0.34, 0.74);
    group.add(hl);
  });

  // 8. Accent Detail: Raised River-Crossing Snorkel Pipe
  const snorkel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.52, 8),
    tireMat
  );
  snorkel.position.set(-0.37, 0.58, 0.28);
  group.add(snorkel);

  return group;
}

/**
 * Composite 5-Part Procedural Kasubi Royal Thatched Dome (`THREE.Group`)
 * Using LatheGeometry for the organic dome profile + clan ring accents.
 */
function buildKasubiRoyalDomeGroup(
  x: number,
  z: number,
  shadowTex: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();
  const baseY = ugandaElevationAt(x, z);
  group.position.set(x, baseY, z);

  // Contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.8),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // 1. Primary Silhouette: Conical-Parabolic Thatch Dome via LatheGeometry
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = (1 - Math.pow(t, 1.35)) * 0.65;
    const y = t * 0.95;
    points.push(new THREE.Vector2(r, y));
  }
  const domeGeo = new THREE.LatheGeometry(points, 24);
  const thatchMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.92,
    metalness: 0.05,
  });
  const dome = new THREE.Mesh(domeGeo, thatchMat);
  group.add(dome);

  // 2. Secondary Read: Woven Reed Courtyard Plinth
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.76, 0.14, 24),
    new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.8,
      metalness: 0.1,
    })
  );
  plinth.position.y = 0.07;
  group.add(plinth);

  // 3. Accent Detail: Sacred Finial Crown Ring
  const finial = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.03, 12, 24),
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.25,
      metalness: 0.85,
    })
  );
  finial.rotation.x = Math.PI / 2;
  finial.position.y = 0.96;
  group.add(finial);

  // 4. Accent Detail: Recessed Entrance Archway
  const arch = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.34, 0.24),
    new THREE.MeshStandardMaterial({
      color: 0x292524,
      roughness: 0.6,
    })
  );
  arch.position.set(0, 0.17, 0.56);
  group.add(arch);

  return group;
}

/**
 * Composite 4-Part Interactive Destination Beacon (`THREE.Group`)
 */
function buildDestinationBeacon(
  attraction: Attraction,
  isSelected: boolean,
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();
  const [wx, wz] = latLngToWorldXZ(attraction.lat, attraction.lng);
  const wy = ugandaElevationAt(wx, wz);
  group.position.set(wx, wy, wz);
  group.userData = { attraction };

  const meta = CATEGORY_META[attraction.category];
  const colorObj = new THREE.Color(meta.color);

  // 1. Primary Base Pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.12, 16),
    new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.3,
      metalness: 0.7,
    })
  );
  pedestal.position.y = 0.06;
  group.add(pedestal);

  // 2. Secondary Column Stem
  const stemHeight = isSelected ? 1.15 : 0.75;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, stemHeight, 12),
    new THREE.MeshStandardMaterial({
      color: isSelected ? 0xfacc15 : 0xe7e5e4,
      roughness: 0.2,
      metalness: 0.85,
    })
  );
  stem.position.y = 0.12 + stemHeight / 2;
  group.add(stem);

  // 3. Faceted Gem / Marker Crown (interactive layer 1 for raycasting)
  const headGeo =
    attraction.category === 'mountain' || attraction.category === 'nationalPark'
      ? new THREE.OctahedronGeometry(isSelected ? 0.32 : 0.22, 0)
      : new THREE.DodecahedronGeometry(isSelected ? 0.3 : 0.2, 0);

  const headMat = new THREE.MeshPhysicalMaterial({
    color: colorObj,
    roughness: 0.15,
    metalness: 0.35,
    clearcoat: 1.0,
    emissive: colorObj,
    emissiveIntensity: isSelected ? 0.55 : 0.2,
  });

  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.y = 0.12 + stemHeight + 0.2;
  headMesh.castShadow = !isSoftwareGl;
  headMesh.layers.enable(1);
  headMesh.userData = { attraction };
  group.add(headMesh);

  // 4. Accent Brass Orbit Ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(isSelected ? 0.42 : 0.28, 0.022, 10, 24),
    new THREE.MeshStandardMaterial({
      color: isSelected ? 0xfacc15 : 0xffffff,
      roughness: 0.25,
      metalness: 0.9,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = headMesh.position.y;
  group.add(ring);

  return group;
}

export const Uganda3DScene: React.FC<Uganda3DSceneProps> = ({
  attractions,
  selectedAttraction,
  onSelectAttraction,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectAttraction);
  useEffect(() => {
    onSelectRef.current = onSelectAttraction;
  }, [onSelectAttraction]);

  const [hoveredAttraction, setHoveredAttraction] = useState<Attraction | null>(
    null
  );
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [lightingPreset, setLightingPreset] = useState<'golden' | 'equatorial' | 'dusk'>(
    'golden'
  );
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(1.0);
  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('overview');

  // Mutable scene references so UI controls update the 3D scene without remounting
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    terrainMesh: THREE.Mesh;
    beaconsGroup: THREE.Group;
    keyLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    fog: THREE.FogExp2;
    isSoftwareGl: boolean;
    cameraGoalActive: boolean;
  } | null>(null);

  // Mount WebGL canvas once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    // 1. Software WebGL detection from GPU renderer string (never user agent)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const horizonColor = new THREE.Color(0x0f172a);
    scene.background = horizonColor;
    const fog = new THREE.FogExp2(0x0f172a, 0.015);
    scene.fog = fog;

    // 2. Mandatory Studio Environment Reflection (`RoomEnvironment`)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      45,
      mountEl.clientWidth / mountEl.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 18, 26);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 48;

    // Cancel scripted camera transition when user manually orbits
    let cameraGoalActive = false;
    controls.addEventListener('start', () => {
      cameraGoalActive = false;
      if (sceneRef.current) sceneRef.current.cameraGoalActive = false;
    });

    // 3. Balanced 3-Point Studio & Outdoor Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x422006, 0.75);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    keyLight.position.set(18, 26, 14);
    keyLight.castShadow = !isSoftwareGl;
    const d = 20;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 70;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-18, 14, -16);
    scene.add(rimLight);

    // 4. Procedural Topographic Relief Mesh of Uganda
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const terrainTex = createUgandaTerrainTexture(maxAniso);
    const shadowTex = createContactShadowTexture();

    const terrainGeo = new THREE.PlaneGeometry(34, 34, 96, 96);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, ugandaElevationAt(vx, vz));
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      roughness: 0.72,
      metalness: 0.08,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = !isSoftwareGl;
    scene.add(terrainMesh);

    // Subtle dark timber topographic plinth beneath the relief map (offset to avoid Z-fighting)
    const basePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(34.4, 0.8, 34.4),
      new THREE.MeshStandardMaterial({
        color: 0x1c1917,
        roughness: 0.5,
        metalness: 0.3,
      })
    );
    basePlinth.position.y = -0.38;
    scene.add(basePlinth);

    // 5. InstancedMesh Savanna Acacia Trees (> 60 trees across Murchison, Queen Elizabeth & Kidepo)
    const treeCount = 72;
    const trunkGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.32, 7);
    trunkGeo.translate(0, 0.16, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.9,
    });
    const canopyGeo = new THREE.CylinderGeometry(0.28, 0.12, 0.12, 9);
    canopyGeo.translate(0, 0.35, 0);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x4d7c0f,
      roughness: 0.78,
    });

    const instancedTrunks = new THREE.InstancedMesh(
      trunkGeo,
      trunkMat,
      treeCount
    );
    const instancedCanopies = new THREE.InstancedMesh(
      canopyGeo,
      canopyMat,
      treeCount
    );

    for (let i = 0; i < treeCount; i++) {
      const angle = i * 2.39996;
      const radius = 2.2 + (i / treeCount) * 11.5;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      const ty = ugandaElevationAt(tx, tz);

      // Vary scale by ±15%
      const s = 0.85 + ((i * 17) % 30) / 100;
      _dummyPos.set(tx, ty, tz);
      _dummyQuat.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (i * 0.7) % (Math.PI * 2)
      );
      _dummyScale.set(s, s, s);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);

      instancedTrunks.setMatrixAt(i, _dummyMatrix);
      instancedCanopies.setMatrixAt(i, _dummyMatrix);

      _dummyColor.setHSL(0.24 + ((i % 5) - 2) * 0.015, 0.65, 0.32);
      instancedCanopies.setColorAt(i, _dummyColor);
    }
    instancedTrunks.instanceMatrix.needsUpdate = true;
    instancedCanopies.instanceMatrix.needsUpdate = true;
    if (instancedCanopies.instanceColor) {
      instancedCanopies.instanceColor.needsUpdate = true;
    }
    instancedTrunks.computeBoundingSphere();
    instancedCanopies.computeBoundingSphere();
    scene.add(instancedTrunks);
    scene.add(instancedCanopies);

    // 6. Composite Landmark Props: Kasubi Royal Dome & 4x4 Safari Land Cruiser
    const [kasubiX, kasubiZ] = latLngToWorldXZ(0.3292, 32.5528);
    const kasubiDome = buildKasubiRoyalDomeGroup(kasubiX, kasubiZ, shadowTex);
    scene.add(kasubiDome);

    const safariCruiser = buildSafariLandCruiserGroup(isSoftwareGl, shadowTex);
    scene.add(safariCruiser);

    // 7. Interactive Destination Beacons Group
    const beaconsGroup = new THREE.Group();
    scene.add(beaconsGroup);

    sceneRef.current = {
      scene,
      camera,
      controls,
      terrainMesh,
      beaconsGroup,
      keyLight,
      hemiLight,
      fog,
      isSoftwareGl,
      cameraGoalActive,
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 8. High-Performance Raycasting (restricted to Layer 1, throttled)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let lastRaycastTime = 0;

    const handlePointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastRaycastTime < 50) return; // Throttle to 20Hz
      lastRaycastTime = now;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(beaconsGroup.children, true);
      if (hits.length > 0 && hits[0].object.userData?.attraction) {
        setHoveredAttraction(hits[0].object.userData.attraction);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredAttraction(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const handleClick = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(beaconsGroup.children, true);
      if (hits.length > 0 && hits[0].object.userData?.attraction) {
        onSelectRef.current(hits[0].object.userData.attraction);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);

    const handleResize = () => {
      if (!mountEl) return;
      camera.aspect = mountEl.clientWidth / mountEl.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // 9. Animation Loop with Software WebGL Fence Pacing (`afterDraw`)
    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Animate Safari Land Cruiser along the western Rift safari loop
      const loopAngle = elapsed * 0.22;
      const vx = Math.cos(loopAngle) * 7.5 - 2.0;
      const vz = Math.sin(loopAngle) * 6.5;
      const vy = ugandaElevationAt(vx, vz) * (sceneRef.current?.terrainMesh.scale.y || 1);
      _vehiclePos.set(vx, vy, vz);
      safariCruiser.position.copy(_vehiclePos);

      const nextAngle = loopAngle + 0.05;
      const nx = Math.cos(nextAngle) * 7.5 - 2.0;
      const nz = Math.sin(nextAngle) * 6.5;
      const ny = ugandaElevationAt(nx, nz) * (sceneRef.current?.terrainMesh.scale.y || 1);
      _vehicleNextPos.set(nx, ny, nz);
      safariCruiser.lookAt(_vehicleNextPos);

      // Smooth exponential camera damping when flying to a preset or selected attraction
      if (sceneRef.current?.cameraGoalActive) {
        const dampFactor = 1 - Math.exp(-4.5 * dt);
        camera.position.lerp(_targetCamPos, dampFactor);
        controls.target.lerp(_targetLookAt, dampFactor);
        if (
          camera.position.distanceToSquared(_targetCamPos) < 0.05 &&
          controls.target.distanceToSquared(_targetLookAt) < 0.05
        ) {
          sceneRef.current.cameraGoalActive = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.dispose();
      if (mountEl.contains(renderer.domElement)) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Rebuild 3D beacons when visible attractions or selection changes
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    while (ctx.beaconsGroup.children.length > 0) {
      ctx.beaconsGroup.remove(ctx.beaconsGroup.children[0]);
    }

    attractions.forEach((attr) => {
      const isSelected = selectedAttraction?.id === attr.id;
      const beacon = buildDestinationBeacon(attr, isSelected, ctx.isSoftwareGl);
      beacon.position.y =
        ugandaElevationAt(beacon.position.x, beacon.position.z) *
        verticalExaggeration;
      ctx.beaconsGroup.add(beacon);
    });
  }, [attractions, selectedAttraction, verticalExaggeration]);

  // Smoothly fly 3D camera to selectedAttraction
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx || !selectedAttraction) return;

    const [wx, wz] = latLngToWorldXZ(
      selectedAttraction.lat,
      selectedAttraction.lng
    );
    const wy = ugandaElevationAt(wx, wz) * verticalExaggeration;

    _targetLookAt.set(wx, wy + 0.5, wz);
    _targetCamPos.set(wx + 4.5, wy + 5.5, wz + 6.5);
    ctx.cameraGoalActive = true;
  }, [selectedAttraction, verticalExaggeration]);

  // Update vertical exaggeration on terrain mesh
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    ctx.terrainMesh.scale.y = verticalExaggeration;
  }, [verticalExaggeration]);

  // Update studio lighting preset
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    if (lightingPreset === 'golden') {
      ctx.keyLight.color.setHex(0xffedd5);
      ctx.keyLight.intensity = 2.4;
      ctx.keyLight.position.set(22, 16, 14);
      ctx.hemiLight.color.setHex(0xfde68a);
      ctx.scene.background = new THREE.Color(0x1c1917);
      ctx.fog.color.setHex(0x1c1917);
    } else if (lightingPreset === 'equatorial') {
      ctx.keyLight.color.setHex(0xffffff);
      ctx.keyLight.intensity = 2.6;
      ctx.keyLight.position.set(6, 32, 8);
      ctx.hemiLight.color.setHex(0xbae6fd);
      ctx.scene.background = new THREE.Color(0x0f172a);
      ctx.fog.color.setHex(0x0f172a);
    } else {
      ctx.keyLight.color.setHex(0xc084fc);
      ctx.keyLight.intensity = 1.5;
      ctx.keyLight.position.set(-18, 12, -10);
      ctx.hemiLight.color.setHex(0x312e81);
      ctx.scene.background = new THREE.Color(0x090d16);
      ctx.fog.color.setHex(0x090d16);
    }
  }, [lightingPreset]);

  const flyToPreset = (presetId: string) => {
    setActiveCameraPreset(presetId);
    const ctx = sceneRef.current;
    if (!ctx) return;

    if (presetId === 'overview') {
      _targetLookAt.set(0, 0, 0);
      _targetCamPos.set(0, 18, 26);
    } else if (presetId === 'rwenzori') {
      const [wx, wz] = latLngToWorldXZ(0.3858, 29.8717);
      _targetLookAt.set(wx, 3.2, wz);
      _targetCamPos.set(wx + 5, 6.8, wz + 6);
    } else if (presetId === 'murchison') {
      const [wx, wz] = latLngToWorldXZ(2.2833, 31.6833);
      _targetLookAt.set(wx, 1.2, wz);
      _targetCamPos.set(wx + 4.5, 4.8, wz + 5.5);
    } else if (presetId === 'bwindi') {
      const [wx, wz] = latLngToWorldXZ(-1.0461, 29.6919);
      _targetLookAt.set(wx, 2.5, wz);
      _targetCamPos.set(wx + 4.5, 5.8, wz + 5.5);
    } else if (presetId === 'elgon') {
      const [wx, wz] = latLngToWorldXZ(1.1333, 34.55);
      _targetLookAt.set(wx, 2.5, wz);
      _targetCamPos.set(wx - 5, 6.2, wz + 5.5);
    }
    ctx.cameraGoalActive = true;
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-stone-950">
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Top-Left Minimal Spec & Hover Readout Badge (Solid surface, no backdrop-filter over WebGL) */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-2 max-w-xs">
        <div
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.92)' }}
          className="border border-stone-700 rounded-xl px-4 py-2.5 text-stone-100 shadow-lg"
        >
          <div className="text-[11px] font-mono text-amber-400">
            3D TOPOGRAPHIC RELIEF · UGANDA
          </div>
          <div className="text-sm font-bold">
            Rwenzori · Virunga · Nile Basin · Elgon
          </div>
          <div className="text-[11px] text-stone-300 mt-0.5">
            Click any 3D beacon to inspect destination details
          </div>
        </div>

        {hoveredAttraction && (
          <div
            style={{ backgroundColor: 'rgba(28, 25, 23, 0.95)' }}
            className="border border-amber-500/60 rounded-xl px-4 py-2.5 text-white shadow-xl"
          >
            <div className="text-[11px] text-amber-400 font-semibold">
              {hoveredAttraction.region} Region
              {hoveredAttraction.unesco ? ' · UNESCO' : ''}
            </div>
            <div className="text-sm font-bold">{hoveredAttraction.name}</div>
            <div className="text-xs text-stone-300 line-clamp-2 mt-0.5">
              {hoveredAttraction.shortDesc}
            </div>
          </div>
        )}
      </div>

      {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div
        style={{
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'min(920px, 94vw)',
        }}
        className="absolute z-10 w-full flex flex-col items-center pointer-events-auto"
      >
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          style={{ backgroundColor: 'rgba(28, 25, 23, 0.94)' }}
          className="px-3.5 py-1.5 rounded-t-lg border border-b-0 border-stone-700 text-stone-200 hover:text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              Show 3D Controls
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              Hide Controls (Zen Mode)
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
            className="w-full border border-stone-700 rounded-xl px-4 py-3 text-stone-100 shadow-2xl flex flex-wrap items-center justify-between gap-4"
          >
            {/* Camera Regional Fly-To Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-stone-400 flex items-center gap-1 mr-1">
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                Camera:
              </span>
              {[
                { id: 'overview', label: 'All Uganda' },
                { id: 'rwenzori', label: 'Rwenzori (5,109m)' },
                { id: 'murchison', label: 'Murchison Gorge' },
                { id: 'bwindi', label: 'Bwindi & Virunga' },
                { id: 'elgon', label: 'Mt Elgon Caldera' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => flyToPreset(preset.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeCameraPreset === preset.id
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Vertical Relief Scale Slider */}
            <div className="flex items-center gap-2">
              <Mountain className="w-3.5 h-3.5 text-amber-400" />
              <label
                htmlFor="reliefScale"
                className="text-xs font-medium text-stone-300 whitespace-nowrap"
              >
                Relief Scale: {verticalExaggeration.toFixed(1)}x
              </label>
              <input
                id="reliefScale"
                type="range"
                min="0.6"
                max="1.8"
                step="0.1"
                value={verticalExaggeration}
                onChange={(e) =>
                  setVerticalExaggeration(parseFloat(e.target.value))
                }
                className="w-24 accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Atmosphere / Sun Lighting Presets */}
            <div className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              {(
                [
                  ['golden', 'Savanna Dawn'],
                  ['equatorial', 'Equatorial Noon'],
                  ['dusk', 'Rift Dusk'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLightingPreset(id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    lightingPreset === id
                      ? 'bg-stone-100 text-stone-900'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
