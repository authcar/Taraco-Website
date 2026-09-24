const THREE_URL = 'https://unpkg.com/three@0.170.0/build/three.module.js';

function dragOrbit(canvas, opts) {
  const s = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, dragging: false, lx: 0, ly: 0 };
  const down = (e) => { s.dragging = true; s.lx = e.clientX; s.ly = e.clientY; canvas.style.cursor = 'grabbing'; canvas.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    if (!s.dragging) return;
    s.tYaw = Math.max(-opts.yaw, Math.min(opts.yaw, s.tYaw - (e.clientX - s.lx) * 0.005));
    s.tPitch = Math.max(-opts.pitch, Math.min(opts.pitch, s.tPitch + (e.clientY - s.ly) * 0.003));
    s.lx = e.clientX; s.ly = e.clientY;
  };
  const up = () => { s.dragging = false; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  s.dispose = () => { canvas.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  return s;
}

function baseRenderer(THREE, canvas, alpha) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

function runLoop(canvas, renderer, camera, frame) {
  let raf = 0, visible = true, t0 = performance.now();
  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) tick(); });
  io.observe(canvas);
  function tick() {
    if (!visible) { raf = 0; return; }
    frame((performance.now() - t0) / 1000);
    raf = requestAnimationFrame(tick);
  }
  tick();
  return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); };
}

const box = (THREE, w, h, d, mat, x, y, z, parent) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
};

