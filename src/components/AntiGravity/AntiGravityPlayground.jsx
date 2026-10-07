import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { 
  Search, 
  Mic, 
  Camera, 
  Grid, 
  RotateCcw, 
  Zap, 
  Compass, 
  Sparkles, 
  Volume2, 
  VolumeX,
  Radio,
  ArrowUp,
  ArrowDown,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundEffects } from '../../utils/soundEffects';

export default function AntiGravityPlayground() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const runnerRef = useRef(null);
  const bodiesMapRef = useRef(new Map());
  const elementsRef = useRef({});
  const animFrameRef = useRef(null);
  const mouseConstraintRef = useRef(null);

  const [hasCollapsed, setHasCollapsed] = useState(false);
  const [countdown, setCountdown] = useState(1.5);
  const [gravityMode, setGravityMode] = useState('earth'); // 'earth', 'zero', 'inverted', 'jupiter'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [collisionCount, setCollisionCount] = useState(0);
  const [shockwaves, setShockwaves] = useState([]);

  // Search input state so user can actually type in Google search bar!
  const [query, setQuery] = useState('');

  // 1. Initialize Google UI Elements & Physics Bodies
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const {
      Engine,
      World,
      Bodies,
      Body,
      Mouse,
      MouseConstraint,
      Events,
      Runner
    } = Matter;

    // Create Engine with realistic restitution
    const engine = Engine.create({
      enableSleeping: false,
    });
    engine.gravity.y = 0; // Starts at 0 before collapse
    engine.gravity.x = 0;
    engineRef.current = engine;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Boundaries: Floor, Ceiling, Left Wall, Right Wall
    const wallThickness = 120;
    const floor = Bodies.rectangle(width / 2, height + wallThickness / 2, width * 2, wallThickness, {
      isStatic: true,
      restitution: 0.65,
      friction: 0.3,
      label: 'floor'
    });
    const ceiling = Bodies.rectangle(width / 2, -wallThickness / 2, width * 2, wallThickness, {
      isStatic: true,
      restitution: 0.65,
      friction: 0.3,
      label: 'ceiling'
    });
    const leftWall = Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, {
      isStatic: true,
      restitution: 0.65,
      friction: 0.3,
      label: 'leftWall'
    });
    const rightWall = Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, {
      isStatic: true,
      restitution: 0.65,
      friction: 0.3,
      label: 'rightWall'
    });

    World.add(engine.world, [floor, ceiling, leftWall, rightWall]);

    // Map DOM elements to rigid bodies
    const newBodiesMap = new Map();
    const domKeys = Object.keys(elementsRef.current);

    domKeys.forEach((key) => {
      const el = elementsRef.current[key];
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();

      const cx = rect.left - contRect.left + rect.width / 2;
      const cy = rect.top - contRect.top + rect.height / 2;

      const body = Bodies.rectangle(cx, cy, Math.max(30, rect.width), Math.max(20, rect.height), {
        restitution: 0.6,
        friction: 0.15,
        frictionAir: 0.015,
        density: 0.002,
        isStatic: true, // will be set to false upon collapse
        label: key
      });

      World.add(engine.world, body);
      newBodiesMap.set(key, {
        body,
        initialX: cx,
        initialY: cy,
        initialAngle: 0,
        element: el,
        width: rect.width,
        height: rect.height
      });
    });

    bodiesMapRef.current = newBodiesMap;

    // Mouse Dragging & Flinging Constraint
    const mouse = Mouse.create(container);
    // Adjust mouse offset for container relative position
    mouse.pixelRatio = window.devicePixelRatio || 1;

    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.25,
        damping: 0.1,
        render: { visible: false }
      }
    });
    mouseConstraintRef.current = mouseConstraint;
    World.add(engine.world, mouseConstraint);

    // Collision sound & counter
    Events.on(engine, 'collisionStart', (event) => {
      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const speed = Math.hypot(
          pair.bodyA.velocity.x - pair.bodyB.velocity.x,
          pair.bodyA.velocity.y - pair.bodyB.velocity.y
        );

        if (speed > 2.2) {
          setCollisionCount((prev) => prev + 1);
          soundEffects.playThud(Math.min(10, speed));
        }
      }
    });

    // Start physics runner
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    // Animation frame syncing physics bodies to DOM coordinates
    const syncDOM = () => {
      newBodiesMap.forEach(({ body, element }) => {
        if (!body || !element) return;

        // Clamp excessive velocity to prevent boundary tunneling
        const maxVelocity = 28;
        if (Math.abs(body.velocity.x) > maxVelocity) {
          Body.setVelocity(body, { x: Math.sign(body.velocity.x) * maxVelocity, y: body.velocity.y });
        }
        if (Math.abs(body.velocity.y) > maxVelocity) {
          Body.setVelocity(body, { x: body.velocity.x, y: Math.sign(body.velocity.y) * maxVelocity });
        }

        // Apply 2D transform to DOM element
        const x = body.position.x - element.offsetWidth / 2;
        const y = body.position.y - element.offsetHeight / 2;
        const deg = (body.angle * 180) / Math.PI;

        element.style.transform = `translate3d(${x}px, ${y}px, 0px) rotate(${deg}deg)`;
      });

      animFrameRef.current = requestAnimationFrame(syncDOM);
    };

    animFrameRef.current = requestAnimationFrame(syncDOM);

    // Dynamic resize handler
    const handleResize = () => {
      const newW = container.clientWidth;
      const newH = container.clientHeight;

      Body.setPosition(floor, { x: newW / 2, y: newH + wallThickness / 2 });
      Body.setPosition(ceiling, { x: newW / 2, y: -wallThickness / 2 });
      Body.setPosition(rightWall, { x: newW + wallThickness / 2, y: newH / 2 });
      Body.setPosition(leftWall, { x: -wallThickness / 2, y: newH / 2 });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (runnerRef.current) Runner.stop(runnerRef.current);
      World.clear(engine.world);
      Engine.clear(engine);
    };
  }, []);

  // 2. Countdown Timer & Automatic Gravity Trigger after 1.5s
  useEffect(() => {
    if (hasCollapsed) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0.1) {
          clearInterval(interval);
          triggerCollapse();
          return 0;
        }
        return Number((prev - 0.1).toFixed(1));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [hasCollapsed]);

  // 3. Trigger Collapse Function
  const triggerCollapse = () => {
    if (!engineRef.current || hasCollapsed) return;
    setHasCollapsed(true);

    const { Body } = Matter;
    const engine = engineRef.current;

    // Activate gravity
    engine.gravity.y = 1.0;
    soundEffects.playGravityWhoosh(false);

    // Make all bodies dynamic and apply organic tumbling impulse
    bodiesMapRef.current.forEach(({ body }) => {
      Body.setStatic(body, false);
      const torque = (Math.random() - 0.5) * 0.08;
      const vx = (Math.random() - 0.5) * 4;
      const vy = Math.random() * 2;
      Body.setAngularVelocity(body, torque);
      Body.setVelocity(body, { x: vx, y: vy });
    });
  };

  // 4. Reset & Reassemble Function
  const handleReset = () => {
    if (!engineRef.current) return;
    const { Body } = Matter;
    const engine = engineRef.current;

    engine.gravity.y = 0;
    setGravityMode('earth');

    bodiesMapRef.current.forEach(({ body, initialX, initialY }) => {
      Body.setStatic(body, true);
      Body.setPosition(body, { x: initialX, y: initialY });
      Body.setAngle(body, 0);
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
    });

    setHasCollapsed(false);
    setCountdown(1.5);
    soundEffects.playPop(520);
  };

  // 5. Gravity Mode Switching
  const setGravity = (mode) => {
    if (!engineRef.current) return;
    setGravityMode(mode);
    const engine = engineRef.current;

    if (!hasCollapsed) {
      triggerCollapse();
    }

    if (mode === 'earth') {
      engine.gravity.y = 1.0;
      soundEffects.playGravityWhoosh(false);
    } else if (mode === 'zero') {
      engine.gravity.y = 0.0;
      soundEffects.playPop(600);
      // Give gentle floating drift
      bodiesMapRef.current.forEach(({ body }) => {
        Matter.Body.applyForce(body, body.position, {
          x: (Math.random() - 0.5) * 0.005,
          y: (Math.random() - 0.5) * 0.005
        });
      });
    } else if (mode === 'inverted') {
      engine.gravity.y = -1.0;
      soundEffects.playGravityWhoosh(true);
    } else if (mode === 'jupiter') {
      engine.gravity.y = 2.8;
      soundEffects.playGravityWhoosh(false);
    }
  };

  // 6. Click Shockwave / Repulsor Blast
  const handleCanvasClick = (e) => {
    if (!containerRef.current || !engineRef.current) return;

    const contRect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - contRect.left;
    const clickY = e.clientY - contRect.top;

    // Trigger visual shockwave ring
    const newWave = { id: Date.now(), x: clickX, y: clickY };
    setShockwaves((prev) => [...prev, newWave]);
    setTimeout(() => {
      setShockwaves((prev) => prev.filter((w) => w.id !== newWave.id));
    }, 700);

    // Apply radial explosive force to all bodies
    const blastRadius = 380;
    const blastForce = 0.12;

    bodiesMapRef.current.forEach(({ body }) => {
      const dx = body.position.x - clickX;
      const dy = body.position.y - clickY;
      const dist = Math.hypot(dx, dy);

      if (dist < blastRadius && dist > 1) {
        const factor = (1 - dist / blastRadius) * blastForce;
        Matter.Body.applyForce(body, body.position, {
          x: (dx / dist) * factor,
          y: (dy / dist) * factor - 0.02
        });
        Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.15);
      }
    });

    soundEffects.playPop(340);
  };

  // Fun search lucky button
  const handleFeelingLucky = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    soundEffects.playPop(780);
  };

  return (
    <div className="space-y-4">
      {/* Interactive Toolbar */}
      <div className="glass-panel rounded-2xl p-4 border border-white/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">
                Google Anti-Gravity Physics Engine
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Matter.js 2D
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Interactive rigid bodies with restitution 0.6 • Click & drag any piece or fling across the screen!
            </p>
          </div>
        </div>

        {/* Gravity Control Buttons & Reset */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Gravity presets */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setGravity('earth')}
              className={`px-3 py-1 rounded-lg transition ${
                gravityMode === 'earth' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Earth (1G)
            </button>
            <button
              onClick={() => setGravity('zero')}
              className={`px-3 py-1 rounded-lg transition ${
                gravityMode === 'zero' ? 'bg-cyan-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Zero-G (0G)
            </button>
            <button
              onClick={() => setGravity('inverted')}
              className={`px-3 py-1 rounded-lg transition ${
                gravityMode === 'inverted' ? 'bg-purple-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inverted (-1G)
            </button>
            <button
              onClick={() => setGravity('jupiter')}
              className={`px-3 py-1 rounded-lg transition ${
                gravityMode === 'jupiter' ? 'bg-rose-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jupiter (2.8G)
            </button>
          </div>

          {/* Shockwave Blast Hint */}
          <button
            onClick={(e) => handleCanvasClick({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 shadow-xs active:scale-95 transition"
            title="Trigger an explosive shockwave force"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Shockwave</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundEffects.enabled = next;
            }}
            className={`p-2 rounded-xl border transition ${
              soundEnabled ? 'bg-white text-slate-800 border-slate-200' : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
            title="Toggle collision audio effects"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Reset Reassemble Button */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm active:scale-95 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reassemble</span>
          </button>
        </div>
      </div>

      {/* Physics Sandbox Viewport */}
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        className="relative w-full h-[620px] rounded-2xl bg-white border border-slate-200 shadow-inner overflow-hidden select-none cursor-crosshair"
      >
        {/* Status indicator on top corner */}
        <div className="absolute top-3 left-4 z-30 pointer-events-none flex items-center gap-3">
          {!hasCollapsed ? (
            <div className="bg-amber-50 text-amber-900 border border-amber-300 text-xs px-3 py-1.5 rounded-xl shadow-xs font-medium flex items-center gap-2 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Gravity activating in <strong>{countdown}s</strong>...</span>
            </div>
          ) : (
            <div className="bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs px-3 py-1 rounded-xl shadow-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Physics Active • Collisions: <strong className="font-mono">{collisionCount}</strong></span>
            </div>
          )}
        </div>

        {/* Shockwave Rings Animation */}
        {shockwaves.map((wave) => (
          <div
            key={wave.id}
            className="absolute rounded-full pointer-events-none border-2 border-cyan-400 bg-cyan-400/10 animate-ping"
            style={{
              left: wave.x - 40,
              top: wave.y - 40,
              width: 80,
              height: 80,
              animationDuration: '600ms',
            }}
          />
        ))}

        {/* ---------------- GOOGLE HOMEPAGE UI BODIES ---------------- */}

        {/* 1. Top Navigation Bar Elements */}
        <div
          ref={(el) => (elementsRef.current['nav-gmail'] = el)}
          className="absolute top-4 right-44 z-20 text-xs text-slate-700 hover:underline cursor-grab active:cursor-grabbing font-sans"
        >
          Gmail
        </div>

        <div
          ref={(el) => (elementsRef.current['nav-images'] = el)}
          className="absolute top-4 right-32 z-20 text-xs text-slate-700 hover:underline cursor-grab active:cursor-grabbing font-sans"
        >
          Images
        </div>

        <div
          ref={(el) => (elementsRef.current['nav-grid'] = el)}
          className="absolute top-3 right-20 z-20 p-2 rounded-full hover:bg-slate-100 text-slate-600 cursor-grab active:cursor-grabbing"
        >
          <Grid className="w-4 h-4" />
        </div>

        <div
          ref={(el) => (elementsRef.current['nav-signin'] = el)}
          className="absolute top-3 right-4 z-20 px-4 py-1.5 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 shadow-xs cursor-grab active:cursor-grabbing"
        >
          Sign in
        </div>

        {/* 2. Google Logo (Classic Colors) */}
        <div
          ref={(el) => (elementsRef.current['google-logo'] = el)}
          className="absolute top-28 left-1/2 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing text-center"
        >
          <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight select-none">
            <span className="text-[#4285F4]">G</span>
            <span className="text-[#EA4335]">o</span>
            <span className="text-[#FBBC05]">o</span>
            <span className="text-[#4285F4]">g</span>
            <span className="text-[#34A853]">l</span>
            <span className="text-[#EA4335]">e</span>
          </h1>
        </div>

        {/* 3. Search Bar Container */}
        <div
          ref={(el) => (elementsRef.current['search-bar'] = el)}
          className="absolute top-52 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-[560px] cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-full border border-slate-300 bg-white hover:shadow-md focus-within:shadow-md transition-shadow">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Google or type a URL"
              className="w-full text-sm text-slate-800 outline-none bg-transparent"
              onClick={(e) => e.stopPropagation()}
            />
            <Mic className="w-4 h-4 text-blue-500 cursor-pointer hover:scale-110 transition-transform shrink-0" />
            <Camera className="w-4 h-4 text-slate-400 cursor-pointer hover:scale-110 transition-transform shrink-0" />
          </div>
        </div>

        {/* 4. Google Search Buttons */}
        <div
          ref={(el) => (elementsRef.current['btn-search'] = el)}
          className="absolute top-68 left-1/2 -translate-x-28 z-20 cursor-grab active:cursor-grabbing"
        >
          <button
            onClick={() => triggerCollapse()}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs"
          >
            Google Search
          </button>
        </div>

        <div
          ref={(el) => (elementsRef.current['btn-lucky'] = el)}
          className="absolute top-68 left-1/2 translate-x-4 z-20 cursor-grab active:cursor-grabbing"
        >
          <button
            onClick={handleFeelingLucky}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs"
          >
            I'm Feeling Lucky
          </button>
        </div>

        {/* 5. Google Language Bar */}
        <div
          ref={(el) => (elementsRef.current['lang-bar'] = el)}
          className="absolute top-84 left-1/2 -translate-x-1/2 z-20 text-xs text-slate-600 cursor-grab active:cursor-grabbing text-center whitespace-nowrap"
        >
          <span>Google offered in: </span>
          <span className="text-blue-600 hover:underline">हिन्दी </span>
          <span className="text-blue-600 hover:underline">বাংলা </span>
          <span className="text-blue-600 hover:underline">తెలుగు </span>
          <span className="text-blue-600 hover:underline">मराठी </span>
          <span className="text-blue-600 hover:underline">தமிழ்</span>
        </div>

        {/* 6. Footer Bars */}
        <div
          ref={(el) => (elementsRef.current['footer-location'] = el)}
          className="absolute bottom-12 left-6 z-20 text-xs text-slate-500 bg-slate-100/80 px-3 py-1 rounded-md border border-slate-200/60 cursor-grab active:cursor-grabbing"
        >
          India • From your IP address • Update location
        </div>

        <div
          ref={(el) => (elementsRef.current['footer-left-links'] = el)}
          className="absolute bottom-4 left-6 z-20 flex items-center gap-4 text-xs text-slate-500 cursor-grab active:cursor-grabbing"
        >
          <span className="hover:underline">About</span>
          <span className="hover:underline">Advertising</span>
          <span className="hover:underline">Business</span>
          <span className="hover:underline">How Search works</span>
        </div>

        <div
          ref={(el) => (elementsRef.current['footer-right-links'] = el)}
          className="absolute bottom-4 right-6 z-20 flex items-center gap-4 text-xs text-slate-500 cursor-grab active:cursor-grabbing"
        >
          <span className="hover:underline">Privacy</span>
          <span className="hover:underline">Terms</span>
          <span className="hover:underline">Settings</span>
        </div>
      </div>
    </div>
  );
}
