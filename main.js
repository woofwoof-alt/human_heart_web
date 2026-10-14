import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// mindar-image phải nạp TRƯỚC: nó gán lại window.MINDAR.IMAGE,
// nạp sau sẽ xóa MindARThree khỏi biến toàn cục
import { Compiler } from 'mindar-image';
import { MindARThree } from 'mindar-image-three';
import { HEART_MESH_MATRIX, HEART_CENTER, HEART_BOTTOM, HOTSPOTS }
  from './heart-data.js';

// Bản web của project Unity (Assets/Scripts). Mỗi phần ghi tên script C# tương ứng
// và dùng cùng thông số với SampleScene.unity.

const MODEL_URL = 'assets/Models/heart.glb';
const MARKER_URL = 'assets/Markers/heart_marker2.jpg';
const CACHE_KEY = 'heart_marker2-v1';   // đổi tên khi thay ảnh marker

// Đơn vị: 1 = chiều rộng ảnh marker (19.6 cm khi in A4)
const MARKER_WIDTH_M = 0.196;
const M = (meters) => meters / MARKER_WIDTH_M;   // mét → đơn vị marker

// HeartEmerge
const EMERGE_SECONDS = 4;
const SINK_DEPTH = M(0.12);   // lúc đầu tim nằm sâu 12 cm dưới giấy
const START_SCALE = 0.3;
const REPLAY_AFTER_LOST = 2;  // giây

// HeartTracker: độ nhanh bám theo marker (1/giây). Lớn: bám sát nhưng rung
const TRACK_SMOOTHING = 12;

// HeartInteraction
const DEG_PER_SCREEN = 270;   // kéo hết chiều rộng khung = xoay 270°
const MIN_ZOOM = 0.5, MAX_ZOOM = 3;
const DRAG_THRESHOLD = 20;    // px: đi quá mức này mới tính là kéo
const SCROLL_ZOOM_STEP = 0.1; // mỗi nấc cuộn chuột phóng to/thu nhỏ 10%

// GazeLabel
const TAP_MAX_MS = 350, TAP_MAX_MOVE = 20;   // nhấn-thả nhanh, lệch ≤ 20 px là "chạm"
const DWELL_SECONDS = 1.5;                   // đeo kính: nhìn 1.5 giây thì chọn

// HeartSceneSetup / HeartPart
const DOT_RADIUS = M(0.006);      // chấm màu đường kính 1.2 cm
const HIT_RADIUS = M(0.015);      // vùng chọn bán kính 1.5 cm
const SELECTED_SCALE = 1.6;
const LABEL_FONT = M(0.014);      // chữ nhãn cao khoảng 1.4 cm
const LABEL_OFFSET = M(0.025);    // nhãn cách điểm 2.5 cm

// HeadsetView (kính VR kiểu Cardboard)
const VR_RESOLUTION_SCALE = 0.6;
const VR_FPS = 30;
const IPD = M(0.064);             // khoảng cách hai mắt
const LENS_K1 = 0.22, LENS_K2 = 0.24;

// Độ mượt khi bám marker (bộ lọc One Euro của MindAR).
// Rung nhiều: giảm FILTER_MIN_CF; trễ nhiều: tăng FILTER_BETA.
const FILTER_MIN_CF = 0.0005;
const FILTER_BETA = 300;
const MISS_TOLERANCE = 10;   // số khung hình liên tiếp không thấy marker = mất dấu

const container = document.getElementById('ar');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const vrBtn = document.getElementById('vr');
const vrExitBtn = document.getElementById('vr-exit');
const reticles = document.querySelectorAll('.reticle');
const errorEl = document.getElementById('error');

const setStatus = (text) => { statusEl.textContent = text; };

function showError(text) {
  errorEl.textContent = text;
  errorEl.hidden = false;
  setStatus('Có lỗi, xem thông báo trên màn hình.');
}

main();