export async function mountRoom(canvas, { autoMotion = true } = {}) {
  const THREE = await import(THREE_URL);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#161412');
  scene.fog = new THREE.Fog('#161412', 11, 24);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  const renderer = baseRenderer(THREE, canvas, false);

  const M = (color, rough = 0.85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const mat = {
    floor: M('#3b3733', 0.7), wall: M('#4a4540', 0.95), back: M('#57504a', 0.95), ceil: M('#2c2926', 1),
    stone: M('#9a9187', 0.55), walnut: M('#4a3122', 0.6), cab: M('#2a2724', 0.6), black: M('#141211', 0.4, 0.3),
    led: M('#ffd49a', 1, 0, { emissive: '#ffc680', emissiveIntensity: 2.4 }),
    window: M('#d7dccf', 1, 0, { emissive: '#c9d0bf', emissiveIntensity: 0.9 }),
    ceramic: M('#1c1a18', 0.5), straw: M('#b59a74', 1), glow: M('#fff0d8', 1, 0, { emissive: '#ffdcaa', emissiveIntensity: 3 }),
  };

  const room = new THREE.Group(); scene.add(room);
  const W = 11, D = 9, H = 3.3;
  const floor = box(THREE, W, 0.1, D, mat.floor, 0, -0.05, 0, room); floor.castShadow = false;
  box(THREE, W, H, 0.12, mat.back, 0, H / 2, -D / 2, room).castShadow = false;
  box(THREE, 0.12, H, D, mat.wall, W / 2, H / 2, 0, room).castShadow = false;
  box(THREE, W, 0.1, D, mat.ceil, 0, H, 0, room).castShadow = false;
  // left wall: floor-to-ceiling window with mullions
  const win = new THREE.Mesh(new THREE.PlaneGeometry(D - 1, H - 0.2), mat.window);
  win.rotation.y = Math.PI / 2; win.position.set(-W / 2, H / 2, -0.2); room.add(win);
  for (let i = 0; i < 4; i++) box(THREE, 0.06, H, 0.06, mat.black, -W / 2 + 0.05, H / 2, -D / 2 + 1 + i * 2.35, room);

  // back run: base cabinets, stone counter, LED strip, upper cabinets
  box(THREE, 7, 0.9, 0.65, mat.cab, 0.6, 0.45, -D / 2 + 0.4, room);
  box(THREE, 7, 0.05, 0.7, mat.stone, 0.6, 0.93, -D / 2 + 0.42, room);
  box(THREE, 7, 0.02, 0.04, mat.led, 0.6, 1.93, -D / 2 + 0.55, room).castShadow = false;
  box(THREE, 7, 1.1, 0.4, mat.cab, 0.6, 2.5, -D / 2 + 0.28, room);
  box(THREE, 7, 0.95, 0.03, mat.stone, 0.6, 1.45, -D / 2 + 0.08, room).castShadow = false;
  const ledLight = new THREE.PointLight('#ffc680', 6, 5, 1.6); ledLight.position.set(0.6, 1.7, -D / 2 + 0.7); room.add(ledLight);
  const ledLight2 = ledLight.clone(); ledLight2.position.x = -2.2; room.add(ledLight2);
  const ledLight3 = ledLight.clone(); ledLight3.position.x = 3.4; room.add(ledLight3);
  // right: tall cabinets
  box(THREE, 0.7, H - 0.1, 3.4, mat.cab, W / 2 - 0.4, (H - 0.1) / 2, -2.2, room);
  box(THREE, 0.02, 1.2, 0.8, mat.black, W / 2 - 0.76, 1.6, -1.2, room);

  // island: stone top + fluted walnut front
  const island = new THREE.Group(); island.position.set(0, 0, -0.6); room.add(island);
  box(THREE, 3.6, 0.9, 1.1, mat.cab, 0, 0.45, 0, island);
  box(THREE, 3.8, 0.08, 1.2, mat.stone, 0, 0.94, 0, island);
  box(THREE, 0.1, 0.9, 1.2, mat.stone, 1.85, 0.45, 0, island);
  for (let i = 0; i < 44; i++) box(THREE, 0.05, 0.86, 0.04, mat.walnut, -1.72 + i * 0.08, 0.45, 0.57, island);
  // vase with dried stems
  const vase = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), mat.ceramic); vase.scale.set(1, 1.1, 1); vase.position.set(-1.1, 1.14, 0); vase.castShadow = true; island.add(vase);
  for (let i = 0; i < 5; i++) {
    const len = 0.55 + (i % 3) * 0.12, a = i * 2.4, tilt = 0.08 + (i % 2) * 0.1;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, len, 4), mat.straw);
    st.position.set(-1.1 + Math.cos(a) * 0.03, 1.2 + len / 2, Math.sin(a) * 0.03);
    st.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt); island.add(st);
  }
  // stools
  for (const x of [-2.5, -2.0]) {
    const st = new THREE.Group(); st.position.set(x, 0, 0.1 - 0.6); room.add(st);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), mat.walnut); seat.position.y = 0.72; seat.castShadow = true; st.add(seat);
    for (let k = 0; k < 4; k++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.74, 6), mat.black);
      const a = k * Math.PI / 2 + Math.PI / 4; leg.position.set(Math.cos(a) * 0.14, 0.36, Math.sin(a) * 0.14);
      leg.rotation.set(Math.sin(a) * -0.1, 0, Math.cos(a) * 0.1); leg.castShadow = true; st.add(leg);
    }
  }
  // pendants
  for (const x of [-0.8, 0.8]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4), mat.black); cord.position.set(x, H - 0.6, -0.6); room.add(cord);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 20), mat.black); shade.position.set(x, H - 1.33, -0.6); room.add(shade);
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), mat.glow); bulb.rotation.x = Math.PI / 2; bulb.position.set(x, H - 1.48, -0.6); room.add(bulb);
    const pl = new THREE.SpotLight('#ffd7a3', 18, 5, 0.7, 0.6, 1.4); pl.position.set(x, H - 1.5, -0.6); pl.target.position.set(x, 0, -0.6); pl.castShadow = true; pl.shadow.mapSize.set(512, 512);
    room.add(pl, pl.target);
  }

  scene.add(new THREE.HemisphereLight('#c9c3b8', '#1a1715', 0.35));
  const day = new THREE.DirectionalLight('#e6eadf', 1.4); day.position.set(-9, 4, 1); day.target.position.set(1, 0, -1);
  day.castShadow = true; day.shadow.mapSize.set(1024, 1024);
  Object.assign(day.shadow.camera, { left: -7, right: 7, top: 5, bottom: -3, near: 1, far: 24 });
  scene.add(day, day.target);

  const orbit = dragOrbit(canvas, { yaw: 0.55, pitch: 0.12 });
  let progress = 0, sp = 0;
  const target = new THREE.Vector3(0.3, 1.05, -0.8);
  const dispose = runLoop(canvas, renderer, camera, (t) => {
    orbit.yaw += (orbit.tYaw - orbit.yaw) * 0.06;
    orbit.pitch += (orbit.tPitch - orbit.pitch) * 0.06;
    sp += (progress - sp) * 0.1;
    const sway = autoMotion && !orbit.dragging ? Math.sin(t * 0.18) * 0.1 : 0;
    const yaw = orbit.yaw + sway + 0.12;
    const radius = 7.6 - sp * 2.6;
    const h = 1.75 + orbit.pitch * 4 - sp * 0.25;
    camera.position.set(target.x + Math.sin(yaw) * radius, h, target.z + Math.cos(yaw) * radius);
    camera.lookAt(target);
    renderer.render(scene, camera);
  });
  return { setProgress: (p) => { progress = p; }, dispose: () => { orbit.dispose(); dispose(); } };
}

