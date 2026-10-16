import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A shared, seamless 20-second exchange: telling, listening, answering, settling.
// Sampling the same clock keeps reactions connected and makes reverse scroll safe.
export function sampleConversation(time) {
  const phase = ((time % 20) + 20) % 20;
  const ease = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  const beat = (start, end, fade = 0.45) => ease(start, start + fade, phase) * (1 - ease(end - fade, end, phase));
  const first = beat(1.2, 6.0, 0.55);
  const second = beat(8.0, 11.8, 0.55);
  const reply = beat(12.9, 16.1, 0.55);
  return {
    clientSpeech: first + second,
    therapistSpeech: reply,
    rightHand: beat(0.75, 6.3, 0.7) * (0.76 + 0.18 * Math.sin(phase * 1.35)) + beat(7.7, 12.2, 0.65) * 0.4,
    leftHand: beat(7.35, 12.2, 0.75) * (0.7 + 0.14 * Math.sin(phase * 1.1 + 0.8)),
    emphasis: beat(3.1, 4.1, 0.38) * 0.75 + beat(9.4, 10.45, 0.4),
    hesitation: beat(0.05, 1.65, 0.45) + beat(6.45, 7.8, 0.4) * 0.55,
    nod: beat(5.95, 6.75, 0.34) * 0.75 + beat(6.9, 7.65, 0.32) * 0.45 + beat(11.9, 12.65, 0.32) * 0.8,
    replyHand: beat(12.35, 16.55, 0.8),
    acknowledge: beat(16.4, 17.3, 0.38) + beat(17.5, 18.25, 0.32) * 0.55,
    warmth: beat(12.1, 19.7, 1.0),
    syllable: Math.pow(Math.max(0, Math.sin(phase * 11.3)), 1.3) * (0.45 + 0.55 * Math.pow(Math.sin(phase * 7.7 + 0.4), 2)),
  };
}

export function sampleCameraShot(progress, time) {
  const phase = ((time % 20) + 20) % 20;
  const ease = (a, b, x) => THREE.MathUtils.smootherstep(x, a, b);
  // Anticipate the listening nod and reply, then return to the client's reaction.
  const reaction = ease(4, 6, phase) * (1 - ease(6.9, 9, phase));
  const answer = ease(10.1, 12.2, phase) * (1 - ease(15.9, 18, phase));
  const therapist = reaction + answer;
  return {
    strength: ease(0.375, 0.435, progress) * (1 - ease(0.51, 0.565, progress)),
    therapist,
    transition: 4 * therapist * (1 - therapist),
  };
}

function blinkAt(time, offset) {
  const phase = ((time + offset) % 23.4 + 23.4) % 23.4;
  let blink = 0;
  for (const center of [1.8, 5.7, 6.06, 11.35, 17.8, 22.9]) {
    blink = Math.max(blink, THREE.MathUtils.smoothstep(phase, center - 0.09, center) * (1 - THREE.MathUtils.smoothstep(phase, center + 0.035, center + 0.18)));
  }
  return blink;
}