async function main() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showError('Trình duyệt chỉ cho dùng webcam khi mở trang qua http://localhost ' +
      'hoặc https. Hãy chạy start.bat rồi mở http://localhost:8000/ ' +
      '(không mở trực tiếp file index.html).');
    return;
  }

  let targets, gltf;
  try {
    setStatus('Đang chuẩn bị marker...');
    targets = await loadTargets((p) =>
      setStatus(`Đang chuẩn bị marker (chỉ làm lần đầu)... ${Math.round(p)}%`));
    setStatus('Đang tải mô hình tim...');
    gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  } catch (e) {
    console.error(e);
    showError('Không tải được mô hình hoặc ảnh marker. Hãy chạy qua web server ' +
      '(dùng start.bat) và kiểm tra thư mục web/assets/.');
    return;
  }

  const mindar = new MindARThree({
    container,
    imageTargetSrc: URL.createObjectURL(new Blob([targets])),
    maxTrack: 1,
    uiError: 'no',
    filterMinCF: FILTER_MIN_CF,
    filterBeta: FILTER_BETA,
    missTolerance: MISS_TOLERANCE,
  });
  const app = buildScene(mindar, gltf);
  addHotspots(app);
  const headset = setupHeadset(app);
  setupTap(app, headset);
  setupGestures(app, headset);
  // Mở trang với ?debug để xem trạng thái trong DevTools (window.heartApp)
  if (new URLSearchParams(location.search).has('debug')) {
    window.heartApp = { app, mindar, headset, THREE };
  }

  try {
    setStatus('Đang mở webcam... (bấm Cho phép nếu trình duyệt hỏi)');
    await mindar.start();
  } catch (e) {
    console.error(e);
    showError('Không mở được webcam. Hãy cho phép trang dùng camera (biểu tượng ' +
      'camera trên thanh địa chỉ) và đóng các ứng dụng khác đang dùng webcam ' +
      '(Zoom, Teams, Camera...), rồi tải lại trang.');
    return;
  }
  setStatus('Đưa tờ giấy in marker vào trước webcam.');
  vrBtn.disabled = false;

  const clock = new THREE.Clock();
  mindar.renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    app.update(dt);
    if (headset.active) headset.frame(dt);
    else mindar.renderer.render(mindar.scene, mindar.camera);
  });
}

// ---------- Marker: file .mind của MindAR ----------

async function loadTargets(onProgress) {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return cached;

  const img = new Image();
  img.src = MARKER_URL;
  await img.decode();
  const compiler = new Compiler();
  await compiler.compileImageTargets([img], onProgress);
  const data = compiler.exportData();
  await cacheSet(CACHE_KEY, data);
  return data;
}

