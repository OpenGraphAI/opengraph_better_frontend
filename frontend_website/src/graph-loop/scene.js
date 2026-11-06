import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShadowMaterial,
  VSMShadowMap,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { createAgentOrb } from "./agent-orb.js";
import { PALETTE, createGraph, haloSprite } from "./graph.js";
import { LIT_FILES, T, layoutFor } from "./layout.js";
import { LOOP, TAU, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, hump, seg, wave } from "./motion.js";
import { buildSource } from "./sources.js";

const FOV = 22;
const HALF_TAN = Math.tan((FOV / 2) * (Math.PI / 180));
// The world-space box the camera keeps in frame, centred on the mirror line.
const FRAME = {
  wide: { halfWidth: 7.4, halfHeight: 3.35, centreY: 0 },
  portrait: { halfWidth: 4.1, halfHeight: 5.05, centreY: -0.3 },
};
const CAMERA_LIFT = 0.16; // camera height per unit of distance: a slight look down at the files
const REFERENCE_WIDTH = 1400;
const AGENT_SCALE = 1.25;
const AGENT_DROP = 1.8;
const FILE_LIFT = 0.3;

function createMaterials() {
  return {
    ceramic: new MeshStandardMaterial({ color: 0xefebe3, roughness: 0.88, metalness: 0 }),
    inset: new MeshStandardMaterial({ color: 0xe3ded4, roughness: 0.92, metalness: 0 }),
    ink: new MeshBasicMaterial({ color: PALETTE.ink }),
    inkSoft: new MeshBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.5 }),
    cobalt: new MeshBasicMaterial({ color: PALETTE.cobalt, toneMapped: false }),
    edge: new LineMaterial({ color: PALETTE.ink, linewidth: 1.1 }),
  };
}

/** Mirror partners share their idle phase, so the row always moves symmetrically. */
const idlePhase = (x) => Math.abs(x) * 0.9;

function createFiles(scene, mats, layout) {
  return layout.files.map((file) => {
    // Each file gets its own outline so a lit file can turn blue on its own.
    const edge = mats.edge.clone();
    const object = buildSource(file.kind, { ...mats, edge });
    scene.add(object);
    const home = new Vector3(...file.pos);
    object.position.copy(home);
    const halfHeight = new Box3().setFromObject(object).getSize(new Vector3()).y / 2;
    const lit = LIT_FILES.includes(file.kind);
    const glow = lit ? haloSprite(0) : null;
    if (glow) scene.add(glow);
    return { ...file, object, edge, home, halfHeight, lit, glow, phase: idlePhase(home.x) };
  });
}

const BEHIND = new Vector3(0, 0, -0.15);

function updateFiles(files, t, lineScale) {
  const lift = easeOutBack(seg(t, ...T.fileLift), 1.3) * (1 - easeInOutCubic(seg(t, ...T.unlight)));
  const anchors = {};
  for (const f of files) {
    const { object } = f;
    const raised = f.lit ? lift : 0;
    object.position.copy(f.home);
    object.position.y += 0.045 * wave(t, 2, f.phase) + FILE_LIFT * raised;
    object.rotation.set(-0.12 + 0.025 * wave(t, 1, f.phase), -f.home.x * 0.025, 0);
    f.edge.color.copy(PALETTE.ink).lerp(PALETTE.cobalt, Math.min(1, raised));
    f.edge.linewidth = (1.1 + 1.3 * raised) * lineScale;
    if (f.glow) {
      f.glow.visible = raised > 0.002;
      f.glow.position.copy(object.position).add(BEHIND);
      f.glow.scale.setScalar(2.7 * (0.85 + 0.15 * raised));
      f.glow.material.opacity = 0.3 * Math.min(1, raised);
    }
    for (const [j, bar] of (object.userData.bars ?? []).entries()) {
      bar.scale.y = bar.userData.base * (0.78 + 0.22 * wave(t, 6, Math.abs(j - 7) * 0.9));
    }
    anchors[f.node] = object.position.clone().setY(object.position.y + f.halfHeight - 0.02);
  }
  return anchors;
}

function createAgent(scene, layout) {
  const agent = createAgentOrb(scene);
  const halo = haloSprite(0);
  scene.add(halo);
  return { ...agent, halo, home: new Vector3(...layout.agent) };
}