export async function mountIsland(canvas, { autoMotion = true } = {}) {
  const THREE = await import(THREE_URL);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  const renderer = baseRenderer(THREE, canvas, true);
  renderer.setClearColor(0x000000, 0);
  const M = (color, rough, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const stone = M('#d8d2c8', 0.35), walnut = M('#5a3b27', 0.55), body = M('#2a2623', 0.6), ceramic = M('#1c1a18', 0.5), straw = M('#b59a74', 1), plinthMat = M('#2a2623', 0.8);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.4 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.06, 72), plinthMat); plinth.position.y = 0.03; plinth.receiveShadow = true; scene.add(plinth);

  const island = new THREE.Group(); island.position.y = 0.06; scene.add(island);
  const L = 1.9, Dd = 0.8, Hh = 0.9;
  box(THREE, L - 0.08, Hh - 0.05, Dd - 0.06, body, -0.02, (Hh - 0.05) / 2, 0, island);
  box(THREE, L, 0.05, Dd, stone, 0, Hh - 0.025, 0, island);
  box(THREE, 0.05, Hh, Dd, stone, L / 2 - 0.025, Hh / 2, 0, island);
  const n = 30, pitch = (L - 0.1) / n;
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(pitch * 0.46, pitch * 0.46, Hh - 0.08, 10, 1, false, 0, Math.PI), walnut);
    f.position.set(-L / 2 + pitch / 2 + i * pitch, (Hh - 0.08) / 2 + 0.01, Dd / 2 - 0.03); f.rotation.y = -Math.PI / 2;
    f.castShadow = true; island.add(f);
  }
  box(THREE, L - 0.1, 0.04, 0.02, body, -0.05, 0.02, Dd / 2 - 0.02, island);
  const vase = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), ceramic); vase.scale.set(1, 1.15, 1); vase.position.set(-0.55, Hh + 0.1, 0.05); vase.castShadow = true; island.add(vase);
  for (let i = 0; i < 5; i++) {
    const len = 0.32 + (i % 3) * 0.07, a = i * 2.4, tilt = 0.08 + (i % 2) * 0.1;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, len, 4), straw);
    st.position.set(-0.55, Hh + 0.12 + len / 2, 0.05); st.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt); island.add(st);
  }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.06, 28), M('#efe9df', 0.6)); bowl.position.set(0.35, Hh + 0.03, -0.1); bowl.castShadow = true; island.add(bowl);

  scene.add(new THREE.HemisphereLight('#f3ece2', '#2a2623', 0.75));
  const key = new THREE.DirectionalLight('#fff1dc', 2.3); key.position.set(3, 5, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5 }); key.shadow.radius = 6; scene.add(key);
  const rim = new THREE.DirectionalLight('#ffcf8f', 1.2); rim.position.set(-3, 2, -3); scene.add(rim);

  const orbit = dragOrbit(canvas, { yaw: 100, pitch: 0.15 });
  let spin = 0.5;
  const dispose = runLoop(canvas, renderer, camera, () => {
    if (autoMotion && !orbit.dragging) spin += 0.004;
    orbit.yaw += (orbit.tYaw - orbit.yaw) * 0.08;
    orbit.pitch += (orbit.tPitch - orbit.pitch) * 0.08;
    island.rotation.y = plinth.rotation.y = spin - orbit.yaw * 1.6;
    camera.position.set(0, 2.1 + orbit.pitch * 3, 5.6);
    camera.lookAt(0, 0.42, 0);
    renderer.render(scene, camera);
  });
  return { setProgress() {}, dispose: () => { orbit.dispose(); dispose(); } };
}

export async function mountChair(canvas, { autoMotion = true } = {}) {
  const THREE = await import(THREE_URL);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  camera.position.set(0, 1.6, 6.4);
  const renderer = baseRenderer(THREE, canvas, true);
  renderer.setClearColor(0x000000, 0);

  const fabric = new THREE.MeshStandardMaterial({ color: '#8d857b', roughness: 1 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: '#2a2623', roughness: 0.8 });
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.45 });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), shadowMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.06, 64), plinthMat); plinth.position.y = 0.03; plinth.receiveShadow = true; scene.add(plinth);

  const chair = new THREE.Group(); chair.position.y = 0.06; scene.add(chair);
  const arc = (R, r, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 20, 48, Math.PI), fabric);
    m.position.set(x, 0, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; chair.add(m); return m;
  };
  arc(0.36, 0.1, -0.44, 0.02, Math.PI / 2);
  arc(0.36, 0.1, 0.44, 0.02, Math.PI / 2);
  const back = arc(0.46, 0.12, 0, -0.34, 0); back.scale.set(1, 1.55, 1);
  const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.64, 8, 24), fabric);
  seat.rotation.z = Math.PI / 2; seat.scale.set(1, 1, 2.6); seat.position.set(0, 0.3, 0.02); seat.castShadow = true; chair.add(seat);

  scene.add(new THREE.HemisphereLight('#f3ece2', '#2a2623', 0.7));
  const key = new THREE.DirectionalLight('#fff1dc', 2.2); key.position.set(2.5, 4, 2.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 }); key.shadow.radius = 6; scene.add(key);
  const rim = new THREE.DirectionalLight('#ffcf8f', 1.4); rim.position.set(-3, 2, -3); scene.add(rim);

  const orbit = dragOrbit(canvas, { yaw: 100, pitch: 0.15 });
  let spin = 0;
  const dispose = runLoop(canvas, renderer, camera, () => {
    if (autoMotion && !orbit.dragging) spin += 0.004;
    orbit.yaw += (orbit.tYaw - orbit.yaw) * 0.08;
    orbit.pitch += (orbit.tPitch - orbit.pitch) * 0.08;
    chair.rotation.y = plinth.rotation.y = spin - orbit.yaw * 1.6;
    camera.position.y = 1.6 + orbit.pitch * 3;
    camera.lookAt(0, 0.4, 0);
    renderer.render(scene, camera);
  });
  return { setProgress() {}, dispose: () => { orbit.dispose(); dispose(); } };
}