function openCache() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('heart-ar', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('targets');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cacheGet(key) {
  try {
    const db = await openCache();
    return await new Promise((resolve, reject) => {
      const req = db.transaction('targets').objectStore('targets').get(key);
      req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;   // trình duyệt chặn lưu trữ (ẩn danh...): chuyển lại mỗi lần
  }
}

async function cacheSet(key, data) {
  try {
    const db = await openCache();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('targets', 'readwrite');
      tx.objectStore('targets').put(data.slice().buffer, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* không lưu được thì thôi */ }
}

// ---------- Cảnh 3D: HeartTracker + HeartEmerge ----------

function buildScene(mindar, gltf) {
  const { scene } = mindar;

  // Ánh sáng: một đèn bầu trời dịu + một đèn chiếu từ phía webcam
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(0.5, 1, 2);
  scene.add(sun);

  // MindAR đặt anchor.group đúng tư thế marker mỗi lần nhận diện.
  // root (HeartAnchor) tiến dần tới tư thế đó để tim không rung (HeartTracker).
  const anchor = mindar.addAnchor(0);
  const root = new THREE.Group();
  root.matrixAutoUpdate = false;
  root.visible = false;
  scene.add(root);
  const pose = {
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3(),
    tPos: new THREE.Vector3(), tQuat: new THREE.Quaternion(), tScale: new THREE.Vector3(),
  };

  // Occluder (DepthMask): hộp vô hình ngay dưới mặt giấy. Chỉ ghi chiều sâu,
  // không ghi màu, nên phần tim nằm dưới giấy bị che mà video webcam vẫn hiện.
  const occluder = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1),
    new THREE.MeshBasicMaterial({ colorWrite: false })
  );
  occluder.position.z = -0.5;   // mặt trên của hộp trùng mặt giấy (z = 0)
  occluder.renderOrder = -1;    // vẽ trước tim để ghi chiều sâu trước
  root.add(occluder);

  // Ba tầng lồng nhau: heartRoot (HeartModel, trồi lên) → pivot (InteractPivot,
  // xoay/zoom) → content
  const heartRoot = new THREE.Group();
  heartRoot.position.fromArray(HEART_CENTER);
  root.add(heartRoot);

  const pivot = new THREE.Group();
  heartRoot.add(pivot);

  // Dời ngược lại: bên trong content dùng thẳng toạ độ marker
  const content = new THREE.Group();
  content.position.fromArray(HEART_CENTER).negate();
  pivot.add(content);

  const heart = extractHeartMesh(gltf);
  content.add(heart);

  const dots = new THREE.Group();   // Hotspots: 12 bộ phận
  dots.visible = false;
  content.add(dots);

  const state = {
    time: 0, found: false, lostAt: -Infinity,
    t: 0, emerged: false, zoom: 1,
  };
  const HINT = 'Kéo để xoay, lăn chuột để phóng to, chạm chấm màu để xem tên.';

  anchor.onTargetFound = () => {
    state.found = true;
    // Mới thấy lại thì đặt thẳng vào chỗ, không trượt từ vị trí cũ tới
    anchor.group.matrix.decompose(pose.pos, pose.quat, pose.scale);
    root.matrix.copy(anchor.group.matrix);
    root.visible = true;
    // Mất dấu lâu hơn REPLAY_AFTER_LOST giây thì cho tim trồi lên lại từ đầu
    if (state.time - state.lostAt > REPLAY_AFTER_LOST) restartEmerge();
    setStatus(state.emerged ? HINT : 'Tim đang trồi lên...');
  };
  anchor.onTargetLost = () => {
    state.found = false;
    state.lostAt = state.time;
    root.visible = false;
    setStatus('Mất dấu marker. Đưa tờ giấy vào lại trước webcam.');
  };

  function restartEmerge() {
    state.t = 0;
    state.emerged = false;
    dots.visible = false;
    resetView();
  }

  function resetView() {
    pivot.quaternion.identity();
    state.zoom = 1;
    app.select(null);
    applyTransform();
  }

  function applyTransform() {
    // Mathf.SmoothStep: chậm lúc đầu và lúc cuối
    const t = state.t;
    const e = t * t * (3 - 2 * t);
    // Zoom quanh tâm làm đáy tim dịch theo: dời tâm để đáy luôn ở HEART_BOTTOM
    const centerZ = HEART_BOTTOM + (HEART_CENTER[2] - HEART_BOTTOM) * state.zoom;
    heartRoot.position.z = centerZ - SINK_DEPTH * (1 - e);
    heartRoot.scale.setScalar(THREE.MathUtils.lerp(START_SCALE, 1, e));
    pivot.scale.setScalar(state.zoom);
  }

  function update(dt) {
    state.time += dt;
    if (!state.found) return;

    // Làm mượt không phụ thuộc fps: hệ số 1 - e^(-k·dt)
    anchor.group.matrix.decompose(pose.tPos, pose.tQuat, pose.tScale);
    const k = 1 - Math.exp(-TRACK_SMOOTHING * dt);
    pose.pos.lerp(pose.tPos, k);
    pose.quat.slerp(pose.tQuat, k);
    pose.scale.lerp(pose.tScale, k);
    root.matrix.compose(pose.pos, pose.quat, pose.scale);

    if (!state.emerged) {
      state.t = Math.min(state.t + dt / EMERGE_SECONDS, 1);
      if (state.t === 1) {
        state.emerged = true;
        dots.visible = true;
        setStatus(HINT);
      }
    }
    applyTransform();
  }

  const app = {
    mindar, root, heart, pivot, dots, state, pose,
    // HeartInteraction chạy khi đang thấy marker, kể cả lúc tim đang trồi lên
    get found() { return state.found; },
    // Chỉ chọn được bộ phận khi tim đã ra hết (Hotspots đã bật)
    get ready() { return state.found && state.emerged; },
    update,
    resetView,
    zoomBy(f) {
      state.zoom = THREE.MathUtils.clamp(state.zoom * f, MIN_ZOOM, MAX_ZOOM);
      applyTransform();
    },
    hotspots: [],
    selected: null,
    select: () => {},   // addHotspots thay bằng hàm thật
  };
  applyTransform();
  return app;
}

// HEART_MESH_MATRIX đo trên chính lưới tim (toạ độ gốc của mesh). Trong heart.glb
// lưới nằm dưới mấy node của Sketchfab (xoay, scale 0.01, dời ~8 đơn vị), nên phải
// tách lưới ra khỏi cây node rồi mới đặt ma trận, nếu không tim lệch khỏi marker.
function extractHeartMesh(gltf) {
  let mesh = null;
  gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  mesh.removeFromParent();
  mesh.matrixAutoUpdate = false;
  mesh.matrix.fromArray(HEART_MESH_MATRIX);
  return mesh;
}

// ---------- HeartPart + nhãn chữ 3D (FaceCamera) ----------

function addHotspots(app) {
  const dotGeo = new THREE.SphereGeometry(DOT_RADIUS, 16, 12);
  const hitGeo = new THREE.SphereGeometry(HIT_RADIUS, 12, 8);
  // visible: false = không vẽ ra, nhưng tia vẫn chạm được
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  app.hotspots = HOTSPOTS.map((h) => {
    const [r, g, b] = h.color;
    const color = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

    const part = new THREE.Group();
    part.position.fromArray(h.position);
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color }));
    const hit = new THREE.Mesh(hitGeo, hitMat);
    const label = makeLabel(h.label);
    label.position.copy(labelOffset(part.position));
    label.visible = false;
    part.add(dot, hit, label);
    app.dots.add(part);

    const spot = { id: h.id, label: h.label, dot, hit, labelSprite: label };
    hit.userData.spot = spot;
    return spot;
  });

  // Bắn tia từ camera qua một điểm trên màn hình (toạ độ -1..1). Xét cả lưới tim:
  // chấm ở mặt sau bị tim che thì tia chạm tim trước, không chọn nhầm.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hits = app.hotspots.map((s) => s.hit);
  app.pickNdc = (x, y) => {
    if (!app.ready) return null;
    ndc.set(x, y);
    raycaster.setFromCamera(ndc, app.mindar.camera);
    // Thử các vùng chọn trước (rẻ); chỉ khi trúng mới xét lưới tim (đắt)
    const hit = raycaster.intersectObjects(hits, false)[0];
    if (!hit) return null;
    const wall = raycaster.intersectObject(app.heart, true)[0];
    return wall && wall.distance < hit.distance ? null : hit.object.userData.spot;
  };
  app.pick = (clientX, clientY) => {
    const rect = container.getBoundingClientRect();
    return app.pickNdc((clientX - rect.left) / rect.width * 2 - 1,
                       -(clientY - rect.top) / rect.height * 2 + 1);
  };

  function show(spot, on) {
    spot.labelSprite.visible = on;
    spot.dot.scale.setScalar(on ? SELECTED_SCALE : 1);
  }

  // HeartPart.Select: chọn bộ phận thì nhãn khác tự ẩn; chọn lại thì ẩn.
  // select(null) ẩn hết.
  app.select = (spot) => {
    if (app.selected) show(app.selected, false);
    app.selected = spot === app.selected ? null : spot;
    if (app.selected) show(app.selected, true);
  };
}

