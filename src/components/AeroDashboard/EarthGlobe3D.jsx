import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Globe, RotateCw, Sparkles, Navigation } from 'lucide-react';

export default function EarthGlobe3D({ aqi, pm25, theme }) {
  const containerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 5.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Procedural Earth Texture Generation (Zero External Assets)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Deep ocean base
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
    oceanGrad.addColorStop(0, '#091d36');
    oceanGrad.addColorStop(0.5, '#041226');
    oceanGrad.addColorStop(1, '#091d36');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Procedural Continents (Stylized vector outlines & landmasses)
    ctx.fillStyle = '#1e3a5f';
    const drawLandmass = (x, y, rx, ry, angle = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // North America & South America
    drawLandmass(240, 160, 90, 60, -0.2);
    drawLandmass(300, 320, 55, 95, 0.1);
    // Eurasia & Africa
    drawLandmass(620, 160, 140, 70, 0.05);
    drawLandmass(540, 270, 65, 85, 0.15);
    // Australia & Islands
    drawLandmass(820, 330, 60, 45, -0.1);
    drawLandmass(180, 110, 45, 30, 0.3); // Alaska
    drawLandmass(720, 240, 45, 35, 0.4); // India
    drawLandmass(460, 110, 50, 40, 0);   // Greenland

    // Lat/Long Coordinate Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1024; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y < 512; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Glowing city light dots
    ctx.fillStyle = '#67e8f9';
    for (let i = 0; i < 220; i++) {
      const lx = (Math.sin(i * 12.3) * 0.5 + 0.5) * 1024;
      const ly = (Math.cos(i * 7.7) * 0.5 + 0.5) * 512;
      ctx.beginPath();
      ctx.arc(lx, ly, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const earthTexture = new THREE.CanvasTexture(canvas);
    earthTexture.wrapS = THREE.RepeatWrapping;
    earthTexture.wrapT = THREE.ClampToEdgeWrapping;

    // 3. Earth Globe Mesh
    const earthGeo = new THREE.SphereGeometry(1.8, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.1,
      bumpScale: 0.05,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // 4. Atmospheric Outer Glow Shell
    const glowGeo = new THREE.SphereGeometry(1.92, 48, 48);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.primaryHex || '#10b981'),
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    // 5. Cloud/Aerosol Particle Layer
    const particleCount = 280;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const alertColor = new THREE.Color(theme.primaryHex || '#10b981');
    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 2.02 + Math.random() * 0.25;

      particlePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      particlePos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePos[i * 3 + 2] = r * Math.cos(phi);

      particleColors[i * 3] = alertColor.r;
      particleColors[i * 3 + 1] = alertColor.g;
      particleColors[i * 3 + 2] = alertColor.b;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 6. Sensor Station Beacon Pin
    const pinGroup = new THREE.Group();
    const pinGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.position.y = 0.18;
    pinGroup.add(pinMesh);

    const beaconGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.y = 0.35;
    pinGroup.add(beaconMesh);

    // Position at latitude/longitude roughly India/Asia
    const phiPin = (90 - 20) * (Math.PI / 180);
    const thetaPin = (78 + 180) * (Math.PI / 180);
    const rPin = 1.8;
    pinGroup.position.set(
      -rPin * Math.sin(phiPin) * Math.cos(thetaPin),
      rPin * Math.cos(phiPin),
      rPin * Math.sin(phiPin) * Math.sin(thetaPin)
    );
    pinGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pinGroup.position.clone().normalize());
    scene.add(pinGroup);

    // 7. Lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(5, 3, 4);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.2);
    scene.add(ambientLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    rimLight.position.set(-5, -2, -3);
    scene.add(rimLight);

    // 8. Mouse Interactions
    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      setIsDragging(true);
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      earthMesh.rotation.y += deltaX * 0.008;
      earthMesh.rotation.x += deltaY * 0.008;
      particleSystem.rotation.y += deltaX * 0.008;
      pinGroup.rotation.y += deltaX * 0.008;

      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Touch support for mobile / tablet
    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        setIsDragging(true);
        previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const handleTouchMove = (e) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePosition.current.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.current.y;
      earthMesh.rotation.y += deltaX * 0.008;
      earthMesh.rotation.x += deltaY * 0.008;
      previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    // 9. Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gentle auto-rotation when user is not manually dragging
      if (!isDraggingRef.current) {
        earthMesh.rotation.y += 0.0025;
        particleSystem.rotation.y += 0.004;
        particleSystem.rotation.x = Math.sin(elapsedTime * 0.2) * 0.05;
        glowMesh.rotation.y += 0.0015;
      }

      // Pulsing sensor pin glow
      const pinScale = 1 + Math.sin(elapsedTime * 4) * 0.25;
      beaconMesh.scale.set(pinScale, pinScale, pinScale);

      // Dynamically update glow color according to environmental theme
      const targetColor = new THREE.Color(theme.primaryHex || '#10b981');
      glowMat.color.lerp(targetColor, 0.05);

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
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      earthTexture.dispose();
    };
  }, [theme.primaryHex]);

  return (
    <div 
      className="glass-card rounded-2xl p-4 border border-white/80 shadow-sm relative overflow-hidden flex flex-col justify-between h-full min-h-[340px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-slate-900/5 text-slate-800">
            <Globe className="w-4 h-4 text-sky-500 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Atmospheric 3D Globe</h3>
            <p className="text-[11px] text-slate-400">Global Air Dispersion Model</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-white/70 px-2.5 py-1 rounded-full border border-slate-200/60 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Station Alpha-01</span>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div 
        ref={containerRef} 
        className={`w-full h-56 sm:h-64 my-auto cursor-grab active:cursor-grabbing transition-transform duration-300 relative ${
          isHovered ? 'scale-[1.02]' : 'scale-100'
        }`}
      />

      {/* Interactive Drag & Atmospheric Readout Footer */}
      <div className="z-10 relative flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Navigation className="w-3.5 h-3.5 text-sky-500" />
          <span className="text-[11px] font-medium">Click & drag to inspect planetary airflow</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded">
            λ: 28.6°N, 77.2°E
          </span>
        </div>
      </div>
    </div>
  );
}