// A tiny film set. Every prop and character is modelled here, with no downloaded assets.
export function createRoom(canvas, { onReady, onError, reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    onError?.(error);
    return { update() {}, resize() {}, dispose() {}, setReducedMotion() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0xf7f4ed, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 70);
  const root = new THREE.Group();
  scene.add(root);
  const palette = {
    plaster: 0xe7ddcc, ivory: 0xf6ecdb, edge: 0xb4a48d, oak: 0xac7953,
    oakLight: 0xd2aa76, sage: 0xa6af89, olive: 0x69764e, dark: 0x273b31,
    terra: 0xb96349, sand: 0xe5c3a0, yellow: 0xe2b35d, skin: 0xe5aa80,
    hair: 0x533d31, ink: 0x283e36, white: 0xfff9eb, blue: 0xb6c6c2,
  };
  const materials = {};
  function mat(color, roughness = 0.83, extra = {}) {
    const key = `${color}-${roughness}-${JSON.stringify(extra)}`;
    return materials[key] ||= new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  }
  const M = Object.fromEntries(Object.entries(palette).map(([name, color]) => [name, mat(color)]));
  function mesh(geometry, material, parent = root, position = [0, 0, 0]) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(w, h, d, material, parent, position, radius = 0.055) {
    return mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)), material, parent, position);
  }
  function sphere(radius, material, parent, position, scale = [1, 1, 1]) {
    const object = mesh(new THREE.SphereGeometry(radius, 24, 16), material, parent, position);
    object.scale.set(...scale);
    return object;
  }
  function cylinder(rt, rb, height, material, parent, position, segments = 32) {
    return mesh(new THREE.CylinderGeometry(rt, rb, height, segments), material, parent, position);
  }
  function tube(points, radius, material, parent = root, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
    return mesh(new THREE.TubeGeometry(curve, Math.max(20, points.length * 9), radius, 7, closed), material, parent);
  }
  function capsule(length, radius, material, parent, position = [0, 0, 0]) {
    return mesh(new THREE.CapsuleGeometry(radius, Math.max(0.001, length - radius * 2), 4, 12), material, parent, position);
  }
  const ambient = new THREE.HemisphereLight(0xfff6df, 0xb8bba0, 1.7);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffedcb, 2.7);
  sun.position.set(-3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.0003;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe4eee8, 0.7);
  fill.position.set(4, 3, -2);
  scene.add(fill);

  // Floating, cut-away architecture with a real silhouette, softly rounded edges.
  const stage = new THREE.Group();
  root.add(stage);
  // The room opens like a little stage set in the final act.
  const architecture = new THREE.Group();
  stage.add(architecture);
  const floor = new THREE.Group();
  stage.add(floor);
  box(6.45, 0.22, 4.65, M.plaster, floor, [0, -0.16, 0], 0.18);
  const floorSurface = box(6.37, 0.085, 4.57, mat(0xf6ecdb, .83, { name: 'continuous-floor' }), floor, [0, -0.012, 0], 0.14);
  box(6.37, 0.035, 4.57, M.oakLight, floor, [0, -0.225, 0], 0.03);
  const plankMat = mat(0xc9b89a, 1, { transparent: true, opacity: 0.26, depthWrite: false });
  for (let x = -2.8; x < 3; x += 0.57) box(0.008, 0.003, 4.3, plankMat, floor, [x, 0.034, 0], 0.001);
  box(6.35, 2.86, 0.18, M.plaster, architecture, [0, 1.43, -2.21], 0.08);
  box(6.1, 0.095, 0.085, M.ivory, architecture, [0, 0.15, -2.085], 0.015);
  box(0.16, 2.86, 1.18, M.plaster, architecture, [-3.11, 1.43, -1.7], 0.07);
  box(0.15, 0.1, 1.12, M.ivory, architecture, [-3.015, 0.15, -1.7], 0.02);

  // Rounded arched window, inset glazing and linen curtains.
  function archShape(width, height) {
    const shape = new THREE.Shape();
    const r = width / 2;
    shape.moveTo(-r, 0);
    shape.lineTo(r, 0);
    shape.lineTo(r, height - r);
    shape.absarc(0, height - r, r, 0, Math.PI, false);
    shape.lineTo(-r, 0);
    return shape;
  }
  const windowGroup = new THREE.Group();
  windowGroup.position.set(0.81, 0.64, -2.083);
  architecture.add(windowGroup);
  const archFrame = mesh(new THREE.ExtrudeGeometry(archShape(1.58, 2.02), { depth: 0.065, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.025, curveSegments: 30 }), M.ivory, windowGroup);
  const glass = mesh(new THREE.ShapeGeometry(archShape(1.35, 1.84), 30), mat(0xc2d8ce, 0.7, { emissive: 0xc6d6c5, emissiveIntensity: 0.12 }), windowGroup, [0, 0.09, 0.093]);
  glass.receiveShadow = false;
  // A stylised garden is visible through the window.
  sphere(0.43, mat(0xb5c5a1), windowGroup, [-0.35, 0.52, 0.1], [0.7, 1.1, 0.035]);
  sphere(0.48, mat(0x9eaf8f), windowGroup, [0.29, 0.3, 0.105], [0.8, 0.95, 0.035]);
  box(0.045, 1.74, 0.045, M.ivory, windowGroup, [0, 0.98, 0.14], 0.01);
  box(1.3, 0.05, 0.045, M.ivory, windowGroup, [0, 0.89, 0.14], 0.01);
  box(1.86, 0.1, 0.29, M.ivory, windowGroup, [0, 0.025, 0.09], 0.035);
  const rod = cylinder(0.018, 0.018, 2.14, M.oak, architecture, [0.8, 2.74, -1.85]);
  rod.rotation.z = Math.PI / 2;
  const linen = mat(0xe8c7a7, 0.97);
  for (const side of [-1, 1]) {
    const curtain = new THREE.Group();
    curtain.position.set(0.81 + side * 0.91, 1.76, -1.91);
    architecture.add(curtain);
    for (let i = 0; i < 4; i++) {
      const panel = capsule(1.79 - i * 0.018, 0.077, linen, curtain, [side * (i - 1.5) * 0.091, 0, Math.sin(i * 1.7) * 0.035]);
      panel.scale.z = 0.62;
    }
    box(0.38, 0.065, 0.13, M.oakLight, curtain, [0, -0.28, 0.035], 0.025);
  }

  // Gallery art: abstract landscape, physically layered into a wooden frame.
  const art = new THREE.Group();
  art.position.set(-1.53, 1.93, -2.055);
  architecture.add(art);
  box(0.84, 1.03, 0.08, M.oakLight, art, [0, 0, 0], 0.025);
  box(0.73, 0.92, 0.016, M.white, art, [0, 0, 0.05], 0.008);
  sphere(0.15, M.terra, art, [0.125, 0.205, 0.065], [1, 1, 0.02]);
  sphere(0.33, M.sage, art, [-0.025, -0.2, 0.07], [0.85, 0.56, 0.015]);
  sphere(0.29, M.olive, art, [0.068, -0.31, 0.077], [0.91, 0.43, 0.018]);
  tube([[-0.23, -0.25, 0.085], [-0.07, -0.14, 0.085], [0.03, 0.05, 0.085]], 0.009, M.oak, art);

  // Storage, tiny imperfectly stacked books and a ceramic vase.
  const shelf = new THREE.Group();
  shelf.position.set(-2.31, 0, -1.73);
  stage.add(shelf);
  for (const x of [-0.53, 0.53]) box(0.07, 0.91, 0.41, M.oakLight, shelf, [x, 0.5, 0], 0.018);
  for (const y of [0.16, 0.53, 0.96]) box(1.18, 0.075, 0.49, M.oakLight, shelf, [0, y, 0], 0.025);
  const bookMats = [M.terra, M.sage, M.ivory, M.dark, M.sand];
  for (let i = 0; i < 7; i++) {
    const book = box(0.085 + (i % 2) * 0.022, 0.22 + (i % 3) * 0.031, 0.27, bookMats[i % 5], shelf, [-0.41 + i * 0.12, 0.695 + (i % 3) * 0.015, 0.035], 0.012);
    if (i === 6) book.rotation.z = -0.12;
    box(0.042, 0.009, 0.004, M.ivory, book, [0, 0.065, 0.139], 0.002);
  }
  for (let i = 0; i < 3; i++) box(0.42 - i * 0.015, 0.062, 0.28, bookMats[(i + 1) % 5], shelf, [-0.18, 0.23 + i * 0.064, 0.04], 0.011).rotation.y = i * 0.055;
  sphere(0.15, M.sand, shelf, [0.35, 0.34, 0], [0.8, 0.95, 0.8]);
  const vase = cylinder(0.07, 0.115, 0.25, M.terra, shelf, [-0.31, 1.12, 0]);
  cylinder(0.061, 0.062, 0.009, M.hair, shelf, [-0.31, 1.247, 0]);
  for (let i = 0; i < 3; i++) {
    tube([[-0.31, 1.22, 0], [-0.38 + i * 0.07, 1.46, 0.01], [-0.46 + i * 0.14, 1.57 + (i % 2) * 0.08, 0.03]], 0.009, M.olive, shelf);
    const leaf = sphere(0.08, M.olive, shelf, [-0.46 + i * 0.14, 1.57 + (i % 2) * 0.08, 0.03], [0.42, 1, 0.2]);
    leaf.rotation.z = (i - 1) * 0.6;
  }

  // Rug, with a second inset edge and woven-tone concentric details.
  const rug = cylinder(1.74, 1.74, 0.025, M.sage, stage, [0, 0.052, 0.43], 72);
  rug.scale.set(1.33, 1, 0.84);
  const rugInner = cylinder(1.61, 1.61, 0.005, mat(0xadb596), stage, [0, 0.067, 0.43], 72);
  rugInner.scale.set(1.33, 1, 0.84);
  const rugEdge = mesh(new THREE.TorusGeometry(1.62, 0.009, 5, 90), mat(0xcbd0b0), stage, [0, 0.075, 0.43]);
  rugEdge.rotation.x = -Math.PI / 2;
  rugEdge.scale.set(1.33, 0.84, 1);

  function chair(x, z, rotation, upholstery) {
    const group = new THREE.Group();
    group.position.set(x, 0.09, z);
    group.rotation.y = rotation;
    stage.add(group);
    for (const lx of [-0.34, 0.34]) for (const lz of [-0.31, 0.3]) {
      const leg = cylinder(0.055, 0.047, 0.22, M.oak, group, [lx, 0.13, lz]);
      leg.rotation.z = -lx * 0.12;
      leg.rotation.x = lz * 0.14;
    }
    box(1.02, 0.25, 0.93, upholstery, group, [0, 0.34, 0], 0.12);
    // Keep the cushion below the horizontal thighs rather than inside the legs.
    box(0.79, 0.18, 0.8, upholstery, group, [0, 0.41, 0.075], 0.085);
    const back = box(1.02, 0.92, 0.27, upholstery, group, [0, 0.76, -0.37], 0.12);
    back.rotation.x = -0.085;
    box(0.81, 0.67, 0.12, upholstery, group, [0, 0.82, -0.198], 0.08).rotation.x = -0.085;
    for (const side of [-1, 1]) box(0.2, 0.38, 0.86, upholstery, group, [side * 0.48, 0.55, 0.03], 0.095);
    return group;
  }
  const clientSeat = { x: -1.2, z: 0.54, yaw: 0.55 };
  const therapistSeat = { x: 1.29, z: 0.32, yaw: -0.59 };
  chair(clientSeat.x, clientSeat.z, clientSeat.yaw, mat(0xca9870));
  chair(therapistSeat.x, therapistSeat.z, therapistSeat.yaw, mat(0xe3c697));

  // Coffee table, little cup and the box of tissues.
  const table = new THREE.Group();
  table.position.set(0.18, 0, 0.47);
  stage.add(table);
  cylinder(0.56, 0.54, 0.09, M.oakLight, table, [0, 0.55, 0]);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    const leg = cylinder(0.035, 0.048, 0.47, M.oak, table, [Math.cos(angle) * 0.23, 0.285, Math.sin(angle) * 0.23]);
    leg.rotation.z = -Math.cos(angle) * 0.14;
    leg.rotation.x = Math.sin(angle) * 0.14;
  }
  const cup = new THREE.Group();
  cup.position.set(-0.34, 0, 0.26);
  table.add(cup);
  cylinder(0.092, 0.074, 0.13, M.ivory, cup, [0, 0.66, 0]);
  cylinder(0.071, 0.071, 0.005, mat(0x77523b), cup, [0, 0.727, 0]);
  const cupHandle = mesh(new THREE.TorusGeometry(0.05, 0.015, 7, 16), M.ivory, cup, [-0.098, 0.663, 0]);
  const tissues = new THREE.Group();
  tissues.position.set(0.31, 0, 0.25);
  table.add(tissues);
  box(0.19, 0.115, 0.16, M.sage, tissues, [0, 0.6525, 0], 0.025);
  const tissue = box(0.09, 0.09, 0.017, M.white, tissues, [0, 0.752, 0], 0.006);
  tissue.rotation.z = -0.19;

  function plant(parent, position, size = 1) {
    const group = new THREE.Group();
    group.position.set(...position);
    group.scale.setScalar(size);
    parent.add(group);
    cylinder(0.25, 0.19, 0.42, M.terra, group, [0, 0.23, 0]);
    cylinder(0.255, 0.255, 0.065, M.sand, group, [0, 0.43, 0]);
    cylinder(0.225, 0.225, 0.015, M.hair, group, [0, 0.468, 0]);
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.4;
      const height = 0.79 + (i % 3) * 0.19;
      const sx = Math.cos(angle) * (0.28 + (i % 2) * 0.09);
      const sz = Math.sin(angle) * (0.28 + (i % 2) * 0.09);
      tube([[0, 0.44, 0], [sx * 0.3, height * 0.9, sz * 0.3], [sx, height, sz]], 0.014, M.olive, group);
      const leaf = sphere(0.17, i % 2 ? M.olive : M.sage, group, [sx, height, sz], [0.56, 1.38, 0.15]);
      leaf.rotation.set(0.3, -angle, -sx * 1.4);
    }
    return group;
  }
  plant(stage, [2.64, 0.055, -1.27], 1.2);
  const lamp = new THREE.Group();
  lamp.position.set(2.47, 0.06, 0.55);
  stage.add(lamp);
  cylinder(0.22, 0.25, 0.085, M.dark, lamp, [0, 0.04, 0]);
  cylinder(0.024, 0.024, 1.72, M.oak, lamp, [0, 0.92, 0]);
  cylinder(0.23, 0.42, 0.42, M.ivory, lamp, [0, 1.87, 0]);
  cylinder(0.39, 0.39, 0.025, mat(0xf5d894, 0.8, { emissive: 0xffcf70, emissiveIntensity: 0.26 }), lamp, [0, 1.663, 0]);
  const lampLight = new THREE.PointLight(0xffd399, 0.5, 4, 2);
  lampLight.position.set(0, 1.62, 0);
  lamp.add(lampLight);

  // Articulated clay actors. Local -Y is the direction of each limb.
  function person({ shirt, pants, hair, skin, therapist = false }) {
    const rig = new THREE.Group();
    stage.add(rig);
    const torso = new THREE.Group();
    rig.add(torso);
    box(0.43, 0.47, 0.29, shirt, torso, [0, 0.31, 0], 0.115);
    sphere(0.16, shirt, torso, [0, 0.1, 0], [1.3, 0.73, 0.95]);
    cylinder(0.068, 0.08, 0.12, skin, torso, [0, 0.6, 0]);
    const head = new THREE.Group();
    head.position.set(0, 0.64, 0.018);
    torso.add(head);
    sphere(0.235, skin, head, [0, 0.205, 0], [0.9, 1.17, 0.9]);
    const eyes = [], brows = [];
    for (const side of [-1, 1]) {
      sphere(0.048, skin, head, [side * 0.207, 0.205, 0], [0.7, 1.12, 0.65]);
      const socket = new THREE.Group();
      socket.position.set(side * 0.075, 0.235, 0.205);
      head.add(socket);
      const opening = new THREE.Group();
      socket.add(opening);
      sphere(0.036, M.white, opening, [0, 0, 0], [0.91, 1, 0.42]);
      const pupil = new THREE.Group();
      opening.add(pupil);
      sphere(0.018, M.ink, pupil, [0, -0.003, 0.016], [0.85, 1, 0.45]);
      sphere(0.005, M.white, pupil, [-0.004, 0.005, 0.024]);
      const lid = tube([[-0.026,0,0.018],[0,-0.003,0.023],[0.026,0,0.018]], 0.004, hair, socket);
      lid.visible = false;
      eyes.push({ opening, pupil, lid });
      const brow = capsule(0.063, 0.009, hair, head, [side * 0.077, 0.291, 0.199]);
      brow.rotation.z = Math.PI / 2 - side * 0.1;
      brows.push(brow);
      sphere(0.034, mat(0xd68d76), head, [side * 0.119, 0.156, 0.178], [1, 0.47, 0.15]);
    }
    sphere(0.046, skin, head, [0, 0.181, 0.216], [0.7, 0.95, 0.83]);
    const mouthCurve = points => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 24, 0.006, 6, false);
    const mouthGeometry = mouthCurve([[-0.046,0.116,0.199],[0,0.112,0.218],[0.046,0.116,0.199]]);
    const mouthTargets = [
      mouthCurve([[-0.046,0.102,0.199],[0,0.124,0.218],[0.046,0.102,0.199]]),
      mouthCurve([[-0.049,0.136,0.199],[0,0.102,0.218],[0.049,0.136,0.199]]),
    ];
    mouthGeometry.morphAttributes.position = mouthTargets.map(g => g.attributes.position);
    mouthGeometry.morphAttributes.normal = mouthTargets.map(g => g.attributes.normal);
    const mouth = mesh(mouthGeometry, mat(0xa26d58), head);
    mouthTargets.forEach(g => g.dispose());
    const mouthOpening = sphere(0.042, mat(0x80503e), head, [0,0.11,0.219], [0.85,0.035,0.18]);
    const hairCap = mesh(new THREE.SphereGeometry(0.236, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.43), hair, head, [0, 0.234, -0.012]);
    hairCap.scale.set(0.96, 1.12, 0.95);
    sphere(0.16, hair, head, [0, 0.28, -0.127], [1.1, 0.97, 0.55]);
    // Side-swept locks keep the face expressive and the silhouette human.
    for (let i = 0; i < 3; i++) {
      const lock = sphere(0.105, hair, head, [-0.102 + i * 0.076, 0.374 + Math.sin(i * 1.8) * 0.027, 0.097], [1.03, 0.6, 0.91]);
      lock.rotation.z = -0.35;
    }
    if (therapist) {
      sphere(0.125, hair, head, [0.04, 0.32, -0.2], [1, 1, 0.8]);
      for (const side of [-1, 1]) {
        const glasses = mesh(new THREE.TorusGeometry(0.053, 0.007, 5, 20), M.oak, head, [side * 0.073, 0.231, 0.237]);
        glasses.scale.y = 0.9;
      }
      tube([[-0.023, 0.24, 0.238], [0, 0.248, 0.244], [0.023, 0.24, 0.238]], 0.006, M.oak, head);
      sphere(0.014, M.yellow, head, [-0.215, 0.146, 0.022]);
      sphere(0.014, M.yellow, head, [0.215, 0.146, 0.022]);
    }
    const arms = [];
    const legs = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.246, 0.49, 0);
      torso.add(shoulder);
      capsule(0.31, 0.077, shirt, shoulder, [0, -0.12, 0]);
      const elbow = new THREE.Group();
      elbow.position.y = -0.266;
      shoulder.add(elbow);
      capsule(0.24, 0.057, therapist ? shirt : skin, elbow, [0, -0.093, 0]);
      const wrist = new THREE.Group();
      wrist.position.set(0, -0.213, 0);
      elbow.add(wrist);
      const palm = sphere(0.068, skin, wrist, [0, 0, 0], [0.81, 1.12, 0.72]);
      sphere(0.025, skin, wrist, [side * 0.046, 0.02, 0.021], [0.8, 1.3, 0.8]);
      arms.push({ shoulder, elbow, wrist, palm });
      const hip = new THREE.Group();
      hip.position.set(side * 0.108, 0.02, 0);
      rig.add(hip);
      capsule(0.43, 0.094, pants, hip, [0, -0.18, 0]);
      const knee = new THREE.Group();
      knee.position.y = -0.38;
      hip.add(knee);
      capsule(0.60, 0.077, pants, knee, [0, -0.26, 0]);
      box(0.155, 0.1, 0.28, therapist ? M.oak : M.ivory, knee, [0, -0.59, 0.069], 0.049);
      box(0.158, 0.025, 0.286, therapist ? M.hair : M.sand, knee, [0, -0.636, 0.069], 0.01);
      legs.push({ hip, knee });
    }
    return { rig, torso, head, arms, legs, face: { eyes, brows, mouth, mouthOpening } };
  }
  const client = person({ shirt: M.terra, pants: M.ivory, hair: M.hair, skin: M.skin });
  const therapist = person({ shirt: M.dark, pants: mat(0xab916d), hair: mat(0x62452c), skin: mat(0xd9a078), therapist: true });
  therapist.rig.position.set(therapistSeat.x, 0.68, therapistSeat.z + 0.045);
  therapist.rig.rotation.y = therapistSeat.yaw - 0.16;
  // The notebook is held in the therapist's lap.
  const notebook = new THREE.Group();
  notebook.position.set(0.025, 0.075, 0.32);
  notebook.rotation.x = -0.15;
  therapist.rig.add(notebook);
  box(0.3, 0.037, 0.24, M.terra, notebook, [0, 0, 0], 0.015);
  box(0.275, 0.011, 0.216, M.ivory, notebook, [0, 0.021, 0], 0.004);
  const pencil = cylinder(0.009, 0.009, 0.24, M.oak, notebook, [0.03, 0.04, 0.025], 8);
  pencil.rotation.z = 1.23;

  // One readable thought bubble. The same strands untangle into a living sprig.
  const thoughts = new THREE.Group();
  stage.add(thoughts);
  const cloudMaterial = mat(0xfff9eb, 0.9, { name: 'thought-cloud', transparent: true, opacity: 1, depthWrite: false });
  const worries = new THREE.Group();
  thoughts.add(worries);
  // A single bevelled silhouette avoids intersecting translucent cloud lobes.
  const cloudShape = new THREE.Shape();
  cloudShape.moveTo(-0.38, -0.22);
  cloudShape.bezierCurveTo(-0.64, -0.22, -0.66, 0.13, -0.43, 0.16);
  cloudShape.bezierCurveTo(-0.42, 0.39, -0.16, 0.43, -0.04, 0.29);
  cloudShape.bezierCurveTo(0.12, 0.46, 0.39, 0.36, 0.4, 0.19);
  cloudShape.bezierCurveTo(0.65, 0.2, 0.67, -0.16, 0.44, -0.21);
  cloudShape.bezierCurveTo(0.24, -0.27, -0.17, -0.25, -0.38, -0.22);
  const thoughtCloud = mesh(new THREE.ExtrudeGeometry(cloudShape, { depth: 0.07, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 12 }), cloudMaterial, worries, [0, 0, -0.13]);
  const thoughtDots = [
    sphere(0.034, cloudMaterial, worries, [-0.10, -0.43, 0]),
    sphere(0.058, cloudMaterial, worries, [-0.19, -0.33, 0]),
  ];

  const knot = new THREE.Group();
  thoughts.add(knot);
  const thoughtStrands = [];
  const tangledCurves = [
    [[-0.32,-0.06,0.16],[-0.28,0.15,0.18],[-0.08,0.21,0.12],[0.16,0.09,0.18],[0.21,-0.1,0.14],[0.04,-0.13,0.12],[-0.13,0.03,0.22],[0.04,0.16,0.14],[0.3,0.08,0.17]],
    [[-0.29,0.08,0.20],[-0.13,-0.10,0.21],[0.12,-0.09,0.12],[0.29,0.13,0.14],[0.13,0.23,0.20],[-0.06,0.08,0.23],[-0.11,-0.13,0.15],[0.12,-0.11,0.22],[0.31,0.05,0.14]],
    [[-0.32,0.14,0.13],[-0.09,0.24,0.15],[0.11,0.05,0.24],[0.03,-0.12,0.20],[-0.22,-0.10,0.14],[-0.22,0.08,0.13],[0.02,0.15,0.13],[0.26,0.04,0.22],[0.25,-0.1,0.17]],
  ];
  const sprigCurves = [
    [[-0.02,-0.23,0.15], [0,-0.09,0.16], [0.025,0.065,0.15], [0.13,0.23,0.16], [0.21,0.32,0.15]],
    [[0,-0.12,0.16], [-0.12,-0.025,0.17], [-0.26,0.08,0.16], [-0.38,0.16,0.15]],
    [[0.02,0.015,0.16], [0.17,0.03,0.17], [0.3,0.12,0.16], [0.4,0.21,0.15]],
  ];
  const strandColors = [0x71887c, 0xbf765d, 0xcda358];
  const sprigColors = [0x718455, 0x91a16f, 0xc6a45f];
  for (let j = 0; j < 3; j++) {
    const points = tangledCurves[j].map(p => new THREE.Vector3(...p));
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, 0.017, 7, false);
    const target = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sprigCurves[j].map(p => new THREE.Vector3(...p))), 96, 0.017, 7, false);
    // GPU morphing keeps topology, depth and normals continuous while scrubbing.
    geometry.morphAttributes.position = [target.attributes.position];
    geometry.morphAttributes.normal = [target.attributes.normal];
    const material = mat(strandColors[j], 0.75, { name: `thought-strand-${j}`, transparent: true, depthWrite: false });
    const strand = mesh(geometry, material, knot);
    thoughtStrands.push({ strand, from: new THREE.Color(strandColors[j]), to: new THREE.Color(sprigColors[j]) });
    target.dispose();
  }
  const peace = new THREE.Group();
  thoughts.add(peace);
  const leafMaterial = mat(0x9ba978, 0.85, { name: 'thought-leaves', transparent: true, opacity: 0, depthWrite: false });
  const peacefulLeaves = [];
  const leafPositions = [[-0.15,0.02,-0.85],[-0.25,0.115,0.6],[-0.38,0.20,-0.65],[0.04,0.12,-0.65],[0.13,0.22,0.7],[0.22,0.35,-0.3],[0.2,0.07,-0.8],[0.31,0.17,0.65],[0.42,0.25,-0.6]];
  for (const [i, [x,y,angle]] of leafPositions.entries()) {
    const leaf = sphere(0.08, leafMaterial, peace, [x,y,0.17], [0.53,1,0.24]);
    leaf.rotation.set(0.06, i % 2 ? -0.18 : 0.18, angle);
    peacefulLeaves.push({ leaf, angle });
  }
  // Imagined objects should not cast busy, impossible shadows onto the face/set.
  thoughts.traverse(object => { object.castShadow = false; object.receiveShadow = false; });

  // Act seven: a real folding laptop, with a clay portrait on its screen.
  const laptop = new THREE.Group();
  laptop.position.set(table.position.x, 0.6225, table.position.z - 0.15);
  stage.add(laptop);
  box(0.87, 0.055, 0.56, M.dark, laptop, [0, 0, 0], 0.025);
  box(0.67, 0.01, 0.3, M.sage, laptop, [0, 0.032, -0.045], 0.016);
  box(0.2, 0.008, 0.105, M.blue, laptop, [0, 0.038, 0.17], 0.01);
  const laptopScreen = new THREE.Group();
  laptopScreen.position.set(0, 0.025, -0.255);
  laptop.add(laptopScreen);
  box(0.87, 0.6, 0.065, M.dark, laptopScreen, [0, 0.3, 0], 0.045);
  box(0.75, 0.49, 0.012, mat(0xc6d8c5, 0.7, { emissive: 0xadc8b5, emissiveIntensity: 0.18 }), laptopScreen, [0, 0.31, 0.042], 0.025);
  sphere(0.052, M.dark, laptopScreen, [0, 0.583, 0.034], [0.2, 0.2, 0.2]);
  const onlinePortrait = new THREE.Group();
  onlinePortrait.position.set(0, 0.29, 0.065);
  laptopScreen.add(onlinePortrait);
  sphere(0.16, M.terra, onlinePortrait, [0, -0.085, 0], [1.1, 0.65, 0.13]);
  sphere(0.1, M.skin, onlinePortrait, [0, 0.055, 0.016], [0.82, 1, 0.2]);
  sphere(0.102, M.hair, onlinePortrait, [0, 0.106, 0.012], [0.85, 0.5, 0.21]);
  for (const side of [-1, 1]) sphere(0.009, M.dark, onlinePortrait, [side * 0.032, 0.062, 0.038], [1, 1, 0.3]);
  const connectionDot = sphere(0.026, M.olive, laptopScreen, [0.3, 0.12, 0.062], [1, 1, 0.25]);

  // Act eight: time becomes tangible, without tiny unreadable labels.
  const sessionClock = new THREE.Group();
  sessionClock.position.set(0.12, 1.85, -0.07);
  stage.add(sessionClock);
  const clockFace = cylinder(0.42, 0.42, 0.085, M.ivory, sessionClock, [0, 0, 0], 48);
  clockFace.rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.42, 0.022, 6, 48), M.oakLight, sessionClock, [0, 0, 0.045]);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const tick = box(0.015, i % 3 ? 0.034 : 0.055, 0.014, M.olive, sessionClock, [Math.sin(a) * 0.34, Math.cos(a) * 0.34, 0.057], 0.004);
    tick.rotation.z = -a;
  }
  const minuteHand = new THREE.Group();
  const hourHand = new THREE.Group();
  sessionClock.add(minuteHand, hourHand);
  box(0.023, 0.3, 0.018, M.dark, minuteHand, [0, 0.12, 0.074], 0.008);
  box(0.037, 0.2, 0.018, M.terra, hourHand, [0, 0.073, 0.093], 0.009);
  sphere(0.035, M.yellow, sessionClock, [0, 0, 0.11], [1, 1, 0.45]);

  // The last two acts transform the room into an open garden courtyard.
  const garden = new THREE.Group();
  stage.add(garden);
  // The original floor expands into the courtyard. A second overlapping floor
  // caused depth flicker and left the departing actor floating above the garden.
  const steppingStones = [];
  for (let i = 0; i < 6; i++) {
    const fraction = i / 5;
    const stone = cylinder(0.25, 0.28, 0.008, M.ivory, garden, [-0.88 + fraction * 0.47, 0.034, 1.13 + fraction * 1.32], 20);
    stone.scale.z = 0.62;
    stone.rotation.y = i * 0.6;
    steppingStones.push(stone);
  }
  const gardenPlants = [plant(garden, [-3.21, -0.04, 1.58], 1.05), plant(garden, [3.1, -0.04, -2.12], 1.35)];
  const gardenArch = new THREE.Group();
  gardenArch.position.set(-0.18, 0, -2.42);
  garden.add(gardenArch);
  const archPoints = [[-1.02, 0.02, 0], [-1.02, 1.46, 0]];
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI - i / 18 * Math.PI;
    archPoints.push([Math.cos(a) * 1.02, 1.46 + Math.sin(a) * 1.02, 0]);
  }
  archPoints.push([1.02, 0.02, 0]);
  tube(archPoints, 0.046, M.oakLight, gardenArch);
  const archLeaves = [];
  for (let i = 0; i < 14; i++) {
    const a = Math.PI - i / 13 * Math.PI;
    const leaf = sphere(0.13, i % 3 ? M.sage : M.yellow, gardenArch, [Math.cos(a) * 1.04, 1.48 + Math.sin(a) * 1.04, 0.025], [0.56, 1.24, 0.19]);
    leaf.rotation.z = -a + (i % 2 ? 0.5 : -0.6);
    archLeaves.push(leaf);
  }
  for (const [x, z, scale] of [[-2.8, -2.28, 0.7], [2.87, 2.31, 0.65], [-2.87, 2.35, 0.42]]) {
    sphere(0.54, M.sage, garden, [x, 0.23, z], [scale, scale * 0.8, scale]);
    sphere(0.4, M.olive, garden, [x + 0.27, 0.17, z + 0.08], [scale, scale * 0.7, scale]);
  }

  // A contact shadow grounds the miniature without introducing a background plane.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 3, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(71,60,41,0.19)');
  gradient.addColorStop(0.58, 'rgba(71,60,41,0.10)');
  gradient.addColorStop(1, 'rgba(71,60,41,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const contact = mesh(new THREE.PlaneGeometry(8.5, 6.9), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }), scene, [0, -0.3, 0.2]);
  contact.rotation.x = -Math.PI / 2;
  contact.castShadow = contact.receiveShadow = false;

  let width = 1, height = 1, disposed = false;
  const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  const mix = THREE.MathUtils.lerp;
  const cameraTarget = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const nextCamera = new THREE.Vector3();
  const portraitTarget = new THREE.Vector3();
  const portraitPosition = new THREE.Vector3();
  const viewDirection = new THREE.Vector3();
  const viewRight = new THREE.Vector3();
  const viewUp = new THREE.Vector3();
  const framingPoint = new THREE.Vector3();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const floorRoomColor = new THREE.Color(0xf6ecdb);
  const floorGardenColor = new THREE.Color(0xd6d9b9);
  const soleCorners = [[-0.0125, -0.143], [-0.0125, 0.143], [0.0125, -0.143], [0.0125, 0.143]];
  function plantFeet(actor) {
    let lowest = Infinity;
    for (const { hip, knee } of actor.legs) {
      const thigh = hip.rotation.x;
      const shin = thigh + knee.rotation.x;
      for (const [y, z] of soleCorners) {
        lowest = Math.min(lowest, hip.position.y - 0.38 * Math.cos(thigh) + (-0.636 + y) * Math.cos(shin) - (0.069 + z) * Math.sin(shin));
      }
    }
    actor.rig.position.y = 0.0365 - lowest;
  }
  const keyframes = [
    { p: 0, position: [7.4, 6.15, 10.7], target: [0, 1.06, 0] },
    { p: 0.13, position: [5.6, 5.0, 10.9], target: [-0.1, 1.08, 0.12] },
    { p: 0.27, position: [4.4, 4.4, 10.0], target: [-0.12, 1.07, 0.25] },
    { p: 0.36, position: [5.8, 4.4, 9.3], target: [0.3, 1.14, 0.15] },
    { p: 0.46, position: [1.8, 3.8, 10.9], target: [0, 1.1, 0.2] },
    { p: 0.55, position: [4.0, 5.8, 10.0], target: [0, 1.12, 0.25] },
    { p: 0.65, position: [3.1, 4.4, 10.1], target: [0.05, 1.14, 0.3] },
    { p: 0.76, position: [4.2, 4.6, 10.8], target: [0, 1.18, 0.16] },
    { p: 0.855, position: [5.6, 5.4, 11.2], target: [0, 1.1, 0.3] },
    { p: 0.93, position: [6.0, 6.4, 12.5], target: [0, 1.05, 0.42] },
    { p: 1, position: [5.8, 6.9, 13.4], target: [0, 1.08, 0.4] },
  ];
  function poseSeated(actor, amount) {
    actor.legs.forEach(({ hip, knee }) => {
      hip.rotation.x = -Math.PI / 2 * amount;
      knee.rotation.x = Math.PI / 2 * amount;
    });
  }
  function express(actor, { worry = 0, warmth = 0, aperture = 0, gazeX = 0, gazeY = 0, blink = 0 }) {
    const { eyes, brows, mouth, mouthOpening } = actor.face;
    const total = Math.max(1, worry + warmth);
    mouth.morphTargetInfluences[0] = worry / total;
    mouth.morphTargetInfluences[1] = warmth / total;
    mouth.position.y = aperture * 0.006;
    mouth.scale.x = 1 - aperture * 0.12;
    mouthOpening.visible = aperture > 0.015;
    mouthOpening.scale.set(0.8 + warmth * 0.2 + aperture * 0.15, 0.035 + aperture * 0.72, 0.18);
    mouthOpening.position.y = 0.11 - aperture * 0.007;
    eyes.forEach(({opening, pupil, lid}) => {
      opening.scale.y = 1 - blink * 0.97;
      pupil.position.set(gazeX, gazeY, 0);
      lid.visible = blink > 0.85;
    });
    brows.forEach((brow, i) => {
      const side = i === 0 ? -1 : 1;
      brow.position.y = 0.291 + worry * 0.014 + aperture * 0.008;
      brow.rotation.z = Math.PI / 2 - side * (0.1 + worry * 0.3 - warmth * 0.08);
    });
  }
  function update(progress = 0, time = 0, pointer = { x: 0, y: 0 }) {
    if (disposed) return;
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const t = Number.isFinite(time) ? time : 0;
    const shot = sampleCameraShot(p, t + p * 6);
    // All staging is a function of scroll, so scrubbing backwards restores the film.
    // Quiet mode still visits every chapter; only continuous movement is stopped.
    const walking = smooth(0.025, 0.19, p);
    const sitDown = smooth(0.195, 0.26, p);
    const gettingUp = smooth(0.815, 0.885, p);
    const sitting = sitDown * (1 - gettingUp);
    const welcome = smooth(0.25, 0.275, p) * (1 - smooth(0.315, 0.34, p));
    const introduction = smooth(0.31, 0.335, p) * (1 - smooth(0.405, 0.43, p));
    const talking = smooth(0.395, 0.42, p) * (1 - smooth(0.52, 0.555, p));
    const calm = smooth(0.5, 0.595, p);
    const breathing = smooth(0.51, 0.54, p) * (1 - smooth(0.605, 0.635, p));
    const format = smooth(0.6, 0.635, p) * (1 - smooth(0.705, 0.735, p));
    const terms = smooth(0.705, 0.735, p) * (1 - smooth(0.805, 0.83, p));
    const reassuring = smooth(0.805, 0.825, p) * (1 - smooth(0.905, 0.93, p));
    const gardenReveal = smooth(0.84, 0.962, p);
    const leaving = smooth(0.885, 0.976, p);
    const therapistUp = smooth(0.917, 0.966, p);
    const waving = smooth(0.966, 0.991, p);
    const exchange = sampleConversation(t + p * 6);
    const heard = sampleConversation(t + p * 6 - 0.24);
    const clientSpeaking = talking * exchange.clientSpeech;
    const therapistSpeaking = talking * exchange.therapistSpeech;
    const attentive = talking * (1 - exchange.therapistSpeech * 0.65);
    const clientEmphasis = talking * exchange.emphasis;
    const clientHesitation = talking * exchange.hesitation;
    const listeningNod = talking * exchange.nod;
    const clientReply = talking * exchange.acknowledge;
    const entryStrength = smooth(0.026, 0.052, p) * (1 - smooth(0.17, 0.195, p));
    const exitStrength = smooth(0.886, 0.904, p) * (1 - smooth(0.96, 0.98, p));
    const walkStrength = reducedMotion ? 0 : entryStrength + exitStrength;
    const step = (walking * 12 + leaving * 8) * Math.PI;
    // A curved route passes the armrest, then a second route leads onto the garden path.
    const approachX = clientSeat.x + Math.sin(clientSeat.yaw) * 0.78;
    const approachZ = clientSeat.z + Math.cos(clientSeat.yaw) * 0.78;
    const before = 1 - walking;
    const routeX = before * before * -2.43 + 2 * before * walking * -2.55 + walking * walking * approachX;
    const routeZ = before * before * -0.56 + 2 * before * walking * 2.05 + walking * walking * approachZ;
    const direction = Math.atan2(before * (-2.55 + 2.43) + walking * (approachX + 2.55), before * (2.05 + 0.56) + walking * (approachZ - 2.05));
    const exitX = mix(approachX, -0.41, leaving) + Math.sin(leaving * Math.PI) * 0.13;
    const exitZ = mix(approachZ, 2.45, leaving);
    const chairX = mix(routeX, clientSeat.x, sitDown);
    const chairZ = mix(routeZ, clientSeat.z + 0.045, sitDown);
    client.rig.position.set(mix(chairX, exitX, gettingUp), mix(1.04, 0.68, sitting) + Math.abs(Math.sin(step)) * 0.044 * walkStrength, mix(chairZ, exitZ, gettingUp));
    const seatedYaw = clientSeat.yaw + 0.13;
    const exitYaw = mix(0.26, 0.76, waving);
    client.rig.rotation.y = mix(mix(direction, seatedYaw, smooth(0.16, 0.215, p)), exitYaw, smooth(0.871, 0.905, p));
    client.torso.rotation.x = Math.sin(sitting * Math.PI) * 0.19 + clientSpeaking * 0.045 + clientEmphasis * 0.028 + clientHesitation * 0.035 + gettingUp * (1 - gettingUp) * 0.38;
    client.torso.rotation.y = talking * (exchange.rightHand * 0.035 - exchange.leftHand * 0.025);
    client.torso.rotation.z = Math.sin(t * 0.85) * 0.008 * (1 - walkStrength) + talking * (exchange.leftHand - exchange.rightHand) * 0.022;
    client.torso.scale.y = 1 + Math.sin(t * 1.4) * (0.008 + breathing * 0.016);
    poseSeated(client, sitting);
    client.legs.forEach(({ hip, knee }, i) => {
      const phase = step + i * Math.PI;
      hip.rotation.x += Math.sin(phase) * 0.5 * walkStrength;
      knee.rotation.x += Math.max(0, -Math.sin(phase)) * 0.62 * walkStrength;
    });
    plantFeet(client);
    client.arms.forEach(({ shoulder, elbow, wrist }, i) => {
      const side = i === 0 ? -1 : 1;
      const phase = step + (i + 1) * Math.PI;
      const gesture = talking * (i === 1 ? exchange.rightHand : exchange.leftHand);
      const accent = clientEmphasis * (i === 1 ? 0.7 : 0.35);
      shoulder.rotation.x = Math.sin(phase) * 0.34 * walkStrength - sitting * 0.34 - gesture * 0.52 - accent * 0.12 - reassuring * 0.1;
      shoulder.rotation.y = -side * gesture * 0.12;
      shoulder.rotation.z = side * (0.09 + gesture * 0.31 + accent * 0.075 + welcome * 0.08);
      // The forearm follows the upper arm; the wrist settles last.
      elbow.rotation.x = -sitting * 0.96 - gesture * 0.17 - accent * 0.13 + gesture * Math.sin(t * 1.35 - 0.35 + i) * 0.055;
      elbow.rotation.y = side * gesture * 0.14;
      elbow.rotation.z = -side * clientHesitation * 0.1 + side * gesture * 0.045;
      wrist.rotation.set(-gesture * 0.13, side * (gesture * 0.85 + clientHesitation * 0.12), side * (gesture * 0.15 + Math.sin(t * 1.35 - 0.65 + i) * gesture * 0.035));
      if (i === 1) {
        shoulder.rotation.z = mix(shoulder.rotation.z, 2.3 + Math.sin(t * 2.7) * 0.16, waving);
        shoulder.rotation.x = mix(shoulder.rotation.x, -0.15, waving);
        elbow.rotation.x = mix(elbow.rotation.x, -0.55, waving);
        elbow.rotation.z = mix(elbow.rotation.z, 0.22 + Math.sin(t * 3.4) * 0.19, waving);
        wrist.rotation.z = mix(wrist.rotation.z, Math.sin(t * 3.4 - 0.3) * 0.16, waving);
      }
    });

    // Rise through the open front of the rotated chair, not through its armrest.
    therapist.rig.position.set(therapistSeat.x + Math.sin(therapistSeat.yaw) * therapistUp * 0.78, mix(0.68, 1.04, therapistUp), therapistSeat.z + 0.045 + Math.cos(therapistSeat.yaw) * therapistUp * 0.78);
    therapist.rig.rotation.y = mix(therapistSeat.yaw - 0.16, -0.38, therapistUp);
    poseSeated(therapist, 1 - therapistUp);
    plantFeet(therapist);
    therapist.torso.rotation.x = -0.018 + Math.sin(t * 1.3 + 0.7) * 0.006 + attentive * 0.06 + listeningNod * 0.016 + therapistUp * (1 - therapistUp) * 0.4;
    therapist.torso.rotation.y = -attentive * 0.035;
    therapist.torso.rotation.z = attentive * -0.012;
    therapist.torso.scale.y = 1 + Math.sin(t * 1.25 + 0.4) * 0.007;
    therapist.arms.forEach(({ shoulder, elbow, wrist }, i) => {
      const side = i === 0 ? -1 : 1;
      const answer = talking * exchange.replyHand * (i === 0 ? 1 : 0.12);
      const gesture = i === 0 ? welcome * 0.75 + format * 0.7 + reassuring * 0.65 : introduction * 0.7 + terms * 0.55;
      shoulder.rotation.x = -0.36 * (1 - therapistUp) - gesture * 0.27 - answer * 0.46;
      shoulder.rotation.y = -side * answer * 0.1;
      shoulder.rotation.z = side * (0.1 + gesture * 0.22 + answer * 0.24);
      elbow.rotation.x = -0.98 * (1 - therapistUp) - gesture * 0.12 - answer * 0.18;
      elbow.rotation.y = side * answer * 0.12;
      elbow.rotation.z = side * (0.06 + gesture * 0.11 + answer * 0.045);
      wrist.rotation.set(-answer * 0.11, side * (gesture * 0.55 + answer * 0.85), side * (gesture * 0.1 + answer * 0.13));
      if (i === 0) {
        shoulder.rotation.z = mix(shoulder.rotation.z, -2.18 + Math.sin(t * 2.3 + 0.7) * 0.12, waving);
        shoulder.rotation.x = mix(shoulder.rotation.x, -0.12, waving);
        elbow.rotation.x = mix(elbow.rotation.x, -0.48, waving);
        elbow.rotation.z = mix(elbow.rotation.z, -0.25 + Math.sin(t * 3.1) * 0.15, waving);
        wrist.rotation.z = mix(wrist.rotation.z, Math.sin(t * 3.1 + 0.4) * 0.14, waving);
      }
    });
    // Eyes and heads share an attention target, with a brief look down between phrases.
    const downcast = (1 - calm) * (0.12 + welcome * 0.3) + clientHesitation * 0.6;
    const clientAim = THREE.MathUtils.clamp(Math.atan2(therapist.rig.position.x - client.rig.position.x, therapist.rig.position.z - client.rig.position.z) - client.rig.rotation.y, -0.62, 0.62);
    const therapistAim = THREE.MathUtils.clamp(Math.atan2(client.rig.position.x - therapist.rig.position.x, client.rig.position.z - therapist.rig.position.z) - therapist.rig.rotation.y, -0.55, 0.55);
    const clientAttention = sitting * (1 - downcast * 0.65) * (1 - format * 0.4);
    const therapistAttention = (1 - therapistUp) * (0.65 + talking * 0.35) * (1 - format * 0.7);
    client.head.rotation.set(downcast * 0.13 - clientSpeaking * 0.025 + clientReply * 0.11 + calm * 0.025, clientAim * clientAttention - waving * 0.16, -(1 - calm) * 0.035 + talking * (exchange.leftHand - exchange.rightHand) * 0.032);
    therapist.head.rotation.set(listeningNod * 0.13 + heard.emphasis * attentive * 0.025 + introduction * 0.025, therapistAim * therapistAttention + format * 0.08, 0.025 + attentive * 0.04 + therapistSpeaking * -0.025);
    const clientWarmth = calm * 0.8 + clientReply * 0.32;
    const therapistWarmth = 0.25 + welcome * 0.3 + talking * exchange.warmth * 0.38 + calm * 0.22;
    express(client, { worry: (1 - calm) * (0.34 + clientHesitation * 0.3 + clientEmphasis * 0.2), warmth: clientWarmth, aperture: clientSpeaking * exchange.syllable * 0.85, gazeX: clientAim * clientAttention * 0.016, gazeY: -downcast * 0.01, blink: blinkAt(t, 0) });
    const guideSpeaking = Math.min(1, therapistSpeaking + introduction * 0.75 + format * 0.55 + terms * 0.5);
    express(therapist, { worry: attentive * heard.emphasis * 0.15, warmth: therapistWarmth, aperture: guideSpeaking * exchange.syllable * 0.65, gazeX: therapistAim * therapistAttention * 0.016, gazeY: listeningNod * -0.004, blink: blinkAt(t, 1.07) });
    // Reading the notebook is a separate beat; it settles away before standing.
    const notebookShow = 1 - smooth(0.895, 0.935, p);
    notebook.scale.setScalar(Math.max(0.001, notebookShow));
    notebook.visible = notebookShow > 0.001;
    notebook.rotation.x = -0.15 - introduction * 0.3;
    notebook.position.y = 0.075 + introduction * 0.055;
    pencil.rotation.z = 1.23 + introduction * Math.sin(t * 2.1) * 0.07;

    const unravel = smooth(0.435, 0.605, p);
    const thoughtShow = 1 - smooth(0.69, 0.765, p);
    const worryShow = 1 - unravel * 0.08;
    const thoughtOpacity = thoughtShow * (1 - shot.strength);
    thoughts.visible = thoughtOpacity > 0.001;
    thoughts.position.copy(client.rig.position);
    thoughts.position.y += 1.76 + Math.sin(t * 0.8) * 0.012;
    thoughts.scale.setScalar(1 + breathing * Math.sin(t * 1.25) * 0.025);
    // Small in-place breathing replaces the old flight into the middle of the room.
    knot.rotation.z = Math.sin(t * 0.65) * 0.035 * (1 - unravel);
    thoughtStrands.forEach(({strand, from, to}, i) => {
      strand.morphTargetInfluences[0] = smooth(i * 0.09, 0.82 + i * 0.09, unravel);
      strand.material.color.copy(from).lerp(to, unravel);
      strand.material.opacity = thoughtOpacity;
      strand.material.depthWrite = thoughtOpacity > 0.999;
    });
    cloudMaterial.opacity = worryShow * thoughtOpacity;
    worries.visible = thoughtShow > 0.001;
    // Keep an ivory silhouette behind the sprig: room plants must not merge with it.
    const leafGrowth = smooth(0.58, 1, unravel);
    leafMaterial.opacity = leafGrowth * thoughtOpacity;
    peace.visible = leafGrowth > 0.001;
    peacefulLeaves.forEach(({leaf, angle}, i) => {
      const growth = smooth(i * 0.035, 0.72 + i * 0.035, leafGrowth);
      leaf.scale.set(0.53 * growth, growth, 0.24 * growth);
      leaf.rotation.z = angle + Math.sin(t * 0.8 + i * 0.7) * 0.055 * leafGrowth;
    });
    thoughtDots.forEach((dot, i) => dot.scale.setScalar(1 - smooth(0.12 + i * 0.1, 0.65, unravel) * 0.25));

    laptop.visible = format > 0.001;
    laptop.scale.setScalar(Math.max(0.001, format * 0.82));
    laptop.position.y = 0.6225 + (1 - format) * 0.12;
    laptopScreen.rotation.x = -0.14 + (1 - format) * Math.PI * 0.48;
    onlinePortrait.rotation.z = Math.sin(t * 0.9) * 0.04;
    connectionDot.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    sessionClock.visible = terms > 0.001;
    sessionClock.scale.setScalar(Math.max(0.001, terms));
    sessionClock.rotation.y = 0.18;
    sessionClock.position.y = 1.85 + Math.sin(t * 0.75) * 0.025;
    minuteHand.rotation.z = -(p - 0.705) * 48 - (reducedMotion ? 0 : t * 0.025);
    hourHand.rotation.z = -0.92 - (p - 0.705) * 4;

    // The same set opens into a garden: no canvas hand-off or dead final frame.
    const wallsAway = smooth(0.84, 0.91, p);
    const gardenDetails = smooth(0.91, 0.975, p);
    architecture.position.y = -3.1 * wallsAway;
    architecture.visible = wallsAway < 0.999;
    floor.scale.set(1 + gardenReveal * 0.19, 1, 1 + gardenReveal * 0.4);
    floorSurface.material.color.copy(floorRoomColor).lerp(floorGardenColor, gardenReveal);
    plankMat.opacity = 0.26 * (1 - gardenReveal);
    garden.visible = gardenDetails > 0.001;
    // Preserve every prop's horizontal anchor as it grows out of the ground.
    garden.scale.set(1, Math.max(0.001, gardenDetails), 1);
    gardenPlants.forEach((group, i) => { group.rotation.z = Math.sin(t * 0.8 + i) * 0.016 * gardenReveal; });
    archLeaves.forEach((leaf, i) => { leaf.rotation.y = Math.sin(t * 0.85 + i * 0.7) * 0.15; });
    sun.intensity = 2.7 + calm * 0.2 + gardenReveal * 0.18;
    lampLight.intensity = 0.5 + calm * 0.55 - gardenReveal * 0.65;
    let left = keyframes[0], right = keyframes[1];
    for (let i = 0; i < keyframes.length - 1; i++) if (p >= keyframes[i].p) { left = keyframes[i]; right = keyframes[i + 1]; }
    const u = smooth(left.p, right.p, p);
    cameraTarget.set(...left.position).lerp(nextCamera.set(...right.position), u);
    lookAt.set(...left.target).lerp(nextCamera.set(...right.target), u);
    if (reducedMotion) {
      // Keep the chapter composition while greatly reducing camera travel.
      cameraTarget.lerp(nextCamera.set(6.4, 5.6 + gardenReveal, 11.1 + gardenReveal * 1.8), 0.78);
      lookAt.lerp(nextCamera.set(0, 1.08, 0.18 + gardenReveal * 0.18), 0.78);
    }
    if (!reducedMotion) {
      cameraTarget.x += (pointer.x || 0) * 0.24;
      cameraTarget.y += (pointer.y || 0) * 0.12;
    }
    // Fit the whole set to the actual canvas frustum, including courtyard corners.
    // Aspect-ratio heuristics clipped the furniture on tall and narrow canvases.
    viewDirection.copy(cameraTarget).sub(lookAt).normalize();
    viewRight.crossVectors(upAxis, viewDirection).normalize();
    viewUp.crossVectors(viewDirection, viewRight).normalize();
    const verticalTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.91;
    const horizontalTan = verticalTan * camera.aspect;
    let requiredDistance = cameraTarget.distanceTo(lookAt);
    const extentX = mix(3.3, 3.98, gardenReveal);
    const minZ = mix(-2.45, -3.3, gardenReveal);
    const maxZ = mix(2.45, 3.4, gardenReveal);
    for (const x of [-extentX, extentX]) for (const y of [-0.27, 3.12 + worryShow * 0.26]) for (const z of [minZ, maxZ]) {
      framingPoint.set(x, y, z).sub(lookAt);
      const depth = framingPoint.dot(viewDirection);
      requiredDistance = Math.max(requiredDistance, depth + Math.abs(framingPoint.dot(viewRight)) / horizontalTan, depth + Math.abs(framingPoint.dot(viewUp)) / verticalTan);
    }
    cameraTarget.copy(lookAt).addScaledVector(viewDirection, requiredDistance);
    if (shot.strength > 0) {
      // Portraits stay on the open/front side of the room (the same 180° axis).
      // A shallow pullback on each pan opens a two-shot instead of crossing empty space.
      const focus = shot.therapist;
      const travel = shot.transition;
      const anchorX = mix(client.rig.position.x, therapist.rig.position.x, focus);
      const anchorY = mix(client.rig.position.y, therapist.rig.position.y, focus);
      const anchorZ = mix(client.rig.position.z, therapist.rig.position.z, focus);
      portraitTarget.set(anchorX, anchorY + 0.76, anchorZ + 0.08);
      viewDirection.set(mix(0.62, -0.62, focus), 0.15, 0.78).normalize();
      viewRight.crossVectors(upAxis, viewDirection).normalize();
      viewUp.crossVectors(viewDirection, viewRight).normalize();
      // Frame the face, chest and full gesture envelope, rather than the entire set.
      // Fixed bounds prevent the lens from pumping in and out with every hand movement.
      const halfWidth = 0.68 + travel;
      const portraitTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.87;
      let portraitDistance = 3.1 + travel * 2.1;
      for (const x of [anchorX - halfWidth, anchorX + halfWidth]) for (const y of [anchorY + 0.02, anchorY + 1.22]) for (const z of [anchorZ - 0.42, anchorZ + 0.76]) {
        framingPoint.set(x, y, z).sub(portraitTarget);
        const depth = framingPoint.dot(viewDirection);
        portraitDistance = Math.max(portraitDistance, depth + Math.abs(framingPoint.dot(viewRight)) / (portraitTan * camera.aspect), depth + Math.abs(framingPoint.dot(viewUp)) / portraitTan);
      }
      portraitPosition.copy(portraitTarget).addScaledVector(viewDirection, portraitDistance);
      cameraTarget.lerp(portraitPosition, shot.strength);
      lookAt.lerp(portraitTarget, shot.strength);
    }
    camera.position.copy(cameraTarget);
    camera.lookAt(lookAt);
    // Keep the drawing readable during camera turns; it never orbits through itself.
    thoughts.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
  }
  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function dispose() {
    disposed = true;
    const geometries = new Set();
    const mats = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => mats.add(m));
    });
    geometries.forEach(g => g.dispose());
    mats.forEach(m => m.dispose());
    shadowTexture.dispose();
    renderer.dispose();
  }
  resize(canvas.clientWidth || 720, canvas.clientHeight || 640);
  update(0, 0);
  onReady?.();
  return { update, resize, dispose, setReducedMotion(value) { reducedMotion = !!value; } };
}