// HeartSceneSetup.CreateLabel: đẩy nhãn ra ngoài tim (theo hướng từ tâm tim tới
// điểm, song song mặt giấy) và hơi lên trên
function labelOffset(position) {
  const out = position.clone().sub(new THREE.Vector3().fromArray(HEART_CENTER));
  out.z = 0;
  if (out.lengthSq() > 1e-12) out.normalize();
  else out.set(0, -1, 0);
  out.z += 0.5;
  return out.normalize().multiplyScalar(LABEL_OFFSET);
}

// Nhãn TextMeshPro: chữ trắng đậm, căn giữa. Sprite luôn quay về phía camera
// như FaceCamera, và hiện ở cả hai mắt khi đeo kính.
function makeLabel(text) {
  const px = 64;
  const font = `bold ${px}px system-ui, "Segoe UI", Roboto, sans-serif`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const pad = px * 0.4;
  canvas.width = Math.ceil(ctx.measureText(text).width + pad * 2);
  canvas.height = Math.ceil(px * 1.5);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';   // viền tối để đọc được trên nền sáng
  ctx.shadowBlur = px * 0.15;
  ctx.fillStyle = '#fff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
  const h = LABEL_FONT * canvas.height / px;
  sprite.scale.set(h * canvas.width / canvas.height, h, 1);
  return sprite;
}

