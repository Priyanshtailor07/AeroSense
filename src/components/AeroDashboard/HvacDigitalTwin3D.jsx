import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Eye, Box, Maximize2, RotateCcw, Activity, Shield, Wind, Sparkles } from 'lucide-react';
import { soundEffects } from '../../utils/soundEffects';

import { formatPercent, numberOr } from '../../utils/formatNumber';

export default function HvacDigitalTwin3D({
  // Null when AWS Live has no value. Geometry uses numberOr(); the readout
  // chips show N/A so a missing metric is never drawn as a real number.
  damperPct = null,
  fanSpeedPct = null,
  filterHealthPct = null,
  roomVolM3 = 500,
  ceilingHeightM = 3.5,
  occupancy = 28,
  ambientPM25 = 25,
  indoorPM25 = 8.5,
  indoorCO2 = 650,
  targetCO2Max = 850,
  theme,
}) {
  // Visual-only coercions for WebGL maths, which cannot accept null.
  const safeDamperPct = numberOr(damperPct, 0);
  const safeFanSpeedPct = numberOr(fanSpeedPct, 0);
  const safeFilterHealthPct = numberOr(filterHealthPct, 100);

  const mountRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const damperMeshRef = useRef(null);
  const fanBladesRef = useRef(null);
  const hepaMatRef = useRef(null);
  const roomWallMatRef = useRef(null);
  const roomGroupRef = useRef(null);
  const occupantsGroupRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  const [activeCameraView, setActiveCameraView] = useState('iso');
  /** Set when a WebGL context cannot be created, so we can explain why. */
  const [webglError, setWebglError] = useState(null);

  // Mutable refs for animation loop
  // The animation loop performs arithmetic on these every frame, so it is fed
  // the coerced values only. A null here would produce NaN geometry and a
  // black canvas.
  const simStateRef = useRef({
    damperPct: safeDamperPct,
    fanSpeedPct: safeFanSpeedPct,
    filterHealthPct: safeFilterHealthPct,
    ambientPM25: numberOr(ambientPM25, 0),
    indoorPM25: numberOr(indoorPM25, 0),
  });

  useEffect(() => {
    simStateRef.current = {
      damperPct: safeDamperPct,
      fanSpeedPct: safeFanSpeedPct,
      filterHealthPct: safeFilterHealthPct,
      ambientPM25: numberOr(ambientPM25, 0),
      indoorPM25: numberOr(indoorPM25, 0),
    };
  }, [safeDamperPct, safeFanSpeedPct, safeFilterHealthPct, ambientPM25, indoorPM25]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 420;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0910);
    scene.fog = new THREE.FogExp2(0x0a0910, 0.016);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(22, 14, 26);
    cameraRef.current = camera;

    // 3. Renderer Setup
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (err) {
      console.error('[AeroSense] WebGL unavailable:', err);
      setWebglError('This browser or device could not start WebGL, so the 3D view cannot render.');
      return undefined;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.target.set(0, 2.5, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const blueRimLight = new THREE.PointLight(0x38bdf8, 1.5, 55);
    blueRimLight.position.set(-16, 9, -10);
    scene.add(blueRimLight);

    const emeraldGlowLight = new THREE.PointLight(0x10b981, 1.2, 45);
    emeraldGlowLight.position.set(8, 4, 6);
    scene.add(emeraldGlowLight);

    // 6. Ground Grid
    const gridHelper = new THREE.GridHelper(60, 40, 0x27273a, 0x14131f);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // 7. HVAC Assembly Group
    const hvacGroup = new THREE.Group();
    scene.add(hvacGroup);

    const ductMaterial = new THREE.MeshStandardMaterial({
      color: 0x232230,
      roughness: 0.35,
      metalness: 0.82,
      transparent: true,
      opacity: 0.88,
    });

    // 7a. Outdoor Duct
    const outdoorDuctGeom = new THREE.BoxGeometry(7, 3, 3);
    const outdoorDuct = new THREE.Mesh(outdoorDuctGeom, ductMaterial);
    outdoorDuct.position.set(-11, 4.5, 0);
    hvacGroup.add(outdoorDuct);

    // 7b. Mechanical Damper Flap
    const damperFlapGeom = new THREE.BoxGeometry(0.12, 2.7, 2.7);
    const damperFlapMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.2,
      metalness: 0.9,
    });
    const damperFlap = new THREE.Mesh(damperFlapGeom, damperFlapMat);
    damperFlap.position.set(-8.5, 4.5, 0);
    hvacGroup.add(damperFlap);
    damperMeshRef.current = damperFlap;

    // 7c. Mixing Plenum Chamber
    const mixingGeom = new THREE.BoxGeometry(5, 6, 4.5);
    const mixingBox = new THREE.Mesh(mixingGeom, ductMaterial);
    mixingBox.position.set(-5, 3.5, 0);
    hvacGroup.add(mixingBox);

    // 7d. Return Duct
    const returnDuctGeom = new THREE.BoxGeometry(4, 2.2, 2.5);
    const returnDuct = new THREE.Mesh(returnDuctGeom, ductMaterial);
    returnDuct.position.set(-5, 0.8, 3.5);
    returnDuct.rotation.y = Math.PI / 2;
    hvacGroup.add(returnDuct);

    // 7e. HEPA Filter Bank
    const hepaGeom = new THREE.BoxGeometry(1.2, 4.5, 4.0);
    const hepaMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.85,
      metalness: 0.1,
    });
    const hepaFilterMesh = new THREE.Mesh(hepaGeom, hepaMat);
    hepaFilterMesh.position.set(-1.8, 3.5, 0);
    hvacGroup.add(hepaFilterMesh);
    hepaMatRef.current = hepaMat;

    // HEPA Filter Frame
    const hepaFrameGeom = new THREE.BoxGeometry(1.3, 4.7, 4.2);
    const hepaFrameMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.3,
      metalness: 0.75,
    });
    const hepaFrame = new THREE.Mesh(hepaFrameGeom, hepaFrameMat);
    hepaFrame.position.set(-1.8, 3.5, 0);
    hvacGroup.add(hepaFrame);

    // 7f. Centrifugal Blower Housing
    const fanHousingGeom = new THREE.CylinderGeometry(2.2, 2.2, 2.5, 24);
    const fanHousingMat = new THREE.MeshStandardMaterial({
      color: 0x1e1d2b,
      roughness: 0.4,
      metalness: 0.8,
    });
    const fanHousing = new THREE.Mesh(fanHousingGeom, fanHousingMat);
    fanHousing.position.set(1.5, 3.5, 0);
    fanHousing.rotation.x = Math.PI / 2;
    hvacGroup.add(fanHousing);

    // 7g. Rotating Fan Impeller Blades
    const fanBladesGroup = new THREE.Group();
    fanBladesGroup.position.set(1.5, 3.5, 0);
    hvacGroup.add(fanBladesGroup);
    fanBladesRef.current = fanBladesGroup;

    for (let i = 0; i < 6; i++) {
      const bladeGeom = new THREE.BoxGeometry(0.1, 1.8, 1.8);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        metalness: 0.85,
        roughness: 0.25,
      });
      const blade = new THREE.Mesh(bladeGeom, bladeMat);
      blade.rotation.z = (i * Math.PI) / 3;
      fanBladesGroup.add(blade);
    }

    // 7h. Supply Duct into Room
    const supplyDuctGeom = new THREE.BoxGeometry(4.5, 2.8, 3);
    const supplyDuct = new THREE.Mesh(supplyDuctGeom, ductMaterial);
    supplyDuct.position.set(4.8, 3.5, 0);
    hvacGroup.add(supplyDuct);

    // 8. Dynamic Critical Indoor Room Model
    const roomGroup = new THREE.Group();
    roomGroup.position.set(14, 3.5, 0);
    scene.add(roomGroup);
    roomGroupRef.current = roomGroup;

    const roomWallMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.08,
      roughness: 0.1,
      metalness: 0.1,
    });
    roomWallMatRef.current = roomWallMat;

    const occupantsGroup = new THREE.Group();
    roomGroup.add(occupantsGroup);
    occupantsGroupRef.current = occupantsGroup;

    // Helper: Rebuild Room Geometry & Occupants
    function rebuildRoom(vol, height, occCount) {
      // Remove previous room meshes (except occupantsGroup)
      const toRemove = [];
      roomGroup.children.forEach((child) => {
        if (child !== occupantsGroup) toRemove.push(child);
      });
      toRemove.forEach((child) => {
        roomGroup.remove(child);
        child.geometry?.dispose();
      });

      const floorArea = vol / height;
      const width = Math.min(18, Math.max(8, Math.sqrt(floorArea * 1.2)));
      const depth = Math.min(16, Math.max(7, floorArea / width));
      const visualH = Math.min(10, Math.max(5, height * 1.8));

      // Wall Mesh
      const roomWallGeom = new THREE.BoxGeometry(width, visualH, depth);
      const roomMesh = new THREE.Mesh(roomWallGeom, roomWallMat);
      roomGroup.add(roomMesh);

      // Edges Wireframe
      const edgesGeom = new THREE.EdgesGeometry(roomWallGeom);
      const roomEdges = new THREE.LineSegments(
        edgesGeom,
        new THREE.LineBasicMaterial({ color: 0x475569 })
      );
      roomGroup.add(roomEdges);

      // Floor
      const roomFloorGeom = new THREE.PlaneGeometry(width, depth);
      const roomFloorMat = new THREE.MeshStandardMaterial({
        color: 0x111019,
        roughness: 0.65,
      });
      const roomFloor = new THREE.Mesh(roomFloorGeom, roomFloorMat);
      roomFloor.position.y = -visualH / 2 + 0.01;
      roomFloor.rotation.x = -Math.PI / 2;
      roomGroup.add(roomFloor);

      // Rebuild 3D Occupants
      while (occupantsGroup.children.length > 0) {
        const occ = occupantsGroup.children[0];
        occupantsGroup.remove(occ);
        occ.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
        });
      }

      if (occCount > 0) {
        const visCount = Math.min(30, Math.floor(occCount / 1.4) + 2);
        const cols = Math.ceil(Math.sqrt(visCount * 1.2));
        const rows = Math.ceil(visCount / cols);

        for (let i = 0; i < visCount; i++) {
          const bodyGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.85, 8);
          const headGeom = new THREE.SphereGeometry(0.2, 8, 8);
          const occMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 });

          const person = new THREE.Group();
          const body = new THREE.Mesh(bodyGeom, occMat);
          body.position.y = -visualH / 2 + 0.6;
          const head = new THREE.Mesh(headGeom, occMat);
          head.position.y = -visualH / 2 + 1.2;
          person.add(body);
          person.add(head);

          const r = Math.floor(i / cols);
          const c = i % cols;
          const xPos = -width / 2 + 1.5 + (c * (width - 3)) / Math.max(1, cols - 1);
          const zPos = -depth / 2 + 1.5 + (r * (depth - 3)) / Math.max(1, rows - 1);
          person.position.set(xPos + Math.random() * 0.2, 0, zPos + Math.random() * 0.2);
          occupantsGroup.add(person);
        }
      }
    }

    rebuildRoom(roomVolM3, ceilingHeightM, occupancy);

    // 9. Procedural 3D Airflow Particles System
    const PARTICLE_COUNT = 380;
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleColors = new Float32Array(PARTICLE_COUNT * 3);
    const particleData = [];

    const pGeom = new THREE.BufferGeometry();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isOutdoor = Math.random() < 0.5;
      const pd = {
        isOutdoor,
        x: isOutdoor ? -14 + Math.random() * 4 : -5 + Math.random() * 2,
        y: isOutdoor ? 4.5 + (Math.random() - 0.5) * 1.8 : 0.8 + (Math.random() - 0.5) * 1.2,
        z: isOutdoor ? (Math.random() - 0.5) * 1.8 : 3.5 + (Math.random() - 0.5) * 1.2,
        speed: 0.12 + Math.random() * 0.08,
        passedFilter: false,
        stage: isOutdoor ? 'outdoor' : 'return',
      };
      particleData.push(pd);

      particlePositions[i * 3] = pd.x;
      particlePositions[i * 3 + 1] = pd.y;
      particlePositions[i * 3 + 2] = pd.z;

      particleColors[i * 3] = 0.5;
      particleColors[i * 3 + 1] = 0.7;
      particleColors[i * 3 + 2] = 1.0;
    }

    pGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    pGeom.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.36,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(pGeom, pMat);
    scene.add(particleSystem);

    function updateParticles() {
      const positions = pGeom.attributes.position.array;
      const colors = pGeom.attributes.color.array;
      const currentFanSpeed = simStateRef.current.fanSpeedPct;
      const currentDamper = simStateRef.current.damperPct;
      const currentAmbientPM = simStateRef.current.ambientPM25;
      const fanSpeedMult = Math.max(0.15, currentFanSpeed / 45.0);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const pd = particleData[i];
        const step = pd.speed * fanSpeedMult;

        if (pd.stage === 'outdoor') {
          pd.x += step;
          if (pd.x > -7.5) {
            const damperAllow = Math.random() < currentDamper / 100.0;
            if (!damperAllow) {
              pd.x = -14;
              pd.y = 4.5 + (Math.random() - 0.5) * 1.8;
              pd.z = (Math.random() - 0.5) * 1.8;
            } else {
              pd.stage = 'mixing';
            }
          }
        } else if (pd.stage === 'return') {
          pd.z -= step * 1.2;
          if (pd.z < 0.5) {
            pd.stage = 'mixing';
            pd.y = 3.5 + (Math.random() - 0.5) * 2;
          }
        } else if (pd.stage === 'mixing') {
          pd.x += step * 1.4;
          pd.y += (3.5 - pd.y) * 0.05;
          pd.z += (0 - pd.z) * 0.05;

          if (pd.x >= -1.8 && !pd.passedFilter) {
            if (pd.isOutdoor && currentAmbientPM > 100.0 && Math.random() < 0.98) {
              // Captured by HEPA filter
              pd.stage = 'outdoor';
              pd.x = -14;
              pd.y = 4.5 + (Math.random() - 0.5) * 1.8;
              pd.z = (Math.random() - 0.5) * 1.8;
              continue;
            }
            pd.passedFilter = true;
          }

          if (pd.x > 7.0) {
            pd.stage = 'room';
          }
        } else if (pd.stage === 'room') {
          pd.x += step * 1.2;
          pd.y += (Math.random() - 0.5) * 0.1;
          pd.z += (Math.random() - 0.5) * 0.1;

          if (pd.x > 20.0) {
            pd.passedFilter = false;
            pd.isOutdoor = Math.random() < currentDamper / 100.0;
            if (pd.isOutdoor) {
              pd.stage = 'outdoor';
              pd.x = -14;
              pd.y = 4.5 + (Math.random() - 0.5) * 1.8;
              pd.z = (Math.random() - 0.5) * 1.8;
            } else {
              pd.stage = 'return';
              pd.x = -5 + (Math.random() - 0.5) * 1.5;
              pd.y = 0.8 + (Math.random() - 0.5) * 0.8;
              pd.z = 4.0;
            }
          }
        }

        // Color coding particles
        if (!pd.passedFilter && pd.isOutdoor && currentAmbientPM > 250) {
          // Toxic red/crimson smog
          colors[i * 3] = 0.96;
          colors[i * 3 + 1] = 0.22;
          colors[i * 3 + 2] = 0.32;
        } else if (!pd.passedFilter && pd.isOutdoor && currentAmbientPM > 80) {
          // Amber/orange smog
          colors[i * 3] = 0.98;
          colors[i * 3 + 1] = 0.65;
          colors[i * 3 + 2] = 0.12;
        } else if (pd.passedFilter) {
          // Pure clean emerald safe air
          colors[i * 3] = 0.1;
          colors[i * 3 + 1] = 0.85;
          colors[i * 3 + 2] = 0.48;
        } else {
          // Normal recirculating ambient air (soft cyan/slate)
          colors[i * 3] = 0.45;
          colors[i * 3 + 1] = 0.65;
          colors[i * 3 + 2] = 0.95;
        }

        positions[i * 3] = pd.x;
        positions[i * 3 + 1] = pd.y;
        positions[i * 3 + 2] = pd.z;
      }

      pGeom.attributes.position.needsUpdate = true;
      pGeom.attributes.color.needsUpdate = true;
    }

    // 10. Main Animation Loop
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      const currentFanSpeed = simStateRef.current.fanSpeedPct;
      const currentDamper = simStateRef.current.damperPct;
      const currentFilterHealth = simStateRef.current.filterHealthPct;
      const currentIndoorPM = simStateRef.current.indoorPM25;

      // Spin fan impeller blades strictly proportional to VFD speed
      if (fanBladesRef.current) {
        const fanRPMFactor = (currentFanSpeed / 100.0) * 0.45;
        fanBladesRef.current.rotation.z += fanRPMFactor;
      }

      // Rotate damper flap
      if (damperMeshRef.current) {
        const targetDamperRot = (currentDamper / 100.0) * (Math.PI / 2.2);
        damperMeshRef.current.rotation.y = -targetDamperRot;
      }

      // HEPA filter discoloration based on dust loading
      if (hepaMatRef.current) {
        const dustFrac = 1.0 - currentFilterHealth / 100.0;
        const filterGrey = Math.max(0.18, 0.94 - dustFrac * 0.72);
        hepaMatRef.current.color.setRGB(filterGrey, filterGrey, filterGrey * 1.05);
      }

      // Dynamic room wall color tint
      if (roomWallMatRef.current) {
        if (currentIndoorPM > 25.0) {
          roomWallMatRef.current.color.setHex(0xf43f5e); // Rose hazard
        } else if (currentIndoorPM > 12.0) {
          roomWallMatRef.current.color.setHex(0xf59e0b); // Amber moderate
        } else {
          roomWallMatRef.current.color.setHex(0x10b981); // Emerald clean
        }
      }

      updateParticles();
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 11. Handle Resizing
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight || 420;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // Store rebuild function for props updates
    mountRef.current._rebuildRoom = rebuildRoom;

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      controls.dispose();
      renderer.dispose();
      pGeom.dispose();
      pMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // Run once on mount

  // Reactively rebuild room geometry when geometry parameters change
  useEffect(() => {
    if (mountRef.current?._rebuildRoom) {
      mountRef.current._rebuildRoom(roomVolM3, ceilingHeightM, occupancy);
    }
  }, [roomVolM3, ceilingHeightM, occupancy]);

  // Camera Presets
  const setCameraView = (view) => {
    setActiveCameraView(view);
    soundEffects.playPop(520);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (view === 'iso') {
      camera.position.set(22, 14, 26);
      controls.target.set(0, 2.5, 0);
    } else if (view === 'filter') {
      camera.position.set(-1.8, 6.2, 8.5);
      controls.target.set(-1.8, 3.5, 0);
    } else if (view === 'room') {
      camera.position.set(16, 7.5, 14);
      controls.target.set(13.5, 3.5, 0);
    }
    controls.update();
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/80 dark:border-slate-800 shadow-md relative overflow-hidden transition-all duration-500">
      {/* Viewport Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-slate-700 flex items-center justify-center shadow-xs">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                3D Industrial Digital Twin & Closed-Loop HVAC
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                THREE.JS WEBGL
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Physical airflow mass balance, rotating damper, centrifugal impeller & room geometry
            </p>
          </div>
        </div>

        {/* Live Telemetry Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            DAMPER: {formatPercent(damperPct)}
          </span>
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            FAN: {formatPercent(fanSpeedPct)} RPM
          </span>
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            ROOM: {roomVolM3}m³
          </span>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9] min-h-[18rem] max-h-[32rem] rounded-2xl overflow-hidden border border-slate-800/80 shadow-inner bg-[#0a0910]">
        <div
          ref={mountRef}
          role="img"
          aria-label="Interactive 3D model of the HVAC chamber. Readings are shown as text beneath it."
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {webglError && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center bg-slate-950/95">
            <Box className="w-7 h-7 text-slate-500" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-200">3D view unavailable</p>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{webglError}</p>
            <p className="text-[11px] text-slate-500">All telemetry remains available in the cards above.</p>
          </div>
        )}

        {/* Camera View Switcher Overlay Buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
          <button
            onClick={() => setCameraView('iso')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all backdrop-blur-md border shadow-xs ${
              activeCameraView === 'iso'
                ? 'bg-white text-slate-900 border-white shadow-md'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            Isometric
          </button>
          <button
            onClick={() => setCameraView('filter')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all backdrop-blur-md border shadow-xs ${
              activeCameraView === 'filter'
                ? 'bg-white text-slate-900 border-white shadow-md'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            HEPA Focus
          </button>
          <button
            onClick={() => setCameraView('room')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all backdrop-blur-md border shadow-xs ${
              activeCameraView === 'room'
                ? 'bg-white text-slate-900 border-white shadow-md'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            Room Interior
          </button>
        </div>

        {/* Viewport Interaction Hint & Legend */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 z-20">
          <div className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Outdoor Smog</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>HEPA Scrubbed Air</span>
          </div>

          <div className="hidden sm:block px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-400">
            Rotate: Left Click • Pan: Right Click • Zoom: Scroll
          </div>
        </div>
      </div>
    </div>
  );
}