function updateAgent(agent, t, camera) {
  const enter = seg(t, ...T.agentEnter);
  const exit = seg(t, ...T.agentExit);
  const { group, halo } = agent;
  group.visible = enter > 0 && exit < 1;
  halo.visible = group.visible;
  if (!group.visible) {
    agent.update(t, camera);
    return;
  }
  group.position.copy(agent.home);
  group.position.y += AGENT_DROP * (1 - easeOutCubic(enter)) + AGENT_DROP * easeInCubic(exit);
  group.position.y += 0.04 * wave(t, 3, 0.5);
  // It swells as the answer arrives, then settles.
  const receive = hump(seg(t, ...T.receive));
  const grow = easeOutBack(seg(t, T.agentEnter[0], T.agentEnter[1] - 0.15));
  const scale = AGENT_SCALE * grow * (1 - easeInCubic(exit)) * (1 + 0.16 * receive);
  group.scale.setScalar(Math.max(scale, 1e-4));
  halo.position.copy(group.position).add(BEHIND);
  halo.scale.setScalar(1.4 + 1.6 * receive);
  halo.material.opacity = 0.42 * receive;
  agent.update(t, camera);
}

function createStage(scene, groundY) {
  scene.add(new HemisphereLight(0xfffaf1, 0xd9d2c4, 0.85));
  // Key light straight above and in front, so shadows fall symmetrically.
  const key = new DirectionalLight(0xffffff, 1.7);
  key.position.set(0, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8, near: 1, far: 30 });
  key.shadow.radius = 18;
  key.shadow.blurSamples = 24;
  key.shadow.bias = -0.0008;
  scene.add(key);
  const fill = new DirectionalLight(0xfff8ee, 0.75);
  fill.position.set(0, 2.5, 12);
  scene.add(fill);
  const ground = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ color: 0x3c3428, opacity: 0.07 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = groundY;
  ground.receiveShadow = true;
  scene.add(ground);
}

/** Fixed, front-on and centred; a slow symmetric push-in peaks mid-loop. */
function placeCamera(camera, t, baseDistance, centreY) {
  const distance = baseDistance * (1 - 0.045 * (1 - Math.cos((TAU * t) / LOOP)) * 0.5);
  camera.position.set(0, centreY + distance * CAMERA_LIFT, distance);
  camera.lookAt(0, centreY, 0);
  camera.updateMatrixWorld();
}

/**
 * Builds the loop into `canvas`. `renderAt(t)` is pure in t (seconds, any
 * value; wrapped to [0, LOOP)), so a live player and a frame exporter
 * produce identical frames. `portrait` selects the phone composition.
 */
export function createGraphLoop(canvas, { preserveDrawingBuffer = false, portrait = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const layout = layoutFor(portrait);
  const frame = portrait ? FRAME.portrait : FRAME.wide;
  const camera = new PerspectiveCamera(FOV, 21 / 9, 0.1, 120);
  createStage(scene, layout.ground);
  const files = createFiles(scene, createMaterials(), layout);
  const agent = createAgent(scene, layout);
  const graph = createGraph(scene, layout);

  let baseDistance = 17;
  let lineScale = 1;

  function resize(width, height, pixelRatio = 1) {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    baseDistance = Math.max(frame.halfHeight / HALF_TAN, frame.halfWidth / (camera.aspect * HALF_TAN));
    // Lines keep the same weight relative to the nodes at any output size.
    const referenceWidth = REFERENCE_WIDTH * (frame.halfWidth / FRAME.wide.halfWidth);
    lineScale = Math.min(2.2, Math.max(0.75, width / referenceWidth));
    for (const material of [...files.map((f) => f.edge), ...graph.lines.map((l) => l.material)]) {
      material.resolution.set(width, height);
    }
  }

  function renderAt(time) {
    const t = ((time % LOOP) + LOOP) % LOOP;
    placeCamera(camera, t, baseDistance, frame.centreY);
    const anchors = updateFiles(files, t, lineScale);
    updateAgent(agent, t, camera);
    graph.update(t, camera, { position: agent.group.position, visible: agent.group.visible }, anchors, lineScale);
    renderer.render(scene, camera);
  }

  return { renderAt, resize };
}