// ---------- GazeLabel: chạm để chọn ----------

function setupTap(app, headset) {
  let down = null;
  const active = new Set();   // chuột trái/ngón tay đang nhấn
  container.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active.add(e.pointerId);
    down = active.size > 1 ? null   // hai ngón = chụm zoom
      : { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  container.addEventListener('pointercancel', (e) => {
    active.delete(e.pointerId);
    down = null;
  });
  container.addEventListener('pointerup', (e) => {
    if (!active.delete(e.pointerId)) return;
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t <= TAP_MAX_MS;
    down = null;
    if (!quick || moved > TAP_MAX_MOVE) return;   // là cú kéo
    // Đeo kính: cú chạm là nút bấm của kính, chọn thứ đang nhìn
    const spot = headset.active ? headset.gazeTarget : app.pick(e.clientX, e.clientY);
    if (!spot) return;
    app.select(spot);
    // Đã chọn bằng chạm thì đừng để nhìn chờ chọn lại ngay sau đó
    if (spot === headset.gazeTarget) headset.markFired();
  });
}

// ---------- HeartInteraction: kéo để xoay, lăn/chụm để zoom ----------

function setupGestures(app, headset) {
  const pointers = new Map();   // chuột/ngón tay đang nhấn: pointerId → {x, y}
  let mode = 'none';            // none | pending | rotate | pinch | blocked
  let start = null;
  let prevDist = 0;
  const AXIS_Z = new THREE.Vector3(0, 0, 1);   // pháp tuyến tờ giấy
  const right = new THREE.Vector3();
  const inv = new THREE.Quaternion();
  const q = new THREE.Quaternion();

  const pinchDist = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  container.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    container.setPointerCapture(e.pointerId);   // kéo ra ngoài khung vẫn nhận
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      mode = 'pinch';
      prevDist = pinchDist();
    } else if (mode !== 'blocked') {
      mode = 'pending';
      start = { x: e.clientX, y: e.clientY };
    }
  });

  container.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const prev = { x: p.x, y: p.y };
    p.x = e.clientX; p.y = e.clientY;
    if (headset.active || !app.found) return;

    if (pointers.size >= 2) {
      const dist = pinchDist();
      if (prevDist > 1) app.zoomBy(dist / prevDist);   // >1: mở ra, <1: chụm
      prevDist = dist;
      return;
    }
    // Vừa chụm hai ngón xong, còn lại một ngón: chờ nhấc hết tay để tim không giật
    if (mode === 'pinch' || mode === 'blocked') { mode = 'blocked'; return; }
    if (mode === 'pending') {
      if (Math.hypot(p.x - start.x, p.y - start.y) < DRAG_THRESHOLD) return;
      mode = 'rotate';
      rotate(p.x - start.x, p.y - start.y);
      return;
    }
    if (mode === 'rotate') rotate(p.x - prev.x, p.y - prev.y);
  });

  function rotate(dx, dy) {
    const rad = THREE.MathUtils.degToRad(DEG_PER_SCREEN) / container.clientWidth;
    // Kéo ngang: xoay quanh pháp tuyến tờ giấy, kéo sang phải thì mặt gần
    // camera của tim cũng đi sang phải
    q.setFromAxisAngle(AXIS_Z, dx * rad);
    // Kéo dọc: lật quanh hướng "phải" của camera chiếu lên mặt giấy
    // (camera của MindAR đứng yên ở gốc, hướng phải = trục x của thế giới)
    inv.copy(app.pose.quat).invert();
    right.set(1, 0, 0).applyQuaternion(inv);
    right.z = 0;
    if (right.lengthSq() > 1e-6) {
      right.normalize();
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(right, dy * rad));
    }
    // premultiply = xoay theo trục của marker, không theo trục của tim
    app.pivot.quaternion.premultiply(q);
  }

  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) mode = 'none';
    else if (mode === 'pinch') mode = 'blocked';
  };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);

  container.addEventListener('wheel', (e) => {
    e.preventDefault();   // không cuộn trang
    if (headset.active || !app.found || e.deltaY === 0) return;
    // lăn lên (deltaY < 0): to ra; lăn xuống: nhỏ lại
    app.zoomBy(1 - Math.sign(e.deltaY) * SCROLL_ZOOM_STEP);
  }, { passive: false });

  resetBtn.addEventListener('click', () => app.resetView());
}

