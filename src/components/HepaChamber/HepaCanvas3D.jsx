import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, Play, Pause, RefreshCw, Eye, Layers, Compass, Wind } from 'lucide-react';

export default function HepaCanvas3D({ activeMechanism, filterSpeed = 1.0 }) {
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;

  const [viewAngle, setViewAngle] = useState('isometric');

  // Orbit controls state
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const cameraDistance = useRef(10.0);
  const cameraAngle = useRef({ theta: 0.65, phi: 0.32 }); // Spherical coordinates

  const updateCameraPositionRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b16);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const updateCameraPosition = () => {
      const radius = cameraDistance.current;
      const phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, cameraAngle.current.phi));
      const theta = cameraAngle.current.theta;

      camera.position.x = radius * Math.sin(theta) * Math.cos(phi);
      camera.position.y = radius * Math.sin(phi);
      camera.position.z = radius * Math.cos(theta) * Math.cos(phi);
      camera.lookAt(0, 0, 0);
    };
    updateCameraPositionRef.current = updateCameraPosition;
    updateCameraPosition();

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // 3. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 8, 7);
    scene.add(keyLight);

    // Upstream (Inflow) Red/Amber Point Light
    const inflowLight = new THREE.PointLight(0xf87171, 3.8, 14);
    inflowLight.position.set(-5, 0, 2);
    scene.add(inflowLight);

    // Downstream (Outflow) Cyan/Blue Point Light
    const outflowLight = new THREE.PointLight(0x38bdf8, 3.8, 14);
    outflowLight.position.set(5, 0, 2);
    scene.add(outflowLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.2);
    rimLight.position.set(-4, -6, -6);
    scene.add(rimLight);

    // 4. Procedural 3D HEPA Filter Mesh (32 Continuous Zig-Zag Pleats Across Airflow)
    // The filter stands across the stream at X = 0 (in the Y-Z plane).
    // Airflow travels straight through along the +X axis (from Left -X to Right +X).
    const filterGroup = new THREE.Group();

    const pleatCount = 32; // Over 28+ required pleats
    const filterWidth = 5.2; // Spans along Z axis (-2.6 to +2.6)
    const filterHeight = 4.2; // Spans along Y axis (-2.1 to +2.1)
    const pleatDepth = 0.8; // Peak-to-valley depth along X axis (-0.4 to +0.4)
    const segmentsY = 24;

    const vertices = [];
    const indices = [];
    const uvs = [];

    // Construct pleated continuous ribbon mesh in Y-Z plane with depth along X
    for (let i = 0; i <= pleatCount; i++) {
      const z = -filterWidth / 2 + (i / pleatCount) * filterWidth;
      // Zig-zag peaks and valleys along the flow direction (X axis)
      const x = (i % 2 === 0 ? 1 : -1) * (pleatDepth / 2);

      for (let j = 0; j <= segmentsY; j++) {
        const y = -filterHeight / 2 + (j / segmentsY) * filterHeight;
        vertices.push(x, y, z);
        uvs.push(i / pleatCount, j / segmentsY);
      }
    }

    const rowStride = segmentsY + 1;
    for (let i = 0; i < pleatCount; i++) {
      for (let j = 0; j < segmentsY; j++) {
        const a = i * rowStride + j;
        const b = (i + 1) * rowStride + j;
        const c = (i + 1) * rowStride + (j + 1);
        const d = i * rowStride + (j + 1);

        // Two triangles per pleated quad
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const pleatGeo = new THREE.BufferGeometry();
    pleatGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    pleatGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    pleatGeo.setIndex(indices);
    pleatGeo.computeVertexNormals();

    const pleatMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
      flatShading: false,
    });
    const pleatMesh = new THREE.Mesh(pleatGeo, pleatMat);
    filterGroup.add(pleatMesh);

    // 5. Outer Aluminum Anodized Metallic Blue Frame Enclosure (In YZ Plane)
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Metallic Royal Blue
      metalness: 0.88,
      roughness: 0.22,
    });

    const frameThickness = 0.24;
    const frameDepth = 1.05; // Enclosure depth along X

    // Top beam (along Z)
    const topBeamGeo = new THREE.BoxGeometry(frameDepth, frameThickness, filterWidth + frameThickness * 2);
    const topBeam = new THREE.Mesh(topBeamGeo, frameMat);
    topBeam.position.set(0, filterHeight / 2 + frameThickness / 2, 0);
    filterGroup.add(topBeam);

    // Bottom beam (along Z)
    const btmBeam = new THREE.Mesh(topBeamGeo, frameMat);
    btmBeam.position.set(0, -filterHeight / 2 - frameThickness / 2, 0);
    filterGroup.add(btmBeam);

    // Front beam (along Y)
    const frontBeamGeo = new THREE.BoxGeometry(frameDepth, filterHeight, frameThickness);
    const frontBeam = new THREE.Mesh(frontBeamGeo, frameMat);
    frontBeam.position.set(0, 0, filterWidth / 2 + frameThickness / 2);
    filterGroup.add(frontBeam);

    // Back beam (along Y)
    const backBeam = new THREE.Mesh(frontBeamGeo, frameMat);
    backBeam.position.set(0, 0, -filterWidth / 2 - frameThickness / 2);
    filterGroup.add(backBeam);

    // Rubber sealing gasket on upstream perimeter (X = -frameDepth/2 - 0.03)
    const gasketMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const gasketGeo = new THREE.BoxGeometry(0.08, filterHeight + 0.35, filterWidth + 0.35);
    const gasket = new THREE.Mesh(gasketGeo, gasketMat);
    gasket.position.set(-frameDepth / 2 - 0.04, 0, 0);
    filterGroup.add(gasket);

    // Support wire scrim lines across pleat faces (Downstream reinforcement)
    const wireMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.45 });
    const wireGeo = new THREE.BufferGeometry();
    const wireVerts = [];
    for (let w = -filterHeight / 2 + 0.6; w < filterHeight / 2; w += 0.9) {
      wireVerts.push(pleatDepth / 2 + 0.03, w, -filterWidth / 2);
      wireVerts.push(pleatDepth / 2 + 0.03, w, filterWidth / 2);
      wireVerts.push(-pleatDepth / 2 - 0.03, w, -filterWidth / 2);
      wireVerts.push(-pleatDepth / 2 - 0.03, w, filterWidth / 2);
    }
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wireVerts, 3));
    const wireLines = new THREE.LineSegments(wireGeo, wireMat);
    filterGroup.add(wireLines);

    // Aerodynamic Wind Tunnel Guide Duct Rails (Transparent acrylic chamber walls)
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
      roughness: 0.1,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    // Duct top & bottom plates
    const ductPlateGeo = new THREE.BoxGeometry(12.0, 0.05, filterWidth + 0.5);
    const ductTop = new THREE.Mesh(ductPlateGeo, tunnelMat);
    ductTop.position.set(0, filterHeight / 2 + frameThickness + 0.02, 0);
    scene.add(ductTop);

    const ductBtm = new THREE.Mesh(ductPlateGeo, tunnelMat);
    ductBtm.position.set(0, -filterHeight / 2 - frameThickness - 0.02, 0);
    scene.add(ductBtm);

    scene.add(filterGroup);

    // 6. Airflow Particle Simulation Engine (Flowing DIRECTLY THROUGH Filter from -X to +X)
    const particleCount = 1400;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleVelocities = [];

    const dirtyColor = new THREE.Color(0xf87171); // Inflow dirty amber/red
    const cleanColor = new THREE.Color(0x38bdf8); // Outflow crystal cyan
    const trappedColor = new THREE.Color(0xfbbf24); // Trapped golden particulate

    for (let i = 0; i < particleCount; i++) {
      // Zone distribution:
      // ~45% Inflow dirty stream (Left: X from -6.0 to -0.4)
      // ~15% Trapped on filter pleat fibers (Core: X near -0.3 to +0.3)
      // ~40% Outflow clean stream (Right: X from +0.4 to +6.0)
      const isOutflow = i > particleCount * 0.58;
      const isTrapped = !isOutflow && i % 4 === 0;

      let x, y, z;
      if (isOutflow) {
        x = 0.4 + Math.random() * 5.6;
        y = (Math.random() - 0.5) * (filterHeight * 0.92);
        z = (Math.random() - 0.5) * (filterWidth * 0.92);
      } else if (isTrapped) {
        x = (Math.random() - 0.5) * (pleatDepth * 0.8);
        y = (Math.random() - 0.5) * (filterHeight * 0.94);
        z = (Math.random() - 0.5) * (filterWidth * 0.94);
      } else {
        x = -6.0 + Math.random() * 5.5;
        y = (Math.random() - 0.5) * (filterHeight * 0.92);
        z = (Math.random() - 0.5) * (filterWidth * 0.92);
      }

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      if (isOutflow) {
        particleColors[i * 3] = cleanColor.r;
        particleColors[i * 3 + 1] = cleanColor.g;
        particleColors[i * 3 + 2] = cleanColor.b;
        particleSizes[i] = 0.05 + Math.random() * 0.04;
      } else if (isTrapped) {
        particleColors[i * 3] = trappedColor.r;
        particleColors[i * 3 + 1] = trappedColor.g;
        particleColors[i * 3 + 2] = trappedColor.b;
        particleSizes[i] = 0.075;
      } else {
        particleColors[i * 3] = dirtyColor.r;
        particleColors[i * 3 + 1] = dirtyColor.g;
        particleColors[i * 3 + 2] = dirtyColor.b;
        particleSizes[i] = 0.06 + Math.random() * 0.07;
      }

      particleVelocities.push({
        vx: 0.038 + Math.random() * 0.03,
        vy: (Math.random() - 0.5) * 0.004,
        vz: (Math.random() - 0.5) * 0.004,
        isTrapped: isTrapped,
        mechanism: i % 3, // 0: Impaction, 1: Interception, 2: Diffusion
        trappedX: x,
        trappedY: y,
        trappedZ: z,
      });
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    particleGeo.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    const particleMat = new THREE.PointsMaterial({
      size: 0.075,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const particleMesh = new THREE.Points(particleGeo, particleMat);
    scene.add(particleMesh);

    // 7. Aerodynamic Streamline Guides (Curving cleanly through the filter)
    const streamlineGroup = new THREE.Group();
    const streamlineCount = 8;
    const streamlines = [];

    for (let s = 0; s < streamlineCount; s++) {
      const sy = -filterHeight / 2 + 0.5 + (s / (streamlineCount - 1)) * (filterHeight - 1.0);
      const sz = -filterWidth / 2 + 0.8 + ((s * 3) % streamlineCount) * (filterWidth / streamlineCount);

      const points = [];
      for (let sx = -5.8; sx <= 5.8; sx += 0.4) {
        // Slight convergence towards pleat valleys at core
        let curveY = sy;
        let curveZ = sz;
        if (Math.abs(sx) < 1.2) {
          curveZ += Math.sin(sx * 4) * 0.06;
        }
        points.push(new THREE.Vector3(sx, curveY, curveZ));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.015, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.25,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      streamlineGroup.add(tubeMesh);
      streamlines.push({ mesh: tubeMesh, geo: tubeGeo, mat: tubeMat });
    }
    scene.add(streamlineGroup);

    // 8. Mouse & Touch Orbit Controls
    const onMouseDown = (e) => {
      isDragging.current = true;
      previousMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - previousMouse.current.x;
      const dy = e.clientY - previousMouse.current.y;

      cameraAngle.current.theta -= dx * 0.007;
      cameraAngle.current.phi += dy * 0.007;
      updateCameraPosition();

      previousMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      cameraDistance.current = Math.max(4.0, Math.min(18.0, cameraDistance.current + e.deltaY * 0.01));
      updateCameraPosition();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Touch controls
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        previousMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const onTouchMove = (e) => {
      if (!isDragging.current || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - previousMouse.current.x;
      const dy = e.touches[0].clientY - previousMouse.current.y;
      cameraAngle.current.theta -= dx * 0.007;
      cameraAngle.current.phi += dy * 0.007;
      updateCameraPosition();
      previousMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = () => {
      isDragging.current = false;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // 9. Animation Loop
    let animId;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isPlayingRef.current) {
        const positions = particleGeo.attributes.position.array;
        const colors = particleGeo.attributes.color.array;
        const speedMultiplier = filterSpeed;

        for (let i = 0; i < particleCount; i++) {
          const vel = particleVelocities[i];
          const px = positions[i * 3];

          // Trapped on the pleat filter mesh
          if (vel.isTrapped) {
            // Electrostatic micro-jitter
            positions[i * 3 + 1] += (Math.random() - 0.5) * 0.0008;
            positions[i * 3 + 2] += (Math.random() - 0.5) * 0.0008;
            continue;
          }

          // Inflow stage (Moving rightwards from left X = -6 towards filter at X = 0)
          if (px < -0.4) {
            positions[i * 3] += vel.vx * speedMultiplier;
            // Brownian diffusion jitter for small sub-micron particles
            if (vel.mechanism === 2 || activeMechanism === 'diffusion') {
              positions[i * 3 + 1] += (Math.random() - 0.5) * 0.018;
              positions[i * 3 + 2] += (Math.random() - 0.5) * 0.018;
            }
          }
          // Entering the 32 Pleat Zig-Zag Zone (-0.4 <= X <= +0.4)
          else if (px >= -0.4 && px <= 0.4) {
            // Air slows as it encounters the dense borosilicate micro-fibers
            positions[i * 3] += vel.vx * 0.28 * speedMultiplier;

            // Chance of mechanical capture according to selected or combined mechanism
            let captureChance = 0.015;
            if (activeMechanism === 'impaction' && vel.mechanism === 0) captureChance = 0.035;
            if (activeMechanism === 'interception' && vel.mechanism === 1) captureChance = 0.035;
            if (activeMechanism === 'diffusion' && vel.mechanism === 2) captureChance = 0.035;

            if (Math.random() < captureChance) {
              vel.isTrapped = true;
              colors[i * 3] = trappedColor.r;
              colors[i * 3 + 1] = trappedColor.g;
              colors[i * 3 + 2] = trappedColor.b;
              continue;
            }
          }
          // Outflow stage (Passing out of the filter into clean downstream zone)
          else {
            positions[i * 3] += vel.vx * 1.4 * speedMultiplier;
            // Pure clean air particles glow with crystal cyan
            colors[i * 3] = cleanColor.r;
            colors[i * 3 + 1] = cleanColor.g;
            colors[i * 3 + 2] = cleanColor.b;
          }

          // Wrap particles back to inflow intake when reaching duct exit (X > 6.0)
          if (positions[i * 3] > 6.0) {
            positions[i * 3] = -6.0;
            positions[i * 3 + 1] = (Math.random() - 0.5) * (filterHeight * 0.92);
            positions[i * 3 + 2] = (Math.random() - 0.5) * (filterWidth * 0.92);

            colors[i * 3] = dirtyColor.r;
            colors[i * 3 + 1] = dirtyColor.g;
            colors[i * 3 + 2] = dirtyColor.b;
            vel.isTrapped = false;
          }
        }

        particleGeo.attributes.position.needsUpdate = true;
        particleGeo.attributes.color.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 10. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      pleatGeo.dispose();
      pleatMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      topBeamGeo.dispose();
      frontBeamGeo.dispose();
      frameMat.dispose();
      gasketGeo.dispose();
      gasketMat.dispose();
      ductPlateGeo.dispose();
      tunnelMat.dispose();
      streamlines.forEach((s) => {
        s.geo.dispose();
        s.mat.dispose();
      });
    };
  }, [activeMechanism, filterSpeed]);

  const setCameraPreset = (preset) => {
    setViewAngle(preset);
    if (preset === 'isometric') {
      cameraDistance.current = 10.0;
      cameraAngle.current = { theta: 0.65, phi: 0.32 };
    } else if (preset === 'side') {
      // Direct side view: looking perpendicular to flow
      cameraDistance.current = 9.5;
      cameraAngle.current = { theta: 0.0, phi: 0.08 };
    } else if (preset === 'inflow') {
      // Looking directly from intake into the filter face
      cameraDistance.current = 8.5;
      cameraAngle.current = { theta: -Math.PI / 2 + 0.1, phi: 0.15 };
    } else if (preset === 'outflow') {
      // Looking from clean exhaust side
      cameraDistance.current = 8.5;
      cameraAngle.current = { theta: Math.PI / 2 - 0.1, phi: 0.15 };
    }
    if (updateCameraPositionRef.current) {
      updateCameraPositionRef.current();
    }
  };

  return (
    <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl flex flex-col justify-between">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Top Floating Telemetry Overlay */}
      <div className="z-10 p-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/60 shadow-lg flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </span>
          <span className="text-xs font-semibold text-white tracking-wide">
            True Airflow Through 32 Pleat HEPA Matrix
          </span>
        </div>

        {/* Real-time HEPA Efficiency Metric */}
        <div className="bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-emerald-500/40 shadow-lg flex items-center gap-3">
          <div className="text-[11px] text-slate-400">
            Pass-Through Efficiency: <strong className="text-emerald-400 font-mono text-xs">99.97% @ 0.3 µm</strong>
          </div>
          <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-mono border border-emerald-800">
            H13 Rated
          </span>
        </div>
      </div>

      {/* Inflow vs Outflow Labels */}
      <div className="z-10 px-6 flex justify-between pointer-events-none my-auto">
        <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs px-3.5 py-2 rounded-xl shadow-xl backdrop-blur-md flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
          <div>
            <div className="font-bold text-rose-300">Intake Inflow</div>
            <div className="text-[10px] text-rose-300/80 font-mono">PM2.5 / PM10 Airborne Dust</div>
          </div>
        </div>

        <div className="bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 text-xs px-3.5 py-2 rounded-xl shadow-xl backdrop-blur-md flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <div>
            <div className="font-bold text-cyan-300">Purified Outflow</div>
            <div className="text-[10px] text-cyan-300/80 font-mono">Zero-Leakage Clean Air</div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Bar with Camera Presets */}
      <div className="z-10 p-4 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition border border-slate-700"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isPlaying ? 'Freeze Flow' : 'Resume Flow'}</span>
          </button>

          {/* Camera View Angle Presets */}
          <div className="flex items-center bg-slate-900/90 rounded-xl p-1 border border-slate-800 text-[11px]">
            <button
              onClick={() => setCameraPreset('isometric')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                viewAngle === 'isometric' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              3D Angle
            </button>
            <button
              onClick={() => setCameraPreset('side')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                viewAngle === 'side' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Side Cutaway
            </button>
            <button
              onClick={() => setCameraPreset('inflow')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                viewAngle === 'inflow' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Intake Front
            </button>
            <button
              onClick={() => setCameraPreset('outflow')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                viewAngle === 'outflow' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Exhaust Rear
            </button>
          </div>

          <button
            onClick={() => setCameraPreset('isometric')}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700 transition"
            title="Reset Orbit Camera"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset View</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Click & drag to rotate 360° • Scroll wheel to zoom</span>
        </div>
      </div>
    </div>
  );
}