// ---------- HeadsetView: chế độ kính VR (kiểu Cardboard) ----------
// - Màn hình chia đôi, mỗi mắt lấy nửa giữa khung hình (cách cắt này đúng khi máy
//   nằm ngang nên khóa màn hình ngang).
// - Ảnh webcam là nền chung (chỉ có một camera), còn tim được vẽ bởi hai camera
//   mắt lệch nhau IPD, phủ lên nền → có chiều sâu 3D.
// - Méo thùng trước để bù méo gối của thấu kính (shader LensDistortUI).
// - Nhìn vào một bộ phận 1.5 giây thì chọn; chạm màn hình = nút bấm của kính.
// Khóa 30 fps và không cho tắt màn hình.

function setupHeadset(app) {
  const { mindar } = app;
  const renderer = mindar.renderer;
  const size = new THREE.Vector2();

  const eyes = [-1, 1].map((side) => ({
    side,
    cam: new THREE.PerspectiveCamera(),
    rt: new THREE.WebGLRenderTarget(1, 1),
  }));
  for (const eye of eyes) {
    // Tự đặt matrixWorld mỗi khung hình, không để renderer ghi đè
    eye.cam.matrixAutoUpdate = false;
    eye.cam.matrixWorldAutoUpdate = false;
    eye.rt.texture.colorSpace = THREE.SRGBColorSpace;
  }

  let videoTex = null;
  const lens = new THREE.ShaderMaterial({
    uniforms: {
      tVideo: { value: null },
      tEye: { value: null },
      videoScale: { value: new THREE.Vector2(1, 1) },
      aspect: { value: 1 },
      k1: { value: LENS_K1 },
      k2: { value: LENS_K2 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tVideo, tEye;
      uniform vec2 videoScale;
      uniform float aspect, k1, k2;
      varying vec2 vUv;
      // three.js lưu video ở dạng sRGB thô (không tự giải mã như ảnh thường)
      vec3 srgbToLinear(vec3 c) {
        return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
      }
      void main() {
        // Đổi uv về khung -1..1 của mắt; bán kính tính theo đơn vị thật
        vec2 c = vUv * 2.0 - 1.0;
        vec2 p = c * vec2(aspect, 1.0) / max(aspect, 1.0);
        float r2 = dot(p, p);
        vec2 src = c * (1.0 + k1 * r2 + k2 * r2 * r2);
        if (any(greaterThan(abs(src), vec2(1.0)))) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }
        vec2 uv = src * 0.5 + 0.5;
        // Nền: nửa giữa màn hình (x 0.25 → 0.75), màn hình phủ video như MindAR
        vec2 screen = vec2(0.25 + uv.x * 0.5, uv.y);
        vec3 bg = srgbToLinear(texture2D(tVideo, 0.5 + (screen - 0.5) * videoScale).rgb);
        vec4 eye = texture2D(tEye, uv);
        gl_FragColor = vec4(eye.rgb + bg * (1.0 - eye.a), 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lens);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera();

  const headset = {
    active: false,
    gazeTarget: null,
    markFired() { gaze.fired = true; },
    frame,
  };
  const gaze = { timer: 0, fired: false };
  let sinceFrame = Infinity;
  let wakeLock = null;
  let wentFullscreen = false;

  vrBtn.addEventListener('click', enter);
  vrExitBtn.addEventListener('click', exit);
  document.addEventListener('fullscreenchange', () => {
    // Thoát toàn màn hình (Esc, nút Back) thì thoát luôn chế độ kính
    if (headset.active && wentFullscreen && !document.fullscreenElement) exit();
  });

  async function enter() {
    if (headset.active || !mindar.video) return;
    headset.active = true;
    document.body.classList.add('vr');
    if (!videoTex) {
      videoTex = new THREE.VideoTexture(mindar.video);
      videoTex.colorSpace = THREE.SRGBColorSpace;
      lens.uniforms.tVideo.value = videoTex;
    }
    gaze.timer = 0; gaze.fired = false; headset.gazeTarget = null;
    sinceFrame = Infinity;
    try {
      await document.documentElement.requestFullscreen();
      wentFullscreen = true;
      await screen.orientation.lock('landscape');
    } catch { /* máy tính hoặc iOS: không có toàn màn hình / khóa xoay */ }
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* bỏ qua */ }
  }

  function exit() {
    if (!headset.active) return;
    headset.active = false;
    document.body.classList.remove('vr');
    setReticle(0);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
    if (wentFullscreen) {
      wentFullscreen = false;
      try { screen.orientation.unlock(); } catch { /* bỏ qua */ }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  function setReticle(amount) {
    for (const r of reticles) r.style.setProperty('--p', amount);
  }

  function updateGaze(dt) {
    mindar.scene.updateMatrixWorld();
    const target = app.pickNdc(0, 0);   // tia từ giữa camera
    if (target !== headset.gazeTarget) {
      headset.gazeTarget = target;
      gaze.timer = 0;
      gaze.fired = false;
    }
    if (target && !gaze.fired) {
      gaze.timer += dt;
      if (gaze.timer >= DWELL_SECONDS) {
        app.select(target);
        gaze.fired = true;
      }
    }
    setReticle(target && !gaze.fired ? gaze.timer / DWELL_SECONDS : 0);
  }

  function frame(dt) {
    updateGaze(dt);
    sinceFrame += dt;
    if (sinceFrame < 1 / VR_FPS - 0.004) return;   // khóa 30 fps
    sinceFrame = 0;

    const cw = container.clientWidth, ch = container.clientHeight;
    renderer.getDrawingBufferSize(size);
    const eyeW = Math.max(1, Math.round(size.x * VR_RESOLUTION_SCALE / 2));
    const eyeH = Math.max(1, Math.round(size.y * VR_RESOLUTION_SCALE));

    // Mắt chỉ vẽ nửa giữa khung hình: nhân 2 hàng x của ma trận chiếu
    const proj = mindar.camera.projectionMatrix.clone();
    const pe = proj.elements;
    pe[0] *= 2; pe[4] *= 2; pe[8] *= 2; pe[12] *= 2;
    // Đơn vị thế giới của MindAR theo marker: đổi IPD sang cùng đơn vị
    const ipd = IPD * app.pose.scale.x;

    const clearColor = renderer.getClearColor(new THREE.Color());
    const clearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const eye of eyes) {
      if (eye.rt.width !== eyeW || eye.rt.height !== eyeH) eye.rt.setSize(eyeW, eyeH);
      eye.cam.projectionMatrix.copy(proj);
      eye.cam.projectionMatrixInverse.copy(proj).invert();
      eye.cam.matrixWorld.makeTranslation(eye.side * ipd / 2, 0, 0);
      eye.cam.matrixWorldInverse.copy(eye.cam.matrixWorld).invert();
      renderer.setRenderTarget(eye.rt);
      renderer.clear();
      renderer.render(mindar.scene, eye.cam);
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearColor, clearAlpha);

    // Nền: cùng cách phủ video như MindAR.resize (cover, căn giữa)
    const video = mindar.video;
    const vr = video.videoWidth / video.videoHeight;
    const vw = vr > cw / ch ? ch * vr : cw;
    const vh = vr > cw / ch ? ch : cw / vr;
    lens.uniforms.videoScale.value.set(cw / vw, ch / vh);
    lens.uniforms.aspect.value = (cw / 2) / ch;

    renderer.setScissorTest(true);
    eyes.forEach((eye, i) => {
      const x = i * cw / 2;
      renderer.setViewport(x, 0, cw / 2, ch);
      renderer.setScissor(x, 0, cw / 2, ch);
      lens.uniforms.tEye.value = eye.rt.texture;
      renderer.render(quadScene, quadCam);
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw, ch);
  }

  return headset;
}
